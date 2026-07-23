import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './lib/db/index';
import { eq, inArray, and } from 'drizzle-orm';
import { 
  proposals, curatorAssignments, screeningResults, fgdSessions, fgdVotes, fgdComments,
  promoterAssignments, promoterSelections, curationBatches, auditLogs, sponsorScores, scoringSnapshots,
  finalResults, proposalAiAnalyses, fgdAdditionalDocuments, potentialDuplicates, grandFinalSelections,
  grandFinalAssessments, regionalFinalSessions, regionalFinalPics, regionalFinalJudges,
  regionalFinalAssessments, regionalFinalResults, competitions
} from './lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  const compId = 1; 

  const options = {
    resetKurasiNasional: true,
    resetRegionalLock: true,
    resetKelolaPicJuri: true,
    resetPenilaianHasil: true,
    resetGrandFinal: true,
    resetAuditLog: true,
    resetAiCache: true,
    resetPdfs: true,
    resetDuplicates: true
  };

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
        await db.delete(curatorAssignments).where(inArray(curatorAssignments.batchId, batchIds));
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
              inArray(proposals.status, kurasiStatuses as any)
            )
          );
      }
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
    }

    // 3A. Reset Kelola Regional — Hapus assignment PIC & Juri
    if (options.resetKelolaPicJuri) {
      const regSessions = await db
        .select({ id: regionalFinalSessions.id })
        .from(regionalFinalSessions)
        .where(eq(regionalFinalSessions.competitionId, compId));
      const regSessionIds = regSessions.map(s => s.id);

      if (regSessionIds.length > 0) {
        await db.delete(regionalFinalPics).where(inArray(regionalFinalPics.sessionId, regSessionIds));
        await db.delete(regionalFinalJudges).where(inArray(regionalFinalJudges.sessionId, regSessionIds));

        await db.update(regionalFinalSessions)
          .set({ status: 'finalis_terkunci' })
          .where(inArray(regionalFinalSessions.id, regSessionIds));
      }
    }

    // 3B. Reset Penilaian & Hasil — Hapus assessment & hasil ranking
    if (options.resetPenilaianHasil) {
      const regSessions = await db
        .select({ id: regionalFinalSessions.id })
        .from(regionalFinalSessions)
        .where(eq(regionalFinalSessions.competitionId, compId));
      const regSessionIds = regSessions.map(s => s.id);

      if (regSessionIds.length > 0) {
        await db.delete(regionalFinalResults).where(inArray(regionalFinalResults.sessionId, regSessionIds));
        await db.delete(regionalFinalAssessments).where(inArray(regionalFinalAssessments.sessionId, regSessionIds));

        await db.update(regionalFinalSessions)
          .set({ status: 'juri_ditugaskan' })
          .where(
            and(
              inArray(regionalFinalSessions.id, regSessionIds),
              inArray(regionalFinalSessions.status, ['penilaian_dibuka', 'penilaian_selesai', 'sidang_penetapan', 'hasil_terkunci'] as any)
            )
          );
      }

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
            inArray(proposals.status, ['winner', 'selected'] as any)
          )
        );
    }

    console.log("All reset commands executed successfully without errors.");
  } catch (err: any) {
    console.error("Simulation failed:", err.message);
  }
}
main();
