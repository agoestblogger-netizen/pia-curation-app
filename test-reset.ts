import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './lib/db/index';
import { auditLogs, regionalFinalSessions } from './lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    const before = await db.execute(sql`SELECT count(*) FROM audit_logs`);
    console.log("Before count:", before);

    const res = await db.delete(auditLogs);
    console.log("Delete success:", res);

    const after = await db.execute(sql`SELECT count(*) FROM audit_logs`);
    console.log("After count:", after);

    console.log("Testing regional status update:");
    const regRes = await db.update(regionalFinalSessions)
          .set({ status: 'finalis_terkunci' });
    console.log("Update success:", regRes);
  } catch (e: any) {
    console.error("Delete failed:", e);
  }
}
main();
