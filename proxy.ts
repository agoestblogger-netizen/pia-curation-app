import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from './lib/auth/session';

// Routes that are public (no auth required)
const PUBLIC_PATHS = ['/login', '/api/health'];

// Role-based route prefixes
const ROLE_ROUTES: Record<string, string[]> = {
  coordinator: ['/coordinator'],
  curator: ['/curator'],
  promoter: ['/promoter'],
  sponsor: ['/sponsor'],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifySession(token);
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based routing: check if user is accessing a route for their role
  for (const [role, prefixes] of Object.entries(ROLE_ROUTES)) {
    for (const prefix of prefixes) {
      if (pathname.startsWith(prefix)) {
        // Exception: Allow curator, promoter, and viewer to access FGD list
        if (pathname.startsWith('/coordinator/fgd') && (session.roles.includes('curator') || session.roles.includes('promoter') || session.roles.includes('viewer'))) {
          continue;
        }
        
        // Exception: Allow regional to access Sidang Final Regional
        if (pathname.startsWith('/curator/regional-final') && session.roles.includes('regional')) {
          continue;
        }
        
        if (!session.roles.includes(role) && !session.roles.includes('coordinator')) {
          // Coordinator can access everything
          return NextResponse.redirect(new URL('/forbidden', request.url));
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
