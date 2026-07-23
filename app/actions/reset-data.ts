'use server';

import { db } from '@/lib/db';
import { 
  proposals, 
  curatorAssignments, 
  screeningResults,
  fgdSessions,
  fgdVotes,
  fgdComments,
  promoterAssignments,
  promoterSelections,
  curationBatches,
  auditLogs,
  sponsorScores,
  scoringSnapshots,
  finalResults,
  proposalAiAnalyses,
  fgdAdditionalDocuments,
  potentialDuplicates,
  grandFinalSelections,
  grandFinalAssessments,
  regionalFinalSessions,
  regionalFinalPics,
  regionalFinalJudges,
  regionalFinalAssessments,
  regionalFinalResults
} from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { getActiveCompetition } from './competitions';
import { revalidatePath } from 'next/cache';
import { del } from '@vercel/blob';

export type ResetOptions = {
  resetKurasiNasional: boolean;
  resetRegionalLock: boolean;
  // 3A: Hapus assignment PIC & Juri, sesi kembali ke finalis_terkunci
  resetKelolaPicJuri: boolean;
  // 3B: Hapus assessment & hasil, sesi kembali ke juri_ditugaskan
  resetPenilaianHasil: boolean;
  resetGrandFinal: boolean;
  resetAuditLog: boolean;
  resetAiCache?: boolean;
  resetPdfs?: boolean;
  resetDuplicates?: boolean;
};

export async function resetDataAction(options: ResetOptions) {
  const session = await requireRole('admin');
  const comp = await getActiveCompetition();

  if (!comp) {
    return { error: 'Tidak ada kompetisi aktif.' };
  }

  const compId = comp.id;
  const executedActions: string[] = [];

  try {
    // 1. Reset Kurasi Nasional
    if (options.resetKurasiNasional) {
      const compProposals = await db.select({ id: proposals.id }).from(proposals)
        .where(and(eq(proposals.competitionId, compId), eq(proposals.category, 'PUSAT')));
      const compNasionalIds = compProposals.map(p => p.id);

      if (compNasionalIds.length > 0) {
        await db.delete(screeningResults).where(inArray(screeningResults.proposalId, compNasionalIds));
        await db.delete(promoterSelections).where(inArray(promoterSelections.proposalId, compNasionalIds));
        await db.delete(promoterAssignments).where(inArray(promoterAssignments.proposalId, compNasionalIds));
      }

      const nasionalFgd = await db.select({ id: fgdSessions.id }).from(fgdSessions).where(
        and(eq(fgdSessions.competitionId, compId), eq(fgdSessions.scope, 'nasional'))
      );
      const nasionalFgdIds = nasionalFgd.map(s => s.id);
      if (nasionalFgdIds.length > 0) {
        await db.delete(fgdVotes).where(inArray(fgdVotes.sessionId, nasionalFgdIds));
        await db.delete(fgdComments).where(inArray(fgdComments.sessionId, nasionalFgdIds));
        await db.delete(fgdSessions).where(inArray(fgdSessions.id, nasionalFgdIds));
      }

      const batches = await db.select({ id: curationBatches.id }).from(curationBatches).where(eq(curationBatches.competitionId, compId));
      const batchIds = batches.map(b => b.id);
      if (batchIds.length > 0) {
        const assignments = await db.select({ id: curatorAssignments.id }).from(curatorAssignments).where(inArray(curatorAssignments.batchId, batchIds));
        const assignmentIds = assignments.map(a => a.id);
        
        if (assignmentIds.length > 0) {
          // Hapus screening_results yang terikat dengan assignment ini (agar tidak kena Foreign Key constraint)
          await db.delete(screeningResults).where(inArray(screeningResults.assignmentId, assignmentIds));
          await db.delete(curatorAssignments).where(inArray(curatorAssignments.id, assignmentIds));
        }
        await db.delete(curationBatches).where(inArray(curationBatches.id, batchIds));
      }

      if (compNasionalIds.length > 0) {
        const kurasiStatuses = ['assigned', 'screened', 'fgd', 'promotor_selection', 'promotor_passed', 'promotor_rejected'];
        await db.update(proposals)
          .set({ status: 'imported' })
          .where(
            and(
              eq(proposals.competitionId, compId),
              eq(proposals.category, 'PUSAT'),
              inArray(proposals.status, kurasiStatuses)
            )
          );
      }
      executedActions.push('Kurasi Nasional');
    }

    // 2. Reset Regional (Kunci Finalis)
    if (options.resetRegionalLock) {
      await db.update(proposals)
        .set({ status: 'imported' })
        .where(
          and(
            eq(proposals.competitionId, compId),
            eq(proposals.status, 'regional_finalist')
          )
        );
      executedActions.push('Kunci Finalis Regional');
    }

    // 3A. Reset Kelola Regional — Hapus assignment PIC & Juri
    //     Status sesi dikembalikan ke 'finalis_terkunci'
    if (options.resetKelolaPicJuri) {
      const regSessions = await db
        .select({ id: regionalFinalSessions.id })
        .from(regionalFinalSessions)
        .where(eq(regionalFinalSessions.competitionId, compId));
      const regSessionIds = regSessions.map(s => s.id);

      if (regSessionIds.length > 0) {
        await db.delete(regionalFinalPics).where(inArray(regionalFinalPics.sessionId, regSessionIds));
        await db.delete(regionalFinalJudges).where(inArray(regionalFinalJudges.sessionId, regSessionIds));

        // Kembalikan status sesi ke finalis_terkunci (seolah belum ada PIC/Juri)
        await db.update(regionalFinalSessions)
          .set({ status: 'finalis_terkunci' })
          .where(inArray(regionalFinalSessions.id, regSessionIds));
      }
      executedActions.push('Kelola Final Regional (PIC & Juri)');
    }

    // 3B. Reset Penilaian & Hasil — Hapus assessment & hasil ranking
    //     Status sesi dikembalikan ke 'juri_ditugaskan' (assignment tetap)
    if (options.resetPenilaianHasil) {
      const regSessions = await db
        .select({ id: regionalFinalSessions.id })
        .from(regionalFinalSessions)
        .where(eq(regionalFinalSessions.competitionId, compId));
      const regSessionIds = regSessions.map(s => s.id);

      if (regSessionIds.length > 0) {
        await db.delete(regionalFinalResults).where(inArray(regionalFinalResults.sessionId, regSessionIds));
        await db.delete(regionalFinalAssessments).where(inArray(regionalFinalAssessments.sessionId, regSessionIds));

        // Kembalikan status sesi ke juri_ditugaskan (PIC/Juri tetap ada)
        await db.update(regionalFinalSessions)
          .set({ status: 'juri_ditugaskan' })
          .where(
            and(
              inArray(regionalFinalSessions.id, regSessionIds),
              // Hanya turunkan status yang di atas juri_ditugaskan
              inArray(regionalFinalSessions.status, ['penilaian_dibuka', 'penilaian_selesai', 'sidang_penetapan', 'hasil_terkunci'])
            )
          );
      }

      // Kembalikan proposal yang lolos (curation_passed) ke regional_finalist
      await db.update(proposals)
        .set({
          regionalFinalistRank: null,
          regionalFinalizedAt: null,
          regionalFinalizedBy: null,
          status: 'regional_finalist'
        })
        .where(
          and(
            eq(proposals.competitionId, compId),
            eq(proposals.status, 'curation_passed')
          )
        );
      executedActions.push('Penilaian & Hasil Final Regional');
    }

    // 4. Reset Grand Final (Sponsor/Nasional)
    if (options.resetGrandFinal) {
      await db.delete(grandFinalSelections).where(eq(grandFinalSelections.competitionId, compId));
      await db.delete(grandFinalAssessments).where(eq(grandFinalAssessments.competitionId, compId));
      await db.delete(sponsorScores).where(eq(sponsorScores.competitionId, compId));
      await db.delete(scoringSnapshots).where(eq(scoringSnapshots.competitionId, compId));
      await db.delete(finalResults).where(eq(finalResults.competitionId, compId));

      await db.update(proposals)
        .set({ status: 'grand_finalist' })
        .where(
          and(
            eq(proposals.competitionId, compId),
            inArray(proposals.status, ['winner', 'selected'])
          )
        );
      executedActions.push('Grand Final Sponsor');
    }

    // 5. Audit Logs
    if (options.resetAuditLog) {
      await db.delete(auditLogs);
      executedActions.push('Audit Log');
    }

    // 6. Cache Analisis AI
    if (options.resetAiCache) {
      const compProposals = await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.competitionId, compId));
      const compProposalIds = compProposals.map(p => p.id);

      if (compProposalIds.length > 0) {
        await db.delete(proposalAiAnalyses).where(inArray(proposalAiAnalyses.proposalId, compProposalIds));
        await db.update(proposals)
          .set({ formattedTexts: null })
          .where(inArray(proposals.id, compProposalIds));
      }
      executedActions.push('Cache Analisis AI');
    }

    // 7. Dokumen Tambahan PDF
    if (options.resetPdfs) {
      const compProposals = await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.competitionId, compId));
      const compProposalIds = compProposals.map(p => p.id);

      if (compProposalIds.length > 0) {
        const docs = await db.select({ url: fgdAdditionalDocuments.fileUrl })
          .from(fgdAdditionalDocuments)
          .where(inArray(fgdAdditionalDocuments.proposalId, compProposalIds));

        if (docs.length > 0) {
          const urls = docs.map(d => d.url);
          try {
            await del(urls);
          } catch (e) {
            console.error('Error deleting blobs from Vercel:', e);
          }
          await db.delete(fgdAdditionalDocuments).where(inArray(fgdAdditionalDocuments.proposalId, compProposalIds));
        }
      }
      executedActions.push('Dokumen Tambahan PDF');
    }

    // 8. Potensi Duplikat
    if (options.resetDuplicates) {
      const compProposals = await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.competitionId, compId));
      const compProposalIds = compProposals.map(p => p.id);

      if (compProposalIds.length > 0) {
        await db.delete(potentialDuplicates).where(
          inArray(potentialDuplicates.proposalAId, compProposalIds)
        );
      }
      executedActions.push('Potensi Duplikat');
    }

    await db.insert(auditLogs).values({
      actorId: session.userId,
      actorName: session.name,
      action: 'reset_data_testing',
      entity: 'competitions',
      entityId: compId.toString(),
      afterJson: { options, executedActions }
    });

    revalidatePath('/', 'layout');

  } catch (err: any) {
    console.error('Reset Data Error:', err);
    return { error: 'Gagal melakukan reset: ' + err.message };
  }

  return { success: true, executedActions };
}

export async function getResetStatsAction() {
  await requireRole('admin');
  const comp = await getActiveCompetition();
  if (!comp) return null;

  const compId = comp.id;

  const [screeningCount] = await db.execute(sql`
    SELECT count(*) FROM screening_results sr
    JOIN proposals p ON p.id = sr.proposal_id
    WHERE p.competition_id = ${compId} AND p.category = 'PUSAT'
  `);

  const [assignmentCount] = await db.execute(sql`
    SELECT count(*) FROM curator_assignments ca
    JOIN curation_batches cb ON cb.id = ca.batch_id
    WHERE cb.competition_id = ${compId}
  `);

  const [nasionalFgdCount] = await db.execute(sql`
    SELECT count(*) FROM fgd_sessions WHERE competition_id = ${compId} AND scope = 'nasional'
  `);

  const [regionalLockCount] = await db.execute(sql`
    SELECT count(*) FROM proposals 
    WHERE competition_id = ${compId} AND status = 'regional_finalist'
  `);

  // 3A: PIC + Juri yang sudah di-assign
  const [picCount] = await db.execute(sql`
    SELECT count(*) FROM regional_final_pics rfp
    JOIN regional_final_sessions rfs ON rfs.id = rfp.session_id
    WHERE rfs.competition_id = ${compId}
  `);

  const [judgeCount] = await db.execute(sql`
    SELECT count(*) FROM regional_final_judges rfj
    JOIN regional_final_sessions rfs ON rfs.id = rfj.session_id
    WHERE rfs.competition_id = ${compId}
  `);

  // 3B: Assessments + Results
  const [assessmentCount] = await db.execute(sql`
    SELECT count(*) FROM regional_final_assessments rfa
    JOIN regional_final_sessions rfs ON rfs.id = rfa.session_id
    WHERE rfs.competition_id = ${compId}
  `);

  const [finalRegionalResultsCount] = await db.execute(sql`
    SELECT count(*) FROM regional_final_results rfr
    JOIN regional_final_sessions rfs ON rfs.id = rfr.session_id
    WHERE rfs.competition_id = ${compId}
  `);

  const [finalRegionalPassedCount] = await db.execute(sql`
    SELECT count(*) FROM proposals WHERE competition_id = ${compId} AND status = 'curation_passed'
  `);

  const [gfAssessmentCount] = await db.execute(sql`
    SELECT count(*) FROM grand_final_assessments WHERE competition_id = ${compId}
  `);

  const [sponsorCount] = await db.execute(sql`
    SELECT count(*) FROM sponsor_scores WHERE competition_id = ${compId}
  `);

  const [auditLogCount] = await db.execute(sql`SELECT count(*) FROM audit_logs`);

  const [aiCacheCount] = await db.execute(sql`
    SELECT count(*) FROM proposal_ai_analyses paa
    JOIN proposals p ON p.id = paa.proposal_id
    WHERE p.competition_id = ${compId}
  `);

  const [formattedTextsCount] = await db.execute(sql`
    SELECT count(*) FROM proposals p
    WHERE p.competition_id = ${compId} AND p.formatted_texts IS NOT NULL
  `);

  const [pdfCount] = await db.execute(sql`
    SELECT count(*) FROM fgd_additional_documents fad
    JOIN proposals p ON p.id = fad.proposal_id
    WHERE p.competition_id = ${compId}
  `);

  const [duplicatesCount] = await db.execute(sql`
    SELECT count(*) FROM potential_duplicates pd
    JOIN proposals p ON p.id = pd.proposal_a_id
    WHERE p.competition_id = ${compId}
  `);

  return {
    kurasiNasional: Number((screeningCount as any)?.count || 0) + Number((assignmentCount as any)?.count || 0) + Number((nasionalFgdCount as any)?.count || 0),
    regionalLock: Number((regionalLockCount as any)?.count || 0),
    // 3A
    kelolaPicJuri: Number((picCount as any)?.count || 0) + Number((judgeCount as any)?.count || 0),
    // 3B
    penilaianHasil: Number((assessmentCount as any)?.count || 0) + Number((finalRegionalResultsCount as any)?.count || 0) + Number((finalRegionalPassedCount as any)?.count || 0),
    grandFinal: Number((gfAssessmentCount as any)?.count || 0) + Number((sponsorCount as any)?.count || 0),
    auditLog: Number((auditLogCount as any)?.count || 0),
    aiCache: Number((aiCacheCount as any)?.count || 0) + Number((formattedTextsCount as any)?.count || 0),
    pdfs: Number((pdfCount as any)?.count || 0),
    duplicates: Number((duplicatesCount as any)?.count || 0),
  };
}
