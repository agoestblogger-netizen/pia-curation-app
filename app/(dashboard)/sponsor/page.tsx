import { requireRole } from '@/lib/auth/helpers';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getGrandFinalProposals, getCriteria } from '@/app/actions/scoring';
import Link from 'next/link';
import { db } from '@/lib/db';
import { grandFinalAssessments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

  const myAssessments = await db.select({ proposalId: grandFinalAssessments.proposalId })
    .from(grandFinalAssessments)
    .where(eq(grandFinalAssessments.sponsorId, session.userId));
  const assessedIds = new Set(myAssessments.map(a => a.proposalId));

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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Judul Proposal</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {proposals.map((p, index) => (
              <tr key={p.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">{index + 1}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {p.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {p.category === 'BC' ? 'Business Case' : p.category === 'BI' ? 'Breakthrough Innovation' : p.category}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/sponsor/assess/${p.id}`} className="text-indigo-600 hover:text-indigo-900 transition-colors">
                      Beri Nilai &rarr;
                    </Link>
                    {assessedIds.has(p.id) && (
                      <span 
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200/60 shadow-sm"
                        title="Done"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        Done
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {proposals.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
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
