// data/seo/localities/_build.ts — expands compact hand-authored base rows into full
// Locality records and merges in generated enrichment (neighbours, landmarks, profiles,
// coordinates, curated prose). Base rows encode the Appendix B normalization decisions;
// enrichment JSON is produced by scripts/seo tooling and reviewed drafts.
import type { CitySlug, DemandProfile, FAQ, HousingProfile, Locality, LocalityKind, Priority } from '../types';

const UPDATED = '2026-09-05';

/** Compact base row: [slug, name, altNames, zone, pincodes, priority, kind?] */
export type BaseRow = [
  slug: string,
  name: string,
  altNames: string[],
  zone: string,
  pincodes: string[],
  priority: Priority,
  kind?: LocalityKind,
];

export interface LocalityEnrichment {
  lat?: number;
  lng?: number;
  neighbours?: string[];
  landmarks?: string[];
  housingProfile?: HousingProfile;
  demandProfile?: DemandProfile[];
  helperSourceAreas?: string[];
  localIntro?: string;
  commuteNotes?: string;
  housingNotes?: string;
  localFaqs?: FAQ[];
  reviewed?: boolean;
  sourceRefs?: string[];
  updatedAt?: string;
}

export function buildLocalities(
  city: CitySlug,
  rows: BaseRow[],
  enrichment: Record<string, LocalityEnrichment>,
): Locality[] {
  return rows.map(([slug, name, altNames, zone, pincodes, priority, kind]) => {
    const e = enrichment[slug] ?? {};
    return {
      slug,
      city,
      zone,
      name,
      altNames,
      pincodes,
      priority,
      kind: kind ?? 'locality',
      lat: e.lat,
      lng: e.lng,
      neighbours: e.neighbours ?? [],
      landmarks: e.landmarks ?? [],
      housingProfile: e.housingProfile ?? 'mixed',
      demandProfile: e.demandProfile ?? ['families'],
      helperSourceAreas: e.helperSourceAreas ?? [],
      localIntro: e.localIntro ?? '',
      commuteNotes: e.commuteNotes ?? '',
      housingNotes: e.housingNotes ?? '',
      localFaqs: e.localFaqs ?? [],
      reviewed: e.reviewed ?? false,
      sourceRefs: e.sourceRefs ?? [],
      updatedAt: e.updatedAt ?? UPDATED,
    };
  });
}
