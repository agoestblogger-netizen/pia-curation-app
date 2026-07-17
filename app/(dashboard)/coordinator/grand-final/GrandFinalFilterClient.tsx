'use client';

import { useState, useTransition } from 'react';
import { selectGrandFinalAction, deselectGrandFinalAction, lockGrandFinalAction } from '@/app/actions/grand-final';
import { useRouter } from 'next/navigation';

interface ProposalList {
  id: number;
  externalId: string | null;
  title: string;
  category: string;
  proposerName: string;
}

export default function GrandFinalFilterClient({
  competitionId,
  proposals,
  initialSelectedIds,
}: {
  competitionId: number;
  proposals: ProposalList[];
  initialSelectedIds: number[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(initialSelectedIds));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggleSelection = (proposalId: number) => {
    setError(null);
    const isSelected = selectedIds.has(proposalId);
    
    if (!isSelected && selectedIds.size >= 10) {
      setError('Maksimal 10 proposal untuk Grand Final.');
      return;
    }

    startTransition(async () => {
      if (isSelected) {
        const result = await deselectGrandFinalAction(competitionId, proposalId);
        if (result.success) {
          const nextIds = new Set(selectedIds);
          nextIds.delete(proposalId);
          setSelectedIds(nextIds);
        } else {
          setError(result.error || 'Terjadi kesalahan');
        }
      } else {
        const result = await selectGrandFinalAction(competitionId, proposalId);
        if (result.success) {
          const nextIds = new Set(selectedIds);
          nextIds.add(proposalId);
          setSelectedIds(nextIds);
        } else {
          setError(result.error || 'Terjadi kesalahan');
        }
      }
    });
  };

  const handleLock = () => {
    if (confirm('Anda yakin ingin mengunci hasil? Proposal nominasi yang tidak terpilih akan otomatis di-takeout.')) {
      startTransition(async () => {
        const result = await lockGrandFinalAction(competitionId);
        if (result.error) {
          setError(result.error);
        } else {
          router.push('/coordinator');
        }
      });
    }
  };

  return (
    <div>
      <div className="mb-6 p-4 bg-white shadow rounded-lg flex justify-between items-center border border-gray-200">
        <div>
          <span className="text-sm font-medium text-gray-700">
            Terpilih: <span className="font-bold text-indigo-600 text-lg">{selectedIds.size}</span> / 10
          </span>
          {isPending && <span className="ml-4 text-sm text-gray-500 animate-pulse">Memproses...</span>}
          {error && <span className="ml-4 text-sm text-red-600 font-medium">{error}</span>}
        </div>
        <button
          onClick={handleLock}
          disabled={isPending}
          className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 transition"
        >
          {isPending ? 'Memproses...' : 'Kunci Hasil Grand Final'}
        </button>
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
                      {isSelected ? '✓ Terpilih' : 'Pilih ke GF'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {proposals.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500 text-sm">
              Tidak ada proposal nominasi.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
