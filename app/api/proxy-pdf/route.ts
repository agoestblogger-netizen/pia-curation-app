import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  try {
    const response = await fetch(url, {
      // Pass along cache control if needed, or disable cache to ensure fresh fetch
      cache: 'no-store'
    });
    
    if (!response.ok) {
      return new NextResponse('Failed to fetch PDF', { status: response.status });
    }

    const headers = new Headers(response.headers);
    
    // Force inline PDF viewing
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', 'inline; filename="document.pdf"');
    
    // Prevent some proxy/compression headers from breaking the stream
    headers.delete('content-encoding');

    return new NextResponse(response.body as any, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('PDF Proxy Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
