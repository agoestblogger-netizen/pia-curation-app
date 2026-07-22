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
  grandFinalAssessments
} from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, inArray, and, sql, isNotNull } from 'drizzle-orm';
import { getActiveCompetition } from './competitions';
import { revalidatePath } from 'next/cache';
import { del } from '@vercel/blob';

export type ResetOptions = {
  resetScreening: boolean;
  resetAssignments: boolean;
  resetFgd: boolean;
  resetPromotor: boolean;
  resetRegionalFinal: boolean;
  resetSponsor?: boolean;
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
    // We process deletions starting from the most dependent child tables back to the parents
    
    // 1. FGD Sessions & Votes & Comments
    if (options.resetFgd) {
      const sessions = await db.select({ id: fgdSessions.id }).from(fgdSessions).where(eq(fgdSessions.competitionId, compId));
      const sessionIds = sessions.map(s => s.id);
      
      if (sessionIds.length > 0) {
        await db.delete(fgdVotes).where(inArray(fgdVotes.sessionId, sessionIds));
        await db.delete(fgdComments).where(inArray(fgdComments.sessionId, sessionIds));
        await db.delete(fgdSessions).where(inArray(fgdSessions.id, sessionIds));
      }
      executedActions.push('Sesi FGD');
    }

    // 2. Pemilihan Promotor
    if (options.resetPromotor) {
      const compProposals = await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.competitionId, compId));
      const compProposalIds = compProposals.map(p => p.id);
      
      if (compProposalIds.length > 0) {
        await db.delete(promoterSelections).where(inArray(promoterSelections.proposalId, compProposalIds));
        await db.delete(promoterAssignments).where(inArray(promoterAssignments.proposalId, compProposalIds));
        
        // Revert status
        const promotorStatuses = ['promotor_selection', 'promotor_passed', 'promotor_rejected', 'grand_finalist'];
        await db.update(proposals)
          .set({ status: 'regional_finalist' })
          .where(
            and(
              eq(proposals.competitionId, compId),
              inArray(proposals.status, promotorStatuses)
            )
          );
      }
      executedActions.push('Pemilihan Promotor');
    }

    // 3. Finalisasi Regional & Grand Final
    if (options.resetRegionalFinal) {
      await db.delete(grandFinalSelections).where(eq(grandFinalSelections.competitionId, compId));
      await db.update(proposals)
        .set({ 
          regionalFinalistRank: null,
          regionalFinalizedAt: null,
          regionalFinalizedBy: null,
          status: 'curation_passed'
        })
        .where(
          and(
            eq(proposals.competitionId, compId),
            inArray(proposals.status, ['regional_finalist', 'promotor_selection', 'promotor_passed', 'promotor_rejected', 'grand_finalist'])
          )
        );
      executedActions.push('Finalisasi Regional & Grand Final');
    }

    // Penilaian Sponsor & Hasil Akhir
    if (options.resetSponsor) {
      await db.delete(grandFinalAssessments).where(eq(grandFinalAssessments.competitionId, compId));
      await db.delete(sponsorScores).where(eq(sponsorScores.competitionId, compId));
      await db.delete(scoringSnapshots).where(eq(scoringSnapshots.competitionId, compId));
      await db.delete(finalResults).where(eq(finalResults.competitionId, compId));
      
      // Optionally reset status from winner | selected back to grand_finalist
      await db.update(proposals)
        .set({ status: 'grand_finalist' })
        .where(
          and(
            eq(proposals.competitionId, compId),
            inArray(proposals.status, ['winner', 'selected'])
          )
        );
      executedActions.push('Penilaian Sponsor & Hasil Akhir');
    }

    // 4. Hasil Screening (and reset to assigned/imported)
    if (options.resetScreening) {
      const compProposals = await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.competitionId, compId));
      const compProposalIds = compProposals.map(p => p.id);
      
      if (compProposalIds.length > 0) {
        await db.delete(screeningResults).where(inArray(screeningResults.proposalId, compProposalIds));
        
        // Determine which to set 'assigned' vs 'imported' based on curatorAssignments
        // Easiest is to set ALL to imported first, then set to assigned if they exist in curatorAssignments
        await db.update(proposals)
          .set({ status: 'imported' })
          .where(eq(proposals.competitionId, compId));
          
        // Find proposals that are assigned
        const assigned = await db.select({ proposalId: curatorAssignments.proposalId })
          .from(curatorAssignments)
          .innerJoin(curationBatches, eq(curationBatches.id, curatorAssignments.batchId))
          .where(eq(curationBatches.competitionId, compId));
          
        const assignedIds = assigned.map(a => a.proposalId);
        
        if (assignedIds.length > 0) {
          await db.update(proposals)
            .set({ status: 'assigned' })
            .where(inArray(proposals.id, assignedIds));
        }
      }
      executedActions.push('Hasil Screening');
    }

    // 5. Assignment Kurator
    if (options.resetAssignments) {
      const batches = await db.select({ id: curationBatches.id }).from(curationBatches).where(eq(curationBatches.competitionId, compId));
      const batchIds = batches.map(b => b.id);
      
      if (batchIds.length > 0) {
        await db.delete(curatorAssignments).where(inArray(curatorAssignments.batchId, batchIds));
        await db.delete(curationBatches).where(inArray(curationBatches.id, batchIds));
        
        // Reset status to imported (if not already handled by resetScreening)
        // Only reset if they were assigned or above
        await db.update(proposals)
          .set({ status: 'imported' })
          .where(eq(proposals.competitionId, compId));
      }
      executedActions.push('Assignment Kurator');
    }

    // 6. Audit Logs
    if (options.resetAuditLog) {
      // Clean only logs related to this competition? (Audit logs use generic entityId, mostly competitionId is saved there)
      // Our audit log implementation uses the entityId string. For competition-level logs, it might be the comp ID.
      // Easiest is to just wipe the whole table since it's a testing environment, OR just wipe the ones that parse back to this competition.
      // Let's just wipe all since this is a global testing reset.
      await db.delete(auditLogs);
      executedActions.push('Audit Log');
    }

    // 7. Cache Analisis AI
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

    // 8. Dokumen Tambahan PDF
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

    // 9. Potensi Duplikat
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

    // Create a new audit log for the reset action itself
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
    WHERE p.competition_id = ${compId}
  `);

  const [assignmentCount] = await db.execute(sql`
    SELECT count(*) FROM curator_assignments ca
    JOIN curation_batches cb ON cb.id = ca.batch_id
    WHERE cb.competition_id = ${compId}
  `);

  const [fgdSessionCount] = await db.execute(sql`
    SELECT count(*) FROM fgd_sessions WHERE competition_id = ${compId}
  `);

  const [promotorCount] = await db.execute(sql`
    SELECT count(*) FROM promoter_selections ps
    JOIN proposals p ON p.id = ps.proposal_id
    WHERE p.competition_id = ${compId}
  `);

  const [regionalFinalCount] = await db.execute(sql`
    SELECT count(*) FROM proposals 
    WHERE competition_id = ${compId} AND status IN ('regional_finalist', 'promotor_selection', 'promotor_passed', 'promotor_rejected', 'grand_finalist')
  `);

  const [auditLogCount] = await db.execute(sql`
    SELECT count(*) FROM audit_logs
  `);

  const [sponsorCount] = await db.execute(sql`
    SELECT count(*) FROM sponsor_scores WHERE competition_id = ${compId}
  `);

  const [gfAssessmentCount] = await db.execute(sql`
    SELECT count(*) FROM grand_final_assessments WHERE competition_id = ${compId}
  `);

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
    screening: Number((screeningCount as any)?.count || 0),
    assignment: Number((assignmentCount as any)?.count || 0),
    fgdSession: Number((fgdSessionCount as any)?.count || 0),
    promotor: Number((promotorCount as any)?.count || 0),
    regionalFinal: Number((regionalFinalCount as any)?.count || 0),
    sponsor: Number((sponsorCount as any)?.count || 0),
    gfAssessments: Number((gfAssessmentCount as any)?.count || 0),
    auditLog: Number((auditLogCount as any)?.count || 0),
    aiCache: Number((aiCacheCount as any)?.count || 0) + Number((formattedTextsCount as any)?.count || 0),
    pdfs: Number((pdfCount as any)?.count || 0),
    duplicates: Number((duplicatesCount as any)?.count || 0),
  };
}
