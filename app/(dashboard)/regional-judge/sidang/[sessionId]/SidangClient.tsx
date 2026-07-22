'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { finalizeRegionalJudgeScoreAction } from '@/app/actions/regional-final-judging';

export default function SidangClient({
  sessionId,
  judgeAssignment,
  judgesList,
  proposalStats
}: {
  sessionId: number;
  judgeAssignment: any;
  judgesList: { id: number; name: string; isFinalized: boolean }[];
  proposalStats: any[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState('');

  const isMyFinalized = judgeAssignment.isFinalized;
  
  // Highlight rank 2 and 3 candidates if they have similar scores (tie break)
  // For simplicity, we just highlight rank 2 and 3 if their score difference is < 1 point
  let tieBreakRanks = new Set<number>();
  if (proposalStats.length >= 3) {
    const r2 = proposalStats[1].avgScore;
    const r3 = proposalStats[2].avgScore;
    if (Math.abs(r2 - r3) < 1) {
      tieBreakRanks.add(1);
      tieBreakRanks.add(2);
    }
  }

  const handleFinalize = () => {
    if (!confirm('Apakah Anda yakin nilai ini sudah final? Setelah difinalisasi, Anda tidak dapat mengubah nilai lagi.')) return;
    
    setErrorMsg('');
    startTransition(async () => {
      const res = await finalizeRegionalJudgeScoreAction(sessionId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Status Juri Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Status Finalisasi Juri</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {judgesList.map(j => (
            <div key={j.id} className={`p-4 rounded-lg border ${j.isFinalized ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'} flex items-center justify-between`}>
              <div className="font-medium text-gray-900 flex items-center gap-2">
                {j.name}
                {j.id === judgeAssignment.userId && <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">Anda</span>}
              </div>
              {j.isFinalized ? (
                <span className="text-xs font-bold text-green-700 bg-green-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  Final
                </span>
              ) : (
                <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2.5 py-1 rounded-full">
                  Belum
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* Tabel Kalibrasi */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Tabel Kalibrasi Nilai</h2>
          <p className="text-sm text-gray-500 mt-1">Bandingkan nilai Anda dengan Juri lain. Baris yang disorot kuning menunjukkan potensi seri pada batas Juara 2 & 3.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-16">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider max-w-xs">Proposal</th>
                {judgesList.map(j => (
                  <th key={j.id} className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {j.id === judgeAssignment.userId ? 'Nilai Anda' : j.name.split(' ')[0]}
                  </th>
                ))}
                <th className="px-6 py-3 text-center text-xs font-extrabold text-gray-900 uppercase tracking-wider bg-indigo-50">Rata-Rata</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {proposalStats.map((p, index) => {
                const isTieHighlight = tieBreakRanks.has(index);
                return (
                  <tr key={p.id} className={isTieHighlight ? 'bg-yellow-50/50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-xs truncate">
                      {p.title}
                    </td>
                    {judgesList.map(j => {
                      const score = p.judgeScores[j.id];
                      const isMe = j.id === judgeAssignment.userId;
                      return (
                        <td key={j.id} className={`px-6 py-4 whitespace-nowrap text-center text-sm ${isMe ? 'font-bold bg-indigo-50/30' : 'text-gray-600'}`}>
                          {score !== null ? (
                            isMe && !isMyFinalized ? (
                              <Link href={`/regional-judge/assess/${sessionId}?proposalId=${p.id}`} className="text-indigo-600 hover:text-indigo-800 hover:underline">
                                {score.toFixed(2)} ✎
                              </Link>
                            ) : (
                              score.toFixed(2)
                            )
                          ) : (
                            isMe && !isMyFinalized ? (
                              <Link href={`/regional-judge/assess/${sessionId}?proposalId=${p.id}`} className="text-orange-600 hover:text-orange-800 hover:underline">
                                Nilai ✎
                              </Link>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )
                          )}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-extrabold text-indigo-900 bg-indigo-50/50">
                      {p.avgScore > 0 ? p.avgScore.toFixed(2) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end pt-4 pb-8">
        {!isMyFinalized ? (
          <button 
            onClick={handleFinalize}
            disabled={isPending}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase tracking-wide shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isPending ? 'Memproses...' : 'Finalisasi Nilai Saya'}
          </button>
        ) : (
          <div className="px-8 py-3 bg-green-100 text-green-800 rounded-xl font-bold uppercase tracking-wide shadow-sm flex items-center gap-2 border border-green-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            Nilai Anda Sudah Final
          </div>
        )}
      </div>
    </div>
  );
}
