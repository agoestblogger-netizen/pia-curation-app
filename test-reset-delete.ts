import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './lib/db/index';
import { regionalFinalPics, regionalFinalJudges } from './lib/db/schema';

async function main() {
  try {
    const resPic = await db.delete(regionalFinalPics);
    console.log("Deleted PICs:", resPic);
    const resJudge = await db.delete(regionalFinalJudges);
    console.log("Deleted Judges:", resJudge);
  } catch (e: any) {
    console.error("Delete failed:", e.message);
  }
}
main();
