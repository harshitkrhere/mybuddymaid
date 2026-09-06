// data/seo/entities.ts — Phase 5 long-tail entities (societies, sectors, landmarks,
// metro-station catchments) inside Appendix-B localities. Populated by
// scripts/seo/import-entities.ts from operator CSVs / OpenStreetMap, imported as
// `draft` for approval. A `draft` entity has NO URL at all — not a noindexed page.
import type { Entity } from './types';
import entityData from './entities.json';

export const ENTITIES: Entity[] = entityData as Entity[];

/** Only ready/live entities get pages (readiness gate, brief §7.2). */
export const LIVE_ENTITIES = ENTITIES.filter((e) => e.status === 'ready' || e.status === 'live');

export const ENTITY_BY_PATH = new Map(LIVE_ENTITIES.map((e) => [`${e.city}/${e.locality}/${e.slug}`, e]));

export const ENTITIES_BY_LOCALITY = new Map<string, Entity[]>();
for (const e of LIVE_ENTITIES) {
  const key = `${e.city}/${e.locality}`;
  ENTITIES_BY_LOCALITY.set(key, [...(ENTITIES_BY_LOCALITY.get(key) ?? []), e]);
}

/** An entity is `ready` only with >= 5 entity-specific facts (brief §7.2). */
export const MIN_ENTITY_FACTS = 5;
export function meetsReadinessGate(e: Entity): boolean {
  return Object.keys(e.facts ?? {}).length >= MIN_ENTITY_FACTS;
}
