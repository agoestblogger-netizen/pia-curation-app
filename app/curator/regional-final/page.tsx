import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { regionalFinalSessions, regionalFinalPics, proposals, regionalFinalJudges, users, regionalFinalAssessments, regionalFinalResults } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getActiveCompetition } from '@/app/actions/competitions';
import CuratorRegionalFinalClient from './CuratorRegionalFinalClient';

export const metadata = {
  title: 'Setup Final Regional - PIA Curation',
};

export default async function CuratorRegionalFinalPage() {
  const session = await requireRole(['curator', 'regional', 'coordinator']);
  
  const activeComp = await getActiveCompetition();
  if (!activeComp) {
    return <div className="p-8">Tidak ada kompetisi aktif.</div>;
  }

  // Get all regional sessions this user is PIC for.
  const myPicSessions = await db.select({
    sessionId: regionalFinalPics.sessionId
  })
  .from(regionalFinalPics)
  .where(eq(regionalFinalPics.userId, session.userId));
  
  const mySessionIds = myPicSessions.map(p => p.sessionId);

  if (mySessionIds.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Setup Final Regional</h1>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          Anda tidak terdaftar sebagai PIC Regional untuk grup final regional manapun pada kompetisi ini.
        </div>
      </div>
    );
  }

  const sessions = await db.select().from(regionalFinalSessions)
    .where(
      and(
        eq(regionalFinalSessions.competitionId, activeComp.id),
        inArray(regionalFinalSessions.id, mySessionIds)
      )
    );

  const sessionIds = sessions.map(s => s.id);
  
  let judgesData: any[] = [];
  let proposalsData: any[] = [];
  let assessmentsData: any[] = [];
  let resultsData: any[] = [];
  
  if (sessionIds.length > 0) {
    judgesData = await db.select({
      sessionId: regionalFinalJudges.sessionId,
      judgeId: users.id,
      name: users.name,
      isFinalized: regionalFinalJudges.isFinalized
    })
    .from(regionalFinalJudges)
    .innerJoin(users, eq(users.id, regionalFinalJudges.userId))
    .where(inArray(regionalFinalJudges.sessionId, sessionIds));

    // For proposals, fetch all finalists in these regions
    // We can fetch directly using proposals table
    const allFinalists = await db.select().from(proposals).where(
      and(
        eq(proposals.competitionId, activeComp.id),
        eq(proposals.status, 'regional_finalist')
      )
    );
    
    // Group proposals by session
    proposalsData = allFinalists.map(p => {
      let mappedRegion = p.category === 'PUSAT' ? 'Kantor Pusat' : `Kanwil ${p.regionCenter}`;
      if (p.category === 'WILAYAH' && ['KP', 'Kantor Pusat'].includes(p.regionCenter || '')) mappedRegion = p.regionCenter!;
      
      const sess = sessions.find(s => s.region === mappedRegion);
      return {
        ...p,
        sessionId: sess?.id
      };
    }).filter(p => p.sessionId !== undefined);

    assessmentsData = await db.select().from(regionalFinalAssessments)
      .where(inArray(regionalFinalAssessments.sessionId, sessionIds));
      
    resultsData = await db.select().from(regionalFinalResults)
      .where(inArray(regionalFinalResults.sessionId, sessionIds));
  }
  
  // Format data for client
  const formattedSessions = sessions.map(s => {
    const sProposals = proposalsData.filter(p => p.sessionId === s.id).sort((a, b) => a.id - b.id);
    const sJudges = judgesData.filter(j => j.sessionId === s.id);
    const sAssessments = assessmentsData.filter(a => a.sessionId === s.id);
    const sResults = resultsData.filter(r => r.sessionId === s.id);
    
    // calculate summary per proposal
    const proposalsSummary = sProposals.map(p => {
      const pAssessments = sAssessments.filter(a => a.proposalId === p.id);
      
      const judgeScores: Record<number, number> = {};
      let finalScore = 0;
      if (pAssessments.length > 0) {
        const sum = pAssessments.reduce((acc, curr) => {
          const score = (curr.paramProblemFit + curr.paramDampak + curr.paramKelayakan + curr.paramProfessional) / 4;
          judgeScores[curr.judgeUserId] = score;
          return acc + score;
        }, 0);
        finalScore = sum / pAssessments.length;
      }
      
      const pResult = sResults.find(r => r.proposalId === p.id);
      
      return {
        id: p.id,
        title: p.title,
        proposerName: p.proposerName,
        category: p.category,
        assessmentCount: pAssessments.length,
        judgeScores,
        finalScore,
        rank: pResult?.rank || null,
        isTieBreak: !!pResult?.tieBreakNote,
      };
    });
    
    return {
      ...s,
      judges: sJudges,
      proposals: proposalsSummary,
      totalAssessments: sAssessments.length,
    };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Setup Final Regional</h1>
      <p className="text-gray-600">Anda adalah PIC untuk grup-grup di bawah ini. Kelola status penilaian dan hasil sidang penetapan.</p>
      
      <CuratorRegionalFinalClient sessions={formattedSessions} />
    </div>
  );
}
