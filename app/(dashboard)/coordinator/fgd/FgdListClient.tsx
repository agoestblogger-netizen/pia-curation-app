'use client';

import { FgdSession } from '@/lib/db/schema';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteFgdSessionAction } from '@/app/actions/fgd';

export default function FgdListClient({ sessions }: { sessions: FgdSession[] }) {
  const router = useRouter();

  async function handleDelete(id: number) {
    if (!confirm('Yakin ingin menghapus sesi FGD ini? Data komentar dan vote di dalamnya akan hilang.')) return;
    const res = await deleteFgdSessionAction(id);
    if (res.error) alert(res.error);
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow border border-gray-200 text-center text-gray-500">
        Belum ada sesi FGD yang dibuat.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
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
          {sessions.map((s) => (
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
                {s.status !== 'locked' && (
                  <button 
                    onClick={() => handleDelete(s.id)}
                    className="text-red-600 font-medium hover:text-red-800 text-sm"
                  >
                    Hapus
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
