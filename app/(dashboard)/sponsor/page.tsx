import { requireRole } from '@/lib/auth/helpers';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getGrandFinalProposals } from '@/app/actions/scoring';
import Link from 'next/link';
import { db } from '@/lib/db';
import { grandFinalAssessments, grandFinalSponsors } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export default async function SponsorDashboard() {
  const session = await requireRole('sponsor');

  const activeComp = await getActiveCompetition();

  if (!activeComp || activeComp.phase !== 'sponsor_scoring') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Penilaian Grand Final</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md">
          {activeComp 
            ? `Tahap penilaian belum dibuka (Saat ini: ${activeComp.phase}).`
            : 'Belum ada kompetisi aktif.'}
        </div>
      </div>
    );
  }

  // Cek apakah sponsor ini di-assign ke Grand Final kompetisi ini
  const [assignment] = await db.select()
    .from(grandFinalSponsors)
    .where(and(
      eq(grandFinalSponsors.competitionId, activeComp.id),
      eq(grandFinalSponsors.userId, session.userId)
    ))
    .limit(1);

  if (!assignment) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Penilaian Grand Final</h1>
        <div className="bg-red-50 text-red-800 p-4 rounded-md">
          Anda belum ditugaskan untuk menilai sesi Grand Final pada kompetisi ini.
        </div>
      </div>
    );
  }

  // Proposals sudah terurut by drawOrder NULLS LAST via getGrandFinalProposals()
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
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">No. Undian</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Judul Proposal</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Done</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {proposals.map((p, index) => (
              <tr key={p.id}>
                <td className="px-4 py-4 whitespace-nowrap text-center">
                  {p.drawOrder != null ? (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-800 text-sm font-bold">
                      {p.drawOrder}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 font-mono">{index + 1}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {p.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {p.category === 'BC' ? 'Business Case' : p.category === 'BI' ? 'Breakthrough Innovation' : p.category}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link href={`/sponsor/assess/${p.id}`} className="text-indigo-600 hover:text-indigo-900 transition-colors">
                    Beri Nilai &rarr;
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                  {assessedIds.has(p.id) ? (
                    <span 
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 shadow-sm cursor-help" 
                      title="Sudah Dinilai"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
              </tr>
            ))}
            {proposals.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
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
