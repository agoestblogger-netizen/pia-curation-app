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
import { eq, and, inArray, sql, arrayContains } from 'drizzle-orm';
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

  if (session.roles.includes('regional') && !session.roles.includes('coordinator')) {
    // Check if PIC from regionalFinalPics
    const [picAssignment] = await db
      .select({ userId: regionalFinalPics.userId })
      .from(regionalFinalPics)
      .where(eq(regionalFinalPics.sessionId, sessionId))
      .limit(1);
      
    if (!picAssignment || picAssignment.userId !== session.userId) {
      return { error: 'Akses ditolak: Anda bukan PIC Regional untuk grup ini.' };
    }
  }

  await db.update(regionalFinalSessions).set({
    status,
    updatedAt: new Date(),
  }).where(eq(regionalFinalSessions.id, sessionId));

  revalidatePath('/curator/regional-final');
  revalidatePath('/regional-judge', 'layout');
  revalidatePath('/regional-dashboard');
  return { success: true };
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
  scores: { problemFit: number, dampak: number, kelayakan: number, professional: number }
) {
  const userSession = await requireRole('regional');
  
  // Verify assignment
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
    return { error: 'Penilaian Anda sudah difinalisasi dan tidak dapat diubah lagi.' };
  }

  const [session] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, sessionId));
  const allowedStatuses = ['penilaian_dibuka', 'sidang_penetapan'];
  if (!session || !allowedStatuses.includes(session.status)) {
    return { error: 'Sesi penilaian tidak aktif' };
  }
  
  // Validation: clamp / check bounds (0 - 100)
  for (const val of Object.values(scores)) {
    if (val < 0 || val > 100) return { error: 'Skor harus berada di antara 0 dan 100' };
  }
  
  await db.insert(regionalFinalAssessments).values({
    sessionId,
    proposalId,
    judgeUserId: userSession.userId,
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
  
  // Check if all judges have submitted for all proposals
  // To avoid complex DB queries in this transaction, we can just let PIC manually check, or we can check here to trigger 'penilaian_selesai'
  
  revalidatePath(`/regional-judge/assess/${sessionId}`);
  revalidatePath(`/regional-judge/sidang/${sessionId}`);
  revalidatePath('/regional-judge', 'layout');
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
  
  if (userSession.roles.includes('regional') && !userSession.roles.includes('coordinator')) {
    // Check if PIC from regionalFinalPics
    const [picAssignment] = await db
      .select({ userId: regionalFinalPics.userId })
      .from(regionalFinalPics)
      .where(eq(regionalFinalPics.sessionId, sessionId))
      .limit(1);
      
    if (!picAssignment || picAssignment.userId !== userSession.userId) {
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
