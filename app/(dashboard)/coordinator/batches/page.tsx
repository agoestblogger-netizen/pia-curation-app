import { getSession } from '@/lib/auth/session';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getBatchWithAssignments } from '@/app/actions/batches';
import { db } from '@/lib/db';
import { curationBatches, users, promoterAssignments, proposals } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import AssignProposalUI from './AssignProposalUI';

export default async function BatchesPage() {
  const session = await getSession();
  if (!session || (!session.roles.includes('coordinator') && !session.roles.includes('viewer'))) {
    return <div className="p-8 text-red-500">Unauthorized</div>;
  }
  const isViewerOnly = session.roles.includes('viewer') && !session.roles.includes('coordinator') && !session.roles.includes('admin');

  const activeComp = await getActiveCompetition();
  if (!activeComp) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Assign Proposal</h1>
        <p className="text-gray-500">Belum ada kompetisi aktif.</p>
      </div>
    );
  }

  // ─── Kurator Data ───────────────────────────────────────────────────────────
  let [batch] = await db.select().from(curationBatches).where(
    and(
      eq(curationBatches.competitionId, activeComp.id),
      eq(curationBatches.assignmentMode, 'manual_range')
    )
  ).limit(1);

  if (!batch) {
    const [newBatch] = await db.insert(curationBatches).values({
      competitionId: activeComp.id,
      name: `Assign Proposal - ${activeComp.name}`,
      assignmentMode: 'manual_range',
      status: 'draft',
      createdBy: session.userId,
    }).returning();
    batch = newBatch;
  }

  const batchDetailsPromise = getBatchWithAssignments(batch.id);

  const curatorsPromise = db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(sql`'curator' = ANY(${users.roles})`, eq(users.isActive, true)))
    .orderBy(users.name);

  // ─── Promotor Data ──────────────────────────────────────────────────────────
  const promotersPromise = db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(sql`'promoter' = ANY(${users.roles})`, eq(users.isActive, true)))
    .orderBy(users.name);

  const promAssignmentsPromise = db
    .select({
      id: promoterAssignments.id,
      proposalId: promoterAssignments.proposalId,
      promoterId: promoterAssignments.promoterId,
      category: proposals.category,
      status: proposals.status,
      proposalRowNumber: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${proposals.category}, ${proposals.regionCenter} ORDER BY ${proposals.id} ASC)`,
      proposalRegionCenter: proposals.regionCenter,
    })
    .from(promoterAssignments)
    .innerJoin(proposals, eq(proposals.id, promoterAssignments.proposalId))
    .where(eq(promoterAssignments.competitionId, activeComp.id));

  // ─── Proposals Pool ────────────────────────────────────────────────────────
  // All proposals with correct row numbers
  const rankedProposalsResultPromise = db.execute(sql`
    SELECT id, title, summary, category, region_center as "regionCenter", status,
           ROW_NUMBER() OVER (PARTITION BY category, region_center ORDER BY id ASC) as "rowNumber"
    FROM proposals
    WHERE competition_id = ${activeComp.id}
  `);

  const [
    batchDetails,
    curators,
    promoters,
    promAssignments,
    rankedProposalsResult
  ] = await Promise.all([
    batchDetailsPromise,
    curatorsPromise,
    promotersPromise,
    promAssignmentsPromise,
    rankedProposalsResultPromise
  ]);
  
  const allProposals = rankedProposalsResult as unknown as any[];
  // For promotor we only want 'promotor_selection'
  const promotorProposals = allProposals.filter(p => p.status === 'promotor_selection');

  return (
    <div className="p-8">
      <AssignProposalUI 
        batchId={batch.id}
        competitionId={activeComp.id}
        promotorAccessMode={activeComp.promotorAccessMode as 'open' | 'assigned'}
        
        // Kurator Props
        curators={curators}
        assignments={batchDetails?.assignments || []}
        allProposals={allProposals}
        
        // Promotor Props
        promoters={promoters}
        promoterAssignments={promAssignments}
        promotorProposals={promotorProposals}
        readOnly={isViewerOnly}
      />
    </div>
  );
}
