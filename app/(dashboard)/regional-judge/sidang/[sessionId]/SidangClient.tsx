'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calibrateSidangScoreAction, finalizeSidangSessionAction } from '@/app/actions/regional-final-judging';
import { getProposalById } from '@/app/actions/proposals';
import FormattedTextDisplay from '@/app/components/FormattedTextDisplay';
import ResubmitDocumentSection from '@/app/components/ResubmitDocumentSection';

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
  // Proposal detail state
  const [selectedProposalDetail, setSelectedProposalDetail] = useState<any | null>(null);
  const [detailRowNumber, setDetailRowNumber] = useState<number>(0);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const handleShowDetail = async (id: number, rowNum: number) => {
    setIsLoadingDetail(true);
    try {
      const p = await getProposalById(id);
      if (p) {
        setSelectedProposalDetail(p);
        setDetailRowNumber(rowNum);
      }
    } catch (err) {
      console.error('Failed to fetch proposal details:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

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

  const [modalErrorMsg, setModalErrorMsg] = useState('');

  const openCalibrationModal = (
    proposalId: number,
    proposalTitle: string,
    targetJudgeUserId: number,
    judgeName: string,
    currentScores: { problemFit: number; dampak: number; kelayakan: number; professional: number; [key: string]: any } | null
  ) => {
    if (isLocked) return;
    setEditingCell({ proposalId, proposalTitle, targetJudgeUserId, judgeName });
    // PENTING: hanya ambil 4 field skor yang relevan, abaikan avgScore/notes/dll.
    setEditScores(
      currentScores
        ? { problemFit: currentScores.problemFit, dampak: currentScores.dampak, kelayakan: currentScores.kelayakan, professional: currentScores.professional }
        : { problemFit: 75, dampak: 75, kelayakan: 75, professional: 75 }
    );
    setErrorMsg('');
    setModalErrorMsg('');
  };

  const handleSaveCalibration = () => {
    if (!editingCell) return;
    setErrorMsg('');
    setModalErrorMsg('');
    startTransition(async () => {
      // Destructure eksplisit 4 field — immune terhadap state yg tercemar avgScore/notes
      const { problemFit, dampak, kelayakan, professional } = editScores;
      const res = await calibrateSidangScoreAction(
        sessionId,
        editingCell.proposalId,
        editingCell.targetJudgeUserId,
        { problemFit, dampak, kelayakan, professional }
      );

      if (res?.error) {
        setErrorMsg(res.error);
        setModalErrorMsg(res.error);
      } else {
        setEditingCell(null);
        setModalErrorMsg('');
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
          {sessionStatus === 'hasil_terkunci' ? (
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-lg text-sm flex items-center gap-1.5">
                <span>✅ Hasil Sidang Dikunci (Resmi)</span>
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
          ) : isLocked ? (
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 bg-amber-100 text-amber-800 border border-amber-300 font-bold rounded-lg text-sm flex items-center gap-1.5">
                <span>✅ Hasil Sidang Ditetapkan (Menunggu Kunci Ranking Koordinator)</span>
              </div>
              {isOperatorPic && (
                <Link
                  href="/curator/regional-final"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors shadow-sm"
                >
                  Lanjut ke Kunci Ranking →
                </Link>
              )}
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
                      <button
                        onClick={() => handleShowDetail(p.id, index + 1)}
                        disabled={isLoadingDetail}
                        className="font-bold text-gray-900 text-left line-clamp-2 hover:text-indigo-600 hover:underline transition-colors focus:outline-none disabled:opacity-75"
                        title="Klik untuk melihat detail proposal"
                      >
                        {p.title}
                      </button>
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

      {/* Catatan Juri per Proposal */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Catatan Kualitatif Juri Regional</h2>
          <p className="text-sm text-gray-500 mt-1">
            Catatan pertimbangan yang dituliskan oleh masing-masing Juri saat menilai proposal.
          </p>
        </div>

        <div className="space-y-4">
          {proposalStats.map((p, pIdx) => {
            const hasAnyNotes = judgesList.some(j => p.judgeScores[j.id]?.notes);

            return (
              <div key={p.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div className="font-bold text-gray-900 text-sm">
                    #{pIdx + 1}. {p.title}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {p.proposerName} ({p.proposerOrg || p.category})
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {judgesList.map(j => {
                    const js = p.judgeScores[j.id];
                    const note = js?.notes;

                    return (
                      <div key={j.id} className="p-3 rounded-lg bg-white border border-gray-200 text-xs space-y-1 shadow-xs">
                        <div className="font-bold text-gray-800 flex items-center justify-between">
                          <span>{j.name}</span>
                          {note ? (
                            <span className="text-[10px] text-green-700 font-semibold bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Tersedia Catatan</span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-normal italic">Tanpa catatan</span>
                          )}
                        </div>
                        {note ? (
                          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed border-t border-gray-100 pt-1.5 mt-1 font-medium">
                            {note}
                          </p>
                        ) : (
                          <p className="text-gray-400 italic border-t border-gray-100 pt-1.5 mt-1">
                            Tidak ada catatan dari juri ini.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
                    onChange={(e) => setEditScores({ problemFit: Number(e.target.value), dampak: editScores.dampak, kelayakan: editScores.kelayakan, professional: editScores.professional })}
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
                    onChange={(e) => setEditScores({ problemFit: editScores.problemFit, dampak: Number(e.target.value), kelayakan: editScores.kelayakan, professional: editScores.professional })}
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
                    onChange={(e) => setEditScores({ problemFit: editScores.problemFit, dampak: editScores.dampak, kelayakan: Number(e.target.value), professional: editScores.professional })}
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
                    onChange={(e) => setEditScores({ problemFit: editScores.problemFit, dampak: editScores.dampak, kelayakan: editScores.kelayakan, professional: Number(e.target.value) })}
                    className="w-full p-2.5 border rounded-lg font-bold text-center text-gray-900 border-gray-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900">Rata-Rata Hasil Kalibrasi:</span>
                <span className="text-xl font-extrabold text-indigo-900">{editAvg.toFixed(2)}</span>
              </div>

              {modalErrorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
                  ⚠️ {modalErrorMsg}
                </div>
              )}

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

      {/* Modal Detail Proposal */}
      {selectedProposalDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-100 flex flex-col text-left">
            {/* Modal Header */}
            <div className="bg-[#0A4736] text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <span className="w-8 h-8 flex items-center justify-center bg-white text-[#0A4736] text-xs font-bold rounded-md shadow-sm">
                  #{detailRowNumber}
                </span>
                <div>
                  <span className="text-xs uppercase font-bold text-green-200 tracking-wider">Detail Proposal Finalis</span>
                  <h3 className="text-lg font-bold truncate max-w-xl">{selectedProposalDetail.title}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedProposalDetail(null)}
                className="text-green-100 hover:text-white text-xl font-bold p-1 transition-colors"
                title="Tutup Detail"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded border border-gray-200">
                    {selectedProposalDetail.category} {selectedProposalDetail.regionCenter ? `· ${selectedProposalDetail.regionCenter}` : '· Pusat'}
                  </span>
                  <span className="text-sm text-gray-500 font-mono ml-auto">ID: {selectedProposalDetail.externalSubId || selectedProposalDetail.externalId}</span>
                </div>

                {/* Ringkasan Submission Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-gray-200 pb-2">
                  <h3 className="font-bold text-gray-900 uppercase tracking-wide text-xs">Ringkasan Submission</h3>
                  {selectedProposalDetail.linkProposal && (
                    <a
                      href={selectedProposalDetail.linkProposal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-semibold text-[#0A4736] hover:underline bg-green-50 px-2 py-1 rounded mt-2 sm:mt-0"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Buka Dokumen Proposal Fase 1
                    </a>
                  )}
                </div>

                <div className="space-y-4 mb-8">
                  {/* Row 1: Innovator */}
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Innovator</div>
                    <div className="text-sm text-gray-900">
                      <span className="font-medium">{selectedProposalDetail.proposerName || '-'}</span>
                      {selectedProposalDetail.proposerEmail && <span className="text-gray-500"> &middot; {selectedProposalDetail.proposerEmail}</span>}
                    </div>
                  </div>

                  {/* Row 2: Tim & Tanggal */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Anggota Tim</div>
                      <div className="text-sm text-gray-900">
                        {Array.isArray(selectedProposalDetail.teamMembers) && selectedProposalDetail.teamMembers.length > 0
                          ? (selectedProposalDetail.teamMembers as string[]).join(', ')
                          : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Tanggal Submit</div>
                      <div className="text-sm text-gray-900">
                        {selectedProposalDetail.submissionDate ? new Date(selectedProposalDetail.submissionDate).toLocaleString('id-ID') : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Group, Sub-Tema, & Unit Kerja */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Group</div>
                      <div className="text-sm text-gray-900">{selectedProposalDetail.groupName || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Sub-Tema</div>
                      <div className="text-sm text-gray-900">{selectedProposalDetail.theme || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Nama Unit Kerja</div>
                      <div className="text-sm text-gray-900">{selectedProposalDetail.proposerUnitKerja || '-'}</div>
                    </div>
                  </div>

                  {/* Row 4: Kantor Wilayah (Conditional) */}
                  {selectedProposalDetail.category === 'WILAYAH' && (
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Kantor Wilayah</div>
                      <div className="text-sm text-gray-900">{selectedProposalDetail.regionCenter || '-'}</div>
                    </div>
                  )}
                </div>

                {/* Detail Content (BI or BC/Wilayah/Pusat) */}
                {selectedProposalDetail.category === 'BI' && (
                  <div className="space-y-6 mb-8">
                    <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 text-md">Detail Breakthrough Innovation (BI)</h3>

                    {selectedProposalDetail.biMasalahDiselesaikan && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Masalah yang Diselesaikan</div>
                        <FormattedTextDisplay
                          proposalId={selectedProposalDetail.id}
                          fieldName="biMasalahDiselesaikan"
                          originalText={selectedProposalDetail.biMasalahDiselesaikan}
                          formattedText={(selectedProposalDetail.formattedTexts as any)?.biMasalahDiselesaikan}
                          canFormat={false}
                          hideFormatButton={true}
                        />
                      </div>
                    )}

                    {selectedProposalDetail.biInovasiDiusulkan && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Inovasi yang Diusulkan</div>
                        <FormattedTextDisplay
                          proposalId={selectedProposalDetail.id}
                          fieldName="biInovasiDiusulkan"
                          originalText={selectedProposalDetail.biInovasiDiusulkan}
                          formattedText={(selectedProposalDetail.formattedTexts as any)?.biInovasiDiusulkan}
                          canFormat={false}
                          hideFormatButton={true}
                        />
                      </div>
                    )}

                    {!selectedProposalDetail.biMasalahDiselesaikan && !selectedProposalDetail.biInovasiDiusulkan && selectedProposalDetail.summary && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Ringkasan Inovasi</div>
                        <FormattedTextDisplay
                          proposalId={selectedProposalDetail.id}
                          fieldName="summary"
                          originalText={selectedProposalDetail.summary}
                          formattedText={(selectedProposalDetail.formattedTexts as any)?.summary}
                          canFormat={false}
                          hideFormatButton={true}
                        />
                      </div>
                    )}
                  </div>
                )}

                {selectedProposalDetail.category !== 'BI' && (
                  <div className="space-y-6 mb-8">
                    <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 text-md">Detail Business Case (BC/Pusat/Wilayah)</h3>

                    {selectedProposalDetail.bcKelompokDibantu && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Kelompok yang Dibantu</div>
                        <FormattedTextDisplay
                          proposalId={selectedProposalDetail.id}
                          fieldName="bcKelompokDibantu"
                          originalText={selectedProposalDetail.bcKelompokDibantu}
                          formattedText={(selectedProposalDetail.formattedTexts as any)?.bcKelompokDibantu}
                          canFormat={false}
                          hideFormatButton={true}
                        />
                      </div>
                    )}

                    {selectedProposalDetail.bcAlasanMemilihMereka && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Alasan Memilih Mereka</div>
                        <FormattedTextDisplay
                          proposalId={selectedProposalDetail.id}
                          fieldName="bcAlasanMemilihMereka"
                          originalText={selectedProposalDetail.bcAlasanMemilihMereka}
                          formattedText={(selectedProposalDetail.formattedTexts as any)?.bcAlasanMemilihMereka}
                          canFormat={false}
                          hideFormatButton={true}
                        />
                      </div>
                    )}

                    {selectedProposalDetail.summary && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Ringkasan Proposal</div>
                        <FormattedTextDisplay
                          proposalId={selectedProposalDetail.id}
                          fieldName="summary"
                          originalText={selectedProposalDetail.summary}
                          formattedText={(selectedProposalDetail.formattedTexts as any)?.summary}
                          canFormat={false}
                          hideFormatButton={true}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Detail Dokumen Resubmission */}
                <ResubmitDocumentSection
                  proposal={selectedProposalDetail}
                  showSplitScreenButton={false}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedProposalDetail(null)}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-sm transition-colors"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
