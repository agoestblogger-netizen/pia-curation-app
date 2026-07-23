import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './lib/db/index';
import { sql } from 'drizzle-orm';

async function main() {
  const proposalIds = Array.from({length: 150}, (_, i) => i + 1).join(',');
  const query = sql`
    SELECT * FROM potential_duplicates 
    WHERE (proposal_a_id IN (${sql.raw(proposalIds)}) OR proposal_b_id IN (${sql.raw(proposalIds)}))
      AND status != 'rejected'
  `;

  console.log("=== EXPLAIN ANALYZE (WITHOUT INDEX) ===");
  await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL enable_indexscan = off`);
    await tx.execute(sql`SET LOCAL enable_bitmapscan = off`);
    const explainNoIndex = await tx.execute(sql`EXPLAIN ANALYZE ${query}`);
    console.log(explainNoIndex.map(r => r['QUERY PLAN']).join('\n'));
  });

  console.log("\n=== EXPLAIN ANALYZE (WITH INDEX) ===");
  await db.transaction(async (tx) => {
    // Force index scan by disabling seqscan
    await tx.execute(sql`SET LOCAL enable_seqscan = off`);
    const explainIndex = await tx.execute(sql`EXPLAIN ANALYZE ${query}`);
    console.log(explainIndex.map(r => r['QUERY PLAN']).join('\n'));
  });
  
  process.exit(0);
}
main();
