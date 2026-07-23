import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './lib/db';
import { proposals } from './lib/db/schema';
import { eq } from 'drizzle-orm';
async function run() {
  const p = await db.select({ title: proposals.title, theme: proposals.theme }).from(proposals).where(eq(proposals.externalSubId, 6487));
  console.log("DB Content:", JSON.stringify(p, null, 2));
  process.exit(0);
}
run();
