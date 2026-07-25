'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { submitFgdCommentAction, submitFgdVoteAction, lockFgdSessionAction, releaseSingleFgdProposalAction } from '@/app/actions/fgd';
import { generateFgdAiAnalysis } from '@/app/actions/aiAnalysis';
import { uploadFgdAdditionalDocument } from '@/app/actions/uploadDocument';
import { deleteFgdAdditionalDocument } from '@/app/actions/deleteDocument';

// 5 warna per verdict — sesuai SCREENING_VERDICT_COLORS
const VERDICT_COLORS: Record<string, string> = {
  lolos: 'bg-green-100 text-green-800 border-green-200',
  duplication: 'bg-orange-100 text-orange-800 border-orange-200',
  mapped: 'bg-blue-100 text-blue-800 border-blue-200',
  non_compliance: 'bg-red-100 text-red-800 border-red-200',
  low_impact: 'bg-gray-100 text-gray-800 border-gray-200',
};

const VERDICT_LABELS: Record<string, string> = {
  lolos: 'Lolos',
  duplication: 'Duplikasi',
  mapped: 'Mapped',
  non_compliance: 'Non-Compliance',
  low_impact: 'Low Impact',
};

const CATEGORY_LABELS: Record<string, string> = {
  BI: 'BI',
  BC: 'BC',
  WILAYAH: 'Wilayah',
  PUSAT: 'Kantor Pusat',
};

type Proposal = {
  id: number;
  title: string;
  proposerName: string;
  proposerUnitKerja: string | null;
  category: string;
  regionCenter: string | null;
  status: string;
  aiCidaTotal: number | null;
  summary: string | null;
  linkProposal: string | null;
  rowNumber: number;
  verdict: string;
  curatorName?: string | null;
  curatorNotes?: string | null;
  curatorRecommendation?: string | null;
  aiAnalysis?: any;
  additionalDocuments?: any[];
};

type Vote = { id: number; proposalId: number; curatorId: number; vote: string };
type Comment = { id: number; proposalId: number; curatorId: number; content: string; createdAt: string; curatorName: string | null };

export default function FgdRoomClient({ 
  session, fgd, proposals, votes, comments, readOnly = false
}: { 
  session: any;
  fgd: any;
  proposals: Proposal[];
  votes: Vote[];
  comments: Comment[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();

  const [activeTab, setActiveTab] = useState<'list' | 'detail' | 'penetapan'>('list');
  const [isGeneratingAi, setIsGeneratingAi] = useState<Record<number, boolean>>({});
  const [aiError, setAiError] = useState<Record<number, string | null>>({});
  
  // Local state for AI analyses so we don't need to refresh the whole page
  const [localAiAnalyses, setLocalAiAnalyses] = useState<Record<number, any>>(() => {
    const map: Record<number, any> = {};
    for (const p of proposals) {
      if (p.aiAnalysis) map[p.id] = p.aiAnalysis;
    }
    return map;
  });

  const [localAdditionalDocs, setLocalAdditionalDocs] = useState<Record<number, any[]>>(() => {
    const map: Record<number, any[]> = {};
    for (const p of proposals) {
      if (p.additionalDocuments && p.additionalDocuments.length > 0) {
        map[p.id] = p.additionalDocuments;
      }
    }
    return map;
  });

  const [isUploadingDoc, setIsUploadingDoc] = useState<Record<number, boolean>>({});
  const [isDeletingDoc, setIsDeletingDoc] = useState<Record<number, boolean>>({});
  const [uploadError, setUploadError] = useState<Record<number, string | null>>({});
  const [isVoting, setIsVoting] = useState(false);

  const handleUploadDocument = async (proposalId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError(prev => ({ ...prev, [proposalId]: 'Hanya file PDF yang diperbolehkan.' }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(prev => ({ ...prev, [proposalId]: 'Ukuran file maksimal 10MB.' }));
      return;
    }

    setIsUploadingDoc(prev => ({ ...prev, [proposalId]: true }));
    setUploadError(prev => ({ ...prev, [proposalId]: null }));

    try {
      const formData = new FormData();
      formData.append('proposalId', proposalId.toString());
      formData.append('file', file);

      const res = await uploadFgdAdditionalDocument(formData);
      if (res.error) {
        setUploadError(prev => ({ ...prev, [proposalId]: res.error as string }));
      } else if (res.data) {
        setLocalAdditionalDocs(prev => ({ 
          ...prev, 
          [proposalId]: [...(prev[proposalId] || []), res.data] 
        }));
      }
    } catch (err: any) {
      setUploadError(prev => ({ ...prev, [proposalId]: err.message || 'Gagal mengunggah dokumen.' }));
    } finally {
      setIsUploadingDoc(prev => ({ ...prev, [proposalId]: false }));
      // Reset input
      e.target.value = '';
    }
  };

  async function handleDeleteDoc(proposalId: number, docId: number) {
    showConfirm('Hapus Dokumen?', 'Hapus dokumen tambahan ini?', async () => {
      setIsDeletingDoc(prev => ({ ...prev, [docId]: true }));
      try {
        const res = await deleteFgdAdditionalDocument(docId);
        if (res.error) {
          alert(res.error);
        } else {
          setLocalAdditionalDocs(prev => ({
            ...prev,
            [proposalId]: (prev[proposalId] || []).filter((d: any) => d.id !== docId)
          }));
        }
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus dokumen.');
      } finally {
        setIsDeletingDoc(prev => ({ ...prev, [docId]: false }));
      }
    });
  }

  const handleGenerateAi = async (proposalId: number) => {
    setIsGeneratingAi(prev => ({ ...prev, [proposalId]: true }));
    setAiError(prev => ({ ...prev, [proposalId]: null }));
    try {
      const otherContext = proposals.map(p => ({
        id: p.id,
        title: p.title,
        summary: p.summary
      }));
      
      const res = await generateFgdAiAnalysis(proposalId, otherContext);
      if (res.error) {
        setAiError(prev => ({ ...prev, [proposalId]: res.error as string }));
      } else if (res.data) {
        setLocalAiAnalyses(prev => ({ ...prev, [proposalId]: res.data }));
      }
    } catch (e: any) {
      setAiError(prev => ({ ...prev, [proposalId]: e.message || 'Terjadi kesalahan sistem.' }));
    } finally {
      setIsGeneratingAi(prev => ({ ...prev, [proposalId]: false }));
    }
  };

  const [activeProposalIdx, setActiveProposalIdx] = useState<number | null>(null);

  // Auto-generate AI analysis when proposal is opened
  useEffect(() => {
    if (activeTab === 'detail' && activeProposalIdx !== null) {
      const activeId = proposals[activeProposalIdx]?.id;
      if (activeId && !localAiAnalyses[activeId] && !isGeneratingAi[activeId]) {
        handleGenerateAi(activeId);
      }
    }
  }, [activeTab, activeProposalIdx, localAiAnalyses, isGeneratingAi, proposals]);
  
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locking, setLocking] = useState(false);
  const [releasing, setReleasing] = useState<Record<number, boolean>>({});
  const [selectedForFinal, setSelectedForFinal] = useState<number[]>([]);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };


  // ─── Helpers ──────────────────────────────────────────────────────────────
  const refresh = () => startRefresh(() => router.refresh());

  const voteCount = (proposalId: number, type: string) =>
    votes.filter(v => v.proposalId === proposalId && v.vote === type).length;

  const myVote = (proposalId: number): string | null =>
    votes.find(v => v.proposalId === proposalId && v.curatorId === session.userId)?.vote ?? null;

  const sortedByVotes = [...proposals].sort(
    (a, b) => voteCount(b.id, 'nominate') - voteCount(a.id, 'nominate')
  );

  const activeProposal = activeProposalIdx !== null ? proposals[activeProposalIdx] : null;

  // ─── Group proposals for 'grouped' view mode ──────────────────────────────
  const groupedProposals: Record<string, Proposal[]> = {};
  for (const p of proposals) {
    const key = p.category === 'PUSAT' ? 'Kantor Pusat' 
      : p.category === 'WILAYAH' ? (p.regionCenter ?? 'Wilayah') 
      : p.category === 'BC' ? 'Business Case'
      : p.category === 'BI' ? 'Breakthrough Innovation'
      : p.category;
    if (!groupedProposals[key]) groupedProposals[key] = [];
    groupedProposals[key].push(p);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  async function handleVote(proposalId: number, voteType: string) {
    if (fgd.status === 'locked' || isVoting) return;
    setIsVoting(true);
    
    // Tembakkan confetti jika user berhasil memberikan vote "nominate"
    if (voteType === 'nominate' && myVote(proposalId) !== 'nominate') {
      import('canvas-confetti').then((confetti) => {
        confetti.default({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
        });
      });
    }

    await submitFgdVoteAction(fgd.id, proposalId, voteType as any);
    setIsVoting(false);
    refresh();
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !activeProposal || fgd.status === 'locked') return;
    setSubmitting(true);
    await submitFgdCommentAction(fgd.id, activeProposal.id, commentText);
    setCommentText('');
    setSubmitting(false);
    refresh();
  }

  function toggleFinalSelection(id: number) {
    setSelectedForFinal(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleLock() {
    showConfirm(
      'Tetapkan Hasil & Kunci Sesi?',
      `Yakin ingin menetapkan ${selectedForFinal.length} proposal ini sebagai hasil final? Sesi akan dikunci dan tidak bisa diedit.`,
      async () => {
        setLocking(true);
        const res = await lockFgdSessionAction(fgd.id, selectedForFinal);
        setLocking(false);
        if (res.error) {
          alert(res.error);
        } else {
          refresh();
        }
      }
    );
  }

  async function handleReleaseProposal(proposalId: number) {
    showConfirm(
      'Release Proposal?',
      'Yakin ingin merilis (membatalkan penetapan) proposal ini dari hasil FGD? Proposal akan kembali ke status FGD.',
      async () => {
        setReleasing(prev => ({ ...prev, [proposalId]: true }));
        const res = await releaseSingleFgdProposalAction(fgd.id, proposalId);
        if (res.error) {
          alert(res.error);
          setReleasing(prev => ({ ...prev, [proposalId]: false }));
        } else {
          refresh();
        }
      }
    );
  }


  function openDetail(idx: number) {
    setActiveProposalIdx(idx);
    setActiveTab('detail');
  }

  // ─── Proposal Card ────────────────────────────────────────────────────────
  const ProposalRow = ({ p, idx }: { p: Proposal; idx: number }) => {
    const nomCount = voteCount(p.id, 'nominate');
    const notCount = voteCount(p.id, 'not_nominate');
    const totalVotes = nomCount + notCount;
    return (
      <div
        key={p.id}
        className="p-4 hover:bg-teal-50/40 flex items-center justify-between group cursor-pointer transition"
        onClick={() => openDetail(idx)}
      >
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          {/* Nomor urut */}
          <div className="flex-shrink-0 w-8 h-8 bg-gray-100 text-gray-700 text-xs font-bold rounded-full flex items-center justify-center mt-0.5">
            {p.rowNumber}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-1.5 mb-1">
              <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs font-bold uppercase">
                {CATEGORY_LABELS[p.category] ?? p.category}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${VERDICT_COLORS[p.verdict] ?? 'bg-gray-100 text-gray-700'}`}>
                {VERDICT_LABELS[p.verdict] ?? p.verdict}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">{p.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {p.proposerName ? `${p.proposerName}${p.proposerUnitKerja ? ` · ${p.proposerUnitKerja}` : ''}` : null}
              {p.curatorName && (
                <span className="text-indigo-600 font-medium">
                  {p.proposerName ? ' · ' : ''}Kurator: <strong className="text-indigo-700">{p.curatorName}</strong>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center space-x-4 ml-4">
          {/* Skor AI */}
          {p.aiCidaTotal !== null && (
            <div className="text-right hidden sm:block">
              <div className="text-xs text-gray-400 font-medium">AI Score</div>
              <div className="text-sm font-bold text-indigo-700">{p.aiCidaTotal.toFixed(1)}</div>
            </div>
          )}
          {/* Vote summary */}
          {totalVotes > 0 && (
            <div className="text-right hidden sm:block">
              <div className="text-xs text-gray-400 font-medium">Konsensus</div>
              <div className="text-sm font-semibold">
                <span className="text-blue-700">{nomCount}✓</span>
                <span className="text-gray-300 mx-1">/</span>
                <span className="text-red-500">{notCount}✗</span>
              </div>
            </div>
          )}
          <span className="text-teal-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition">
            Bahas →
          </span>
        </div>
      </div>
    );
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="flex w-full h-full">
      {/* Sidebar Tabs */}
      <div className="w-52 bg-white border-r border-gray-200 flex flex-col shadow-sm z-0 flex-shrink-0">
        {(['list', 'detail', 'penetapan'] as const).map((tab, i) => {
          const labels = ['1. List Proposal', '2. Diskusi & Voting', '3. Penetapan Hasil'];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`p-4 text-left text-sm font-semibold border-b border-gray-100 transition ${
                activeTab === tab
                  ? 'bg-teal-50 text-teal-700 border-l-4 border-l-teal-600'
                  : 'text-gray-600 hover:bg-gray-50 border-l-4 border-l-transparent'
              }`}
            >
              {labels[i]}
            </button>
          );
        })}

        {/* Progress indicator */}
        <div className="p-4 mt-auto border-t border-gray-100">
          <div className="text-xs text-gray-500 font-medium mb-1">Pool FGD</div>
          <div className="text-2xl font-black text-gray-900">{proposals.length}</div>
          <div className="text-xs text-gray-400">Proposal</div>
          {fgd.status !== 'locked' && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 font-medium mb-1">Target</div>
              <div className="text-2xl font-black text-teal-700">{fgd.targetCandidates}</div>
              <div className="text-xs text-gray-400">Kandidat</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">

        {/* ── TAB 1: List Ringkas ──────────────────────────────────────────── */}
        {activeTab === 'list' && (
          <div className="p-6 overflow-y-auto h-full">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Pool Proposal — {proposals.length} proposal
            </h2>

            {proposals.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                <div className="text-4xl mb-3">📭</div>
                <p className="font-medium">Tidak ada proposal yang sesuai filter.</p>
                <p className="text-sm mt-1">Coba ubah filter status di pengaturan sesi FGD.</p>
              </div>
            ) : fgd.viewMode === 'grouped' ? (
              // ── GROUPED MODE ──
              <div className="space-y-6">
                {Object.entries(groupedProposals).map(([groupName, groupProps]) => (
                  <div key={groupName} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="font-bold text-gray-800 text-sm">{groupName}</h3>
                      <span className="text-xs text-gray-500 font-medium">{groupProps.length} proposal</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {groupProps.map((p) => {
                        const idx = proposals.findIndex(x => x.id === p.id);
                        return <ProposalRow key={p.id} p={p} idx={idx} />;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // ── MIXED / FLAT MODE ──
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
                {proposals.map((p, idx) => (
                  <ProposalRow key={p.id} p={p} idx={idx} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Detail & Diskusi ──────────────────────────────────────── */}
        {activeTab === 'detail' && (
          <div className="flex flex-col h-full">
            {!activeProposal ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-5xl mb-4">💬</div>
                  <p className="font-medium mb-3">Belum ada proposal yang dipilih untuk dibahas.</p>
                  <button
                    onClick={() => setActiveTab('list')}
                    className="text-teal-600 font-medium hover:underline text-sm"
                  >
                    ← Pilih dari List Proposal
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Navigation Header */}
                <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shadow-sm flex-shrink-0">
                  <button
                    disabled={activeProposalIdx === 0}
                    onClick={() => setActiveProposalIdx(activeProposalIdx! - 1)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-30 transition"
                  >
                    ← Sebelumnya
                  </button>
                  <div className="text-center">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Proposal {activeProposalIdx! + 1} dari {proposals.length}
                    </span>
                    <div className="flex items-center justify-center space-x-1 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${VERDICT_COLORS[activeProposal.verdict] ?? ''}`}>
                        {VERDICT_LABELS[activeProposal.verdict] ?? activeProposal.verdict}
                      </span>
                      <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs font-bold">
                        {CATEGORY_LABELS[activeProposal.category] ?? activeProposal.category}
                      </span>
                    </div>
                  </div>
                  <button
                    disabled={activeProposalIdx === proposals.length - 1}
                    onClick={() => setActiveProposalIdx(activeProposalIdx! + 1)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-30 transition"
                  >
                    Selanjutnya →
                  </button>
                </div>

                {/* Split View */}
                <div className="flex-1 flex overflow-hidden">
                  {/* LEFT: Proposal Detail */}
                  <div className="w-1/2 p-6 overflow-y-auto border-r border-gray-200 bg-white">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          No. {activeProposal.rowNumber}
                        </span>
                        <div className="flex items-center space-x-3 mt-1">
                          <h2 className="text-xl font-bold text-gray-900 leading-tight">{activeProposal.title}</h2>
                          {activeProposal.linkProposal && (
                            <a
                              href={activeProposal.linkProposal}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition whitespace-nowrap"
                            >
                              Buka Dokumen Sumber ↗
                            </a>
                          )}
                        </div>
                        <p className="text-gray-500 mt-1 text-sm">
                          {activeProposal.proposerName ? `${activeProposal.proposerName}${activeProposal.proposerUnitKerja ? ` · ${activeProposal.proposerUnitKerja}` : ''}` : null}
                          {activeProposal.curatorName && (
                            <span className="text-indigo-600 font-medium ml-2">
                              {activeProposal.proposerName ? '· ' : ''}Kurator: <strong className="text-indigo-700">{activeProposal.curatorName}</strong>
                            </span>
                          )}
                        </p>
                      </div>
                      {activeProposal.aiCidaTotal !== null && (
                        <div className="text-right flex-shrink-0 ml-4">
                          <div className="text-xs text-gray-400 font-medium">Skor AI</div>
                          <div className="text-2xl font-black text-indigo-700">{activeProposal.aiCidaTotal.toFixed(1)}</div>
                        </div>
                      )}
                    </div>

                    {/* NEW AI ANALYSIS SECTION */}
                    <div className="bg-gray-50 p-5 rounded-md border border-gray-200 mb-6 relative">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-indigo-900 text-sm uppercase tracking-wide flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          Rangkuman Proposal
                        </h4>
                        {!localAiAnalyses[activeProposal.id] && isGeneratingAi[activeProposal.id] && (
                          <span className="flex items-center text-indigo-600 text-xs font-semibold bg-indigo-50 px-3 py-1.5 rounded shadow-sm">
                            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Memproses...
                          </span>
                        )}
                      </div>

                      {aiError[activeProposal.id] && (
                        <div className="bg-red-50 text-red-700 p-3 rounded text-sm mb-3 border border-red-200">
                          {aiError[activeProposal.id]}
                        </div>
                      )}

                      {localAiAnalyses[activeProposal.id] ? (
                        <div className="space-y-4">
                          {/* 1. Structured Summary */}
                          <div className="text-sm text-gray-700 space-y-2">
                            <div><strong className="text-gray-900">Masalah:</strong> {localAiAnalyses[activeProposal.id].structuredSummary?.problem || '-'}</div>
                            <div><strong className="text-gray-900">Solusi:</strong> {localAiAnalyses[activeProposal.id].structuredSummary?.solution || '-'}</div>
                            <div><strong className="text-gray-900">Target:</strong> {localAiAnalyses[activeProposal.id].structuredSummary?.target || '-'}</div>
                          </div>

                          {/* 2. Key Claims */}
                          {localAiAnalyses[activeProposal.id].keyClaims?.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                              {localAiAnalyses[activeProposal.id].keyClaims.map((claim: string, idx: number) => (
                                <span key={idx} className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-indigo-200 shadow-sm flex items-center">
                                  🎯 {claim}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* 3. Clarification Points */}
                          {localAiAnalyses[activeProposal.id].clarificationPoints?.length > 0 && (
                            <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded">
                              <h5 className="text-xs font-bold text-orange-800 mb-1 flex items-center">
                                ⚠️ Poin Perlu Klarifikasi
                              </h5>
                              <ul className="list-disc list-inside text-xs text-orange-900 space-y-1 ml-1">
                                {localAiAnalyses[activeProposal.id].clarificationPoints.map((point: string, idx: number) => (
                                  <li key={idx} className="leading-snug">{point}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 4. Duplication Check */}
                          {localAiAnalyses[activeProposal.id].duplicationCheck && (
                            <div className="bg-gray-100 border border-gray-300 p-3 rounded flex items-start">
                              <span className="text-gray-500 mr-2">🔍</span>
                              <p className="text-xs text-gray-700 leading-snug">
                                <strong className="font-semibold">Cek Duplikasi: </strong>
                                {localAiAnalyses[activeProposal.id].duplicationCheck}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {activeProposal.summary && (
                            <p className="text-gray-600 text-sm italic mb-4 border-l-2 border-gray-300 pl-3">
                              {activeProposal.summary}
                            </p>
                          )}
                          <p className="text-gray-500 text-sm">
                            Memproses rangkuman proposal, klaim kunci, dan potensi duplikasi...
                          </p>
                        </div>
                      )}
                    </div>

                    {/* CATATAN KURATOR SECTION (Tepat di bawah Rangkuman Proposal) */}
                    <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-lg mb-6 shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <span>📝</span> Catatan Kurator{activeProposal.curatorName ? ` — ${activeProposal.curatorName}` : ''}
                        </h4>
                        {activeProposal.verdict && (
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${VERDICT_COLORS[activeProposal.verdict] ?? 'bg-gray-100 text-gray-700'}`}>
                            {VERDICT_LABELS[activeProposal.verdict] ?? activeProposal.verdict}
                          </span>
                        )}
                      </div>
                      {activeProposal.curatorNotes || activeProposal.curatorRecommendation ? (
                        <div className="space-y-2 text-xs text-amber-950">
                          {activeProposal.curatorNotes && (
                            <p className="whitespace-pre-wrap leading-relaxed font-medium">
                              {activeProposal.curatorNotes}
                            </p>
                          )}
                          {activeProposal.curatorRecommendation && (
                            <div className="pt-2 border-t border-amber-200/60 text-amber-900">
                              <strong className="font-semibold">Rekomendasi: </strong>
                              <span>{activeProposal.curatorRecommendation}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700/80 italic">
                          Tidak ada catatan dari kurator saat screening.
                        </p>
                      )}
                    </div>

                    {/* NEW ADDITIONAL DOCUMENT AI ANALYSIS SECTION */}
                    <div className="bg-white p-5 rounded-md border border-indigo-100 shadow-sm mb-6 relative">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-indigo-900 text-sm uppercase tracking-wide flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Analisis Dokumen Tambahan
                        </h4>
                        
                        {/* Koordinator Only Upload Button */}
                        {!readOnly && session?.roles?.includes('coordinator') && (
                          <div className="flex flex-col items-end">
                            <label className={`cursor-pointer inline-flex items-center px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-colors ${
                              isUploadingDoc[activeProposal.id] 
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}>
                              {isUploadingDoc[activeProposal.id] ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  Mengunggah...
                                </>
                              ) : (
                                'Tambah Dokumen'
                              )}
                              <input 
                                type="file" 
                                accept=".pdf" 
                                className="hidden" 
                                onChange={(e) => handleUploadDocument(activeProposal.id, e)}
                                disabled={isUploadingDoc[activeProposal.id]}
                              />
                            </label>
                            <span className="text-[10px] text-gray-400 mt-1">Maks 10MB (Hanya PDF)</span>
                          </div>
                        )}
                      </div>

                      {uploadError[activeProposal.id] && (
                        <div className="bg-red-50 text-red-700 p-3 rounded text-sm mb-3 border border-red-200">
                          {uploadError[activeProposal.id]}
                        </div>
                      )}

                      {localAdditionalDocs[activeProposal.id] && localAdditionalDocs[activeProposal.id].length > 0 ? (
                        <div className="space-y-4 text-sm text-gray-700 border-t border-gray-100 pt-3">
                          {localAdditionalDocs[activeProposal.id].map((doc: any, idx: number) => (
                            <div key={doc.id || idx} className="bg-gray-50 p-4 rounded border border-gray-200 relative">
                              {!readOnly && session?.roles?.includes('coordinator') && (
                                <button 
                                  onClick={() => handleDeleteDoc(activeProposal.id, doc.id)}
                                  disabled={isDeletingDoc[doc.id]}
                                  className="absolute top-2 right-2 text-gray-400 hover:text-red-600 transition-colors bg-white p-1 rounded shadow-sm border border-gray-200 disabled:opacity-50"
                                  title="Hapus dokumen ini"
                                >
                                  {isDeletingDoc[doc.id] ? (
                                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  )}
                                </button>
                              )}
                              
                              <div className="flex items-center justify-between mb-3 pr-8">
                                <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 flex items-center">
                                  📄 {doc.fileName}
                                </span>
                                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-xs font-semibold flex items-center">
                                  Buka File <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                              </div>
                              
                              <div className="space-y-3">
                                <div><strong className="text-gray-900 block mb-1">Rangkuman Tambahan:</strong> {doc.aiAnalysis?.summary || '-'}</div>
                                
                                {doc.aiAnalysis?.keyFindings?.length > 0 && (
                                  <div>
                                    <strong className="text-gray-900 block mb-1">Temuan Penting:</strong>
                                    <ul className="list-disc list-inside space-y-1 ml-1 text-gray-600">
                                      {doc.aiAnalysis.keyFindings.map((kf: string, i: number) => (
                                        <li key={i} className="leading-snug">{kf}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                <div><strong className="text-gray-900 block mb-1">Metodologi:</strong> {doc.aiAnalysis?.methodology || '-'}</div>
                                <div><strong className="text-gray-900 block mb-1">Validitas Data:</strong> {doc.aiAnalysis?.dataValidity || '-'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded">
                          Belum ada dokumen tambahan untuk proposal ini.<br />
                          {!readOnly && session?.roles?.includes('coordinator') && "Koordinator dapat mengunggah file PDF untuk dianalisis oleh AI."}
                        </div>
                      )}
                    </div>

                    {!readOnly && (
                    <div className="bg-blue-50 border border-blue-100 p-5 rounded-md">
                      <h4 className="font-semibold text-blue-900 mb-1 text-center">Voting Konsensus</h4>
                      <p className="text-xs text-blue-600 text-center mb-4">Vote Anda bisa diubah kapan saja selama sesi masih aktif</p>
                      <div className="flex justify-center space-x-4">
                        <button
                          onClick={() => handleVote(activeProposal.id, 'nominate')}
                          disabled={fgd.status === 'locked' || isVoting}
                          className={`px-6 py-2.5 rounded-full font-bold transition shadow-sm border text-sm ${
                            myVote(activeProposal.id) === 'nominate'
                              ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300'
                              : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100 disabled:opacity-50'
                          }`}
                        >
                          {isVoting ? '⏳' : '👍'} Nominasikan
                        </button>
                        <button
                          onClick={() => handleVote(activeProposal.id, 'not_nominate')}
                          disabled={fgd.status === 'locked' || isVoting}
                          className={`px-6 py-2.5 rounded-full font-bold transition shadow-sm border text-sm ${
                            myVote(activeProposal.id) === 'not_nominate'
                              ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-300'
                              : 'bg-white text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-50'
                          }`}
                        >
                          {isVoting ? '⏳' : '👎'} Tidak Nominasikan
                        </button>
                      </div>

                      {myVote(activeProposal.id) && (
                        <div className="mt-3 text-center">
                          <button
                            onClick={() => handleVote(activeProposal.id, 'cancel')}
                            disabled={fgd.status === 'locked' || isVoting}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
                          >
                            Batalkan Pilihan
                          </button>
                        </div>
                      )}
                    </div>
                    )}

                      <div className="mt-4 flex justify-center gap-4 text-sm font-semibold">
                        <span className="text-blue-700">
                          {voteCount(activeProposal.id, 'nominate')} Nominasikan
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="text-red-500">
                          {voteCount(activeProposal.id, 'not_nominate')} Tidak
                        </span>
                      </div>
                  </div>

                  {/* RIGHT: Diskusi Thread */}
                  <div className="w-1/2 p-6 flex flex-col bg-gray-50">
                    <h3 className="font-bold text-gray-800 mb-4 flex-shrink-0">Ruang Diskusi</h3>

                    {/* Chat Thread */}
                    <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-1">
                      {comments.filter(c => c.proposalId === activeProposal.id).length === 0 ? (
                        <p className="text-gray-400 text-sm italic text-center mt-10">
                          Belum ada catatan diskusi untuk proposal ini.
                        </p>
                      ) : (
                        comments
                          .filter(c => c.proposalId === activeProposal.id)
                          .map(c => (
                            <div key={c.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-xs text-gray-900">{c.curatorName ?? 'Anonim'}</span>
                                <span className="text-xs text-gray-400">
                                  {new Date(c.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                            </div>
                          ))
                      )}
                    </div>

                    {/* Input */}
                    {fgd.status !== 'locked' && !readOnly && (
                      <form onSubmit={handleComment} className="flex-shrink-0">
                        <div className="flex space-x-2 bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                          <input
                            type="text"
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            placeholder="Ketik catatan diskusi..."
                            className="flex-1 px-2 py-1.5 focus:outline-none text-sm text-gray-900 bg-white"
                          />
                          <button
                            type="submit"
                            disabled={submitting || !commentText.trim()}
                            className="bg-teal-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition flex-shrink-0"
                          >
                            {submitting ? '...' : 'Kirim'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB 3: Penetapan Hasil ───────────────────────────────────────── */}
        {activeTab === 'penetapan' && (
          <div className="p-6 overflow-y-auto h-full flex flex-col">
            <div className="flex justify-between items-start mb-6 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">Penetapan Hasil Final FGD</h2>
                <p className="text-gray-500 text-sm">
                  Diurutkan berdasarkan jumlah vote "Nominasikan" terbanyak. Penetapan final adalah keputusan manual Koordinator.
                </p>
              </div>

              <div className="text-right flex-shrink-0 ml-6">
                {fgd.status === 'locked' ? (
                  <a
                    href={`/api/pdf/fgd/${fgd.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-medium shadow"
                  >
                    📄 Download Berita Acara PDF
                  </a>
                ) : (
                  <>
                    <div className={`text-3xl font-black ${
                      (fgd.status === 'locked' ? proposals.filter(p => fgd.fgdType === 'promoter' ? p.status === 'grand_final' : (fgd.scope === 'nasional' ? p.status === 'promotor_selection' : p.status === 'regional_finalist')).length : selectedForFinal.length) === fgd.targetCandidates ? 'text-green-600' : 'text-teal-600'
                    }`}>
                      {fgd.status === 'locked' ? proposals.filter(p => fgd.fgdType === 'promoter' ? p.status === 'grand_final' : (fgd.scope === 'nasional' ? p.status === 'promotor_selection' : p.status === 'regional_finalist')).length : selectedForFinal.length}
                      <span className="text-gray-400 text-xl mx-1">/</span>
                      <span className="text-gray-700 text-xl">{fgd.targetCandidates}</span>
                    </div>
                    <div className="text-xs text-gray-500 font-semibold uppercase mt-0.5">
                      {(fgd.status === 'locked' ? proposals.filter(p => fgd.fgdType === 'promoter' ? p.status === 'grand_final' : (fgd.scope === 'nasional' ? p.status === 'promotor_selection' : p.status === 'regional_finalist')).length : selectedForFinal.length) === fgd.targetCandidates ? '✅ Target tercapai' : 'Proposal dipilih'}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {!readOnly && session.roles.includes('coordinator') && (
                      <th className="px-4 py-3 w-12 text-center font-semibold text-gray-600">
                        {fgd.status === 'locked' ? 'Aksi' : 'Pilih'}
                      </th>
                    )}
                    <th className="px-4 py-3 font-semibold text-gray-600 w-8">#</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Proposal</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 text-center">Vote Nominasi</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 text-center hidden sm:table-cell">Skor AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedByVotes.map((p, rank) => {
                    let isSelected = selectedForFinal.includes(p.id);
                    if (fgd.status === 'locked') {
                      if (fgd.fgdType === 'promoter') isSelected = p.status === 'grand_final';
                      else if (fgd.scope === 'nasional') isSelected = p.status === 'promotor_selection';
                      else isSelected = p.status === 'regional_finalist';
                    }
                    const nom = voteCount(p.id, 'nominate');
                    const notNom = voteCount(p.id, 'not_nominate');
                    return (
                      <tr
                        key={p.id}
                        className={`transition ${isSelected ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                      >
                        {!readOnly && session.roles.includes('coordinator') && (
                          <td className="px-4 py-3 text-center">
                            {fgd.status !== 'locked' ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleFinalSelection(p.id)}
                                className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
                              />
                            ) : (
                              isSelected ? (
                                <button
                                  onClick={() => handleReleaseProposal(p.id)}
                                  disabled={releasing[p.id]}
                                  className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 disabled:opacity-50 font-bold"
                                  title="Release proposal ini"
                                >
                                  {releasing[p.id] ? '...' : '✖ Release'}
                                </button>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 text-gray-500 text-xs font-bold">{rank + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 text-sm leading-snug">{p.title}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs text-gray-500">{p.proposerName}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${VERDICT_COLORS[p.verdict] ?? ''}`}>
                              {VERDICT_LABELS[p.verdict] ?? p.verdict}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                            <span className="text-blue-700">{nom} ✓</span>
                            {notNom > 0 && <span className="text-red-500">{notNom} ✗</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                          {p.aiCidaTotal !== null ? (
                            <span className="font-bold text-indigo-700 text-sm">{p.aiCidaTotal.toFixed(1)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Lock Button */}
            {!readOnly && session.roles.includes('coordinator') && fgd.status !== 'locked' && (
              <div className="mt-6 flex items-center justify-between flex-shrink-0">
                <p className="text-xs text-gray-400">
                  {selectedForFinal.length === 0
                    ? 'Pilih minimal 1 proposal untuk bisa menetapkan hasil.'
                    : selectedForFinal.length !== fgd.targetCandidates
                    ? `ℹ️ Jumlah dipilih (${selectedForFinal.length}) berbeda dari target (${fgd.targetCandidates}).`
                    : `✅ Jumlah sesuai target.`}
                </p>
                <button
                  onClick={handleLock}
                  disabled={locking || selectedForFinal.length === 0}
                  className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition shadow disabled:opacity-50 text-sm"
                >
                  {locking ? 'Memproses...' : '🔒 Tetapkan Hasil FGD & Kunci Sesi'}
                </button>
              </div>
            )}

            {fgd.status === 'locked' && (
              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 font-medium flex-shrink-0">
                ✅ Sesi FGD ini sudah dikunci. Hasil penetapan sudah berlaku dan tidak bisa diubah.
              </div>
            )}
          </div>
        )}
      </div>
      {/* Custom Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-gray-100">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
              <p className="text-gray-600">{confirmModal.message}</p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-100">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  confirmModal.onConfirm();
                }}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-sm shadow-sm transition-colors"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
