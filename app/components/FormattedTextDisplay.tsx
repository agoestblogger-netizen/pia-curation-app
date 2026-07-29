'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { formatProposalFieldAction } from '@/app/actions/formatText';

type Props = {
  proposalId: number;
  fieldName: string;
  originalText: string | null;
  formattedText?: string | null;
  canFormat?: boolean; // HANYA true untuk coordinator, curator, promoter
  autoFormatOnLoad?: boolean;
  hideFormatButton?: boolean;
};

function preprocessBullets(text: string): string {
  return text
    .replace(/\s*([•●▪])\s*/g, '\n- ')
    .replace(/\s*([∘○])\s*/g, '\n  - ');
}

function autolinkUrls(htmlText: string): string {
  const urlRegex = /(https?:\/\/[^\s<"'`]+)/gi;
  return htmlText.replace(urlRegex, (match, url) => {
    const cleanUrl = url.replace(/[.,;)]+$/, '');
    const trailing = url.slice(cleanUrl.length);
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800 font-semibold underline underline-offset-2 break-all">${cleanUrl} ↗</a>${trailing}`;
  });
}

// Simple Markdown parser to avoid external dependencies
function renderMarkdown(text: string) {
  let cleanedText = preprocessBullets(text)
    .replace(/^\s*[-*+•]\s*(\d+)[\.\,\)]\s+/gim, '$1. ')
    .replace(/^\s*(\d+)[\,\)]\s+/gim, '$1. ');

  let html = cleanedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*$)/gim, '<h4 class="text-md font-bold text-indigo-900 mt-5 mb-2.5 pb-1 border-b border-indigo-100">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 class="text-lg font-bold text-indigo-900 mt-6 mb-3 pb-1 border-b border-indigo-100">$1</h3>')
    .replace(/^# (.*$)/gim, '<h2 class="text-xl font-bold text-indigo-900 mt-7 mb-3.5 pb-1 border-b border-indigo-200">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    .replace(/^\s{2,}[-*+•]\s+(.*)$/gim, '<li class="ml-8 list-circle my-1 text-gray-700">$1</li>')
    .replace(/^\s*[-*+•]\s+(.*)$/gim, '<li class="ml-5 list-disc my-1 text-gray-800">$1</li>')
    .replace(/(<li class="ml-(?:5|8) list-(?:disc|circle).*?<\/li>\n?)+/g, (match) => `<ul class="mb-4 my-2.5 space-y-1 pl-1 font-normal">${match}</ul>`)
    .replace(/^\s{2,}(\d+)\.\s+(.*)$/gim, '<li class="ml-8 list-lower-alpha my-1 text-gray-700">$2</li>')
    .replace(/^\s*(\d+)\.\s+(.*)$/gim, '<li class="ml-5 list-decimal my-1 text-gray-800" value="$1">$2</li>')
    .replace(/(<li class="ml-(?:5|8) list-(?:decimal|lower-alpha).*?<\/li>\n?)+/g, (match) => `<ol class="mb-4 my-2.5 space-y-1.5 pl-1 font-normal">${match}</ol>`)
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/<\/(ul|ol)>\s*<br\/>/g, '</$1>');

  html = autolinkUrls(html);
    
  return { __html: html };
}

export default function FormattedTextDisplay({ 
  proposalId, 
  fieldName, 
  originalText, 
  formattedText,
  canFormat = false,
  autoFormatOnLoad = false,
  hideFormatButton = false
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [showOriginal, setShowOriginal] = useState(!formattedText);
  const [error, setError] = useState<string | null>(null);
  const autoFormatTriggered = useRef(false);

  const handleFormat = () => {
    if (!originalText) return;
    setError(null);
    startTransition(async () => {
      const res = await formatProposalFieldAction(proposalId, fieldName, originalText);
      if (res.error) {
        setError(res.error);
        setShowOriginal(true); // Pastikan menampilkan original jika gagal
      } else {
        setShowOriginal(false);
      }
    });
  };

  useEffect(() => {
    if (autoFormatOnLoad && !formattedText && originalText && canFormat && !autoFormatTriggered.current) {
      autoFormatTriggered.current = true;
      handleFormat();
    }
  }, [autoFormatOnLoad, formattedText, originalText, canFormat]);

  if (!originalText) {
    return <span className="text-gray-400 italic">Kosong</span>;
  }

  const isFailed = !!error;

  return (
    <div className="relative group">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-end gap-2.5 mb-2">
        {formattedText && (
          <>
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-indigo-600 transition-colors bg-gray-100 hover:bg-indigo-50 px-2.5 py-1 rounded-md"
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

            {canFormat && !hideFormatButton && (
              <button
                onClick={handleFormat}
                disabled={isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors px-2.5 py-1 rounded-md border border-indigo-200 disabled:opacity-50"
                title="Rapikan ulang teks dengan AI versi terbaru"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                <span>{isPending ? 'Merapikan...' : 'Rapikan Ulang dengan AI'}</span>
              </button>
            )}
          </>
        )}

        {isPending && autoFormatOnLoad && hideFormatButton && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>Merapikan otomatis...</span>
          </div>
        )}

        {!formattedText && canFormat && !hideFormatButton && (
          <button
            onClick={handleFormat}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors px-2.5 py-1 rounded-md disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
            <span>{isPending ? 'Merapikan...' : (isFailed ? 'Coba Rapikan Lagi' : 'Rapikan Format dengan AI')}</span>
          </button>
        )}
      </div>

      {/* Fallback Graceful Note */}
      {isFailed && (
        <div className="mb-3 text-xs text-amber-600 bg-amber-50 p-2.5 rounded border border-amber-100 flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <span className="leading-snug">
            Perapian format AI belum tersedia saat ini — menampilkan teks asli.
          </span>
        </div>
      )}

      {/* Content */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-gray-800 relative max-h-[500px] overflow-y-auto pr-3">
        {(!formattedText || showOriginal) ? (
          <div 
            className="whitespace-pre-wrap leading-relaxed text-sm"
            dangerouslySetInnerHTML={{
              __html: autolinkUrls(
                (originalText || '')
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
              )
            }}
          />
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
