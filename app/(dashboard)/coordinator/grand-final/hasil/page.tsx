import { getSession } from '@/lib/auth/session';
import { getActiveCompetition } from '@/app/actions/competitions';
import { db } from '@/lib/db';
import { finalResults, proposals } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';

export default async function HasilGrandFinalPage() {
  const session = await getSession();
  
  if (!session || !session.roles.some(r => ['coordinator', 'admin'].includes(r))) {
    return <div className="p-8 text-red-500">Unauthorized</div>;
  }

  const activeComp = await getActiveCompetition();
  if (!activeComp) {
    return <div className="p-8 text-gray-500">Tidak ada kompetisi aktif.</div>;
  }

  // Get final results
  const results = await db.select({
    id: proposals.id,
    title: proposals.title,
    category: proposals.category,
    medal: finalResults.resultStatus,
    notes: finalResults.notes,
  })
  .from(finalResults)
  .innerJoin(proposals, eq(finalResults.proposalId, proposals.id))
  .where(eq(finalResults.competitionId, activeComp.id));

  // Sort logically: Diamond > Platinum > Gold > Silver > Bronze
  const medalOrder: Record<string, number> = {
    'Diamond': 5,
    'Platinum': 4,
    'Gold': 3,
    'Silver': 2,
    'Bronze': 1
  };
  
  results.sort((a, b) => {
    const aVal = medalOrder[a.medal] || 0;
    const bVal = medalOrder[b.medal] || 0;
    return bVal - aVal; // descending
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hasil Akhir Grand Final</h1>
          <p className="text-sm text-gray-500 mt-1">
            Daftar level medali untuk seluruh proposal Grand Final.
          </p>
        </div>
        <div className="flex space-x-3">
          <Link href="/coordinator/grand-final/sidang" className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
            Kembali ke Sidang
          </Link>
          <a href="/api/pdf/grand-final" target="_blank" className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            Download PDF Berita Acara
          </a>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl border border-yellow-200">
          Belum ada hasil Grand Final yang dikunci. Silakan selesaikan Sidang Penetapan terlebih dahulu.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Kategori</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Judul Proposal</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Level Medali</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Catatan Tambahan</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">#{r.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-700">
                      {r.category === 'BI' ? 'Breakthrough Innovation' : r.category === 'BC' ? 'Business Case' : r.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full shadow-sm
                      ${r.medal === 'Diamond' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        r.medal === 'Platinum' ? 'bg-gray-200 text-gray-800 border border-gray-300' :
                        r.medal === 'Gold' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                        r.medal === 'Silver' ? 'bg-gray-100 text-gray-600 border border-gray-300' :
                        'bg-orange-100 text-orange-800 border border-orange-200'}`}
                    >
                      {r.medal}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 italic">
                    {r.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
