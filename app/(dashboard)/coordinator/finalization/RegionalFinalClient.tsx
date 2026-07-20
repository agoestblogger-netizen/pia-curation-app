'use client';

import { useState, useTransition } from 'react';
import { setRegionalFinalistsAction, lockRegionalGroupAction, reopenRegionalGroupAction } from '@/app/actions/regional-final';
import type { RegionalGroup } from '@/app/actions/regional-final';

interface Props {
  competitionId: number;
  groups: RegionalGroup[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'PUSAT': 'bg-[#0F4C81]',
  'WILAYAH': 'bg-[#059669]',
};

export default function RegionalFinalClient({ competitionId, groups }: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(groups[0]?.region ?? null);
  const [selections, setSelections] = useState<Record<string, Set<number>>>(() => {
    const init: Record<string, Set<number>> = {};
    for (const g of groups) {
      init[g.region] = new Set(g.proposals.filter(p => p.status === 'regional_finalist').map(p => p.id));
    }
    return init;
  });
  const [error, setError] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const toggleSelection = (group: RegionalGroup, proposalId: number, isLocked: boolean) => {
    if (isLocked) return;
    
    setSelections(prev => {
      const next = new Map(Object.entries(prev));
      const set = new Set(next.get(group.region) ?? []);
      
      if (set.has(proposalId)) {
        set.delete(proposalId);
      } else {
        if (set.size >= 10) {
          setError(e => ({ ...e, [group.region]: 'Maksimal 10 finalis per grup.' }));
          return prev;
        }
        set.add(proposalId);
      }
      
      setError(e => ({ ...e, [group.region]: '' }));
      next.set(group.region, set);
      return Object.fromEntries(next);
    });
  };

  const handleLock = (group: RegionalGroup) => {
    const regionKey = group.category === 'PUSAT' ? 'PUSAT' : group.region;
    const ids = Array.from(selections[group.region] ?? []);
    
    if (!confirm(`Kunci grup ${group.region}? Proposal yang tidak terpilih akan di-takeout dan tidak bisa dikembalikan kecuali buka kembali secara manual.`)) return;

    startTransition(async () => {
      // 1. Simpan state pilihan (checkbox) ke database
      const saveResult = await setRegionalFinalistsAction(competitionId, regionKey, ids);
      if (saveResult?.error) {
        setError(e => ({ ...e, [group.region]: saveResult.error! }));
        return;
      }
      
      // 2. Kunci grup (permanenkan pilihan & takeout sisanya)
      const lockResult = await lockRegionalGroupAction(competitionId, regionKey);
      if (lockResult?.error) {
        setError(e => ({ ...e, [group.region]: lockResult.error! }));
      } else {
        setSuccess(s => ({ ...s, [group.region]: `Grup dikunci. ${lockResult.finalistCount} finalis, ${lockResult.takeoutCount} takeout.` }));
      }
    });
  };

  const handleReopen = (group: RegionalGroup) => {
    const regionKey = group.category === 'PUSAT' ? 'PUSAT' : group.region;
    if (!confirm(`Buka kembali grup ${group.region}? Ini akan mengembalikan proposal takeout ke status curation_passed.`)) return;

    startTransition(async () => {
      const result = await reopenRegionalGroupAction(competitionId, regionKey);
      if (result?.success) {
        setSuccess(s => ({ ...s, [group.region]: 'Grup dibuka kembali.' }));
      }
    });
  };

  return (
    <div className="space-y-4">
      {groups.map(group => {
        const isExpanded = expandedGroup === group.region;
        const selected = selections[group.region] ?? new Set();
        const maxFinalists = Math.min(10, group.proposals.filter(p => p.status !== 'takeout' || selected.has(p.id)).length);
        const catColor = CATEGORY_COLORS[group.category] ?? 'bg-gray-600';

        return (
          <div
            key={group.region}
            className={`bg-white rounded-xl shadow-sm border ${group.isLocked ? 'border-green-400' : isExpanded ? 'border-indigo-400' : 'border-gray-200'}`}
          >
            {/* Header */}
            <button
              onClick={() => setExpandedGroup(isExpanded ? null : group.region)}
              className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none"
            >
              <div className="flex items-center space-x-4">
                <div className={`w-8 h-8 rounded ${catColor} text-white flex items-center justify-center text-xs font-bold`}>
                  {group.category === 'PUSAT' ? 'KP' : 'KW'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{group.region}</h3>
                  <p className="text-xs text-gray-500">
                    {group.totalProposals} proposal · {group.finalistCount} finalis dipilih
                    {group.isLocked && <span className="ml-2 text-green-600 font-semibold">🔒 Terkunci</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  group.finalistCount === 0 ? 'bg-gray-100 text-gray-500' :
                  group.finalistCount < 10 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {group.finalistCount}/10
                </span>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Content */}
            {isExpanded && (
              <div className="border-t border-gray-100">
                {/* Feedback */}
                {error[group.region] && (
                  <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {error[group.region]}
                  </div>
                )}
                {success[group.region] && (
                  <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                    ✅ {success[group.region]}
                  </div>
                )}

                {/* Proposal list */}
                <div className="divide-y divide-gray-100">
                  {group.proposals
                    .filter(p => p.status !== 'takeout' || selected.has(p.id))
                    .sort((a, b) => (b.aiCidaTotal ?? 0) - (a.aiCidaTotal ?? 0))
                    .map((p, idx) => {
                    const isSelected = selected.has(p.id);
                    const isLocked = group.isLocked;

                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleSelection(group, p.id, isLocked)}
                        className={`px-6 py-4 flex items-center space-x-4 cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                        } ${isLocked ? 'cursor-not-allowed' : ''}`}
                      >
                        <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${
                          isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-bold flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 text-sm truncate">{p.title}</h4>
                          <p className="text-xs text-gray-500">{p.proposerName}</p>
                        </div>
                        <div className="flex items-center space-x-3 flex-shrink-0">
                          {p.aiCidaTotal && (
                            <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 font-semibold">
                              AI: {p.aiCidaTotal.toFixed(1)}
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-xs text-indigo-600 font-bold">✓ Finalis</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {selected.size} dari maks. {maxFinalists} dipilih
                    {selected.size > 10 && <span className="text-red-600 ml-2">⚠️ Melebihi batas!</span>}
                  </div>
                  <div className="flex space-x-3">
                    {group.isLocked ? (
                      <>
                        {group.hasLockedFgd ? (
                          <a
                            href={`/api/pdf/fgd/${group.lockedFgdSessionId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                          >
                            📄 Download Berita Acara FGD
                          </a>
                        ) : (
                          <a
                            href={`/api/pdf/regional/${group.category === 'PUSAT' ? 'Kantor Pusat' : group.region.replace('Kanwil ', '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                          >
                            📄 Download Surat Penetapan
                          </a>
                        )}
                        <button
                          onClick={() => handleReopen(group)}
                          disabled={isPending}
                          className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                        >
                          Buka Kembali
                        </button>
                      </>
                    ) : (
                      <>

                        <button
                          onClick={() => handleLock(group)}
                          disabled={isPending || selected.size === 0}
                          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          🔒 Kunci Grup
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
