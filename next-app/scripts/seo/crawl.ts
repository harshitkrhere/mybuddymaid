// scripts/seo/crawl.ts — crawls a running build (next start, or a preview URL) and
// asserts the crawl-hygiene rules from the brief: zero broken links, zero orphans, zero
// internal links that redirect, correct canonical/robots per page, click depth <= 3 for
// core page types. Prints depth per page type and exits non-zero on failure.
//
//   npx next build && npx next start &
//   npx tsx scripts/seo/crawl.ts                  # defaults to http://localhost:3000
//   BASE_URL=https://preview.example npx tsx scripts/seo/crawl.ts
import { assertReachable, hasBypass, siteFetch } from './_fetch';
import { allIndexableUrls } from '../../lib/seo-engine/sitemaps';
import { gateFor, hasGateVerdict } from '../../lib/seo-engine/gate';
import { SITE_URL } from '../../lib/seo-engine/meta';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const CONCURRENCY = Number(process.env.CRAWL_CONCURRENCY ?? 12);
const MAX_DEPTH_CORE = 3;

interface PageInfo {
  path: string;
  status: number;
  depth: number;
  links: string[];
  canonical: string | null;
  robots: string | null;
  title: string | null;
  redirectedTo?: string;
}

const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

const visited = new Map<string, PageInfo>();
const inboundLinks = new Map<string, number>();

const SKIP = /^(mailto:|tel:|https?:\/\/(?!localhost)|#|\/app(\/|$)|\/_spa|\/api\/|\/og\?)/;

function normalisePath(href: string, from: string): string | null {
  if (!href || SKIP.test(href)) return null;
  let u: URL;
  try {
    u = new URL(href, `${BASE}${from}`);
  } catch {
    return null;
  }
  if (u.origin !== BASE) return null;
  if (u.pathname.startsWith('/app') || u.pathname.startsWith('/_spa') || u.pathname.startsWith('/api/')) return null;
  return u.pathname.replace(/\/$/, '') || '/';
}

const attr = (html: string, re: RegExp) => html.match(re)?.[1] ?? null;

async function fetchPage(path: string, depth: number): Promise<PageInfo> {
  const res = await siteFetch(`${BASE}${path}`, { redirect: 'manual' });
  if (res.status >= 300 && res.status < 400) {
    return { path, status: res.status, depth, links: [], canonical: null, robots: null, title: null, redirectedTo: res.headers.get('location') ?? '' };
  }
  const html = res.status === 200 ? await res.text() : '';
  const links: string[] = [];
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
    const p = normalisePath(m[1], path);
    if (p) links.push(p);
  }
  return {
    path,
    status: res.status,
    depth,
    links,
    canonical: attr(html, /<link rel="canonical" href="([^"]+)"/),
    robots: attr(html, /<meta name="robots" content="([^"]+)"/),
    title: attr(html, /<title>([^<]*)<\/title>/),
  };
}

async function crawl() {
  let frontier: string[] = ['/'];
  let depth = 0;
  while (frontier.length && depth <= 8) {
    const next = new Set<string>();
    for (let i = 0; i < frontier.length; i += CONCURRENCY) {
      const chunk = frontier.slice(i, i + CONCURRENCY).filter((p) => !visited.has(p));
      const infos = await Promise.all(chunk.map((p) => fetchPage(p, depth)));
      for (const info of infos) {
        visited.set(info.path, info);
        for (const l of info.links) {
          inboundLinks.set(l, (inboundLinks.get(l) ?? 0) + 1);
          if (!visited.has(l)) next.add(l);
        }
      }
      process.stdout.write(`  depth ${depth}: visited ${visited.size}\r`);
    }
    frontier = [...next];
    depth++;
  }
  console.log(`  crawl complete: ${visited.size} pages, max depth ${depth - 1}      `);
}

async function main() {
  await assertReachable(BASE);
  if (hasBypass) console.log('  using the Vercel protection-bypass secret');
  await crawl();

  // ---------------------------------------------------------------------------
  // assertions
  // ---------------------------------------------------------------------------
  for (const info of visited.values()) {
    if (info.redirectedTo !== undefined) {
      err(`internal link target ${info.path} redirects (${info.status} -> ${info.redirectedTo}) — link to the final URL instead`);
      continue;
    }
    if (info.status !== 200) {
      err(`broken internal link: ${info.path} returned ${info.status}`);
      continue;
    }
    if (!info.title) warn(`${info.path}: no <title>`);
    const expectedCanonical = `${SITE_URL}${info.path === '/' ? '/' : info.path}`;
    if (!info.canonical) {
      err(`${info.path}: no canonical`);
    } else if (info.canonical.replace(/\/$/, '') !== expectedCanonical.replace(/\/$/, '')) {
      err(`${info.path}: canonical is ${info.canonical}, expected ${expectedCanonical}`);
    }
    // Only core SEO pages are gated; hand-written trust/blog pages are not composed.
    if (hasGateVerdict(info.path)) {
      const verdict = gateFor(info.path);
      const isNoindex = (info.robots ?? '').includes('noindex');
      if (verdict.index && isNoindex) err(`${info.path}: gate says index but page renders noindex`);
      if (!verdict.index && !isNoindex) {
        err(`${info.path}: gate says noindex (${verdict.reasons[0]}) but page does not render noindex`);
      }
    }
  }

  // orphans: every indexable URL must be reachable and linked from >= 1 other page
  const indexable = allIndexableUrls();
  for (const path of indexable) {
    if (!visited.has(path)) {
      err(`orphan: ${path} is indexable but was never reached by the crawler`);
      continue;
    }
    if (path !== '/' && (inboundLinks.get(path) ?? 0) === 0) err(`orphan: ${path} has zero inbound internal links`);
  }

  // click depth per page type
  const typeOf = (p: string): string => {
    if (p === '/') return 'home';
    const seg = p.split('/').filter(Boolean);
    if (seg[0] === 'services') return seg.length === 1 ? 'services-index' : seg.length === 2 ? 'service-hub' : 'service-city';
    if (seg[0] === 'pincode') return 'pincode';
    if (seg[0] === 'blog') return seg.length === 1 ? 'blog-index' : 'blog-post';
    if (seg.length === 1) return 'trust/city';
    if (seg.length === 2) return 'zone/locality';
    if (seg.length === 3) return 'service-locality';
    return 'other';
  };
  const depthByType = new Map<string, { max: number; worst: string; n: number }>();
  for (const info of visited.values()) {
    if (info.status !== 200) continue;
    const t = typeOf(info.path);
    const cur = depthByType.get(t) ?? { max: 0, worst: info.path, n: 0 };
    cur.n++;
    if (info.depth > cur.max) {
      cur.max = info.depth;
      cur.worst = info.path;
    }
    depthByType.set(t, cur);
  }

  console.log('\n--- click depth by page type ---');
  for (const [t, d] of [...depthByType].sort()) {
    const flag = d.max > MAX_DEPTH_CORE && t !== 'other' ? '  << over depth 3' : '';
    console.log(`  ${t.padEnd(18)} pages=${String(d.n).padStart(5)}  max depth=${d.max}  (${d.worst})${flag}`);
    if (d.max > MAX_DEPTH_CORE && !['other', 'blog-post'].includes(t)) {
      err(`click depth ${d.max} > ${MAX_DEPTH_CORE} for page type ${t} (e.g. ${d.worst})`);
    }
  }

  console.log(`\ncrawled ${visited.size} pages, ${indexable.length} indexable URLs expected`);
  if (warnings.length) {
    console.log(`${warnings.length} warning(s):`);
    for (const w of warnings.slice(0, 20)) console.log(`  WARN ${w}`);
  }
  if (errors.length) {
    console.error(`\n${errors.length} error(s):`);
    for (const e of errors.slice(0, 60)) console.error(`  FAIL ${e}`);
    if (errors.length > 60) console.error(`  ... and ${errors.length - 60} more`);
    process.exit(1);
  }
  console.log('crawl: GREEN — no broken links, no orphans, no redirecting internal links');

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
