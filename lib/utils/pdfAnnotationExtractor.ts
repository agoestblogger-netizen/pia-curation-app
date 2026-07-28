import { getDocumentProxy } from 'unpdf';

/**
 * Extracts all HTTP/HTTPS Annotation URLs (hyperlinks embedded in Canva, Word, Docs, etc.)
 * from all pages of a PDF document buffer.
 */
export async function extractPdfAnnotationUrls(pdfBuffer: Uint8Array): Promise<string[]> {
  const urls: string[] = [];
  const seen = new Set<string>();

  try {
    const pdf = await getDocumentProxy(pdfBuffer);
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const annots = await page.getAnnotations();
      if (annots && Array.isArray(annots)) {
        for (const a of annots) {
          if (a.subtype === 'Link' && a.url) {
            const cleanUrl = a.url.trim().replace(/[.,;)]+$/, '');
            if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
              if (!seen.has(cleanUrl)) {
                seen.add(cleanUrl);
                urls.push(cleanUrl);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[PDF Annotation Extractor] Failed to extract annotations:', err);
  }

  return urls;
}
