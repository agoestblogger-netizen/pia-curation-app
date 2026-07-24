'use server';

import { db } from '@/lib/db';
import { competitions, promoterAssignments, proposals, users } from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/helpers';
import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/lib/audit';

export async function togglePromotorAccessModeAction(competitionId: number, mode: 'open' | 'assigned') {
  await requireRole('coordinator');

  await db.update(competitions).set({
    promotorAccessMode: mode,
    updatedAt: new Date(),
  }).where(eq(competitions.id, competitionId));

  await createAuditLog({
    action: 'update_promotor_access_mode',
    entity: 'competition',
    entityId: competitionId.toString(),
    after: { mode },
  });

  revalidatePath('/coordinator/assign-promoter');
  return { success: true };
}

export async function assignPromoterRangeAction(_prev: any, formData: FormData) {
  const session = await requireRole('coordinator');
  
  const competitionId = Number(formData.get('competitionId'));
  const promoterId = Number(formData.get('promoterId'));
  const category = formData.get('category') as string;
  const regionCenter = formData.get('regionCenter') as string | undefined;
  const rangeString = formData.get('rangeString') as string;

  if (!competitionId || !promoterId || !category || !rangeString) {
    return { error: 'Input tidak lengkap' };
  }
  
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

  // Calculate row_number over all proposals in competition
  const result = await db.execute(sql`
    WITH RankedProposals AS (
      SELECT id, category, region_center, status,
        ROW_NUMBER() OVER (
          PARTITION BY category, region_center 
          ORDER BY id ASC
        ) as row_number
      FROM proposals
      WHERE competition_id = ${competitionId}
        AND category = ${category}
        AND (status IS NULL OR status != 'gugur')
        ${regionCenter ? sql`AND region_center = ${regionCenter}` : sql`AND (region_center IS NULL OR region_center = '')`}
    )
    SELECT id, row_number, status FROM RankedProposals
    WHERE row_number IN (${sql.join(requestedRows.map(n => sql`${n}`), sql`, `)})
  `);

  const proposalsInRange = result as unknown as { id: number, row_number: number, status: string }[];
  if (proposalsInRange.length === 0) return { error: 'Tidak ada proposal pada range tersebut' };

  // Filter only 'promotor_selection' proposals
  const validProposals = proposalsInRange.filter(p => p.status === 'promotor_selection');
  if (validProposals.length === 0) return { error: 'Pada range tersebut, tidak ada proposal berstatus promotor_selection' };

  const proposalIds = validProposals.map(p => p.id);

  // Check existing assignments for THESE proposals
  const existing = await db.select({ proposalId: promoterAssignments.proposalId, promoterName: users.name })
    .from(promoterAssignments)
    .leftJoin(users, eq(users.id, promoterAssignments.promoterId))
    .where(
      and(
        eq(promoterAssignments.competitionId, competitionId),
        inArray(promoterAssignments.proposalId, proposalIds)
      )
    );

  if (existing.length > 0) {
    const conflictId = existing[0].proposalId;
    const conflictRow = proposalsInRange.find(p => p.id === conflictId)?.row_number;
    const conflictPromoter = existing[0].promoterName ?? 'Promotor Lain';
    return { error: `Gagal: Proposal No. ${conflictRow} sudah di-assign ke ${conflictPromoter}` };
  }

  // Insert
  await db.insert(promoterAssignments).values(
    proposalIds.map((pid) => ({
      competitionId,
      proposalId: pid,
      promoterId,
      assignedBy: session.userId,
    }))
  );

  await createAuditLog({
    action: 'assign_promoter_range',
    entity: 'competition',
    entityId: competitionId.toString(),
    after: { promoterId, count: proposalIds.length, rangeString },
  });

  revalidatePath('/coordinator/assign-promoter');
  return { success: true };
}

export async function deletePromoterRangeAction(competitionId: number, proposalIds: number[]) {
  await requireRole('coordinator');
  if (proposalIds.length === 0) return { success: true };

  await db.delete(promoterAssignments).where(
    and(
      eq(promoterAssignments.competitionId, competitionId),
      inArray(promoterAssignments.proposalId, proposalIds)
    )
  );

  await createAuditLog({
    action: 'delete_promoter_range',
    entity: 'competition',
    entityId: competitionId.toString(),
    after: { count: proposalIds.length },
  });

  revalidatePath('/coordinator/assign-promoter');
  return { success: true };
}
