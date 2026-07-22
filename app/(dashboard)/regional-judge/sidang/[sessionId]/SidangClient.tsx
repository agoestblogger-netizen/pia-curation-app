'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calibrateSidangScoreAction, finalizeSidangSessionAction } from '@/app/actions/regional-final-judging';

export default function SidangClient({
  sessionId,
  currentUserId,
  isOperatorPic,
  isSessionFinalized,
  sessionStatus,
  judgesList,
  proposalStats
}: {
  sessionId: number;
  currentUserId: number;
  isOperatorPic: boolean;
  isSessionFinalized: boolean;
  sessionStatus: string;
  judgesList: { id: number; name: string; isFinalized: boolean }[];
  proposalStats: any[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState('');

  // Editing state for modal
  const [editingCell, setEditingCell] = useState<{
    proposalId: number;
    proposalTitle: string;
    targetJudgeUserId: number;
    judgeName: string;
  } | null>(null);

  const [editScores, setEditScores] = useState<{
    problemFit: number;
    dampak: number;
    kelayakan: number;
    professional: number;
  }>({
    problemFit: 80,
    dampak: 80,
    kelayakan: 80,
    professional: 80
  });

  const isLocked = sessionStatus === 'hasil_terkunci' || isSessionFinalized;

  // Exact Tie Detection ONLY (Exact identical scores: scoreA === scoreB)
  type ExactTieGroup = {
    score: number;
    scoreFormatted: string;
    proposals: Array<{ index: number; rank: number; title: string }>;
    isPodiumTie: boolean; // true if tie involves rank 3 or rank 4
  };

  const exactTieGroups: ExactTieGroup[] = [];
  const exactTieRanks = new Set<number>();
  let hasPodiumTie = false;

  const scoreMap = new Map<string, Array<{ index: number; rank: number; title: string }>>();

  proposalStats.forEach((p, idx) => {
    if (p.avgScore > 0) {
      const formattedScore = p.avgScore.toFixed(2);
      if (!scoreMap.has(formattedScore)) {
        scoreMap.set(formattedScore, []);
      }
      scoreMap.get(formattedScore)!.push({
        index: idx,
        rank: idx + 1,
        title: p.title
      });
    }
  });

  scoreMap.forEach((items, scoreStr) => {
    if (items.length > 1) {
      const isPodiumTie = items.some(item => item.rank === 3 || item.rank === 4);
      if (isPodiumTie) hasPodiumTie = true;

      items.forEach(item => exactTieRanks.add(item.index));

      exactTieGroups.push({
        score: parseFloat(scoreStr),
        scoreFormatted: scoreStr,
        proposals: items,
        isPodiumTie
      });
    }
  });

  // Sort exactTieGroups so podium ties (#3 vs #4) are listed FIRST!
  exactTieGroups.sort((a, b) => {
    if (a.isPodiumTie) return -1;
    if (b.isPodiumTie) return 1;
    return a.proposals[0].rank - b.proposals[0].rank;
  });

  const openCalibrationModal = (
    proposalId: number,
    proposalTitle: string,
    targetJudgeUserId: number,
    judgeName: string,
    currentScores: { problemFit: number; dampak: number; kelayakan: number; professional: number } | null
  ) => {
    if (isLocked) return;
    setEditingCell({ proposalId, proposalTitle, targetJudgeUserId, judgeName });
    setEditScores(
      currentScores || { problemFit: 75, dampak: 75, kelayakan: 75, professional: 75 }
    );
    setErrorMsg('');
  };

  const handleSaveCalibration = () => {
    if (!editingCell) return;
    setErrorMsg('');
    startTransition(async () => {
      const res = await calibrateSidangScoreAction(
        sessionId,
        editingCell.proposalId,
        editingCell.targetJudgeUserId,
        editScores
      );

      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setEditingCell(null);
        router.refresh();
      }
    });
  };

  const handleFinalizeSession = () => {
    if (!confirm('Apakah Anda yakin ingin menetapkan hasil sidang ini?\n\nSemua skor Juri pada grup ini akan dikunci dan tidak dapat diubah lagi.')) return;
    
    setErrorMsg('');
    startTransition(async () => {
      const res = await finalizeSidangSessionAction(sessionId);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const editAvg = (editScores.problemFit + editScores.dampak + editScores.kelayakan + editScores.professional) / 4;

  return (
    <div className="space-y-8">
      {/* Header Info Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Status Juri & Sidang</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {judgesList.map(j => (
              <span key={j.id} className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
                j.isFinalized ? 'bg-green-50 text-green-800 border-green-200' : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${j.isFinalized ? 'bg-green-500' : 'bg-amber-500'}`} />
                {j.name} {j.id === currentUserId && '(Anda)'}
                {j.isFinalized ? '✓ Final' : 'Belum Final'}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isLocked ? (
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-lg text-sm flex items-center gap-1.5">
                <span>✅ Hasil Sidang Ditetapkan</span>
              </div>
              <a 
                href={`/api/pdf/regional-final?sessionId=${sessionId}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm inline-flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <span>Berita Acara</span>
              </a>
            </div>
          ) : (
            <button 
              onClick={handleFinalizeSession}
              disabled={isPending}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-sm transition-all flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>🔒 Tetapkan Hasil Sidang</span>
                </>
              )}
            </button>
          )}

          {isOperatorPic && isLocked && (
            <Link
              href="/curator/regional-final"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors shadow-sm"
            >
              Lanjut ke Kunci Ranking →
            </Link>
          )}
        </div>
      </div>

      {exactTieGroups.length > 0 && (
        <div className="bg-white rounded-xl border border-rose-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-rose-950 font-bold text-base border-b border-rose-100 pb-2.5">
            <span className="text-xl">🚨</span>
            <span>Terdeteksi {exactTieGroups.length} Kelompok Proposal dengan Skor Identik (Exact Tie)</span>
          </div>

          <div className="space-y-2">
            {exactTieGroups.map((group, idx) => (
              <div 
                key={idx}
                className={`p-3.5 rounded-lg flex flex-col gap-2 text-xs md:text-sm border ${
                  group.isPodiumTie
                    ? 'bg-rose-50 text-rose-950 border-rose-300 ring-1 ring-rose-300 shadow-xs'
                    : 'bg-amber-50 text-amber-950 border-amber-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {group.isPodiumTie ? (
                      <span className="px-2.5 py-0.5 bg-rose-600 text-white font-extrabold rounded-full text-[11px] uppercase tracking-wider flex items-center gap-1 shadow-xs">
                        🚨 Batas Krusial Podium (Juara 3 vs Rank 4)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-amber-200 text-amber-950 font-bold rounded text-[11px]">
                        Skor Identik
                      </span>
                    )}
                    <span className="font-extrabold text-gray-900">
                      Skor Akhir: {group.scoreFormatted}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-gray-500">
                    {group.proposals.length} Proposal Seri
                  </span>
                </div>

                <div className="space-y-1 pl-2 border-l-2 border-rose-300/60">
                  {group.proposals.map(p => (
                    <div key={p.rank} className="text-gray-800 font-medium flex items-center gap-2">
                      <span className="font-bold text-gray-500 min-w-[75px]">Peringkat #{p.rank}:</span>
                      <span className="truncate">{p.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-rose-900 font-medium italic pt-1">
            💡 Urutan proposal dengan skor identik di atas perlu disepakati secara manual dalam Sidang sebelum mengeksekusi <strong>"Tetapkan Hasil Sidang"</strong>.
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium text-sm">
          {errorMsg}
        </div>
      )}

      {/* Tabel Kalibrasi Nilai */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Tabel Kalibrasi Skor 4 Parameter per Juri</h2>
            <p className="text-sm text-gray-500 mt-1">
              Klik pada sel skor Juri mana saja untuk mengedit rincian 4 parameter (Problem Fit, Dampak, Kelayakan, Professionalism). Setiap perubahan dicatat ke Audit Log.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-12">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[240px]">Proposal & Inovator</th>
                {judgesList.map(j => (
                  <th key={j.id} className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-l border-gray-200 min-w-[170px]">
                    <div>{j.name}</div>
                    <div className="text-[10px] text-gray-400 font-normal mt-0.5">(PF / DP / KL / PR)</div>
                  </th>
                ))}
                <th className="px-6 py-3 text-center text-xs font-extrabold text-indigo-900 uppercase tracking-wider bg-indigo-50 border-l border-indigo-200 w-32">
                  Rata-Rata Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {proposalStats.map((p, index) => {
                const isExactTieRow = exactTieRanks.has(index);
                const isPodiumTieRow = (index === 2 || index === 3) && hasPodiumTie;

                const isJuara1 = isLocked && index === 0;
                const isJuara2 = isLocked && index === 1;
                const isJuara3 = isLocked && index === 2;

                let rowStyle = 'hover:bg-gray-50/80';
                if (isJuara1) rowStyle = 'bg-gradient-to-r from-amber-100/90 via-amber-50/40 to-white border-l-4 border-amber-500';
                else if (isJuara2) rowStyle = 'bg-gradient-to-r from-slate-100 via-slate-50/50 to-white border-l-4 border-slate-400';
                else if (isJuara3) rowStyle = 'bg-gradient-to-r from-orange-100/70 via-amber-50/30 to-white border-l-4 border-amber-600';
                else if (isPodiumTieRow) rowStyle = 'bg-rose-50/80 border-l-4 border-rose-500';
                else if (isExactTieRow) rowStyle = 'bg-amber-50/60 border-l-4 border-amber-400';

                return (
                  <tr key={p.id} className={`${rowStyle} transition-colors`}>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      {isJuara1 ? (
                        <span className="font-extrabold text-amber-700 bg-amber-200/80 px-2 py-0.5 rounded text-xs">🥇 1</span>
                      ) : isJuara2 ? (
                        <span className="font-extrabold text-slate-700 bg-slate-200 px-2 py-0.5 rounded text-xs">🥈 2</span>
                      ) : isJuara3 ? (
                        <span className="font-extrabold text-orange-800 bg-orange-200/80 px-2 py-0.5 rounded text-xs">🥉 3</span>
                      ) : (
                        <span className="font-bold text-gray-700">#{index + 1}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 line-clamp-2" title={p.title}>{p.title}</div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{p.proposerName} ({p.proposerOrg || p.category})</span>
                        {isPodiumTieRow && !isLocked && (
                          <span className="px-2 py-0.5 text-[10px] bg-rose-100 text-rose-800 border border-rose-200 font-bold rounded-full">
                            🚨 Exact Tie (Batas Podium)
                          </span>
                        )}
                        {isExactTieRow && !isPodiumTieRow && !isLocked && (
                          <span className="px-2 py-0.5 text-[10px] bg-amber-100 text-amber-800 border border-amber-200 font-semibold rounded-full">
                            ⚠️ Skor Identik
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Judge Columns */}
                    {judgesList.map(j => {
                      const js = p.judgeScores[j.id];

                      return (
                        <td key={j.id} className="px-4 py-4 text-center border-l border-gray-100 whitespace-nowrap">
                          {js ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-sm text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded border border-gray-200">
                                {js.avgScore.toFixed(1)}
                              </span>
                              <div className="text-[10px] text-gray-500 font-medium tracking-tight">
                                {js.problemFit} / {js.dampak} / {js.kelayakan} / {js.professional}
                              </div>
                              {!isLocked && (
                                <button
                                  onClick={() => openCalibrationModal(p.id, p.title, j.id, j.name, js)}
                                  className="text-[11px] text-indigo-600 font-semibold hover:text-indigo-800 hover:underline mt-0.5"
                                >
                                  ✎ Kalibrasi
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-gray-300 font-medium text-sm">-</span>
                              {!isLocked && (
                                <button
                                  onClick={() => openCalibrationModal(p.id, p.title, j.id, j.name, null)}
                                  className="text-[11px] text-orange-600 font-bold hover:text-orange-800 hover:underline"
                                >
                                  + Isi Skor
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Overall Average */}
                    <td className="px-6 py-4 text-center font-extrabold text-base text-indigo-900 bg-indigo-50/50 border-l border-indigo-200 whitespace-nowrap">
                      {p.avgScore > 0 ? (
                        <span className="px-2.5 py-1 bg-indigo-100 rounded text-indigo-950">
                          {p.avgScore.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-normal text-sm">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Kalibrasi Skor 4 Parameter */}
      {editingCell && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-100">
            <div className="bg-indigo-900 text-white p-5 flex justify-between items-start">
              <div>
                <span className="text-xs uppercase font-bold text-indigo-300 tracking-wider">Kalibrasi Skor Sidang</span>
                <h3 className="text-lg font-bold mt-0.5">Juri: {editingCell.judgeName}</h3>
                <p className="text-xs text-indigo-200 mt-1 line-clamp-1" title={editingCell.proposalTitle}>
                  Proposal: {editingCell.proposalTitle}
                </p>
              </div>
              <button
                onClick={() => setEditingCell(null)}
                className="text-indigo-200 hover:text-white text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">1. Problem Fit (0-100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editScores.problemFit}
                    onChange={(e) => setEditScores({ ...editScores, problemFit: Number(e.target.value) })}
                    className="w-full p-2.5 border rounded-lg font-bold text-center text-gray-900 border-gray-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">2. Dampak (0-100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editScores.dampak}
                    onChange={(e) => setEditScores({ ...editScores, dampak: Number(e.target.value) })}
                    className="w-full p-2.5 border rounded-lg font-bold text-center text-gray-900 border-gray-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">3. Kelayakan (0-100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editScores.kelayakan}
                    onChange={(e) => setEditScores({ ...editScores, kelayakan: Number(e.target.value) })}
                    className="w-full p-2.5 border rounded-lg font-bold text-center text-gray-900 border-gray-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">4. Professionalism (0-100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editScores.professional}
                    onChange={(e) => setEditScores({ ...editScores, professional: Number(e.target.value) })}
                    className="w-full p-2.5 border rounded-lg font-bold text-center text-gray-900 border-gray-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900">Rata-Rata Hasil Kalibrasi:</span>
                <span className="text-xl font-extrabold text-indigo-900">{editAvg.toFixed(2)}</span>
              </div>

              <div className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                📝 Perubahan skor ini akan langsung dicatat ke <strong>Audit Log</strong> atas nama akun Anda.
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                disabled={isPending}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveCalibration}
                disabled={isPending}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isPending ? 'Menyimpan...' : 'Simpan Kalibrasi Skor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
