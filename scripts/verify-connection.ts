import { sql } from 'drizzle-orm';
import { db } from '../lib/db';
import {
  users,
  competitions,
  proposals,
  curationBatches,
  curatorAssignments,
  screeningResults,
  promoterSelections,
  grandFinalSelections,
  sponsorScores,
  finalResults,
  auditLogs,
} from '../lib/db/schema';

async function verifyConnection() {
  console.log('Verifying connection to PostgreSQL (Supabase)...');
  try {
    const start = Date.now();
    const result = await db.execute(sql`SELECT version()`);
    const ms = Date.now() - start;
    console.log(`✅ Connected successfully in ${ms}ms!`);
    console.log(`Database Version: ${result[0].version}`);

    console.log('\n--- Table Statistics ---');
    const counts = [];
    counts.push(await db.select({ count: sql<number>`count(*)` }).from(users));
    counts.push(await db.select({ count: sql<number>`count(*)` }).from(competitions));
    counts.push(await db.select({ count: sql<number>`count(*)` }).from(proposals));
    counts.push(await db.select({ count: sql<number>`count(*)` }).from(curationBatches));
    counts.push(await db.select({ count: sql<number>`count(*)` }).from(curatorAssignments));
    counts.push(await db.select({ count: sql<number>`count(*)` }).from(screeningResults));
    counts.push(await db.select({ count: sql<number>`count(*)` }).from(promoterSelections));
    counts.push(await db.select({ count: sql<number>`count(*)` }).from(grandFinalSelections));
    counts.push(await db.select({ count: sql<number>`count(*)` }).from(sponsorScores));
    counts.push(await db.select({ count: sql<number>`count(*)` }).from(finalResults));
    counts.push(await db.select({ count: sql<number>`count(*)` }).from(auditLogs));

    const stats = [
      { table: 'Users', count: counts[0][0].count },
      { table: 'Competitions', count: counts[1][0].count },
      { table: 'Proposals', count: counts[2][0].count },
      { table: 'Curation Batches', count: counts[3][0].count },
      { table: 'Curator Assignments', count: counts[4][0].count },
      { table: 'Screening Results', count: counts[5][0].count },
      { table: 'Promoter Selections', count: counts[6][0].count },
      { table: 'Grand Final Selections', count: counts[7][0].count },
      { table: 'Sponsor Scores', count: counts[8][0].count },
      { table: 'Final Results', count: counts[9][0].count },
      { table: 'Audit Logs', count: counts[10][0].count },
    ];

    console.table(stats);

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to connect to database:');
    console.error(error);
    process.exit(1);
  }
}

verifyConnection();
