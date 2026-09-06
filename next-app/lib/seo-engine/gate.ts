// lib/seo-engine/gate.ts — reads the quality-gate verdicts produced by
// scripts/seo/uniqueness.ts (data/seo/quality/gate.json). A page that failed any gate
// (near-duplicate, low local-token ratio, under word floor, missing required section,
// [VERIFY] marker) renders `noindex, follow`; the build never fails on content gaps.
import gate from '@/data/seo/quality/gate.json';
import { LIVE_ENTITIES } from '@/data/seo/entities';

export interface GateVerdict {
  index: boolean;
  reasons: string[];
  words: number;
  localRatio: number;
}

const VERDICTS = (gate as { pages?: Record<string, GateVerdict> }).pages ?? {};
const GATE_PRESENT = Object.keys(VERDICTS).length > 0;

/** True when the uniqueness gate actually evaluated this path (core SEO pages only). */
export function hasGateVerdict(path: string): boolean {
  return Object.prototype.hasOwnProperty.call(VERDICTS, path);
}

const ENTITY_PATHS = new Set(LIVE_ENTITIES.map((e) => `/${e.city}/${e.locality}/${e.slug}`));

export function gateFor(path: string): GateVerdict {
  const v = VERDICTS[path];
  if (v) return v;
  // An entity promoted to `ready` after the last `seo:gate` run has no verdict yet. Fail
  // closed, or a page nothing has checked for near-duplication would be served indexable
  // (rule 8). Re-run `npm run seo:gate` to index it.
  if (GATE_PRESENT && ENTITY_PATHS.has(path)) {
    return { index: false, reasons: ['not gated yet: run npm run seo:gate'], words: 0, localRatio: 0 };
  }
  // Hand-written pages (trust pages, blog posts) are not composed from the data layer,
  // so the uniqueness gate never sees them; they are reviewed by a human and indexable.
  return { index: true, reasons: GATE_PRESENT ? ['not gated: hand-written page'] : [], words: 0, localRatio: 0 };
}

export function robotsFor(path: string): { index: boolean; follow: boolean } {
  return { index: gateFor(path).index, follow: true };
}

export function indexablePaths(): Set<string> {
  return new Set(Object.entries(VERDICTS).filter(([, v]) => v.index).map(([p]) => p));
}
