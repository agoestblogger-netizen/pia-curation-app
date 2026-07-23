import { config } from 'dotenv';
config({ path: '.env.local' });
import { resetDataAction } from './app/actions/reset-data';
import { db } from './lib/db';
import { sql } from 'drizzle-orm';
import { auditLogs } from './lib/db/schema';

// Mock requireRole
jest.mock('./lib/auth/helpers', () => ({
  requireRole: async () => ({ userId: 1, name: 'Admin', email: 'a@a.com', roles: ['admin'] })
}));

async function main() {
  const options = {
    resetKurasiNasional: false,
    resetRegionalLock: false,
    resetKelolaPicJuri: false,
    resetPenilaianHasil: false,
    resetGrandFinal: false,
    resetAuditLog: true,
  };
  
  // Since we can't easily run resetDataAction outside of Next.js due to server actions (and requireRole using cookies), 
  // let's just test db.delete(auditLogs) inside here again.
  try {
     await db.delete(auditLogs);
     const after = await db.execute(sql`SELECT count(*) FROM audit_logs`);
     console.log("Count after:", after);
  } catch (e: any) {
     console.log("Error:", e);
  }
}
main();
