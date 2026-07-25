'use client';

import { useState } from 'react';

export interface CuratorStat {
  name: string;
  categoriesAssigned: string;
  total: number;
  completed: number;
  sisa: number;
}

interface CuratorAssignmentTableProps {
  curatorStats: CuratorStat[];
}

export default function CuratorAssignmentTable({ curatorStats }: CuratorAssignmentTableProps) {
  const [sortBy, setSortBy] = useState<'sisa' | 'completed'>('completed');

  const sortedStats = [...curatorStats].sort((a, b) => {
    if (sortBy === 'completed') {
      return b.completed - a.completed || a.sisa - b.sisa || a.name.localeCompare(b.name);
    }
    return b.sisa - a.sisa || b.completed - a.completed || a.name.localeCompare(b.name);
  });

  return (
    <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-gray-900">Assignment per Kurator</h2>
            {sortBy === 'completed' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                🏆 Leaderboard
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {sortBy === 'sisa'
              ? 'Data beban kerja seluruh kurator (diurutkan berdasarkan sisa terbanyak).'
              : 'Peringkat keaktifan kurator (diurutkan berdasarkan jumlah yang sudah discreening terbanyak).'}
          </p>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label htmlFor="curator-sort" className="text-xs font-semibold text-gray-600 flex-shrink-0">
            Urutkan:
          </label>
          <select
            id="curator-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'sisa' | 'completed')}
            className="text-xs font-semibold bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
          >
            <option value="sisa">🔄 Sisa Terbanyak</option>
            <option value="completed">🏆 Sudah Discreening Terbanyak</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="min-w-full divide-y divide-gray-100 flex-1">
          <thead className="bg-white">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                {sortBy === 'completed' ? 'Peringkat & Kurator' : 'Kurator'}
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kategori yang Di-assign</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total Assigned</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sudah Discreening</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sisa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedStats.map((stat, index) => {
              const rank = index + 1;
              return (
                <tr key={stat.name} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-3 text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      {sortBy === 'completed' && (
                        <span
                          className={`inline-flex items-center justify-center font-extrabold text-xs px-2 py-0.5 rounded-md ${
                            rank === 1
                              ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-xs'
                              : rank === 2
                              ? 'bg-slate-200 text-slate-700 border border-slate-300'
                              : rank === 3
                              ? 'bg-orange-100 text-orange-800 border border-orange-300'
                              : 'bg-gray-100 text-gray-600 font-semibold'
                          }`}
                        >
                          {rank === 1 ? '🥇 #1' : rank === 2 ? '🥈 #2' : rank === 3 ? '🥉 #3' : `#${rank}`}
                        </span>
                      )}
                      <span className="font-semibold">{stat.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 max-w-xs truncate" title={stat.categoriesAssigned}>
                    {stat.categoriesAssigned}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{stat.total}</td>
                  <td className={`px-5 py-3 text-sm font-semibold ${stat.completed > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {stat.completed}
                    {stat.total > 0 && stat.completed === stat.total && (
                      <span className="ml-1.5 inline-flex items-center text-emerald-600 font-bold" title="Workload 100% Selesai">
                        ✓
                      </span>
                    )}
                  </td>
                  <td className={`px-5 py-3 text-sm font-bold ${stat.sisa > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                    {stat.sisa}
                  </td>
                </tr>
              );
            })}
            {sortedStats.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-4 text-center text-sm text-gray-500">
                  Belum ada kurator yang terdaftar atau aktif.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
