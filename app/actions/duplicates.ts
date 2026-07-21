'use server';

import { db } from '@/lib/db';
import { potentialDuplicates, proposals, users } from '@/lib/db/schema';
import { eq, desc, and, inArray, or, ne } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export async function markPotentialDuplicate(
  proposalAId: number,
  proposalBId: number,
  aiSimilarityLevel: string,
  note?: string
) {
  const session = await getSession();
  if (!session || (!session.roles.includes('curator') && !session.roles.includes('coordinator'))) {
    return { error: 'Unauthorized. Only curators or coordinators can mark duplicates.' };
  }

  // Ensure consistent ordering to avoid duplicate pairs A-B and B-A
  const minId = Math.min(proposalAId, proposalBId);
  const maxId = Math.max(proposalAId, proposalBId);

  // Check if it already exists for this curator
  const existing = await db.select().from(potentialDuplicates).where(
    and(
      eq(potentialDuplicates.proposalAId, minId),
      eq(potentialDuplicates.proposalBId, maxId),
      eq(potentialDuplicates.markedBy, session.userId)
    )
  ).limit(1);

  if (existing.length > 0) {
    return { error: 'Pasangan ini sudah Anda tandai.' };
  }

  await db.insert(potentialDuplicates).values({
    proposalAId: minId,
    proposalBId: maxId,
    markedBy: session.userId,
    aiSimilarityLevel,
    note,
    status: 'pending',
  });

  return { success: true };
}

export async function getCuratorPotentialDuplicates() {
  const session = await getSession();
  if (!session || !session.roles.includes('curator')) {
    return [];
  }

  const duplicates = await db.select().from(potentialDuplicates)
    .where(
      and(
        eq(potentialDuplicates.markedBy, session.userId),
        ne(potentialDuplicates.status, 'rejected')
      )
    )
    .orderBy(desc(potentialDuplicates.markedAt));

  const proposalIds = Array.from(new Set(duplicates.flatMap(d => [d.proposalAId, d.proposalBId])));
  
  const relevantProposals = proposalIds.length > 0 
    ? await db.select({ id: proposals.id, title: proposals.title }).from(proposals).where(inArray(proposals.id, proposalIds))
    : [];

  const titleMap = new Map(relevantProposals.map(p => [p.id, p.title]));

  return duplicates.map(d => ({
    id: d.id,
    proposalAId: d.proposalAId,
    proposalATitle: titleMap.get(d.proposalAId) || `Proposal #${d.proposalAId}`,
    proposalBId: d.proposalBId,
    proposalBTitle: titleMap.get(d.proposalBId) || `Proposal #${d.proposalBId}`,
    aiSimilarityLevel: d.aiSimilarityLevel,
    status: d.status,
    note: d.note,
    markedAt: d.markedAt,
  }));
}

export async function getCoordinatorPotentialDuplicates() {
  const session = await getSession();
  if (!session || (!session.roles.includes('coordinator') && !session.roles.includes('admin'))) {
    return [];
  }

  const duplicates = await db.select().from(potentialDuplicates)
    .where(ne(potentialDuplicates.status, 'rejected'))
    .orderBy(desc(potentialDuplicates.markedAt));

  const proposalIds = Array.from(new Set(duplicates.flatMap(d => [d.proposalAId, d.proposalBId])));
  const userIds = Array.from(new Set(duplicates.map(d => d.markedBy)));

  const relevantProposals = proposalIds.length > 0 
    ? await db.select({ id: proposals.id, title: proposals.title }).from(proposals).where(inArray(proposals.id, proposalIds))
    : [];

  const titleMap = new Map(relevantProposals.map(p => [p.id, p.title]));

  const allUsers = userIds.length > 0
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds))
    : [];
  const userMap = new Map(allUsers.map(u => [u.id, u.name]));

  return duplicates.map(d => ({
    id: d.id,
    proposalAId: d.proposalAId,
    proposalATitle: titleMap.get(d.proposalAId) || `Proposal #${d.proposalAId}`,
    proposalBId: d.proposalBId,
    proposalBTitle: titleMap.get(d.proposalBId) || `Proposal #${d.proposalBId}`,
    markedByName: userMap.get(d.markedBy) || 'Unknown',
    aiSimilarityLevel: d.aiSimilarityLevel,
    status: d.status,
    note: d.note,
    markedAt: d.markedAt,
  }));
}

export async function updateDuplicateStatus(id: number, status: 'pending' | 'confirmed' | 'rejected') {
  const session = await getSession();
  if (!session || (!session.roles.includes('coordinator') && !session.roles.includes('admin'))) {
    return { error: 'Unauthorized' };
  }

  await db.update(potentialDuplicates)
    .set({ status })
    .where(eq(potentialDuplicates.id, id));

  return { success: true };
}

export async function getActiveDuplicateWarningsForProposals(proposalIds: number[]) {
  if (proposalIds.length === 0) return [];
  
  const warnings = await db.select().from(potentialDuplicates).where(
    and(
      or(
        inArray(potentialDuplicates.proposalAId, proposalIds),
        inArray(potentialDuplicates.proposalBId, proposalIds)
      ),
      ne(potentialDuplicates.status, 'rejected')
    )
  );

  return warnings;
}

export async function getProposalDuplicateWarnings(proposalId: number) {
  const warnings = await db.select().from(potentialDuplicates).where(
    and(
      or(
        eq(potentialDuplicates.proposalAId, proposalId),
        eq(potentialDuplicates.proposalBId, proposalId)
      ),
      ne(potentialDuplicates.status, 'rejected')
    )
  ).orderBy(desc(potentialDuplicates.markedAt));

  if (warnings.length === 0) return [];

  const otherProposalIds = Array.from(new Set(warnings.map(w => w.proposalAId === proposalId ? w.proposalBId : w.proposalAId)));
  const userIds = Array.from(new Set(warnings.map(w => w.markedBy)));

  const relevantProposals = await db.select({ id: proposals.id, title: proposals.title, nomorUrut: proposals.nomorUrut }).from(proposals).where(inArray(proposals.id, otherProposalIds));
  const titleMap = new Map(relevantProposals.map(p => [p.id, { title: p.title, nomor: p.nomorUrut }]));

  const allUsers = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds));
  const userMap = new Map(allUsers.map(u => [u.id, u.name]));

  return warnings.map(w => {
    const isA = w.proposalAId === proposalId;
    const otherId = isA ? w.proposalBId : w.proposalAId;
    const otherInfo = titleMap.get(otherId);

    return {
      id: w.id,
      otherProposalId: otherId,
      otherProposalTitle: otherInfo?.title || `Proposal #${otherId}`,
      otherProposalNomor: otherInfo?.nomor || 0,
      markedByName: userMap.get(w.markedBy) || 'Unknown',
      markedAt: w.markedAt,
      aiSimilarityLevel: w.aiSimilarityLevel,
      status: w.status,
    };
  });
}
