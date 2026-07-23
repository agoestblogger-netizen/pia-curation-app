import { config } from 'dotenv';
config({ path: '.env.local' });
import { resetDataAction } from './app/actions/reset-data';
import { db } from './lib/db';
import { regionalFinalPics } from './lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  const [sessionCount] = await db.execute(sql`SELECT count(*) FROM regional_final_sessions`);
  console.log("Sessions count:", sessionCount);

  // We have to mock requireRole for the server action if we run it directly.
  // Actually, resetDataAction uses `requireRole('admin')`. We can't easily run it directly from script without a valid cookie.
}
main();
