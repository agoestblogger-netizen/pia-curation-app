'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { updateDuplicateStatus } from '@/app/actions/duplicates';

interface ProposalCard {
  id: number;
  title: string;
  category: string;
  proposerName: string;
  division: string | null;
  regionCenter: string | null;
  status: string; // 'imported', 'assigned', 'in_review', 'completed'
  aiScore: string;
  curatorName?: string | null;
  curatorNotes?: string | null;
  curatorRecommendation?: string | null;
  proposalRowNumber: number;
  hasResubmission?: boolean;
  isScreened?: boolean;
  screeningVerdict?: string | null;
}

const CATEGORY_MAP: Record<string, { label: string, short: string, bg: string }> = {
  'PUSAT': { label: 'Regional - Kantor Pusat', short: 'KP', bg: 'bg-[#0F4C81]' },
  'WILAYAH': { label: 'Regional - Kantor Wilayah', short: 'KW', bg: 'bg-[#059669]' },
  'BI': { label: 'Breakthrough Innovation', short: 'BI', bg: 'bg-[#7C3AED]' },
  'BC': { label: 'Business Case', short: 'BC', bg: 'bg-[#B45309]' },
};

export default function CoordinatorBoard({ 
  proposals, 
  duplicates: initialDuplicates = [], 
  isViewer = false,
  showGugur = false,
}: { 
  proposals: ProposalCard[], 
  duplicates?: any[], 
  isViewer?: boolean,
  showGugur?: boolean,
}) {
  const [activeTab, setActiveTab] = useState<'assigned' | 'review' | 'duplicates'>('assigned');
  const [duplicates, setDuplicates] = useState(initialDuplicates);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [curatorFilter, setCuratorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'PUSAT': true
  });
  const [expandedWilayah, setExpandedWilayah] = useState<Record<string, boolean>>({});

  const availableCurators = Array.from(
    new Set(proposals.map(p => p.curatorName).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b));

  const statusCounts = {
    lolos: proposals.filter(p => p.isScreened && p.screeningVerdict === 'lolos').length,
    duplication: proposals.filter(p => p.isScreened && p.screeningVerdict === 'duplication').length,
    mapped: proposals.filter(p => p.isScreened && p.screeningVerdict === 'mapped').length,
    non_compliance: proposals.filter(p => p.isScreened && p.screeningVerdict === 'non_compliance').length,
    low_impact: proposals.filter(p => p.isScreened && p.screeningVerdict === 'low_impact').length,
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleWilayah = (region: string) => {
    setExpandedWilayah(prev => ({ ...prev, [region]: !prev[region] }));
  };

  const displayedProposals = proposals.filter(p => {
    if (!showGugur && p.status === 'gugur') return false;

    const matchesTab = activeTab === 'assigned' ? !p.isScreened : activeTab === 'review' ? p.isScreened : true;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.proposerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCurator = activeTab === 'review' && curatorFilter ? p.curatorName === curatorFilter : true;
    const matchesStatus = activeTab === 'review' && statusFilter ? p.screeningVerdict === statusFilter : true;
    return matchesTab && matchesSearch && matchesCurator && matchesStatus;
  });

  // Group by category
  const grouped: Record<string, ProposalCard[]> = {
    'PUSAT': [],
    'WILAYAH': [],
    'BI': [],
    'BC': []
  };

  displayedProposals.forEach(p => {
    const cat = p.category.toUpperCase();
    if (grouped[cat]) grouped[cat].push(p);
    else {
      grouped[cat] = [p];
      CATEGORY_MAP[cat] = { label: p.category, short: p.category.substring(0, 2).toUpperCase(), bg: 'bg-gray-600' };
    }
  });

  const ProposalListPaginated = ({ items }: { items: ProposalCard[] }) => {
    const [page, setPage] = useState(1);
    const limit = 50;
    const displayed = items.slice(0, page * limit);

    return (
      <div className="border-t border-gray-100 divide-y divide-gray-100">
        {displayed.map((p) => (
          <div key={p.id} className="p-6 flex items-start group hover:bg-gray-50 transition-colors">
            {/* Row Number Badge */}
            <div className="w-10 h-10 bg-gray-100 rounded-lg text-gray-700 flex items-center justify-center flex-shrink-0 mr-3 shadow-sm font-bold text-sm border border-gray-200">
              {p.proposalRowNumber}
            </div>

            {/* Icon */}
            <div className="w-12 h-12 bg-[#0F4C81] rounded-lg text-white flex items-center justify-center flex-shrink-0 mr-4 shadow-sm">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
            </div>

            {/* Content */}
            <div className="flex-1 pr-4">
              <div className="flex items-center space-x-3 mb-1 flex-wrap gap-y-1">
                <Link href={`/curator/proposals/${p.id}?from=coordinator`} className="hover:underline">
                  <h4 className="text-[15px] font-bold text-gray-900 leading-tight">
                    {p.title}
                  </h4>
                </Link>
                {p.status === 'gugur' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap">
                    Gugur — Tidak Resubmission
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">
                      AI: {p.aiScore}
                    </span>
                    {p.hasResubmission && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap" title="Peserta telah mengirim resubmission">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Resubmission
                      </span>
                    )}
                    {p.isScreened && !isViewer && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap shadow-2xs" title="Selesai Dikurasi oleh Kurator">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                        ✓ Selesai
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="text-xs text-gray-600 font-semibold mb-2">
                {p.division || p.regionCenter || 'Operasional'}
                {p.curatorName && !isViewer && (
                  <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Dikurasi oleh : {p.curatorName}
                  </span>
                )}
              </div>
            </div>

            {/* Right action / Arrow */}
            <div className="flex-shrink-0 ml-auto pl-4 self-center flex flex-col items-end space-y-2">
              <Link href={`/curator/proposals/${p.id}?from=coordinator`} className="hidden md:block px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-md border border-indigo-200 hover:bg-indigo-200">
                Lihat Detail & Penilaian
              </Link>
              <svg className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
        ))}
        {items.length > displayed.length && (
          <div className="p-4 text-center">
            <button 
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-semibold transition-colors"
            >
              Tampilkan Lebih Banyak ({items.length - displayed.length} tersisa)
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex space-x-1 mb-8 border border-gray-200 rounded-full w-max bg-white p-1 shadow-sm">
        <button 
          onClick={() => setActiveTab('assigned')}
          className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${
            activeTab === 'assigned' ? 'bg-[#0A4736] text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Belum Discreening
        </button>
        <button 
          onClick={() => setActiveTab('review')}
          className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${
            activeTab === 'review' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Selesai Discreening
        </button>
        {!isViewer && (
          <button 
            onClick={() => setActiveTab('duplicates')}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeTab === 'duplicates' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Potensi Duplikat
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center w-full">
        <div className="relative w-full sm:max-w-md flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Cari Proposal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border text-gray-900 bg-white"
          />
        </div>
        
        {/* Screening Status Filter & Curator Filter (Only inside "Selesai Discreening" tab for Admin & Coordinator) */}
        {activeTab === 'review' && !isViewer && (
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
            {/* Status Screening Filter */}
            <div className="w-full sm:w-auto shrink-0 flex items-center bg-white rounded-lg border border-gray-300 p-1 shadow-sm h-full">
              <span className="px-3 text-sm font-semibold text-gray-600 border-r border-gray-200 hidden sm:inline-block">Status:</span>
              <select 
                className="bg-transparent border-0 text-sm font-medium focus:ring-0 text-gray-900 py-2 pl-3 pr-8 w-full cursor-pointer outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Semua Status ({proposals.filter(p => p.isScreened).length})</option>
                <option value="lolos">Lolos ({statusCounts.lolos})</option>
                <option value="duplication">Duplication ({statusCounts.duplication})</option>
                <option value="mapped">Mapped ({statusCounts.mapped})</option>
                <option value="non_compliance">Non-Compliance ({statusCounts.non_compliance})</option>
                <option value="low_impact">Low Impact ({statusCounts.low_impact})</option>
              </select>
            </div>

            {/* Curator Filter */}
            <div className="w-full sm:w-auto shrink-0 flex items-center bg-white rounded-lg border border-gray-300 p-1 shadow-sm h-full">
              <span className="px-3 text-sm font-semibold text-gray-600 border-r border-gray-200 hidden sm:inline-block">Kurator:</span>
              <select 
                className="bg-transparent border-0 text-sm font-medium focus:ring-0 text-gray-900 py-2 pl-3 pr-8 w-full cursor-pointer outline-none"
                value={curatorFilter}
                onChange={(e) => setCuratorFilter(e.target.value)}
              >
                <option value="">Semua Kurator ({availableCurators.length})</option>
                {availableCurators.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {activeTab === 'duplicates' ? (
          duplicates.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Belum ada potensi duplikat</h3>
              <p className="text-gray-500">Belum ada kurator yang menandai potensi duplikasi.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {duplicates.map(d => (
                  <div key={d.id} className="p-5 flex flex-col md:flex-row gap-4 items-start hover:bg-gray-50 transition-colors">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Link href={`/curator/proposals/${d.proposalAId}?from=coordinator`} className="text-[15px] font-bold text-gray-900 hover:underline">
                          {d.proposalATitle}
                        </Link>
                        <span className="text-xs text-gray-400">↔</span>
                        <Link href={`/curator/proposals/${d.proposalBId}?from=coordinator`} className="text-[15px] font-bold text-gray-900 hover:underline">
                          {d.proposalBTitle}
                        </Link>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="px-2 py-0.5 rounded font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                          Ditandai oleh: {d.markedByName}
                        </span>
                        <span className={`px-2 py-0.5 rounded font-semibold ${
                          d.aiSimilarityLevel === 'TINGGI' ? 'bg-red-100 text-red-700' :
                          d.aiSimilarityLevel === 'SEDANG' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          AI: {d.aiSimilarityLevel}
                        </span>
                        
                        <span className={`px-2 py-0.5 rounded font-semibold ${
                          d.status === 'confirmed' ? 'bg-red-100 text-red-700 border border-red-200' :
                          d.status === 'rejected' ? 'bg-gray-100 text-gray-700 border border-gray-200' :
                          'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                          Status: {d.status === 'confirmed' ? 'Dikonfirmasi Duplikasi' : d.status === 'rejected' ? 'Ditolak (Bukan Duplikasi)' : 'Menunggu Review'}
                        </span>
                      </div>
                      
                      {d.note && (
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 mt-2">
                          <span className="font-semibold">Catatan Kurator:</span> {d.note}
                        </p>
                      )}
                    </div>
                    
                    {/* Actions */}
                    {!isViewer && (
                      <div className="flex-shrink-0 flex flex-col md:flex-row gap-2">
                        {d.status !== 'confirmed' && (
                        <button
                          disabled={isPending}
                          onClick={() => {
                            startTransition(async () => {
                              const res = await updateDuplicateStatus(d.id, 'confirmed');
                              if (!res.error) {
                                setDuplicates(prev => prev.map(item => item.id === d.id ? { ...item, status: 'confirmed' } : item));
                              }
                            });
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded transition-colors"
                        >
                          Konfirmasi Duplikasi
                        </button>
                      )}
                      {d.status !== 'rejected' && (
                        <button
                          disabled={isPending}
                          onClick={() => {
                            startTransition(async () => {
                              const res = await updateDuplicateStatus(d.id, 'rejected');
                              if (!res.error) {
                                setDuplicates(prev => prev.map(item => item.id === d.id ? { ...item, status: 'rejected' } : item));
                              }
                            });
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 rounded transition-colors"
                        >
                          Tolak
                        </button>
                      )}
                    </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ) : displayedProposals.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Belum ada proposal</h3>
            <p className="text-gray-500">
              {activeTab === 'assigned' 
                ? 'Belum ada proposal yang di-assign ke Anda untuk discreening.'
                : 'Belum ada proposal yang selesai discreening.'}
            </p>
          </div>
        ) : Object.entries(grouped).map(([cat, items]) => {
          const isExpanded = expandedCategories[cat];
          const meta = CATEGORY_MAP[cat] || { label: cat, short: cat, bg: 'bg-gray-500' };

          return (
            <div key={cat} className={`bg-white rounded-xl shadow-sm border ${isExpanded ? 'border-orange-400' : 'border-gray-200'}`}>
              <button 
                onClick={() => toggleCategory(cat)}
                className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-8 h-8 rounded ${meta.bg} text-white flex items-center justify-center text-xs font-bold`}>
                    {meta.short}
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <h3 className="text-gray-900 font-bold text-[15px]">{meta.label}</h3>
                    <span className="text-gray-400 text-sm">{items.length} proposal</span>
                  </div>
                </div>
                <div className="text-gray-400">
                  {isExpanded ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  )}
                </div>
              </button>

              {isExpanded && items.length > 0 && cat !== 'WILAYAH' && <ProposalListPaginated items={items} />}

              {isExpanded && items.length > 0 && cat === 'WILAYAH' && (
                <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50 rounded-b-xl">
                  {/* Group Wilayah by regionCenter */}
                  {(() => {
                    const wilayahGroups: Record<string, ProposalCard[]> = {};
                    items.forEach(p => {
                      const rc = p.regionCenter || 'Lainnya';
                      if (!wilayahGroups[rc]) wilayahGroups[rc] = [];
                      wilayahGroups[rc].push(p);
                    });
                    
                    return Object.entries(wilayahGroups).map(([region, wItems]) => {
                      const wExpanded = expandedWilayah[region];
                      return (
                        <div key={region} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                          <button 
                            onClick={() => toggleWilayah(region)}
                            className="w-full px-4 py-3 flex items-center justify-between text-left focus:outline-none bg-white hover:bg-gray-50"
                          >
                            <div className="flex items-baseline space-x-2">
                              <h4 className="text-gray-800 font-semibold text-sm">Kanwil {region}</h4>
                              <span className="text-gray-500 text-xs">{wItems.length} proposal</span>
                            </div>
                            <div className="text-gray-400">
                              {wExpanded ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                              )}
                            </div>
                          </button>
                          {wExpanded && <ProposalListPaginated items={wItems} />}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {isExpanded && items.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-500 border-t border-gray-100">
                  Tidak ada proposal di kategori ini.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
