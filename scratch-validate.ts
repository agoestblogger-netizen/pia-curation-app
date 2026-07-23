import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './lib/db';
import { proposals } from './lib/db/schema';
import { inArray, notInArray, isNull, isNotNull } from 'drizzle-orm';
async function run() {
  const ids = [6487, 7224];
  
  // Prove Group B (Narration) and Group C (Scores)
  const modified = await db.select({
    id: proposals.externalSubId,
    title: proposals.title,
    bcIdentifikasiMasalah: proposals.bcIdentifikasiMasalah,
    biMasalahDiselesaikan: proposals.biMasalahDiselesaikan,
    aiCidaViability: proposals.aiCidaViability,
    aiCidaAverage: proposals.aiCidaAverage,
    linkResubmitProposal: proposals.linkResubmitProposal
  }).from(proposals).where(inArray(proposals.externalSubId, ids));
  
  console.log("=== PROOF: GROUP B & C (OVERWRITTEN DATA) ===");
  console.log(JSON.stringify(modified, null, 2));
  
  // Prove Untouched proposals
  // Resubmitted IDs include 6487, 7224, etc. 
  // Let's get one proposal that has linkResubmitProposal as null (untouched)
  const untouched = await db.select({
    id: proposals.externalSubId,
    title: proposals.title,
    aiCidaAverage: proposals.aiCidaAverage,
    linkResubmitProposal: proposals.linkResubmitProposal
  }).from(proposals).where(isNull(proposals.linkResubmitProposal)).limit(2);
  
  console.log("\n=== PROOF: UNTOUCHED PROPOSALS ===");
  console.log(JSON.stringify(untouched, null, 2));

  process.exit(0);
}
run();
