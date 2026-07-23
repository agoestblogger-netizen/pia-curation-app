import { db } from './lib/db';
import { fgdSessions } from './lib/db/schema';

async function main() {
  const result = await db.select().from(fgdSessions);
  console.log(result);
}
main().catch(console.error).then(() => process.exit(0));
