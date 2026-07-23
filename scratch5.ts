import { db } from './lib/db';
import { competitions } from './lib/db/schema';

async function main() {
  const result = await db.select().from(competitions);
  console.log(result);
}
main().catch(console.error).then(() => process.exit(0));
