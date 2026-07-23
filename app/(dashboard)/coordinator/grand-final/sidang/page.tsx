import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { proposals, grandFinalAssessments, users, competitions, finalResults, proposalAiAnalyses } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import GrandFinalSidangClient from './GrandFinalSidangClient';
import { getActiveCompetition } from '@/app/actions/competitions';

export const metadata = {
  title: 'Sidang Penetapan Grand Final - PIA Curation',
};

export default async function GrandFinalSidangPage() {
  await requireRole(['coordinator', 'admin']);

  const activeComp = await getActiveCompetition();
  if (!activeComp) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Sidang Penetapan Grand Final</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">
          Belum ada kompetisi aktif.
        </div>
      </div>
    );
  }

  // Check if locked
  const lockedResultsPromise = db.select().from(finalResults)
    .where(eq(finalResults.competitionId, activeComp.id));
  
  // Get GF proposals
  const gfProposalsPromise = db.select({
    id: proposals.id,
    title: proposals.title,
    proposerName: proposals.proposerName,
    category: proposals.category,
    status: proposals.status,
  }).from(proposals)
    .where(and(
      eq(proposals.competitionId, activeComp.id),
      eq(proposals.status, 'grand_final')
    ));

  // Get AI Analyses for claims
  const aiAnalysesDataPromise = db.select()
    .from(proposalAiAnalyses)
    .where(sql`proposal_id IN (SELECT id FROM proposals WHERE competition_id = ${activeComp.id} AND status = 'grand_final')`);

  // Get assessments
  const assessmentsPromise = db.select().from(grandFinalAssessments)
    .where(eq(grandFinalAssessments.competitionId, activeComp.id));

  // Get all sponsors
  const sponsorUsersPromise = db.select({ id: users.id, name: users.name })
    .from(users).where(sql`'sponsor' = ANY(${users.roles})`);

  const [
    lockedResults,
    gfProposals,
    aiAnalysesData,
    assessments,
    sponsorUsers
  ] = await Promise.all([
    lockedResultsPromise,
    gfProposalsPromise,
    aiAnalysesDataPromise,
    assessmentsPromise,
    sponsorUsersPromise
  ]);

  const isLocked = lockedResults.length > 0;
  const aiAnalysesMap = new Map(aiAnalysesData.map(a => [a.proposalId, a]));

  // Map results if locked
  const resultsMap = new Map(lockedResults.map(r => [r.proposalId, r]));

  // Combine data
  const data = gfProposals.map(p => {
    const pAssessments = assessments.filter(a => a.proposalId === p.id);
    
    // Convert to map for easy lookup in client
    const sponsorScoresMap: Record<number, any> = {};
    pAssessments.forEach(a => {
      sponsorScoresMap[a.sponsorId] = {
        param1: a.param1Score,
        param2: a.param2Score,
        param3: a.param3Score,
        param4: a.param4Score,
        totalScore: a.totalScore,
        classification: a.classification
      };
    });

    const result = resultsMap.get(p.id);
    const aiData = aiAnalysesMap.get(p.id);

    return {
      ...p,
      sponsorScores: sponsorScoresMap,
      lockedMedal: result?.resultStatus || null,
      lockedNote: result?.notes || null,
      aiClaims: (aiData?.keyClaims as string[]) || []
    };
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Sidang Penetapan Grand Final</h1>
          <p className="text-sm text-gray-500">
            Papan kalibrasi dan penetapan hasil akhir Grand Final (Single Operator).
          </p>
        </div>
        {isLocked && (
          <div className="px-4 py-2 bg-green-100 text-green-800 font-bold rounded-lg text-sm border border-green-300">
            ✓ Hasil Sidang Terkunci
          </div>
        )}
      </div>

      <GrandFinalSidangClient 
        competitionId={activeComp.id}
        proposals={data} 
        sponsors={sponsorUsers}
        isLocked={isLocked}
      />
    </div>
  );
}
