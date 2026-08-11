'use server';

import { db } from '@/lib/db';
import { 
  proposals, 
  competitions, 
  users, 
  regionalFinalSessions, 
  regionalFinalJudges, 
  regionalFinalPics,
  regionalFinalAssessments, 
  regionalFinalResults,
  curatorAssignments
} from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and, inArray, sql, arrayContains, ne, isNotNull, desc } from 'drizzle-orm';
import { KANWIL_CITIES } from '@/lib/constants';
import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/lib/audit';

export async function getAvailableRegionalUsers() {
  await requireRole(['coordinator', 'admin']);
  
  return await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        arrayContains(users.roles, ['regional'])
      )
    );
}

export async function getRegionalFinalSessions(competitionId: number) {
  await requireRole(['coordinator', 'admin', 'curator', 'regional']);
  
  // Get all Kanwils + Pusat that actually have finalists
  const finalistProposals = await db
    .select({
      regionCenter: proposals.regionCenter,
      category: proposals.category,
    })
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, competitionId),
        eq(proposals.status, 'regional_finalist')
      )
    );
    
  const activeRegions = new Set<string>();
  for (const p of finalistProposals) {
    if (p.category === 'PUSAT') {
      activeRegions.add('Kantor Pusat');
    } else if (p.category === 'WILAYAH' && p.regionCenter) {
      const label = KANWIL_CITIES.includes(p.regionCenter) ? `Kanwil ${p.regionCenter}` : p.regionCenter;
      activeRegions.add(label);
    }
  }

  // Ensure sessions exist for active regions
  const existingSessions = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.competitionId, competitionId));
  const existingRegionNames = new Set(existingSessions.map(s => s.region));
  
  for (const region of activeRegions) {
    if (!existingRegionNames.has(region)) {
      await db.insert(regionalFinalSessions).values({
        competitionId,
        region,
        status: 'finalis_terkunci',
        juriCountSetting: 3,
      });
    }
  }

  // Fetch again with judges
  const allSessions = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.competitionId, competitionId));
  const sessionIds = allSessions.map(s => s.id);
  
  let allJudges: any[] = [];
  let allPics: any[] = [];
  if (sessionIds.length > 0) {
    allJudges = await db
      .select({
        sessionId: regionalFinalJudges.sessionId,
        userId: users.id,
        name: users.name,
      })
      .from(regionalFinalJudges)
      .innerJoin(users, eq(users.id, regionalFinalJudges.userId))
      .where(inArray(regionalFinalJudges.sessionId, sessionIds));
      
    allPics = await db
      .select({
        sessionId: regionalFinalPics.sessionId,
        userId: users.id,
        name: users.name,
      })
      .from(regionalFinalPics)
      .innerJoin(users, eq(users.id, regionalFinalPics.userId))
      .where(inArray(regionalFinalPics.sessionId, sessionIds));
  }

  return allSessions.map(session => {
    const pic = allPics.find(p => p.sessionId === session.id);
    return {
      ...session,
      pic: pic ? { id: pic.userId, name: pic.name } : null,
      judges: allJudges.filter(j => j.sessionId === session.id).map(j => ({ id: j.userId, name: j.name }))
    };
  }).sort((a, b) => {
    if (a.region === 'Kantor Pusat') return -1;
    if (b.region === 'Kantor Pusat') return 1;
    return a.region.localeCompare(b.region);
  });
}

export async function assignRegionalJudgesAction(sessionId: number, userIds: number[], picUserId?: number | null) {
  const session = await requireRole(['coordinator', 'admin']);
  
  const [targetSession] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, sessionId));
  if (!targetSession) return { error: 'Sesi tidak ditemukan' };
  
  if (targetSession.status !== 'finalis_terkunci' && targetSession.status !== 'juri_ditugaskan') {
    return { error: 'Tidak dapat mengubah juri karena tahap penilaian sudah dimulai' };
  }

  await db.delete(regionalFinalJudges).where(eq(regionalFinalJudges.sessionId, sessionId));
  await db.delete(regionalFinalPics).where(eq(regionalFinalPics.sessionId, sessionId));
  
  if (userIds.length > 0) {
    const values = userIds.map(userId => ({
      sessionId,
      userId,
      assignedBy: session.userId,
    }));
    await db.insert(regionalFinalJudges).values(values);
  }
  
  if (picUserId) {
    await db.insert(regionalFinalPics).values({
      sessionId,
      userId: picUserId,
      assignedBy: session.userId,
    });
  }

  await db.update(regionalFinalSessions).set({
    status: userIds.length > 0 ? 'juri_ditugaskan' : 'finalis_terkunci',
    updatedAt: new Date(),
  }).where(eq(regionalFinalSessions.id, sessionId));

  await createAuditLog({
    action: 'assign_regional_judges',
    entity: 'regional_final_sessions',
    entityId: sessionId.toString(),
    after: { userIds, picUserId }
  });

  // Sync previous notes for assigned judges and proposals in this session
  if (userIds.length > 0) {
    await syncPreviousJudgeNotesForSession(sessionId, userIds);
  }

  revalidatePath('/admin/regional-final');
  revalidatePath('/curator/regional-final');
  revalidatePath('/regional-judge', 'layout');
  revalidatePath('/regional-dashboard');
  return { success: true };
}

export async function updateRegionalSessionStatusAction(sessionId: number, status: 'penilaian_dibuka' | 'sidang_penetapan') {
  const session = await requireRole(['regional', 'coordinator', 'admin']);
  
  const [targetSession] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, sessionId));
  if (!targetSession) return { error: 'Sesi tidak ditemukan' };

  if (status === 'sidang_penetapan') {
    const allProposals = await getRegionalFinalProposals(sessionId);
    const assessments = await db.select().from(regionalFinalAssessments).where(eq(regionalFinalAssessments.sessionId, sessionId));
    const expectedAssessments = allProposals.length * targetSession.juriCountSetting;

    if (assessments.length < expectedAssessments) {
      return { 
        error: `Belum bisa masuk Sidang Penetapan. Semua Juri harus menyelesaikan penilaian terlebih dahulu. (Penilaian selesai: ${assessments.length} dari ${expectedAssessments})` 
      };
    }
  }

  if (session.roles.includes('regional') && !session.roles.includes('coordinator') && !session.roles.includes('admin')) {
    // Check if PIC from regionalFinalPics
    const [picAssignment] = await db
      .select({ userId: regionalFinalPics.userId })
      .from(regionalFinalPics)
      .where(and(
        eq(regionalFinalPics.sessionId, sessionId),
        eq(regionalFinalPics.userId, session.userId)
      ))
      .limit(1);
      
    if (!picAssignment) {
      return { error: 'Akses ditolak: Anda bukan PIC Regional untuk grup ini.' };
    }
  }

  await db.update(regionalFinalSessions).set({
    status,
    updatedAt: new Date(),
  }).where(eq(regionalFinalSessions.id, sessionId));

  // Sync previous notes when opening session for assessment
  if (status === 'penilaian_dibuka') {
    await syncPreviousJudgeNotesForSession(sessionId);
  }

  revalidatePath('/curator/regional-final');
  revalidatePath('/regional-judge', 'layout');
  revalidatePath('/regional-dashboard');
  return { success: true };
}

/**
 * Batalkan pembukaan penilaian: penilaian_dibuka → juri_ditugaskan.
 * KHUSUS ADMIN SAJA. Skor yang sudah masuk DIPERTAHANKAN (tidak dihapus).
 */
export async function cancelOpenAssessmentAction(sessionId: number) {
  const userSession = await requireRole(['admin']); // Strict: admin only

  const [targetSession] = await db
    .select()
    .from(regionalFinalSessions)
    .where(eq(regionalFinalSessions.id, sessionId))
    .limit(1);

  if (!targetSession) return { error: 'Sesi tidak ditemukan.' };

  if (targetSession.status !== 'penilaian_dibuka') {
    return {
      error: `Tidak dapat membatalkan: status sesi saat ini adalah "${targetSession.status}", bukan "penilaian_dibuka".`,
    };
  }

  // Count existing scores (for audit transparency) — scores are NOT deleted
  const existingScores = await db
    .select({ id: regionalFinalAssessments.id })
    .from(regionalFinalAssessments)
    .where(eq(regionalFinalAssessments.sessionId, sessionId));

  await db
    .update(regionalFinalSessions)
    .set({ status: 'juri_ditugaskan', updatedAt: new Date() })
    .where(eq(regionalFinalSessions.id, sessionId));

  await createAuditLog({
    action: 'cancel_open_assessment',
    entity: 'regional_final_sessions',
    entityId: sessionId.toString(),
    before: { status: 'penilaian_dibuka' },
    after: {
      status: 'juri_ditugaskan',
      region: targetSession.region,
      adminUserId: userSession.userId,
      adminName: userSession.name,
      existingScoresPreserved: existingScores.length,
      note: 'Skor yang sudah masuk dipertahankan, tidak dihapus.',
    },
  });

  revalidatePath('/admin/regional-final');
  revalidatePath('/curator/regional-final');
  revalidatePath('/regional-judge', 'layout');
  revalidatePath('/regional-dashboard');

  return { success: true, existingScoresCount: existingScores.length };
}


export async function getRegionalFinalProposals(sessionId: number) {
  const userSession = await requireRole(['curator', 'coordinator', 'admin', 'regional']);
  
  const [session] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, sessionId));
  if (!session) return [];
  
  // Guard: if user is only regional, they must be assigned as judge OR PIC for this session
  if (userSession.roles.includes('regional') && !userSession.roles.includes('admin') && !userSession.roles.includes('coordinator')) {
    const [judgeAssignment] = await db
      .select({ userId: regionalFinalJudges.userId })
      .from(regionalFinalJudges)
      .where(and(
        eq(regionalFinalJudges.sessionId, sessionId),
        eq(regionalFinalJudges.userId, userSession.userId)
      ))
      .limit(1);

    const [picAssignment] = await db
      .select({ userId: regionalFinalPics.userId })
      .from(regionalFinalPics)
      .where(and(
        eq(regionalFinalPics.sessionId, sessionId),
        eq(regionalFinalPics.userId, userSession.userId)
      ))
      .limit(1);
      
    if (!judgeAssignment && !picAssignment) {
      throw new Error('Akses ditolak: Anda bukan Juri maupun PIC untuk sesi ini.');
    }
  }

  const isPusat = session.region === 'Kantor Pusat';
  const dbRegion = session.region.replace(/^Kanwil /, '');
  
  const finalistProposals = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      category: proposals.category,
      proposerName: proposals.proposerName,
      proposerOrg: proposals.proposerOrg,
      summary: proposals.summary,
      formattedTexts: proposals.formattedTexts,
      status: proposals.status,
    })
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, session.competitionId),
        isPusat
          ? eq(proposals.category, 'PUSAT')
          : and(eq(proposals.category, 'WILAYAH'), eq(proposals.regionCenter, dbRegion)),
        eq(proposals.status, 'regional_finalist')
      )
    );
    
  return finalistProposals;
}

export async function submitRegionalAssessmentAction(
  sessionId: number,
  proposalId: number,
  scores: { problemFit: number, dampak: number, kelayakan: number, professional: number },
  notes?: string
) {
  const userSession = await requireRole(['regional', 'coordinator', 'admin']);
  
  // Verify assignment
  const [judgeAssignment] = await db
    .select({ userId: regionalFinalJudges.userId, isFinalized: regionalFinalJudges.isFinalized })
    .from(regionalFinalJudges)
    .where(and(
      eq(regionalFinalJudges.sessionId, sessionId),
      eq(regionalFinalJudges.userId, userSession.userId)
    ))
    .limit(1);
    
  if (!judgeAssignment && !userSession.roles.includes('admin') && !userSession.roles.includes('coordinator')) {
    return { error: 'Akses ditolak: Anda bukan Juri yang ditugaskan untuk sesi ini.' };
  }

  if (judgeAssignment?.isFinalized) {
    return { error: 'Penilaian Anda sudah difinalisasi dan tidak dapat diubah lagi.' };
  }

  const [session] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, sessionId));
  if (!session) {
    return { error: 'Sesi penilaian tidak ditemukan' };
  }

  const allowedStatuses = ['juri_ditugaskan', 'penilaian_dibuka', 'sidang_penetapan'];
  if (!allowedStatuses.includes(session.status)) {
    return { error: `Sesi penilaian tidak aktif (Status saat ini: ${session.status})` };
  }

  // Auto-promote status to penilaian_dibuka if still juri_ditugaskan when scoring starts
  if (session.status === 'juri_ditugaskan') {
    await db.update(regionalFinalSessions)
      .set({ status: 'penilaian_dibuka', updatedAt: new Date() })
      .where(eq(regionalFinalSessions.id, sessionId));
  }
  
  // Validation: clamp / check bounds (0 - 100)
  for (const val of Object.values(scores)) {
    if (val < 0 || val > 100) return { error: 'Skor harus berada di antara 0 dan 100' };
  }
  
  const updateData: any = {
    paramProblemFit: scores.problemFit,
    paramDampak: scores.dampak,
    paramKelayakan: scores.kelayakan,
    paramProfessional: scores.professional,
    submittedAt: new Date(),
  };
  if (notes !== undefined) {
    updateData.notes = notes;
  }

  await db.insert(regionalFinalAssessments).values({
    sessionId,
    proposalId,
    judgeUserId: userSession.userId,
    paramProblemFit: scores.problemFit,
    paramDampak: scores.dampak,
    paramKelayakan: scores.kelayakan,
    paramProfessional: scores.professional,
    notes: notes ?? null,
  }).onConflictDoUpdate({
    target: [regionalFinalAssessments.sessionId, regionalFinalAssessments.proposalId, regionalFinalAssessments.judgeUserId],
    set: updateData
  });
  
  revalidatePath(`/regional-judge/assess/${sessionId}`);
  revalidatePath(`/regional-judge/sidang/${sessionId}`);
  revalidatePath('/regional-judge', 'layout');
  return { success: true };
}

export async function saveRegionalJudgeNotesAction(
  sessionId: number,
  proposalId: number,
  notes: string
) {
  const userSession = await requireRole(['regional', 'coordinator', 'admin']);

  // Verify assignment
  const [judgeAssignment] = await db
    .select({ userId: regionalFinalJudges.userId, isFinalized: regionalFinalJudges.isFinalized })
    .from(regionalFinalJudges)
    .where(and(
      eq(regionalFinalJudges.sessionId, sessionId),
      eq(regionalFinalJudges.userId, userSession.userId)
    ))
    .limit(1);

  if (!judgeAssignment && !userSession.roles.includes('admin') && !userSession.roles.includes('coordinator')) {
    return { error: 'Akses ditolak: Anda bukan Juri yang ditugaskan untuk sesi ini.' };
  }

  if (judgeAssignment?.isFinalized) {
    return { error: 'Penilaian Anda sudah difinalisasi dan tidak dapat diubah lagi.' };
  }

  const [existing] = await db.select().from(regionalFinalAssessments)
    .where(and(
      eq(regionalFinalAssessments.sessionId, sessionId),
      eq(regionalFinalAssessments.proposalId, proposalId),
      eq(regionalFinalAssessments.judgeUserId, userSession.userId)
    ));

  if (existing) {
    await db.update(regionalFinalAssessments)
      .set({
        notes,
        submittedAt: new Date(),
      })
      .where(eq(regionalFinalAssessments.id, existing.id));
  } else {
    await db.insert(regionalFinalAssessments)
      .values({
        sessionId,
        proposalId,
        judgeUserId: userSession.userId,
        paramProblemFit: 0,
        paramDampak: 0,
        paramKelayakan: 0,
        paramProfessional: 0,
        notes,
      });
  }

  revalidatePath(`/regional-judge/assess/${sessionId}`);
  revalidatePath(`/regional-judge/sidang/${sessionId}`);
  return { success: true };
}

export async function finalizeRegionalJudgeScoreAction(sessionId: number) {
  const userSession = await requireRole('regional');
  
  const [judgeAssignment] = await db
    .select({ userId: regionalFinalJudges.userId, isFinalized: regionalFinalJudges.isFinalized })
    .from(regionalFinalJudges)
    .where(and(
      eq(regionalFinalJudges.sessionId, sessionId),
      eq(regionalFinalJudges.userId, userSession.userId)
    ))
    .limit(1);
    
  if (!judgeAssignment) {
    return { error: 'Akses ditolak: Anda bukan Juri untuk sesi ini.' };
  }

  if (judgeAssignment.isFinalized) {
    return { error: 'Nilai Anda sudah difinalisasi sebelumnya.' };
  }
  
  // Verifikasi apakah semua proposal sudah dinilai
  const [session] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, sessionId));
  if (!session || session.status !== 'penilaian_dibuka' && session.status !== 'sidang_penetapan') {
    return { error: 'Sesi penilaian tidak aktif' };
  }
  
  const allProposals = await getRegionalFinalProposals(sessionId);
  const myAssessments = await db.select().from(regionalFinalAssessments).where(and(
    eq(regionalFinalAssessments.sessionId, sessionId),
    eq(regionalFinalAssessments.judgeUserId, userSession.userId)
  ));
  
  if (myAssessments.length < allProposals.length) {
    return { error: `Tidak bisa melakukan finalisasi karena masih ada proposal yang belum Anda nilai. (Menilai ${myAssessments.length} dari ${allProposals.length} proposal)` };
  }
  
  await db.update(regionalFinalJudges)
    .set({ isFinalized: true })
    .where(and(
      eq(regionalFinalJudges.sessionId, sessionId),
      eq(regionalFinalJudges.userId, userSession.userId)
    ));
    
  revalidatePath(`/regional-judge/assess/${sessionId}`);
  revalidatePath(`/regional-judge/sidang/${sessionId}`);
  revalidatePath('/regional-judge', 'layout');
  return { success: true };
}

export async function lockRegionalFinalResultsAction(sessionId: number, tieBreakWinnerId?: number, tieBreakNote?: string) {
  const userSession = await requireRole(['regional', 'coordinator', 'admin']);
  
  const [session] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, sessionId));
  if (!session) return { error: 'Sesi tidak ditemukan' };
  
  if (userSession.roles.includes('regional') && !userSession.roles.includes('coordinator') && !userSession.roles.includes('admin')) {
    // Check if PIC from regionalFinalPics
    const [picAssignment] = await db
      .select({ userId: regionalFinalPics.userId })
      .from(regionalFinalPics)
      .where(and(
        eq(regionalFinalPics.sessionId, sessionId),
        eq(regionalFinalPics.userId, userSession.userId)
      ))
      .limit(1);
      
    if (!picAssignment) {
      return { error: 'Akses ditolak: Anda bukan PIC Regional untuk grup ini.' };
    }
  }

  if (session.status !== 'sidang_penetapan') {
    return { error: 'Hanya bisa mengunci hasil pada tahap Sidang Penetapan' };
  }
  
  // Check if ALL judges are finalized
  const judges = await db.select().from(regionalFinalJudges).where(eq(regionalFinalJudges.sessionId, sessionId));
  const allFinalized = judges.every(j => j.isFinalized);
  if (!allFinalized && judges.length > 0) {
    return { error: 'Tidak bisa mengunci hasil. Masih ada Juri yang belum melakukan finalisasi nilainya.' };
  }
  
  // Calculate final scores
  const allProposals = await getRegionalFinalProposals(sessionId);
  const assessments = await db.select().from(regionalFinalAssessments).where(eq(regionalFinalAssessments.sessionId, sessionId));
  
  // Validation: Check if every proposal has at least `session.juriCountSetting` assessments
  const incompleteProposals = allProposals.filter(p => {
    const pAssessments = assessments.filter(a => a.proposalId === p.id);
    return pAssessments.length < session.juriCountSetting;
  });

  if (incompleteProposals.length > 0) {
    return { error: `Tidak bisa mengunci hasil. Terdapat proposal yang belum dinilai oleh seluruh juri (Target: ${session.juriCountSetting} juri/proposal).` };
  }
  
  const proposalScores = allProposals.map(p => {
    const pAssessments = assessments.filter(a => a.proposalId === p.id);
    if (pAssessments.length === 0) return { proposalId: p.id, finalScore: 0 };
    
    const sum = pAssessments.reduce((acc, curr) => {
      const avg = (curr.paramProblemFit + curr.paramDampak + curr.paramKelayakan + curr.paramProfessional) / 4;
      return acc + avg;
    }, 0);
    
    return { proposalId: p.id, finalScore: sum / pAssessments.length };
  });
  
  // Sort descending
  proposalScores.sort((a, b) => b.finalScore - a.finalScore);
  
  // Check tie break for rank 1, 2, 3
  if (proposalScores.length >= 2 && !tieBreakWinnerId) {
    for (let i = 0; i < Math.min(3, proposalScores.length - 1); i++) {
      if (proposalScores[i].finalScore === proposalScores[i+1].finalScore) {
        return { error: 'Terdapat nilai seri pada kandidat juara. Anda harus melakukan override tie-break.', needsTieBreak: true, tiedProposals: [proposalScores[i].proposalId, proposalScores[i+1].proposalId] };
      }
    }
  }
  
  // If tie break winner is provided, boost their score slightly to rank higher, or just reorder array
  if (tieBreakWinnerId) {
    const winnerIdx = proposalScores.findIndex(p => p.proposalId === tieBreakWinnerId);
    if (winnerIdx > 0) {
      // swap with the one above it to resolve tie
      const temp = proposalScores[winnerIdx - 1];
      proposalScores[winnerIdx - 1] = proposalScores[winnerIdx];
      proposalScores[winnerIdx] = temp;
    }
  }
  
  // Insert results
  await db.delete(regionalFinalResults).where(eq(regionalFinalResults.sessionId, sessionId));
  
  const resultInserts = proposalScores.map((ps, index) => {
    const rank = index < 3 ? index + 1 : null;
    return {
      sessionId,
      proposalId: ps.proposalId,
      finalScore: ps.finalScore,
      rank,
      tieBreakNote: tieBreakWinnerId && ps.proposalId === tieBreakWinnerId ? tieBreakNote : null,
      lockedBy: userSession.userId,
      lockedAt: new Date(),
    };
  });
  
  if (resultInserts.length > 0) {
    await db.insert(regionalFinalResults).values(resultInserts);
  }
  
  await db.update(regionalFinalSessions).set({
    status: 'hasil_terkunci',
    lockedBy: userSession.userId,
    lockedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(regionalFinalSessions.id, sessionId));
  
  await createAuditLog({
    action: 'lock_regional_final_results',
    entity: 'regional_final_sessions',
    entityId: sessionId.toString(),
    after: { results: proposalScores }
  });

  revalidatePath('/curator/regional-final');
  revalidatePath('/regional-judge', 'layout');
  revalidatePath('/regional-dashboard');
  revalidatePath('/coordinator/finalization');
  return { success: true };
}

export async function checkSidangOperatorPermission(sessionId: number, userId: number, userRoles: string[]) {
  if (userRoles.includes('admin') || userRoles.includes('coordinator')) {
    return { allowed: true, isPic: true, isJudge: true };
  }

  const [pic] = await db
    .select()
    .from(regionalFinalPics)
    .where(and(eq(regionalFinalPics.sessionId, sessionId), eq(regionalFinalPics.userId, userId)))
    .limit(1);

  if (pic) return { allowed: true, isPic: true, isJudge: false };

  const [judge] = await db
    .select()
    .from(regionalFinalJudges)
    .where(and(eq(regionalFinalJudges.sessionId, sessionId), eq(regionalFinalJudges.userId, userId)))
    .limit(1);

  if (judge) return { allowed: true, isPic: false, isJudge: true };

  return { allowed: false, isPic: false, isJudge: false };
}

export async function calibrateSidangScoreAction(
  sessionId: number,
  proposalId: number,
  targetJudgeUserId: number,
  scores: { problemFit: number; dampak: number; kelayakan: number; professional: number }
) {
  const userSession = await requireRole(['regional', 'coordinator', 'admin']);

  const perm = await checkSidangOperatorPermission(sessionId, userSession.userId, userSession.roles);
  if (!perm.allowed) {
    return { error: 'Akses ditolak: Anda bukan PIC atau Juri yang ditugaskan untuk grup ini.' };
  }

  const [session] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, sessionId));
  if (!session) return { error: 'Sesi tidak ditemukan' };
  if (session.status === 'hasil_terkunci') {
    return { error: 'Hasil sidang sudah dikunci secara permanen.' };
  }

  // Validate values (0 - 100) — validasi HANYA 4 field skor yang relevan
  const scoreFields: [string, number][] = [
    ['problemFit', scores.problemFit],
    ['dampak', scores.dampak],
    ['kelayakan', scores.kelayakan],
    ['professional', scores.professional],
  ];
  for (const [key, val] of scoreFields) {
    if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 100) {
      return { error: `Skor ${key} harus berada di antara 0 dan 100.` };
    }
  }

  // Check old assessment for audit logging
  const [oldAssessment] = await db
    .select()
    .from(regionalFinalAssessments)
    .where(
      and(
        eq(regionalFinalAssessments.sessionId, sessionId),
        eq(regionalFinalAssessments.proposalId, proposalId),
        eq(regionalFinalAssessments.judgeUserId, targetJudgeUserId)
      )
    )
    .limit(1);

  const [targetProposal] = await db.select({ title: proposals.title }).from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  const [targetJudgeUser] = await db.select({ name: users.name }).from(users).where(eq(users.id, targetJudgeUserId)).limit(1);

  await db.insert(regionalFinalAssessments).values({
    sessionId,
    proposalId,
    judgeUserId: targetJudgeUserId,
    paramProblemFit: scores.problemFit,
    paramDampak: scores.dampak,
    paramKelayakan: scores.kelayakan,
    paramProfessional: scores.professional,
  }).onConflictDoUpdate({
    target: [regionalFinalAssessments.sessionId, regionalFinalAssessments.proposalId, regionalFinalAssessments.judgeUserId],
    set: {
      paramProblemFit: scores.problemFit,
      paramDampak: scores.dampak,
      paramKelayakan: scores.kelayakan,
      paramProfessional: scores.professional,
      submittedAt: new Date(),
    }
  });

  await createAuditLog({
    action: 'sidang_calibrate_score',
    entity: 'regional_final_assessments',
    entityId: `${sessionId}-${proposalId}-${targetJudgeUserId}`,
    after: {
      sessionId,
      proposalId,
      proposalTitle: targetProposal?.title || `#${proposalId}`,
      targetJudgeUserId,
      targetJudgeName: targetJudgeUser?.name || `#${targetJudgeUserId}`,
      operatorUserId: userSession.userId,
      operatorName: userSession.name,
      operatorRole: perm.isPic ? 'PIC Regional' : 'Juri Regional',
      oldScores: oldAssessment ? {
        problemFit: oldAssessment.paramProblemFit,
        dampak: oldAssessment.paramDampak,
        kelayakan: oldAssessment.paramKelayakan,
        professional: oldAssessment.paramProfessional
      } : null,
      newScores: scores
    }
  });

  revalidatePath(`/regional-judge/sidang/${sessionId}`);
  revalidatePath(`/regional-judge/assess/${sessionId}`);
  revalidatePath('/curator/regional-final');
  revalidatePath('/regional-dashboard');
  return { success: true };
}

export async function finalizeSidangSessionAction(sessionId: number) {
  const userSession = await requireRole(['regional', 'coordinator', 'admin']);

  const perm = await checkSidangOperatorPermission(sessionId, userSession.userId, userSession.roles);
  if (!perm.allowed) {
    return { error: 'Akses ditolak: Anda bukan PIC atau Juri yang ditugaskan untuk grup ini.' };
  }

  const [session] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, sessionId));
  if (!session) return { error: 'Sesi tidak ditemukan' };
  if (session.status === 'hasil_terkunci') {
    return { error: 'Hasil sidang sudah dikunci secara permanen.' };
  }

  // Set isFinalized = true for all judges in this session
  await db.update(regionalFinalJudges)
    .set({ isFinalized: true })
    .where(eq(regionalFinalJudges.sessionId, sessionId));

  // Update session status to sidang_penetapan
  await db.update(regionalFinalSessions)
    .set({ status: 'sidang_penetapan', updatedAt: new Date() })
    .where(eq(regionalFinalSessions.id, sessionId));

  await createAuditLog({
    action: 'finalize_sidang_session',
    entity: 'regional_final_sessions',
    entityId: sessionId.toString(),
    after: {
      sessionId,
      region: session.region,
      operatorUserId: userSession.userId,
      operatorName: userSession.name,
      operatorRole: perm.isPic ? 'PIC Regional' : 'Juri Regional'
    }
  });

  revalidatePath(`/regional-judge/sidang/${sessionId}`);
  revalidatePath(`/regional-judge/assess/${sessionId}`);
  revalidatePath('/curator/regional-final');
  revalidatePath('/regional-dashboard');
  revalidatePath('/regional-judge', 'layout');
  return { success: true };
}

/**
 * Copy catatan Juri (notes) dari sesi regional sebelumnya untuk pasangan (proposalId + judgeUserId)
 * jika Juri yang sama menilai Proposal yang sama di sesi baru.
 * Skor (paramProblemFit, dst) TIDAK ikut di-copy.
 */
export async function syncPreviousJudgeNotesForSession(sessionId: number, userIds?: number[]) {
  try {
    const proposalsInSession = await getRegionalFinalProposals(sessionId);
    if (proposalsInSession.length === 0) return;

    const proposalIds = proposalsInSession.map(p => p.id);

    let judgeIds = userIds;
    if (!judgeIds || judgeIds.length === 0) {
      const judges = await db
        .select({ userId: regionalFinalJudges.userId })
        .from(regionalFinalJudges)
        .where(eq(regionalFinalJudges.sessionId, sessionId));
      judgeIds = judges.map(j => j.userId);
    }

    if (judgeIds.length === 0) return;

    const previousAssessments = await db
      .select({
        proposalId: regionalFinalAssessments.proposalId,
        judgeUserId: regionalFinalAssessments.judgeUserId,
        notes: regionalFinalAssessments.notes,
        submittedAt: regionalFinalAssessments.submittedAt,
      })
      .from(regionalFinalAssessments)
      .where(
        and(
          inArray(regionalFinalAssessments.proposalId, proposalIds),
          inArray(regionalFinalAssessments.judgeUserId, judgeIds),
          ne(regionalFinalAssessments.sessionId, sessionId),
          isNotNull(regionalFinalAssessments.notes),
          ne(regionalFinalAssessments.notes, '')
        )
      )
      .orderBy(desc(regionalFinalAssessments.submittedAt));

    if (previousAssessments.length === 0) return;

    const latestNotesMap = new Map<string, string>();
    for (const prev of previousAssessments) {
      const key = `${prev.proposalId}_${prev.judgeUserId}`;
      if (!latestNotesMap.has(key) && prev.notes && prev.notes.trim() !== '') {
        latestNotesMap.set(key, prev.notes);
      }
    }

    if (latestNotesMap.size === 0) return;

    const currentAssessments = await db
      .select({
        id: regionalFinalAssessments.id,
        proposalId: regionalFinalAssessments.proposalId,
        judgeUserId: regionalFinalAssessments.judgeUserId,
        notes: regionalFinalAssessments.notes,
      })
      .from(regionalFinalAssessments)
      .where(eq(regionalFinalAssessments.sessionId, sessionId));

    const currentMap = new Map<string, { id: number; notes: string | null }>();
    for (const curr of currentAssessments) {
      currentMap.set(`${curr.proposalId}_${curr.judgeUserId}`, curr);
    }

    for (const [key, oldNote] of latestNotesMap.entries()) {
      const [propIdStr, judgeIdStr] = key.split('_');
      const propId = parseInt(propIdStr, 10);
      const judgeId = parseInt(judgeIdStr, 10);

      const existingInCurr = currentMap.get(key);

      if (existingInCurr) {
        if (!existingInCurr.notes || existingInCurr.notes.trim() === '') {
          await db
            .update(regionalFinalAssessments)
            .set({ notes: oldNote })
            .where(eq(regionalFinalAssessments.id, existingInCurr.id));
        }
      } else {
        await db.insert(regionalFinalAssessments).values({
          sessionId,
          proposalId: propId,
          judgeUserId: judgeId,
          paramProblemFit: 0,
          paramDampak: 0,
          paramKelayakan: 0,
          paramProfessional: 0,
          notes: oldNote,
        });
      }
    }
  } catch (err) {
    console.error('Error in syncPreviousJudgeNotesForSession:', err);
  }
}
