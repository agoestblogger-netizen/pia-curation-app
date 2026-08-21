import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { proposals, regionalFinalAssessments, regionalFinalSessions, regionalFinalJudges } from '@/lib/db/schema';
import { eq, and, ne, isNotNull, desc, sql } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import RegionalAssessClient from './RegionalAssessClient';
import FormattedTextDisplay from '@/app/components/FormattedTextDisplay';
import { getRegionalFinalProposals } from '@/app/actions/regional-final-judging';
import ProposalDetailCollapsible from '@/app/components/ProposalDetailCollapsible';

export default async function AssessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ proposalId?: string }>;
}) {
  const session = await requireRole('regional');
  const resolvedParams = await params;
  const sessionId = parseInt(resolvedParams.id, 10);
  if (isNaN(sessionId)) return notFound();
  
  const [targetSession] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, sessionId));
  if (!targetSession) return notFound();
  
  const regionalProposals = await getRegionalFinalProposals(sessionId);
  if (regionalProposals.length === 0) return <div className="p-8">Tidak ada proposal dalam grup ini.</div>;
  
  const resolvedSearchParams = await searchParams;
  let proposalId = parseInt(resolvedSearchParams.proposalId || '', 10);
  if (isNaN(proposalId)) {
    // Render List of Nominations
    const myAssessments = await db.select({ proposalId: regionalFinalAssessments.proposalId })
      .from(regionalFinalAssessments)
      .where(and(
        eq(regionalFinalAssessments.sessionId, sessionId),
        eq(regionalFinalAssessments.judgeUserId, session.userId)
      ));
    const assessedIds = new Set(myAssessments.map(a => a.proposalId));

    return (
      <div className="p-8">
        <div className="mb-6">
          <Link href="/regional-judge" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Kembali ke Pilih Grup
          </Link>
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Penilaian Final Regional</h1>
        <p className="text-gray-600 mb-8">
          Silakan berikan penilaian untuk nominasi proposal berikut pada grup ini.
        </p>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Judul Proposal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Kerja / Kota</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Done</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {regionalProposals.map((p, index) => (
                <tr key={p.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">{index + 1}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {p.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {p.proposerOrg || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/regional-judge/assess/${sessionId}?proposalId=${p.id}`} className="text-indigo-600 hover:text-indigo-900 transition-colors">
                      Beri Nilai &rarr;
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    {assessedIds.has(p.id) ? (
                      <span 
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 shadow-sm cursor-help" 
                        title="Sudah Dinilai"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  const partialProposal = regionalProposals.find(p => p.id === proposalId);
  if (!partialProposal) return notFound();

  let [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal) return notFound();

  const rnResult = await db.execute(sql`
    SELECT rn FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY category, region_center ORDER BY id ASC) as rn 
      FROM proposals 
      WHERE competition_id = ${proposal.competitionId}
    ) sub WHERE sub.id = ${proposalId}
  `);
  
  const proposalRowNumber = rnResult.length > 0 ? Number(rnResult[0].rn) : 0;

  // Get existing assessment in current session
  let [existing] = await db.select().from(regionalFinalAssessments)
    .where(and(
      eq(regionalFinalAssessments.sessionId, sessionId),
      eq(regionalFinalAssessments.proposalId, proposalId),
      eq(regionalFinalAssessments.judgeUserId, session.userId)
    ));

  // If current assessment has no notes, check for previous notes by same judge for same proposal in other sessions
  if (!existing || !existing.notes || existing.notes.trim() === '') {
    const [prevWithNote] = await db.select({ notes: regionalFinalAssessments.notes })
      .from(regionalFinalAssessments)
      .where(and(
        eq(regionalFinalAssessments.proposalId, proposalId),
        eq(regionalFinalAssessments.judgeUserId, session.userId),
        ne(regionalFinalAssessments.sessionId, sessionId),
        isNotNull(regionalFinalAssessments.notes),
        ne(regionalFinalAssessments.notes, '')
      ))
      .orderBy(desc(regionalFinalAssessments.submittedAt))
      .limit(1);

    if (prevWithNote?.notes) {
      if (!existing) {
        existing = {
          id: 0,
          sessionId,
          proposalId,
          judgeUserId: session.userId,
          paramProblemFit: 0,
          paramDampak: 0,
          paramKelayakan: 0,
          paramProfessional: 0,
          notes: prevWithNote.notes,
          submittedAt: new Date()
        } as any;
      } else {
        existing.notes = prevWithNote.notes;
      }
    }
  }

  const [judgeAssignment] = await db.select({ isFinalized: regionalFinalJudges.isFinalized })
    .from(regionalFinalJudges)
    .where(and(
      eq(regionalFinalJudges.sessionId, sessionId),
      eq(regionalFinalJudges.userId, session.userId)
    ))
    .limit(1);
    
  const isFinalized = judgeAssignment?.isFinalized || false;

  const currentIndex = regionalProposals.findIndex(p => p.id === proposalId);
  const prevId = currentIndex > 0 ? regionalProposals[currentIndex - 1].id : null;
  const nextId = currentIndex < regionalProposals.length - 1 ? regionalProposals[currentIndex + 1].id : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href={`/regional-judge/assess/${sessionId}`} className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Kembali ke Daftar Nominasi
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-full">
                {proposal.category}
              </span>
              {existing && (
                <span className="px-2.5 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  Sudah Dinilai
                </span>
              )}
              {isFinalized && (
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Terkunci (Final)
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{proposal.title}</h1>
            <p className="text-gray-600 mt-1 font-medium">Inovator: {proposal.proposerName} <span className="text-gray-400">({proposal.proposerOrg || '-'})</span></p>
          </div>
        </div>
      </div>

      <ProposalDetailCollapsible 
        proposal={proposal as any} 
        proposalRowNumber={proposalRowNumber} 
      />

      <RegionalAssessClient 
        key={proposalId}
        sessionId={sessionId}
        proposalId={proposalId}
        existingAssessment={existing || null}
        prevId={prevId}
        nextId={nextId}
        currentIndex={currentIndex + 1}
        totalProposals={regionalProposals.length}
        isFinalized={isFinalized}
      />
    </div>
  );
}
