import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { proposals, curatorAssignments, screeningResults, users } from '@/lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import AutoStartScreening from './AutoStartScreening';
import ScreeningForm from './ScreeningForm';
import { checkHardLock } from '@/app/actions/screening';
import FormattedTextDisplay from '@/app/components/FormattedTextDisplay';
import ProposalDocumentButtons from '@/app/components/ProposalDocumentButtons';
import ResubmitDocumentSection from '@/app/components/ResubmitDocumentSection';

import { maskProposalIdentity } from '@/lib/utils/blindReview';
import CompareProposalsPanel from './CompareProposalsPanel';
import DuplicateWarningBanner from './DuplicateWarningBanner';
import { getProposalDuplicateWarnings } from '@/app/actions/duplicates';

function cleanMetadataHeaders(text: string | null | undefined): string {
  if (!text) return '';
  let cleaned = text;

  cleaned = cleaned
    .replace(/#*\s*Proposal Resubmission\s*-\s*PIA Season \d+/gi, '')
    .replace(/#*\s*Kategori (Business Case|Breakthrough Innovation)/gi, '')
    .replace(/#*\s*Nama Inovator\s*:?\s*[^:\n#]+?\s*(?=\s*(#*\s*Departemen|#*\s*Kantor|#*\s*Anggota|#*\s*Nama Inovasi|#*\s*Sasaran))/gi, '')
    .replace(/#*\s*Departemen\s*\/\s*Divisi\s*:?\s*[^:\n#]+?\s*(?=\s*(#*\s*Kantor|#*\s*Anggota|#*\s*Nama Inovasi|#*\s*Sasaran))/gi, '')
    .replace(/#*\s*Kantor Wilayah\s*:?\s*[^:\n#]+?\s*(?=\s*(#*\s*Anggota|#*\s*Nama Inovasi|#*\s*Sasaran))/gi, '')
    .replace(/#*\s*Anggota Tim Inovasi Anda[^\n:#]*:?\s*[^:\n#]+?(?=\s*(#*\s*Nama Inovasi|#*\s*Sasaran))/gi, '');

  return cleaned.trim();
}

export default async function ProposalDetailPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string }>;
}) {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }

  const isCurator = session.roles.includes('curator');
  const isCoordinator = session.roles.includes('coordinator');
  const isViewer = session.roles.includes('viewer');
  
  if (!isCurator && !isCoordinator && !isViewer) {
    redirect('/login');
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const isCoordinatorContext = (session.roles.includes('coordinator') || session.roles.includes('viewer')) && resolvedSearchParams.from === 'coordinator';
  const shouldMask = (session.roles.includes('curator') || session.roles.includes('promoter')) && !isCoordinatorContext && !session.roles.includes('admin') && !session.roles.includes('viewer');

  const { id } = await params;
  const proposalId = parseInt(id, 10);
  if (isNaN(proposalId)) notFound();

  let [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal) notFound();

  if (shouldMask) {
    proposal = maskProposalIdentity(proposal);
  }

  const rnResult = await db.execute(sql`
    SELECT rn FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY category, region_center ORDER BY id ASC) as rn 
      FROM proposals 
      WHERE competition_id = ${proposal.competitionId}
    ) sub WHERE sub.id = ${proposalId}
  `);
  
  const proposalRowNumber = rnResult.length > 0 ? Number(rnResult[0].rn) : 0;

  // Get user's assignment
  const [assignment] = await db.select().from(curatorAssignments).where(
    and(
      eq(curatorAssignments.curatorId, session.userId),
      eq(curatorAssignments.proposalId, proposalId)
    )
  ).limit(1);

  const warnings = isViewer ? [] : await getProposalDuplicateWarnings(proposalId);
    
  let isLinkedToDuplicate = false;
  if (!assignment && !isCoordinator && !isViewer && warnings.length > 0) {
    const otherIds = warnings.map(w => w.otherProposalId);
    const linkedAssignments = await db.select().from(curatorAssignments).where(
      and(
        eq(curatorAssignments.curatorId, session.userId),
        inArray(curatorAssignments.proposalId, otherIds)
      )
    );
    isLinkedToDuplicate = linkedAssignments.length > 0;
  }

  if (!assignment && !isCoordinator && !isViewer && !isLinkedToDuplicate) {
    return (
      <div className="p-8 text-center text-red-600">
        <h2 className="text-xl font-bold mb-2">Akses Ditolak</h2>
        <p>Proposal ini bukan merupakan jatah assignment Anda.</p>
        <Link href="/curator" className="mt-4 inline-block text-indigo-600 hover:underline">Kembali ke Daftar Proposal</Link>
      </div>
    );
  }

  let hardLock = { locked: false, reason: '' };
  let existingResult = undefined;

  if (assignment) {
    const lockCheck = await checkHardLock(proposalId, proposal.competitionId);
    hardLock = { locked: lockCheck.locked, reason: lockCheck.reason || '' };

    if (assignment.status === 'completed') {
      const [res] = await db.select().from(screeningResults).where(eq(screeningResults.assignmentId, assignment.id)).limit(1);
      if (res) {
        existingResult = { verdict: res.verdict, notes: res.notes || '' };
      }
    }
  }

  // Fetch curator notes for coordinator/admin read-only view
  let curatorNotesData: { notes: string | null; recommendation: string | null; curatorName: string | null } | null = null;
  if ((isCoordinator || isViewer || session.roles.includes('admin')) && !shouldMask) {
    const [srRow] = await db
      .select({
        notes: screeningResults.notes,
        recommendation: screeningResults.recommendation,
        curatorName: users.name,
      })
      .from(screeningResults)
      .innerJoin(curatorAssignments, eq(screeningResults.assignmentId, curatorAssignments.id))
      .innerJoin(users, eq(curatorAssignments.curatorId, users.id))
      .where(eq(screeningResults.proposalId, proposalId))
      .limit(1);
    curatorNotesData = srRow ?? null;
  }

  // Fetch assigned curator name (even if not yet screened) for Coordinator/Admin
  let assignedCuratorName: string | null = null;
  if ((isCoordinator || session.roles.includes('admin')) && !shouldMask) {
    // Use curatorNotesData name if already fetched, else query from assignments
    if (curatorNotesData?.curatorName) {
      assignedCuratorName = curatorNotesData.curatorName;
    } else {
      const [caRow] = await db
        .select({ curatorName: users.name })
        .from(curatorAssignments)
        .innerJoin(users, eq(curatorAssignments.curatorId, users.id))
        .where(eq(curatorAssignments.proposalId, proposalId))
        .limit(1);
      assignedCuratorName = caRow?.curatorName ?? null;
    }
  }

  const renderAiScore = (label: string, score: number | null) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{score ? score.toFixed(1) : '-'}</span>
    </div>
  );

  let prevId: number | null = null;
  let nextId: number | null = null;

  if (isCurator) {
    const allAssignments = await db
      .select({ proposalId: curatorAssignments.proposalId, category: proposals.category, regionCenter: proposals.regionCenter, nomorUrut: proposals.nomorUrut })
      .from(curatorAssignments)
      .innerJoin(proposals, eq(curatorAssignments.proposalId, proposals.id))
      .where(and(eq(curatorAssignments.curatorId, session.userId), eq(proposals.competitionId, proposal.competitionId)));

    allAssignments.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.regionCenter && b.regionCenter && a.regionCenter !== b.regionCenter) return a.regionCenter.localeCompare(b.regionCenter);
      return (a.nomorUrut || 0) - (b.nomorUrut || 0);
    });

    const currentIndex = allAssignments.findIndex(a => a.proposalId === proposalId);
    if (currentIndex > 0) prevId = allAssignments[currentIndex - 1].proposalId;
    if (currentIndex < allAssignments.length - 1) nextId = allAssignments[currentIndex + 1].proposalId;
  } else if (isCoordinator || isViewer) {
    const allProps = await db
      .select({ id: proposals.id, category: proposals.category, regionCenter: proposals.regionCenter, nomorUrut: proposals.nomorUrut })
      .from(proposals)
      .where(eq(proposals.competitionId, proposal.competitionId));
      
    allProps.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.regionCenter && b.regionCenter && a.regionCenter !== b.regionCenter) return a.regionCenter.localeCompare(b.regionCenter);
      return (a.nomorUrut || 0) - (b.nomorUrut || 0);
    });

    const currentIndex = allProps.findIndex(p => p.id === proposalId);
    if (currentIndex > 0) prevId = allProps[currentIndex - 1].id;
    if (currentIndex < allProps.length - 1) nextId = allProps[currentIndex + 1].id;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {assignment && assignment.status === 'assigned' && (
        <AutoStartScreening assignmentId={assignment.id} />
      )}

      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={isCurator ? "/curator" : "/coordinator/proposals"} className="text-sm text-[#0A4736] font-semibold hover:underline bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
          ← Kembali ke {isCurator ? "Daftar Proposal" : "Semua Proposal"}
        </Link>
        
        <div className="flex items-center space-x-2">
          {prevId ? (
            <Link href={`/curator/proposals/${prevId}`} className="text-sm text-gray-700 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition font-medium">
              ← Sebelumnya
            </Link>
          ) : (
            <span className="text-sm text-gray-400 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 shadow-sm cursor-not-allowed font-medium">
              ← Sebelumnya
            </span>
          )}
          
          {nextId ? (
            <Link href={`/curator/proposals/${nextId}`} className="text-sm text-gray-700 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition font-medium">
              Selanjutnya →
            </Link>
          ) : (
            <span className="text-sm text-gray-400 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 shadow-sm cursor-not-allowed font-medium">
              Selanjutnya →
            </span>
          )}
        </div>
      </div>

      <DuplicateWarningBanner warnings={warnings} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <span className="w-8 h-8 flex items-center justify-center bg-gray-900 text-white text-xs font-bold rounded-md shadow-sm">
                #{proposalRowNumber}
              </span>
              <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded border border-gray-200">
                {proposal.category} {proposal.regionCenter ? `· ${proposal.regionCenter}` : '· Pusat'}
              </span>
              <span className="text-sm text-gray-500 font-mono ml-auto">ID: {proposal.externalSubId || proposal.externalId}</span>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">
              {proposal.title}
            </h1>

            {assignedCuratorName && (
              <div className="mb-5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Dikurasi oleh: {assignedCuratorName}
                </span>
              </div>
            )}

            {/* Ringkasan Submission Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-gray-200 pb-2">
              <h3 className="font-bold text-gray-900 uppercase tracking-wide text-sm">Ringkasan Submission</h3>
              <div className="flex flex-col items-end gap-2 mt-2 sm:mt-0">
                {proposal.linkProposal && (
                  <a 
                    href={proposal.linkProposal} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs font-semibold text-[#0A4736] hover:underline bg-green-50 px-2 py-1 rounded"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    Buka Dokumen Proposal Fase 1
                  </a>
                )}
              </div>
            </div>

            {/* Detail Dokumen Resubmission */}
            <ResubmitDocumentSection proposal={proposal} />

            <div className="space-y-4 mb-8">
              {/* Row 1: Innovator */}
              <div>
                <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Innovator</div>
                <div className="text-sm text-gray-900">
                  <span className="font-medium">{proposal.proposerName || '-'}</span> 
                  {proposal.proposerEmail && <span className="text-gray-500"> &middot; {proposal.proposerEmail}</span>}
                </div>
              </div>

              {/* Row 2: Tim & Tanggal */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Anggota Tim</div>
                  <div className="text-sm text-gray-900">
                    {Array.isArray(proposal.teamMembers) && proposal.teamMembers.length > 0 
                      ? (proposal.teamMembers as string[]).join(', ') 
                      : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Tanggal Submit</div>
                  <div className="text-sm text-gray-900">
                    {proposal.submissionDate ? new Date(proposal.submissionDate).toLocaleString('id-ID') : '-'}
                  </div>
                </div>
              </div>

              {/* Row 3: Group, Sub-Tema, & Unit Kerja */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Group</div>
                  <div className="text-sm text-gray-900">{proposal.groupName || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Sub-Tema</div>
                  <div className="text-sm text-gray-900">{proposal.theme || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Nama Unit Kerja</div>
                  <div className="text-sm text-gray-900">{proposal.proposerUnitKerja || '-'}</div>
                </div>
              </div>

              {/* Row 4: Kantor Wilayah (Conditional) */}
              {proposal.category === 'WILAYAH' && (
                <div>
                  <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Kantor Wilayah</div>
                  <div className="text-sm text-gray-900">{proposal.regionCenter || '-'}</div>
                </div>
              )}
            </div>

            {/* Detail Content (BI or BC/Wilayah/Pusat) */}
            {proposal.category === 'BI' && (
              <div className="space-y-6 mb-8">
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 text-lg">Detail Breakthrough Innovation (BI)</h3>
                
                {proposal.biMasalahDiselesaikan ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Masalah yang Diselesaikan</div>
                    <FormattedTextDisplay 
                      proposalId={proposal.id}
                      fieldName="biMasalahDiselesaikan"
                      originalText={proposal.biMasalahDiselesaikan}
                      formattedText={(proposal.formattedTexts as any)?.biMasalahDiselesaikan}
                      canFormat={isCoordinator || isCurator || session.roles.includes('promoter') || isViewer}
                    />
                  </div>
                ) : null}

                {proposal.biInovasiDiusulkan ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Inovasi yang Diusulkan</div>
                    <FormattedTextDisplay 
                      proposalId={proposal.id}
                      fieldName="biInovasiDiusulkan"
                      originalText={proposal.biInovasiDiusulkan}
                      formattedText={(proposal.formattedTexts as any)?.biInovasiDiusulkan}
                      canFormat={isCoordinator || isCurator || session.roles.includes('promoter') || isViewer}
                    />
                  </div>
                ) : null}

                {!proposal.biMasalahDiselesaikan && !proposal.biInovasiDiusulkan && proposal.summary ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Ringkasan Inovasi</div>
                    <FormattedTextDisplay 
                      proposalId={proposal.id}
                      fieldName="summary"
                      originalText={proposal.summary}
                      formattedText={(proposal.formattedTexts as any)?.summary}
                      canFormat={isCoordinator || isCurator || session.roles.includes('promoter') || isViewer}
                    />
                  </div>
                ) : null}
              </div>
            )}

            {proposal.category !== 'BI' && (
              <div className="space-y-6 mb-8">
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 text-lg">Detail Business Case (BC/Pusat/Wilayah)</h3>
                
                {proposal.bcKelompokDibantu && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Kelompok yang Dibantu</div>
                    <FormattedTextDisplay 
                      proposalId={proposal.id}
                      fieldName="bcKelompokDibantu"
                      originalText={proposal.bcKelompokDibantu}
                      formattedText={(proposal.formattedTexts as any)?.bcKelompokDibantu}
                      canFormat={isCoordinator || isCurator || session.roles.includes('promoter') || isViewer}
                      hideFormatButton={true}
                    />
                  </div>
                )}

                {proposal.bcAlasanMemilihMereka && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Alasan Memilih Mereka</div>
                    <FormattedTextDisplay 
                      proposalId={proposal.id}
                      fieldName="bcAlasanMemilihMereka"
                      originalText={proposal.bcAlasanMemilihMereka}
                      formattedText={(proposal.formattedTexts as any)?.bcAlasanMemilihMereka}
                      canFormat={isCoordinator || isCurator || session.roles.includes('promoter') || isViewer}
                      hideFormatButton={true}
                    />
                  </div>
                )}

                {proposal.summary && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Ringkasan Proposal</div>
                    <FormattedTextDisplay 
                      proposalId={proposal.id}
                      fieldName="summary"
                      originalText={proposal.summary}
                      formattedText={(proposal.formattedTexts as any)?.summary}
                      canFormat={isCoordinator || isCurator || session.roles.includes('promoter') || isViewer}
                    />
                  </div>
                )}
              </div>
            )}


            {/* Bandingkan dengan Proposal Lain (Admin, Coordinator, Curator only) */}
            {!isViewer && (isCurator || isCoordinator) && (
              <CompareProposalsPanel
                proposalId={proposal.id}
                proposalTitle={proposal.title}
                category={proposal.category}
                competitionId={proposal.competitionId}
                isReadOnly={!assignment && !isCoordinator && isLinkedToDuplicate}
              />
            )}

          </div>
        </div>

        {/* Right Column: Actions & AI Score */}
        <div className="flex flex-col gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Skor AI CIDA</h3>
            <div className="mb-4">
              <div className="text-4xl font-bold text-[#0A4736]">
                {proposal.aiCidaTotal ? proposal.aiCidaTotal.toFixed(1) : '-'}
              </div>
              <div className="text-xs text-gray-500 font-semibold mt-1">TOTAL SKOR AI</div>
            </div>
            
            <div className="space-y-1 mt-6">
              {renderAiScore('Solvability', proposal.aiCidaSolvability)}
              {renderAiScore('Desirability', proposal.aiCidaDesirability)}
              {renderAiScore('Viability', proposal.aiCidaViability)}
              {renderAiScore('Feasibility', proposal.aiCidaFeasibility)}
              {renderAiScore('Problem Urgency', proposal.aiCidaProblemUrgency)}
              {renderAiScore('Uniqueness', proposal.aiCidaUniqueness)}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100">
              {renderAiScore('Average (Bobot)', proposal.aiCidaAverage)}
              {renderAiScore('Average Skor (Skala 100)', proposal.aiCidaAverageSkor)}
            </div>

            <div className="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded">
              Skor AI CIDA ditampilkan sebagai referensi awal, bukan penentu mutlak lolos/tidaknya proposal.
            </div>
          </div>

          {/* Catatan Kurator — read-only for Coordinator/Admin */}
          {(isCoordinator || session.roles.includes('admin')) && !shouldMask && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span>📝</span> Catatan Kurator
                {curatorNotesData?.curatorName && (
                  <span className="text-xs font-normal text-gray-500 ml-1">— {curatorNotesData.curatorName}</span>
                )}
              </h3>
              {curatorNotesData?.notes || curatorNotesData?.recommendation ? (
                <div className="space-y-2 text-sm text-gray-800">
                  {curatorNotesData.notes && (
                    <p className="leading-relaxed">{curatorNotesData.notes}</p>
                  )}
                  {curatorNotesData.recommendation && (
                    <p className="text-xs text-indigo-700 font-semibold bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded">
                      Rekomendasi: {curatorNotesData.recommendation}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Tidak ada catatan dari kurator.</p>
              )}
            </div>
          )}

          {assignment && isCurator ? (
            <div className="space-y-6">
              {proposal.linkSuratOrisinalitas && (
                <div className="bg-amber-50 p-5 rounded-xl border border-amber-200 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-amber-600 bg-amber-100 p-2 rounded-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-amber-900 mb-1">Dokumen Kepatuhan</h3>
                      <p className="text-xs text-amber-800 mb-3">Peserta telah melampirkan Surat Pernyataan Orisinalitas pada saat resubmission. Silakan tinjau jika diperlukan.</p>
                      <a href={`/api/proxy-pdf?url=${encodeURIComponent(proposal.linkSuratOrisinalitas)}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center w-full px-3 py-2 text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-md transition-colors">
                        Buka Surat Orisinalitas
                        <svg className="w-3.5 h-3.5 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      </a>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4">Form Screening Kelayakan</h3>
                <ScreeningForm 
                  assignmentId={assignment.id} 
                  isCompleted={assignment.status === 'completed'}
                  hardLock={hardLock}
                  existingResult={existingResult}
                />
              </div>
            </div>
          ) : isLinkedToDuplicate ? (
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm sticky top-6">
              <h2 className="text-lg font-bold text-blue-900 mb-2">Mode Read-Only</h2>
              <p className="text-blue-800 text-sm leading-relaxed">
                Anda melihat proposal ini karena terhubung sebagai potensi duplikat dengan proposal jatah Anda.
                <br /><br />
                Anda <strong className="font-semibold">tidak dapat</strong> melakukan screening (submit/edit/reset) untuk proposal ini. Ini tetap wewenang kurator pemilik aslinya.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-gray-200">
        <Link href={isCurator ? "/curator" : "/coordinator/proposals"} className="text-sm text-[#0A4736] font-semibold hover:underline bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
          ← Kembali ke {isCurator ? "Daftar Proposal" : "Semua Proposal"}
        </Link>
        
        <div className="flex items-center space-x-2">
          {prevId ? (
            <Link href={`/curator/proposals/${prevId}`} className="text-sm text-gray-700 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition font-medium">
              ← Sebelumnya
            </Link>
          ) : (
            <span className="text-sm text-gray-400 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 shadow-sm cursor-not-allowed font-medium">
              ← Sebelumnya
            </span>
          )}
          
          {nextId ? (
            <Link href={`/curator/proposals/${nextId}`} className="text-sm text-gray-700 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition font-medium">
              Selanjutnya →
            </Link>
          ) : (
            <span className="text-sm text-gray-400 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 shadow-sm cursor-not-allowed font-medium">
              Selanjutnya →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
