import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { proposals, users, curatorAssignments } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getActiveCompetition } from '@/app/actions/competitions';
import CoordinatorBoard from './CoordinatorBoard';
import { getCoordinatorPotentialDuplicates } from '@/app/actions/duplicates';

export default async function ProposalsPage() {
  const session = await requireRole(['coordinator', 'viewer']);
  const isViewer = session.roles.includes('viewer') && !session.roles.includes('coordinator');

  const activeComp = await getActiveCompetition();

  if (!activeComp) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Semua Proposal</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">Belum ada kompetisi aktif.</div>
      </div>
    );
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
      regionCenter: proposals.regionCenter,
      status: proposals.status,
      aiScore: proposals.aiCidaTotal,
      curatorName: users.name,
      nomorUrut: proposals.nomorUrut,
      linkResubmitProposal: proposals.linkResubmitProposal,
      assignmentStatus: curatorAssignments.status,
    })
    .from(proposals)
    .leftJoin(
      curatorAssignments,
      eq(proposals.id, curatorAssignments.proposalId)
    )
    .leftJoin(users, eq(curatorAssignments.curatorId, users.id))
    .where(eq(proposals.competitionId, activeComp.id));

  const mappedProposals = rows.map(r => {
    const isScreened = r.assignmentStatus === 'completed' || r.status === 'completed' || r.status === 'curation_passed' || r.status === 'curation_rejected';
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      proposerName: r.proposerName,
      division: r.division,
      regionCenter: r.regionCenter,
      status: r.assignmentStatus === 'completed' ? 'completed' : r.status,
      isScreened,
      aiScore: r.aiScore !== null ? Number(r.aiScore).toFixed(2) : 'N/A',
      curatorName: r.curatorName,
      proposalRowNumber: r.nomorUrut || 0,
      hasResubmission: !!r.linkResubmitProposal,
    };
  });

  mappedProposals.sort((a, b) => a.proposalRowNumber - b.proposalRowNumber);

  const completedCount = mappedProposals.filter(p => p.isScreened && p.status !== 'gugur').length;
  const totalActiveCount = mappedProposals.filter(p => p.status !== 'gugur').length;

  const duplicates = isViewer ? [] : await getCoordinatorPotentialDuplicates();

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-end mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Semua Proposal</h1>
          <div className="text-sm font-semibold text-gray-500">
            {completedCount} dari {totalActiveCount} total proposal sudah discreening semua kurator
          </div>
        </div>
        <p className="text-gray-500 text-sm">
          Pantau seluruh proposal lintas kategori dan status screening (tanpa filter).
        </p>
      </div>

      <CoordinatorBoard 
        proposals={mappedProposals} 
        duplicates={duplicates} 
        isViewer={isViewer} 
        showGugur={activeComp.showGugurProposals ?? false}
      />
    </div>
  );
}
