'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitFgdCommentAction, submitFgdVoteAction, lockFgdSessionAction } from '@/app/actions/fgd';

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
  rowNumber: number;
  verdict: string;
};

type Vote = { id: number; proposalId: number; curatorId: number; vote: string };
type Comment = { id: number; proposalId: number; curatorId: number; content: string; createdAt: string; curatorName: string | null };

export default function FgdRoomClient({ 
  session, fgd, proposals, votes, comments 
}: { 
  session: any;
  fgd: any;
  proposals: Proposal[];
  votes: Vote[];
  comments: Comment[];
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();

  const [activeTab, setActiveTab] = useState<'list' | 'detail' | 'penetapan'>('list');
  const [activeProposalIdx, setActiveProposalIdx] = useState<number | null>(null);
  
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locking, setLocking] = useState(false);
  const [selectedForFinal, setSelectedForFinal] = useState<number[]>([]);

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
      : p.category;
    if (!groupedProposals[key]) groupedProposals[key] = [];
    groupedProposals[key].push(p);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  async function handleVote(proposalId: number, voteType: string) {
    if (fgd.status === 'locked') return;
    await submitFgdVoteAction(fgd.id, proposalId, voteType as any);
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
    if (!confirm(`Yakin ingin menetapkan ${selectedForFinal.length} proposal ini sebagai hasil final? Sesi akan dikunci dan tidak bisa diedit.`)) return;
    setLocking(true);
    const res = await lockFgdSessionAction(fgd.id, selectedForFinal);
    setLocking(false);
    if (res.error) {
      alert(res.error);
    } else {
      refresh();
    }
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
            <p className="text-xs text-gray-500 mt-0.5">{p.proposerName}{p.proposerUnitKerja ? ` · ${p.proposerUnitKerja}` : ''}</p>
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
                        <h2 className="text-xl font-bold text-gray-900 mt-1 leading-tight">{activeProposal.title}</h2>
                        <p className="text-gray-500 mt-1 text-sm">{activeProposal.proposerName}
                          {activeProposal.proposerUnitKerja && ` · ${activeProposal.proposerUnitKerja}`}
                        </p>
                      </div>
                      {activeProposal.aiCidaTotal !== null && (
                        <div className="text-right flex-shrink-0 ml-4">
                          <div className="text-xs text-gray-400 font-medium">Skor AI</div>
                          <div className="text-2xl font-black text-indigo-700">{activeProposal.aiCidaTotal.toFixed(1)}</div>
                        </div>
                      )}
                    </div>

                    {activeProposal.summary && (
                      <div className="bg-gray-50 p-4 rounded-md border border-gray-100 mb-6">
                        <h4 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">Ringkasan AI</h4>
                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{activeProposal.summary}</p>
                      </div>
                    )}

                    {/* VOTE AREA */}
                    <div className="bg-blue-50 border border-blue-100 p-5 rounded-md">
                      <h4 className="font-semibold text-blue-900 mb-1 text-center">Voting Konsensus</h4>
                      <p className="text-xs text-blue-600 text-center mb-4">Vote Anda bisa diubah kapan saja selama sesi masih aktif</p>
                      <div className="flex justify-center space-x-4">
                        <button
                          onClick={() => handleVote(activeProposal.id, 'nominate')}
                          disabled={fgd.status === 'locked'}
                          className={`px-6 py-2.5 rounded-full font-bold transition shadow-sm border text-sm ${
                            myVote(activeProposal.id) === 'nominate'
                              ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300'
                              : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100 disabled:opacity-50'
                          }`}
                        >
                          👍 Nominasikan
                        </button>
                        <button
                          onClick={() => handleVote(activeProposal.id, 'not_nominate')}
                          disabled={fgd.status === 'locked'}
                          className={`px-6 py-2.5 rounded-full font-bold transition shadow-sm border text-sm ${
                            myVote(activeProposal.id) === 'not_nominate'
                              ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-300'
                              : 'bg-white text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-50'
                          }`}
                        >
                          👎 Tidak Nominasikan
                        </button>
                      </div>
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
                    {fgd.status !== 'locked' && (
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
                    <div className={`text-3xl font-black ${selectedForFinal.length === fgd.targetCandidates ? 'text-green-600' : 'text-teal-600'}`}>
                      {selectedForFinal.length}
                      <span className="text-gray-400 text-xl mx-1">/</span>
                      <span className="text-gray-700 text-xl">{fgd.targetCandidates}</span>
                    </div>
                    <div className="text-xs text-gray-500 font-semibold uppercase mt-0.5">
                      {selectedForFinal.length === fgd.targetCandidates ? '✅ Target tercapai' : 'Proposal dipilih'}
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
                    {session.roles.includes('coordinator') && fgd.status !== 'locked' && (
                      <th className="px-4 py-3 w-12 text-center font-semibold text-gray-600">Pilih</th>
                    )}
                    <th className="px-4 py-3 font-semibold text-gray-600 w-8">#</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Proposal</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 text-center">Vote Nominasi</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 text-center hidden sm:table-cell">Skor AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedByVotes.map((p, rank) => {
                    const isSelected = selectedForFinal.includes(p.id);
                    const nom = voteCount(p.id, 'nominate');
                    const notNom = voteCount(p.id, 'not_nominate');
                    return (
                      <tr
                        key={p.id}
                        className={`transition ${isSelected ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                      >
                        {session.roles.includes('coordinator') && fgd.status !== 'locked' && (
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFinalSelection(p.id)}
                              className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
                            />
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
            {session.roles.includes('coordinator') && fgd.status !== 'locked' && (
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
    </div>
  );
}
