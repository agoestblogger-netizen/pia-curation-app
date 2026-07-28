'use server';

import { db } from '@/lib/db';
import { 
  fgdSessions, fgdComments, fgdVotes, proposals, auditLogs,
  screeningResults, users, curatorAssignments
} from '@/lib/db/schema';
import { eq, and, inArray, ne, desc, isNotNull } from 'drizzle-orm';
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
 * Hapus komentar milik sendiri di ruang FGD
 */
export async function deleteFgdCommentAction(commentId: number) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const [comment] = await db
    .select()
    .from(fgdComments)
    .where(eq(fgdComments.id, commentId))
    .limit(1);

  if (!comment) {
    return { error: 'Komentar tidak ditemukan.' };
  }

  if (comment.curatorId !== session.userId) {
    return { error: 'Anda hanya dapat menghapus komentar milik Anda sendiri.' };
  }

  if (comment.commentType === 'curator_note') {
    return { error: 'Catatan Kurator resmi dari screening tidak dapat dihapus.' };
  }

  await db.delete(fgdComments).where(eq(fgdComments.id, commentId));

  await createAuditLog({
    action: 'delete_fgd_comment',
    entity: 'fgd_comment',
    entityId: commentId.toString(),
    before: { proposalId: comment.proposalId, content: comment.content },
  });

  revalidatePath(`/fgd/${comment.sessionId}`);
  return { success: true, commentId };
}

/**
 * Insert catatan kurator (dari screening) sebagai entri permanen di thread Ruang Diskusi FGD.
 * Hanya diinsert SEKALI per proposal+session (idempoten — aman dipanggil berkali-kali).
 * Dipanggil client-side saat proposal pertama kali dibuka di tab Diskusi & Voting.
 */
export async function insertCuratorNoteAsCommentAction(
  sessionId: number,
  proposalId: number
) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  try {
    // 1. Cek apakah sudah ada entry curator_note untuk proposal+session ini (dedup guard)
    const existing = await db
      .select({ id: fgdComments.id })
      .from(fgdComments)
      .where(
        and(
          eq(fgdComments.sessionId, sessionId),
          eq(fgdComments.proposalId, proposalId),
          eq(fgdComments.commentType, 'curator_note')
        )
      )
      .limit(1);

    if (existing.length > 0) return { success: true, skipped: true };

    // 2. Fetch catatan kurator + nama kurator dari screening_results
    const [sr] = await db
      .select({
        notes: screeningResults.notes,
        recommendation: screeningResults.recommendation,
        verdict: screeningResults.verdict,
        curatorId: screeningResults.curatorId,
      })
      .from(screeningResults)
      .where(eq(screeningResults.proposalId, proposalId))
      .limit(1);

    // Jika tidak ada catatan kurator, skip
    if (!sr || (!sr.notes && !sr.recommendation)) return { success: true, skipped: true };
    if (!sr.curatorId) return { success: true, skipped: true };

    // 3. Build konten entri — gabungkan notes + rekomendasi dalam satu teks
    const verdictLabel: Record<string, string> = {
      lolos: 'Lolos', duplication: 'Duplikasi', mapped: 'Mapped',
      non_compliance: 'Non-Compliance', low_impact: 'Low Impact',
    };
    const lines: string[] = [];
    if (sr.verdict) lines.push(`[${verdictLabel[sr.verdict] ?? sr.verdict}]`);
    if (sr.notes) lines.push(sr.notes);
    if (sr.recommendation) lines.push(`Rekomendasi: ${sr.recommendation}`);
    const content = lines.join('\n');

    // 4. Insert sebagai comment dengan type curator_note, curatorId dari screening
    await db.insert(fgdComments).values({
      sessionId,
      proposalId,
      curatorId: sr.curatorId,
      content,
      commentType: 'curator_note',
    });

    revalidatePath(`/fgd/${sessionId}`);
    return { success: true, skipped: false, content };
  } catch (e: any) {
    if (e?.code === '23505' || e?.message?.includes('unique') || e?.message?.includes('duplicate')) {
      return { success: true, skipped: true };
    }
    console.error('[insertCuratorNoteAsCommentAction] Error:', e?.message || e);
    return { error: e?.message || 'Gagal menyisipkan catatan kurator' };
  }
}

/**
 * Copy/sync komentar & catatan kurator (fgd_comments) dari sesi FGD sebelumnya
 * untuk proposal yang sama ketika proposal masuk ke sesi FGD baru.
 * Mencegah duplikasi dengan mengecek kombinasi (proposalId, curatorId, content).
 * Vote (fgd_votes) TIDAK ikut di-copy.
 */
export async function syncPreviousFgdCommentsForSession(sessionId: number) {
  try {
    const [sessionData] = await db
      .select({ 
        competitionId: fgdSessions.competitionId, 
        scope: fgdSessions.scope, 
        regionCenter: fgdSessions.regionCenter, 
        filterStatuses: fgdSessions.filterStatuses, 
        fgdType: fgdSessions.fgdType 
      })
      .from(fgdSessions)
      .where(eq(fgdSessions.id, sessionId))
      .limit(1);

    if (!sessionData) return;

    const targetStatuses = Array.isArray(sessionData.filterStatuses) && sessionData.filterStatuses.length > 0
      ? (sessionData.filterStatuses as string[])
      : ['lolos'];

    let propQuery = db.select({ id: proposals.id }).from(proposals)
      .where(
        and(
          eq(proposals.competitionId, sessionData.competitionId),
          inArray(proposals.status, targetStatuses)
        )
      );

    const propRows = await propQuery;
    if (propRows.length === 0) return;
    const proposalIds = propRows.map(p => p.id);

    // Get previous comments for these proposals in OTHER sessions
    const previousComments = await db
      .select({
        proposalId: fgdComments.proposalId,
        curatorId: fgdComments.curatorId,
        content: fgdComments.content,
        commentType: fgdComments.commentType,
        createdAt: fgdComments.createdAt,
      })
      .from(fgdComments)
      .where(
        and(
          inArray(fgdComments.proposalId, proposalIds),
          ne(fgdComments.sessionId, sessionId)
        )
      )
      .orderBy(fgdComments.createdAt);

    if (previousComments.length === 0) return;

    // Get current comments in target session
    const currentComments = await db
      .select({
        proposalId: fgdComments.proposalId,
        curatorId: fgdComments.curatorId,
        content: fgdComments.content,
      })
      .from(fgdComments)
      .where(eq(fgdComments.sessionId, sessionId));

    const currentCommentKeys = new Set<string>();
    for (const curr of currentComments) {
      currentCommentKeys.add(`${curr.proposalId}_${curr.curatorId}_${curr.content.trim()}`);
    }

    const toInsert = [];
    for (const prev of previousComments) {
      const key = `${prev.proposalId}_${prev.curatorId}_${prev.content.trim()}`;
      if (!currentCommentKeys.has(key)) {
        currentCommentKeys.add(key);
        toInsert.push({
          sessionId,
          proposalId: prev.proposalId,
          curatorId: prev.curatorId,
          content: prev.content,
          commentType: prev.commentType,
          createdAt: prev.createdAt,
        });
      }
    }

    if (toInsert.length > 0) {
      await db.insert(fgdComments).values(toInsert);
    }
  } catch (err) {
    console.error('Error in syncPreviousFgdCommentsForSession:', err);
  }
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
