'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createFgdSessionAction } from '@/app/actions/fgd';

const FILTER_OPTIONS = [
  { id: 'lolos', label: 'Lolos' },
  { id: 'duplication', label: 'Duplication' },
  { id: 'mapped', label: 'Mapped' },
  { id: 'non_compliance', label: 'Non-Compliance' },
  { id: 'low_impact', label: 'Low Impact' },
];

export default function NewFgdClient({ 
  competitionId, 
  regions 
}: { 
  competitionId: number;
  regions: string[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('Sesi FGD ' + new Date().toLocaleDateString('id-ID'));
  const [scope, setScope] = useState<'nasional' | 'regional'>('nasional');
  const [regionCenter, setRegionCenter] = useState<string>('');
  const [targetCandidates, setTargetCandidates] = useState(15);
  const [viewMode, setViewMode] = useState<'grouped' | 'mixed'>('mixed');
  const [filterStatuses, setFilterStatuses] = useState<string[]>(['lolos']);

  function toggleFilter(id: string) {
    if (filterStatuses.includes(id)) {
      setFilterStatuses(filterStatuses.filter(f => f !== id));
    } else {
      setFilterStatuses([...filterStatuses, id]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (filterStatuses.length === 0) {
      setError('Pilih minimal 1 filter status.');
      return;
    }
    if (scope === 'regional' && !regionCenter) {
      setError('Pilih kantor wilayah.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await createFgdSessionAction({
      competitionId,
      name,
      scope,
      regionCenter: scope === 'nasional' ? null : regionCenter,
      targetCandidates,
      viewMode,
      filterStatuses,
    });

    if ('error' in res && res.error) {
      setError(res.error as string);
      setLoading(false);
    } else {
      router.push(`/fgd/${res.sessionId}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-6">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded text-sm font-medium border border-red-200">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Sesi FGD</label>
        <input 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-teal-500 focus:border-teal-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Scope</label>
          <select 
            value={scope} 
            onChange={(e) => setScope(e.target.value as any)}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-teal-500 focus:border-teal-500 bg-white"
          >
            <option value="nasional">Nasional (BI & BC)</option>
            <option value="regional">Regional (Wilayah & Pusat)</option>
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Regional digunakan sebagai *fallback* FGD jika tidak pakai seleksi *direct-pick* standar.
          </p>
        </div>

        {scope === 'regional' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Pilih Wilayah / Kantor Pusat</label>
            <select 
              value={regionCenter} 
              onChange={(e) => setRegionCenter(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-teal-500 focus:border-teal-500 bg-white"
            >
              <option value="">-- Pilih Wilayah --</option>
              {regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Target Jumlah Kandidat (Finalis)</label>
        <input 
          type="number" 
          value={targetCandidates}
          onChange={(e) => setTargetCandidates(Number(e.target.value))}
          min={1}
          required
          className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded focus:ring-teal-500 focus:border-teal-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Filter Status Screening</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FILTER_OPTIONS.map(f => (
            <label key={f.id} className="flex items-center space-x-3 bg-gray-50 px-3 py-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-100">
              <input 
                type="checkbox"
                checked={filterStatuses.includes(f.id)}
                onChange={() => toggleFilter(f.id)}
                className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-800">{f.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Mode Tampilan List</label>
        <div className="space-x-6">
          <label className="inline-flex items-center cursor-pointer">
            <input 
              type="radio" 
              name="viewMode" 
              value="mixed" 
              checked={viewMode === 'mixed'}
              onChange={() => setViewMode('mixed')}
              className="h-4 w-4 text-teal-600"
            />
            <span className="ml-2 text-sm text-gray-800">Campur dengan Badge (Satu list utuh)</span>
          </label>
          <label className="inline-flex items-center cursor-pointer">
            <input 
              type="radio" 
              name="viewMode" 
              value="grouped" 
              checked={viewMode === 'grouped'}
              onChange={() => setViewMode('grouped')}
              className="h-4 w-4 text-teal-600"
            />
            <span className="ml-2 text-sm text-gray-800">Per Kategori (Dikategorikan)</span>
          </label>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200 flex justify-end space-x-4">
        <button 
          type="button" 
          onClick={() => router.back()}
          className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded"
        >
          Batal
        </button>
        <button 
          type="submit" 
          disabled={loading}
          className="px-6 py-2 bg-teal-600 text-white font-medium rounded hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? 'Menyimpan...' : 'Buat Sesi & Masuk Ruang FGD'}
        </button>
      </div>
    </form>
  );
}
