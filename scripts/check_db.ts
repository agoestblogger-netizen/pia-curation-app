import { db } from '../lib/db/index';
import { proposals, screeningResults } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
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

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(console.error);
