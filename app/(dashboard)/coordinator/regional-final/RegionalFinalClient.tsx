'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setRegionalFinalistsAction, lockRegionalGroupAction, reopenRegionalGroupAction } from '@/app/actions/regional-final';
import type { RegionalGroup } from '@/app/actions/regional-final';

interface Props {
  competitionId: number;
  groups: RegionalGroup[];
  readOnly?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  'PUSAT': 'bg-[#0F4C81]',
  'WILAYAH': 'bg-[#059669]',
};

export default function RegionalFinalClient({ competitionId, groups, readOnly }: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(groups[0]?.region ?? null);
  const [selections, setSelections] = useState<Record<string, Set<number>>>(() => {
    const init: Record<string, Set<number>> = {};
    for (const g of groups) {
      init[g.region] = new Set(g.proposals.filter(p => p.status === 'regional_finalist').map(p => p.id));
    }
    return init;
  });
  const [filterVerdict, setFilterVerdict] = useState<Record<string, string>>({});
  const [error, setError] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<Record<string, string>>({});
  const [confirmLock, setConfirmLock] = useState<string | null>(null);
  const [confirmReopen, setConfirmReopen] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const toggleSelection = (group: RegionalGroup, proposalId: number, isLocked: boolean, verdict: string | null) => {
    if (readOnly || isLocked || verdict !== 'lolos') return;

    const currentSet = selections[group.region] ?? new Set();
    
    // Validasi batas maksimal di luar updater state
    if (!currentSet.has(proposalId) && currentSet.size >= 10) {
      setError(e => ({ ...e, [group.region]: 'Maksimal 10 finalis per grup.' }));
      return;
    }

    // Bersihkan pesan error & success sebelumnya saat user mulai berinteraksi
    setError(e => ({ ...e, [group.region]: '' }));
    setSuccess(s => ({ ...s, [group.region]: '' }));
    
    setSelections(prev => {
      const next = new Map(Object.entries(prev));
      const set = new Set(next.get(group.region) ?? []);
      
      if (set.has(proposalId)) {
        set.delete(proposalId);
      } else {
        set.add(proposalId);
      }
      
      next.set(group.region, set);
      return Object.fromEntries(next);
    });
  };

  const handleLock = (group: RegionalGroup, confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmLock(group.region);
      return;
    }
    setConfirmLock(null);

    const regionKey = group.category === 'PUSAT' ? 'PUSAT' : group.region;
    const ids = Array.from(selections[group.region] ?? []);

    // Bersihkan pesan sebelumnya
    setError(e => ({ ...e, [group.region]: '' }));
    setSuccess(s => ({ ...s, [group.region]: '' }));

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
        router.refresh();
      }
    });
  };

  const handleReopen = (group: RegionalGroup, confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmReopen(group.region);
      return;
    }
    setConfirmReopen(null);

    const regionKey = group.category === 'PUSAT' ? 'PUSAT' : group.region;

    // Bersihkan pesan sebelumnya
    setError(e => ({ ...e, [group.region]: '' }));
    setSuccess(s => ({ ...s, [group.region]: '' }));

    startTransition(async () => {
      const result = await reopenRegionalGroupAction(competitionId, regionKey);
      if (result?.success) {
        setSuccess(s => ({ ...s, [group.region]: 'Grup dibuka kembali.' }));
        router.refresh();
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
                    {group.totalProposals} proposal lolos · {group.finalistCount} finalis dipilih
                    {group.isLocked && <span className="ml-2 text-green-600 font-semibold">🔒 Terkunci</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {false && (
                  <select
                    className="text-xs border-gray-300 rounded-md py-1 px-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={filterVerdict[group.region] || 'lolos'}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      setFilterVerdict(prev => ({ ...prev, [group.region]: e.target.value }));
                      if (!isExpanded) setExpandedGroup(group.region);
                    }}
                  >
                    <option value="lolos">Status: Lolos</option>
                    <option value="duplication">Status: Duplication</option>
                    <option value="mapped">Status: Mapped</option>
                    <option value="non_compliance">Status: Non Compliance</option>
                    <option value="low_impact">Status: Low Impact</option>
                  </select>
                )}
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
                    .filter(p => p.verdict === (filterVerdict[group.region] || 'lolos'))
                    .filter(p => (filterVerdict[group.region] || 'lolos') !== 'lolos' || p.status !== 'takeout' || selected.has(p.id))
                    .sort((a, b) => (b.aiCidaTotal ?? 0) - (a.aiCidaTotal ?? 0))
                    .map((p, idx) => {
                    const isSelected = selected.has(p.id);
                    const isLocked = group.isLocked;
                    const canSelect = p.verdict === 'lolos';

                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleSelection(group, p.id, isLocked, p.verdict)}
                        className={`px-6 py-4 flex items-center space-x-4 transition-colors ${
                          isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                        } ${(!canSelect || isLocked) ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                      >
                        <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${
                          !canSelect ? 'bg-gray-100 border-gray-200' :
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
                            rel="noopener noreferrer"
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                          >
                            📄 Download Berita Acara FGD
                          </a>
                        ) : (
                          <a
                            href={`/api/pdf/regional/${group.category === 'PUSAT' ? 'Kantor Pusat' : group.region.replace('Kanwil ', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                          >
                            📄 Download Surat Penetapan
                          </a>
                        )}
                        {!readOnly && (
                          confirmReopen === group.region ? (
                            <div className="flex space-x-2 items-center bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200">
                              <span className="text-sm font-medium text-orange-800">Yakin buka kembali?</span>
                              <button
                                onClick={() => handleReopen(group, true)}
                                disabled={isPending}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50"
                              >
                                Ya
                              </button>
                              <button
                                onClick={() => setConfirmReopen(null)}
                                disabled={isPending}
                                className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleReopen(group)}
                              disabled={isPending}
                              className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                            >
                              Buka Kembali
                            </button>
                          )
                        )}
                      </>
                    ) : (
                      <>
                        {!readOnly && (
                          confirmLock === group.region ? (
                            <div className="flex space-x-2 items-center bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                              <span className="text-sm font-medium text-green-800">Kunci & takeout sisanya?</span>
                              <button
                                onClick={() => handleLock(group, true)}
                                disabled={isPending || selected.size === 0}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                              >
                                Ya, Kunci
                              </button>
                              <button
                                onClick={() => setConfirmLock(null)}
                                disabled={isPending}
                                className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleLock(group)}
                              disabled={isPending || selected.size === 0}
                              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              🔒 Kunci Grup
                            </button>
                          )
                        )}
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
