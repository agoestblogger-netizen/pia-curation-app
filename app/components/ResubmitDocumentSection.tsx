'use client';

import { useState, useEffect } from 'react';
import { 
  extractDriveFolderUrls, 
  extractSupportingImageUrls, 
  extractGoogleWorkspaceUrls, 
  extractUnhandledUrls,
  ResubmitFolderItem,
  ResubmitImageItem,
  GoogleWorkspaceItem,
  ResubmitUnhandledLinkItem
} from '@/lib/utils/resubmitMediaExtractor';
import { resolveResubmitMediaAction } from '@/app/actions/urlResolver';
import { getOrCacheResubmitPdfsAction } from '@/app/actions/resubmitPdfCache';
import DriveFolderInlineView from './DriveFolderInlineView';

type ProposalMediaInput = {
  id: number;
  title?: string;
  linkResubmitProposal?: string | null;
  linkSuratOrisinalitas?: string | null;
  resubmitDocumentText?: string | null;
};

type Props = {
  proposal: ProposalMediaInput;
  showSplitScreenButton?: boolean;
  onOpenSplitScreen?: () => void;
  defaultExpanded?: boolean;
};

export default function ResubmitDocumentSection({
  proposal,
  showSplitScreenButton = false,
  onOpenSplitScreen,
  defaultExpanded = true,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // PDF Caching State
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfItems, setPdfItems] = useState<Array<{
    title: string;
    originalUrl: string;
    embedUrl?: string | null;
    blobUrl?: string | null;
    sizeMb?: number;
    isFallbackOnly?: boolean;
  }>>([]);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Shortener-Resolved Media State
  const [resolvedMedia, setResolvedMedia] = useState<{
    driveFolders: ResubmitFolderItem[];
    images: ResubmitImageItem[];
    workspace: GoogleWorkspaceItem[];
    unhandledUrls: ResubmitUnhandledLinkItem[];
  } | null>(null);
  
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});

  // 1. Resolve shortener URLs in background
  useEffect(() => {
    if (!proposal.id) return;
    let isMounted = true;

    async function runResolve() {
      try {
        const pkg = await resolveResubmitMediaAction(proposal.resubmitDocumentText, proposal.linkResubmitProposal);

        if (isMounted && pkg) {
          setResolvedMedia({
            driveFolders: pkg.driveFolders,
            images: pkg.images,
            workspace: pkg.workspaceItems,
            unhandledUrls: pkg.unhandledItems,
          });
        }
      } catch (err) {
        console.error('Failed to resolve resubmit media shorteners:', err);
      }
    }

    runResolve();
    return () => { isMounted = false; };
  }, [proposal.id, proposal.resubmitDocumentText, proposal.linkResubmitProposal]);

  // 2. Fetch & Cache Main Resubmit PDF in background
  useEffect(() => {
    if (!proposal.id || !proposal.linkResubmitProposal) return;
    let isMounted = true;

    async function runPdfProcess() {
      setIsProcessingPdf(true);
      setPdfError(null);
      try {
        const res = await getOrCacheResubmitPdfsAction(proposal.id);
        if (isMounted) {
          if (res.data) {
            setPdfItems(res.data);
          } else if (res.error) {
            setPdfError(res.error);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setPdfError(err.message || 'Gagal memproses dokumen PDF');
        }
      } finally {
        if (isMounted) {
          setIsProcessingPdf(false);
        }
      }
    }

    runPdfProcess();
    return () => { isMounted = false; };
  }, [proposal.id, proposal.linkResubmitProposal]);

  const hasContent = Boolean(
    proposal.linkResubmitProposal ||
    proposal.linkSuratOrisinalitas ||
    proposal.resubmitDocumentText
  );

  if (!hasContent) {
    return null;
  }

  // Derive Media Collections (Fallback to sync regex if resolved state not ready)
  const driveFolders = resolvedMedia ? resolvedMedia.driveFolders : extractDriveFolderUrls(proposal.resubmitDocumentText, proposal.linkResubmitProposal);
  const workspaceItems = resolvedMedia ? resolvedMedia.workspace : extractGoogleWorkspaceUrls(proposal.resubmitDocumentText, proposal.linkResubmitProposal);
  const rawImages = resolvedMedia ? resolvedMedia.images : extractSupportingImageUrls(proposal.resubmitDocumentText || proposal.linkResubmitProposal);
  const unhandledUrls = resolvedMedia ? resolvedMedia.unhandledUrls : extractUnhandledUrls(proposal.resubmitDocumentText, proposal.linkResubmitProposal);

  // Exclude PDFs from static image gallery
  const pdfDriveFileIds = new Set<string>();
  pdfItems.forEach(pdf => {
    const match = (pdf.originalUrl || '').match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) pdfDriveFileIds.add(match[1]);
  });

  const validImages = rawImages.filter(item => {
    if (imageLoadErrors[item.cdnUrl]) return false;
    const match = (item.originalUrl || '').match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i);
    if (match && match[1] && pdfDriveFileIds.has(match[1])) return false;
    return true;
  });

  const displayPdfs = pdfItems.length > 0 ? pdfItems : (proposal.linkResubmitProposal ? [{
    title: 'Dokumen Resubmission Utama',
    originalUrl: proposal.linkResubmitProposal,
    isFallbackOnly: false,
  }] : []);

  return (
    <div className="bg-slate-50 border border-slate-300 rounded-xl overflow-hidden shadow-xs mb-8">
      {/* Header Container */}
      <div 
        onClick={() => setIsExpanded(prev => !prev)}
        className="p-4 bg-slate-800 hover:bg-slate-900 transition-colors cursor-pointer select-none flex items-center justify-between text-white"
      >
        <div className="flex items-center space-x-3 truncate pr-2">
          <span className="text-lg">📂</span>
          <div>
            <h4 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
              <span>Detail Dokumen Resubmission</span>
              {(displayPdfs.length > 0 || driveFolders.length > 0) && (
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 font-extrabold px-2 py-0.5 rounded-full">
                  {displayPdfs.length + driveFolders.length + workspaceItems.length + validImages.length} Dokumen / Embed
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Pratinjau lengkap PDF, Google Drive Folder, Workspace & Sketsa Inovasi
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {showSplitScreenButton && onOpenSplitScreen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSplitScreen();
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-lg transition-colors flex items-center space-x-1.5 shadow-2xs"
              title="Buka Tampilan Layar Penuh / Split-Screen"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span>Split-Screen ⤢</span>
            </button>
          )}

          <svg
            className={`w-5 h-5 text-slate-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Body Container */}
      {isExpanded && (
        <div className="p-5 space-y-6 bg-white border-t border-slate-200">
          {/* Loading Indicator */}
          {isProcessingPdf && displayPdfs.length === 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-md p-4 flex items-center space-x-3 text-indigo-950 text-sm font-medium">
              <svg className="animate-spin h-5 w-5 text-indigo-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <span>⚡ Menyiapkan & meng-cache dokumen PDF resubmission... Mohon tunggu sebentar.</span>
            </div>
          )}

          {/* Error Indicator */}
          {pdfError && (
            <div className="bg-rose-50 text-rose-800 p-3.5 rounded-md border border-rose-200 text-xs flex items-center justify-between">
              <span>⚠️ {pdfError}</span>
            </div>
          )}

          {/* 1. PALING ATAS: DOKUMEN RESUBMISSION UTAMA (EMBED PDF UTUH) */}
          {displayPdfs.length > 0 && (
            <div className="space-y-6 pt-1">
              {displayPdfs.map((pdfItem, idx) => {
                const rawTarget = pdfItem.blobUrl || pdfItem.originalUrl;
                
                // Extract Google Drive File ID safely from any Drive URL format (file/d/, open?id=, uc?export=download&id=, etc.)
                const driveIdMatch = rawTarget ? rawTarget.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=)|id=)([a-zA-Z0-9_-]{25,})/i) : null;
                const safeDriveEmbed = driveIdMatch && driveIdMatch[1] ? `https://drive.google.com/file/d/${driveIdMatch[1]}/preview` : null;

                // Determine safe embed URL (never put raw shorteners or raw export=download URLs directly into iframe src)
                const embedSrc = pdfItem.embedUrl || safeDriveEmbed || (
                  rawTarget && (rawTarget.includes('public.blob.vercel-storage.com') || rawTarget.includes('/api/pdf/proxy') || rawTarget.toLowerCase().includes('.pdf'))
                    ? `/api/pdf/proxy?url=${encodeURIComponent(rawTarget)}`
                    : null
                );

                return (
                  <div key={pdfItem.originalUrl + idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span>📄</span>
                        <span>{pdfItem.title}</span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded border border-indigo-200">
                          📄 PDF Multi-Halaman (Scroll di Dalam Iframe)
                        </span>
                        {pdfItem.sizeMb && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal lowercase">
                            ({pdfItem.sizeMb} MB)
                          </span>
                        )}
                      </h5>

                      <a
                        href={pdfItem.blobUrl || pdfItem.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-indigo-600 transition p-1 text-xs flex items-center space-x-1 bg-slate-100 hover:bg-indigo-50 px-2 py-1 rounded border border-slate-200"
                        title="Buka PDF di Tab Baru"
                      >
                        <span className="text-[11px] font-semibold">🔗 Buka PDF di Tab Baru</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    </div>

                    {!pdfItem.isFallbackOnly ? (
                      <div className="w-full bg-slate-900 rounded-lg overflow-hidden border border-slate-300 shadow-sm relative">
                        {embedSrc ? (
                          <iframe
                            src={embedSrc}
                            className="w-full h-[700px] bg-white border-0"
                            title={pdfItem.title}
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-[300px] bg-slate-50 flex items-center justify-center p-6 text-slate-600 text-xs">
                            <div className="flex items-center space-x-2">
                              <svg className="animate-spin h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              <span>⚡ Menyiapkan pratinjau dokumen PDF secara aman...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-md text-xs text-slate-700 flex flex-col md:flex-row items-center justify-between gap-3">
                        <span className="font-medium text-amber-950">
                          📄 Dokumen PDF ini berukuran {pdfItem.sizeMb ? `>30MB (${pdfItem.sizeMb}MB)` : 'besar/perlu akses langsung'}. Tampilan embed inline di-skip untuk menjaga performa.
                        </span>
                        <a
                          href={pdfItem.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded transition flex-shrink-0 shadow-2xs"
                        >
                          🔗 Unduh / Buka Dokumen PDF
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. DOKUMEN PENDUKUNG / FOLDER GOOGLE DRIVE INLINE VIEW */}
          {driveFolders.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              {driveFolders.map((folder, fIdx) => (
                <DriveFolderInlineView
                  key={folder.folderUrl + fIdx}
                  folderUrl={folder.folderUrl}
                  folderTitle={folder.title}
                />
              ))}
            </div>
          )}

          {/* 3. DOKUMEN / LINK GOOGLE WORKSPACE (FORMS, SHEETS, DOCS, SLIDES) */}
          {workspaceItems.length > 0 && (
            <div className="space-y-6 pt-4 border-t border-slate-200">
              {workspaceItems.map((item, wIdx) => (
                <div key={item.url + wIdx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5 flex-wrap gap-y-1">
                      <span>{item.icon}</span>
                      <span>{item.title}</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${item.badgeBg}`}>
                        {item.badgeText}
                      </span>
                    </h5>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-indigo-600 transition p-1 text-xs flex items-center space-x-1 bg-slate-100 hover:bg-indigo-50 px-2 py-1 rounded border border-slate-200"
                      title="Buka di Tab Baru"
                    >
                      <span className="text-[11px] font-semibold">🔗 Buka di Tab Baru</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  </div>

                  <div className="w-full bg-slate-900 rounded-lg overflow-hidden border border-slate-300 shadow-sm relative">
                    <iframe
                      src={item.embedUrl}
                      style={{ height: `${item.heightPx}px` }}
                      className="w-full bg-white border-0"
                      title={item.title}
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 4. GAMBAR SKETSA / DIAGRAM INOVASI PENDUKUNG */}
          {validImages.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-slate-200">
              <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                <span>🖼️</span>
                <span>Gambar Sketsa / Diagram Inovasi</span>
              </h5>
              <div className="grid grid-cols-1 gap-4 pt-1">
                {validImages.map((item, idx) => (
                  <div key={item.cdnUrl} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                    <img 
                      src={item.cdnUrl} 
                      alt={`Sketsa Resubmission #${idx + 1}`}
                      className="max-w-full h-auto mx-auto rounded border border-slate-300 shadow-xs"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => setImageLoadErrors(prev => ({ ...prev, [item.cdnUrl]: true }))}
                    />
                    <div className="text-[11px] text-slate-500 mt-2 font-medium">
                      Sketsa / Diagram Resubmission #{idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. UNHANDLED EXTERNAL LINKS CALLOUT */}
          {unhandledUrls.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                <span>🔗</span>
                <span>Lampiran Eksternal / Tautan Lainnya</span>
              </h5>
              <div className="grid grid-cols-1 gap-2">
                {unhandledUrls.map((item, uIdx) => (
                  <div key={item.url + uIdx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="truncate pr-3">
                      <p className="text-xs font-semibold text-slate-800 truncate">{item.label}</p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.url}</p>
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg transition border border-indigo-200 shrink-0"
                    >
                      Buka Lampiran ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. SURAT ORISINALITAS */}
          {proposal.linkSuratOrisinalitas && (
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <span>📜</span>
                <span>Surat Orisinalitas (PDF)</span>
              </span>
              <a
                href={`/api/proxy-pdf?url=${encodeURIComponent(proposal.linkSuratOrisinalitas)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-lg transition border border-amber-200 flex items-center space-x-1"
              >
                <span>Unduh / Buka Surat Orisinalitas ↗</span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
