import { db } from './lib/db';
import { proposals } from './lib/db/schema';
import { eq, or } from 'drizzle-orm';

async function main() {
  const result = await db.select({
    id: proposals.id,
    externalSubId: proposals.externalSubId,
    title: proposals.title,
    status: proposals.status,
  }).from(proposals).where(
    or(
      eq(proposals.id, 2098),
      eq(proposals.externalSubId, '2098')
    )
  );
  console.log(result);
}
main().catch(console.error).then(() => process.exit(0));
