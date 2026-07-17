'use server';

import { db } from '@/lib/db';
import {
  curatorAssignments,
  screeningResults,
  proposals,
} from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';

import { SCREENING_VERDICTS, screeningSchema } from '@/lib/constants/screening';

type ScreeningActionState = {
  success?: boolean;
  error?: string;
};

export async function startScreeningAction(assignmentId: number): Promise<ScreeningActionState> {
  const session = await requireRole('curator');

  // Verify this assignment belongs to this curator
  const [assignment] = await db
    .select()
    .from(curatorAssignments)
    .where(
      and(
        eq(curatorAssignments.id, assignmentId),
        eq(curatorAssignments.curatorId, session.userId)
      )
    )
    .limit(1);

  if (!assignment) return { error: 'Assignment tidak ditemukan atau bukan milik Anda' };
  

  if (assignment.status === 'completed') return { error: 'Screening sudah selesai' };

  await db
    .update(curatorAssignments)
    .set({ status: 'in_review', startedAt: new Date() })
    .where(eq(curatorAssignments.id, assignmentId));

  revalidatePath('/curator');
  return { success: true };
}

export async function submitScreeningAction(
  _prev: ScreeningActionState,
  formData: FormData
): Promise<ScreeningActionState> {
  const session = await requireRole('curator');

  const parsed = screeningSchema.safeParse({
    assignmentId: formData.get('assignmentId'),
    verdict: formData.get('verdict'),
    notes: formData.get('notes'),
    recommendation: formData.get('recommendation'),
  });

  if (!parsed.success) {
    return { error: (parsed.error as any).errors[0]?.message ?? 'Data tidak valid' };
  }

  const { assignmentId, verdict, notes, recommendation } = parsed.data;

  // Verify assignment belongs to this curator
  const [assignment] = await db
    .select()
    .from(curatorAssignments)
    .where(
      and(
        eq(curatorAssignments.id, assignmentId),
        eq(curatorAssignments.curatorId, session.userId)
      )
    )
    .limit(1);

  if (!assignment) return { error: 'Assignment tidak ditemukan atau bukan milik Anda' };
  

  if (assignment.status === 'completed') return { error: 'Screening sudah selesai' };

  // Insert or update screening result
  await db
    .insert(screeningResults)
    .values({
      assignmentId,
      proposalId: assignment.proposalId,
      curatorId: session.userId,
      verdict,
      notes: notes ?? null,
      recommendation: recommendation ?? null,
    })
    .onConflictDoUpdate({
      target: [screeningResults.assignmentId],
      set: { verdict, notes: notes ?? null, recommendation: recommendation ?? null, submittedAt: new Date() },
    });

  // Update assignment status
  await db
    .update(curatorAssignments)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(curatorAssignments.id, assignmentId));

  // Update proposal status
  const newStatus = verdict === 'lolos' ? 'curation_passed' : 'curation_rejected';
  await db
    .update(proposals)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(proposals.id, assignment.proposalId));

  await audit.screeningSubmit(assignmentId, verdict);
  revalidatePath('/curator');
  revalidatePath(`/curator/screening/${assignmentId}`);

  return { success: true };
}

export async function getCuratorAssignments(curatorId: number) {
  return db
    .select({
      id: curatorAssignments.id,
      proposalId: curatorAssignments.proposalId,
      category: curatorAssignments.category,
      status: curatorAssignments.status,
      assignedAt: curatorAssignments.assignedAt,
      startedAt: curatorAssignments.startedAt,
      completedAt: curatorAssignments.completedAt,
    })
    .from(curatorAssignments)
    .where(eq(curatorAssignments.curatorId, curatorId));
}

export async function getCuratorAssignmentDetail(assignmentId: number, curatorId: number) {
  const [assignment] = await db
    .select()
    .from(curatorAssignments)
    .where(
      and(
        eq(curatorAssignments.id, assignmentId),
        eq(curatorAssignments.curatorId, curatorId)
      )
    )
    .limit(1);

  return assignment ?? null;
}
