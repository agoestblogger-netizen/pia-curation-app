import { requireRole } from '@/lib/auth/helpers';
import { getActiveCompetition } from '@/app/actions/competitions';
import { db } from '@/lib/db';
import { 
  proposals, 
  regionalFinalSessions, 
  regionalFinalJudges, 
  regionalFinalPics,
  regionalFinalResults 
} from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import RegionalDashboardClient from './RegionalDashboardClient';

export const metadata = {
  title: 'Dashboard - PIA Curation',
};

export default async function RegionalDashboardPage() {
  const session = await requireRole('regional');
  const activeComp = await getActiveCompetition();

  if (!activeComp) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Dashboard</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">
          Belum ada kompetisi aktif.
        </div>
      </div>
    );
  }

  // 1. Temukan sesi di mana user menjadi PIC atau Juri
  const isSuperPic = session.roles.includes('admin') && session.roles.includes('regional');

  const picSessions = await db
    .select({ sessionId: regionalFinalPics.sessionId })
    .from(regionalFinalPics)
    .where(eq(regionalFinalPics.userId, session.userId));

  const judgeSessions = await db
    .select({ sessionId: regionalFinalJudges.sessionId })
    .from(regionalFinalJudges)
    .where(eq(regionalFinalJudges.userId, session.userId));

  const mySessionIds = Array.from(new Set([
    ...picSessions.map(s => s.sessionId),
    ...judgeSessions.map(s => s.sessionId)
  ]));

  if (!isSuperPic && mySessionIds.length === 0) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Dashboard</h1>
        <div className="bg-white border shadow-sm p-6 rounded-xl">
          <p className="text-gray-600 mb-2">Anda belum ditugaskan sebagai PIC atau Juri untuk grup regional mana pun pada kompetisi ini.</p>
          <p className="text-sm text-gray-500">Tunggu hingga Koordinator menugaskan Anda ke dalam grup Kanwil/Pusat.</p>
        </div>
      </div>
    );
  }

  // 2. Fetch sesi
  const sessions = await db
    .select()
    .from(regionalFinalSessions)
    .where(
      and(
        eq(regionalFinalSessions.competitionId, activeComp.id),
        isSuperPic ? undefined : inArray(regionalFinalSessions.id, mySessionIds)
      )
    );

  const finalistsMap: { [key: number]: any[] } = {};
  const resultsMap: { [key: number]: any[] } = {};

  for (const groupSession of sessions) {
    const isPusat = groupSession.region === 'Kantor Pusat';
    const dbRegion = groupSession.region.replace(/^Kanwil /, '');
    
    const finalists = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        proposerName: proposals.proposerName,
        proposerOrg: proposals.proposerOrg,
      })
      .from(proposals)
      .where(
        and(
          eq(proposals.competitionId, activeComp.id),
          isPusat
            ? eq(proposals.category, 'PUSAT')
            : and(eq(proposals.category, 'WILAYAH'), eq(proposals.regionCenter, dbRegion)),
          eq(proposals.status, 'regional_finalist')
        )
      );

    finalistsMap[groupSession.id] = finalists;

    let results: any[] = [];
    if (groupSession.status === 'hasil_terkunci') {
      results = await db
        .select({
          proposalId: regionalFinalResults.proposalId,
          finalScore: regionalFinalResults.finalScore,
          rank: regionalFinalResults.rank,
          tieBreakNote: regionalFinalResults.tieBreakNote,
        })
        .from(regionalFinalResults)
        .where(eq(regionalFinalResults.sessionId, groupSession.id))
        .orderBy(
          sql`${regionalFinalResults.rank} ASC NULLS LAST`,
          sql`${regionalFinalResults.finalScore} DESC`
        );
    }
    resultsMap[groupSession.id] = results;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 text-left">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Pantau proposal dan hasil akhir untuk Kanwil/Grup yang menjadi tanggung jawab Anda.</p>
      </div>

      <RegionalDashboardClient 
        sessions={sessions}
        finalistsMap={finalistsMap}
        resultsMap={resultsMap}
      />
    </div>
  );
}
