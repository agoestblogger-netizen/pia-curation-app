import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { regionalFinalAssessments, regionalFinalJudges, regionalFinalPics, regionalFinalSessions, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRegionalFinalProposals, checkSidangOperatorPermission } from '@/app/actions/regional-final-judging';
import SidangClient from './SidangClient';

export default async function SidangPenetapanPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const session = await requireRole(['regional', 'coordinator', 'admin', 'curator']);
  const resolvedParams = await params;
  const sessionId = parseInt(resolvedParams.sessionId, 10);
  if (isNaN(sessionId)) return notFound();

  const [targetSession] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, sessionId));
  if (!targetSession) return notFound();

  // Allow both PIC Regional and assigned Judges (or Coordinator/Admin)
  const perm = await checkSidangOperatorPermission(sessionId, session.userId, session.roles);
  if (!perm.allowed) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center text-red-600 bg-white rounded-xl border shadow-sm my-8">
        <h2 className="text-xl font-bold mb-2">Akses Ditolak</h2>
        <p className="text-gray-600">Anda bukan PIC Regional atau Juri yang ditugaskan untuk grup {targetSession.region}.</p>
      </div>
    );
  }

  const judgesList = await db.select({
    id: users.id,
    name: users.name,
    isFinalized: regionalFinalJudges.isFinalized
  })
  .from(regionalFinalJudges)
  .innerJoin(users, eq(users.id, regionalFinalJudges.userId))
  .where(eq(regionalFinalJudges.sessionId, sessionId))
  .orderBy(users.name);

  const allProposals = await getRegionalFinalProposals(sessionId);
  const allAssessments = await db.select().from(regionalFinalAssessments).where(eq(regionalFinalAssessments.sessionId, sessionId));

  const expectedAssessments = allProposals.length * targetSession.juriCountSetting;
  if (targetSession.status === 'penilaian_dibuka' && allAssessments.length < expectedAssessments) {
    return (
      <div className="p-8 max-w-4xl mx-auto my-8 bg-white rounded-xl border border-amber-200 shadow-sm text-center space-y-4">
        <div className="text-4xl">⏳</div>
        <h2 className="text-xl font-bold text-gray-900">Penilaian Juri Belum Selesai</h2>
        <p className="text-gray-600">
          Sidang Penetapan untuk grup <strong>{targetSession.region}</strong> belum dapat dibuka karena seluruh Juri belum menyelesaikan penilaian awal.
        </p>
        <div className="p-3 bg-amber-50 rounded-lg text-amber-900 font-bold inline-block border border-amber-200 text-sm">
          Progress Penilaian: {allAssessments.length} dari {expectedAssessments} penilaian selesai
        </div>
        <div className="pt-2">
          <Link 
            href={session.roles.includes('curator') ? "/curator/regional-final" : "/regional-judge"}
            className="inline-flex items-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors shadow-sm"
          >
            ← Kembali
          </Link>
        </div>
      </div>
    );
  }

  // Compute stats with 4-parameter breakdown per judge
  const proposalStats = allProposals.map(p => {
    const pAssessments = allAssessments.filter(a => a.proposalId === p.id);
    let totalAvgSum = 0;

    const judgeScores: Record<number, {
      problemFit: number;
      dampak: number;
      kelayakan: number;
      professional: number;
      avgScore: number;
    } | null> = {};

    judgesList.forEach(j => {
      const a = pAssessments.find(ax => ax.judgeUserId === j.id);
      if (a) {
        const avg = (a.paramProblemFit + a.paramDampak + a.paramKelayakan + a.paramProfessional) / 4;
        judgeScores[j.id] = {
          problemFit: a.paramProblemFit,
          dampak: a.paramDampak,
          kelayakan: a.paramKelayakan,
          professional: a.paramProfessional,
          avgScore: avg
        };
        totalAvgSum += avg;
      } else {
        judgeScores[j.id] = null;
      }
    });

    const avgScore = pAssessments.length > 0 ? totalAvgSum / pAssessments.length : 0;

    return {
      ...p,
      judgeScores,
      avgScore,
      assessedCount: pAssessments.length
    };
  });

  // Sort by avgScore descending
  proposalStats.sort((a, b) => b.avgScore - a.avgScore);

  const isSessionFinalized = targetSession.status === 'hasil_terkunci' || (judgesList.length > 0 && judgesList.every(j => j.isFinalized));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href={session.roles.includes('curator') ? "/curator/regional-final" : "/regional-judge"} className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors mb-2">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            ← Kembali
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Sidang Penetapan: {targetSession.region}</h1>
            <span className={`px-3 py-1 text-xs font-bold rounded-full ${
              perm.isPic ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
            }`}>
              Operator: {perm.isPic ? 'PIC Regional' : 'Juri Regional'} ({session.name})
            </span>
          </div>
          <p className="text-gray-600 text-sm mt-1">
            Kalibrasi skor 4 parameter per Juri untuk mencapai kesepakatan hasil sidang. Siapa pun yang mengoperasikan (PIC atau Juri) dapat mengedit sel skor dan menetapkan hasil sidang.
          </p>
        </div>
      </div>

      <SidangClient 
        sessionId={sessionId}
        currentUserId={session.userId}
        isOperatorPic={perm.isPic}
        isSessionFinalized={isSessionFinalized}
        sessionStatus={targetSession.status}
        judgesList={judgesList}
        proposalStats={proposalStats}
      />
    </div>
  );
}
