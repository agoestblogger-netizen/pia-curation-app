import { getActiveCompetition } from '@/app/actions/competitions';
import { requireRole } from '@/lib/auth/helpers';
import KelolaGrandFinalClient from './KelolaGrandFinalClient';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getGrandFinalSponsors } from '@/app/actions/grand-final-sponsors';
import { proposals, grandFinalAssessments } from '@/lib/db/schema';

export const metadata = {
  title: 'Kelola Grand Final - PIA Curation',
};

export default async function KelolaGrandFinalPage() {
  await requireRole('coordinator');

  const activeComp = await getActiveCompetition();
  if (!activeComp) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Kelola Grand Final</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">
          Belum ada kompetisi aktif.
        </div>
      </div>
    );
  }

  // Get all users with sponsor role
  const sponsorCandidates = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(and(
      sql`'sponsor' = ANY(${users.roles})`,
      eq(users.isActive, true)
    ))
    .orderBy(users.name);

  const assignedSponsors = await getGrandFinalSponsors(activeComp.id);

  // Fetch proposals — include grandFinalOrder for lottery ordering UI
  const gfProposals = await db.select({
    id: proposals.id,
    externalSubId: proposals.externalSubId,
    title: proposals.title,
    category: proposals.category,
    grandFinalOrder: proposals.grandFinalOrder,
  })
  .from(proposals)
  .where(and(
    eq(proposals.competitionId, activeComp.id),
    eq(proposals.status, 'grand_final')
  ))
  .orderBy(
    sql`${proposals.grandFinalOrder} ASC NULLS LAST`,
    proposals.id
  );

  // Fetch assessments
  const gfAssessments = await db.select()
    .from(grandFinalAssessments)
    .where(eq(grandFinalAssessments.competitionId, activeComp.id));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Kelola Grand Final</h1>
      <p className="text-gray-600 mb-6">Pengaturan nomor undian dan penugasan Juri Nasional untuk sesi Grand Final.</p>

      <KelolaGrandFinalClient 
        competitionId={activeComp.id}
        candidates={sponsorCandidates} 
        initialAssigned={assignedSponsors.map(s => s.userId)}
        proposals={gfProposals}
        assessments={gfAssessments}
      />
    </div>
  );
}
