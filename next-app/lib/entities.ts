// lib/entities.ts — entity × service page support (Phase 5). Entity pages are ISR with
// generateStaticParams limited to ready/live entities; unknown slugs 404. Sitemap shards
// are emitted per rollout batch so each batch can be submitted to IndexNow on its own.
import { LIVE_ENTITIES } from '@/data/seo/entities';
import { SERVICES } from '@/data/seo';
import rollout from '@/data/seo/quality/rollout.json';

export interface EntityUrl {
  loc: string;
  lastmod: string;
}

const BATCHES = (rollout as { batches?: Record<string, string[]> }).batches ?? {};

/** Sitemap shards per rollout batch: Map<batchName, EntityUrl[]>. */
export function entityPages(): Map<string, EntityUrl[]> {
  const out = new Map<string, EntityUrl[]>();
  const assigned = new Set<string>();
  for (const [batch, slugs] of Object.entries(BATCHES)) {
    const urls: EntityUrl[] = [];
    for (const key of slugs) {
      const e = LIVE_ENTITIES.find((x) => `${x.city}/${x.locality}/${x.slug}` === key);
      if (!e) continue;
      assigned.add(key);
      for (const s of SERVICES) urls.push({ loc: `/${e.city}/${e.locality}/${e.slug}/${s.slug}`, lastmod: e.updatedAt });
    }
    if (urls.length) out.set(batch, urls);
  }
  // ready entities not yet assigned to a batch are generated but not advertised
  return out;
}

export function entityParams() {
  const out: { city: string; area: string; slug: string; service: string }[] = [];
  for (const e of LIVE_ENTITIES) for (const s of SERVICES) out.push({ city: e.city, area: e.locality, slug: e.slug, service: s.slug });
  return out;
}
