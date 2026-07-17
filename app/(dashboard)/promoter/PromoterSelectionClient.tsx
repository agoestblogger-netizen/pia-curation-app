'use client';

import { useState, useTransition } from 'react';
import { selectProposalAction, deselectProposalAction } from '@/app/actions/promoter';

interface ProposalList {
  id: number;
  externalId: string | null;
  title: string;
  category: string;
  proposerName: string;
}

export default function PromoterSelectionClient({
  competitionId,
  proposals,
  initialSelectedIds,
}: {
  competitionId: number;
  proposals: ProposalList[];
  initialSelectedIds: number[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(initialSelectedIds));
  const [isPending, startTransition] = useTransition();

  const toggleSelection = (proposalId: number) => {
    const isSelected = selectedIds.has(proposalId);
    
    // Optimistic UI update
    const nextIds = new Set(selectedIds);
    if (isSelected) {
      nextIds.delete(proposalId);
    } else {
      nextIds.add(proposalId);
    }
    setSelectedIds(nextIds);

    // Server action
    startTransition(async () => {
      if (isSelected) {
        await deselectProposalAction(competitionId, proposalId);
      } else {
        await selectProposalAction(competitionId, proposalId);
      }
    });
  };

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">
          Anda telah memilih <span className="font-bold text-indigo-600">{selectedIds.size}</span> proposal
        </span>
        {isPending && <span className="text-sm text-gray-500 animate-pulse">Menyimpan...</span>}
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
        <ul role="list" className="divide-y divide-gray-200">
          {proposals.map((proposal) => {
            const isSelected = selectedIds.has(proposal.id);
            return (
              <li key={proposal.id}>
                <div className="flex items-center px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                    <div className="truncate">
                      <div className="flex text-sm">
                        <p className="font-medium text-indigo-600 truncate">{proposal.title}</p>
                        <p className="ml-1 flex-shrink-0 font-normal text-gray-500">
                          - {proposal.proposerName}
                        </p>
                      </div>
                      <div className="mt-2 flex">
                        <div className="flex items-center text-sm text-gray-500 space-x-4">
                          <span>ID: {proposal.externalId}</span>
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            {proposal.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="ml-5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleSelection(proposal.id)}
                      disabled={isPending}
                      className={`relative inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-inset transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white ring-indigo-600 hover:bg-indigo-500'
                          : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isSelected ? '✓ Terpilih' : 'Pilih'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {proposals.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500 text-sm">
              Tidak ada proposal yang lolos kurasi.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
