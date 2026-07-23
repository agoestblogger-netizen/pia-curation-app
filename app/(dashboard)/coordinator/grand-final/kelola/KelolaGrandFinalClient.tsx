'use client';

import { useState, useTransition } from 'react';
import { assignGrandFinalSponsorsAction } from '@/app/actions/grand-final-sponsors';
import { useRouter } from 'next/navigation';

type SponsorCandidate = {
  id: number;
  name: string;
  email: string | null;
};

export default function KelolaGrandFinalClient({
  competitionId,
  candidates,
  initialAssigned,
}: {
  competitionId: number;
  candidates: SponsorCandidate[];
  initialAssigned: number[];
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>(initialAssigned);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  const handleToggle = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await assignGrandFinalSponsorsAction(competitionId, selectedIds);
      if (res.success) {
        setMessage({ type: 'success', text: 'Penugasan Sponsor berhasil disimpan.' });
        router.refresh();
      } else {
        setMessage({ type: 'error', text: 'Gagal menyimpan penugasan.' });
      }
    });
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">Daftar Kandidat Sponsor</h2>
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-indigo-600">{selectedIds.length}</span> Sponsor dipilih
        </div>
      </div>
      
      {message && (
        <div className={`p-4 mx-4 mt-4 text-sm rounded-md ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16 text-center">
                  Tugaskan
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama Sponsor
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {candidates.map((candidate) => {
                const isSelected = selectedIds.includes(candidate.id);
                return (
                  <tr 
                    key={candidate.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/30' : ''}`}
                    onClick={() => handleToggle(candidate.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                        checked={isSelected}
                        onChange={() => {}} // handled by tr click
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{candidate.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{candidate.email || '-'}</div>
                    </td>
                  </tr>
                );
              })}
              {candidates.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                    Tidak ada user dengan role Sponsor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Menyimpan...' : 'Simpan Penugasan'}
          </button>
        </div>
      </div>
    </div>
  );
}
