import { getSession } from '@/lib/auth/session';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getBatchWithAssignments } from '@/app/actions/batches';
import { db } from '@/lib/db';
import { curationBatches, users } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import AssignProposalUI from './AssignProposalUI';

export default async function BatchesPage() {
  const session = await getSession();
  if (!session || !session.roles.includes('coordinator')) {
    return <div className="p-8 text-red-500">Unauthorized</div>;
  }

  const activeComp = await getActiveCompetition();
  if (!activeComp) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Assign Proposal</h1>
        <p className="text-gray-500">Belum ada kompetisi aktif.</p>
      </div>
    );
  }

  // Find active manual_range batch for this competition
  let [batch] = await db.select().from(curationBatches).where(
    and(
      eq(curationBatches.competitionId, activeComp.id),
      eq(curationBatches.assignmentMode, 'manual_range')
    )
  ).limit(1);

  if (!batch) {
    // Auto-create
    const [newBatch] = await db.insert(curationBatches).values({
      competitionId: activeComp.id,
      name: `Assign Proposal - ${activeComp.name}`,
      assignmentMode: 'manual_range',
      status: 'draft',
      createdBy: session.userId,
    }).returning();
    batch = newBatch;
  }

  const batchDetails = await getBatchWithAssignments(batch.id);
  
  // Fetch all proposals with row_number
  const rankedProposalsResult = await db.execute(sql`
    SELECT id, title, category, region_center, 
           ROW_NUMBER() OVER (PARTITION BY category, region_center ORDER BY id ASC) as row_number
    FROM proposals
    WHERE competition_id = ${activeComp.id}
  `);
  
  const allProposals = rankedProposalsResult as unknown as any[];

  const curators = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(sql`'curator' = ANY(${users.roles})`, eq(users.isActive, true)))
    .orderBy(users.name);

  return (
    <div className="p-8">
      <AssignProposalUI 
        batchId={batch.id}
        curators={curators}
        assignments={batchDetails?.assignments || []}
        allProposals={allProposals}
      />
    </div>
  );
}
