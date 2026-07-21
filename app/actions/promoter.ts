'use server';

import { db } from '@/lib/db';
import {
  promoterSelections,
  proposals,
  competitions,
  promoterAssignments,
} from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and, notInArray, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { maskProposalIdentity } from '@/lib/utils/blindReview';

type PromoterActionState = {
  success?: boolean;
  error?: string;
};

export async function selectProposalAction(
  competitionId: number,
  proposalId: number
): Promise<PromoterActionState> {
  const session = await requireRole('promoter');

  // Verify proposal is in promotor_selection status
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.id, proposalId),
        eq(proposals.competitionId, competitionId),
        eq(proposals.status, 'promotor_selection')
      )
    )
    .limit(1);

  if (!proposal) return { error: 'Proposal tidak ditemukan atau tidak dalam status layak' };

  // Prevent duplicate selection
  await db
    .insert(promoterSelections)
    .values({
      competitionId,
      promoterId: session.userId,
      proposalId,
    })
    .onConflictDoNothing();

  await audit.promoterSelect(proposalId);
  revalidatePath('/promoter');

  return { success: true };
}

export async function deselectProposalAction(
  competitionId: number,
  proposalId: number
): Promise<PromoterActionState> {
  const session = await requireRole('promoter');

  await db
    .delete(promoterSelections)
    .where(
      and(
        eq(promoterSelections.competitionId, competitionId),
        eq(promoterSelections.promoterId, session.userId),
        eq(promoterSelections.proposalId, proposalId)
      )
    );

  revalidatePath('/promoter');
  return { success: true };
}

/**
 * Close promoter selection phase.
 * - Proposals with >= 1 selection → promotor_nominated
 * - Proposals without any selection → takeout (no_promotor_selection)
 * Idempotent: safe to run multiple times.
 */
export async function closePromoterSelectionAction(
  competitionId: number,
  overrideReason?: string
): Promise<PromoterActionState> {
  await requireRole('coordinator');

  // Get all promotor_selection proposals
  const passedProposals = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, competitionId),
        eq(proposals.status, 'promotor_selection')
      )
    );

  if (passedProposals.length === 0) return { error: 'Tidak ada proposal yang lolos kurasi' };

  const passedIds = passedProposals.map((p) => p.id);

  // Get all proposals that have at least one selection
  const selectedIds = (
    await db
      .selectDistinct({ proposalId: promoterSelections.proposalId })
      .from(promoterSelections)
      .where(
        and(
          eq(promoterSelections.competitionId, competitionId),
          inArray(promoterSelections.proposalId, passedIds)
        )
      )
  ).map((s) => s.proposalId);

  // Proposals NOT selected by anyone → takeout
  const takeoutIds = passedIds.filter((id) => !selectedIds.includes(id));

  if (takeoutIds.length > 0) {
    await db
      .update(proposals)
      .set({
        status: 'takeout',
        takeoutReason: 'no_promotor_selection',
        updatedAt: new Date(),
      })
      .where(inArray(proposals.id, takeoutIds));
  }

  // Proposals selected by at least one → promotor_nominated
  if (selectedIds.length > 0) {
    await db
      .update(proposals)
      .set({ status: 'promotor_nominated', updatedAt: new Date() })
      .where(inArray(proposals.id, selectedIds));
  }

  // Advance competition phase
  await db
    .update(competitions)
    .set({ phase: 'nomination_filter', updatedAt: new Date() })
    .where(eq(competitions.id, competitionId));

  await audit.closePhase(competitionId, 'nomination_filter', overrideReason);
  revalidatePath('/overview');

  return { success: true };
}

export async function getPromoterSelections(competitionId: number, promoterId: number) {
  return db
    .select({ proposalId: promoterSelections.proposalId })
    .from(promoterSelections)
    .where(
      and(
        eq(promoterSelections.competitionId, competitionId),
        eq(promoterSelections.promoterId, promoterId)
      )
    );
}

export async function getPassedProposals(competitionId: number, promoterId: number) {
  const [comp] = await db
    .select({ promotorAccessMode: competitions.promotorAccessMode })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  let proposalsData: any[] = [];

  if (comp?.promotorAccessMode === 'assigned') {
    const assignedIds = await db
      .select({ proposalId: promoterAssignments.proposalId })
      .from(promoterAssignments)
      .where(
        and(
          eq(promoterAssignments.competitionId, competitionId),
          eq(promoterAssignments.promoterId, promoterId)
        )
      );

    const ids = assignedIds.map((a) => a.proposalId);
    if (ids.length > 0) {
      proposalsData = await db
        .select()
        .from(proposals)
        .where(
          and(
            eq(proposals.competitionId, competitionId),
            eq(proposals.status, 'promotor_selection'),
            inArray(proposals.id, ids)
          )
        );
    }
  } else {
    // default open
    proposalsData = await db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.competitionId, competitionId),
          eq(proposals.status, 'promotor_selection')
        )
      );
  }

  // Mask identity for promoters
  return proposalsData.map(p => maskProposalIdentity(p));
}
