// lib/blog/links.ts — the two directions of the blog ↔ location linking.
//
// Before this, the 35 guides were reachable only from the header and footer and linked no
// location page back: the city guides — the topical-authority anchors the growth brief
// wants — passed nothing down to the hubs beneath them. Now every locality and service ×
// locality page links the guide that fits it (rotated, so no single guide collects every
// link), and every guide lists the places it applies to.
import { BLOG_BY_SLUG } from '@/data/blog/posts';
import { cityGuides, serviceGuides, tagsOf, TRUST_GUIDES } from '@/data/blog/tags';
import { CITIES, CITY_BY_SLUG, LOCALITY_BY_PATH, SERVICES, SERVICE_BY_SLUG } from '@/data/seo';
import { hashKey } from '@/lib/seo-engine/faqs';
import { paths } from '@/lib/seo-engine/links';

export interface GuideLink {
  name: string;
  path: string;
  anchor: string;
}

const pick = (slugs: string[], key: string): string | null => (slugs.length ? slugs[hashKey(key) % slugs.length] : null);

const link = (slug: string | null): GuideLink | null => {
  if (!slug) return null;
  const post = BLOG_BY_SLUG.get(slug);
  return post ? { name: post.title, path: `/blog/${slug}`, anchor: post.title } : null;
};

/** The guides a location page links: its city's guide, then a service or trust guide chosen by the page path. */
export function guidesForPage(pagePath: string, city: string, service?: string): GuideLink[] {
  const out: GuideLink[] = [];
  const cityGuide = link(pick(cityGuides(city), `${pagePath}→city-guide`));
  if (cityGuide) out.push(cityGuide);
  const second = service ? link(pick(serviceGuides(service), `${pagePath}→service-guide`)) : link(pick(TRUST_GUIDES, `${pagePath}→trust-guide`));
  if (second && !out.some((g) => g.path === second.path)) out.push(second);
  return out;
}

export interface AreaLink {
  name: string;
  path: string;
}

const cityHub = (slug: string): AreaLink | null => {
  const c = CITY_BY_SLUG.get(slug as never);
  return c ? { name: `Maid service in ${c.name}`, path: paths.city(c.slug) } : null;
};

/** The places a guide applies to. A guide for a city outside the footprint lists the cities we serve, honestly. */
export function areasForPost(slug: string): AreaLink[] {
  const t = tagsOf(slug);
  const out: AreaLink[] = [];
  const add = (l: AreaLink | null) => {
    if (l && !out.some((x) => x.path === l.path)) out.push(l);
  };
  if (t.kind === 'city-guide' && t.cities?.length) {
    for (const cs of t.cities) {
      const c = CITY_BY_SLUG.get(cs);
      if (!c) continue;
      add(cityHub(c.slug));
      for (const h of c.heroLocalities) {
        const l = LOCALITY_BY_PATH.get(`${c.slug}/${h}`);
        if (l) add({ name: `${l.name}, ${c.name}`, path: paths.locality(c.slug, l.slug) });
      }
      for (const s of SERVICES) add({ name: `${s.name} in ${c.name}`, path: paths.serviceCity(s.slug, c.slug) });
    }
    return out;
  }
  if (t.kind === 'service-guide' && t.services?.length) {
    for (const ss of t.services) {
      const s = SERVICE_BY_SLUG.get(ss);
      if (!s) continue;
      add({ name: `${s.name} across India`, path: paths.serviceHub(s.slug) });
      for (const c of CITIES.filter((c2) => c2.tier === 1)) add({ name: `${s.name} in ${c.name}`, path: paths.serviceCity(s.slug, c.slug) });
    }
    return out;
  }
  for (const c of CITIES) add(cityHub(c.slug));
  return out;
}
