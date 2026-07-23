'use client';

import { useState, useEffect, useRef } from 'react';
import { generateResubmissionAiAnalysis } from '@/app/actions/aiAnalysis';

interface ResubmissionAiBadgeProps {
  proposalId: number;
  hasAnalysis?: boolean;
}

export function ResubmissionAiBadge({ proposalId, hasAnalysis }: ResubmissionAiBadgeProps) {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent(`trigger-resubmission-ai-${proposalId}`));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors px-3 py-1.5 rounded-md shadow-sm border border-indigo-500 cursor-pointer"
    >
      <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
      </svg>
      <span>{hasAnalysis ? 'Lihat Analisis Resubmission (AI)' : 'Analisis Resubmission dengan AI'}</span>
    </button>
  );
}

interface ResubmissionAiPanelProps {
  proposalId: number;
  initialAiAnalysis?: any | null;
}

export default function ResubmissionAiPanel({ proposalId, initialAiAnalysis }: ResubmissionAiPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [analysis, setAnalysis] = useState<any | null>(initialAiAnalysis || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchAi = async () => {
    if (analysis || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateResubmissionAiAnalysis(proposalId);
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setAnalysis(result.data);
      }
    } catch (err: any) {
      setError('Terjadi kesalahan saat mengambil analisis AI.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleTrigger = () => {
      setIsOpen(true);
      if (!analysis && !initialAiAnalysis) {
        fetchAi();
      }
      setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    };

    const eventName = `trigger-resubmission-ai-${proposalId}`;
    window.addEventListener(eventName, handleTrigger);
    return () => {
      window.removeEventListener(eventName, handleTrigger);
    };
  }, [proposalId, analysis, initialAiAnalysis]);

  if (!isOpen) return null;

  return (
    <div ref={panelRef} className="mt-8 mb-8 transition-all duration-300 scroll-mt-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm shadow-sm">
          <div className="flex items-center justify-between font-bold mb-1">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Gagal Memuat Analisis AI
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">Tutup</button>
          </div>
          <p>{error}</p>
        </div>
      )}

      {isLoading && (
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl shadow-sm animate-pulse">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h3 className="font-bold text-blue-900">AI sedang menganalisis dokumen resubmission...</h3>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-blue-200 rounded w-3/4"></div>
            <div className="h-4 bg-blue-200 rounded w-1/2"></div>
            <div className="h-4 bg-blue-200 rounded w-5/6"></div>
          </div>
        </div>
      )}

      {analysis && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-blue-200 pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <h3 className="font-bold text-blue-900 text-lg">Analisis AI: Dokumen Resubmission</h3>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-xs text-gray-500 hover:text-gray-800 bg-white hover:bg-gray-100 px-2.5 py-1 rounded border border-gray-200 transition-colors"
            >
              Sembunyikan
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-blue-800 text-sm mb-1">Rangkuman Utama</h4>
              <p className="text-gray-700 text-sm leading-relaxed">{analysis.summary}</p>
            </div>
            
            {Array.isArray(analysis.keyFindings) && analysis.keyFindings.length > 0 && (
              <div>
                <h4 className="font-semibold text-blue-800 text-sm mb-1">Temuan Penting</h4>
                <ul className="list-disc pl-5 text-gray-700 text-sm space-y-1">
                  {analysis.keyFindings.map((finding: string, idx: number) => (
                    <li key={idx}>{finding}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {analysis.methodology && (
              <div>
                <h4 className="font-semibold text-blue-800 text-sm mb-1">Metodologi</h4>
                <p className="text-gray-700 text-sm leading-relaxed">{analysis.methodology}</p>
              </div>
            )}
            
            {analysis.dataValidity && (
              <div>
                <h4 className="font-semibold text-blue-800 text-sm mb-1">Validitas Data</h4>
                <p className="text-gray-700 text-sm leading-relaxed">{analysis.dataValidity}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
