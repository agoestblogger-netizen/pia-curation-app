import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { proposals, users, curatorAssignments } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getActiveCompetition } from '@/app/actions/competitions';
import CoordinatorBoard from './CoordinatorBoard';

export default async function ProposalsPage() {
  await requireRole('coordinator');

  const activeComp = await getActiveCompetition();

  if (!activeComp) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Semua Proposal</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">Belum ada kompetisi aktif.</div>
      </div>
    );
  }

  // Get deterministic row numbers for all proposals in this competition first
  const rnResult = await db.execute(sql`
    SELECT id, ROW_NUMBER() OVER (PARTITION BY category, region_center ORDER BY id ASC) as rn 
    FROM proposals 
    WHERE competition_id = ${activeComp.id}
  `);
  const rnMap = new Map();
  for (const row of rnResult) {
    rnMap.set(row.id, Number(row.rn));
  }

  // Fetch all proposals and left join with curatorAssignments (assigned/in_review/completed)
  // Since assignments are 1:1 per batch, we can join directly or aggregate.
  // Assuming 1 active batch per competition for simplicity.
  const rows = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      category: proposals.category,
      proposerName: proposals.proposerName,
      division: proposals.division,
      summary: proposals.summary,
      regionCenter: proposals.regionCenter,
      status: proposals.status,
      aiScore: proposals.aiCidaTotal,
      curatorName: users.name,
    })
    .from(proposals)
    .leftJoin(
      curatorAssignments,
      eq(proposals.id, curatorAssignments.proposalId)
    )
    .leftJoin(users, eq(curatorAssignments.curatorId, users.id))
    .where(eq(proposals.competitionId, activeComp.id));

  const mappedProposals = rows.map(r => ({
    id: r.id,
    title: r.title,
    category: r.category,
    proposerName: r.proposerName,
    division: r.division,
    summary: r.summary,
    regionCenter: r.regionCenter,
    status: r.status,
    aiScore: r.aiScore !== null ? Number(r.aiScore).toFixed(2) : 'N/A',
    curatorName: r.curatorName,
    proposalRowNumber: rnMap.get(r.id) || 0,
  }));

  const completedCount = mappedProposals.filter(p => p.status === 'completed').length;
  const totalCount = mappedProposals.length;

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-end mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Semua Proposal</h1>
          <div className="text-sm font-semibold text-gray-500">
            {completedCount} dari {totalCount} total proposal sudah discreening semua kurator
          </div>
        </div>
        <p className="text-gray-500 text-sm">
          Pantau seluruh proposal lintas kategori dan status screening (tanpa filter).
        </p>
      </div>

      <CoordinatorBoard proposals={mappedProposals} />
    </div>
  );
}
