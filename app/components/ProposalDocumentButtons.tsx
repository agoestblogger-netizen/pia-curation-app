'use client';

export interface ProposalDocumentButtonsProps {
  linkProposal?: string | null;
  linkResubmitProposal?: string | null;
  linkSuratOrisinalitas?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

export default function ProposalDocumentButtons({
  linkProposal,
  linkResubmitProposal,
  linkSuratOrisinalitas,
  size = 'sm',
  className = '',
}: ProposalDocumentButtonsProps) {
  const hasAnyLink = Boolean(linkProposal || linkResubmitProposal || linkSuratOrisinalitas);

  if (!hasAnyLink) return null;

  const pyClass = size === 'md' ? 'py-2 px-3.5' : 'py-1 px-2.5';
  const textClass = size === 'md' ? 'text-xs' : 'text-xs';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* 1. Dokumen Proposal Utama / Fase 1 */}
      {linkProposal && (
        <a
          href={linkProposal}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors ${pyClass} ${textClass}`}
        >
          <span>Dokumen Proposal (Fase 1)</span>
          <svg className="w-3.5 h-3.5 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}

      {/* 2. Proposal Resubmission */}
      {linkResubmitProposal && (
        <a
          href={`/api/proxy-pdf?url=${encodeURIComponent(linkResubmitProposal)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center font-bold text-blue-800 bg-blue-100 hover:bg-blue-200 rounded border border-blue-300 transition-colors ${pyClass} ${textClass}`}
        >
          <span>Proposal Resubmission</span>
          <svg className="w-3.5 h-3.5 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}

      {/* 3. Surat Orisinalitas */}
      {linkSuratOrisinalitas && (
        <a
          href={`/api/proxy-pdf?url=${encodeURIComponent(linkSuratOrisinalitas)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded border border-amber-300 transition-colors ${pyClass} ${textClass}`}
        >
          <span>Surat Orisinalitas</span>
          <svg className="w-3.5 h-3.5 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}
