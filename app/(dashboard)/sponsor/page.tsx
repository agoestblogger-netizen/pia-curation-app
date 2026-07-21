import { requireRole } from '@/lib/auth/helpers';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getGrandFinalProposals, getCriteria } from '@/app/actions/scoring';
import Link from 'next/link';

export default async function SponsorDashboard() {
  const session = await requireRole('sponsor');

  const activeComp = await getActiveCompetition();

  if (!activeComp || activeComp.phase !== 'sponsor_scoring') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Penilaian Sponsor</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md">
          {activeComp 
            ? `Tahap penilaian belum dibuka (Saat ini: ${activeComp.phase}).`
            : 'Belum ada kompetisi aktif.'}
        </div>
      </div>
    );
  }

  const proposals = await getGrandFinalProposals(activeComp.id);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Penilaian Grand Final</h1>
      <p className="text-gray-600 mb-8">
        Silakan berikan penilaian untuk proposal-proposal Grand Final berikut.
      </p>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Judul Proposal</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {proposals.map((p) => (
              <tr key={p.id}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.category}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link href={`/sponsor/assess/${p.id}`} className="text-indigo-600 hover:text-indigo-900">
                    Beri Nilai &rarr;
                  </Link>
                </td>
              </tr>
            ))}
            {proposals.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                  Tidak ada proposal Grand Final.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
