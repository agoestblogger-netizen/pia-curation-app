import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './lib/db/index';
import { proposals, curatorAssignments, competitions, users, potentialDuplicates } from './lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { getActiveDuplicateWarningsForProposals } from './app/actions/duplicates';

async function main() {
  const curatorId = 4;
  
  console.time('Total List Fetch Time');
  
  const [compResult, userResult] = await Promise.all([
    db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1),
    db.select().from(users).where(eq(users.id, curatorId)).limit(1)
  ]);
  const activeComp = compResult[0];
  const user = userResult[0];

  if (activeComp) {
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
          nomorUrut: proposals.nomorUrut,
        })
        .from(curatorAssignments)
        .innerJoin(proposals, eq(curatorAssignments.proposalId, proposals.id))
        .where(and(
          eq(curatorAssignments.curatorId, curatorId),
          eq(proposals.competitionId, activeComp.id)
        )),
      db.select().from(potentialDuplicates).where(
        and(eq(potentialDuplicates.markedBy, curatorId), ne(potentialDuplicates.status, 'rejected'))
      )
    ]);
    
    const assignedProposalIds = assignments.map(a => a.id);
    const activeWarnings = await getActiveDuplicateWarningsForProposals(assignedProposalIds);
  }

  console.timeEnd('Total List Fetch Time');
}

main();
