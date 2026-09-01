import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { grandFinalAssessments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getGrandFinalProposals } from '@/app/actions/scoring';
import GrandFinalAssessContainer from './GrandFinalAssessContainer';

export default async function AssessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole('sponsor');
  const resolvedParams = await params;
  const proposalId = parseInt(resolvedParams.id, 10);
  if (isNaN(proposalId)) return notFound();

  // Get active competition (cached)
  const activeComp = await getActiveCompetition();
  if (!activeComp) return <div className="p-8">Tidak ada kompetisi aktif.</div>;

  // Single parallel fetch for all Grand Final proposals and sponsor assessments
  const [gfProposals, myAssessments] = await Promise.all([
    getGrandFinalProposals(activeComp.id),
    db.select().from(grandFinalAssessments).where(
      and(
        eq(grandFinalAssessments.competitionId, activeComp.id),
        eq(grandFinalAssessments.sponsorId, session.userId)
      )
    ),
  ]);

  if (!gfProposals.some((p) => p.id === proposalId)) {
    return notFound();
  }

  return (
    <GrandFinalAssessContainer
      competitionId={activeComp.id}
      initialProposalId={proposalId}
      proposals={gfProposals as any}
      initialAssessments={myAssessments}
      judgeName={session.name}
    />
  );
}

