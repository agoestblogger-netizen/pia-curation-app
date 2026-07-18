import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { proposals, curatorAssignments, screeningResults } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import AutoStartScreening from './AutoStartScreening';
import ScreeningForm from './ScreeningForm';
import { checkHardLock } from '@/app/actions/screening';

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }

  const isCurator = session.roles.includes('curator');
  const isCoordinator = session.roles.includes('coordinator');
  
  if (!isCurator && !isCoordinator) {
    redirect('/login');
  }

  const { id } = await params;
  const proposalId = parseInt(id, 10);
  if (isNaN(proposalId)) notFound();

  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal) notFound();

  const rnResult = await db.execute(sql`
    SELECT rn FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY category, region_center ORDER BY id ASC) as rn 
      FROM proposals 
      WHERE competition_id = ${proposal.competitionId}
    ) sub WHERE sub.id = ${proposalId}
  `);
  
  const proposalRowNumber = rnResult.length > 0 ? Number(rnResult[0].rn) : 0;

  // Get user's assignment
  let assignment = null;
  if (isCurator) {
    const [found] = await db
      .select()
      .from(curatorAssignments)
      .where(and(eq(curatorAssignments.proposalId, proposalId), eq(curatorAssignments.curatorId, session.userId)))
      .limit(1);
    assignment = found || null;
  }
    
  if (!assignment && !isCoordinator) {
    return (
      <div className="p-8 text-center text-red-600">
        <h2 className="text-xl font-bold mb-2">Akses Ditolak</h2>
        <p>Proposal ini bukan merupakan jatah assignment Anda.</p>
        <Link href="/curator" className="mt-4 inline-block text-indigo-600 hover:underline">Kembali ke Papan Lelang</Link>
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

  const renderAiScore = (label: string, score: number | null) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{score ? score.toFixed(1) : '-'}</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {assignment && assignment.status === 'assigned' && (
        <AutoStartScreening assignmentId={assignment.id} />
      )}

      {/* Back button */}
      <div>
        <Link href={isCurator ? "/curator" : "/coordinator/proposals"} className="text-sm text-[#0A4736] font-semibold hover:underline">
          ← Kembali ke {isCurator ? "Papan Lelang" : "Semua Proposal"}
        </Link>
      </div>

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
            
            <h1 className="text-2xl font-bold text-gray-900 mb-6 leading-tight">
              {proposal.title}
            </h1>

            {/* Ringkasan Submission Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-gray-200 pb-2">
              <h3 className="font-bold text-gray-900 uppercase tracking-wide text-sm">Ringkasan Submission</h3>
              {proposal.linkProposal && (
                <a 
                  href={proposal.linkProposal} 
                  target="_blank" 
                  rel="noreferrer"
                  className="mt-2 sm:mt-0 inline-flex items-center text-xs font-semibold text-[#0A4736] hover:underline"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                  Buka Dokumen Sumber
                </a>
              )}
            </div>

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

            {/* Description / Summary */}
            <div className="mb-8">
              <h3 className="font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">Deskripsi / Summary</h3>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {proposal.summary || 'Tidak ada deskripsi singkat.'}
              </div>
            </div>

            {/* Kategori Spesifik */}
            {proposal.category !== 'BI' && (
              <div className="space-y-6">
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2">Detail Business Case (BC/Pusat/Wilayah)</h3>
                
                {proposal.bcKelompokDibantu && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-1">Kelompok yang Dibantu</div>
                    <div className="text-sm text-gray-800">{proposal.bcKelompokDibantu}</div>
                  </div>
                )}
                {proposal.bcAlasanMemilihMereka && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-1">Alasan Memilih Mereka</div>
                    <div className="text-sm text-gray-800">{proposal.bcAlasanMemilihMereka}</div>
                  </div>
                )}
                {/* Additional BC fields can be added here as needed */}
              </div>
            )}

            {proposal.category === 'BI' && (
              <div className="space-y-6">
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2">Detail Breakthrough Innovation (BI)</h3>
                
                <div className="text-sm text-gray-500 italic">Data spesifik BI ditampilkan di dokumen sumber.</div>
              </div>
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

          {assignment && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Form Screening Kelayakan</h3>
              <ScreeningForm 
                assignmentId={assignment.id} 
                isCompleted={assignment.status === 'completed'}
                hardLock={hardLock}
                existingResult={existingResult}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
