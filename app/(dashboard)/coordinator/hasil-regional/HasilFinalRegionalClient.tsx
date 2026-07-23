'use client';

import { useState } from 'react';

type SessionSummary = {
  id: number | null;
  region: string;
  status: string;
  juriCountSetting: number;
  totalAssessments: number;
  proposals: {
    id: number;
    title: string;
    proposerName: string;
    category: string;
    finalScore: number;
    rank: number | null;
    isTieBreak: boolean;
    assessmentCount: number;
    judgeScores?: Record<number, number>;
  }[];
  judges: {
    judgeId: number;
    name: string;
    isFinalized: boolean;
  }[];
  pics: {
    picId: number;
    name: string;
  }[];
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  belum_ada_sesi: { label: 'Belum Ada Sesi', color: 'bg-gray-100 text-gray-400 border-gray-200' },
  finalis_terkunci: { label: 'Finalis Terkunci', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  juri_ditugaskan: { label: 'Juri Ditugaskan', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  penilaian_dibuka: { label: 'Penilaian Dibuka', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  penilaian_selesai: { label: 'Penilaian Selesai', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  sidang_penetapan: { label: 'Sidang Penetapan', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  hasil_terkunci: { label: 'Hasil Terkunci ✓', color: 'bg-green-100 text-green-800 border-green-300' },
};

// belum_ada_sesi has index -1 (not in this array) → will sort last
const STATUS_ORDER = ['finalis_terkunci', 'juri_ditugaskan', 'penilaian_dibuka', 'penilaian_selesai', 'sidang_penetapan', 'hasil_terkunci'];

export default function HasilFinalRegionalClient({ sessions }: { sessions: SessionSummary[] }) {
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const lockedCount = sessions.filter(s => s.status === 'hasil_terkunci').length;
  const inProgressCount = sessions.filter(s => !['finalis_terkunci', 'hasil_terkunci', 'belum_ada_sesi'].includes(s.status)).length;
  const notStartedCount = sessions.filter(s => s.status === 'finalis_terkunci').length;
  const noSessionCount = sessions.filter(s => s.status === 'belum_ada_sesi').length;

  const getStatusIndex = (status: string) => {
    const idx = STATUS_ORDER.indexOf(status);
    // belum_ada_sesi (-1) sorts last by returning a large negative number relative to the sort logic
    return idx;
  };

  const sorted = [...sessions].sort((a, b) => {
    // belum_ada_sesi always last
    const aNoSession = a.status === 'belum_ada_sesi';
    const bNoSession = b.status === 'belum_ada_sesi';
    if (aNoSession && !bNoSession) return 1;
    if (!aNoSession && bNoSession) return -1;
    // Sort: hasil_terkunci first, then by status progress descending, then by region alphabetically
    const ai = getStatusIndex(a.status);
    const bi = getStatusIndex(b.status);
    if (ai !== bi) return bi - ai; // higher status first
    return a.region.localeCompare(b.region);
  });

  const getTop3 = (s: SessionSummary) => {
    if (s.status !== 'hasil_terkunci') return [];
    return s.proposals
      .filter(p => p.rank !== null && p.rank <= 3)
      .sort((a, b) => (a.rank || 0) - (b.rank || 0));
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Total Grup</div>
          <div className="text-2xl font-bold text-gray-900">{sessions.length}</div>
          {noSessionCount > 0 && (
            <div className="text-xs text-gray-400 mt-1">{noSessionCount} belum ada sesi</div>
          )}
        </div>
        <div className="bg-white p-5 rounded-xl border border-green-200 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Hasil Terkunci</div>
          <div className="text-2xl font-bold text-green-600">{lockedCount} / {sessions.length}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-yellow-200 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Sedang Berjalan</div>
          <div className="text-2xl font-bold text-yellow-600">{inProgressCount}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Belum Mulai</div>
          <div className="text-2xl font-bold text-gray-400">{notStartedCount}</div>
        </div>
      </div>

      {/* Progress Bar Overall */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-gray-700">Progress Keseluruhan Final Regional</span>
          <span className="font-bold text-green-600">{Math.round((lockedCount / sessions.length) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${(lockedCount / sessions.length) * 100}%` }}
          />
        </div>
      </div>



      {/* Group Cards */}
      <div className="space-y-4">
        {sorted.map(s => {
          const statusInfo = STATUS_LABELS[s.status] || { label: s.status, color: 'bg-gray-100 text-gray-700' };
          const top3 = getTop3(s);
          const isExpanded = expandedSession === s.region;
          const expectedAssessments = s.proposals.length * s.juriCountSetting;
          const progressPct = expectedAssessments > 0 ? Math.round((s.totalAssessments / expectedAssessments) * 100) : 0;

          return (
            <div key={s.region} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div
                className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 ${s.status !== 'belum_ada_sesi' ? 'cursor-pointer hover:bg-gray-50/50' : 'cursor-default opacity-70'} transition-colors`}
                onClick={() => s.status !== 'belum_ada_sesi' && setExpandedSession(isExpanded ? null : s.region)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{s.region}</h3>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span>{s.proposals.length} Finalis</span>
                    <span>{s.judges.length}/{s.juriCountSetting} Juri</span>
                    {s.status !== 'finalis_terkunci' && (
                      <span>Penilaian: {s.totalAssessments}/{expectedAssessments} ({progressPct}%)</span>
                    )}
                  </div>
                </div>

                {/* Top 3 Preview (for locked sessions) */}
                {top3.length > 0 && (
                  <div className="flex items-center gap-3">
                    {top3.map(p => {
                      const medals = ['🥇', '🥈', '🥉'];
                      const bgColors = [
                        'bg-gradient-to-r from-amber-100 to-amber-50 border-amber-300',
                        'bg-gradient-to-r from-slate-100 to-slate-50 border-slate-300',
                        'bg-gradient-to-r from-orange-100 to-orange-50 border-amber-300',
                      ];
                      const rankIdx = (p.rank || 1) - 1;
                      return (
                        <div key={p.id} className={`px-3 py-2 rounded-lg border text-xs ${bgColors[rankIdx]}`}>
                          <div className="font-bold text-gray-900 flex items-center gap-1">
                            <span>{medals[rankIdx]}</span>
                            <span className="text-gray-700">{p.finalScore.toFixed(2)}</span>
                          </div>
                          <div className="text-gray-600 truncate max-w-[140px]" title={p.title}>
                            {p.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Expand Icon */}
                {s.status !== 'belum_ada_sesi' && (
                  <div className="text-gray-400 text-xl select-none">
                    {isExpanded ? '▲' : '▼'}
                  </div>
                )}
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-gray-200 p-5 bg-gray-50/30">
                  {s.proposals.length === 0 ? (
                    <div className="text-center text-gray-400 py-4">Belum ada finalis di grup ini.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-600 font-medium border-y">
                          <tr>
                            <th className="py-3 px-4">ID</th>
                            <th className="py-3 px-4">Proposal</th>
                            {s.judges.map((j: any) => (
                              <th key={j.judgeId} className="py-3 px-4 text-center whitespace-nowrap" title={j.name}>
                                <div className="font-semibold text-gray-800">{j.name}</div>
                                <div className="text-[10px] text-gray-400 font-normal">{j.isFinalized ? '✓ Final' : 'Belum Final'}</div>
                              </th>
                            ))}
                            <th className="py-3 px-4 text-center">Status Dinilai</th>
                            <th className="py-3 px-4 text-center">Skor Akhir</th>
                            <th className="py-3 px-4 text-center">Ranking</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {[...s.proposals]
                            .sort((a, b) => {
                              if (a.rank && b.rank) return a.rank - b.rank;
                              if (a.rank) return -1;
                              if (b.rank) return 1;
                              return b.finalScore - a.finalScore;
                            })
                            .map(p => {
                              const isLocked = s.status === 'hasil_terkunci';
                              const isJuara1 = isLocked && p.rank === 1;
                              const isJuara2 = isLocked && p.rank === 2;
                              const isJuara3 = isLocked && p.rank === 3;

                              let rowBg = 'hover:bg-gray-50/50';
                              if (isJuara1) rowBg = 'bg-gradient-to-r from-amber-100/90 via-amber-50/40 to-white border-l-4 border-amber-500';
                              else if (isJuara2) rowBg = 'bg-gradient-to-r from-slate-100 via-slate-50/50 to-white border-l-4 border-slate-400';
                              else if (isJuara3) rowBg = 'bg-gradient-to-r from-orange-100/70 via-amber-50/30 to-white border-l-4 border-amber-600';

                              return (
                                <tr key={p.id} className={`${rowBg} transition-colors`}>
                                  <td className="py-3 px-4 text-gray-500 font-medium">#{p.id}</td>
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-gray-900">{p.title}</div>
                                    <div className="text-xs text-gray-500">{p.proposerName}</div>
                                  </td>
                                  {s.judges.map((j: any) => {
                                    const score = p.judgeScores?.[j.judgeId];
                                    return (
                                      <td key={j.judgeId} className="py-3 px-4 text-center whitespace-nowrap">
                                        {score !== undefined ? (
                                          <span className="inline-block font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded text-xs border border-gray-200">
                                            {score.toFixed(1)}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 font-medium text-xs">-</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="py-3 px-4 text-center">
                                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                      p.assessmentCount === s.judges.length && s.judges.length > 0 
                                        ? 'bg-green-100 text-green-800' 
                                        : p.assessmentCount > 0 
                                          ? 'bg-yellow-100 text-yellow-800' 
                                          : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {p.assessmentCount} / {s.judges.length || s.juriCountSetting}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center font-bold">
                                    {p.finalScore > 0 ? p.finalScore.toFixed(2) : '-'}
                                  </td>
                                  <td className="py-3 px-4 text-center whitespace-nowrap">
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
                                    {(!isLocked || !p.rank || p.rank > 3) && (
                                      <span className="text-sm font-medium text-gray-500">
                                        {p.rank ? `#${p.rank}` : '-'}
                                      </span>
                                    )}
                                    {p.isTieBreak && <span className="ml-1 text-[10px] text-amber-900 font-bold bg-amber-100 px-1 py-0.5 rounded border border-amber-300" title="Menang Tie-Break">★ TB</span>}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
