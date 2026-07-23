import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './lib/db/index';
import { proposals, curatorAssignments, screeningResults } from './lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { getProposalDuplicateWarnings } from './app/actions/duplicates';
import { checkHardLock } from './app/actions/screening';
import { maskProposalIdentity } from './lib/utils/blindReview';

async function main() {
  const curatorId = 4;
  const proposalId = 2001; // We can get a real proposalId first
  
  console.time('Get Proposal');
  let [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  console.timeEnd('Get Proposal');

  if (!proposal) {
     console.log('Proposal not found');
     return;
  }
  
  console.time('Mask Identity');
  proposal = maskProposalIdentity(proposal);
  console.timeEnd('Mask Identity');

  console.time('Get Row Number');
  const rnResult = await db.execute(sql`
    SELECT rn FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY category, region_center ORDER BY id ASC) as rn 
      FROM proposals 
      WHERE competition_id = ${proposal.competitionId}
    ) sub WHERE sub.id = ${proposalId}
  `);
  console.timeEnd('Get Row Number');

  console.time('Get Assignment');
  const [assignment] = await db.select().from(curatorAssignments).where(
    and(
      eq(curatorAssignments.curatorId, curatorId),
      eq(curatorAssignments.proposalId, proposalId)
    )
  ).limit(1);
  console.timeEnd('Get Assignment');

  console.time('Get Warnings');
  const warnings = await getProposalDuplicateWarnings(proposalId);
  console.timeEnd('Get Warnings');

  if (assignment) {
    console.time('Check Hard Lock');
    await checkHardLock(proposalId, proposal.competitionId);
    console.timeEnd('Check Hard Lock');
  }

  // Next and Prev logic
  console.time('Get Next Prev');
  const allAssignments = await db
      .select({ proposalId: curatorAssignments.proposalId, category: proposals.category, regionCenter: proposals.regionCenter, nomorUrut: proposals.nomorUrut })
      .from(curatorAssignments)
      .innerJoin(proposals, eq(curatorAssignments.proposalId, proposals.id))
      .where(and(eq(curatorAssignments.curatorId, curatorId), eq(proposals.competitionId, proposal.competitionId)));

    allAssignments.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.regionCenter && b.regionCenter && a.regionCenter !== b.regionCenter) return a.regionCenter.localeCompare(b.regionCenter);
      return (a.nomorUrut || 0) - (b.nomorUrut || 0);
    });
  console.timeEnd('Get Next Prev');
}
main();
