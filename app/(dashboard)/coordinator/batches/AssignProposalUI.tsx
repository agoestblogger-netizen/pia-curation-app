'use client';

import { useActionState, useState, useTransition, useEffect } from 'react';
import { assignRangeAction, deleteRangeAction } from '@/app/actions/batches';
import { useRouter } from 'next/navigation';
import { ASSIGN_CATEGORIES, KANWIL_CITIES } from '@/lib/constants';

type Curator = { id: number; name: string };
type Assignment = { 
  id: number; 
  proposalId: number; 
  curatorId: number; 
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
  proposalIds: number[] 
};

function getBlocks(assignments: Assignment[], curatorId: number): Block[] {
  const filtered = assignments.filter(a => a.curatorId === curatorId);
  
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
    if (arr.length === 0) continue;
    
    let currentBlock = { displayCategory: cat, start: arr[0].proposalRowNumber, end: arr[0].proposalRowNumber, count: 1, proposalIds: [arr[0].proposalId] };
    
    for (let i = 1; i < arr.length; i++) {
      const a = arr[i];
      if (a.proposalRowNumber === currentBlock.end + 1) {
        currentBlock.end = a.proposalRowNumber;
        currentBlock.count++;
        currentBlock.proposalIds.push(a.proposalId);
      } else {
        blocks.push(currentBlock);
        currentBlock = { displayCategory: cat, start: a.proposalRowNumber, end: a.proposalRowNumber, count: 1, proposalIds: [a.proposalId] };
      }
    }
    blocks.push(currentBlock);
  }
  return blocks;
}

export default function AssignProposalUI({
  batchId,
  curators,
  assignments,
  allProposals,
}: {
  batchId: number;
  curators: Curator[];
  assignments: Assignment[];
  allProposals: any[];
}) {
  const [state, action, isPending] = useActionState(assignRangeAction, {});
  const [isPendingDelete, startTransition] = useTransition();
  const [selectedCuratorId, setSelectedCuratorId] = useState<number | ''>('');
  const [selectedCategory, setSelectedCategory] = useState(ASSIGN_CATEGORIES[0]);
  const [checkedBlocks, setCheckedBlocks] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCheckedBlocks(new Set());
  }, [selectedCuratorId]);

  const handleDelete = (proposalIds: number[]) => {
    if (confirm('Hapus penugasan ini? Proposal akan dikembalikan ke pool.')) {
      startTransition(async () => {
        await deleteRangeAction(batchId, proposalIds);
        setCheckedBlocks(new Set());
      });
    }
  };

  const blocks = selectedCuratorId ? getBlocks(assignments, selectedCuratorId) : [];

  const handleBulkDelete = () => {
    if (confirm(`Hapus ${checkedBlocks.size} range terpilih? Proposal akan dikembalikan ke pool.`)) {
      const idsToDelete: number[] = [];
      for(const blockKey of checkedBlocks) {
        const b = blocks.find(x => `${x.displayCategory}-${x.start}-${x.end}` === blockKey);
        if(b) idsToDelete.push(...b.proposalIds);
      }
      
      startTransition(async () => {
        await deleteRangeAction(batchId, idsToDelete);
        setCheckedBlocks(new Set());
      });
    }
  };

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

  // Group blocks by category for display
  const groupedBlocks: Record<string, Block[]> = {};
  for(const b of blocks) {
    if(!groupedBlocks[b.displayCategory]) groupedBlocks[b.displayCategory] = [];
    groupedBlocks[b.displayCategory].push(b);
  }

  // Calculate info jatah & progress
  const selectedCurator = curators.find(c => c.id === selectedCuratorId);
  const curatorAssignmentsForStats = assignments.filter(a => a.curatorId === selectedCuratorId);
  const totalJatah = curatorAssignmentsForStats.length;
  const belumDiscreening = curatorAssignmentsForStats.filter(a => a.status !== 'completed').length;

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

  const categoryProposals = allProposals.filter(p => {
    if (selectedCategory === 'Kantor Pusat') return p.category === 'PUSAT';
    if (selectedCategory === 'BI') return p.category === 'BI';
    if (selectedCategory === 'BC') return p.category === 'BC';
    
    // For Wilayah
    return p.category === 'WILAYAH' && p.region_center === selectedCategory;
  });
  categoryProposals.sort((a, b) => a.row_number - b.row_number);

  const totalProps = categoryProposals.length;
  // assignments in THIS batch for this category
  const categoryAssignments = assignments.filter(a => {
    if (selectedCategory === 'Kantor Pusat') return a.category === 'PUSAT';
    if (selectedCategory === 'BI') return a.category === 'BI';
    if (selectedCategory === 'BC') return a.category === 'BC';
    
    return a.category === 'WILAYAH' && a.proposalRegionCenter === selectedCategory;
  });
  
  const assignedCount = categoryAssignments.length;
  const availableCount = totalProps - assignedCount;

  // mapping for assigned proposals
  const assignedMap = new Map<number, string>();
  for(const a of categoryAssignments) {
    const curator = curators.find(c => c.id === a.curatorId);
    assignedMap.set(a.proposalId, curator?.name || 'Kurator Lain');
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4 text-gray-900">Assign Proposal</h2>
      
      {state?.error && (
        <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-md text-sm">{state.error}</div>
      )}
      {state?.success && (
        <div className="p-3 mb-4 bg-green-50 text-green-700 rounded-md text-sm">Berhasil assign proposal!</div>
      )}

      {/* 1. Pilih Kurator */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-100 mb-6">
        <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Kurator</label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <select 
            value={selectedCuratorId}
            onChange={(e) => setSelectedCuratorId(Number(e.target.value) || '')}
            className="w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
          >
            <option value="">-- Pilih Kurator --</option>
            {curators.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          
          {selectedCuratorId && selectedCurator && (
            <div className="text-sm text-gray-700 bg-indigo-50/50 px-3 py-2 rounded-md border border-indigo-100">
              <span className="font-semibold">{selectedCurator.name}</span> — {totalJatah} proposal (<span className={belumDiscreening > 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>{belumDiscreening} belum discreening</span>)
            </div>
          )}
        </div>
      </div>

      {selectedCuratorId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel Kiri: Form Input */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Tambah Range Baru</h3>
            <form action={action} className="space-y-4">
              <input type="hidden" name="batchId" value={batchId} />
              <input type="hidden" name="curatorId" value={selectedCuratorId} />
              <input type="hidden" name="category" value={dbCategory} />
              {dbRegionCenter && <input type="hidden" name="regionCenter" value={dbRegionCenter} />}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border mb-2"
                >
                  {ASSIGN_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {KANWIL_CITIES.includes(cat) ? `Kanwil ${cat}` : cat}
                    </option>
                  ))}
                </select>
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                  <span className="font-semibold">{KANWIL_CITIES.includes(selectedCategory) ? `Kanwil ${selectedCategory}` : selectedCategory}:</span> {totalProps} total proposal — {assignedCount} sudah ter-assign — <span className="font-bold text-green-600">{availableCount} tersedia</span>
                </div>
              </div>

              {/* Tabel Referensi */}
              <details className="group border border-gray-200 rounded-md bg-white text-sm">
                <summary className="cursor-pointer p-2 font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 flex justify-between items-center">
                  <span>Lihat Referensi Nomor Urut & Judul</span>
                  <span className="transition group-open:rotate-180">
                    <svg fill="none" height="20" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
                  </span>
                </summary>
                <div className="max-h-64 overflow-y-auto p-2 border-t border-gray-200">
                  {categoryProposals.length === 0 ? (
                    <p className="text-gray-500 italic p-2 text-center">Tidak ada proposal di kategori ini.</p>
                  ) : (
                    <table className="min-w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 sticky top-0">
                          <th className="py-1 px-2 border-b font-medium text-gray-500">No.</th>
                          <th className="py-1 px-2 border-b font-medium text-gray-500">Status</th>
                          <th className="py-1 px-2 border-b font-medium text-gray-500">Judul</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryProposals.map(p => {
                          const isAssigned = assignedMap.has(p.id);
                          const curatorName = assignedMap.get(p.id);
                          return (
                            <tr key={p.id} className={`border-b last:border-b-0 hover:bg-gray-50 ${isAssigned ? 'opacity-60 bg-gray-100' : ''}`}>
                              <td className="py-1.5 px-2 text-gray-700 whitespace-nowrap">{p.row_number}</td>
                              <td className="py-1.5 px-2">
                                {isAssigned ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 whitespace-nowrap">
                                    Sudah (ke {curatorName})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 whitespace-nowrap">
                                    Tersedia
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-gray-900 truncate max-w-[200px]" title={p.title}>{p.title}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </details>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Range Mulai (No)</label>
                  <input type="number" name="startRange" min={1} required className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" placeholder="Contoh: 1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Range Akhir (No)</label>
                  <input type="number" name="endRange" min={1} required className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" placeholder="Contoh: 20" />
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isPending || isPendingDelete} className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">
                  {isPending ? 'Menyimpan...' : 'Assign ke Proposal'}
                </button>
              </div>
            </form>
          </div>

          {/* Panel Kanan: Daftar Assignment (Range Blocks) */}
          <div className="bg-gray-50 p-6 rounded-lg shadow border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Daftar Range Aktif</h3>
              {checkedBlocks.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={isPending || isPendingDelete}
                  className="text-white bg-red-600 hover:bg-red-700 text-sm font-medium px-3 py-1.5 rounded shadow-sm disabled:opacity-50"
                >
                  Hapus Terpilih ({checkedBlocks.size})
                </button>
              )}
            </div>
            
            {blocks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Belum ada proposal yang di-assign ke kurator ini.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedBlocks).map(([cat, catBlocks]) => {
                  const displayCat = KANWIL_CITIES.includes(cat) ? `Kanwil ${cat}` : cat;
                  const totalProps = catBlocks.reduce((acc, b) => acc + b.count, 0);
                  const isExpanded = expandedCats[cat] ?? false;
                  
                  // Check if all blocks in this category are selected
                  const allBlocksChecked = catBlocks.every(b => checkedBlocks.has(`${b.displayCategory}-${b.start}-${b.end}`));
                  
                  const handleToggleCategoryCheck = () => {
                    setCheckedBlocks(prev => {
                      const next = new Set(prev);
                      if (allBlocksChecked) {
                        // uncheck all
                        catBlocks.forEach(b => next.delete(`${b.displayCategory}-${b.start}-${b.end}`));
                      } else {
                        // check all
                        catBlocks.forEach(b => next.add(`${b.displayCategory}-${b.start}-${b.end}`));
                      }
                      return next;
                    });
                  };
                  
                  return (
                    <div key={cat} className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                      <div className="flex items-center px-4 py-3 bg-gray-50 hover:bg-gray-100 cursor-pointer" onClick={() => toggleCat(cat)}>
                         <div className="flex-1 flex items-center">
                           <svg className={`w-4 h-4 text-gray-500 mr-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                           <span className="font-semibold text-gray-900">{displayCat} <span className="font-normal text-gray-500 text-sm">({catBlocks.length} range, {totalProps} proposal)</span></span>
                         </div>
                         <div className="flex items-center ml-4" onClick={(e) => e.stopPropagation()}>
                           <input 
                             type="checkbox" 
                             checked={allBlocksChecked}
                             onChange={handleToggleCategoryCheck}
                             onClick={(e) => e.stopPropagation()}
                             className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                             title="Pilih semua range di kategori ini"
                           />
                         </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="border-t border-gray-200 divide-y divide-gray-100">
                          {catBlocks.map((b) => {
                             const blockKey = `${b.displayCategory}-${b.start}-${b.end}`;
                             const isChecked = checkedBlocks.has(blockKey);
                             return (
                               <div key={blockKey} className="flex justify-between items-center px-4 py-3 bg-white hover:bg-gray-50 cursor-pointer" onClick={() => toggleBlock(blockKey)}>
                                 <div className="flex items-center">
                                   <input 
                                     type="checkbox" 
                                     checked={isChecked}
                                     onChange={() => toggleBlock(blockKey)}
                                     onClick={(e) => e.stopPropagation()}
                                     className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-3"
                                   />
                                   <div>
                                     <div className="text-sm text-gray-600">
                                       No. {b.start} – {b.end} <span className="text-xs text-gray-400">({b.count} proposal)</span>
                                     </div>
                                   </div>
                                 </div>
                                 <div>
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); handleDelete(b.proposalIds); }}
                                     disabled={isPending || isPendingDelete}
                                     className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded bg-red-50 hover:bg-red-100 disabled:opacity-50"
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
            
            <p className="text-xs text-gray-400 mt-4">
              Tip: Untuk mengedit, hapus block yang sudah ada lalu buat ulang di form sebelah kiri untuk menghindari salah hitung.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
