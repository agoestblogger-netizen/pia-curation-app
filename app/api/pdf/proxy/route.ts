import { NextRequest, NextResponse } from 'next/server';

// Whitelisted domains allowed to be proxied to prevent Open Proxy vulnerability
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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) PIA-Proxy/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Gagal mengambil dokumen sumber (${response.status} ${response.statusText})` },
        { status: response.status }
      );
    }

    const blob = await response.blob();

    return new NextResponse(blob.stream(), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="resubmission.pdf"',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('[PDF Proxy Error]:', error);
    return NextResponse.json(
      { error: `Terjadi kesalahan saat memproses proxy PDF: ${error.message}` },
      { status: 500 }
    );
  }
}
