'use server';

import { db } from '@/lib/db';
import {
  finalResults,
  proposals,
  competitions,
  scoringSnapshots,
} from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';

const setResultSchema = z.object({
  proposalId: z.coerce.number(),
  competitionId: z.coerce.number(),
  resultStatus: z.enum(['winner', 'selected', 'reserve', 'not_selected']),
  rank: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type FinalizationActionState = {
  success?: boolean;
  error?: string;
};

export async function setFinalResultAction(
  _prev: FinalizationActionState,
  formData: FormData
): Promise<FinalizationActionState> {
  await requireRole('coordinator');

  const parsed = setResultSchema.safeParse({
    proposalId: formData.get('proposalId'),
    competitionId: formData.get('competitionId'),
    resultStatus: formData.get('resultStatus'),
    rank: formData.get('rank'),
    notes: formData.get('notes'),
  });

  if (!parsed.success) return { error: (parsed.error as any).errors[0]?.message };

  const { proposalId, competitionId, resultStatus, rank, notes } = parsed.data;

  // Verify competition is NOT locked
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (!competition) return { error: 'Kompetisi tidak ditemukan' };
  if (competition.phase === 'closed') return { error: 'Kompetisi sudah dikunci, tidak dapat diubah' };

  // Upsert final result
  await db
    .insert(finalResults)
    .values({
      competitionId,
      proposalId,
      rank: rank ?? null,
      resultStatus,
      notes: notes ?? null,
    })
    .onConflictDoUpdate({
      target: [finalResults.proposalId],
      set: {
        resultStatus,
        rank: rank ?? null,
        notes: notes ?? null,
        updatedAt: new Date(),
      },
    });

  // Update proposal status
  await db
    .update(proposals)
    .set({ status: resultStatus, updatedAt: new Date() })
    .where(eq(proposals.id, proposalId));

  revalidatePath('/coordinator/finalization');
  return { success: true };
}

/**
 * Final lock — closes the competition.
 * After this, results cannot be changed without a special reopen.
 * Idempotent.
 */
export async function finalLockAction(
  competitionId: number,
  confirmationCode: string
): Promise<FinalizationActionState> {
  const session = await requireRole('coordinator');

  // Simple confirmation code check
  if (confirmationCode !== 'KONFIRMASI_FINAL') {
    return { error: 'Kode konfirmasi salah. Ketik KONFIRMASI_FINAL untuk mengunci.' };
  }

  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (!competition) return { error: 'Kompetisi tidak ditemukan' };
  if (competition.phase === 'closed') return { success: true }; // Already locked, idempotent

  // Lock all final results
  await db
    .update(finalResults)
    .set({ lockedAt: new Date(), lockedBy: session.userId })
    .where(eq(finalResults.competitionId, competitionId));

  // Close competition
  await db
    .update(competitions)
    .set({
      phase: 'closed',
      phaseLockedAt: new Date(),
      phaseLockedBy: session.userId,
      updatedAt: new Date(),
    })
    .where(eq(competitions.id, competitionId));

  await audit.finalLock(competitionId);
  revalidatePath('/coordinator/finalization');

  return { success: true };
}

export async function getFinalResults(competitionId: number) {
  return db
    .select({
      id: finalResults.id,
      proposalId: finalResults.proposalId,
      rank: finalResults.rank,
      resultStatus: finalResults.resultStatus,
      notes: finalResults.notes,
      lockedAt: finalResults.lockedAt,
      proposalTitle: proposals.title,
      proposalCategory: proposals.category,
    })
    .from(finalResults)
    .leftJoin(proposals, eq(finalResults.proposalId, proposals.id))
    .where(eq(finalResults.competitionId, competitionId))
    .orderBy(finalResults.rank);
}

export async function getRankedProposals(competitionId: number) {
  return db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, competitionId),
        eq(proposals.status, 'ranked')
      )
    );
}

export async function getLatestScoringSnapshot(competitionId: number) {
  const [snapshot] = await db
    .select()
    .from(scoringSnapshots)
    .where(eq(scoringSnapshots.competitionId, competitionId))
    .orderBy(desc(scoringSnapshots.lockedAt))
    .limit(1);
  return snapshot ?? null;
}
