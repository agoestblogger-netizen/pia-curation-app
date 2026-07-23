import { db } from './lib/db';
import { competitions } from './lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  await db.update(competitions).set({ isActive: false }).where(eq(competitions.id, 2));
  console.log("Updated ID 2 to inactive");
}
main().catch(console.error).then(() => process.exit(0));
