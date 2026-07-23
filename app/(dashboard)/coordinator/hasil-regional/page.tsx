import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { regionalFinalSessions, regionalFinalJudges, regionalFinalPics, proposals, users, regionalFinalAssessments, regionalFinalResults } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getActiveCompetition } from '@/app/actions/competitions';
import HasilFinalRegionalClient from './HasilFinalRegionalClient';
import { KANWIL_CITIES } from '@/lib/constants';

export const metadata = {
  title: 'Hasil Final Regional - PIA Curation',
};

// Daftar 13 grup canonical sesuai format yang dipakai di regionalFinalSessions.region
const CANONICAL_REGIONS = [
  'Kantor Pusat',
  ...KANWIL_CITIES.map(c => `Kanwil ${c}`),
];

export default async function HasilFinalRegionalPage() {
  await requireRole(['coordinator', 'viewer']);

  const activeComp = await getActiveCompetition();
  if (!activeComp) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Hasil Final Regional</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">
          Belum ada kompetisi aktif.
        </div>
      </div>
    );
  }

  // Get ALL regional final sessions for this competition
  const sessions = await db.select().from(regionalFinalSessions)
    .where(eq(regionalFinalSessions.competitionId, activeComp.id));

  const sessionIds = sessions.map(s => s.id);

  // Fetch judges (only if there are sessions)
  const judgesData = sessionIds.length > 0
    ? await db.select({
        sessionId: regionalFinalJudges.sessionId,
        judgeId: users.id,
        name: users.name,
        isFinalized: regionalFinalJudges.isFinalized,
      })
      .from(regionalFinalJudges)
      .innerJoin(users, eq(users.id, regionalFinalJudges.userId))
      .where(inArray(regionalFinalJudges.sessionId, sessionIds))
    : [];

  // Fetch PICs (only if there are sessions)
  const picsData = sessionIds.length > 0
    ? await db.select({
        sessionId: regionalFinalPics.sessionId,
        picId: users.id,
        name: users.name,
      })
      .from(regionalFinalPics)
      .innerJoin(users, eq(users.id, regionalFinalPics.userId))
      .where(inArray(regionalFinalPics.sessionId, sessionIds))
    : [];

  // Fetch all finalists
  const allFinalists = await db.select().from(proposals).where(
    and(
      eq(proposals.competitionId, activeComp.id),
      eq(proposals.status, 'regional_finalist')
    )
  );

  // Map proposals to their sessions
  const proposalsData = allFinalists.map(p => {
    let mappedRegion = p.category === 'PUSAT' ? 'Kantor Pusat' : `Kanwil ${p.regionCenter}`;
    if (p.category === 'WILAYAH' && ['KP', 'Kantor Pusat'].includes(p.regionCenter || '')) mappedRegion = p.regionCenter!;
    const sess = sessions.find(s => s.region === mappedRegion);
    return { ...p, sessionId: sess?.id };
  }).filter(p => p.sessionId !== undefined);

  // Fetch assessments and results (only if there are sessions)
  const assessmentsData = sessionIds.length > 0
    ? await db.select().from(regionalFinalAssessments)
        .where(inArray(regionalFinalAssessments.sessionId, sessionIds))
    : [];

  const resultsData = sessionIds.length > 0
    ? await db.select().from(regionalFinalResults)
        .where(inArray(regionalFinalResults.sessionId, sessionIds))
    : [];

  // Build a lookup map for existing sessions
  const sessionMap = new Map(sessions.map(s => [s.region, s]));

  // Merge 13 canonical groups with existing sessions
  const formattedSessions = CANONICAL_REGIONS.map(regionLabel => {
    const s = sessionMap.get(regionLabel);

    // Group that hasn't had its finalists locked yet → no session row exists
    if (!s) {
      return {
        id: null as number | null,
        region: regionLabel,
        status: 'belum_ada_sesi' as string,
        juriCountSetting: 0,
        proposals: [] as {
          id: number;
          title: string;
          proposerName: string;
          category: string;
          assessmentCount: number;
          judgeScores?: Record<number, number>;
          finalScore: number;
          rank: number | null;
          isTieBreak: boolean;
        }[],
        judges: [] as { judgeId: number; name: string; isFinalized: boolean }[],
        pics: [] as { picId: number; name: string }[],
        totalAssessments: 0,
      };
    }

    const sProposals = proposalsData.filter(p => p.sessionId === s.id).sort((a, b) => a.id - b.id);
    const sJudges = judgesData.filter(j => j.sessionId === s.id);
    const sPics = picsData.filter(p => p.sessionId === s.id);
    const sAssessments = assessmentsData.filter(a => a.sessionId === s.id);
    const sResults = resultsData.filter(r => r.sessionId === s.id);

    const proposalsSummary = sProposals.map(p => {
      const pAssessments = sAssessments.filter(a => a.proposalId === p.id);
      let finalScore = 0;
      const judgeScores: Record<number, number> = {};
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
        finalScore: pResult?.finalScore ?? finalScore,
        rank: pResult?.rank || null,
        isTieBreak: !!pResult?.tieBreakNote,
      };
    });

    return {
      id: s.id as number | null,
      region: s.region,
      status: s.status,
      juriCountSetting: s.juriCountSetting,
      proposals: proposalsSummary,
      judges: sJudges,
      pics: sPics,
      totalAssessments: sAssessments.length,
    };
  });

  const lockedCount = formattedSessions.filter(s => s.status === 'hasil_terkunci').length;
  const noSessionCount = formattedSessions.filter(s => s.status === 'belum_ada_sesi').length;

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Hasil Final Regional</h1>
        <p className="text-gray-500 text-sm">
          Pantau status dan hasil penilaian Final Regional dari seluruh {CANONICAL_REGIONS.length} grup (Kanwil + Pusat).{' '}
          {lockedCount > 0 && (
            <span className="text-green-700 font-medium">{lockedCount} hasil sudah terkunci.</span>
          )}
          {noSessionCount > 0 && (
            <span className="text-amber-600 font-medium ml-1">{noSessionCount} grup belum memulai sesi.</span>
          )}
          {' '}Halaman ini bersifat read-only.
        </p>
      </div>

      <HasilFinalRegionalClient sessions={formattedSessions} />
    </div>
  );
}
