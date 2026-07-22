import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { regionalFinalSessions, regionalFinalJudges, regionalFinalAssessments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { getRegionalFinalProposals } from '@/app/actions/regional-final-judging';

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

  const formattedSessions = await Promise.all(
    assignedSessions.map(async (s) => {
      const [targetSession] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, s.sessionId));
      const rProposals = await getRegionalFinalProposals(s.sessionId);
      const assessments = await db.select().from(regionalFinalAssessments).where(eq(regionalFinalAssessments.sessionId, s.sessionId));

      const juriCountSetting = targetSession?.juriCountSetting || 3;
      const expectedAssessments = rProposals.length * juriCountSetting;
      const totalAssessments = assessments.length;
      const isAssessmentComplete = expectedAssessments > 0 && totalAssessments >= expectedAssessments;
      const progressPercentage = expectedAssessments > 0 ? Math.round((totalAssessments / expectedAssessments) * 100) : 0;

      return {
        ...s,
        juriCountSetting,
        proposalCount: rProposals.length,
        totalAssessments,
        expectedAssessments,
        isAssessmentComplete,
        progressPercentage,
      };
    })
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Penilaian Final Regional</h1>
        <p className="text-gray-600 text-sm">
          Pilih grup regional untuk mulai memberikan penilaian kepada para finalis atau masuk ke Sidang Penetapan.
        </p>
      </div>

      {formattedSessions.length === 0 ? (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl border border-yellow-200">
          Anda belum ditugaskan sebagai Juri untuk grup manapun.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {formattedSessions.map(s => {
            const isPenilaianDibuka = s.status === 'penilaian_dibuka';
            const isSidangStage = ['sidang_penetapan', 'penilaian_selesai'].includes(s.status);
            const isTerkunci = s.status === 'hasil_terkunci';

            return (
              <div key={s.sessionId} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="font-bold text-xl text-gray-900">{s.region}</h2>
                    <span className="font-bold text-xs uppercase px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-md whitespace-nowrap">
                      {s.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="text-sm text-gray-500 space-y-2 mt-3">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Progress Penilaian Keseluruhan</span>
                      <span className="font-bold text-indigo-600">{s.totalAssessments} / {s.expectedAssessments}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${s.progressPercentage}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 pt-1 flex items-center justify-between">
                      <span>{s.proposalCount} Finalis</span>
                      <span>Target: {s.juriCountSetting} Juri/Proposal</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {isPenilaianDibuka && (
                    <>
                      {/* Tombol Mulai Penilaian */}
                      {!s.isAssessmentComplete ? (
                        <Link 
                          href={`/regional-judge/assess/${s.sessionId}`}
                          className="block w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-center rounded-lg font-bold transition-colors shadow-sm"
                        >
                          Mulai Penilaian →
                        </Link>
                      ) : (
                        <button 
                          disabled 
                          title="Penilaian awal telah selesai (100%). Silakan masuk ke Sidang Penetapan untuk kalibrasi skor." 
                          className="block w-full py-2 px-4 bg-gray-100 text-gray-400 border border-gray-200 text-center rounded-lg font-bold cursor-not-allowed opacity-75"
                        >
                          Mulai Penilaian (Selesai 100%)
                        </button>
                      )}

                      {/* Tombol Sidang Penetapan */}
                      {s.isAssessmentComplete ? (
                        <Link 
                          href={`/regional-judge/sidang/${s.sessionId}`}
                          className="block w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-center rounded-lg font-bold transition-colors shadow-sm"
                        >
                          📋 Lanjut ke Sidang Penetapan →
                        </Link>
                      ) : (
                        <button 
                          disabled
                          title={`Semua Juri harus menyelesaikan penilaian dulu sebelum lanjut ke Sidang Penetapan. (Progress: ${s.totalAssessments} dari ${s.expectedAssessments} penilaian)`}
                          className="block w-full py-2.5 px-4 bg-gray-200 text-gray-400 border border-gray-300 text-center rounded-lg font-medium cursor-not-allowed opacity-75"
                        >
                          📋 Lanjut ke Sidang Penetapan
                        </button>
                      )}
                    </>
                  )}

                  {isSidangStage && (
                    <>
                      <button 
                        disabled 
                        title="Penilaian awal telah selesai dan sesi saat ini berada di tahap Sidang Penetapan." 
                        className="block w-full py-2 px-4 bg-gray-100 text-gray-400 border border-gray-200 text-center rounded-lg font-bold cursor-not-allowed opacity-75"
                      >
                        Mulai Penilaian (Selesai)
                      </button>
                      <Link 
                        href={`/regional-judge/sidang/${s.sessionId}`}
                        className="block w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-center rounded-lg font-bold transition-colors shadow-sm"
                      >
                        📋 Masuk Sidang Penetapan →
                      </Link>
                    </>
                  )}

                  {isTerkunci && (
                    <Link
                      href={`/regional-judge/sidang/${s.sessionId}`}
                      className="block w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-center rounded-lg font-semibold transition-colors border border-gray-300"
                    >
                      🔍 Lihat Hasil Sidang (Terkunci)
                    </Link>
                  )}

                  {!isPenilaianDibuka && !isSidangStage && !isTerkunci && (
                    <button disabled className="block w-full py-2.5 px-4 bg-gray-50 text-gray-400 text-center rounded-lg font-medium cursor-not-allowed">
                      Belum Dibuka
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
