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

  if (mySessionIds.length === 0) {
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
        inArray(regionalFinalSessions.id, mySessionIds)
      )
    );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Pantau proposal dan hasil akhir untuk Kanwil/Grup yang menjadi tanggung jawab Anda.</p>
      </div>

      <div className="space-y-6">
        {sessions.map(async (groupSession) => {
          // Fetch finalis (hanya yang statusnya regional_finalist)
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

          // Jika status sudah hasil_terkunci, fetch results
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

          const hasResults = results.length > 0;
          
          // Gabungkan data finalis dengan result jika ada
          const displayList = hasResults 
            ? results.map(r => ({
                ...r,
                proposal: finalists.find(f => f.id === r.proposalId)!
              }))
            : finalists;

          return (
            <div key={groupSession.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Header Grup */}
              <div className="bg-indigo-50/50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded text-white flex items-center justify-center text-xs font-bold ${isPusat ? 'bg-[#0F4C81]' : 'bg-[#059669]'}`}>
                    {isPusat ? 'KP' : 'KW'}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{groupSession.region}</h2>
                    <p className="text-xs text-gray-500">{finalists.length} Finalis Terkurasi</p>
                  </div>
                </div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    groupSession.status === 'hasil_terkunci' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {groupSession.status === 'hasil_terkunci' ? '✅ Hasil Final Terkunci' : '⏳ Sidang Belum Selesai'}
                  </span>
                </div>
              </div>

              {/* Tabel */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-16">No</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Inovasi & Inovator</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Unit Kerja / Kota</th>
                      {hasResults && (
                        <>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">Skor</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">Peringkat</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {displayList.map((item: any, idx: number) => {
                      const proposal = hasResults ? item.proposal : item;
                      if (!proposal) return null; // safety
                      
                      const rank = hasResults ? item.rank : null;
                      const isJuara1 = hasResults && rank === 1;
                      const isJuara2 = hasResults && rank === 2;
                      const isJuara3 = hasResults && rank === 3;

                      let rowBg = 'hover:bg-gray-50';
                      if (isJuara1) rowBg = 'bg-gradient-to-r from-amber-100/90 via-amber-50/40 to-white border-l-4 border-amber-500 shadow-sm';
                      else if (isJuara2) rowBg = 'bg-gradient-to-r from-slate-100 via-slate-50/50 to-white border-l-4 border-slate-400';
                      else if (isJuara3) rowBg = 'bg-gradient-to-r from-orange-100/70 via-amber-50/30 to-white border-l-4 border-amber-600';

                      return (
                        <tr key={proposal.id} className={`${rowBg} transition-colors`}>
                          <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                            {idx + 1}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-gray-900 line-clamp-2" title={proposal.title}>{proposal.title}</div>
                            <div className="text-xs text-gray-500 mt-1">{proposal.proposerName}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{proposal.proposerOrg}</div>
                          </td>
                          {hasResults && (
                            <>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className={`inline-block px-2.5 py-1 rounded text-sm font-extrabold ${
                                  isJuara1 ? 'bg-amber-200/80 text-amber-950 border border-amber-300' :
                                  isJuara2 ? 'bg-slate-200 text-slate-900 border border-slate-300' :
                                  isJuara3 ? 'bg-orange-200/80 text-orange-950 border border-orange-300' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {Number(item.finalScore).toFixed(1)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                {isJuara1 && (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 text-white font-extrabold rounded-full text-xs shadow-sm border border-amber-400">
                                    🥇 Juara 1
                                  </span>
                                )}
                                {isJuara2 && (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-500 text-white font-extrabold rounded-full text-xs shadow-sm border border-slate-400">
                                    🥈 Juara 2
                                  </span>
                                )}
                                {isJuara3 && (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-700 text-white font-extrabold rounded-full text-xs shadow-sm border border-amber-600">
                                    🥉 Juara 3
                                  </span>
                                )}
                                {(!rank || rank > 3) && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 bg-gray-100 text-gray-600 font-medium rounded-full text-xs border border-gray-200">
                                    Finalis #{rank || idx + 1}
                                  </span>
                                )}
                                {item.tieBreakNote && (
                                  <div className="text-[10px] text-amber-900 font-bold mt-1.5 leading-tight border border-amber-300 bg-amber-100/90 rounded px-1.5 py-0.5 block w-fit mx-auto">
                                    ★ Menang Tie-Break
                                  </div>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {displayList.length === 0 && (
                      <tr>
                        <td colSpan={hasResults ? 5 : 3} className="px-6 py-8 text-center text-gray-500">
                          Belum ada finalis yang ditetapkan untuk grup ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
