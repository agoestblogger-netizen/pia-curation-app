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

  // Sanitize line-breaks and whitespace in Drive URLs introduced during PDF text extraction
  let sanitizedText = text;
  sanitizedText = sanitizedText.replace(/(drive\.google\.com\/[^\s"<>]+)\s+([^\s"<>]+)/gi, '$1$2');

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
        cdnUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
      });
    }
  }

  // 2. Recognized Image Hosting Domains & Direct Image Extensions
  // Domains: cdn.phototourl.com, ibb.co, imgur.com, contabostorage.com
  const imageDirectRegex = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?|https?:\/\/(?:cdn\.phototourl\.com|ibb\.co|i?\.?imgur\.com|[a-zA-Z0-9_-]+\.contabostorage\.com)\/[^\s"'<>]+/gi;
  const imageMatches = [...sanitizedText.matchAll(imageDirectRegex)];

  for (const m of imageMatches) {
    const fullUrl = m[0].replace(/[.,;)]+$/, '');

    // Skip drive.google.com since handled by driveRegex
    if (!seen.has(fullUrl) && !fullUrl.includes('drive.google.com')) {
      // Exclude HTML web pages or non-image URLs
      if (fullUrl.includes('/drive/folders/') || fullUrl.endsWith('.pdf')) {
        continue;
      }
      seen.add(fullUrl);
      results.push({
        originalUrl: fullUrl,
        cdnUrl: fullUrl,
      });
    }
  }

  return results;
}
