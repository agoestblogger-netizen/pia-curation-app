'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ProposalCard {
  id: number;
  title: string;
  category: string;
  proposerName: string;
  division: string | null;
  summary: string | null;
  regionCenter: string | null;
  status: string; // 'assigned', 'in_review', 'completed'
  aiScore: string;
}

const CATEGORY_MAP: Record<string, { label: string, short: string, bg: string }> = {
  'PUSAT': { label: 'Regional - Kantor Pusat', short: 'KP', bg: 'bg-[#0F4C81]' },
  'WILAYAH': { label: 'Regional - Kantor Wilayah', short: 'KW', bg: 'bg-[#059669]' },
  'BI': { label: 'Breakthrough Innovation', short: 'BI', bg: 'bg-[#7C3AED]' },
  'BC': { label: 'Business Case', short: 'BC', bg: 'bg-[#B45309]' },
};

export default function CuratorBoard({ proposals }: { proposals: ProposalCard[] }) {
  const [activeTab, setActiveTab] = useState<'assigned' | 'review'>('assigned');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'PUSAT': true
  });
  const [expandedWilayah, setExpandedWilayah] = useState<Record<string, boolean>>({});

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleWilayah = (region: string) => {
    setExpandedWilayah(prev => ({ ...prev, [region]: !prev[region] }));
  };

  // Filter based on tab
  const displayedProposals = proposals.filter(p => 
    activeTab === 'assigned' ? p.status !== 'completed' : p.status === 'completed'
  );

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

  const renderProposalList = (items: ProposalCard[]) => (
    <div className="border-t border-gray-100 divide-y divide-gray-100">
      {items.map((p) => (
        <div key={p.id} className="p-6 flex items-start group hover:bg-gray-50 transition-colors">
          {/* Icon */}
          <div className="w-12 h-12 bg-[#0F4C81] rounded-lg text-white flex items-center justify-center flex-shrink-0 mr-4 shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
          </div>

          {/* Content */}
          <div className="flex-1 pr-4">
            <div className="flex items-center space-x-3 mb-1">
              <Link href={`/curator/proposals/${p.id}`} className="hover:underline">
                <h4 className="text-[15px] font-bold text-gray-900 leading-tight">
                  {p.title}
                </h4>
              </Link>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">
                AI: {p.aiScore}
              </span>
            </div>
            <div className="text-xs text-gray-600 font-semibold mb-2">
              {p.division || p.regionCenter || 'Operasional'}
            </div>
            <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
              {p.summary || 'Tidak ada ringkasan.'}
            </p>
          </div>

          {/* Right action / Arrow */}
          <div className="flex-shrink-0 ml-auto pl-4 self-center flex flex-col items-end space-y-2">
            <Link href={`/curator/proposals/${p.id}`} className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-md border border-green-200 hover:bg-green-200">
              {p.status === 'completed' ? 'Lihat Detail' : 'Lakukan Screening'}
            </Link>
            <svg className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>
      ))}
    </div>
  );

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
            activeTab === 'review' ? 'bg-[#0A4736] text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Selesai Discreening
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([cat, items]) => {
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

              {isExpanded && items.length > 0 && cat !== 'WILAYAH' && renderProposalList(items)}

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
                              <h4 className="text-gray-800 font-semibold text-sm">{region}</h4>
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
                          {wExpanded && renderProposalList(wItems)}
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
