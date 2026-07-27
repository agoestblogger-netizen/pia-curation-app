import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { proposals, curatorAssignments, competitions, users, screeningResults } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { maskProposalIdentity } from '@/lib/utils/blindReview';
import CuratorBoard from './CuratorBoard';
import { getCuratorPotentialDuplicates, getActiveDuplicateWarningsForProposals } from '@/app/actions/duplicates';

export default async function CuratorDashboard() {
  const session = await getSession();
  
  if (!session || !session.roles.includes('curator')) {
    return <div>Unauthorized</div>;
  }

  // Get active competition and User details concurrently
  const [compResult, userResult] = await Promise.all([
    db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1),
    db.select().from(users).where(eq(users.id, session.userId)).limit(1)
  ]);
  const activeComp = compResult[0];
  const user = userResult[0];
  
  let mappedProposals: any[] = [];
  let totalAssigned = 0;
  let totalCompleted = 0;
  let duplicates: any[] = [];
  
  if (activeComp) {

    // Get all assignments for this curator and their duplicates concurrently
    const [assignments, curatorDuplicates] = await Promise.all([
      db
        .select({
          id: proposals.id,
          title: proposals.title,
          category: proposals.category,
          proposerName: proposals.proposerName,
          division: proposals.division,
          summary: proposals.summary,
          regionCenter: proposals.regionCenter,
          aiCidaTotal: proposals.aiCidaTotal,
          assignmentStatus: curatorAssignments.status,
          screeningVerdict: screeningResults.verdict,
          nomorUrut: proposals.nomorUrut,
          linkResubmitProposal: proposals.linkResubmitProposal,
        })
        .from(curatorAssignments)
        .innerJoin(proposals, eq(curatorAssignments.proposalId, proposals.id))
        .leftJoin(screeningResults, eq(curatorAssignments.id, screeningResults.assignmentId))
        .where(and(
          eq(curatorAssignments.curatorId, session.userId),
          eq(proposals.competitionId, activeComp.id),
          sql`(${proposals.status} IS NULL OR ${proposals.status} != 'gugur')`
        )),
      getCuratorPotentialDuplicates()
    ]);

    duplicates = curatorDuplicates;
    totalAssigned = assignments.length;
    totalCompleted = assignments.filter(a => a.assignmentStatus === 'completed').length;

    const assignedProposalIds = assignments.map(a => a.id);
    const activeWarnings = await getActiveDuplicateWarningsForProposals(assignedProposalIds);
    const warningProposalIds = new Set(
      activeWarnings.flatMap(w => [w.proposalAId, w.proposalBId])
    );

    mappedProposals = assignments.map(a => ({
      ...maskProposalIdentity({
        id: a.id,
        title: a.title,
        category: a.category,
        proposerName: a.proposerName,
        division: a.division,
        summary: a.summary,
        regionCenter: a.regionCenter,
        status: a.assignmentStatus,
        aiScore: a.aiCidaTotal ? a.aiCidaTotal.toFixed(1) : '-',
        proposalRowNumber: a.nomorUrut || 0,
        hasResubmission: !!a.linkResubmitProposal,
      }),
      screeningVerdict: a.screeningVerdict || null,
      hasDuplicateWarning: warningProposalIds.has(a.id)
    }));

    mappedProposals.sort((a, b) => a.proposalRowNumber - b.proposalRowNumber);
  } else {
    // If no active comp, we might still want to fetch duplicates for UI consistency
    duplicates = await getCuratorPotentialDuplicates();
  }

  return (
    <div className="w-full">
      {/* Identity Block */}
      <div className="mb-8 flex justify-between items-center bg-transparent">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-[#D1FAE5] text-[#059669] font-bold text-lg rounded-full flex items-center justify-center">
            {user?.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{user?.name}</h2>
            <p className="text-sm text-gray-500">
              {totalCompleted} dari {totalAssigned} proposal jatah Anda sudah discreening
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area handled by Client Component for Tabs & Accordion interactivity */}
      <CuratorBoard proposals={mappedProposals} duplicates={duplicates} />
    </div>
  );
}
