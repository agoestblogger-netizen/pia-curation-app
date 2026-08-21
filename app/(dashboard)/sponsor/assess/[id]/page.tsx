import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { proposals, grandFinalAssessments, competitions } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import AssessClient from './AssessClient';
import FormattedTextDisplay from '@/app/components/FormattedTextDisplay';
import CollapsibleReview from './CollapsibleReview';
import ProposalDetailCollapsible from '@/app/components/ProposalDetailCollapsible';

export default async function AssessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole('sponsor');
  const resolvedParams = await params;
  const proposalId = parseInt(resolvedParams.id, 10);
  if (isNaN(proposalId)) return notFound();

  // Get active competition
  const [activeComp] = await db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1);
  if (!activeComp) return <div className="p-8">Tidak ada kompetisi aktif.</div>;

  // Get proposal
  const [proposal] = await db.select().from(proposals)
    .where(and(
      eq(proposals.id, proposalId),
      eq(proposals.competitionId, activeComp.id)
    ));
    
  if (!proposal) return notFound();

  // Get existing assessment
  const [existing] = await db.select().from(grandFinalAssessments)
    .where(and(
      eq(grandFinalAssessments.proposalId, proposalId),
      eq(grandFinalAssessments.sponsorId, session.userId)
    ));

  // Get all GF proposals for navigation
  const gfProposals = await db.select({ id: proposals.id })
    .from(proposals)
    .where(and(
      eq(proposals.competitionId, activeComp.id),
      eq(proposals.status, 'grand_final')
    ))
    .orderBy(proposals.id);

  const currentIndex = gfProposals.findIndex(p => p.id === proposalId);
  const prevId = currentIndex > 0 ? gfProposals[currentIndex - 1].id : null;
  const nextId = currentIndex < gfProposals.length - 1 ? gfProposals[currentIndex + 1].id : null;

  // Get proposal row number (within same category) for display
  const rnResult = await db.execute(sql`
    SELECT rn FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY category ORDER BY id ASC) as rn
      FROM proposals
      WHERE competition_id = ${proposal.competitionId}
    ) sub WHERE sub.id = ${proposalId}
  `);
  const proposalRowNumber = rnResult.length > 0 ? Number(rnResult[0].rn) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/sponsor" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Kembali ke Papan Penilaian
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-full">
                {proposal.category === 'BC' ? 'Business Case' : proposal.category === 'BI' ? 'Breakthrough Innovation' : proposal.category}
              </span>
              {existing && (
                <span className="px-2.5 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  Sudah Dinilai
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{proposal.title}</h1>
            <p className="text-gray-600 mt-1 font-medium">Inovator: {proposal.proposerName} <span className="text-gray-400">({proposal.proposerUnitKerja || proposal.regionCenter || proposal.division || proposal.proposerOrg || '-'})</span></p>
          </div>
        </div>
        
        {proposal.summary && (
          <CollapsibleReview>
            <FormattedTextDisplay 
              proposalId={proposal.id}
              fieldName="summary"
              originalText={proposal.summary}
              formattedText={(proposal.formattedTexts as any)?.summary}
              canFormat={true}
              autoFormatOnLoad={true}
              hideFormatButton={true}
            />
          </CollapsibleReview>
        )}
      </div>

      {/* Detail Proposal Collapsible — default collapsed, di atas form penilaian */}
      <ProposalDetailCollapsible
        proposal={proposal as any}
        proposalRowNumber={proposalRowNumber}
      />

      <AssessClient 
        competitionId={activeComp.id}
        proposalId={proposalId}
        category={proposal.category as 'BC' | 'BI'}
        existingAssessment={existing || null}
        prevId={prevId}
        nextId={nextId}
        currentIndex={currentIndex + 1}
        totalProposals={gfProposals.length}
      />
    </div>
  );
}
