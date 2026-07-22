'use client';

import { useState } from 'react';
import { updateRegionalSessionStatusAction, lockRegionalFinalResultsAction } from '@/app/actions/regional-final-judging';

export default function CuratorRegionalFinalClient({ sessions }: { sessions: any[] }) {
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  
  const handleStatusChange = async (sessionId: number, newStatus: 'penilaian_dibuka' | 'sidang_penetapan') => {
    if (!confirm(`Yakin ingin mengubah status menjadi ${newStatus.replace('_', ' ').toUpperCase()}?`)) return;
    
    setLoading(sessionId);
    setError('');
    const res = await updateRegionalSessionStatusAction(sessionId, newStatus);
    if (res?.error) setError(res.error);
    setLoading(null);
  };
  
  const handleLock = async (sessionId: number) => {
    if (!confirm('Kunci Hasil & Ranking sekarang? Jika ada seri pada Top 3, sistem akan meminta Anda melakukan override.')) return;
    
    setLoading(sessionId);
    setError('');
    const res = await lockRegionalFinalResultsAction(sessionId);
    if (res?.error) {
      if (res.needsTieBreak) {
        const tieWinnerStr = prompt(`Terdapat nilai seri!\n\n${res.error}\n\nMasukkan ID Proposal pemenang tie-break (ID: ${res.tiedProposals?.join(' / ')}):`);
        if (tieWinnerStr) {
          const note = prompt('Catatan tie-break (opsional):');
          const winnerId = parseInt(tieWinnerStr, 10);
          if (!isNaN(winnerId)) {
            const retryRes = await lockRegionalFinalResultsAction(sessionId, winnerId, note || undefined);
            if (retryRes?.error) setError(retryRes.error);
          } else {
            setError('ID tidak valid.');
          }
        }
      } else {
        setError(res.error);
      }
    }
    setLoading(null);
  };
  
  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg font-medium border border-red-200">
          {error}
        </div>
      )}
      
      {sessions.map(s => {
        const expectedAssessments = s.proposals.length * s.juriCountSetting;
        const progressPercentage = expectedAssessments > 0 ? Math.round((s.totalAssessments / expectedAssessments) * 100) : 0;
        
        return (
          <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{s.region}</h2>
                <div className="flex flex-wrap gap-2 mt-2 items-center text-sm text-gray-600">
                  <span className="font-semibold uppercase px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">{s.status.replace('_', ' ')}</span>
                  <span>•</span>
                  <span>{s.proposals.length} Finalis</span>
                  <span>•</span>
                  <span>{s.judges.length}/{s.juriCountSetting} Juri Ditugaskan</span>
                  {s.status === 'sidang_penetapan' && (
                    <>
                      <span>•</span>
                      <span className={`font-bold ${s.judges.length > 0 && s.judges.every((j: any) => j.isFinalized) ? 'text-green-600' : 'text-orange-600'}`}>
                        {s.judges.filter((j: any) => j.isFinalized).length} / {s.judges.length} Juri Selesai Kalibrasi
                      </span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {s.status === 'juri_ditugaskan' && (
                  <button 
                    onClick={() => handleStatusChange(s.id, 'penilaian_dibuka')}
                    disabled={loading === s.id}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg text-sm"
                  >
                    Buka Penilaian
                  </button>
                )}
                {s.status === 'penilaian_dibuka' && (
                  <button 
                    onClick={() => handleStatusChange(s.id, 'sidang_penetapan')}
                    disabled={loading === s.id}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-sm"
                  >
                    Lanjut ke Sidang Penetapan
                  </button>
                )}
                {s.status === 'sidang_penetapan' && (
                  <div className="flex flex-col items-end gap-1">
                    <button 
                      onClick={() => handleLock(s.id)}
                      disabled={loading === s.id || (s.judges.length > 0 && !s.judges.every((j: any) => j.isFinalized))}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm"
                    >
                      Kunci Hasil & Ranking
                    </button>
                    {s.judges.length > 0 && !s.judges.every((j: any) => j.isFinalized) && (
                      <span className="text-[10px] text-orange-600 font-semibold max-w-[150px] text-right leading-tight">
                        Menunggu semua Juri klik Finalisasi
                      </span>
                    )}
                  </div>
                )}
                {s.status === 'hasil_terkunci' && (
                  <div className="flex items-center gap-2">
                    <span className="px-4 py-2 bg-green-100 text-green-800 font-bold rounded-lg text-sm">
                      ✓ Selesai
                    </span>
                    <a 
                      href={`/api/pdf/regional-final?sessionId=${s.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm inline-flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      Berita Acara
                    </a>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-5">
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">Progress Penilaian Keseluruhan</span>
                  <span className="font-bold text-indigo-600">{s.totalAssessments} / {expectedAssessments}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-y">
                    <tr>
                      <th className="py-3 px-4">ID</th>
                      <th className="py-3 px-4">Proposal</th>
                      <th className="py-3 px-4 text-center">Status Dinilai</th>
                      <th className="py-3 px-4 text-center">Skor Akhir</th>
                      <th className="py-3 px-4 text-center">Ranking</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {s.proposals.map((p: any) => (
                      <tr key={p.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 text-gray-500">#{p.id}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900">{p.title}</div>
                          <div className="text-xs text-gray-500">{p.proposerName}</div>
                        </td>
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
                        <td className="py-3 px-4 text-center">
                          {p.rank ? (
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                              p.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                              p.rank === 2 ? 'bg-gray-300 text-gray-800' :
                              p.rank === 3 ? 'bg-amber-600 text-white' : 'text-gray-500'
                            }`}>
                              {p.rank}
                            </span>
                          ) : '-'}
                          {p.isTieBreak && <span className="ml-1 text-[10px] text-red-500 font-bold" title="Menang Tie-Break">*TB</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
