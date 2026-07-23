import { db } from './lib/db';
import { proposals } from './lib/db/schema';
import { inArray } from 'drizzle-orm';

async function main() {
  const ids = [3376, 2005, 2007, 3375, 2003, 2006, 3377, 2004, 3379];
  const props = await db.select({ id: proposals.id, category: proposals.category, status: proposals.status })
    .from(proposals)
    .where(inArray(proposals.id, ids));
  console.log(props);
}
main().catch(console.error).then(() => process.exit(0));
