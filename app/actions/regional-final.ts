'use server';

import { db } from '@/lib/db';
import { proposals, competitions, users, curatorAssignments } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and, inArray, count } from 'drizzle-orm';
import { KANWIL_CITIES } from '@/lib/constants';
import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/lib/audit';

export type RegionalGroup = {
  region: string; // regionCenter value
  category: 'WILAYAH' | 'PUSAT';
  totalProposals: number;
  finalistCount: number;
  isLocked: boolean;
  hasLockedFgd: boolean;
  lockedFgdSessionId: number | null;
  proposals: {
    id: number;
    title: string;
    proposerName: string;
    aiCidaTotal: number | null;
    aiCidaAverageSkor: number | null;
    status: string;
    regionalFinalistRank: number | null;
    regionalFinalizedAt: Date | null;
  }[];
};

/**
 * Get all regional groups with their proposals (screened/lolos only).
 * Returns 12 Kanwil groups + 1 Kanpus group.
 */
export async function getRegionalGroups(competitionId: number): Promise<RegionalGroup[]> {
  await requireRole('coordinator');

  // Get all WILAYAH and PUSAT proposals that passed screening
  const eligibleStatuses = ['curation_passed', 'regional_finalist', 'takeout'];
  const regionalProposals = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      proposerName: proposals.proposerName,
      category: proposals.category,
      regionCenter: proposals.regionCenter,
      status: proposals.status,
      aiCidaTotal: proposals.aiCidaTotal,
      aiCidaAverageSkor: proposals.aiCidaAverageSkor,
      regionalFinalistRank: proposals.regionalFinalistRank,
      regionalFinalizedAt: proposals.regionalFinalizedAt,
    })
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, competitionId),
        inArray(proposals.category, ['WILAYAH', 'PUSAT']),
        inArray(proposals.status, eligibleStatuses)
      )
    );

  // Group by regionCenter / category
  const groupMap = new Map<string, RegionalGroup>();

  for (const p of regionalProposals) {
    const groupKey = p.category === 'PUSAT'
      ? '__PUSAT__'
      : (p.regionCenter ?? 'Tidak Diketahui');

    const mappedRegionLabel = KANWIL_CITIES.includes(p.regionCenter || '') 
      ? `Kanwil ${p.regionCenter}` 
      : (p.regionCenter ?? 'Tidak Diketahui');

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        region: p.category === 'PUSAT' ? 'Kantor Pusat' : mappedRegionLabel,
        category: p.category as 'WILAYAH' | 'PUSAT',
        totalProposals: 0,
        finalistCount: 0,
        isLocked: false,
        hasLockedFgd: false,
        lockedFgdSessionId: null,
        proposals: [],
      });
    }

    const group = groupMap.get(groupKey)!;
    group.proposals.push({
      id: p.id,
      title: p.title,
      proposerName: p.proposerName,
      aiCidaTotal: p.aiCidaTotal,
      aiCidaAverageSkor: p.aiCidaAverageSkor,
      status: p.status,
      regionalFinalistRank: p.regionalFinalistRank,
      regionalFinalizedAt: p.regionalFinalizedAt,
    });
    group.totalProposals++;
    if (p.status === 'regional_finalist') group.finalistCount++;
  }

  // Determine if a group is "locked"
  // A group is locked if any proposal in it has regionalFinalizedAt set (meaning Kunci Grup was clicked)
  for (const [, group] of groupMap) {
    const isLocked = group.proposals.some(p => p.regionalFinalizedAt !== null);
    group.isLocked = isLocked;
  }

  // Check FGD sessions to see if there is a locked FGD session for each region
  const { fgdSessions } = await import('@/lib/db/schema');
  const lockedFgds = await db.select({
    id: fgdSessions.id,
    regionCenter: fgdSessions.regionCenter,
  }).from(fgdSessions).where(
    and(
      eq(fgdSessions.competitionId, competitionId),
      eq(fgdSessions.scope, 'regional'),
      eq(fgdSessions.status, 'locked')
    )
  );

  for (const fgd of lockedFgds) {
    // fgd.regionCenter can be 'Kantor Pusat' or '1', '2', etc. (for kanwil)
    let groupKey = fgd.regionCenter === 'Kantor Pusat' ? '__PUSAT__' : fgd.regionCenter;
    if (groupKey && groupMap.has(groupKey)) {
      const group = groupMap.get(groupKey)!;
      group.hasLockedFgd = true;
      group.lockedFgdSessionId = fgd.id;
    }
  }

  // Sort by category (PUSAT first) then region name
  return Array.from(groupMap.values()).sort((a, b) => {
    if (a.category === 'PUSAT') return -1;
    if (b.category === 'PUSAT') return 1;
    return a.region.localeCompare(b.region);
  });
}

/**
 * Set multiple proposals as regional finalists in a group.
 * Max 10 per group (unless group has fewer candidates).
 */
export async function setRegionalFinalistsAction(
  competitionId: number,
  regionKey: string, // 'PUSAT' or regionCenter string
  finalistIds: number[]
) {
  const session = await requireRole(['coordinator', 'curator']);
  const dbRegion = regionKey.replace(/^Kanwil /, '');

  if (!session.roles.includes('coordinator')) {
    // Kurator yang ter-assign di grup regional ini otomatis berwenang (auto-derive dari curatorAssignments)
    const isKanpusCheck = regionKey === 'PUSAT';
    const [ownerAssignment] = await db
      .select({ curatorId: curatorAssignments.curatorId })
      .from(curatorAssignments)
      .innerJoin(proposals, eq(proposals.id, curatorAssignments.proposalId))
      .where(
        and(
          eq(proposals.competitionId, competitionId),
          isKanpusCheck
            ? eq(proposals.category, 'PUSAT')
            : and(eq(proposals.category, 'WILAYAH'), eq(proposals.regionCenter, dbRegion))
        )
      )
      .limit(1);
    if (!ownerAssignment || ownerAssignment.curatorId !== session.userId) {
      return { error: 'Akses Ditolak: Hanya kurator yang bertanggung jawab atas grup regional ini yang berwenang.' };
    }
  }

  if (finalistIds.length > 10) {
    return { error: 'Maksimal 10 finalis per grup.' };
  }

  // Get all proposals in this group
  const isKanpus = regionKey === 'PUSAT';
  const groupProposals = await db
    .select({ id: proposals.id, status: proposals.status })
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, competitionId),
        isKanpus
          ? eq(proposals.category, 'PUSAT')
          : and(eq(proposals.category, 'WILAYAH'), eq(proposals.regionCenter, dbRegion)),
        inArray(proposals.status, ['curation_passed', 'regional_finalist'])
      )
    );

  const allIds = groupProposals.map(p => p.id);
  const nonFinalistIds = allIds.filter(id => !finalistIds.includes(id));

  // Update finalists
  if (finalistIds.length > 0) {
    for (let i = 0; i < finalistIds.length; i++) {
      await db.update(proposals).set({
        status: 'regional_finalist',
        regionalFinalistRank: i + 1,
        regionalFinalizedBy: session.userId,
        regionalFinalizedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(proposals.id, finalistIds[i]));
    }
  }

  // Reset previously-set finalists that are no longer selected
  const currentFinalists = groupProposals.filter(p => p.status === 'regional_finalist').map(p => p.id);
  const removedFinalists = currentFinalists.filter(id => !finalistIds.includes(id));
  if (removedFinalists.length > 0) {
    await db.update(proposals).set({
      status: 'curation_passed',
      regionalFinalistRank: null,
      regionalFinalizedAt: null,
      regionalFinalizedBy: null,
      updatedAt: new Date(),
    }).where(inArray(proposals.id, removedFinalists));
  }

  await createAuditLog({
    action: 'set_regional_finalists',
    entity: 'proposal',
    entityId: regionKey,
    after: { finalistIds, competitionId },
  });

  revalidatePath('/coordinator/regional-final');
  return { success: true };
}

/**
 * Lock a regional group — finalists stay, non-finalists become takeout.
 * After lock, cannot be reopened except via reopenRegionalGroup.
 */
export async function lockRegionalGroupAction(
  competitionId: number,
  regionKey: string
) {
  const session = await requireRole(['coordinator', 'curator']);
  const dbRegion = regionKey.replace(/^Kanwil /, '');

  if (!session.roles.includes('coordinator')) {
    // Auto-derive: kurator yang ter-assign di grup regional ini otomatis berwenang
    const isKanpusCheck = regionKey === 'PUSAT';
    const [ownerAssignment] = await db
      .select({ curatorId: curatorAssignments.curatorId })
      .from(curatorAssignments)
      .innerJoin(proposals, eq(proposals.id, curatorAssignments.proposalId))
      .where(
        and(
          eq(proposals.competitionId, competitionId),
          isKanpusCheck
            ? eq(proposals.category, 'PUSAT')
            : and(eq(proposals.category, 'WILAYAH'), eq(proposals.regionCenter, dbRegion))
        )
      )
      .limit(1);
    if (!ownerAssignment || ownerAssignment.curatorId !== session.userId) {
      return { error: 'Akses Ditolak: Hanya kurator yang bertanggung jawab atas grup regional ini yang berwenang untuk mengunci grup.' };
    }
  }

  const isKanpus = regionKey === 'PUSAT';

  // Get all proposals in group
  const groupProposals = await db
    .select({ id: proposals.id, status: proposals.status })
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, competitionId),
        isKanpus
          ? eq(proposals.category, 'PUSAT')
          : and(eq(proposals.category, 'WILAYAH'), eq(proposals.regionCenter, dbRegion)),
        inArray(proposals.status, ['curation_passed', 'regional_finalist'])
      )
    );

  const finalistIds = groupProposals.filter(p => p.status === 'regional_finalist').map(p => p.id);
  const nonFinalistIds = groupProposals.filter(p => p.status !== 'regional_finalist').map(p => p.id);

  if (finalistIds.length === 0) {
    return { error: 'Pilih minimal 1 finalis sebelum mengunci grup.' };
  }

  // Takeout non-finalists
  if (nonFinalistIds.length > 0) {
    await db.update(proposals).set({
      status: 'takeout',
      takeoutReason: 'not_selected_regional_final',
      updatedAt: new Date(),
    }).where(inArray(proposals.id, nonFinalistIds));
  }

  await createAuditLog({
    action: 'lock_regional_group',
    entity: 'competition',
    entityId: competitionId,
    after: { regionKey, finalistCount: finalistIds.length, takeoutCount: nonFinalistIds.length },
  });

  revalidatePath('/coordinator/regional-final');
  return { success: true, finalistCount: finalistIds.length, takeoutCount: nonFinalistIds.length };
}

/**
 * Reopen a locked group (undo lock).
 */
export async function reopenRegionalGroupAction(
  competitionId: number,
  regionKey: string
) {
  const session = await requireRole(['coordinator', 'curator']);
  const dbRegion = regionKey.replace(/^Kanwil /, '');

  if (!session.roles.includes('coordinator')) {
    // Auto-derive: kurator yang ter-assign di grup regional ini otomatis berwenang
    const isKanpusCheck = regionKey === 'PUSAT';
    const [ownerAssignment] = await db
      .select({ curatorId: curatorAssignments.curatorId })
      .from(curatorAssignments)
      .innerJoin(proposals, eq(proposals.id, curatorAssignments.proposalId))
      .where(
        and(
          eq(proposals.competitionId, competitionId),
          isKanpusCheck
            ? eq(proposals.category, 'PUSAT')
            : and(eq(proposals.category, 'WILAYAH'), eq(proposals.regionCenter, dbRegion))
        )
      )
      .limit(1);
    if (!ownerAssignment || ownerAssignment.curatorId !== session.userId) {
      return { error: 'Akses Ditolak: Hanya kurator yang bertanggung jawab atas grup regional ini yang berwenang untuk membuka grup kembali.' };
    }
  }

  const isKanpus = regionKey === 'PUSAT';

  // Restore takeout proposals back to curation_passed
  await db.update(proposals).set({
    status: 'curation_passed',
    takeoutReason: null,
    updatedAt: new Date(),
  }).where(
    and(
      eq(proposals.competitionId, competitionId),
      isKanpus
        ? eq(proposals.category, 'PUSAT')
        : and(eq(proposals.category, 'WILAYAH'), eq(proposals.regionCenter, dbRegion)),
      eq(proposals.takeoutReason, 'not_selected_regional_final')
    )
  );

  // Clear lock markers (regionalFinalizedAt) so the group becomes unlocked, but KEEP the regional_finalist status (so checkboxes remain checked)
  await db.update(proposals).set({
    regionalFinalizedAt: null,
    regionalFinalizedBy: null,
    updatedAt: new Date(),
  }).where(
    and(
      eq(proposals.competitionId, competitionId),
      isKanpus
        ? eq(proposals.category, 'PUSAT')
        : and(eq(proposals.category, 'WILAYAH'), eq(proposals.regionCenter, dbRegion)),
      eq(proposals.status, 'regional_finalist')
    )
  );

  await createAuditLog({
    action: 'reopen_regional_group',
    entity: 'competition',
    entityId: competitionId,
    after: { regionKey },
  });

  revalidatePath('/coordinator/regional-final');
  return { success: true };
}
