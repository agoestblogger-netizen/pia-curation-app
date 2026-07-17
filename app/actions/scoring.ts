'use server';

import { db } from '@/lib/db';
import {
  scoringCriteria,
  sponsorScores,
  scoringSnapshots,
  proposals,
  users,
  competitions,
} from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and, count, avg, sum } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';

const criterionSchema = z.object({
  competitionId: z.coerce.number(),
  name: z.string().min(1),
  description: z.string().optional(),
  maxScore: z.coerce.number().min(1).max(1000),
  weight: z.coerce.number().min(0.01).max(10),
  orderIndex: z.coerce.number().default(0),
});

type ScoringActionState = {
  success?: boolean;
  error?: string;
};

export async function createCriterionAction(
  _prev: ScoringActionState,
  formData: FormData
): Promise<ScoringActionState> {
  const session = await requireRole('coordinator');

  const parsed = criterionSchema.safeParse({
    competitionId: formData.get('competitionId'),
    name: formData.get('name'),
    description: formData.get('description'),
    maxScore: formData.get('maxScore'),
    weight: formData.get('weight'),
    orderIndex: formData.get('orderIndex'),
  });

  if (!parsed.success) return { error: (parsed.error as any).errors[0]?.message };

  await db.insert(scoringCriteria).values({
    ...parsed.data,
    createdBy: session.userId,
  });

  revalidatePath('/overview');
  return { success: true };
}

export async function saveSponsorScoreAction(
  competitionId: number,
  proposalId: number,
  scores: Record<number, number>, // criterionId → score
  isDraft: boolean
): Promise<ScoringActionState> {
  const session = await requireRole('sponsor');

  // Verify proposal is in grand_final status
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.id, proposalId),
        eq(proposals.status, 'grand_final')
      )
    )
    .limit(1);

  if (!proposal) return { error: 'Proposal tidak ditemukan atau bukan Grand Final' };

  // Check if sponsor has already locked this proposal's scores
  const existingLocked = await db
    .select()
    .from(sponsorScores)
    .where(
      and(
        eq(sponsorScores.sponsorId, session.userId),
        eq(sponsorScores.proposalId, proposalId),
        eq(sponsorScores.isDraft, false)
      )
    )
    .limit(1);

  if (existingLocked.length > 0 && !isDraft) {
    return { error: 'Nilai sudah dikunci, tidak dapat diubah' };
  }

  // Get criteria
  const criteria = await db
    .select()
    .from(scoringCriteria)
    .where(
      and(
        eq(scoringCriteria.competitionId, competitionId),
        eq(scoringCriteria.isActive, true)
      )
    );

  // Validate scores
  for (const criterion of criteria) {
    const score = scores[criterion.id];
    if (score !== undefined && (score < 0 || score > criterion.maxScore)) {
      return { error: `Nilai untuk ${criterion.name} harus antara 0 dan ${criterion.maxScore}` };
    }
  }

  // Upsert scores
  for (const criterion of criteria) {
    const score = scores[criterion.id];
    if (score === undefined) continue;

    await db
      .insert(sponsorScores)
      .values({
        competitionId,
        proposalId,
        sponsorId: session.userId,
        criterionId: criterion.id,
        score,
        isDraft,
        lockedAt: isDraft ? null : new Date(),
      })
      .onConflictDoUpdate({
        target: [sponsorScores.sponsorId, sponsorScores.proposalId, sponsorScores.criterionId],
        set: {
          score,
          isDraft,
          lockedAt: isDraft ? null : new Date(),
          submittedAt: new Date(),
        },
      });
  }

  revalidatePath('/sponsor');
  return { success: true };
}

interface ProposalRanking {
  proposalId: number;
  title: string;
  totalScore: number;
  avgScore: number;
  raterCount: number;
  rank: number;
}

/**
 * Calculate ranking from locked sponsor scores.
 */
export async function calculateRanking(competitionId: number): Promise<ProposalRanking[]> {
  const grandFinalProposals = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, competitionId),
        eq(proposals.status, 'grand_final')
      )
    );

  const criteria = await db
    .select()
    .from(scoringCriteria)
    .where(eq(scoringCriteria.competitionId, competitionId));

  const rankings: ProposalRanking[] = [];

  for (const proposal of grandFinalProposals) {
    // Get non-draft scores for this proposal
    const scores = await db
      .select()
      .from(sponsorScores)
      .where(
        and(
          eq(sponsorScores.proposalId, proposal.id),
          eq(sponsorScores.isDraft, false)
        )
      );

    if (scores.length === 0) {
      rankings.push({
        proposalId: proposal.id,
        title: proposal.title,
        totalScore: 0,
        avgScore: 0,
        raterCount: 0,
        rank: 0,
      });
      continue;
    }

    // Group by sponsor, calculate weighted total per sponsor
    const sponsorTotals = new Map<number, number>();
    for (const score of scores) {
      const criterion = criteria.find((c) => c.id === score.criterionId);
      const weighted = criterion ? score.score * criterion.weight : score.score;
      sponsorTotals.set(score.sponsorId, (sponsorTotals.get(score.sponsorId) ?? 0) + weighted);
    }

    const totals = Array.from(sponsorTotals.values());
    const avgScore = totals.reduce((a, b) => a + b, 0) / totals.length;

    rankings.push({
      proposalId: proposal.id,
      title: proposal.title,
      totalScore: totals.reduce((a, b) => a + b, 0),
      avgScore: Math.round(avgScore * 100) / 100,
      raterCount: totals.length,
      rank: 0,
    });
  }

  // Sort by avgScore descending, assign ranks
  rankings.sort((a, b) => b.avgScore - a.avgScore);
  rankings.forEach((r, i) => { r.rank = i + 1; });

  return rankings;
}

/**
 * Lock scoring results and save snapshot.
 * Idempotent.
 */
export async function lockScoringResultsAction(
  competitionId: number
): Promise<ScoringActionState> {
  const session = await requireRole('coordinator');

  const rankings = await calculateRanking(competitionId);

  // Save snapshot
  await db.insert(scoringSnapshots).values({
    competitionId,
    lockedBy: session.userId,
    snapshotJson: rankings as unknown as Record<string, unknown>[],
  });

  // Update proposal statuses
  for (const r of rankings) {
    await db
      .update(proposals)
      .set({ status: 'ranked', updatedAt: new Date() })
      .where(eq(proposals.id, r.proposalId));
  }

  // Advance phase
  await db
    .update(competitions)
    .set({ phase: 'finalization', updatedAt: new Date() })
    .where(eq(competitions.id, competitionId));

  await audit.lockScoringResults(competitionId);
  revalidatePath('/overview');

  return { success: true };
}

export async function getCriteria(competitionId: number) {
  return db
    .select()
    .from(scoringCriteria)
    .where(eq(scoringCriteria.competitionId, competitionId))
    .orderBy(scoringCriteria.orderIndex);
}

export async function getSponsorScores(proposalId: number, sponsorId: number) {
  return db
    .select()
    .from(sponsorScores)
    .where(
      and(
        eq(sponsorScores.proposalId, proposalId),
        eq(sponsorScores.sponsorId, sponsorId)
      )
    );
}

export async function getGrandFinalProposals(competitionId: number) {
  return db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, competitionId),
        eq(proposals.status, 'grand_final')
      )
    );
}
