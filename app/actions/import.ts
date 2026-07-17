'use server';

import { db } from '@/lib/db';
import { proposals, competitions } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/lib/audit';

type SyncState = {
  success?: boolean;
  error?: string;
  stats?: {
    newCount: number;
    updatedCount: number;
    needsReviewCount: number;
  };
};

/**
 * Trigger CIDA data sync from server action.
 * Calls the import script logic inline (without spawning a process).
 * Returns summary stats.
 */
export async function triggerSyncAction(): Promise<SyncState> {
  await requireRole('coordinator');

  // In production, the actual import-cida.ts script should be run via CLI.
  // This action is a lightweight wrapper that returns a message.
  // For full sync, use: npm run db:import
  return {
    error: 'Sync via UI belum diimplementasikan. Gunakan CLI: npm run db:import di server.'
  };
}

/**
 * Clear the needsReview flag for a proposal.
 * Coordinator or related curator can call this after reviewing.
 */
type ClearReviewState = {
  success?: boolean;
  error?: string;
};

export async function clearNeedsReviewAction(proposalId: number): Promise<ClearReviewState> {
  const session = await requireRole('coordinator');

  const [proposal] = await db.select({ id: proposals.id, needsReview: proposals.needsReview, title: proposals.title })
    .from(proposals)
    .where(eq(proposals.id, proposalId))
    .limit(1);

  if (!proposal) return { error: 'Proposal tidak ditemukan.' };

  await db.update(proposals).set({
    needsReview: false,
    updatedAt: new Date(),
  }).where(eq(proposals.id, proposalId));

  await createAuditLog({
    action: 'clear_needs_review',
    entity: 'proposal',
    entityId: proposalId,
    before: { needsReview: true },
    after: { needsReview: false },
    reason: `Ditandai sudah ditinjau oleh ${session.name}`,
  });

  revalidatePath('/coordinator');
  revalidatePath(`/coordinator/proposals/${proposalId}`);
  return { success: true };
}
