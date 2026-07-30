'use client';

import { useState } from 'react';
import FormattedTextDisplay from '@/app/components/FormattedTextDisplay';
import ResubmitDocumentSection from '@/app/components/ResubmitDocumentSection';

type Props = {
  proposal: {
    id: number;
    externalId: string | null;
    externalSubId: number | null;
    title: string;
    category: string;
    proposerName: string | null;
    proposerEmail: string | null;
    teamMembers: any;
    submissionDate: string | null;
    groupName: string | null;
    theme: string | null;
    proposerUnitKerja: string | null;
    regionCenter: string | null;
    linkProposal: string | null;
    linkResubmitProposal: string | null;
    linkSuratOrisinalitas: string | null;
    resubmitDocumentText: string | null;
    bcKelompokDibantu: string | null;
    bcAlasanMemilihMereka: string | null;
    biMasalahDiselesaikan: string | null;
    biInovasiDiusulkan: string | null;
    summary: string | null;
    formattedTexts: any;
  };
  proposalRowNumber: number;
};

export default function ProposalDetailCollapsible({ proposal, proposalRowNumber }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Clickable Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100/80 transition-colors text-left border-b border-gray-200"
      >
        <div className="flex items-center space-x-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
            i
          </span>
          <span className="font-semibold text-gray-900">
            {isOpen ? 'Sembunyikan Detail Proposal' : 'Tampilkan Detail Proposal'}
          </span>
          <span className="text-xs text-gray-500 font-mono">({proposal.category} ID: {proposal.externalSubId || proposal.id})</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-6 space-y-8 border-t border-gray-100 bg-white">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <span className="w-8 h-8 flex items-center justify-center bg-gray-900 text-white text-xs font-bold rounded-md shadow-sm">
                #{proposalRowNumber}
              </span>
              <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded border border-gray-200">
                {proposal.category} {proposal.regionCenter ? `· ${proposal.regionCenter}` : '· Pusat'}
              </span>
              <span className="text-sm text-gray-500 font-mono ml-auto">ID: {proposal.externalSubId || proposal.externalId}</span>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-3 leading-tight">
              {proposal.title}
            </h2>

            {/* Ringkasan Submission Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-gray-200 pb-2">
              <h3 className="font-bold text-gray-900 uppercase tracking-wide text-xs">Ringkasan Submission</h3>
              {proposal.linkProposal && (
                <a
                  href={proposal.linkProposal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs font-semibold text-[#0A4736] hover:underline bg-green-50 px-2 py-1 rounded mt-2 sm:mt-0"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Buka Dokumen Proposal Fase 1
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

            {/* Detail Content (BI or BC/Wilayah/Pusat) */}
            {proposal.category === 'BI' && (
              <div className="space-y-6 mb-8">
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 text-md">Detail Breakthrough Innovation (BI)</h3>

                {proposal.biMasalahDiselesaikan && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Masalah yang Diselesaikan</div>
                    <FormattedTextDisplay
                      proposalId={proposal.id}
                      fieldName="biMasalahDiselesaikan"
                      originalText={proposal.biMasalahDiselesaikan}
                      formattedText={(proposal.formattedTexts as any)?.biMasalahDiselesaikan}
                      canFormat={false}
                      hideFormatButton={true}
                    />
                  </div>
                )}

                {proposal.biInovasiDiusulkan && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Inovasi yang Diusulkan</div>
                    <FormattedTextDisplay
                      proposalId={proposal.id}
                      fieldName="biInovasiDiusulkan"
                      originalText={proposal.biInovasiDiusulkan}
                      formattedText={(proposal.formattedTexts as any)?.biInovasiDiusulkan}
                      canFormat={false}
                      hideFormatButton={true}
                    />
                  </div>
                )}

                {!proposal.biMasalahDiselesaikan && !proposal.biInovasiDiusulkan && proposal.summary && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Ringkasan Inovasi</div>
                    <FormattedTextDisplay
                      proposalId={proposal.id}
                      fieldName="summary"
                      originalText={proposal.summary}
                      formattedText={(proposal.formattedTexts as any)?.summary}
                      canFormat={false}
                      hideFormatButton={true}
                    />
                  </div>
                )}
              </div>
            )}

            {proposal.category !== 'BI' && (
              <div className="space-y-6 mb-8">
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 text-md">Detail Business Case (BC/Pusat/Wilayah)</h3>

                {proposal.bcKelompokDibantu && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Kelompok yang Dibantu</div>
                    <FormattedTextDisplay
                      proposalId={proposal.id}
                      fieldName="bcKelompokDibantu"
                      originalText={proposal.bcKelompokDibantu}
                      formattedText={(proposal.formattedTexts as any)?.bcKelompokDibantu}
                      canFormat={false}
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
                      canFormat={false}
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
                      canFormat={false}
                      hideFormatButton={true}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Detail Dokumen Resubmission */}
            <ResubmitDocumentSection
              proposal={proposal}
              showSplitScreenButton={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
