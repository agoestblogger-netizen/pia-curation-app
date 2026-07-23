import { db } from './lib/db';
import { proposals } from './lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  const result = await db.execute(sql`SELECT DISTINCT category FROM proposals`);
  console.log(result);
}
main().catch(console.error).then(() => process.exit(0));
