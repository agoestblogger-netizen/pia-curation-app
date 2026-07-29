import { NextRequest, NextResponse } from 'next/server';

// Whitelisted domains allowed to be proxied
const ALLOWED_DOMAIN_PATTERNS = [
  /\.contabostorage\.com$/i,
  /contabostorage\.com$/i,
  /public\.blob\.vercel-storage\.com$/i,
  /drive\.google\.com$/i,
  /docs\.google\.com$/i,
  /google\.com$/i,
  /\.google\.com$/i,
  /googleusercontent\.com$/i,
  /api\.cida\.ai$/i,
  /cias\.id$/i,
  /s3\.amazonaws\.com$/i,
  /bit\.ly$/i,
  /tinyurl\.com$/i,
  /s\.id$/i,
];

function isAllowedUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    const hostname = parsed.hostname;
    return ALLOWED_DOMAIN_PATTERNS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
}

function detectContentType(url: string, rawHeader: string | null): string {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith('.png')) return 'image/png';
  if (lowerUrl.endsWith('.webp')) return 'image/webp';
  if (lowerUrl.endsWith('.gif')) return 'image/gif';
  if (lowerUrl.endsWith('.svg')) return 'image/svg+xml';
  if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) return 'image/jpeg';
  
  if (rawHeader && rawHeader.startsWith('image/')) {
    return rawHeader;
  }

  // Default fallback for binary/octet-stream images
  return 'image/jpeg';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Parameter "url" diperlukan' }, { status: 400 });
  }

  if (!isAllowedUrl(targetUrl)) {
    return NextResponse.json(
      { error: 'Domain sumber tidak diizinkan oleh kebijakan keamanan proxy.' },
      { status: 403 }
    );
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) PIA-Image-Proxy/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Gagal mengambil gambar sumber (${response.status} ${response.statusText})` },
        { status: response.status }
      );
    }

    const contentType = detectContentType(targetUrl, response.headers.get('content-type'));
    const blob = await response.blob();

    return new NextResponse(blob.stream(), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('[Image Proxy Error]:', error);
    return NextResponse.json(
      { error: `Terjadi kesalahan saat memproses proxy gambar: ${error.message}` },
      { status: 500 }
    );
  }
}
