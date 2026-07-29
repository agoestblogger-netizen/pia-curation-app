'use client';

import { useState, useTransition, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { compareProposalsAction, searchProposalsByCategory, SimilarityResult, getProposalSideBySideData, SideBySideProposal, generateSingleProposalAnalysis } from '@/app/actions/compareProposals';
import { markPotentialDuplicate } from '@/app/actions/duplicates';

interface CompareProposalsPanelProps {
  proposalId: number;
  proposalTitle: string;
  category: string;
  competitionId: number;
  isReadOnly?: boolean;
  isViewer?: boolean;
}

export default function CompareProposalsPanel({
  proposalId,
  proposalTitle,
  category,
  competitionId,
  isReadOnly = false,
  isViewer = false,
}: CompareProposalsPanelProps) {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: number; title: string; nomorUrut: number | null }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<{ id: number; title: string } | null>(null);
  const [result, setResult] = useState<SimilarityResult | null>(null);
  const [sideBySide, setSideBySide] = useState<{ a?: SideBySideProposal; b?: SideBySideProposal } | null>(null);
  // Per-column generate state: 'idle' | 'loading' | 'error'
  const [genStateA, setGenStateA] = useState<'idle' | 'loading' | 'error'>('idle');
  const [genStateB, setGenStateB] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const [showMarkDuplicate, setShowMarkDuplicate] = useState(false);
  const [duplicateNote, setDuplicateNote] = useState('');
  const [markStatus, setMarkStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [markError, setMarkError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(async () => {
        setIsSearching(true);
        const rows = await searchProposalsByCategory(category, proposalId, competitionId, value);
        setSearchResults(rows);
        setIsSearching(false);
      }, 300);
    },
    [category, proposalId, competitionId]
  );

  const handleOpen = () => {
    setIsOpen(true);
    // Load all proposals in same category on open
    handleSearch('');
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    setSearchResults([]);
    setSelectedProposal(null);
    setResult(null);
    setSideBySide(null);
    setGenStateA('idle');
    setGenStateB('idle');
    setError(null);
    setShowMarkDuplicate(false);
    setDuplicateNote('');
    setMarkStatus('idle');
    setMarkError(null);
  };

  const handleSelect = (p: { id: number; title: string }) => {
    setSelectedProposal(p);
    setResult(null);
    setSideBySide(null);
    setGenStateA('idle');
    setGenStateB('idle');
    setError(null);
    setQuery('');
    setSearchResults([]);
    setShowMarkDuplicate(false);
    setDuplicateNote('');
    setMarkStatus('idle');
    setMarkError(null);
    // Pre-fetch side-by-side data when proposal B is selected
    startTransition(async () => {
      const data = await getProposalSideBySideData(proposalId, p.id);
      if (!data.error) setSideBySide(data);
    });
  };

  // Auto-generate missing analysis columns in parallel
  const triggerGenerate = useCallback(async (col: 'a' | 'b', pid: number) => {
    const setGenState = col === 'a' ? setGenStateA : setGenStateB;
    setGenState('loading');
    const res = await generateSingleProposalAnalysis(pid);
    if (res.error) {
      setGenState('error');
    } else if (res.data) {
      setGenState('idle');
      setSideBySide(prev => {
        if (!prev) return prev;
        const updated = { ...prev };
        (updated[col] as SideBySideProposal) = { ...updated[col]!, aiAnalysis: res.data! };
        return updated;
      });
    }
  }, []);

  useEffect(() => {
    if (!sideBySide) return;
    if (sideBySide.a && !sideBySide.a.aiAnalysis && genStateA === 'idle') {
      triggerGenerate('a', sideBySide.a.id);
    }
    if (sideBySide.b && !sideBySide.b.aiAnalysis && genStateB === 'idle') {
      triggerGenerate('b', sideBySide.b.id);
    }
  }, [sideBySide, genStateA, genStateB, triggerGenerate]);

  const autoLoaded = useRef(false);
  useEffect(() => {
    const compareId = searchParams.get('compareId');
    const compareTitle = searchParams.get('compareTitle');
    if (compareId && !autoLoaded.current) {
      autoLoaded.current = true;
      setIsOpen(true);
      const targetP = { id: parseInt(compareId, 10), title: compareTitle || `Proposal #${compareId}` };
      handleSelect(targetP);
      handleCompareWithArg(targetP.id);
    }
  }, [searchParams]);

  const handleCompareWithArg = (targetId: number) => {
    setResult(null);
    setError(null);
    setShowMarkDuplicate(false);
    setDuplicateNote('');
    setMarkStatus('idle');
    setMarkError(null);
    startTransition(async () => {
      const res = await compareProposalsAction(proposalId, targetId);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setResult(res.data);
      }
    });
  };

  const handleCompare = () => {
    if (!selectedProposal) return;
    handleCompareWithArg(selectedProposal.id);
  };

  const handleMarkDuplicate = async () => {
    if (!selectedProposal || !result) return;
    setMarkStatus('loading');
    setMarkError(null);
    const res = await markPotentialDuplicate(proposalId, selectedProposal.id, result.tingkatKemiripan, duplicateNote);
    if (res.error) {
      setMarkError(res.error);
      setMarkStatus('error');
    } else {
      setMarkStatus('success');
    }
  };

  const levelColor = (level: string) => {
    if (level === 'TINGGI') return 'bg-red-100 text-red-700 border-red-200';
    if (level === 'SEDANG') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  if (isReadOnly && !isOpen) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-gray-900">Deteksi Kemiripan</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium border border-amber-200">
            AI
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Bandingkan dengan proposal lain dalam kategori {category} untuk mendeteksi potensi duplikasi.
        </p>

        {!isOpen ? (
          <button
            onClick={handleOpen}
            className="w-full px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Bandingkan dengan Proposal Lain
          </button>
        ) : (
          <div className="space-y-4">
            {/* Proposal A — current */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs font-semibold text-blue-600 mb-1">PROPOSAL A (Sedang Dilihat)</div>
              <div className="text-sm font-medium text-blue-900 line-clamp-2">{proposalTitle}</div>
            </div>

            {/* Proposal B — search & select */}
            {!selectedProposal ? (
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">PROPOSAL B (Pilih Pembanding)</div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={`Cari proposal ${category} lainnya...`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  autoFocus
                />
                <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                  {isSearching ? (
                    <div className="p-3 text-sm text-gray-400 text-center animate-pulse">Mencari...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-3 text-sm text-gray-400 text-center">
                      {query ? 'Tidak ada proposal yang cocok.' : `Tidak ada proposal ${category} lain.`}
                    </div>
                  ) : (
                    searchResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleSelect(r)}
                        className="w-full text-left px-3 py-2.5 hover:bg-amber-50 border-b border-gray-100 last:border-0 transition-colors"
                      >
                        <span className="text-xs font-mono text-gray-400 mr-2">#{r.nomorUrut || r.id}</span>
                        <span className="text-sm text-gray-800">{r.title}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg relative">
                  <div className="text-xs font-semibold text-green-600 mb-1">PROPOSAL B (Pembanding)</div>
                  <div className="text-sm font-medium text-green-900 line-clamp-2 pr-6">{selectedProposal.title}</div>
                  {!isReadOnly && (
                    <button
                      onClick={() => { setSelectedProposal(null); setResult(null); setError(null); }}
                      className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                      title="Ganti pembanding"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Compare button */}
                {!result && !isPending && (
                  <button
                    onClick={handleCompare}
                    className="mt-3 w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Analisis Kemiripan dengan AI
                  </button>
                )}

                {/* Loading state */}
                {isPending && (
                  <div className="mt-3 w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    AI sedang menganalisis kemiripan...
                  </div>
                )}

                {/* Error state */}
                {error && !isPending && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 mb-2">⚠ {error}</p>
                    <button
                      onClick={handleCompare}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 underline"
                    >
                      Coba Lagi
                    </button>
                  </div>
                )}

                {/* Result */}
                {result && !isPending && (
                  <div className="mt-4 space-y-3">
                    <div className={`px-4 py-2.5 rounded-lg border font-bold text-center text-lg tracking-wide ${levelColor(result.tingkatKemiripan)}`}>
                      Tingkat Kemiripan: {result.tingkatKemiripan}
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Ringkasan</div>
                      <p className="text-sm text-gray-800 leading-relaxed">{result.ringkasan}</p>
                    </div>

                    {result.yangMirip.length > 0 && (
                      <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                        <div className="text-xs font-semibold text-red-600 mb-2 uppercase tracking-wide">Yang Mirip</div>
                        <ul className="space-y-1">
                          {result.yangMirip.map((item, i) => (
                            <li key={i} className="text-sm text-gray-800 flex gap-2">
                              <span className="text-red-400 flex-shrink-0 mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.yangBeda.length > 0 && (
                      <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                        <div className="text-xs font-semibold text-green-600 mb-2 uppercase tracking-wide">Yang Beda</div>
                        <ul className="space-y-1">
                          {result.yangBeda.map((item, i) => (
                            <li key={i} className="text-sm text-gray-800 flex gap-2">
                              <span className="text-green-500 flex-shrink-0 mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.catatanTag && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="text-xs font-semibold text-blue-500 mb-1 uppercase tracking-wide">Catatan Sub-Tema</div>
                        <p className="text-xs text-blue-700 leading-relaxed">{result.catatanTag}</p>
                      </div>
                    )}

                    {/* Side-by-side section */}
                    {sideBySide?.a && sideBySide?.b && (
                      <div className="pt-2 border-t border-gray-100">
                        <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Sandingkan Proposal</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {([
                            { label: 'PROPOSAL A', data: sideBySide.a },
                            { label: 'PROPOSAL B', data: sideBySide.b },
                          ] as { label: string; data: SideBySideProposal }[]).map(({ label, data }) => (
                            <div key={label} className={`rounded-lg border p-3 space-y-3 ${label === 'PROPOSAL A' ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'}`}>
                              <div className={`text-xs font-bold uppercase tracking-wide ${label === 'PROPOSAL A' ? 'text-blue-600' : 'text-green-600'}`}>{label}</div>
                              <div className="text-xs font-medium text-gray-900 leading-snug">{data.title}</div>

                              {/* AI CIDA Score */}
                              <div className="bg-white/70 rounded p-2">
                                <div className="text-xs font-semibold text-gray-500 mb-1.5">Skor AI CIDA</div>
                                <div className="text-xl font-black text-[#0A4736]">
                                  {data.aiCidaTotal ? data.aiCidaTotal.toFixed(1) : '-'}
                                </div>
                                <div className="mt-1.5 space-y-0.5">
                                  {[
                                    ['Solvability', data.aiCidaSolvability],
                                    ['Desirability', data.aiCidaDesirability],
                                    ['Viability', data.aiCidaViability],
                                    ['Feasibility', data.aiCidaFeasibility],
                                    ['Problem Urgency', data.aiCidaProblemUrgency],
                                    ['Uniqueness', data.aiCidaUniqueness],
                                  ].map(([lbl, val]) => (
                                    <div key={String(lbl)} className="flex justify-between text-xs text-gray-600">
                                      <span>{lbl}</span>
                                      <span className="font-medium">{val != null ? (val as number).toFixed(1) : '-'}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* AI Rangkuman */}
                              {data.aiAnalysis ? (
                                <div className="bg-white/70 rounded p-2 space-y-1.5">
                                  <div className="text-xs font-semibold text-gray-500">Rangkuman Proposal AI</div>
                                  {data.aiAnalysis.structuredSummary?.problem && (
                                    <div className="text-xs text-gray-800"><strong>Masalah:</strong> {data.aiAnalysis.structuredSummary.problem}</div>
                                  )}
                                  {data.aiAnalysis.structuredSummary?.solution && (
                                    <div className="text-xs text-gray-800"><strong>Solusi:</strong> {data.aiAnalysis.structuredSummary.solution}</div>
                                  )}
                                  {data.aiAnalysis.structuredSummary?.target && (
                                    <div className="text-xs text-gray-800"><strong>Target:</strong> {data.aiAnalysis.structuredSummary.target}</div>
                                  )}
                                  {data.aiAnalysis.keyClaims && data.aiAnalysis.keyClaims.length > 0 && (
                                    <div>
                                      <div className="text-xs font-semibold text-gray-500 mt-1.5 mb-0.5">Klaim & Angka Kunci</div>
                                      <ul className="space-y-0.5">
                                        {data.aiAnalysis.keyClaims.map((c, i) => (
                                          <li key={i} className="text-xs text-gray-700 flex gap-1"><span className="text-indigo-400 flex-shrink-0">•</span>{c}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="bg-white/70 rounded p-2 flex flex-col items-center justify-center py-4">
                                  {(label === 'PROPOSAL A' ? genStateA : genStateB) === 'loading' ? (
                                    <div className="flex flex-col items-center text-amber-600 space-y-2">
                                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                      </svg>
                                      <span className="text-xs font-medium">Membuat rangkuman...</span>
                                    </div>
                                  ) : (label === 'PROPOSAL A' ? genStateA : genStateB) === 'error' ? (
                                    <div className="flex flex-col items-center text-red-600 space-y-2 text-center">
                                      <span className="text-xs">Gagal membuat rangkuman.</span>
                                      <button 
                                        onClick={() => triggerGenerate(label === 'PROPOSAL A' ? 'a' : 'b', data.id)}
                                        className="text-xs font-semibold underline hover:text-red-800"
                                      >
                                        Coba Lagi
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isReadOnly && (
                      <button
                        onClick={handleCompare}
                        className="text-xs text-gray-500 hover:text-gray-700 underline w-full text-center pt-1"
                      >
                        Analisis ulang
                      </button>
                    )}

                    {/* Section Tandai Duplikasi */}
                    {!isReadOnly && !isViewer && (
                      <div className="pt-3 mt-3 border-t border-gray-100">
                        {markStatus === 'success' ? (
                        <div className="bg-green-50 text-green-700 p-3 rounded-lg border border-green-200 text-sm flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Tersimpan ke daftar Potensi Duplikat
                        </div>
                      ) : !showMarkDuplicate ? (
                        <button
                          onClick={() => setShowMarkDuplicate(true)}
                          className="w-full px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          Tandai sebagai Potensi Duplikasi
                        </button>
                      ) : (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-200 space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-red-700 mb-1">Catatan (opsional)</label>
                            <textarea
                              value={duplicateNote}
                              onChange={(e) => setDuplicateNote(e.target.value)}
                              placeholder="Mengapa proposal ini duplikat?"
                              className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400"
                              rows={2}
                            />
                          </div>
                          {markError && (
                            <div className="text-xs text-red-600 font-medium">⚠ {markError}</div>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowMarkDuplicate(false)}
                              disabled={markStatus === 'loading'}
                              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 bg-white rounded-lg transition-colors"
                            >
                              Batal
                            </button>
                            <button
                              onClick={handleMarkDuplicate}
                              disabled={markStatus === 'loading'}
                              className="flex-1 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              {markStatus === 'loading' ? 'Menyimpan...' : 'Simpan'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                )}
              </div>
            )}

            {/* Close / Cancel */}
            {!isReadOnly && (
              <button
                onClick={handleClose}
                className="w-full text-xs text-gray-400 hover:text-gray-600 underline text-center"
              >
                Tutup
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
