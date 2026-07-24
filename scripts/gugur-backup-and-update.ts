import { db } from '../lib/db';
import { proposals } from '../lib/db/schema';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function run() {
  console.log('=== Starting Backup and Status Update for 191 Non-Resubmission Proposals ===');

  // 1. Fetch all 191 non-resubmission proposals
  const nonResubmitted = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      category: proposals.category,
      proposerName: proposals.proposerName,
      status: proposals.status,
      linkResubmitProposal: proposals.linkResubmitProposal,
    })
    .from(proposals)
    .where(sql`link_resubmit_proposal IS NULL OR link_resubmit_proposal = ''`);

  console.log(`Found ${nonResubmitted.length} proposals without resubmission.`);

  if (nonResubmitted.length === 0) {
    console.log('No proposals to update.');
    process.exit(0);
  }

  // 2. Create backup folder if not exists
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `gugur_backup_${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(nonResubmitted, null, 2));
  console.log(`Backup saved to ${backupFile}`);

  // 3. Update status = 'gugur' for these proposals
  const nonResubmittedIds = nonResubmitted.map(p => p.id);
  
  await db
    .update(proposals)
    .set({
      status: 'gugur',
    })
    .where(sql`link_resubmit_proposal IS NULL OR link_resubmit_proposal = ''`);

  console.log(`Successfully updated ${nonResubmittedIds.length} proposals to status = 'gugur'.`);

  // 4. Verify DB counts
  const [stats] = await db.select({
    total: sql<number>`count(*)`,
    gugurCount: sql<number>`count(CASE WHEN status = 'gugur' THEN 1 END)`,
    activeCount: sql<number>`count(CASE WHEN status != 'gugur' THEN 1 END)`,
  }).from(proposals);

  console.log('=== Database Verification ===');
  console.log(`Total Proposals: ${stats.total}`);
  console.log(`Active (Resubmission): ${stats.activeCount}`);
  console.log(`Gugur (Tidak Resubmission): ${stats.gugurCount}`);

  process.exit(0);
}

run().catch((err) => {
  console.error('Error running backup and update script:', err);
  process.exit(1);
});
