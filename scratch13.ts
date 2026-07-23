import { db } from './lib/db';
import { proposals, fgdSessions, fgdVotes, fgdComments, promoterSelections, promoterAssignments, competitions } from './lib/db/schema';
import { eq, and, inArray, ne } from 'drizzle-orm';

async function main() {
  const compId = 1;
  const compProposals = await db.select({ id: proposals.id }).from(proposals)
    .where(and(eq(proposals.competitionId, compId), ne(proposals.category, 'WILAYAH')));
  const compNasionalIds = compProposals.map(p => p.id);

  if (compNasionalIds.length > 0) {
    await db.delete(promoterSelections).where(inArray(promoterSelections.proposalId, compNasionalIds));
    await db.delete(promoterAssignments).where(inArray(promoterAssignments.proposalId, compNasionalIds));
  }

  const promoterFgd = await db.select({ id: fgdSessions.id }).from(fgdSessions).where(
    and(eq(fgdSessions.competitionId, compId), eq(fgdSessions.fgdType, 'promoter'))
  );
  const promoterFgdIds = promoterFgd.map(s => s.id);
  if (promoterFgdIds.length > 0) {
    await db.delete(fgdVotes).where(inArray(fgdVotes.sessionId, promoterFgdIds));
    await db.delete(fgdComments).where(inArray(fgdComments.sessionId, promoterFgdIds));
    await db.delete(fgdSessions).where(inArray(fgdSessions.id, promoterFgdIds));
  }

  if (compNasionalIds.length > 0) {
    const targetStatuses = ['promotor_selection', 'promotor_passed', 'promotor_rejected', 'grand_final', 'takeout'];
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

  console.log("Reset finished.");

  const targetStatusesCheck = ['promotor_selection', 'promotor_passed', 'promotor_rejected', 'grand_final', 'takeout'];
  const props = await db.select({ id: proposals.id, status: proposals.status, takeoutReason: proposals.takeoutReason })
    .from(proposals)
    .where(and(inArray(proposals.status, targetStatusesCheck), eq(proposals.competitionId, compId)));
  console.log("Proposals in target statuses after reset for comp 1:", props);

  const ids = [3376, 2005, 2007, 3375, 2003, 2006, 3377, 2004, 3379];
  const fgdProps = await db.select({ id: proposals.id, status: proposals.status })
    .from(proposals)
    .where(inArray(proposals.id, ids));
  console.log("Status of previous grand_final proposals:", fgdProps);
}
main().catch(console.error).then(() => process.exit(0));
