'use client';

import { useActionState } from 'react';
import { createBatchAction } from '@/app/actions/batches';

const MODES = [
  { value: 'equal', label: 'Equal — Dibagi rata' },
  { value: 'manual_quota', label: 'Manual Quota — Tentukan kuota tiap kurator' },
  { value: 'weighted', label: 'Weighted — Berdasarkan beban kerja regional' },
  { value: 'category_based', label: 'Category Based — Berdasarkan kategori' },
  { value: 'hybrid', label: 'Hybrid — Kombinasi weighted + category' },
];

export default function CreateBatchForm({ competitionId }: { competitionId: number }) {
  const [state, action, isPending] = useActionState(createBatchAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="competitionId" value={competitionId} />

      {state?.error && (
        <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">{state.error}</div>
      )}
      {state?.success && (
        <div className="p-3 rounded-md bg-green-50 text-green-700 text-sm">
          Batch berhasil dibuat!
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Nama Batch <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Contoh: Kurasi Batch 1 WILAYAH"
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm px-3"
        />
      </div>

      <div>
        <label htmlFor="assignmentMode" className="block text-sm font-medium text-gray-700 mb-1">
          Mode Pembagian <span className="text-red-500">*</span>
        </label>
        <select
          id="assignmentMode"
          name="assignmentMode"
          required
          className="block w-full rounded-md border-0 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm px-3"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
      >
        {isPending ? 'Membuat batch...' : 'Buat Batch'}
      </button>
    </form>
  );
}
