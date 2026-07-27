'use server';

import { db } from '@/lib/db';
import { proposals } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { put } from '@vercel/blob';

export type ResubmitPdfItem = {
  title: string;
  originalUrl: string;
  blobUrl?: string | null;
  embedUrl?: string | null;
  sizeMb?: number;
  isFallbackOnly?: boolean;
};

// Helper function to transform raw PDF URLs into inline embeddable iframe URLs
export async function getEmbeddablePdfUrl(url: string | null | undefined): Promise<string> {
  if (!url) return '';
  
  // 1. Google Drive PDF URLs -> convert to official /preview embed format
  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  // 2. Vercel Blob URLs -> direct display
  if (url.includes('public.blob.vercel-storage.com')) {
    return url;
  }

  // 3. Contabo Storage S3 or external PDFs -> Google Docs PDF Viewer Embed Proxy (bypasses octet-stream headers)
  return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
}

// Helper to extract PDF URLs from proposal text and main resubmit link
export async function extractSupportingPdfUrls(text: string | null | undefined, mainPdfUrl: string | null | undefined): Promise<ResubmitPdfItem[]> {
  const items: ResubmitPdfItem[] = [];
  const seen = new Set<string>();

  if (mainPdfUrl) {
    seen.add(mainPdfUrl);
    items.push({
      title: 'Dokumen Resubmission Utama',
      originalUrl: mainPdfUrl,
    });
  }

  if (!text) return items;

  let sanitizedText = text;
  sanitizedText = sanitizedText.replace(/(contabostorage\.com\/[^\s"<>]+)\s+([^\s"<>]+)/gi, '$1$2');
  sanitizedText = sanitizedText.replace(/(contabostorage\.com\/[^\s"<>]+)\s+([^\s"<>]+)/gi, '$1$2');

  const pdfRegex = /https?:\/\/[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?/gi;
  const pdfMatches = [...sanitizedText.matchAll(pdfRegex)];

  let supportIndex = 1;
  for (const m of pdfMatches) {
    const fullUrl = m[0];
    if (!seen.has(fullUrl)) {
      seen.add(fullUrl);
      items.push({
        title: `Dokumen Pendukung #${supportIndex}`,
        originalUrl: fullUrl,
      });
      supportIndex++;
    }
  }

  return items;
}

export async function getOrCacheResubmitPdfsAction(proposalId: number) {
  try {
    const [proposal] = await db
      .select({
        id: proposals.id,
        linkResubmitProposal: proposals.linkResubmitProposal,
        resubmitDocumentText: proposals.resubmitDocumentText,
        cachedResubmitPdfUrls: proposals.cachedResubmitPdfUrls,
      })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      return { error: 'Proposal tidak ditemukan.' };
    }

    // Return cached results if present in DB (Idempotency Guard)
    if (proposal.cachedResubmitPdfUrls && Array.isArray(proposal.cachedResubmitPdfUrls) && proposal.cachedResubmitPdfUrls.length > 0) {
      return { data: proposal.cachedResubmitPdfUrls as ResubmitPdfItem[] };
    }

    // Extract PDF items
    const rawPdfItems = await extractSupportingPdfUrls(proposal.resubmitDocumentText, proposal.linkResubmitProposal);

    if (rawPdfItems.length === 0) {
      return { data: [] };
    }

    const processedItems: ResubmitPdfItem[] = [];

    for (let i = 0; i < rawPdfItems.length; i++) {
      const item = rawPdfItems[i];
      try {
        // Fetch file to check size and content
        const res = await fetch(item.originalUrl, { method: 'GET' });
        
        if (!res.ok) {
          processedItems.push({
            ...item,
            isFallbackOnly: true
          });
          continue;
        }

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const sizeBytes = buffer.length;
        const sizeMb = sizeBytes / (1024 * 1024);

        // Limit size: 30MB
        if (sizeMb > 30) {
          processedItems.push({
            ...item,
            sizeMb: parseFloat(sizeMb.toFixed(2)),
            isFallbackOnly: true
          });
          continue;
        }

        // Upload to Vercel Blob (if token available and supported environment) or fallback to originalUrl
        let blobUrl = item.originalUrl;
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          try {
            const fileName = `resubmit_${proposalId}_${i + 1}.pdf`;
            const blobResult = await put(`resubmission-pdfs/${proposalId}/${fileName}`, buffer, {
              access: 'public',
              contentType: 'application/pdf',
            });
            blobUrl = blobResult.url;
          } catch (blobErr: any) {
            console.warn(`Vercel Blob upload fallback to originalUrl for proposal ${proposalId}:`, blobErr.message);
            blobUrl = item.originalUrl;
          }
        }

        processedItems.push({
          ...item,
          blobUrl: blobUrl,
          embedUrl: await getEmbeddablePdfUrl(blobUrl),
          sizeMb: parseFloat(sizeMb.toFixed(2)),
          isFallbackOnly: false
        });
      } catch (err: any) {
        console.error(`Error processing PDF ${item.originalUrl}:`, err);
        processedItems.push({
          ...item,
          isFallbackOnly: true
        });
      }
    }

    // Save to DB
    await db
      .update(proposals)
      .set({ cachedResubmitPdfUrls: processedItems })
      .where(eq(proposals.id, proposalId));

    return { data: processedItems };
  } catch (error: any) {
    console.error('getOrCacheResubmitPdfsAction error:', error);
    return { error: 'Gagal memproses dokumen PDF.' };
  }
}
