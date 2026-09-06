// lib/seo-engine/sitemaps.ts — sitemap index + shards named {city}-{type}-{n}.xml,
// each ≤ 50,000 URLs, listing only indexable canonical URLs with lastmod from the data
// layer's updatedAt (never the build time). Entity shards are added per rollout batch
// (Phase 5).
import { CITIES, PINCODES, SERVICES, ZONES, ALL_LOCALITIES } from '@/data/seo';
import { allCorePages, composeCity, composeLocality, composeServiceCity, composeServiceHub, composeServiceLocality, composeZone, composePincode, composeMaidServiceHub, composeHome } from './compose';
import { gateFor } from './gate';
import { SITE_URL } from './meta';
import { BLOG_POSTS } from '@/data/blog/posts';
import { entityPages } from '@/lib/entities';

export interface SitemapUrl {
  loc: string;
  lastmod: string;
}
export interface Shard {
  name: string;
  urls: SitemapUrl[];
}

const MAX = 50000;
const TRUST_PAGES: SitemapUrl[] = [
  { loc: '/how-we-verify', lastmod: '2026-09-05' },
  { loc: '/replacement-policy', lastmod: '2026-09-05' },
  { loc: '/pricing', lastmod: '2026-09-05' },
  { loc: '/about', lastmod: '2026-09-05' },
  { loc: '/contact', lastmod: '2026-09-05' },
  { loc: '/services', lastmod: '2026-09-05' },
  { loc: '/blog', lastmod: '2026-09-05' },
];

function split(name: string, urls: SitemapUrl[]): Shard[] {
  const out: Shard[] = [];
  for (let i = 0; i < urls.length; i += MAX) out.push({ name: `${name}-${out.length + 1}`, urls: urls.slice(i, i + MAX) });
  return out.length ? out : [{ name: `${name}-1`, urls: [] }];
}

const idx = (path: string) => gateFor(path).index;

export function buildShards(): Shard[] {
  const shards: Shard[] = [];
  // global
  const global: SitemapUrl[] = [];
  const home = composeHome();
  if (idx(home.path)) global.push({ loc: home.path, lastmod: home.updatedAt });
  const maid = composeMaidServiceHub();
  if (idx(maid.path)) global.push({ loc: maid.path, lastmod: maid.updatedAt });
  for (const s of SERVICES) {
    const hub = composeServiceHub(s);
    if (idx(hub.path)) global.push({ loc: hub.path, lastmod: hub.updatedAt });
    for (const c of CITIES) {
      const m = composeServiceCity(s, c);
      if (idx(m.path)) global.push({ loc: m.path, lastmod: m.updatedAt });
    }
  }
  global.push(...TRUST_PAGES);
  for (const p of BLOG_POSTS) global.push({ loc: `/blog/${p.slug}`, lastmod: p.dateModified || p.datePublished });
  shards.push(...split('global-core', global));

  for (const c of CITIES) {
    const hubs: SitemapUrl[] = [];
    const cm = composeCity(c);
    if (idx(cm.path)) hubs.push({ loc: cm.path, lastmod: cm.updatedAt });
    for (const z of ZONES.filter((z2) => z2.city === c.slug)) {
      const zm = composeZone(z);
      if (idx(zm.path)) hubs.push({ loc: zm.path, lastmod: zm.updatedAt });
    }
    const svcPages: SitemapUrl[] = [];
    for (const l of ALL_LOCALITIES.filter((l2) => l2.city === c.slug)) {
      const lm = composeLocality(l);
      if (idx(lm.path)) hubs.push({ loc: lm.path, lastmod: lm.updatedAt });
      for (const s of SERVICES) {
        const sm = composeServiceLocality(s, l);
        if (idx(sm.path)) svcPages.push({ loc: sm.path, lastmod: sm.updatedAt });
      }
    }
    shards.push(...split(`${c.slug}-hubs`, hubs));
    shards.push(...split(`${c.slug}-services`, svcPages));
  }

  const pins: SitemapUrl[] = [];
  for (const p of PINCODES.filter((p2) => p2.localities.length >= 2)) {
    const pm = composePincode(p);
    if (idx(pm.path)) pins.push({ loc: pm.path, lastmod: pm.updatedAt });
  }
  shards.push(...split('pincodes', pins));

  // Phase 5: entity pages, one shard per rollout batch
  for (const [batch, urls] of entityPages()) shards.push(...split(`entities-${batch}`, urls));

  return shards.filter((s) => s.urls.length > 0);
}

export function shardXml(shard: Shard): string {
  const body = shard.urls
    .map((u) => `<url><loc>${SITE_URL}${escapeXml(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function indexXml(shards: Shard[]): string {
  const body = shards
    .map((s) => {
      const lastmod = s.urls.reduce((m, u) => (u.lastmod > m ? u.lastmod : m), '2000-01-01');
      return `<sitemap><loc>${SITE_URL}/sitemaps/${s.name}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Every indexable canonical URL (for crawl/indexnow tooling). */
export function allIndexableUrls(): string[] {
  const out: string[] = [];
  for (const m of allCorePages()) if (idx(m.path)) out.push(m.path);
  out.push(...TRUST_PAGES.map((t) => t.loc));
  return out;
}
