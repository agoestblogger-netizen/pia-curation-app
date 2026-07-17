'use client';

import { useState, useTransition } from 'react';
import { saveSponsorScoreAction } from '@/app/actions/scoring';
import { useRouter } from 'next/navigation';

export default function ScoringFormClient({
  competitionId,
  proposalId,
  criteria,
  existingScores,
}: {
  competitionId: number;
  proposalId: number;
  criteria: any[];
  existingScores: any[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Initialize form state
  const initialValues: Record<number, string> = {};
  criteria.forEach(c => {
    const existing = existingScores.find(s => s.criterionId === c.id);
    initialValues[c.id] = existing ? existing.score.toString() : '';
  });
  
  const [values, setValues] = useState<Record<number, string>>(initialValues);

  const isLocked = existingScores.length > 0 && !existingScores[0].isDraft;

  const handleSubmit = (isDraft: boolean) => (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Convert values to numbers
    const scores: Record<number, number> = {};
    for (const c of criteria) {
      const val = parseFloat(values[c.id]);
      if (isNaN(val)) {
        setError(`Nilai untuk ${c.name} tidak valid`);
        return;
      }
      scores[c.id] = val;
    }

    startTransition(async () => {
      const result = await saveSponsorScoreAction(competitionId, proposalId, scores, isDraft);
      if (result.error) {
        setError(result.error);
      } else {
        if (!isDraft) {
          router.push('/sponsor');
        } else {
          setError('Draft berhasil disimpan (Bukan pesan error)');
        }
      }
    });
  };

  if (isLocked) {
    return (
      <div className="bg-green-50 p-6 rounded-lg border border-green-200 shadow-sm">
        <h3 className="text-green-800 font-bold mb-4">Nilai Sudah Dikunci</h3>
        <div className="space-y-4">
          {criteria.map(c => (
            <div key={c.id} className="flex justify-between border-b border-green-200 pb-2">
              <span className="text-green-900">{c.name} (Max {c.maxScore})</span>
              <span className="font-bold text-green-700">{values[c.id]}</span>
            </div>
          ))}
        </div>
        <button 
          onClick={() => router.push('/sponsor')}
          className="mt-6 text-sm text-green-700 underline"
        >
          Kembali ke daftar proposal
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <form onSubmit={handleSubmit(false)} className="space-y-6">
        {error && (
          <div className={`p-4 rounded-md font-medium text-sm ${error.includes('berhasil') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {error.includes('berhasil') ? 'Draft berhasil disimpan.' : error}
          </div>
        )}

        {criteria.map((c) => (
          <div key={c.id}>
            <label htmlFor={`criterion_${c.id}`} className="block text-sm font-bold text-gray-700 mb-1">
              {c.name} <span className="font-normal text-gray-500">(Maks: {c.maxScore}, Bobot: {c.weight * 100}%)</span>
            </label>
            {c.description && <p className="text-xs text-gray-500 mb-2">{c.description}</p>}
            <input
              type="number"
              id={`criterion_${c.id}`}
              min="0"
              max={c.maxScore}
              step="0.1"
              required
              value={values[c.id]}
              onChange={(e) => setValues({ ...values, [c.id]: e.target.value })}
              className="block w-full max-w-xs rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
            />
          </div>
        ))}

        <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSubmit(true)}
            disabled={isPending}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {isPending ? 'Memproses...' : 'Simpan Draft'}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {isPending ? 'Memproses...' : 'Kunci Nilai'}
          </button>
        </div>
      </form>
    </div>
  );
}
