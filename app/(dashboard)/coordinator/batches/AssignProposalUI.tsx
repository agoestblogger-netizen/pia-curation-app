'use client';

import { useActionState, useState, useTransition, useEffect } from 'react';
import { assignRangeAction, deleteRangeAction } from '@/app/actions/batches';
import { assignPromoterRangeAction, deletePromoterRangeAction, togglePromotorAccessModeAction } from '@/app/actions/promoter-assignment';
import { ASSIGN_CATEGORIES, KANWIL_CITIES } from '@/lib/constants';

type UserRole = { id: number; name: string };
type Assignment = { 
  id: number; 
  proposalId: number; 
  curatorId?: number; 
  promoterId?: number;
  category: string; 
  status: string;
  proposalRowNumber: number;
  proposalRegionCenter: string | null;
};

type Block = { 
  displayCategory: string; 
  start: number; 
  end: number; 
  count: number; 
  proposalIds: number[];
  title?: string;
};

function getBlocks(assignments: Assignment[], userId: number, role: 'curator' | 'promoter', allProps: any[]): Block[] {
  const filtered = assignments.filter(a => role === 'curator' ? a.curatorId === userId : a.promoterId === userId);
  
  // Group by exact category grouping
  const byCategory: Record<string, Assignment[]> = {};
  for (const a of filtered) {
    let cat = a.category;
    if (a.category === 'PUSAT') {
      cat = 'Kantor Pusat';
    } else if (a.category === 'WILAYAH') {
      cat = a.proposalRegionCenter || 'WILAYAH';
    }
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(a);
  }
  
  const blocks: Block[] = [];
  
  for (const [cat, arr] of Object.entries(byCategory)) {
    arr.sort((a, b) => a.proposalRowNumber - b.proposalRowNumber);
    
    for (const a of arr) {
      const prop = allProps.find((p: any) => p.id === a.proposalId);
      blocks.push({
        displayCategory: cat,
        start: a.proposalRowNumber,
        end: a.proposalRowNumber,
        count: 1,
        proposalIds: [a.proposalId],
        title: prop?.title || 'Judul tidak ditemukan'
      });
    }
  }
  return blocks;
}

export default function AssignProposalUI({
  batchId,
  competitionId,
  promotorAccessMode,
  curators,
  assignments,
  allProposals,
  promoters,
  promoterAssignments,
  promotorProposals,
}: {
  batchId: number;
  competitionId: number;
  promotorAccessMode: 'open' | 'assigned';
  curators: UserRole[];
  assignments: Assignment[];
  allProposals: any[];
  promoters: UserRole[];
  promoterAssignments: Assignment[];
  promotorProposals: any[];
}) {
  const [targetTab, setTargetTab] = useState<'kurator' | 'promotor'>('kurator');

  // Kurator State
  const [stateKurator, actionKurator, isPendingKurator] = useActionState(assignRangeAction, {});
  const [isPendingDeleteKurator, startTransitionDeleteKurator] = useTransition();
  const [selectedCuratorId, setSelectedCuratorId] = useState<number | ''>('');
  const [selectedCuratorCategory, setSelectedCuratorCategory] = useState(ASSIGN_CATEGORIES[0]);
  const [checkedBlocksKurator, setCheckedBlocksKurator] = useState<Set<string>>(new Set());
  const [expandedCatsKurator, setExpandedCatsKurator] = useState<Record<string, boolean>>({});
  const [searchQueryKurator, setSearchQueryKurator] = useState('');

  const [rangeStringKurator, setRangeStringKurator] = useState('');

  // Promotor State
  const [statePromotor, actionPromotor, isPendingPromotor] = useActionState(assignPromoterRangeAction, null as any);
  const [isPendingDeletePromotor, startTransitionDeletePromotor] = useTransition();
  const [isTogglingMode, startToggleMode] = useTransition();
  const [selectedPromoterId, setSelectedPromoterId] = useState<number | ''>('');
  const [selectedPromoterCategory, setSelectedPromoterCategory] = useState('BI'); // Only BI/BC for promoter
  const [checkedBlocksPromotor, setCheckedBlocksPromotor] = useState<Set<string>>(new Set());
  const [expandedCatsPromotor, setExpandedCatsPromotor] = useState<Record<string, boolean>>({});
  const [searchQueryPromotor, setSearchQueryPromotor] = useState('');
  const [rangeStringPromotor, setRangeStringPromotor] = useState('');

  useEffect(() => { setCheckedBlocksKurator(new Set()); setRangeStringKurator(''); }, [selectedCuratorId]);
  useEffect(() => { setCheckedBlocksPromotor(new Set()); setRangeStringPromotor(''); }, [selectedPromoterId]);
  useEffect(() => { setRangeStringKurator(''); }, [selectedCuratorCategory]);
  useEffect(() => { setRangeStringPromotor(''); }, [selectedPromoterCategory]);

  // Range String Parsing Utils
  const parseRangeString = (str: string): Set<number> => {
    const set = new Set<number>();
    const parts = str.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) set.add(i);
        } else if (!isNaN(start)) {
          set.add(start);
        }
      } else {
        const num = parseInt(part);
        if (!isNaN(num)) set.add(num);
      }
    }
    return set;
  };

  const formatRangeString = (nums: Set<number>): string => {
    if (nums.size === 0) return '';
    const sorted = Array.from(nums).sort((a, b) => a - b);
    const parts: string[] = [];
    let start = sorted[0];
    let end = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        parts.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i];
        end = sorted[i];
      }
    }
    parts.push(start === end ? `${start}` : `${start}-${end}`);
    return parts.join(', ');
  };

  // ─── Shared Logic ────────────────────────────────────────────────────────
  const isPendingAny = isPendingKurator || isPendingDeleteKurator || isPendingPromotor || isPendingDeletePromotor || isTogglingMode;

  const handleDelete = (role: 'kurator' | 'promotor', proposalIds: number[]) => {
    if (confirm('Hapus penugasan ini? Proposal akan dikembalikan ke pool.')) {
      if (role === 'kurator') {
        startTransitionDeleteKurator(async () => {
          await deleteRangeAction(batchId, proposalIds);
          setCheckedBlocksKurator(new Set());
        });
      } else {
        startTransitionDeletePromotor(async () => {
          await deletePromoterRangeAction(competitionId, proposalIds);
          setCheckedBlocksPromotor(new Set());
        });
      }
    }
  };

  const handleBulkDelete = (role: 'kurator' | 'promotor', blocks: Block[]) => {
    const checkedBlocks = role === 'kurator' ? checkedBlocksKurator : checkedBlocksPromotor;
    if (confirm(`Hapus ${checkedBlocks.size} range terpilih? Proposal akan dikembalikan ke pool.`)) {
      const idsToDelete: number[] = [];
      for(const blockKey of checkedBlocks) {
        const b = blocks.find(x => `${x.displayCategory}-${x.start}-${x.end}` === blockKey);
        if(b) idsToDelete.push(...b.proposalIds);
      }
      if (role === 'kurator') {
        startTransitionDeleteKurator(async () => {
          await deleteRangeAction(batchId, idsToDelete);
          setCheckedBlocksKurator(new Set());
        });
      } else {
        startTransitionDeletePromotor(async () => {
          await deletePromoterRangeAction(competitionId, idsToDelete);
          setCheckedBlocksPromotor(new Set());
        });
      }
    }
  };

  const handleToggleMode = (mode: 'open' | 'assigned') => {
    if (mode === promotorAccessMode) return;
    if (confirm(`Ubah akses Promotor menjadi "${mode === 'open' ? 'Akses Terbuka' : 'Assigned (Per Promotor)'}"?`)) {
      startToggleMode(async () => {
        await togglePromotorAccessModeAction(competitionId, mode);
      });
    }
  };

  // ─── Render Helper ───────────────────────────────────────────────────────
  const renderAssignmentPanel = (role: 'kurator' | 'promotor') => {
    const isKurator = role === 'kurator';
    
    const selectedUserId = isKurator ? selectedCuratorId : selectedPromoterId;
    const users = isKurator ? curators : promoters;
    const selectedUser = users.find(u => u.id === selectedUserId);
    
    const allAssigned = isKurator ? assignments : promoterAssignments;
    const allProps = isKurator ? allProposals : promotorProposals;
    
    const roleType = isKurator ? 'curator' : 'promoter';
    const blocks = selectedUserId ? getBlocks(allAssigned, selectedUserId as number, roleType, allProps) : [];
    
    const checkedBlocks = isKurator ? checkedBlocksKurator : checkedBlocksPromotor;
    const setCheckedBlocks = isKurator ? setCheckedBlocksKurator : setCheckedBlocksPromotor;
    
    const expandedCats = isKurator ? expandedCatsKurator : expandedCatsPromotor;
    const setExpandedCats = isKurator ? setExpandedCatsKurator : setExpandedCatsPromotor;
    
    const selectedCategory = isKurator ? selectedCuratorCategory : selectedPromoterCategory;
    const setSelectedCategory = isKurator ? setSelectedCuratorCategory : setSelectedPromoterCategory;
    
    const searchQuery = isKurator ? searchQueryKurator : searchQueryPromotor;
    const setSearchQuery = isKurator ? setSearchQueryKurator : setSearchQueryPromotor;
    
    const state = isKurator ? stateKurator : statePromotor;
    const action = isKurator ? actionKurator : actionPromotor;

    const availableCategories = isKurator ? ASSIGN_CATEGORIES : ['BI', 'BC'];

    let dbCategory = '';
    let dbRegionCenter = '';
    if (selectedCategory === 'Kantor Pusat') {
      dbCategory = 'PUSAT';
    } else if (selectedCategory === 'BI') {
      dbCategory = 'BI';
    } else if (selectedCategory === 'BC') {
      dbCategory = 'BC';
    } else {
      dbCategory = 'WILAYAH';
      dbRegionCenter = selectedCategory;
    }

    const categoryProposals = allProps.filter(p => {
      if (selectedCategory === 'Kantor Pusat') return p.category === 'PUSAT';
      if (selectedCategory === 'BI') return p.category === 'BI';
      if (selectedCategory === 'BC') return p.category === 'BC';
      return p.category === 'WILAYAH' && p.regionCenter === selectedCategory;
    });
    categoryProposals.sort((a, b) => a.rowNumber - b.rowNumber);
    const totalProps = categoryProposals.length;

    const categoryAssignments = allAssigned.filter(a => {
      if (selectedCategory === 'Kantor Pusat') return a.category === 'PUSAT';
      if (selectedCategory === 'BI') return a.category === 'BI';
      if (selectedCategory === 'BC') return a.category === 'BC';
      return a.category === 'WILAYAH' && a.proposalRegionCenter === selectedCategory;
    });
    
    const assignedCount = categoryAssignments.length;
    const availableCount = totalProps - assignedCount;

    const assignedMap = new Map<number, string>();
    for(const a of categoryAssignments) {
      const u = users.find(c => c.id === (isKurator ? a.curatorId : a.promoterId));
      assignedMap.set(a.proposalId, u?.name || (isKurator ? 'Kurator Lain' : 'Promotor Lain'));
    }

    const myAssignmentsForStats = allAssigned.filter(a => (isKurator ? a.curatorId : a.promoterId) === selectedUserId);
    const totalJatah = myAssignmentsForStats.length;
    // Only curator uses 'completed' status logic for "belum discreening"
    const belumDiscreening = isKurator ? myAssignmentsForStats.filter(a => a.status !== 'completed').length : 0;

    const groupedBlocks: Record<string, Block[]> = {};
    for(const b of blocks) {
      if(!groupedBlocks[b.displayCategory]) groupedBlocks[b.displayCategory] = [];
      groupedBlocks[b.displayCategory].push(b);
    }

    const toggleBlock = (blockKey: string) => {
      setCheckedBlocks(prev => {
        const next = new Set(prev);
        if (next.has(blockKey)) next.delete(blockKey);
        else next.add(blockKey);
        return next;
      });
    };
  
    const toggleCat = (cat: string) => {
      setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const rangeString = isKurator ? rangeStringKurator : rangeStringPromotor;
    const setRangeString = isKurator ? setRangeStringKurator : setRangeStringPromotor;
    
    const parsedRangeSet = parseRangeString(rangeString);

    const handleCheckboxChange = (rowNum: number, checked: boolean) => {
      const nextSet = new Set(parsedRangeSet);
      if (checked) nextSet.add(rowNum);
      else nextSet.delete(rowNum);
      setRangeString(formatRangeString(nextSet));
    };

    const handleSelectAll = (checked: boolean) => {
      if (!checked) {
        setRangeString('');
      } else {
        const nextSet = new Set(parsedRangeSet);
        categoryProposals.forEach(p => {
          if (!assignedMap.has(p.id)) {
            nextSet.add(Number(p.rowNumber));
          }
        });
        setRangeString(formatRangeString(nextSet));
      }
    };

    const isAllAvailableSelected = categoryProposals.length > 0 && 
      categoryProposals.every(p => assignedMap.has(p.id) || parsedRangeSet.has(Number(p.rowNumber))) &&
      categoryProposals.some(p => !assignedMap.has(p.id));

    return (
      <>
        {state?.error && (
          <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">{state.error}</div>
        )}
        {state?.success && (
          <div className="p-3 mb-4 bg-green-50 text-green-700 rounded-md text-sm border border-green-200">Berhasil assign proposal!</div>
        )}

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row sm:items-center justify-between">
          <div className="flex-1 w-full flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="w-full sm:w-1/3">
              <label className="block text-sm font-bold text-gray-700 mb-2">Pilih {isKurator ? 'Kurator' : 'Promotor'}</label>
              <select 
                value={selectedUserId}
                onChange={(e) => {
                  const val = Number(e.target.value) || '';
                  if (isKurator) setSelectedCuratorId(val);
                  else setSelectedPromoterId(val);
                }}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="">-- Pilih {isKurator ? 'Kurator' : 'Promotor'} --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            
            {selectedUserId && selectedUser && (
              <div className="w-full sm:w-2/3 text-sm text-gray-700 bg-indigo-50/50 px-4 py-3 rounded-md border border-indigo-100 mt-6 sm:mt-0">
                <span className="font-semibold text-indigo-900">{selectedUser.name}</span> <span className="mx-2">—</span> {totalJatah} proposal di-assign
                {isKurator && belumDiscreening > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">{belumDiscreening} belum screening</span>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedUserId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Panel Kiri: Form Input */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Tambah Range Baru</h3>
              <form action={action} className="space-y-4">
                {isKurator ? (
                  <>
                    <input type="hidden" name="batchId" value={batchId} />
                    <input type="hidden" name="curatorId" value={selectedUserId} />
                  </>
                ) : (
                  <>
                    <input type="hidden" name="competitionId" value={competitionId} />
                    <input type="hidden" name="promoterId" value={selectedUserId} />
                  </>
                )}
                
                <input type="hidden" name="category" value={dbCategory} />
                {dbRegionCenter && <input type="hidden" name="regionCenter" value={dbRegionCenter} />}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border mb-2"
                  >
                    {availableCategories.map((cat) => {
                      const catTotal = allProps.filter(p => {
                        if (cat === 'Kantor Pusat') return p.category === 'PUSAT';
                        if (cat === 'BI') return p.category === 'BI';
                        if (cat === 'BC') return p.category === 'BC';
                        return p.category === 'WILAYAH' && p.regionCenter === cat;
                      }).length;
                      return (
                        <option key={cat} value={cat}>
                          {KANWIL_CITIES.includes(cat) ? `Kanwil ${cat}` : cat} ({catTotal})
                        </option>
                      );
                    })}
                  </select>
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md border border-gray-200 flex justify-between items-center">
                    <span><span className="font-semibold">{KANWIL_CITIES.includes(selectedCategory) ? `Kanwil ${selectedCategory}` : selectedCategory}:</span> {totalProps} total</span>
                    <span><span className="font-bold text-green-600">{availableCount} tersedia</span></span>
                  </div>
                </div>

                {/* Tabel Referensi */}
                <details className="group border border-gray-200 rounded-md bg-white text-sm mt-4 shadow-sm">
                  <summary className="cursor-pointer p-3 font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 flex justify-between items-center transition">
                    <span>Lihat Referensi Nomor Urut & Judul</span>
                    <span className="transition group-open:rotate-180">
                      <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <div className="p-3 border-t border-gray-200 bg-white">
                    <div className="relative mb-3">
                      <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Cari Proposal..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-xs px-2 py-2 border text-gray-900 bg-white"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto border border-gray-100 rounded">
                      {categoryProposals.length === 0 ? (
                        <p className="text-gray-500 italic p-4 text-center">Tidak ada proposal di kategori ini.</p>
                      ) : (
                        <table className="min-w-full text-left border-collapse">
                          <thead>
                            <tr className="sticky top-0 z-10 border-b border-gray-200">
                              <th className="py-2 px-3 w-10 text-center bg-gray-50">
                                <input 
                                  type="checkbox" 
                                  checked={isAllAvailableSelected}
                                  onChange={(e) => handleSelectAll(e.target.checked)}
                                  className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                                  title="Pilih Semua yang Tersedia"
                                />
                              </th>
                              <th className="py-2 px-3 font-semibold text-gray-600 text-xs bg-gray-50">No.</th>
                              <th className="py-2 px-3 font-semibold text-gray-600 text-xs bg-gray-50">Status</th>
                              <th className="py-2 px-3 font-semibold text-gray-600 text-xs bg-gray-50">Judul</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryProposals
                              .filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
                              .map(p => {
                              const isAssigned = assignedMap.has(p.id);
                              const assignedToName = assignedMap.get(p.id);
                              const rowNum = Number(p.rowNumber);
                              const isChecked = parsedRangeSet.has(rowNum);
                              return (
                                <tr key={p.id} className={`border-b border-gray-100 last:border-b-0 hover:bg-indigo-50/30 ${isAssigned ? 'opacity-60 bg-gray-50' : ''} ${isChecked ? 'bg-indigo-50/50' : ''}`}>
                                  <td className="py-2 px-3 text-center">
                                    <input 
                                      type="checkbox" 
                                      disabled={isAssigned}
                                      checked={isChecked}
                                      onChange={(e) => handleCheckboxChange(rowNum, e.target.checked)}
                                      className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
                                    />
                                  </td>
                                  <td className="py-2 px-3 text-gray-700 font-medium whitespace-nowrap">{rowNum}</td>
                                  <td className="py-2 px-3">
                                    {isAssigned ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-700 whitespace-nowrap">
                                        Assigned ke {assignedToName}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 whitespace-nowrap">
                                        Tersedia
                                      </span>
                                    )}
                                  </td>
                                  <td 
                                    className="py-2 px-3 text-gray-900 truncate max-w-[200px] text-sm cursor-help" 
                                    title={`📌 JUDUL:\n${p.title}\n\n📝 RINGKASAN:\n${p.summary || 'Tidak ada data ringkasan'}`}
                                  >
                                    {p.title}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </details>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Nomor Urut Proposal</label>
                  <p className="text-xs text-gray-500 mb-2">Pisahkan dengan koma (contoh: <code className="bg-gray-100 px-1 py-0.5 rounded">1, 4, 8</code>) atau gunakan strip untuk range (contoh: <code className="bg-gray-100 px-1 py-0.5 rounded">1-50</code>). Centang pada tabel di atas untuk otomatis mengisi input ini.</p>
                  <input 
                    type="text" 
                    name="rangeString"
                    value={rangeString}
                    onChange={(e) => setRangeString(e.target.value)}
                    required 
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white" 
                    placeholder="Contoh: 1, 4, 10-25" 
                  />
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={isPendingAny} className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-md shadow-sm hover:bg-indigo-700 text-sm font-bold disabled:opacity-50 transition">
                    {isPendingAny ? 'Menyimpan...' : `Assign Range ke ${isKurator ? 'Kurator' : 'Promotor'}`}
                  </button>
                </div>
              </form>
            </div>

            {/* Panel Kanan: Daftar Assignment (Range Blocks) */}
            <div className="bg-gray-50 p-6 rounded-lg shadow-inner border border-gray-200 flex flex-col max-h-[650px]">
              <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-900">Daftar Proposal yang Dikurasi</h3>
                {checkedBlocks.size > 0 && (
                  <button
                    onClick={() => handleBulkDelete(role, blocks)}
                    disabled={isPendingAny}
                    className="text-white bg-red-600 hover:bg-red-700 text-xs font-bold px-3 py-2 rounded shadow-sm disabled:opacity-50 transition"
                  >
                    Hapus Terpilih ({checkedBlocks.size})
                  </button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto pr-1">
                {blocks.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-gray-500 italic text-center">Belum ada proposal yang di-assign ke {isKurator ? 'kurator' : 'promotor'} ini.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedBlocks).map(([cat, catBlocks]) => {
                      const displayCat = KANWIL_CITIES.includes(cat) ? `Kanwil ${cat}` : cat;
                      const totalProps = catBlocks.reduce((acc, b) => acc + b.count, 0);
                      const isExpanded = expandedCats[cat] ?? false;
                      
                      const allBlocksChecked = catBlocks.every(b => checkedBlocks.has(`${b.displayCategory}-${b.start}-${b.end}`));
                      
                      const handleToggleCategoryCheck = () => {
                        setCheckedBlocks(prev => {
                          const next = new Set(prev);
                          if (allBlocksChecked) {
                            catBlocks.forEach(b => next.delete(`${b.displayCategory}-${b.start}-${b.end}`));
                          } else {
                            catBlocks.forEach(b => next.add(`${b.displayCategory}-${b.start}-${b.end}`));
                          }
                          return next;
                        });
                      };
                      
                      return (
                        <div key={cat} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                          <div className="flex items-center px-4 py-3 bg-gray-50 hover:bg-gray-100 cursor-pointer border-b border-gray-100 transition" onClick={() => toggleCat(cat)}>
                             <div className="flex-1 flex items-center">
                               <svg className={`w-4 h-4 text-gray-400 mr-2 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                               <span className="font-semibold text-gray-900">{displayCat} <span className="font-medium text-gray-500 text-xs ml-2 bg-gray-200 px-2 py-0.5 rounded-full">{totalProps} proposal</span></span>
                             </div>
                             <div className="flex items-center ml-4" onClick={(e) => e.stopPropagation()}>
                               <input 
                                 type="checkbox" 
                                 checked={allBlocksChecked}
                                 onChange={handleToggleCategoryCheck}
                                 onClick={(e) => e.stopPropagation()}
                                 className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                                 title="Pilih semua range di kategori ini"
                               />
                             </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="divide-y divide-gray-50 bg-white">
                              {catBlocks.map((b) => {
                                 const blockKey = `${b.displayCategory}-${b.start}-${b.end}`;
                                 const isChecked = checkedBlocks.has(blockKey);
                                 return (
                                   <div key={blockKey} className={`flex justify-between items-center px-4 py-3 cursor-pointer transition ${isChecked ? 'bg-indigo-50/30' : 'hover:bg-gray-50'}`} onClick={() => toggleBlock(blockKey)}>
                                     <div className="flex items-center flex-1">
                                       <input 
                                         type="checkbox" 
                                         checked={isChecked}
                                         onChange={() => toggleBlock(blockKey)}
                                         onClick={(e) => e.stopPropagation()}
                                         className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-4 cursor-pointer"
                                       />
                                       <div>
                                         <div className="text-sm font-bold text-gray-700 max-w-sm truncate" title={b.title}>
                                           No. {b.start} – {b.title}
                                         </div>
                                       </div>
                                     </div>
                                     <div className="flex-shrink-0 ml-4">
                                       <button 
                                         onClick={(e) => { e.stopPropagation(); handleDelete(role, b.proposalIds); }}
                                         disabled={isPendingAny}
                                         className="text-red-600 hover:text-red-800 text-xs font-bold px-3 py-1.5 rounded-md bg-red-50 hover:bg-red-100 disabled:opacity-50 transition"
                                       >
                                         Hapus
                                       </button>
                                     </div>
                                   </div>
                                 );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="mb-8">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Assign Proposal</h1>
          <p className="text-gray-600">Alokasikan proposal ke Tim Kurator atau atur akses Tim Promotor.</p>
        </div>
      </div>
      
      {/* Target Tab Toggle */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-full max-w-md mb-6 border border-gray-200">
        <button
          onClick={() => setTargetTab('kurator')}
          className={`flex-1 py-2 text-sm font-bold rounded-md transition ${
            targetTab === 'kurator' 
              ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black ring-opacity-5' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
          }`}
        >
          Kurator
        </button>
        <button
          onClick={() => setTargetTab('promotor')}
          className={`flex-1 py-2 text-sm font-bold rounded-md transition ${
            targetTab === 'promotor' 
              ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black ring-opacity-5' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
          }`}
        >
          Promotor
        </button>
      </div>

      {targetTab === 'kurator' ? (
        renderAssignmentPanel('kurator')
      ) : (
        <div className="animate-in fade-in duration-200">
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5 mb-6 shadow-sm">
            <h3 className="font-bold text-indigo-900 mb-2">Mode Akses Promotor</h3>
            <p className="text-sm text-indigo-700 mb-4">
              Pilih bagaimana Tim Promotor mengakses proposal final (dari pool {promotorProposals.length} proposal hasil FGD Nasional).
            </p>
            
            <div className="flex space-x-4">
              <label className={`flex items-center p-3 rounded border cursor-pointer transition ${promotorAccessMode === 'open' ? 'bg-white border-indigo-500 ring-1 ring-indigo-500' : 'bg-white/50 border-gray-300 hover:bg-white'}`}>
                <input 
                  type="radio" 
                  name="promotorMode" 
                  checked={promotorAccessMode === 'open'}
                  onChange={() => handleToggleMode('open')}
                  disabled={isTogglingMode}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-3 font-semibold text-gray-900 text-sm">Akses all Proposal</span>
              </label>
              <label className={`flex items-center p-3 rounded border cursor-pointer transition ${promotorAccessMode === 'assigned' ? 'bg-white border-indigo-500 ring-1 ring-indigo-500' : 'bg-white/50 border-gray-300 hover:bg-white'}`}>
                <input 
                  type="radio" 
                  name="promotorMode" 
                  checked={promotorAccessMode === 'assigned'}
                  onChange={() => handleToggleMode('assigned')}
                  disabled={isTogglingMode}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-3 font-semibold text-gray-900 text-sm">Assigned (Per Promotor)</span>
              </label>
            </div>
            
            {promotorAccessMode === 'open' && (
              <div className="mt-4 text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200 font-medium flex items-center">
                <span className="mr-2">🔓</span> Semua anggota Tim Promotor dapat melihat dan mengevaluasi seluruh {promotorProposals.length} proposal di pool seleksi. Tidak perlu assignment individual.
              </div>
            )}
          </div>
          
          {promotorAccessMode === 'assigned' && renderAssignmentPanel('promotor')}
        </div>
      )}
    </div>
  );
}
