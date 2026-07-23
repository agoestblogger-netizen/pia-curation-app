import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './lib/db/index';
import { eq, inArray } from 'drizzle-orm';
import { 
  regionalFinalSessions, regionalFinalPics, regionalFinalJudges, regionalFinalResults, regionalFinalAssessments, proposals, auditLogs
} from './lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  const compId = 1; // Assuming 1 is the active competition

  const [picCountBefore] = await db.execute(sql`SELECT count(*) FROM regional_final_pics`);
  console.log("PIC Count Before:", picCountBefore);

  try {
    const regSessions = await db
      .select({ id: regionalFinalSessions.id })
      .from(regionalFinalSessions)
      .where(eq(regionalFinalSessions.competitionId, compId));
    const regSessionIds = regSessions.map(s => s.id);

    console.log("Sessions to process:", regSessionIds);

    if (regSessionIds.length > 0) {
      await db.delete(regionalFinalPics).where(inArray(regionalFinalPics.sessionId, regSessionIds));
      console.log("Deleted PICs");
      await db.delete(regionalFinalJudges).where(inArray(regionalFinalJudges.sessionId, regSessionIds));
      console.log("Deleted Judges");

      await db.update(regionalFinalSessions)
        .set({ status: 'finalis_terkunci' })
        .where(inArray(regionalFinalSessions.id, regSessionIds));
      console.log("Updated sessions");
    }
  } catch (e: any) {
    console.error("Simulation failed:", e.message);
  }

  const [picCountAfter] = await db.execute(sql`SELECT count(*) FROM regional_final_pics`);
  console.log("PIC Count After:", picCountAfter);
}
main();
