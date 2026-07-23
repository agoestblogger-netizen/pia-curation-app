import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { 
  fgdSessions, fgdVotes, fgdComments, users, proposalAiAnalyses, fgdAdditionalDocuments
} from '@/lib/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import { maskProposalIdentity } from '@/lib/utils/blindReview';
import FgdRoomClient from './FgdRoomClient';
import Link from 'next/link';

export default async function FgdRoomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const session = await getSession();
  if (!session || (!session.roles.includes('coordinator') && !session.roles.includes('curator') && !session.roles.includes('promoter') && !session.roles.includes('viewer'))) {
    return <div>Unauthorized</div>;
  }
  const isViewerOnly = session.roles.includes('viewer') && !session.roles.some(r => ['coordinator', 'curator', 'promoter', 'admin'].includes(r));

  const { sessionId } = await params;
  const sId = parseInt(sessionId, 10);

  const [fgd] = await db.select().from(fgdSessions).where(eq(fgdSessions.id, sId)).limit(1);
  if (!fgd) return <div className="p-8">Sesi FGD tidak ditemukan.</div>;

  const isPureCurator = session.roles.includes('curator') && !session.roles.some(r => ['promoter', 'coordinator', 'admin'].includes(r));
  if (fgd.fgdType === 'promoter' && isPureCurator) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-red-500 mb-4">
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Akses Ditolak</h1>
        <p className="text-gray-600 text-center max-w-md">
          Anda tidak memiliki izin untuk mengakses sesi FGD Promotor. Sesi ini hanya diperuntukkan bagi peran Promotor dan Koordinator.
        </p>
        <Link href="/coordinator/fgd" className="mt-6 text-teal-600 hover:underline">
          ← Kembali ke Daftar FGD
        </Link>
      </div>
    );
  }

  // ─── Build proposal pool with screening verdict filter ────────────────────
  // filterStatuses in fgd stores screening verdicts like ['lolos', 'duplication', ...]
  const rawStatuses = Array.isArray(fgd.filterStatuses) && fgd.filterStatuses.length > 0 ? (fgd.filterStatuses as string[]) : ['lolos'];

  // Build scope condition as raw SQL
  let scopeSql: ReturnType<typeof sql>;
  if (fgd.fgdType === 'promoter') {
    // For Promoter FGD, scope is all proposals that are in 'promotor_selection' status, 
    // regardless of category/region center.
    scopeSql = sql`p.status = 'promotor_selection'`;
  } else if (fgd.scope === 'regional' && fgd.regionCenter) {
    if (fgd.regionCenter === 'Kantor Pusat') {
      scopeSql = sql`p.category = 'PUSAT'`;
    } else {
      scopeSql = sql`(p.category = 'WILAYAH' AND p.region_center = ${fgd.regionCenter})`;
    }
  } else {
    scopeSql = sql`p.category IN ('BI', 'BC')`;
  }

  let queryCondition: ReturnType<typeof sql>;
  if (fgd.fgdType === 'promoter') {
    queryCondition = sql`p.status = 'promotor_selection'`;
  } else {
    queryCondition = sql`sr.verdict IN (${sql.raw(rawStatuses.map(s => `'${s}'`).join(', '))}) AND ${scopeSql}`;
  }

  const rawProposals = await db.execute(sql`
    SELECT 
      p.id,
      p.title,
      p.proposer_name as "proposerName",
      p.proposer_office as "proposerOffice",
      p.proposer_unit_kerja as "proposerUnitKerja",
      p.category,
      p.region_center as "regionCenter",
      p.status,
      p.ai_cida_total as "aiCidaTotal",
      p.summary,
      p.group_name as "groupName",
      p.theme,
      p.external_sub_id as "subId",
      p.link_proposal as "linkProposal",
      ROW_NUMBER() OVER (PARTITION BY p.category, p.region_center ORDER BY p.id ASC) as "rowNumber",
      sr.verdict
    FROM proposals p
    LEFT JOIN screening_results sr ON sr.proposal_id = p.id
    WHERE p.competition_id = ${fgd.competitionId}
      AND ${queryCondition}
    ORDER BY p.category, p.region_center, p.id ASC
  `);

  let allRawProposals = rawProposals as unknown as Array<{
    id: number;
    title: string;
    proposerName: string;
    proposerOffice: string | null;
    proposerUnitKerja: string | null;
    category: string;
    regionCenter: string | null;
    status: string;
    aiCidaTotal: number | null;
    summary: string | null;
    groupName: string | null;
    theme: string | null;
    subId: string | null;
    linkProposal: string | null;
    rowNumber: number;
    verdict: string;
    aiAnalysis?: any;
    additionalDocuments?: any[];
  }>;

  // In FGD room: always mask identity for curator/promoter, even if they are dual-role (coordinator+curator)
  // Coordinator-only users (no curator/promoter role) are NOT masked
  const hasCuratorOrPromoter = session.roles.includes('curator') || session.roles.includes('promoter');
  const isAdminOnly = session.roles.includes('admin') && !hasCuratorOrPromoter;
  const shouldMask = (hasCuratorOrPromoter || isViewerOnly) && !isAdminOnly;
  if (shouldMask) {
    allRawProposals = allRawProposals.map(p => maskProposalIdentity(p));
  }

  // Fetch AI analyses for the proposals in this session
  const proposalIds = allRawProposals.map(p => p.id);
  
  if (proposalIds.length > 0) {
    const aiAnalyses = await db
      .select()
      .from(proposalAiAnalyses)
      .where(inArray(proposalAiAnalyses.proposalId, proposalIds));
      
    // Attach aiAnalysis to each proposal
    const aiMap = new Map();
    for (const analysis of aiAnalyses) {
      aiMap.set(analysis.proposalId, analysis);
    }
    
    for (const p of allRawProposals) {
      if (aiMap.has(p.id)) {
        p.aiAnalysis = aiMap.get(p.id);
      }
    }

    // Fetch additional documents
    const addlDocs = await db
      .select()
      .from(fgdAdditionalDocuments)
      .where(inArray(fgdAdditionalDocuments.proposalId, proposalIds));
      
    const docMap = new Map();
    for (const doc of addlDocs) {
      if (!docMap.has(doc.proposalId)) {
        docMap.set(doc.proposalId, []);
      }
      docMap.get(doc.proposalId).push(doc);
    }
    
    for (const p of allRawProposals) {
      if (docMap.has(p.id)) {
        p.additionalDocuments = docMap.get(p.id);
      } else {
        p.additionalDocuments = [];
      }
    }
  }

  // ─── Get votes ────────────────────────────────────────────────────────────
  const votesRaw = await db
    .select({
      id: fgdVotes.id,
      proposalId: fgdVotes.proposalId,
      curatorId: fgdVotes.curatorId,
      vote: fgdVotes.vote,
    })
    .from(fgdVotes)
    .where(eq(fgdVotes.sessionId, sId));

  // ─── Get comments ─────────────────────────────────────────────────────────
  const commentsRaw = await db
    .select({
      id: fgdComments.id,
      proposalId: fgdComments.proposalId,
      curatorId: fgdComments.curatorId,
      content: fgdComments.content,
      createdAt: fgdComments.createdAt,
      curatorName: users.name,
    })
    .from(fgdComments)
    .leftJoin(users, eq(fgdComments.curatorId, users.id))
    .where(eq(fgdComments.sessionId, sId))
    .orderBy(fgdComments.createdAt);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-4">
          <Link 
            href="/coordinator/fgd"
            className="text-gray-500 hover:text-gray-800 text-sm font-medium"
          >
            ← Kembali
          </Link>
          <div className="h-6 w-px bg-gray-300"></div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight flex items-center">
              {fgd.name}
              <span className={`ml-3 px-2.5 py-0.5 rounded text-xs font-bold text-white uppercase tracking-wider ${fgd.fgdType === 'promoter' ? 'bg-amber-500' : 'bg-indigo-600'}`}>
                FGD {fgd.fgdType === 'promoter' ? 'Promotor' : 'Kurator'}
              </span>
            </h1>
            <div className="text-xs text-gray-500 flex items-center space-x-2 mt-1">
              <span className="uppercase font-semibold tracking-wider">{fgd.scope}{fgd.regionCenter ? ` — ${fgd.regionCenter}` : ''}</span>
              <span>•</span>
              <span>Target: {fgd.targetCandidates} Kandidat</span>
              <span>•</span>
              <span>{allRawProposals.length} Proposal di Pool</span>
              <span>•</span>
              <span className={fgd.status === 'locked' ? 'text-green-600 font-bold' : 'text-yellow-600 font-bold'}>
                {fgd.status === 'locked' ? '🔒 SELESAI' : '🟢 AKTIF'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Client Room */}
      <main className="flex-1 flex overflow-hidden relative">
        <FgdRoomClient 
          session={session}
          fgd={fgd as any}
          proposals={allRawProposals as any}
          votes={votesRaw}
          comments={commentsRaw as any}
          readOnly={isViewerOnly}
        />
      </main>
    </div>
  );
}
