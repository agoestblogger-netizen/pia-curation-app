import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
import { db } from './lib/db';
import { proposals } from './lib/db/schema';
import { isNotNull, isNull, sql } from 'drizzle-orm';

function normalize(str: string): string {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/["']/g, '') // remove quotes
    .replace(/\s+/g, ' ') // normalize spaces
    .replace(/[^\w\s]/g, '') // remove punctuation
    .trim();
}

async function run() {
  console.log("=== 1. CREATING BACKUP ===");
  try {
    const allData = await db.select().from(proposals);
    const backupFile = `data/backup_proposals_post_merge_${Date.now()}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(allData, null, 2));
    console.log(`Backup created successfully at: ${backupFile} (${allData.length} rows)`);
  } catch (e) {
    console.error("Backup failed:", e);
  }

  console.log("\n=== 2. SCALE VERIFICATION ===");
  try {
    const resNotNull = await db.select({ count: sql<number>`count(*)` }).from(proposals).where(isNotNull(proposals.linkResubmitProposal));
    const resNull = await db.select({ count: sql<number>`count(*)` }).from(proposals).where(isNull(proposals.linkResubmitProposal));
    const resTotal = await db.select({ count: sql<number>`count(*)` }).from(proposals);

    console.log(`Total terisi (NOT NULL): ${resNotNull[0].count} (Target: 1907)`);
    console.log(`Total kosong (NULL): ${resNull[0].count} (Target: 191)`);
    console.log(`Total keseluruhan: ${resTotal[0].count} (Target: 2098)`);
  } catch (e) {
    console.error("Scale verification failed:", e);
  }

  console.log("\n=== 3. SIGNIFICANT METADATA DIFFS ===");
  try {
    const lines = fs.readFileSync('data/resubmission/metadata_diffs.txt', 'utf-8').split('\n').filter(l => l.trim().length > 0);
    const significantDiffs = [];
    let formatDiffsCount = 0;
    
    for (const line of lines) {
      // Line format: ID 123 | Title | LAMA: "A" | BARU: "B"
      const match = line.match(/ID \d+ \| (.+?) \| LAMA: "(.*)" \| BARU: "(.*)"/);
      if (match) {
        const field = match[1];
        const lama = match[2];
        const baru = match[3];
        
        let isFormatDiff = false;
        
        if (field.includes('Category')) {
            const lNorm = normalize(lama);
            const bNorm = normalize(baru);
            if (
               (lNorm === 'bi' && bNorm === 'breakthrough innovation') ||
               (lNorm === 'bc' && bNorm === 'business case') ||
               (lNorm === 'pusat' && bNorm === 'kantor pusat') ||
               (lNorm === 'wilayah' && bNorm === 'kantor wilayah') ||
               lNorm === bNorm
            ) {
                isFormatDiff = true;
            }
        } else {
            if (normalize(lama) === normalize(baru)) {
                isFormatDiff = true;
            }
        }
        
        if (isFormatDiff) {
            formatDiffsCount++;
        } else {
            // Check for significant length difference or completely different words
            significantDiffs.push(line);
        }
      }
    }
    
    console.log(`Out of ${lines.length} diffs, ${formatDiffsCount} were purely format/case/quotes/category-mapping.`);
    console.log(`Found ${significantDiffs.length} SIGNIFICANT differences.`);
    if (significantDiffs.length > 0) {
      console.log("\nSample of significant differences (Top 20):");
      significantDiffs.slice(0, 20).forEach(d => console.log(d));
    }
  } catch (e) {
    console.error("Diff analysis failed:", e);
  }
  
  process.exit(0);
}
run();
