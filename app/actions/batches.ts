'use server';

import { db } from '@/lib/db';
import {
  curationBatches,
  curatorAssignments,
  curatorQuotaConfigs,
  assignmentHistory,
  proposals,
  users,
  quotaFactorConfigs,
} from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';

import { equalAssign } from '@/lib/assignment/equal';
import { categoryBasedAssign } from '@/lib/assignment/category-based';
import { manualQuotaAssign } from '@/lib/assignment/manual-quota';
import {
  weightedAssign,
  calculateWeightedQuotas,
  DEFAULT_FACTORS,
} from '@/lib/assignment/weighted';
import { hybridAssign } from '@/lib/assignment/hybrid';
import {
  ProposalItem,
  CuratorInfo,
  validateNoDoubleAssignment,
} from '@/lib/assignment/types';

const createBatchSchema = z.object({
  competitionId: z.coerce.number(),
  name: z.string().min(1),
  assignmentMode: z.enum(['equal', 'manual_quota', 'weighted', 'category_based', 'hybrid', 'manual_range']),
});

type BatchActionState = {
  success?: boolean;
  error?: string;
  batchId?: number;
};

export async function createBatchAction(
  _prev: BatchActionState,
  formData: FormData
): Promise<BatchActionState> {
  await requireRole('coordinator');

  const parsed = createBatchSchema.safeParse({
    competitionId: formData.get('competitionId'),
    name: formData.get('name'),
    assignmentMode: formData.get('assignmentMode'),
  });

  if (!parsed.success) {
    return { error: (parsed.error as any).errors[0]?.message ?? 'Data tidak valid' };
  }

  const [batch] = await db
    .insert(curationBatches)
    .values(parsed.data)
    .returning();

  await audit.createBatch(batch.id, parsed.data);
  revalidatePath('/coordinator/batches');

  return { success: true, batchId: batch.id };
}

/**
 * Run automatic assignment for a batch based on its mode.
 * This is idempotent — running twice doesn't double-assign.
 */
export async function runAutoAssignAction(
  batchId: number,
  curatorIds: number[],
  config?: unknown
): Promise<BatchActionState> {
  const session = await requireRole('coordinator');

  const [batch] = await db
    .select()
    .from(curationBatches)
    .where(eq(curationBatches.id, batchId))
    .limit(1);

  if (!batch) return { error: 'Batch tidak ditemukan' };
  if (batch.status === 'locked') return { error: 'Batch sudah dikunci' };

  // Remove existing assignments for this batch (idempotent)
  await db.delete(curatorAssignments).where(eq(curatorAssignments.batchId, batchId));

  // Get proposals for this competition that are in 'imported' status
  const proposalRows = await db
    .select({ id: proposals.id, category: proposals.category })
    .from(proposals)
    .where(eq(proposals.competitionId, batch.competitionId));

  const proposalItems: ProposalItem[] = proposalRows;

  // If no specific curatorIds passed, get all active curators
  const curatorQuery = curatorIds.length > 0
    ? db.select({ id: users.id, name: users.name }).from(users).where(and(sql`'curator' = ANY(${users.roles})`, inArray(users.id, curatorIds)))
    : db.select({ id: users.id, name: users.name }).from(users).where(and(sql`'curator' = ANY(${users.roles})`, eq(users.isActive, true)));

  const curatorRows = await curatorQuery;
  const curators: CuratorInfo[] = curatorRows;

  if (curators.length === 0) return { error: 'Tidak ada kurator aktif' };


  let assignments: Array<{ proposalId: number; curatorId: number; category: string }> = [];

  switch (batch.assignmentMode) {
    case 'equal':
      assignments = equalAssign(proposalItems, curators);
      break;

    case 'category_based':
      assignments = categoryBasedAssign(proposalItems, curators, config as Parameters<typeof categoryBasedAssign>[2]);
      break;

    case 'manual_quota':
      assignments = manualQuotaAssign(proposalItems, curators, config as Parameters<typeof manualQuotaAssign>[2]);
      break;

    case 'weighted': {
      // Calculate weighted quotas using factor configs
      const factorConfigs = await db
        .select()
        .from(quotaFactorConfigs)
        .where(eq(quotaFactorConfigs.competitionId, batch.competitionId));

      const factors = {
        ...DEFAULT_FACTORS,
        ...Object.fromEntries(factorConfigs.map((f) => [f.loadLevel, f.factor])),
      };

      const regionalQuotas: Record<number, number> = {};
      const configData = config as { regionalQuotas?: Record<number, number> } | undefined;
      for (const c of curators) {
        regionalQuotas[c.id] = configData?.regionalQuotas?.[c.id] ?? 0;
      }

      const categoryTotals: Record<string, number> = {};
      for (const p of proposalItems) {
        categoryTotals[p.category] = (categoryTotals[p.category] ?? 0) + 1;
      }

      const quotas = calculateWeightedQuotas(curators, categoryTotals, regionalQuotas, factors);
      assignments = weightedAssign(proposalItems, curators, quotas);

      // Save quota configs
      for (const q of quotas) {
        await db
          .insert(curatorQuotaConfigs)
          .values({
            batchId,
            curatorId: q.curatorId,
            regionalLoad: q.regionalLoad,
            recommendedWilayah: q.wilayah,
            recommendedPusat: q.pusat,
            recommendedBi: q.bi,
            recommendedBc: q.bc,
            finalWilayah: q.wilayah,
            finalPusat: q.pusat,
            finalBi: q.bi,
            finalBc: q.bc,
          })
          .onConflictDoUpdate({
            target: [curatorQuotaConfigs.batchId, curatorQuotaConfigs.curatorId],
            set: {
              regionalLoad: q.regionalLoad,
              recommendedWilayah: q.wilayah,
              recommendedPusat: q.pusat,
              recommendedBi: q.bi,
              recommendedBc: q.bc,
              finalWilayah: q.wilayah,
              finalPusat: q.pusat,
              finalBi: q.bi,
              finalBc: q.bc,
            },
          });
      }
      break;
    }

    case 'hybrid': {
      const hybridConfig = config as Parameters<typeof hybridAssign>[2];
      assignments = hybridAssign(proposalItems, curators, hybridConfig);
      break;
    }
  }

  // Validate no double assignments
  if (!validateNoDoubleAssignment(assignments)) {
    return { error: 'Terjadi duplikasi assignment — hubungi administrator' };
  }

  // Insert all assignments
  if (assignments.length > 0) {
    await db.insert(curatorAssignments).values(
      assignments.map((a) => ({
        batchId,
        proposalId: a.proposalId,
        curatorId: a.curatorId,
        category: a.category,
        assignedBy: session.userId,
      }))
    );

    // Update proposal status to under_curation
    const proposalIds = assignments.map((a) => a.proposalId);
    await db
      .update(proposals)
      .set({ status: 'under_curation', updatedAt: new Date() })
      .where(inArray(proposals.id, proposalIds));
  }

  revalidatePath(`/coordinator/batches/${batchId}`);
  return { success: true };
}

export async function reassignProposalAction(
  assignmentId: number,
  newCuratorId: number,
  reason: string
): Promise<BatchActionState> {
  const session = await requireRole('coordinator');

  const [assignment] = await db
    .select()
    .from(curatorAssignments)
    .where(eq(curatorAssignments.id, assignmentId))
    .limit(1);

  if (!assignment) return { error: 'Assignment tidak ditemukan' };
  if (assignment.status === 'completed') return { error: 'Assignment sudah selesai, tidak dapat dipindah' };

  const oldCuratorId = assignment.curatorId;

  // Check target curator doesn't already have this proposal in this batch
  const existingCheck = await db
    .select()
    .from(curatorAssignments)
    .where(
      and(
        eq(curatorAssignments.batchId, assignment.batchId),
        eq(curatorAssignments.proposalId, assignment.proposalId),
        eq(curatorAssignments.curatorId, newCuratorId)
      )
    )
    .limit(1);

  if (existingCheck.length > 0) return { error: 'Kurator target sudah memiliki proposal ini' };

  // Record history
  await db.insert(assignmentHistory).values({
    assignmentId,
    fromCuratorId: oldCuratorId,
    toCuratorId: newCuratorId,
    reason,
    reassignedBy: session.userId,
  });

  // Update assignment
  await db
    .update(curatorAssignments)
    .set({ curatorId: newCuratorId, status: 'assigned' })
    .where(eq(curatorAssignments.id, assignmentId));

  await audit.reassignProposal(assignmentId, oldCuratorId, newCuratorId, reason);
  revalidatePath(`/coordinator/batches/${assignment.batchId}`);

  return { success: true };
}

export async function lockBatchAction(batchId: number): Promise<BatchActionState> {
  const session = await requireRole('coordinator');

  await db
    .update(curationBatches)
    .set({
      status: 'locked',
      lockedAt: new Date(),
      lockedBy: session.userId,
      updatedAt: new Date(),
    })
    .where(eq(curationBatches.id, batchId));

  await audit.lockBatch(batchId);
  revalidatePath(`/coordinator/batches/${batchId}`);

  return { success: true };
}

export async function getBatchWithAssignments(batchId: number) {
  const [batch] = await db
    .select()
    .from(curationBatches)
    .where(eq(curationBatches.id, batchId))
    .limit(1);

  if (!batch) return null;

  const rankedProposals = db.$with('ranked_proposals').as(
    db.select({
      id: proposals.id,
      regionCenter: proposals.regionCenter,
      rowNumber: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${proposals.category}, ${proposals.regionCenter} ORDER BY ${proposals.id} ASC)`.as('row_number')
    }).from(proposals).where(and(
      eq(proposals.competitionId, batch.competitionId),
      sql`(${proposals.status} IS NULL OR ${proposals.status} != 'gugur')`
    ))
  );

  const assignments = await db
    .with(rankedProposals)
    .select({
      id: curatorAssignments.id,
      proposalId: curatorAssignments.proposalId,
      curatorId: curatorAssignments.curatorId,
      category: curatorAssignments.category,
      status: curatorAssignments.status,
      assignedAt: curatorAssignments.assignedAt,
      curatorName: users.name,
      proposalRowNumber: rankedProposals.rowNumber,
      proposalRegionCenter: rankedProposals.regionCenter,
    })
    .from(curatorAssignments)
    .leftJoin(users, eq(curatorAssignments.curatorId, users.id))
    .innerJoin(rankedProposals, eq(curatorAssignments.proposalId, rankedProposals.id))
    .where(eq(curatorAssignments.batchId, batchId));

  return { ...batch, assignments };
}

export async function getBatchesByCompetition(competitionId: number) {
  return db
    .select()
    .from(curationBatches)
    .where(eq(curationBatches.competitionId, competitionId));
}

const assignRangeSchema = z.object({
  batchId: z.coerce.number(),
  curatorId: z.coerce.number(),
  category: z.string(),
  regionCenter: z.string().optional(),
  rangeString: z.string().min(1, 'Range tidak boleh kosong'),
});

export async function assignRangeAction(_prev: BatchActionState, formData: FormData): Promise<BatchActionState> {
  const session = await requireRole('coordinator');
  const parsed = assignRangeSchema.safeParse({
    batchId: formData.get('batchId'),
    curatorId: formData.get('curatorId'),
    category: formData.get('category'),
    regionCenter: formData.get('regionCenter') || undefined,
    rangeString: formData.get('rangeString'),
  });

  if (!parsed.success) return { error: 'Data range tidak valid' };
  
  const { batchId, curatorId, category, regionCenter, rangeString } = parsed.data;
  
  // Parse rangeString
  const rowNumbers = new Set<number>();
  const parts = rangeString.split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr);
      const end = parseInt(endStr);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) rowNumbers.add(i);
      } else if (!isNaN(start)) {
        rowNumbers.add(start);
      }
    } else {
      const num = parseInt(part);
      if (!isNaN(num)) rowNumbers.add(num);
    }
  }

  const requestedRows = Array.from(rowNumbers);
  if (requestedRows.length === 0) return { error: 'Range tidak valid' };

  const [batch] = await db.select().from(curationBatches).where(eq(curationBatches.id, batchId)).limit(1);
  if (!batch) return { error: 'Batch tidak ditemukan' };
  if (batch.status === 'locked') return { error: 'Batch sudah dikunci' };

  // ── VALIDASI 1 KURATOR PER REGIONAL ──────────────────────────────────────
  // Aturan: grup regional (Kanwil / Kantor Pusat) hanya boleh dimiliki 1 kurator.
  // Kategori BI dan BC bebas dibagi ke banyak kurator.
  const isRegionalCategory = category === 'PUSAT' || category === 'WILAYAH';

  if (isRegionalCategory) {
    // Cari kurator yang sudah pernah dapat assignment di grup regional ini
    const existingRegionalOwner = await db
      .select({ curatorId: curatorAssignments.curatorId, curatorName: users.name })
      .from(curatorAssignments)
      .innerJoin(proposals, eq(proposals.id, curatorAssignments.proposalId))
      .leftJoin(users, eq(users.id, curatorAssignments.curatorId))
      .where(
        and(
          eq(proposals.competitionId, batch.competitionId),
          eq(proposals.category, category),
          regionCenter
            ? eq(proposals.regionCenter, regionCenter)
            : sql`(${proposals.regionCenter} IS NULL OR ${proposals.regionCenter} = '')`,
        )
      )
      .limit(1);

    if (existingRegionalOwner.length > 0) {
      const owner = existingRegionalOwner[0];
      if (owner.curatorId !== curatorId) {
        const regionLabel = category === 'PUSAT'
          ? 'Kantor Pusat'
          : `Kanwil ${regionCenter}`;
        return {
          error: `Grup regional "${regionLabel}" sudah menjadi tanggung jawab ${owner.curatorName ?? 'kurator lain'} — regional tidak boleh dibagi ke lebih dari 1 kurator.`,
        };
      }
    }
  }
  // ── END VALIDASI REGIONAL ─────────────────────────────────────────────────

  // Get all proposals for this category/region with their row numbers
  const result = await db.execute(sql`
    WITH RankedProposals AS (
      SELECT id, category, region_center,
        ROW_NUMBER() OVER (
          PARTITION BY category, region_center 
          ORDER BY id ASC
        ) as row_number
      FROM proposals
      WHERE competition_id = ${batch.competitionId}
        AND category = ${category}
        AND (status IS NULL OR status != 'gugur')
        ${regionCenter ? sql`AND region_center = ${regionCenter}` : sql`AND (region_center IS NULL OR region_center = '')`}
    )
    SELECT id, row_number FROM RankedProposals
    WHERE row_number IN (${sql.join(requestedRows.map(n => sql`${n}`), sql`, `)})
  `);

  const proposalsInRange = result as unknown as { id: number, row_number: number }[];
  if (proposalsInRange.length === 0) return { error: 'Tidak ada proposal pada range tersebut' };

  const proposalIds = proposalsInRange.map(p => p.id);

  // Check if ANY of these proposals are already assigned in this batch
  const existing = await db.select({ proposalId: curatorAssignments.proposalId, curatorName: users.name })
    .from(curatorAssignments)
    .leftJoin(users, eq(users.id, curatorAssignments.curatorId))
    .where(
      and(
        eq(curatorAssignments.batchId, batchId),
        inArray(curatorAssignments.proposalId, proposalIds)
      )
    );

  if (existing.length > 0) {
    const conflictId = existing[0].proposalId;
    const conflictRow = proposalsInRange.find(p => p.id === conflictId)?.row_number;
    const conflictCurator = existing[0].curatorName ?? 'Kurator Lain';
    return { error: `Gagal: Proposal No. ${conflictRow} sudah di-assign ke ${conflictCurator}` };
  }

  // Check if any proposals are already assigned in OTHER batches to this curator?
  // User spec: "range yang diminta TIDAK BOLEH overlap dengan proposal yang SUDAH di-assign ke kurator lain dalam kategori yang sama"
  
  // Insert assignments
  await db.insert(curatorAssignments).values(
    proposalIds.map((pid) => ({
      batchId,
      proposalId: pid,
      curatorId,
      category,
      assignedBy: session.userId,
    }))
  );

  // Update proposal status
  await db.update(proposals)
    .set({ status: 'under_curation', updatedAt: new Date() })
    .where(inArray(proposals.id, proposalIds));

  revalidatePath(`/coordinator/batches/${batchId}`);
  return { success: true };
}

export async function deleteRangeAction(batchId: number, proposalIds: number[]) {
  const session = await requireRole('coordinator');
  
  const [batch] = await db.select().from(curationBatches).where(eq(curationBatches.id, batchId)).limit(1);
  if (!batch) return { error: 'Batch tidak ditemukan' };
  if (batch.status === 'locked') return { error: 'Batch sudah dikunci' };

  if (proposalIds.length === 0) return { success: true };

  // Remove assignments
  await db.delete(curatorAssignments).where(
    and(
      eq(curatorAssignments.batchId, batchId),
      inArray(curatorAssignments.proposalId, proposalIds)
    )
  );

  // Update proposals status back to imported
  await db.update(proposals)
    .set({ status: 'imported', updatedAt: new Date() })
    .where(inArray(proposals.id, proposalIds));

  revalidatePath(`/coordinator/batches/${batchId}`);
  return { success: true };
}
