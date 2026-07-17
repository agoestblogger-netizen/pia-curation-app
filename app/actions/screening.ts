'use server';

import { db } from '@/lib/db';
import {
  curatorAssignments,
  screeningResults,
  proposals,
  competitions,
  promoterSelections,
  auditLogs,
} from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit, createAuditLog } from '@/lib/audit';

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

export async function checkHardLock(proposalId: number, competitionId: number): Promise<{ locked: boolean; reason?: string }> {
  const [comp] = await db.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);
  if (!comp) return { locked: true, reason: 'Kompetisi tidak ditemukan' };

  const pastPhases = ['grand_final', 'scoring', 'final_result'];
  if (pastPhases.includes(comp.phase)) {
    return { locked: true, reason: 'Terkunci: Fase seleksi promotor telah ditutup.' };
  }

  const [selection] = await db
    .select()
    .from(promoterSelections)
    .where(eq(promoterSelections.proposalId, proposalId))
    .limit(1);

  if (selection) {
    return { locked: true, reason: 'Terkunci: Proposal telah dipilih oleh Promotor.' };
  }

  return { locked: false };
}

export async function editScreeningAction(
  _prev: ScreeningActionState,
  formData: FormData
): Promise<ScreeningActionState> {
  const session = await requireRole('curator');

  const parsed = screeningSchema.safeParse({
    assignmentId: formData.get('assignmentId'),
    verdict: formData.get('verdict'),
    notes: formData.get('notes'),
  });

  if (!parsed.success) return { error: 'Input tidak valid' };
  const { assignmentId, verdict, notes } = parsed.data;

  const [assignment] = await db
    .select({
      id: curatorAssignments.id,
      curatorId: curatorAssignments.curatorId,
      status: curatorAssignments.status,
      proposalId: proposals.id,
      competitionId: proposals.competitionId,
    })
    .from(curatorAssignments)
    .innerJoin(proposals, eq(curatorAssignments.proposalId, proposals.id))
    .where(eq(curatorAssignments.id, assignmentId))
    .limit(1);

  if (!assignment || assignment.curatorId !== session.userId) {
    return { error: 'Assignment tidak ditemukan atau bukan milik Anda' };
  }

  if (assignment.status !== 'completed') {
    return { error: 'Proposal belum discreening, gunakan submit biasa.' };
  }

  const hardLock = await checkHardLock(assignment.proposalId, assignment.competitionId);
  if (hardLock.locked) {
    return { error: hardLock.reason };
  }

  const [oldResult] = await db
    .select()
    .from(screeningResults)
    .where(eq(screeningResults.assignmentId, assignmentId))
    .limit(1);

  if (!oldResult) return { error: 'Hasil screening sebelumnya tidak ditemukan' };

  await db.transaction(async (tx) => {
    await tx
      .update(screeningResults)
      .set({ verdict, notes })
      .where(eq(screeningResults.id, oldResult.id));

    // Audit Log is done after transaction to use helper
  });

  await createAuditLog({
    action: 'screening_edited',
    entity: 'proposal',
    entityId: assignment.proposalId,
    after: { oldVerdict: oldResult.verdict, newVerdict: verdict, notes },
  });

  revalidatePath('/curator');
  return { success: true };
}

export async function resetScreeningAction(assignmentId: number): Promise<ScreeningActionState> {
  const session = await requireRole('curator');

  const [assignment] = await db
    .select({
      id: curatorAssignments.id,
      curatorId: curatorAssignments.curatorId,
      status: curatorAssignments.status,
      proposalId: proposals.id,
      competitionId: proposals.competitionId,
    })
    .from(curatorAssignments)
    .innerJoin(proposals, eq(curatorAssignments.proposalId, proposals.id))
    .where(eq(curatorAssignments.id, assignmentId))
    .limit(1);

  if (!assignment || assignment.curatorId !== session.userId) {
    return { error: 'Assignment tidak ditemukan atau bukan milik Anda' };
  }

  const hardLock = await checkHardLock(assignment.proposalId, assignment.competitionId);
  if (hardLock.locked) {
    return { error: hardLock.reason };
  }

  await db.transaction(async (tx) => {
    await tx.delete(screeningResults).where(eq(screeningResults.assignmentId, assignmentId));

    await tx
      .update(curatorAssignments)
      .set({ status: 'in_review', completedAt: null })
      .where(eq(curatorAssignments.id, assignmentId));

    await tx
      .update(proposals)
      .set({ status: 'under_curation', updatedAt: new Date() })
      .where(eq(proposals.id, assignment.proposalId));

    // Audit Log is done after transaction to use helper
  });

  await createAuditLog({
    action: 'screening_reset',
    entity: 'proposal',
    entityId: assignment.proposalId,
    after: { assignmentId },
  });

  revalidatePath('/curator');
  return { success: true };
}
