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
  proposals,
  assessments,
}: {
  competitionId: number;
  candidates: SponsorCandidate[];
  initialAssigned: number[];
  proposals: any[];
  assessments: any[];
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>(initialAssigned);
  const [orderMap, setOrderMap] = useState<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    initialAssigned.forEach((id, idx) => {
      map[id] = idx + 1; // Default initial order if they already exist
    });
    return map;
  });
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  const handleToggle = (id: number, e?: React.MouseEvent) => {
    // Prevent toggle if clicking on the number input
    if (e && (e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'number') {
      return;
    }
    
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        setOrderMap(old => {
          const newMap = { ...old };
          delete newMap[id];
          return newMap;
        });
        return prev.filter(x => x !== id);
      } else {
        setOrderMap(old => ({ ...old, [id]: prev.length + 1 }));
        return [...prev, id];
      }
    });
  };

  const handleOrderChange = (id: number, val: string) => {
    const num = parseInt(val, 10);
    setOrderMap(old => ({ ...old, [id]: isNaN(num) ? 0 : num }));
  };

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const payload = selectedIds.map(id => ({ userId: id, sortOrder: orderMap[id] || 0 }));
      const res = await assignGrandFinalSponsorsAction(competitionId, payload);
      if (res.success) {
        setMessage({ type: 'success', text: 'Penugasan Sponsor berhasil disimpan.' });
        router.refresh();
      } else {
        setMessage({ type: 'error', text: 'Gagal menyimpan penugasan.' });
      }
    });
  };

  const assignedSponsorsData = candidates
    .filter(c => selectedIds.includes(c.id))
    .sort((a, b) => (orderMap[a.id] || 0) - (orderMap[b.id] || 0));
  const totalAssessmentsNeeded = proposals.length * assignedSponsorsData.length;
  const validAssessments = assessments.filter(a => selectedIds.includes(a.sponsorId));
  const totalAssessmentsDone = validAssessments.length;
  const progressPercent = totalAssessmentsNeeded > 0 ? Math.round((totalAssessmentsDone / totalAssessmentsNeeded) * 100) : 0;
  const isComplete = totalAssessmentsNeeded > 0 && totalAssessmentsDone === totalAssessmentsNeeded;

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
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Urutan
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
                      {isSelected ? (
                        <input
                          type="number"
                          min="1"
                          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                          value={orderMap[candidate.id] || ''}
                          onChange={(e) => handleOrderChange(candidate.id, e.target.value)}
                        />
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{candidate.email || '-'}</div>
                    </td>
                  </tr>
                );
              })}
              {candidates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
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

      {assignedSponsorsData.length > 0 && (
        <div className="border-t border-gray-200 mt-8 pt-8">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">Monitoring Progress Penilaian</h2>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600 text-right">
                <div>Progress Keseluruhan</div>
                <div className="font-semibold text-gray-900">{totalAssessmentsDone} / {totalAssessmentsNeeded} Penilaian</div>
              </div>
              <div className="w-32 bg-gray-200 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full ${progressPercent === 100 ? 'bg-green-600' : 'bg-indigo-600'}`} style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proposal</th>
                    {assignedSponsorsData.map(sponsor => (
                      <th key={sponsor.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        {sponsor.name.split(' ')[0]}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {proposals.map(p => {
                    const pAssessments = validAssessments.filter(a => a.proposalId === p.id);
                    const isFullyAssessed = pAssessments.length === assignedSponsorsData.length;
                    
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">{p.externalSubId || p.id}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 line-clamp-2">{p.title}</td>
                        {assignedSponsorsData.map(sponsor => {
                          const assessment = pAssessments.find(a => a.sponsorId === sponsor.id);
                          return (
                            <td key={sponsor.id} className="px-4 py-3 text-center">
                              {assessment ? (
                                <span className="inline-flex flex-col items-center">
                                  <span className="text-sm font-semibold text-gray-900">{assessment.totalScore}</span>
                                  <span className={`text-[10px] px-1.5 rounded-full ${
                                    assessment.classification === 'Diamond' ? 'bg-blue-100 text-blue-800' :
                                    assessment.classification === 'Platinum' ? 'bg-gray-200 text-gray-800' :
                                    assessment.classification === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                                    assessment.classification === 'Silver' ? 'bg-gray-100 text-gray-600' :
                                    'bg-orange-100 text-orange-800'
                                  }`}>{assessment.classification}</span>
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center">
                          {isFullyAssessed ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Selesai
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              {pAssessments.length}/{assignedSponsorsData.length}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {proposals.length === 0 && (
                    <tr>
                      <td colSpan={3 + assignedSponsorsData.length} className="px-4 py-4 text-center text-sm text-gray-500">
                        Belum ada proposal Grand Final.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => router.push('/coordinator/grand-final/sidang')}
                disabled={!isComplete}
                className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                  isComplete ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                Lanjut ke Sidang Penetapan &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
