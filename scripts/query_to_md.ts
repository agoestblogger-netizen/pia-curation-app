import { db } from '../lib/db/index';
import { proposals, screeningResults } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

async function main() {
  const result = await db.select({
    id: proposals.id,
    subId: proposals.externalSubId,
    title: proposals.title,
    category: proposals.category,
    regionCenter: proposals.regionCenter,
    status: proposals.status,
    verdict: screeningResults.verdict
  })
  .from(proposals)
  .leftJoin(screeningResults, eq(proposals.id, screeningResults.proposalId))
  .orderBy(proposals.id);

  let md = '# Database Proposals\n\n';
  md += '| ID | Sub ID | Title | Category | Region Center | Status | Verdict |\n';
  md += '|---|---|---|---|---|---|---|\n';

  for (const p of result) {
    md += `| ${p.id} | ${p.subId || ''} | ${p.title} | ${p.category || ''} | ${p.regionCenter || ''} | ${p.status || ''} | ${p.verdict || ''} |\n`;
  }

  fs.writeFileSync('/Users/macbook/.gemini/antigravity-ide/brain/6e83a304-25a1-4a66-97ce-3d2550e9a498/proposals_db.md', md);
  process.exit(0);
}

main().catch(console.error);
