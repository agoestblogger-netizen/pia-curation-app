import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { proposals, curatorAssignments, competitions, users } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import CuratorBoard from './CuratorBoard';

export default async function CuratorDashboard() {
  const session = await getSession();
  
  if (!session || !session.roles.includes('curator')) {
    return <div>Unauthorized</div>;
  }

  // Get active competition
  const [activeComp] = await db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1);
  
  let mappedProposals: any[] = [];
  let totalAssigned = 0;
  let totalCompleted = 0;
  
  if (activeComp) {
    // Get all assignments for this curator
    const assignments = await db
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
        proposalRowNumber: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${proposals.category}, ${proposals.regionCenter} ORDER BY ${proposals.id} ASC)`.mapWith(Number),
      })
      .from(curatorAssignments)
      .innerJoin(proposals, eq(curatorAssignments.proposalId, proposals.id))
      .where(and(
        eq(curatorAssignments.curatorId, session.userId),
        eq(proposals.competitionId, activeComp.id)
      ));

    totalAssigned = assignments.length;
    totalCompleted = assignments.filter(a => a.assignmentStatus === 'completed').length;

    mappedProposals = assignments.map(a => ({
      id: a.id,
      title: a.title,
      category: a.category,
      proposerName: a.proposerName,
      division: a.division,
      summary: a.summary,
      regionCenter: a.regionCenter,
      status: a.assignmentStatus,
      aiScore: a.aiCidaTotal ? a.aiCidaTotal.toFixed(1) : '-',
      proposalRowNumber: a.proposalRowNumber,
    }));
  }

  // User details for Identity block
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);

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
      <CuratorBoard proposals={mappedProposals} />
    </div>
  );
}
