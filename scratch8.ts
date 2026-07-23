import { db } from './lib/db';
import { fgdSessions, proposals } from './lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const fgds = await db.select().from(fgdSessions).where(eq(fgdSessions.fgdType, 'promoter'));
  console.log("Promoter FGDs:", fgds);
  
  const targetStatuses = ['promotor_selection', 'promotor_passed', 'promotor_rejected', 'grand_final', 'takeout'];
  const props = await db.select({ id: proposals.id, status: proposals.status, takeoutReason: proposals.takeoutReason })
    .from(proposals)
    .where(inArray(proposals.status, targetStatuses));
  console.log("Proposals in target statuses:", props);
}
main().catch(console.error).then(() => process.exit(0));
