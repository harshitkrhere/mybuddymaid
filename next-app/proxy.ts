// proxy.ts — Next.js 16 middleware (the file formerly known as middleware.ts).
// Responsibilities, in order:
//   1. canonical host: www.mybuddymaid.in → mybuddymaid.in (single 308 hop)
//   2. legacy URL handling from the prebuilt map (docs/seo/redirects.csv):
//      - 410 Gone for retired URLs
//      - 301 to the closest new page, in ONE hop even for `.html` variants
//      - bare `.html` → clean URL when no explicit rule exists
//   3. maintenance mode (env-gated, never hard-coded)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { MAINTENANCE_CONFIG } from './lib/maintenance';
import redirectMap from './lib/seo-engine/redirect-map.json';

const REDIRECTS = redirectMap.redirects as Record<string, string>;
const GONE = new Set<string>(redirectMap.gone as string[]);

const APEX_HOST = 'mybuddymaid.in';

function normalizeLookupPath(pathname: string): string {
  let p = pathname;
  if (p.endsWith('/index.html')) p = p.slice(0, -'/index.html'.length) || '/';
  else if (p.endsWith('.html')) p = p.slice(0, -'.html'.length);
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p.toLowerCase();
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const host = request.headers.get('host') ?? '';

  // 1. Canonical host (www → apex). Vercel domain redirects should also do this; this is the in-app guarantee.
  if (host === `www.${APEX_HOST}`) {
    const dest = url.clone();
    dest.host = APEX_HOST;
    dest.protocol = 'https:';
    dest.port = '';
    return NextResponse.redirect(dest, 308);
  }

  // 2. Legacy URL map (single hop).
  const lookup = normalizeLookupPath(url.pathname);
  if (GONE.has(lookup)) {
    return new NextResponse('Gone', { status: 410, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  const target = REDIRECTS[lookup];
  if (target && target !== url.pathname) {
    const dest = new URL(target + url.search, url);
    return NextResponse.redirect(dest, 301);
  }
  if (lookup !== url.pathname && !url.pathname.endsWith('/')) {
    // e.g. /blog/some-post.html → /blog/some-post (kept pages)
    return NextResponse.redirect(new URL(lookup + url.search, url), 301);
  }

  // 3. Maintenance mode (MAINTENANCE_MODE=true in the environment).
  if (MAINTENANCE_CONFIG.isMaintenanceActive) {
    if (
      url.pathname === '/maintenance' ||
      url.pathname.startsWith('/_next') ||
      url.pathname.startsWith('/_spa') ||
      url.pathname.startsWith('/api') ||
      url.pathname.includes('.')
    ) {
      return NextResponse.next();
    }
    const rewrite = url.clone();
    rewrite.pathname = '/maintenance';
    const res = NextResponse.rewrite(rewrite);
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }
  if (url.pathname === '/maintenance') {
    return NextResponse.redirect(new URL('/', request.url), 302);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|_spa/|favicon.ico).*)'],
};
