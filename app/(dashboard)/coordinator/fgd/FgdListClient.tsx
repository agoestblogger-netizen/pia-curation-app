'use client';

import { FgdSession } from '@/lib/db/schema';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteFgdSessionAction } from '@/app/actions/fgd';

import { useState, useTransition } from 'react';

export default function FgdListClient({ sessions, isCoordinator, roles = [] }: { sessions: FgdSession[], isCoordinator?: boolean, roles?: string[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'curator' | 'promoter'>('curator');
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  function confirmDelete(id: number) {
    setConfirmDeleteId(id);
  }

  async function executeDelete() {
    if (confirmDeleteId === null) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteFgdSessionAction(id);
      if (res.error) alert(res.error);
      setDeletingId(null);
    });
  }

  const showPromoterTab = roles.includes('promoter') || roles.includes('coordinator') || roles.includes('admin') || roles.includes('viewer');

  const filteredSessions = sessions.filter(s => s.fgdType === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sesi FGD</h1>
          <p className="text-gray-600">Kelola sesi Focus Group Discussion (FGD) untuk penetapan proposal.</p>
        </div>
        {isCoordinator && (
          <Link 
            href={`/coordinator/fgd/new?type=${activeTab}`}
            className="bg-teal-600 text-white px-4 py-2 rounded font-medium hover:bg-teal-700 transition"
          >
            + Buat Sesi Baru
          </Link>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        {showPromoterTab && (
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('curator')}
              className={`flex-1 py-4 text-center font-medium ${
                activeTab === 'curator' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              FGD Kurator
            </button>
            <button
              onClick={() => setActiveTab('promoter')}
              className={`flex-1 py-4 text-center font-medium ${
                activeTab === 'promoter' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              FGD Promotor
            </button>
          </div>
        )}
      
      {filteredSessions.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          Belum ada sesi FGD untuk tab ini.
        </div>
      ) : (
      <table className="w-full text-left">
        <thead className="bg-gray-50 border-b border-gray-200 text-sm">
          <tr>
            <th className="px-6 py-4 font-semibold text-gray-700">Nama Sesi</th>
            <th className="px-6 py-4 font-semibold text-gray-700">Scope</th>
            <th className="px-6 py-4 font-semibold text-gray-700">Target</th>
            <th className="px-6 py-4 font-semibold text-gray-700">Status</th>
            <th className="px-6 py-4 font-semibold text-gray-700 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {filteredSessions.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50 transition">
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">{s.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Dibuat: {s.createdAt.toLocaleDateString('id-ID')}
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 uppercase">
                  {s.scope} {s.regionCenter ? `- ${s.regionCenter}` : ''}
                </span>
              </td>
              <td className="px-6 py-4 text-gray-600 text-sm">
                {s.targetCandidates} kandidat
              </td>
              <td className="px-6 py-4">
                {s.status === 'locked' ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Selesai / Dikunci
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    <span className="w-2 h-2 mr-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
                    Aktif
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-right space-x-3">
                <Link 
                  href={`/fgd/${s.id}`} 
                  className="text-teal-600 font-medium hover:text-teal-800 text-sm"
                >
                  Masuk Ruang FGD
                </Link>
                {isCoordinator && s.status !== 'locked' && (
                  <button 
                    onClick={() => confirmDelete(s.id)}
                    disabled={deletingId === s.id}
                    className="text-red-600 font-medium hover:text-red-800 text-sm disabled:opacity-50"
                  >
                    {deletingId === s.id ? 'Menghapus...' : 'Hapus'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
      
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="bg-red-600 text-white p-5">
              <h3 className="text-lg font-bold">Hapus Sesi FGD</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 font-medium">
                Yakin ingin menghapus sesi FGD ini?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Data komentar dan vote di dalamnya akan ikut terhapus dan tidak bisa dikembalikan.
              </p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-100">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                onClick={executeDelete}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm shadow-sm flex items-center gap-2"
              >
                Ya, Hapus Sesi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
