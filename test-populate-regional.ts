import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './lib/db/index';
import { competitions, regionalFinalSessions, regionalFinalPics, regionalFinalJudges, users } from './lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    // Ensure active competition
    const comp = await db.insert(competitions).values({
      name: 'Test Comp',
      year: 2026,
      isActive: true,
    }).returning();
    const compId = comp[0].id;
    console.log("Comp ID:", compId);

    // Insert user
    const user = await db.insert(users).values({
      name: 'Test User',
      email: 'test@test.com',
      passwordHash: 'xx',
      roles: ['regional']
    }).returning();
    const userId = user[0].id;

    // Insert session
    const session = await db.insert(regionalFinalSessions).values({
      competitionId: compId,
      region: 'Jakarta',
      status: 'juri_ditugaskan'
    }).returning();
    const sessionId = session[0].id;

    // Insert PIC
    await db.insert(regionalFinalPics).values({
      sessionId,
      userId
    });

    console.log("Data inserted!");
  } catch (e: any) {
    console.error("Insert failed:", e.message);
  }
}
main();
