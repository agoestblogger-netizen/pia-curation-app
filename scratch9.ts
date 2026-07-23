import { resetDataAction } from './app/actions/reset-data';
import { db } from './lib/db';
import { fgdSessions, proposals } from './lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  // Mock requireRole
  jest.mock('./lib/auth/helpers', () => ({
    requireRole: async () => ({ userId: 1, name: 'Admin', role: 'admin' })
  }));

  console.log("Running Reset Hard Lock Promotor...");
  const result = await resetDataAction({
    resetKurasiNasional: false,
    resetHardLockPromotor: true,
    resetRegionalLock: false,
    resetKelolaPicJuri: false,
    resetPenilaianHasil: false,
    resetGrandFinal: false,
    resetAuditLog: false
  });
  console.log("Action result:", result);

  const fgds = await db.select().from(fgdSessions).where(eq(fgdSessions.fgdType, 'promoter'));
  console.log("Promoter FGDs after reset:", fgds);
  
  const targetStatuses = ['promotor_selection', 'promotor_passed', 'promotor_rejected', 'grand_final', 'takeout'];
  const props = await db.select({ id: proposals.id, status: proposals.status, takeoutReason: proposals.takeoutReason })
    .from(proposals)
    .where(inArray(proposals.status, targetStatuses));
  console.log("Proposals in target statuses after reset:", props);
}
main().catch(console.error).then(() => process.exit(0));
