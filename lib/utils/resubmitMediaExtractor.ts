import { isShortenerUrl, resolveUrl } from './urlResolver';

export type ResubmitFolderItem = {
  title: string;
  folderUrl: string;
};

export type ResubmitImageItem = {
  originalUrl: string;
  cdnUrl: string;
};

// Extract Google Drive Folder URLs from main resubmit link and proposal text
export function extractDriveFolderUrls(text: string | null | undefined, mainUrl: string | null | undefined): ResubmitFolderItem[] {
  const folders: ResubmitFolderItem[] = [];
  const seen = new Set<string>();

  const isFolderUrl = (urlStr: string) => {
    return urlStr.includes('drive.google.com/drive/folders/') ||
      urlStr.includes('drive.google.com/drive/u/0/folders/') ||
      urlStr.includes('/folders/');
  };

  if (mainUrl && isFolderUrl(mainUrl)) {
    seen.add(mainUrl);
    folders.push({
      title: 'Folder Google Drive Dokumen Resubmission Utama',
      folderUrl: mainUrl,
    });
  }

  if (!text) return folders;

  // Sanitize line-breaks and whitespace in Drive URLs introduced during PDF text extraction, 
  // but avoid falsely merging the URL with subsequent words (like "Dokumen") if the ID is already complete.
  let sanitizedText = text;
  sanitizedText = sanitizedText.replace(/(drive\.google\.com\/[^\s"<>]+)\s+([^\s"<>]+)/gi, (match, part1, part2) => {
    const folderMatch = part1.match(/folders\/([a-zA-Z0-9_-]{20,50})/i);
    if (folderMatch && folderMatch[1].length >= 28) {
      return match; // Keep the space, do not merge
    }
    return part1 + part2;
  });

  // Robust Regex to match Google Drive Folder URLs with full 20-50 char ID
  const folderRegex = /https?:\/\/drive\.google\.com\/(?:[a-zA-Z0-9_\-\/]*\/)?folders\/([a-zA-Z0-9_-]{20,50})/gi;
  const matches = [...sanitizedText.matchAll(folderRegex)];

  let index = 1;
  for (const m of matches) {
    const fullUrl = m[0];
    const folderId = m[1];
    if (folderId && !seen.has(folderId)) {
      seen.add(folderId);
      folders.push({
        title: `Folder Google Drive Pendukung #${index}`,
        folderUrl: fullUrl,
      });
      index++;
    }
  }

  return folders;
}

// Helper function to extract supporting image links from Google Drive, Contabo, cdn.phototourl, ibb.co, imgur, etc.
export function extractSupportingImageUrls(text: string | null | undefined): ResubmitImageItem[] {
  if (!text) return [];

  const results: ResubmitImageItem[] = [];
  const seen = new Set<string>();

  // Sanitize line-breaks and whitespace in S3/Contabo URLs introduced during PDF text extraction
  let sanitizedText = text;
  sanitizedText = sanitizedText.replace(/(contabostorage\.com\/[^\s"<>]+)\s+([^\s"<>]+)/gi, '$1$2');

  // 1. Google Drive Image URLs
  const driveRegex = /https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)(?:[^\s"'<>]*)?/gi;
  const driveMatches = [...sanitizedText.matchAll(driveRegex)];

  for (const m of driveMatches) {
    const fullMatch = m[0].replace(/[.,;)]+$/, '');
    const fileId = m[1];
    
    // Skip if full match explicitly indicates a .pdf file
    if (fullMatch.toLowerCase().includes('.pdf')) {
      continue;
    }

    if (fileId && !seen.has(fileId)) {
      seen.add(fileId);
      results.push({
        originalUrl: fullMatch,
        cdnUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`,
      });
    }
  }

  // 2. Recognized Image Hosting Domains & Direct Image Extensions
  // Domains: cdn.phototourl.com, ibb.co, imgur.com, contabostorage.com
  const imageDirectRegex = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?|https?:\/\/(?:cdn\.phototourl\.com|ibb\.co|i?\.?imgur\.com|[a-zA-Z0-9_-]+\.contabostorage\.com)\/[^\s"'<>]+/gi;
  const imageMatches = [...sanitizedText.matchAll(imageDirectRegex)];

  for (const m of imageMatches) {
    const fullUrl = m[0].replace(/[.,;)]+$/, '');

    // Skip drive.google.com and docs.google.com
    if (!seen.has(fullUrl) && !fullUrl.includes('drive.google.com') && !fullUrl.includes('docs.google.com')) {
      // Exclude HTML web pages or non-image URLs
      if (fullUrl.includes('/drive/folders/') || fullUrl.endsWith('.pdf')) {
        continue;
      }
      seen.add(fullUrl);
      const isContaboOrS3 = fullUrl.includes('contabostorage.com') || fullUrl.includes('s3.amazonaws.com') || fullUrl.includes('blob.vercel-storage.com');
      results.push({
        originalUrl: fullUrl,
        cdnUrl: isContaboOrS3 ? `/api/image/proxy?url=${encodeURIComponent(fullUrl)}` : fullUrl,
      });
    }
  }

  return results;
}

export type ResubmitUnhandledLinkItem = {
  url: string;
  domain: string;
  label: string;
};

// Extract unhandled third-party links (Dropbox, OneDrive, internal web, etc.)
export function extractUnhandledUrls(text: string | null | undefined, mainUrl: string | null | undefined): ResubmitUnhandledLinkItem[] {
  const fullText = (text || '') + '\n' + (mainUrl || '');
  if (!fullText.trim()) return [];

  const items: ResubmitUnhandledLinkItem[] = [];
  const seen = new Set<string>();

  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const matches = [...fullText.matchAll(urlRegex)];

  for (const m of matches) {
    const cleanUrl = m[0].replace(/[.,;)]+$/, '');
    if (seen.has(cleanUrl)) continue;

    // Skip handled domains/patterns
    if (
      cleanUrl.includes('drive.google.com') ||
      cleanUrl.includes('docs.google.com') ||
      cleanUrl.includes('contabostorage.com') ||
      cleanUrl.includes('cdn.phototourl.com') ||
      cleanUrl.includes('ibb.co') ||
      cleanUrl.includes('imgur.com') ||
      cleanUrl.endsWith('.pdf') ||
      cleanUrl.endsWith('.jpg') ||
      cleanUrl.endsWith('.jpeg') ||
      cleanUrl.endsWith('.png') ||
      cleanUrl.endsWith('.webp')
    ) {
      continue;
    }

    try {
      const parsed = new URL(cleanUrl);
      const domain = parsed.hostname.replace(/^www\./, '');
      seen.add(cleanUrl);
      
      let label = 'Lampiran Pihak Ketiga';
      if (domain.includes('dropbox.com')) label = 'Dropbox File';
      else if (domain.includes('onedrive') || domain.includes('1drv.ms') || domain.includes('sharepoint.com')) label = 'Microsoft OneDrive / SharePoint';
      else if (domain.includes('youtube.com') || domain.includes('youtu.be')) label = 'Video YouTube';
      else if (domain.includes('figma.com')) label = 'Desain Figma';
      else if (domain.includes('canva.com')) label = 'Desain Canva';

      items.push({
        url: cleanUrl,
        domain,
        label,
      });
    } catch {
      // Invalid URL syntax
    }
  }

  return items;
}

export type GoogleWorkspaceItem = {
  type: 'form' | 'sheet' | 'doc' | 'slide';
  title: string;
  url: string;
  embedUrl: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  heightPx: number;
};

// Helper function to extract Google Workspace links (Forms, Sheets, Docs, Slides) from text and main link
export function extractGoogleWorkspaceUrls(text: string | null | undefined, mainUrl: string | null | undefined): GoogleWorkspaceItem[] {
  const fullText = (text || '') + '\n' + (mainUrl || '');
  if (!fullText.trim()) return [];

  const items: GoogleWorkspaceItem[] = [];
  const seen = new Set<string>();

  const docsRegex = /https?:\/\/docs\.google\.com\/[^\s"'<>]+/gi;
  const matches = [...fullText.matchAll(docsRegex)];

  for (const m of matches) {
    const cleanUrl = m[0].replace(/[.,;)]+$/, '');
    if (seen.has(cleanUrl)) continue;

    if (cleanUrl.includes('/forms/')) {
      seen.add(cleanUrl);
      let formEmbed = cleanUrl;
      if (formEmbed.includes('viewform')) {
        formEmbed = formEmbed.replace(/viewform(?:\?[^\s"'<>]*)?$/i, 'viewform?embedded=true');
        if (!formEmbed.includes('embedded=true')) {
          formEmbed += (formEmbed.includes('?') ? '&' : '?') + 'embedded=true';
        }
      } else {
        formEmbed = formEmbed.replace(/\/+$/, '') + '/viewform?embedded=true';
      }

      items.push({
        type: 'form',
        title: 'Google Form (Survei / Kuesioner)',
        url: cleanUrl,
        embedUrl: formEmbed,
        icon: '📋',
        badgeBg: 'bg-purple-100 text-purple-900 border-purple-200',
        badgeText: 'Form Kuesioner Inline',
        heightPx: 700,
      });
    } else if (cleanUrl.includes('/spreadsheets/')) {
      seen.add(cleanUrl);
      const sheetMatch = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i);
      const sheetEmbed = sheetMatch && sheetMatch[1] 
        ? `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/preview` 
        : cleanUrl;

      items.push({
        type: 'sheet',
        title: 'Google Spreadsheet (Data / Model Finansial)',
        url: cleanUrl,
        embedUrl: sheetEmbed,
        icon: '📊',
        badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-200',
        badgeText: 'Spreadsheet Inline',
        heightPx: 600,
      });
    } else if (cleanUrl.includes('/document/')) {
      seen.add(cleanUrl);
      const docMatch = cleanUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/i);
      const docEmbed = docMatch && docMatch[1] 
        ? `https://docs.google.com/document/d/${docMatch[1]}/preview` 
        : cleanUrl;

      items.push({
        type: 'doc',
        title: 'Google Docs (Dokumen Teks)',
        url: cleanUrl,
        embedUrl: docEmbed,
        icon: '📝',
        badgeBg: 'bg-blue-100 text-blue-900 border-blue-200',
        badgeText: 'Dokumen Teks Inline',
        heightPx: 600,
      });
    } else if (cleanUrl.includes('/presentation/')) {
      seen.add(cleanUrl);
      const slideMatch = cleanUrl.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/i);
      const slideEmbed = slideMatch && slideMatch[1] 
        ? `https://docs.google.com/presentation/d/${slideMatch[1]}/embed` 
        : cleanUrl;

      items.push({
        type: 'slide',
        title: 'Google Slides (Presentasi Slide)',
        url: cleanUrl,
        embedUrl: slideEmbed,
        icon: '🎨',
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-200',
        badgeText: 'Presentasi Slide Inline',
        heightPx: 550,
      });
    }
  }

  return items;
}
