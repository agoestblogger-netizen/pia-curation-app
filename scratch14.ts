import { db } from './lib/db';
import { proposals, fgdSessions } from './lib/db/schema';
import { eq, and, inArray, ne } from 'drizzle-orm';

async function main() {
  const compId = 1;
  const lockedFgd = await db.select({ id: fgdSessions.id }).from(fgdSessions).where(
    and(
      eq(fgdSessions.competitionId, compId),
      eq(fgdSessions.fgdType, 'curator'),
      eq(fgdSessions.status, 'locked')
    )
  );
  const lockedFgdIds = lockedFgd.map(s => s.id);
  
  console.log("Locked FGD Curator IDs:", lockedFgdIds);

  if (lockedFgdIds.length > 0) {
    await db.update(fgdSessions)
      .set({ status: 'active', lockedAt: null, lockedBy: null })
      .where(inArray(fgdSessions.id, lockedFgdIds));

    // Revert promotor_selection proposals back to fgd
    const targetStatuses = ['promotor_selection'];
    await db.update(proposals)
      .set({ status: 'fgd', takeoutReason: null })
      .where(
        and(
          eq(proposals.competitionId, compId),
          ne(proposals.category, 'WILAYAH'),
          inArray(proposals.status, targetStatuses)
        )
      );
  }

  const fgdAfter = await db.select().from(fgdSessions).where(inArray(fgdSessions.id, [12]));
  console.log("FGD after reset:", fgdAfter);
}
main().catch(console.error).then(() => process.exit(0));
