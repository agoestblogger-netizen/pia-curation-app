'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { batchCalibrateGrandFinalScoresAction, lockGrandFinalResultsAction, GrandFinalBatchAssessmentPayload } from '@/app/actions/grand-final';

const RUBRIC_GF = {
  1: {
    title: 'Problem & Solution Fit',
    levels: [
      { score: 1, label: 'Poor', desc: 'Masalah tidak jelas, tidak tervalidasi, atau tidak relevan. Solusi tidak menjawab masalah yang ada.' },
      { score: 2, label: 'Fair', desc: 'Pemahaman masalah masih umum dan bukti mendukung terbatas. Solusi yang diusulkan parsial menjawab masalah dan hubungan keduanya belum jelas.' },
      { score: 3, label: 'Good', desc: 'Masalah cukup jelas namun beberapa aspek penting belum tervalidasi sepenuhnya. Solusi menjawab sebagian besar masalah, tetapi keterkaitan dengan hasil validasi belum kuat.' },
      { score: 4, label: 'Very Good', desc: 'Masalah terdefinisi spesifik dan didukung data validasi yang cukup kuat. Akar penyebab jelas. Solusi memiliki hubungan kuat dengan akar masalah dan didasarkan pada insight hasil validasi.' },
      { score: 5, label: 'Excellent', desc: 'Memahami akar masalah secara mendalam berbasis bukti. Solusi sangat spesifik menjawab akar masalah dan terbukti relevan bagi target customer/user.' },
    ]
  },
  2: {
    title: 'Impact & Kecepatan Realisasi',
    levels: [
      { score: 1, label: 'Poor', desc: 'Tidak ada dampak yang berarti atau bahkan berisiko menimbulkan dampak negatif bagi bisnis/operasional.' },
      { score: 2, label: 'Fair', desc: 'Dampak kecil dan bersifat inkremental pada area sempit. Implementasi >6 bulan dengan investasi yang cukup signifikan. Value proposition kurang jelas atau kurang menarik bagi target segmen.' },
      { score: 3, label: 'Good', desc: 'Dampak menengah (growth 1–5%) pada segmen tertentu dan/atau efisiensi di beberapa proses/unit. Implementasi 3–6 bulan dengan kombinasi penyesuaian/investasi tambahan. Value proposition cukup jelas namun diferensiasi sedang.' },
      { score: 4, label: 'Very Good', desc: 'Dampak besar (growth 5–10%) dari perluasan layanan/penetrasi pasar/efisiensi skala luas. Implementasi cepat (1–3 bulan) dengan mayoritas memanfaatkan infrastruktur existing, investasi terbatas dan ROI relatif cepat.' },
      { score: 5, label: 'Excellent', desc: 'Dampak sangat besar (revenue baru signifikan dan/atau aktivasi massal, growth >10%). Hasil cepat (<1 bulan) dengan memanfaatkan aset existing, tanpa investasi baru signifikan, serta menciptakan efisiensi/keunggulan kompetitif jangka panjang.' },
    ]
  },
  3: {
    title: 'Kelayakan & Skalabilitas',
    levels: [
      { score: 1, label: 'Poor', desc: 'Tidak realistis untuk diimplementasikan dengan resource, waktu, dan kemampuan yang tersedia.' },
      { score: 2, label: 'Fair', desc: 'Terdapat banyak kendala pada aspek teknologi, proses, kompetensi, atau biaya. Potensi scaling rendah dan membutuhkan upaya besar.' },
      { score: 3, label: 'Good', desc: 'Dapat diimplementasikan namun membutuhkan penyesuaian yang cukup pada proses/sistem/kompetensi. Potensi scaling ada, tetapi membutuhkan effort dan investasi lebih besar.' },
      { score: 4, label: 'Very Good', desc: 'Realistis untuk diimplementasikan dalam waktu dekat dengan resource terkendali. Ada penyesuaian proses/sistem namun tidak menjadi hambatan signifikan. Potensi scaling jelas meski perlu adaptasi.' },
      { score: 5, label: 'Excellent', desc: 'Sangat realistis untuk segera diimplementasikan dengan resource terbatas. Mudah diadopsi dan memiliki model jelas untuk diperluas dengan incremental effort rendah.' },
    ]
  },
  4: {
    title: 'Professional Judgement',
    levels: [
      { score: 1, label: 'Poor', desc: 'Tidak sejalan dengan strategi dan tidak layak untuk dipertimbangkan.' },
      { score: 2, label: 'Fair', desc: 'Kurang relevan dengan prioritas strategis atau memberikan kontribusi yang sangat kecil terhadap tujuan perusahaan.' },
      { score: 3, label: 'Good', desc: 'Memberikan manfaat namun bukan prioritas utama dan dapat dipertimbangkan setelah kebutuhan yang lebih penting terpenuhi.' },
      { score: 4, label: 'Very Good', desc: 'Relevan dan mampu memperkuat, melengkapi, atau meningkatkan efektivitas program/proses strategis yang telah berjalan, tetapi bukan kebutuhan mendesak.' },
      { score: 5, label: 'Excellent', desc: 'Ide langsung menjawab agenda strategis/critical business issue dengan urgensi tinggi dan berpotensi memberikan kontribusi signifikan terhadap sasaran strategis. Konsekuensi besar jika tidak ditangani.' },
    ]
  }
};

type ProposalGF = {
  id: number;
  title: string;
  proposerName: string;
  category: string;
  sponsorScores: Record<number, any>;
  lockedMedal: string | null;
  lockedNote: string | null;
  aiClaims: string[];
};

type Sponsor = {
  id: number;
  name: string;
};

export default function GrandFinalSidangClient({
  competitionId,
  proposals,
  sponsors,
  isLocked
}: {
  competitionId: number;
  proposals: ProposalGF[];
  sponsors: Sponsor[];
  isLocked: boolean;
}) {
  const router = useRouter();
  const [localProposals, setLocalProposals] = useState<ProposalGF[]>(proposals);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Drawer state
  const [drawerProposalId, setDrawerProposalId] = useState<number | null>(null);
  
  // Local edits for the drawer (sponsorId -> {p1, p2, p3, p4})
  const [drawerEdits, setDrawerEdits] = useState<Record<number, {p1: number; p2: number; p3: number; p4: number}>>({});

  const getAvgScore = (p: ProposalGF, overrides?: Record<number, {p1:number,p2:number,p3:number,p4:number}>) => {
    let sum = 0;
    const sponsorCount = sponsors.length || 1;
    sponsors.forEach(s => {
      if (overrides && overrides[s.id]) {
        sum += overrides[s.id].p1 + overrides[s.id].p2 + overrides[s.id].p3 + overrides[s.id].p4;
      } else {
        sum += p.sponsorScores[s.id]?.totalScore || 0;
      }
    });
    return sum / sponsorCount;
  };

  const getMedalClass = (score: number) => {
    if (score >= 17.5) return { label: 'Diamond', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    if (score >= 13.5) return { label: 'Platinum', color: 'bg-slate-200 text-slate-800 border-slate-400' };
    if (score >= 9.5) return { label: 'Gold', color: 'bg-yellow-100 text-yellow-800 border-yellow-400' };
    if (score >= 5.5) return { label: 'Silver', color: 'bg-gray-200 text-gray-700 border-gray-400' };
    return { label: 'Bronze', color: 'bg-orange-100 text-orange-800 border-orange-300' };
  };

  const getColorClass = (val: number) => {
    if (val === 5) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (val === 4) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (val === 3) return 'bg-yellow-100 text-yellow-800 border-yellow-400';
    if (val === 2) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (val === 1) return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-gray-50 text-gray-400 border-gray-200';
  };

  const openDrawer = (p: ProposalGF) => {
    if (isLocked) return;
    const initialEdits: Record<number, any> = {};
    sponsors.forEach(s => {
      const data = p.sponsorScores[s.id];
      initialEdits[s.id] = {
        p1: data?.param1 || 1,
        p2: data?.param2 || 1,
        p3: data?.param3 || 1,
        p4: data?.param4 || 1,
      };
    });
    setDrawerEdits(initialEdits);
    setDrawerProposalId(p.id);
  };

  const saveDrawerEdits = async () => {
    if (!drawerProposalId) return;
    setLoading(true);
    try {
      const payload: GrandFinalBatchAssessmentPayload[] = sponsors.map(s => ({
        sponsorId: s.id,
        param1Score: drawerEdits[s.id].p1,
        param2Score: drawerEdits[s.id].p2,
        param3Score: drawerEdits[s.id].p3,
        param4Score: drawerEdits[s.id].p4,
      }));

      // Optimistic update
      setLocalProposals(prev => prev.map(p => {
        if (p.id === drawerProposalId) {
          const newScores = { ...p.sponsorScores };
          sponsors.forEach(s => {
            const e = drawerEdits[s.id];
            const ts = e.p1 + e.p2 + e.p3 + e.p4;
            let classification = 'Bronze';
            if (ts >= 18) classification = 'Diamond';
            else if (ts >= 14) classification = 'Platinum';
            else if (ts >= 10) classification = 'Gold';
            else if (ts >= 6) classification = 'Silver';

            newScores[s.id] = {
              param1: e.p1, param2: e.p2, param3: e.p3, param4: e.p4,
              totalScore: ts,
              classification
            };
          });
          return { ...p, sponsorScores: newScores };
        }
        return p;
      }));

      await batchCalibrateGrandFinalScoresAction(competitionId, drawerProposalId, payload);
      setDrawerProposalId(null);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
      // Revert if error
      setLocalProposals(proposals);
    } finally {
      setLoading(false);
    }
  };

  const handleLock = async () => {
    if (!confirm('Kunci seluruh hasil Grand Final sekarang?')) return;
    setLoading(true);
    setError('');
    try {
      const res = await lockGrandFinalResultsAction(competitionId);
      if (res?.error) {
        if (res.needsTieBreak) {
          const tieWinnerStr = prompt(`Terdapat skor seri absolut pada rata-rata akhir!\nMasukkan ID Proposal pemenang tie-break (ID: ${res.tiedProposals?.join(' / ')}):`);
          if (tieWinnerStr) {
            const note = prompt('Catatan tie-break (opsional):');
            const winnerId = parseInt(tieWinnerStr, 10);
            if (!isNaN(winnerId)) {
              const retryRes = await lockGrandFinalResultsAction(competitionId, winnerId, note || undefined);
              if (retryRes?.error) {
                setError(retryRes.error);
              } else {
                router.refresh();
              }
            }
          }
        } else {
          setError(res.error);
        }
      } else {
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const activeProposal = drawerProposalId ? localProposals.find(p => p.id === drawerProposalId) : null;
  const drawerAvg = activeProposal ? getAvgScore(activeProposal, drawerEdits) : 0;
  const drawerMedal = getMedalClass(drawerAvg);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg font-medium border border-red-200">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex space-x-2">
          <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-bold text-sm border border-indigo-100">
            Kategori: Nasional (Gabungan)
          </div>
        </div>
        {!isLocked && (
          <button 
            onClick={handleLock}
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-sm disabled:opacity-50"
          >
            Tetapkan Hasil Sidang
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto min-h-[500px]">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
            <tr>
              <th className="py-3 px-4 w-12 text-center">ID</th>
              <th className="py-3 px-4 w-64">Proposal</th>
              {sponsors.map(s => (
                <th key={s.id} className="py-3 px-4 text-center whitespace-nowrap min-w-[120px]">
                  <div className="font-semibold text-gray-800">{s.name}</div>
                  <div className="text-[10px] text-gray-400 font-normal">Sponsor</div>
                </th>
              ))}
              <th className="py-3 px-4 text-center bg-indigo-50 border-l border-indigo-100">Rata-rata</th>
              <th className="py-3 px-4 text-center bg-indigo-50">Level Medali</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {localProposals
              .sort((a, b) => getAvgScore(b) - getAvgScore(a))
              .map(p => {
              const avgScore = getAvgScore(p);
              const medalInfo = isLocked && p.lockedMedal ? { label: p.lockedMedal, color: getMedalClass(avgScore).color } : getMedalClass(avgScore);

              return (
                <tr 
                  key={p.id} 
                  className={`hover:bg-indigo-50/30 transition-colors ${!isLocked ? 'cursor-pointer' : ''}`}
                  onClick={() => openDrawer(p)}
                >
                  <td className="py-3 px-4 text-gray-500 font-medium text-center">#{p.id}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-indigo-900 line-clamp-2" title={p.title}>
                      {p.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200" title={p.category === 'BI' ? 'Breakthrough Innovation' : p.category === 'BC' ? 'Business Case' : p.category}>
                        {p.category === 'BI' ? 'Breakthrough Innovation' : p.category === 'BC' ? 'Business Case' : p.category}
                      </span>
                      <span className="text-xs text-gray-500">{p.proposerName}</span>
                    </div>
                  </td>
                  
                  {sponsors.map(s => {
                    const data = p.sponsorScores[s.id];
                    return (
                      <td key={s.id} className="py-3 px-4 text-center">
                        <div className={`inline-block px-3 py-1.5 rounded-lg border text-sm font-bold ${data ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-transparent border-dashed border-gray-300 text-gray-400'}`}>
                          {data ? data.totalScore : '-'}
                        </div>
                      </td>
                    );
                  })}

                  <td className="py-3 px-4 text-center bg-indigo-50/30 border-l border-indigo-50">
                    <div className="text-lg font-bold text-gray-900">{avgScore > 0 ? avgScore.toFixed(2) : '-'}</div>
                  </td>
                  <td className="py-3 px-4 text-center bg-indigo-50/30">
                    {avgScore > 0 ? (
                      <div className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${medalInfo.color}`}>
                        {medalInfo.label}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                    {p.lockedNote && (
                      <div className="mt-1 text-[10px] text-gray-500 font-medium">({p.lockedNote})</div>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {localProposals.length === 0 && (
              <tr>
                <td colSpan={sponsors.length + 4} className="py-8 text-center text-gray-500">
                  Belum ada proposal Grand Final.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Side Drawer */}
      {drawerProposalId && activeProposal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDrawerProposalId(null)}></div>
          <div className="fixed inset-y-0 right-0 w-full md:w-[85%] lg:w-[75%] xl:w-[70%] max-w-6xl bg-white z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out overflow-hidden border-l border-gray-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-gray-50/50 shrink-0">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200" title={activeProposal.category === 'BI' ? 'Breakthrough Innovation' : activeProposal.category === 'BC' ? 'Business Case' : activeProposal.category}>
                    {activeProposal.category === 'BI' ? 'Breakthrough Innovation' : activeProposal.category === 'BC' ? 'Business Case' : activeProposal.category}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">ID: #{activeProposal.id} • {activeProposal.proposerName}</span>
                </div>
                <h2 className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight">
                  {activeProposal.title}
                </h2>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-0.5">Live Rata-rata</div>
                <div className="text-2xl font-black text-indigo-900 leading-none mb-1">{drawerAvg.toFixed(2)}</div>
                <div className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${drawerMedal.color}`}>
                  {drawerMedal.label}
                </div>
              </div>
            </div>

            {/* Claims Highlight */}
            {activeProposal.aiClaims && activeProposal.aiClaims.length > 0 && (
              <div className="px-4 py-2 bg-blue-50/50 border-b border-blue-100 shrink-0 flex items-center gap-2">
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider shrink-0">AI Highlight:</span>
                <span className="text-xs text-blue-900 truncate">
                  {activeProposal.aiClaims.join(' • ')}
                </span>
              </div>
            )}

            {/* Grid Area - takes remaining space with horizontal scroll enabled for table */}
            <div className="flex-1 p-4 overflow-y-auto bg-white space-y-4">
              <div className="border border-gray-200 rounded-lg overflow-x-auto shadow-xs">
                <table className="w-full text-xs text-left min-w-max">
                  <thead className="bg-gray-50 font-semibold text-gray-700 border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3 border-r border-gray-200 min-w-[170px] bg-gray-100/50 sticky left-0 z-10 shadow-xs">Dimensi</th>
                      {sponsors.map(s => (
                        <th key={s.id} className="py-2.5 px-3 text-center border-r border-gray-200 whitespace-nowrap min-w-[120px]" title={s.name}>
                          {s.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {/* Row P1 */}
                    <tr>
                      <td className="py-2 px-3 border-r border-gray-200 font-medium text-gray-800 bg-gray-50 sticky left-0 z-10" title="Problem & Solution Fit">
                        1. Problem &amp; Solution Fit
                      </td>
                      {sponsors.map(s => (
                        <td key={s.id} className="p-1 border-r border-gray-200 text-center">
                          <select 
                            value={drawerEdits[s.id]?.p1 || 1}
                            onChange={e => setDrawerEdits(prev => ({...prev, [s.id]: {...prev[s.id], p1: parseInt(e.target.value)}}))}
                            className={`w-full text-center font-bold text-xs rounded border cursor-pointer appearance-none p-1 focus:ring-2 focus:ring-indigo-500 ${getColorClass(drawerEdits[s.id]?.p1 || 1)}`}
                          >
                            <option value={1} className="bg-white text-gray-900">1 (Poor)</option>
                            <option value={2} className="bg-white text-gray-900">2 (Fair)</option>
                            <option value={3} className="bg-white text-gray-900">3 (Good)</option>
                            <option value={4} className="bg-white text-gray-900">4 (Very Good)</option>
                            <option value={5} className="bg-white text-gray-900">5 (Excellent)</option>
                          </select>
                        </td>
                      ))}
                    </tr>
                    {/* Row P2 */}
                    <tr>
                      <td className="py-2 px-3 border-r border-gray-200 font-medium text-gray-800 bg-gray-50 sticky left-0 z-10" title="Impact & Kecepatan Realisasi">
                        2. Impact &amp; Kecepatan
                      </td>
                      {sponsors.map(s => (
                        <td key={s.id} className="p-1 border-r border-gray-200 text-center">
                          <select 
                            value={drawerEdits[s.id]?.p2 || 1}
                            onChange={e => setDrawerEdits(prev => ({...prev, [s.id]: {...prev[s.id], p2: parseInt(e.target.value)}}))}
                            className={`w-full text-center font-bold text-xs rounded border cursor-pointer appearance-none p-1 focus:ring-2 focus:ring-indigo-500 ${getColorClass(drawerEdits[s.id]?.p2 || 1)}`}
                          >
                            <option value={1} className="bg-white text-gray-900">1 (Poor)</option>
                            <option value={2} className="bg-white text-gray-900">2 (Fair)</option>
                            <option value={3} className="bg-white text-gray-900">3 (Good)</option>
                            <option value={4} className="bg-white text-gray-900">4 (Very Good)</option>
                            <option value={5} className="bg-white text-gray-900">5 (Excellent)</option>
                          </select>
                        </td>
                      ))}
                    </tr>
                    {/* Row P3 */}
                    <tr>
                      <td className="py-2 px-3 border-r border-gray-200 font-medium text-gray-800 bg-gray-50 sticky left-0 z-10" title="Kelayakan & Skalabilitas">
                        3. Kelayakan &amp; Skalabilitas
                      </td>
                      {sponsors.map(s => (
                        <td key={s.id} className="p-1 border-r border-gray-200 text-center">
                          <select 
                            value={drawerEdits[s.id]?.p3 || 1}
                            onChange={e => setDrawerEdits(prev => ({...prev, [s.id]: {...prev[s.id], p3: parseInt(e.target.value)}}))}
                            className={`w-full text-center font-bold text-xs rounded border cursor-pointer appearance-none p-1 focus:ring-2 focus:ring-indigo-500 ${getColorClass(drawerEdits[s.id]?.p3 || 1)}`}
                          >
                            <option value={1} className="bg-white text-gray-900">1 (Poor)</option>
                            <option value={2} className="bg-white text-gray-900">2 (Fair)</option>
                            <option value={3} className="bg-white text-gray-900">3 (Good)</option>
                            <option value={4} className="bg-white text-gray-900">4 (Very Good)</option>
                            <option value={5} className="bg-white text-gray-900">5 (Excellent)</option>
                          </select>
                        </td>
                      ))}
                    </tr>
                    {/* Row P4 */}
                    <tr>
                      <td className="py-2 px-3 border-r border-gray-200 font-medium text-gray-800 bg-gray-50 sticky left-0 z-10" title="Professional Judgement">
                        4. Professional Judgement
                      </td>
                      {sponsors.map(s => (
                        <td key={s.id} className="p-1 border-r border-gray-200 text-center">
                          <select 
                            value={drawerEdits[s.id]?.p4 || 1}
                            onChange={e => setDrawerEdits(prev => ({...prev, [s.id]: {...prev[s.id], p4: parseInt(e.target.value)}}))}
                            className={`w-full text-center font-bold text-xs rounded border cursor-pointer appearance-none p-1 focus:ring-2 focus:ring-indigo-500 ${getColorClass(drawerEdits[s.id]?.p4 || 1)}`}
                          >
                            <option value={1} className="bg-white text-gray-900">1 (Poor)</option>
                            <option value={2} className="bg-white text-gray-900">2 (Fair)</option>
                            <option value={3} className="bg-white text-gray-900">3 (Good)</option>
                            <option value={4} className="bg-white text-gray-900">4 (Very Good)</option>
                            <option value={5} className="bg-white text-gray-900">5 (Excellent)</option>
                          </select>
                        </td>
                      ))}
                    </tr>
                    {/* Total Row */}
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                      <td className="py-2 px-3 border-r border-gray-300 text-right sticky left-0 z-10 bg-gray-100">
                        Total Skor
                      </td>
                      {sponsors.map(s => {
                        const t = (drawerEdits[s.id]?.p1||0) + (drawerEdits[s.id]?.p2||0) + (drawerEdits[s.id]?.p3||0) + (drawerEdits[s.id]?.p4||0);
                        return (
                          <td key={s.id} className="py-2 px-2 text-center border-r border-gray-300 text-gray-900">
                            {t}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* All Rubric Cards - Compact View */}
              <div className="mt-4 flex flex-col gap-1.5 bg-white border border-gray-200 rounded-lg p-2 overflow-x-auto">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 mb-1 border-b border-gray-100 pb-1">
                  Panduan Kalibrasi (Hover untuk detail)
                </div>
                {[1, 2, 3, 4].map(paramIdx => {
                  const paramData = RUBRIC_GF[paramIdx as 1|2|3|4];
                  const paramTitle = paramData.title;
                  const levels = paramData.levels;

                  return (
                    <div key={paramIdx} className="flex items-stretch gap-1.5">
                      <div className="w-24 shrink-0 flex items-center justify-end px-1 border-r border-gray-100">
                         <div className="text-[9px] font-bold text-gray-600 leading-tight text-right uppercase">
                           {paramTitle}
                         </div>
                      </div>
                      <div className="flex-1 grid grid-cols-5 gap-1.5">
                        {levels.map((lvl) => {
                          const colors = [
                            'bg-red-50 border-red-200 text-red-900',       // lvl 1 (Poor)
                            'bg-orange-50 border-orange-200 text-orange-900', // lvl 2 (Fair)
                            'bg-yellow-50 border-yellow-200 text-yellow-900', // lvl 3 (Good)
                            'bg-emerald-50 border-emerald-200 text-emerald-900', // lvl 4 (Very Good)
                            'bg-blue-50 border-blue-200 text-blue-900',       // lvl 5 (Excellent)
                          ];
                          const c = colors[lvl.score - 1] || colors[0];
                          return (
                            <div key={lvl.score} className={`p-1.5 rounded border ${c} flex flex-col justify-center shadow-sm cursor-help hover:opacity-80 transition-opacity`} title={lvl.desc}>
                              <div className="text-[9px] leading-tight line-clamp-2" title={lvl.desc}>
                                <span className="font-bold opacity-75 mr-1">L{lvl.score} ({lvl.label}):</span>
                                {lvl.desc}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Catatan Juri per Sponsor */}
              <div className="mt-4 bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Catatan Juri / Sponsor
                </div>
                <div className="space-y-2">
                  {sponsors.map(s => {
                    const note = activeProposal.sponsorScores[s.id]?.notes;
                    return (
                      <div key={s.id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-xs">
                        <div className="font-bold text-gray-800 mb-1 flex items-center justify-between">
                          <span>{s.name}</span>
                          {note ? (
                            <span className="text-[10px] text-green-700 font-semibold bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Tersedia Catatan</span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-normal italic">Tanpa catatan</span>
                          )}
                        </div>
                        {note ? (
                          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed italic bg-white p-2 rounded border border-gray-200">
                            "{note}"
                          </p>
                        ) : (
                          <p className="text-gray-400 italic text-[11px]">- Belum ada catatan yang ditulis -</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0 flex justify-end gap-3">
              <button 
                onClick={() => setDrawerProposalId(null)}
                className="px-6 py-2 rounded-lg font-bold text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Batal
              </button>
              <button 
                onClick={saveDrawerEdits}
                disabled={loading}
                className="px-8 py-2 rounded-lg font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow disabled:opacity-50"
              >
                Simpan Semua Perubahan
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
