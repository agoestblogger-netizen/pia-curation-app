import { releaseSingleFgdProposalAction } from './app/actions/fgd';
import { db } from './lib/db';
import { fgdSessions, proposals } from './lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';

async function main() {
  const fgds = await db.select().from(fgdSessions).where(eq(fgdSessions.status, 'locked')).limit(1);
  if (fgds.length > 0) {
    const fgd = fgds[0];
    const poolCondition = fgd.fgdType === 'promoter' 
      ? eq(proposals.status, 'grand_final')
      : (fgd.scope === 'nasional' ? eq(proposals.status, 'promotor_selection') : eq(proposals.status, 'regional_finalist'));
      
    const p = await db.select().from(proposals).where(poolCondition).limit(1);
    if (p.length > 0) {
      console.log('Found locked proposal', p[0].id, 'in session', fgd.id);
    }
  }
}
main();
