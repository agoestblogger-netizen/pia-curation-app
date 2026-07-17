'use server';

import { db } from '@/lib/db';
import {
  grandFinalSelections,
  proposals,
  competitions,
} from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and, count, inArray, notInArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';

const MAX_GRAND_FINAL = 10;

type GrandFinalActionState = {
  success?: boolean;
  error?: string;
  currentCount?: number;
};

export async function selectGrandFinalAction(
  competitionId: number,
  proposalId: number
): Promise<GrandFinalActionState> {
  const session = await requireRole(['coordinator', 'promoter'] as unknown as 'coordinator');

  // Check max 10 limit (server-side)
  const [countResult] = await db
    .select({ count: count() })
    .from(grandFinalSelections)
    .where(eq(grandFinalSelections.competitionId, competitionId));

  const currentCount = countResult?.count ?? 0;

  // Check if already selected
  const [existing] = await db
    .select()
    .from(grandFinalSelections)
    .where(
      and(
        eq(grandFinalSelections.competitionId, competitionId),
        eq(grandFinalSelections.proposalId, proposalId)
      )
    )
    .limit(1);

  if (existing) return { success: true, currentCount }; // Already selected, idempotent

  if (currentCount >= MAX_GRAND_FINAL) {
    return {
      error: `Grand Final sudah mencapai maksimum ${MAX_GRAND_FINAL} proposal`,
      currentCount,
    };
  }

  // Verify proposal is nominated
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.id, proposalId),
        eq(proposals.status, 'promotor_nominated')
      )
    )
    .limit(1);

  if (!proposal) return { error: 'Proposal tidak ditemukan atau belum dinominasikan' };

  await db.insert(grandFinalSelections).values({
    competitionId,
    proposalId,
    selectedBy: session.userId,
  });

  revalidatePath('/coordinator/grand-final');
  return { success: true, currentCount: currentCount + 1 };
}

export async function deselectGrandFinalAction(
  competitionId: number,
  proposalId: number
): Promise<GrandFinalActionState> {
  await requireRole(['coordinator', 'promoter'] as unknown as 'coordinator');

  await db
    .delete(grandFinalSelections)
    .where(
      and(
        eq(grandFinalSelections.competitionId, competitionId),
        eq(grandFinalSelections.proposalId, proposalId)
      )
    );

  revalidatePath('/coordinator/grand-final');
  return { success: true };
}

/**
 * Lock grand final selection.
 * - Selected proposals → grand_final status
 * - Nominated proposals not selected → takeout (not_selected_in_final_filter)
 * Idempotent.
 */
export async function lockGrandFinalAction(
  competitionId: number
): Promise<GrandFinalActionState> {
  const session = await requireRole('coordinator');

  // Get selected proposal IDs
  const selectedRows = await db
    .select({ proposalId: grandFinalSelections.proposalId })
    .from(grandFinalSelections)
    .where(eq(grandFinalSelections.competitionId, competitionId));

  const selectedIds = selectedRows.map((r) => r.proposalId);

  // Server-side validation: max 10
  if (selectedIds.length > MAX_GRAND_FINAL) {
    return { error: `Grand Final tidak boleh lebih dari ${MAX_GRAND_FINAL} proposal` };
  }

  // Mark selected → grand_final
  if (selectedIds.length > 0) {
    await db
      .update(proposals)
      .set({ status: 'grand_final', updatedAt: new Date() })
      .where(inArray(proposals.id, selectedIds));
  }

  // Get all nominated proposals
  const nominatedRows = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, competitionId),
        eq(proposals.status, 'promotor_nominated')
      )
    );

  const nominatedIds = nominatedRows.map((r) => r.id);
  const takeoutIds = nominatedIds.filter((id) => !selectedIds.includes(id));

  // Mark non-selected nominated → takeout
  if (takeoutIds.length > 0) {
    await db
      .update(proposals)
      .set({
        status: 'takeout',
        takeoutReason: 'not_selected_in_final_filter',
        updatedAt: new Date(),
      })
      .where(inArray(proposals.id, takeoutIds));
  }

  // Lock grand final selections
  await db
    .update(grandFinalSelections)
    .set({ lockedAt: new Date(), lockedBy: session.userId })
    .where(eq(grandFinalSelections.competitionId, competitionId));

  // Advance competition phase
  await db
    .update(competitions)
    .set({ phase: 'sponsor_scoring', updatedAt: new Date() })
    .where(eq(competitions.id, competitionId));

  await audit.lockNomination(competitionId);
  revalidatePath('/coordinator/grand-final');

  return { success: true, currentCount: selectedIds.length };
}

export async function getGrandFinalSelections(competitionId: number) {
  return db
    .select({ proposalId: grandFinalSelections.proposalId })
    .from(grandFinalSelections)
    .where(eq(grandFinalSelections.competitionId, competitionId));
}

export async function getNominatedProposals(competitionId: number) {
  return db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, competitionId),
        eq(proposals.status, 'promotor_nominated')
      )
    );
}
