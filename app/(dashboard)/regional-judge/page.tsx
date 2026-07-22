import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { regionalFinalSessions, regionalFinalJudges } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';

export const metadata = {
  title: 'Penilaian Final Regional - PIA Curation',
};

export default async function RegionalJudgePage() {
  const session = await requireRole('regional');

  // Get sessions assigned to this judge
  const assignedSessions = await db
    .select({
      sessionId: regionalFinalSessions.id,
      region: regionalFinalSessions.region,
      status: regionalFinalSessions.status,
    })
    .from(regionalFinalJudges)
    .innerJoin(regionalFinalSessions, eq(regionalFinalSessions.id, regionalFinalJudges.sessionId))
    .where(eq(regionalFinalJudges.userId, session.userId));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Penilaian Final Regional</h1>
      <p className="text-gray-600 mb-6">Pilih grup regional untuk mulai memberikan penilaian kepada para finalis.</p>

      {assignedSessions.length === 0 ? (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">
          Anda belum ditugaskan sebagai juri untuk grup manapun.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignedSessions.map(s => {
            const canAssess = s.status === 'penilaian_dibuka';
            
            return (
              <div key={s.sessionId} className="bg-white border rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
                <h2 className="font-bold text-lg text-gray-900 mb-1">{s.region}</h2>
                <div className="text-sm text-gray-500 mb-4">
                  Status: <span className="font-semibold">{s.status.replace('_', ' ').toUpperCase()}</span>
                </div>
                
                {canAssess ? (
                  <Link 
                    href={`/regional-judge/assess/${s.sessionId}`}
                    className="block w-full py-2 px-4 bg-indigo-600 text-white text-center rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Mulai Penilaian
                  </Link>
                ) : s.status === 'sidang_penetapan' ? (
                  <Link 
                    href={`/regional-judge/sidang/${s.sessionId}`}
                    className="block w-full py-2 px-4 bg-green-600 text-white text-center rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm"
                  >
                    Masuk Sidang Penetapan
                  </Link>
                ) : s.status === 'hasil_terkunci' ? (
                  <button disabled className="block w-full py-2 px-4 bg-gray-100 text-gray-500 text-center rounded-lg font-bold cursor-not-allowed border border-gray-200">
                    Hasil Terkunci
                  </button>
                ) : (
                  <button disabled className="block w-full py-2 px-4 bg-gray-50 text-gray-400 text-center rounded-lg font-medium cursor-not-allowed">
                    {s.status === 'penilaian_selesai' ? 'Menunggu Sidang' : 'Belum Dibuka'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
