import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const result = await db.execute(sql`SELECT 1 as "number"`);
  console.log(result);
  console.log("Is array?", Array.isArray(result));
}
main().catch(console.error).then(() => process.exit(0));
