import { getSession } from '@/lib/auth/session';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getFinalResults, getRankedProposals, getLatestScoringSnapshot } from '@/app/actions/finalization';
import { finalLockAction, setFinalResultAction } from '@/app/actions/finalization';
import Link from 'next/link';

export default async function RankingTab() {
  const session = await getSession();

  if (!session || !session.roles.includes('coordinator')) {
    return <div className="p-8 text-red-500">Unauthorized</div>;
  }

  const activeComp = await getActiveCompetition();

  if (!activeComp || (activeComp.phase !== 'finalization' && activeComp.phase !== 'closed')) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Finalisasi & Penetapan Pemenang</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md">
          {activeComp
            ? `Tahap finalisasi belum dibuka (Saat ini: ${activeComp.phase}).`
            : 'Belum ada kompetisi aktif.'}
        </div>
      </div>
    );
  }

  const rankedProposals = await getRankedProposals(activeComp.id);
  const finalResults = await getFinalResults(activeComp.id);
  const snapshot = await getLatestScoringSnapshot(activeComp.id);
  const isLocked = activeComp.phase === 'closed';

  const snapshotData = snapshot?.snapshotJson as Array<{
    proposalId: number;
    title: string;
    totalScore: number;
    avgScore: number;
    raterCount: number;
    rank: number;
  }> | null;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Finalisasi & Penetapan Pemenang</h1>
          <p className="text-gray-600 text-sm">
            Status: <span className={`font-semibold ${isLocked ? 'text-red-600' : 'text-green-600'}`}>
              {isLocked ? 'DIKUNCI (FINAL)' : 'Dapat Diubah'}
            </span>
          </p>
        </div>
        {!isLocked && (
          <form action={async (formData) => {
            'use server';
            const code = formData.get('confirmCode') as string;
            await finalLockAction(activeComp.id, code);
          }} className="flex items-center gap-3">
            <input
              name="confirmCode"
              type="text"
              placeholder="Ketik: KONFIRMASI_FINAL"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm w-56"
            />
            <button
              type="submit"
              className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 text-sm font-medium"
            >
              Kunci Hasil (Final)
            </button>
          </form>
        )}
      </div>

      {/* Ranking dari scoring snapshot */}
      {snapshotData && snapshotData.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-bold mb-4">Ranking Berdasarkan Penilaian Sponsor</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Judul Proposal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rata-rata Nilai</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jumlah Penilai</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tetapkan Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {snapshotData.map((item) => {
                  const existingResult = finalResults.find(r => r.proposalId === item.proposalId);
                  return (
                    <tr key={item.proposalId} className={existingResult ? 'bg-green-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                          item.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                          item.rank === 2 ? 'bg-gray-300 text-gray-700' :
                          item.rank === 3 ? 'bg-amber-600 text-white' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {item.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-semibold">{item.avgScore}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.raterCount} penilai</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {isLocked ? (
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            existingResult?.resultStatus === 'winner' ? 'bg-yellow-100 text-yellow-800' :
                            existingResult?.resultStatus === 'selected' ? 'bg-green-100 text-green-800' :
                            existingResult?.resultStatus === 'reserve' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {existingResult?.resultStatus ?? '-'}
                          </span>
                        ) : (
                          <form action={async (fd) => { 'use server'; await setFinalResultAction({} as any, fd); }} className="flex items-center justify-end gap-2">
                            <input type="hidden" name="proposalId" value={item.proposalId} />
                            <input type="hidden" name="competitionId" value={activeComp.id} />
                            <input type="hidden" name="rank" value={item.rank} />
                            <select name="resultStatus" defaultValue={existingResult?.resultStatus ?? ''} className="text-xs border border-gray-300 rounded px-2 py-1">
                              <option value="">-- Pilih --</option>
                              <option value="winner">Winner</option>
                              <option value="selected">Selected</option>
                              <option value="reserve">Reserve</option>
                              <option value="not_selected">Not Selected</option>
                            </select>
                            <button type="submit" className="bg-indigo-600 text-white text-xs px-3 py-1 rounded hover:bg-indigo-700">
                              Tetapkan
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!snapshotData || snapshotData.length === 0 && (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md">
          Belum ada data scoring. Kunci hasil penilaian Sponsor terlebih dahulu.
        </div>
      )}

      <div className="mt-8 flex gap-4">
        <a
          href="/api/pdf/final-results"
          target="_blank"
          className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 text-sm font-medium"
        >
          Export Hasil Akhir (PDF)
        </a>
        <a
          href="/api/pdf/proposals"
          target="_blank"
          className="bg-gray-600 text-white px-4 py-2 rounded shadow hover:bg-gray-700 text-sm font-medium"
        >
          Export Semua Proposal (PDF)
        </a>
      </div>
    </div>
  );
}
