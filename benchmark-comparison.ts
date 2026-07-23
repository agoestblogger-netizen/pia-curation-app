import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './lib/db/index';
import { proposals, curatorAssignments, competitions, users, potentialDuplicates } from './lib/db/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { getActiveDuplicateWarningsForProposals } from './app/actions/duplicates';

async function warmup() {
  await db.select({ id: users.id }).from(users).limit(1);
}

async function runTest(testFn: () => Promise<number>, name: string, iterations: number = 5) {
  let total = 0;
  for (let i = 0; i < iterations; i++) {
    total += await testFn();
  }
  console.log(`${name}: ${(total / iterations).toFixed(2)} ms`);
  return total / iterations;
}

async function getWarningsRaw(assignedIds: number[]) {
  if (assignedIds.length === 0) return [];
  const list = assignedIds.join(',');
  const query = sql`
    SELECT * FROM potential_duplicates 
    WHERE (proposal_a_id IN (${sql.raw(list)}) OR proposal_b_id IN (${sql.raw(list)}))
      AND status != 'rejected'
  `;
  return await db.execute(query);
}

async function testOldWaterfall(curatorId: number) {
  const start = performance.now();
  const [activeComp] = await db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1);
  if (activeComp) {
    const assignments = await db
      .select({ id: proposals.id })
      .from(curatorAssignments)
      .innerJoin(proposals, eq(curatorAssignments.proposalId, proposals.id))
      .where(and(eq(curatorAssignments.curatorId, curatorId), eq(proposals.competitionId, activeComp.id)));
      
    const assignedIds = assignments.map(a => a.id);
    await getWarningsRaw(assignedIds);
  }
  await db.select().from(potentialDuplicates).where(
    and(eq(potentialDuplicates.markedBy, curatorId), ne(potentialDuplicates.status, 'rejected'))
  );
  await db.select().from(users).where(eq(users.id, curatorId)).limit(1);
  
  return performance.now() - start;
}

async function testNewPromiseAll(curatorId: number) {
  const start = performance.now();
  const [compResult, userResult] = await Promise.all([
    db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1),
    db.select().from(users).where(eq(users.id, curatorId)).limit(1)
  ]);
  const activeComp = compResult[0];

  if (activeComp) {
    const [assignments, curatorDuplicates] = await Promise.all([
      db
        .select({ id: proposals.id })
        .from(curatorAssignments)
        .innerJoin(proposals, eq(curatorAssignments.proposalId, proposals.id))
        .where(and(eq(curatorAssignments.curatorId, curatorId), eq(proposals.competitionId, activeComp.id))),
      db.select().from(potentialDuplicates).where(
        and(eq(potentialDuplicates.markedBy, curatorId), ne(potentialDuplicates.status, 'rejected'))
      )
    ]);
    const assignedIds = assignments.map(a => a.id);
    await getWarningsRaw(assignedIds);
  }
  return performance.now() - start;
}

async function main() {
  const curatorId = 4;
  await warmup();
  
  // (a) TANPA Index, Waterfall
  await db.execute(sql`SET enable_indexscan = off`);
  await db.execute(sql`SET enable_bitmapscan = off`);
  const tA = await runTest(() => testOldWaterfall(curatorId), "(a) TANPA Index, Waterfall");
  
  // (b) DENGAN Index, Waterfall
  await db.execute(sql`SET enable_indexscan = on`);
  await db.execute(sql`SET enable_bitmapscan = on`);
  await db.execute(sql`SET enable_seqscan = off`);
  const tB = await runTest(() => testOldWaterfall(curatorId), "(b) DENGAN Index, Waterfall");
  
  // (c) DENGAN Index, Promise.all
  const tC = await runTest(() => testNewPromiseAll(curatorId), "(c) DENGAN Index, Promise.all");
  
  console.log(`\nKontribusi Index: ${(tA - tB).toFixed(2)} ms lebih cepat`);
  console.log(`Kontribusi Promise.all: ${(tB - tC).toFixed(2)} ms lebih cepat`);
  console.log(`Total Speedup: ${((tA / tC)).toFixed(2)}x lebih cepat`);
  
  process.exit(0);
}
main();
