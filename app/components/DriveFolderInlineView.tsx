'use client';

import { useState, useEffect } from 'react';
import { getGoogleDriveFolderFilesAction, DriveFolderResult, DriveFolderFile } from '@/app/actions/driveFolder';

export default function DriveFolderInlineView({
  folderUrl,
  folderTitle,
}: {
  folderUrl: string;
  folderTitle: string;
}) {
  const [folderData, setFolderData] = useState<DriveFolderResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});
  const [showIframePreview, setShowIframePreview] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Auto-detect or default to Account Index 2 (/u/2/) for Pegadaian Google Account
  const initialSessionIndex = folderUrl.match(/\/u\/(\d+)\//)?.[1] || '2';
  const [sessionIndex, setSessionIndex] = useState<string>(initialSessionIndex);

  const getFormattedUrl = (index: string) => {
    if (!index || index === 'none') return folderUrl;
    if (folderUrl.includes('/u/')) {
      return folderUrl.replace(/\/u\/\d+\//, `/u/${index}/`);
    }
    return folderUrl.replace('/drive/folders/', `/drive/u/${index}/folders/`);
  };

  const currentFolderUrl = getFormattedUrl(sessionIndex);

  const handleGoogleLoginPopup = () => {
    // Force Google Account Chooser with current formatted URL
    const accountChooserUrl = `https://accounts.google.com/AccountChooser?continue=${encodeURIComponent(currentFolderUrl)}`;
    const popup = window.open(accountChooserUrl, 'GoogleDriveLoginPopup', 'width=850,height=650,scrollbars=yes,resizable=yes');
    if (popup) {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setIframeKey(prev => prev + 1);
        }
      }, 1000);
    }
  };

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getGoogleDriveFolderFilesAction(folderUrl, folderTitle)
      .then((res) => {
        if (isMounted) {
          setFolderData(res);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setFolderData({
            folderId: '',
            folderTitle,
            folderUrl,
            files: [],
            isFallback: true,
          });
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [folderUrl, folderTitle]);

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3 animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-200 rounded-lg"></div>
          <div className="space-y-1.5 flex-1">
            <div className="h-3.5 bg-blue-200 rounded w-1/3"></div>
            <div className="h-2.5 bg-blue-200/70 rounded w-1/2"></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="h-24 bg-blue-100/60 rounded-lg"></div>
          <div className="h-24 bg-blue-100/60 rounded-lg"></div>
        </div>
      </div>
    );
  }

  // FALLBACK STATE: If API call failed, private, restricted, or no files -> Render Callout Banner
  if (!folderData || folderData.isFallback || folderData.files.length === 0) {
    const isEmpty = folderData && !folderData.isFallback && folderData.files.length === 0;

    if (isEmpty) {
      return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 shadow-2xs gap-3 my-3">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-slate-200/80 rounded-lg text-slate-600 shrink-0 mt-0.5">
              📁
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">{folderTitle}</p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                📁 Folder ini belum berisi file (Kosong).
              </p>
            </div>
          </div>
          <a
            href={folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg transition-colors shadow-2xs shrink-0"
          >
            <span>Buka Folder ↗</span>
          </a>
        </div>
      );
    }

    return (
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-sm transition-all space-y-3.5 my-3">
        {/* Main Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {folderTitle}
              </h4>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md">
                  🔒 Akses Terbatas Pegadaian
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setShowIframePreview(prev => !prev)}
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200/80 dark:border-slate-700 transition"
            >
              <span>{showIframePreview ? '❌ Tutup iFrame' : '👁️ Pratinjau iFrame'}</span>
            </button>
            <a
              href={currentFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs"
              title="Buka folder langsung di tab baru"
            >
              <span>📁 Buka Drive ↗</span>
            </a>
          </div>
        </div>

        {/* Optional iFrame Preview Drawer */}
        {showIframePreview && (
          <div className="w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-md relative pt-2">
            <div className="px-3.5 py-2 bg-slate-900 text-slate-200 text-[11px] font-semibold border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
                <div className="flex items-center space-x-1.5 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
                  <span className="text-[10px] font-medium text-slate-300">Sesi Akun Google:</span>
                  <select
                    value={sessionIndex}
                    onChange={(e) => {
                      setSessionIndex(e.target.value);
                      setIframeKey(prev => prev + 1);
                    }}
                    className="bg-slate-900 text-white text-[10px] font-bold rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none cursor-pointer"
                  >
                    <option value="0">Akun #1 (/u/0/)</option>
                    <option value="1">Akun #2 (/u/1/)</option>
                    <option value="2">Akun #3 (/u/2/ - Pegadaian)</option>
                    <option value="3">Akun #4 (/u/3/)</option>
                  </select>
                </div>
                <button
                  onClick={handleGoogleLoginPopup}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-[11px] transition shadow-2xs"
                >
                  <span>🔑 Ganti Akun (Pop-up)</span>
                </button>
              </div>
              <button onClick={() => setShowIframePreview(false)} className="text-slate-400 hover:text-white font-bold text-xs">✖ Tutup</button>
            </div>
            <div className="px-3 py-1.5 bg-slate-900/90 text-amber-300 text-[10px] border-b border-slate-800 flex items-center gap-1.5">
              <span>💡 Jika iFrame muncul Error 403 (kebijakan keamanan Google), gunakan tombol <strong>"📁 Buka Drive ↗"</strong> di atas.</span>
            </div>
            <iframe
              key={`${iframeKey}-${sessionIndex}`}
              src={currentFolderUrl}
              className="w-full h-[480px] bg-white border-0"
              title={folderTitle}
              loading="lazy"
            />
          </div>
        )}
      </div>
    );
  }

  // Group files by type
  const imageFiles = folderData.files.filter(f => f.mimeType.startsWith('image/') && !imageLoadErrors[f.id]);
  const pdfFiles = folderData.files.filter(f => f.mimeType === 'application/pdf');
  const otherFiles = folderData.files.filter(f => !f.mimeType.startsWith('image/') && f.mimeType !== 'application/pdf');

  return (
    <div className="bg-slate-50/80 border border-blue-200/80 rounded-xl p-4 space-y-4 my-3 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 002-2h-6l-2-2H5a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>{folderTitle}</span>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-blue-200">
                {folderData.files.length} file
              </span>
            </h5>
            <p className="text-[11px] text-slate-500">Isi folder ter-render otomatis secara inline</p>
          </div>
        </div>
        <a
          href={folderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1 hover:underline"
        >
          <span>Buka di Drive ↗</span>
        </a>
      </div>

      {/* 1. GALERI FOTO INLINE (image/*) */}
      {imageFiles.length > 0 && (
        <div className="space-y-2">
          <h6 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
            <span>🖼️ Gambar / Sketsa Inovasi ({imageFiles.length})</span>
          </h6>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {imageFiles.map((img) => (
              <div key={img.id} className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs space-y-2">
                <img
                  src={img.thumbnailUrl}
                  alt={img.name}
                  className="max-w-full max-h-72 mx-auto rounded border border-slate-200 object-contain bg-slate-50"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setImageLoadErrors(prev => ({ ...prev, [img.id]: true }))}
                />
                <p className="text-[11px] font-medium text-slate-700 truncate px-1" title={img.name}>
                  {img.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. PREVIEW PDF INLINE (application/pdf) - DEFAULT AUTO-EMBEDDED */}
      {pdfFiles.length > 0 && (
        <div className="space-y-3 pt-2">
          <h6 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
            <span>📄 Dokumen PDF Pendukung ({pdfFiles.length})</span>
          </h6>
          <div className="space-y-4">
            {pdfFiles.map((pdf) => (
              <div key={pdf.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs space-y-0">
                <div className="p-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate pr-2">
                    <span className="text-sm">📄</span>
                    <span className="text-xs font-bold text-slate-800 truncate" title={pdf.name}>
                      {pdf.name}
                    </span>
                  </div>
                  <a
                    href={pdf.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-indigo-600 font-semibold transition px-2 py-1 text-xs flex items-center space-x-1 shrink-0 hover:bg-slate-200/60 rounded"
                    title="Buka / Unduh di Tab Baru"
                  >
                    <span className="text-[11px]">Buka Tab Baru</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <div className="w-full bg-slate-900 border-t border-slate-200">
                  <iframe
                    src={pdf.previewUrl}
                    className="w-full h-[480px] bg-white border-0"
                    title={pdf.name}
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. SUB-FOLDER & FILE TIPE LAIN (docx, xlsx, zip, dll) */}
      {otherFiles.length > 0 && (
        <div className="space-y-2 pt-2">
          <h6 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
            <span>📎 Lampiran Lainnya ({otherFiles.length})</span>
          </h6>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {otherFiles.map((file) => (
              <a
                key={file.id}
                href={file.previewUrl || file.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2.5 bg-white hover:bg-slate-100/80 rounded-lg border border-slate-200 transition text-slate-800 shadow-2xs group"
              >
                <div className="flex items-center space-x-2 truncate pr-2">
                  <span className="text-base shrink-0">
                    {file.isFolder ? '📂' : file.mimeType.includes('spreadsheet') || file.name.endsWith('.xlsx') ? '📊' : file.mimeType.includes('word') || file.name.endsWith('.docx') ? '📝' : '📄'}
                  </span>
                  <span className="text-xs font-semibold truncate group-hover:text-blue-600" title={file.name}>
                    {file.name}
                  </span>
                </div>
                <span className="text-[11px] text-blue-600 font-medium shrink-0 flex items-center space-x-1">
                  <span>Buka</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
