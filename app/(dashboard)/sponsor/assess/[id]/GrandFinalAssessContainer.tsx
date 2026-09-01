'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AssessClient from './AssessClient';
import ProposalDetailCollapsible from '@/app/components/ProposalDetailCollapsible';

type GFProposal = {
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
  division: string | null;
  proposerOrg: string | null;
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
  drawOrder: number | null;
};

type Props = {
  competitionId: number;
  initialProposalId: number;
  proposals: GFProposal[];
  initialAssessments: any[];
  judgeName?: string;
};

export default function GrandFinalAssessContainer({
  competitionId,
  initialProposalId,
  proposals,
  initialAssessments,
  judgeName,
}: Props) {
  const [currentProposalId, setCurrentProposalId] = useState(initialProposalId);

  // Map of assessments by proposalId for instant access without re-fetching
  const [assessmentsMap, setAssessmentsMap] = useState<Record<number, any>>(() => {
    const map: Record<number, any> = {};
    for (const a of initialAssessments) {
      map[a.proposalId] = a;
    }
    return map;
  });

  // Handle popstate for browser Back/Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const parts = window.location.pathname.split('/');
      const id = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(id) && proposals.some((p) => p.id === id)) {
        setCurrentProposalId(id);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [proposals]);

  const currentIndex = proposals.findIndex((p) => p.id === currentProposalId);
  const currentProposal = proposals[currentIndex] || proposals[0];
  const prevProposal = currentIndex > 0 ? proposals[currentIndex - 1] : null;
  const nextProposal = currentIndex < proposals.length - 1 ? proposals[currentIndex + 1] : null;

  // Instant navigation between proposals without full page reload
  const handleNavigate = useCallback((targetId: number) => {
    setCurrentProposalId(targetId);
    window.history.pushState(null, '', `/sponsor/assess/${targetId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleAssessmentSaved = useCallback((proposalId: number, assessmentData: any) => {
    setAssessmentsMap((prev) => ({
      ...prev,
      [proposalId]: assessmentData,
    }));
  }, []);

  const existingAssessment = assessmentsMap[currentProposal.id];
  const proposalRowNumber = currentProposal.drawOrder ?? currentIndex + 1;

  const proposalOptions = proposals.map((p, idx) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    drawOrder: p.drawOrder,
    orderNumber: p.drawOrder ?? idx + 1,
    isAssessed: !!assessmentsMap[p.id],
  }));

  return (
    <div className="px-3 sm:px-5 md:px-6 py-4 md:py-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      {/* Header Link Kembali */}
      <div className="flex items-center justify-between">
        <Link
          href="/sponsor"
          prefetch={true}
          className="inline-flex items-center text-xs sm:text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors py-1 px-2 -ml-2 rounded-md hover:bg-indigo-50/50"
        >
          <svg className="w-4 h-4 mr-1.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Kembali ke Papan Penilaian
        </Link>
      </div>

      {/* Kartu Info Proposal */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 sm:p-5 md:p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[11px] sm:text-xs font-bold rounded-full">
                {currentProposal.category === 'BC'
                  ? 'Business Case'
                  : currentProposal.category === 'BI'
                  ? 'Breakthrough Innovation'
                  : currentProposal.category}
              </span>
              {existingAssessment && (
                <span className="px-2.5 py-0.5 bg-green-100 text-green-800 text-[11px] sm:text-xs font-bold rounded-full flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  Sudah Dinilai
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight">
              {currentProposal.title}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 font-medium">
              Inovator: <span className="text-gray-900 font-semibold">{currentProposal.proposerName}</span>{' '}
              <span className="text-gray-400">
                ({currentProposal.proposerUnitKerja ||
                  currentProposal.regionCenter ||
                  currentProposal.division ||
                  currentProposal.proposerOrg ||
                  '-'})
              </span>
            </p>

            {/* Nama Juri di bawah nama inovator sebelah kiri */}
            {judgeName && (
              <div className="flex justify-start items-center pt-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm sm:text-[15px] font-semibold bg-gray-50 border border-gray-200 text-gray-700">
                  <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-gray-500 font-medium">Juri:</span>
                  <span className="font-bold text-gray-900">{judgeName}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Proposal Collapsible */}
      <ProposalDetailCollapsible
        key={`detail-${currentProposal.id}`}
        proposal={currentProposal as any}
        proposalRowNumber={proposalRowNumber}
      />

      {/* Form Penilaian Sponsor */}
      <AssessClient
        key={`assess-${currentProposal.id}`}
        competitionId={competitionId}
        proposalId={currentProposal.id}
        category={currentProposal.category as 'BC' | 'BI'}
        existingAssessment={existingAssessment || null}
        prevId={prevProposal ? prevProposal.id : null}
        nextId={nextProposal ? nextProposal.id : null}
        currentIndex={currentIndex + 1}
        totalProposals={proposals.length}
        onNavigate={handleNavigate}
        onAssessmentSaved={handleAssessmentSaved}
        proposalOptions={proposalOptions}
      />
    </div>
  );
}
