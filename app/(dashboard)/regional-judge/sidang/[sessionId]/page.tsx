import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { proposals, regionalFinalAssessments, regionalFinalJudges, regionalFinalSessions, users } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRegionalFinalProposals } from '@/app/actions/regional-final-judging';
import SidangClient from './SidangClient';

export default async function SidangPenetapanPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const session = await requireRole('regional');
  const resolvedParams = await params;
  const sessionId = parseInt(resolvedParams.sessionId, 10);
  if (isNaN(sessionId)) return notFound();

  const [targetSession] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, sessionId));
  if (!targetSession) return notFound();

  // Make sure only valid judges can see it
  const [judgeAssignment] = await db.select().from(regionalFinalJudges).where(and(
    eq(regionalFinalJudges.sessionId, sessionId),
    eq(regionalFinalJudges.userId, session.userId)
  )).limit(1);

  if (!judgeAssignment) return <div className="p-8">Akses ditolak: Anda bukan Juri untuk grup ini.</div>;

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

  // Compute stats
  const proposalStats = allProposals.map(p => {
    const pAssessments = allAssessments.filter(a => a.proposalId === p.id);
    const totalScore = pAssessments.reduce((sum, a) => sum + (a.paramProblemFit + a.paramDampak + a.paramKelayakan + a.paramProfessional), 0);
    const avgScore = pAssessments.length > 0 ? totalScore / pAssessments.length : 0;
    
    // Map judge scores
    const judgeScores: Record<number, number | null> = {};
    judgesList.forEach(j => {
      const a = pAssessments.find(ax => ax.judgeUserId === j.id);
      judgeScores[j.id] = a ? (a.paramProblemFit + a.paramDampak + a.paramKelayakan + a.paramProfessional) : null;
    });

    return {
      ...p,
      judgeScores,
      avgScore,
      assessedCount: pAssessments.length
    };
  });

  // Sort by avgScore descending
  proposalStats.sort((a, b) => b.avgScore - a.avgScore);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Link href="/regional-judge" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors mb-2">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Kembali ke Pilih Grup
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Sidang Penetapan: {targetSession.region}</h1>
          <p className="text-gray-600 mt-1">Kalibrasi dan finalisasi skor akhir dengan Juri lainnya.</p>
        </div>
      </div>

      <SidangClient 
        sessionId={sessionId}
        judgeAssignment={judgeAssignment}
        judgesList={judgesList}
        proposalStats={proposalStats}
      />
    </div>
  );
}
