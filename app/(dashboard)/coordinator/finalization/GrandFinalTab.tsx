import { db } from '@/lib/db';
import { proposals, grandFinalAssessments, users, competitions } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import GrandFinalRecapUI from './GrandFinalRecapUI';

export default async function GrandFinalTab({ readOnly }: { readOnly: boolean }) {
  const [activeComp] = await db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1);
  if (!activeComp) {
    return <div className="p-8 text-gray-500">Tidak ada kompetisi aktif.</div>;
  }

  // Get Grand Final proposals
  const gfProposals = await db.select({
    id: proposals.id,
    title: proposals.title,
    category: proposals.category,
    status: proposals.status,
    totalScoreAvg: sql<number>`0`, // Placeholder
  }).from(proposals)
    .where(and(
      eq(proposals.competitionId, activeComp.id),
      eq(proposals.status, 'grand_final')
    ));

  // Get all sponsors
  const sponsorUsers = await db.select({
    id: users.id,
    name: users.name,
  }).from(users).where(sql`'sponsor' = ANY(${users.roles})`);

  // Get all assessments
  const assessments = await db.select().from(grandFinalAssessments)
    .where(eq(grandFinalAssessments.competitionId, activeComp.id));

  return (
    <div className="p-8">
      <GrandFinalRecapUI 
        competitionId={activeComp.id}
        proposals={gfProposals}
        sponsors={sponsorUsers}
        assessments={assessments}
        readOnly={readOnly}
      />
    </div>
  );
}
