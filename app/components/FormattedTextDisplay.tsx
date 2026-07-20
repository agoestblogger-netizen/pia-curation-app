'use client';

import { useState, useTransition } from 'react';
import { formatProposalFieldAction } from '@/app/actions/formatText';

type Props = {
  proposalId: number;
  fieldName: string;
  originalText: string | null;
  formattedText?: string | null;
  canFormat?: boolean; // HANYA true untuk coordinator, curator, promoter
};

// Simple Markdown parser to avoid external dependencies
function renderMarkdown(text: string) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*$)/gim, '<h4 class="text-md font-bold text-indigo-900 mt-4 mb-2">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 class="text-lg font-bold text-indigo-900 mt-5 mb-2">$1</h3>')
    .replace(/^# (.*$)/gim, '<h2 class="text-xl font-bold text-indigo-900 mt-6 mb-3">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\s*[-*+]\s+(.*)$/gim, '<li class="ml-4 list-disc">$1</li>')
    .replace(/(<li.*?>.*?<\/li>\n?)+/g, '<ul class="mb-3">$&</ul>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/<\/ul>\s*<br\/>/g, '</ul>'); // cleanup trailing BR after list
    
  return { __html: html };
}

export default function FormattedTextDisplay({ 
  proposalId, 
  fieldName, 
  originalText, 
  formattedText,
  canFormat = false
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [showOriginal, setShowOriginal] = useState(!formattedText);
  const [error, setError] = useState<string | null>(null);

  if (!originalText) {
    return <span className="text-gray-400 italic">Kosong</span>;
  }

  const handleFormat = () => {
    setError(null);
    startTransition(async () => {
      const res = await formatProposalFieldAction(proposalId, fieldName, originalText);
      if (res.error) {
        setError(res.error);
      } else {
        setShowOriginal(false);
      }
    });
  };

  return (
    <div className="relative group">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-end gap-3 mb-2">
        {formattedText && (
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors bg-gray-100 hover:bg-indigo-50 px-2.5 py-1 rounded-md"
            title={showOriginal ? 'Lihat Versi Rapi (AI)' : 'Lihat Teks Asli'}
          >
            {showOriginal ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
                <span>Lihat Versi Rapi (AI)</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                <span>Lihat Teks Asli</span>
              </>
            )}
          </button>
        )}

        {!formattedText && canFormat && (
          <button
            onClick={handleFormat}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors px-2.5 py-1 rounded-md disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
            <span>{isPending ? 'Merapikan...' : 'Rapikan Format dengan AI'}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-2 text-xs text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-gray-800 relative">
        {(!formattedText || showOriginal) ? (
          <div className="whitespace-pre-wrap leading-relaxed text-sm">
            {originalText}
          </div>
        ) : (
          <div 
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={renderMarkdown(formattedText)}
          />
        )}
      </div>
    </div>
  );
}
