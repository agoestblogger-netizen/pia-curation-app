import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './lib/db';
import { proposals } from './lib/db/schema';
import { inArray } from 'drizzle-orm';

async function run() {
  const ids = [7764, 8087, 6180, 6590];
  const props = await db.select({
    id: proposals.id,
    externalSubId: proposals.externalSubId,
    title: proposals.title,
    proposerName: proposals.proposerName,
    category: proposals.category
  }).from(proposals).where(inArray(proposals.externalSubId, ids));

  console.log("Details for 4 specific proposals:");
  props.forEach(p => {
    console.log(`\nID (External): ${p.externalSubId}`);
    console.log(`Judul Proposal (Database): ${p.title}`);
    console.log(`Ketua Tim (Proposer): ${p.proposerName}`);
    console.log(`Kategori (Database - Aman): ${p.category}`);
    console.log(`Kategori (CSV Resubmit): Regional - Kantor Wilayah`);
    // Assuming BASE_URL is the local dev server or production URL, but we just provide the relative path.
    console.log(`URL Aplikasi: /coordinator/proposals/${p.id}`);
  });

  process.exit(0);
}
run();
