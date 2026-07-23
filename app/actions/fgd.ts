'use server';

import { db } from '@/lib/db';
import { 
  fgdSessions, fgdComments, fgdVotes, proposals, auditLogs
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/helpers';
import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/lib/audit';

/**
 * Buat sesi FGD baru (hanya koordinator)
 */
export async function createFgdSessionAction(data: {
  competitionId: number;
  name: string;
  scope: 'nasional' | 'regional';
  regionCenter: string | null;
  targetCandidates: number;
  viewMode: 'grouped' | 'mixed';
  filterStatuses: string[];
  fgdType?: 'curator' | 'promoter';
  ketuaName?: string;
  sekretarisName?: string;
}) {
  const session = await requireRole(['coordinator']);

  const [newSession] = await db.insert(fgdSessions).values({
    competitionId: data.competitionId,
    name: data.name,
    scope: data.scope,
    regionCenter: data.regionCenter,
    targetCandidates: data.targetCandidates,
    viewMode: data.viewMode,
    filterStatuses: data.filterStatuses,
    fgdType: data.fgdType || 'curator',
    ketuaName: data.ketuaName || null,
    sekretarisName: data.sekretarisName || null,
    status: 'active',
    createdBy: session.userId,
  }).returning();

  await createAuditLog({
    action: 'create_fgd_session',
    entity: 'fgd_session',
    entityId: newSession.id.toString(),
    after: data,
  });

  revalidatePath('/coordinator/fgd');
  return { success: true, sessionId: newSession.id };
}

/**
 * Hapus sesi FGD yang belum dikunci
 */
export async function deleteFgdSessionAction(sessionId: number) {
  const session = await requireRole(['coordinator']);

  const [fgd] = await db.select().from(fgdSessions).where(eq(fgdSessions.id, sessionId)).limit(1);
  if (!fgd) return { error: 'Sesi tidak ditemukan' };
  if (fgd.status === 'locked') return { error: 'Sesi sudah dikunci' };

  // Delete dependencies first
  await db.delete(fgdComments).where(eq(fgdComments.sessionId, sessionId));
  await db.delete(fgdVotes).where(eq(fgdVotes.sessionId, sessionId));
  await db.delete(fgdSessions).where(eq(fgdSessions.id, sessionId));

  await createAuditLog({
    action: 'delete_fgd_session',
    entity: 'fgd_session',
    entityId: sessionId.toString(),
  });

  revalidatePath('/coordinator/fgd');
  return { success: true };
}

/**
 * Tambah komentar / notes di proposal dalam ruang FGD
 */
export async function submitFgdCommentAction(sessionId: number, proposalId: number, content: string) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const [comment] = await db.insert(fgdComments).values({
    sessionId,
    proposalId,
    curatorId: session.userId,
    content,
  }).returning();

  revalidatePath(`/fgd/${sessionId}`);
  return { success: true, commentId: comment.id };
}

/**
 * Submit vote (Nominasikan / Tidak Nominasikan)
 */
export async function submitFgdVoteAction(sessionId: number, proposalId: number, vote: 'nominate' | 'not_nominate' | 'cancel') {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  if (vote === 'cancel') {
    await db.delete(fgdVotes).where(
      and(
        eq(fgdVotes.sessionId, sessionId),
        eq(fgdVotes.proposalId, proposalId),
        eq(fgdVotes.curatorId, session.userId)
      )
    );
  } else {
    // Upsert vote
    await db.insert(fgdVotes).values({
      sessionId,
      proposalId,
      curatorId: session.userId,
      vote,
    }).onConflictDoUpdate({
      target: [fgdVotes.sessionId, fgdVotes.proposalId, fgdVotes.curatorId],
      set: { vote, createdAt: new Date() },
    });
  }

  revalidatePath(`/fgd/${sessionId}`);
  return { success: true };
}

/**
 * Kunci & Tetapkan Hasil FGD (Hanya Koordinator)
 */
export async function lockFgdSessionAction(sessionId: number, selectedProposalIds: number[]) {
  const session = await requireRole(['coordinator']);

  const [fgd] = await db.select().from(fgdSessions).where(eq(fgdSessions.id, sessionId)).limit(1);
  if (!fgd) return { error: 'Sesi tidak ditemukan' };
  if (fgd.status === 'locked') return { error: 'Sesi sudah dikunci' };

  // Kunci sesinya
  await db.update(fgdSessions).set({
    status: 'locked',
    lockedAt: new Date(),
    lockedBy: session.userId,
    updatedAt: new Date(),
  }).where(eq(fgdSessions.id, sessionId));

  if (selectedProposalIds.length > 0) {
    if (fgd.fgdType === 'promoter') {
      // Ubah status ke grand_final
      await db.update(proposals).set({
        status: 'grand_final',
        updatedAt: new Date(),
      }).where(inArray(proposals.id, selectedProposalIds));

      // Semua proposal promotor_selection di kompetisi ini yang TIDAK terpilih, di-takeout
      const unselectedRows = await db.select({ id: proposals.id }).from(proposals)
        .where(
          and(
            eq(proposals.competitionId, fgd.competitionId),
            eq(proposals.status, 'promotor_selection')
          )
        );
      
      const unselectedIds = unselectedRows.map(r => r.id).filter(id => !selectedProposalIds.includes(id));
      if (unselectedIds.length > 0) {
        await db.update(proposals).set({
          status: 'takeout',
          takeoutReason: 'not_selected_in_final_filter',
          updatedAt: new Date(),
        }).where(inArray(proposals.id, unselectedIds));
      }

      // Advance competition phase
      const { competitions } = await import('@/lib/db/schema');
      await db.update(competitions)
        .set({ phase: 'sponsor_scoring', updatedAt: new Date() })
        .where(eq(competitions.id, fgd.competitionId));

    } else if (fgd.scope === 'nasional') {
      // Ubah status ke promotor_selection
      await db.update(proposals).set({
        status: 'promotor_selection',
        updatedAt: new Date(),
      }).where(inArray(proposals.id, selectedProposalIds));
    } else {
      // Regional: ubah status ke regional_finalist
      for (let i = 0; i < selectedProposalIds.length; i++) {
        await db.update(proposals).set({
          status: 'regional_finalist',
          regionalFinalistRank: i + 1, // urut berdasarkan urutan penetapan
          regionalFinalizedBy: session.userId,
          regionalFinalizedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(proposals.id, selectedProposalIds[i]));
      }
    }
  }

  await createAuditLog({
    action: 'lock_fgd_session',
    entity: 'fgd_session',
    entityId: sessionId.toString(),
    after: { selectedProposalIds, scope: fgd.scope },
  });

  revalidatePath(`/fgd/${sessionId}`);
  return { success: true };
}

export async function releaseSingleFgdProposalAction(sessionId: number, proposalId: number) {
  const session = await requireRole(['coordinator']);

  const [fgd] = await db.select().from(fgdSessions).where(eq(fgdSessions.id, sessionId)).limit(1);
  if (!fgd) return { error: 'Sesi tidak ditemukan' };
  if (fgd.status !== 'locked') return { error: 'Hanya bisa membatalkan di sesi yang sudah dikunci.' };

  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal) return { error: 'Proposal tidak ditemukan' };

  if (fgd.fgdType === 'promoter') {
    if (proposal.status !== 'grand_final' && proposal.status !== 'takeout') {
      return { error: 'Status proposal saat ini tidak valid untuk di-release dari sesi Promotor.' };
    }
  } else if (fgd.scope === 'nasional') {
    if (proposal.status !== 'promotor_selection' && proposal.status !== 'takeout') {
      return { error: 'Status proposal saat ini tidak valid untuk di-release dari Kurasi Nasional.' };
    }
  } else {
    if (proposal.status !== 'regional_finalist') {
      return { error: 'Status proposal saat ini tidak valid untuk di-release.' };
    }
  }

  let targetStatus = 'fgd';
  if (fgd.fgdType === 'promoter') {
    targetStatus = 'promotor_selection';
  }

  await db.update(proposals).set({
    status: targetStatus,
    takeoutReason: null,
    regionalFinalistRank: null,
    regionalFinalizedBy: null,
    regionalFinalizedAt: null,
    updatedAt: new Date(),
  }).where(eq(proposals.id, proposalId));

  await createAuditLog({
    action: 'release_single_fgd_proposal',
    entity: 'proposal',
    entityId: proposalId.toString(),
    after: { sessionId, previousStatus: proposal.status },
  });

  revalidatePath(`/fgd/${sessionId}`);
  return { success: true };
}
