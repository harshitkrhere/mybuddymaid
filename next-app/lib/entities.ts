// lib/entities.ts — entity page support (Phase 5). One page per entity at
// /<city>/<area>/<entity>, prerendered with the service × locality pages on the same
// route. Sitemap shards are emitted per rollout batch so each batch can be submitted to
// IndexNow on its own.
import { LIVE_ENTITIES } from '@/data/seo/entities';
import rollout from '@/data/seo/quality/rollout.json';

export interface EntityUrl {
  loc: string;
  lastmod: string;
}

const BATCHES = (rollout as { batches?: Record<string, string[]> }).batches ?? {};

/** Sitemap shards per rollout batch: Map<batchName, EntityUrl[]>. */
export function entityPages(): Map<string, EntityUrl[]> {
  const out = new Map<string, EntityUrl[]>();
  for (const [batch, keys] of Object.entries(BATCHES)) {
    const urls: EntityUrl[] = [];
    for (const key of keys) {
      const e = LIVE_ENTITIES.find((x) => `${x.city}/${x.locality}/${x.slug}` === key);
      if (!e) continue;
      urls.push({ loc: `/${e.city}/${e.locality}/${e.slug}`, lastmod: e.updatedAt });
    }
    if (urls.length) out.set(batch, urls);
  }
  // ready entities not yet assigned to a batch are generated but not advertised
  return out;
}

export function entityParams() {
  return LIVE_ENTITIES.map((e) => ({ city: e.city, area: e.locality, slug: e.slug }));
}
