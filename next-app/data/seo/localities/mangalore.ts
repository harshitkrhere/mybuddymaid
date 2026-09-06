// data/seo/localities/mangalore.ts — Mangalore base rows (Appendix B.8).
// 575001 "Mangalore" and 575036 "surrounding areas" stay city-level pincodes (B.9.5).
// Appendix C clusters raise Kadri, Bejai, Kankanady, Attavar, Urwa, Surathkal,
// Bondel, Nantoor and Pumpwell to very-high.
import type { Locality } from '../types';
import { buildLocalities, type BaseRow, type LocalityEnrichment } from './_build';
import enrichment from './enrichment/mangalore.json';

const rows: BaseRow[] = [
  // ---- mangalore-city ----
  ['hampankatta', 'Hampankatta', [], 'mangalore-city', ['575002'], 'high'],
  ['kodialbail', 'Kodialbail', [], 'mangalore-city', ['575003'], 'high'],
  ['kadri', 'Kadri', [], 'mangalore-city', ['575004'], 'very-high'],
  ['kottara', 'Kottara', [], 'mangalore-city', ['575005'], 'high'],
  ['bejai', 'Bejai', [], 'mangalore-city', ['575006'], 'very-high'],
  ['derebail', 'Derebail', [], 'mangalore-city', ['575007'], 'high'],
  ['kulshekar', 'Kulshekar', ['Kulshekara'], 'mangalore-city', ['575008'], 'high'],
  ['valencia', 'Valencia', [], 'mangalore-city', ['575009'], 'high'],
  ['bolar', 'Bolar', [], 'mangalore-city', ['575010'], 'high'],
  ['jeppu', 'Jeppu', [], 'mangalore-city', ['575011'], 'high'],
  ['kankanady', 'Kankanady', [], 'mangalore-city', ['575013'], 'very-high'],
  ['attavar', 'Attavar', [], 'mangalore-city', ['575015'], 'very-high'],
  ['urwa', 'Urwa', [], 'mangalore-city', ['575016'], 'very-high'],
  ['kavoor', 'Kavoor', [], 'mangalore-city', ['575017'], 'high'],
  ['bondel', 'Bondel', [], 'mangalore-city', ['575028'], 'very-high'],
  ['kulur', 'Kulur', [], 'mangalore-city', ['575029'], 'high'],
  ['nantoor', 'Nantoor', ['Nanthoor'], 'mangalore-city', ['575030'], 'very-high'],
  ['pumpwell', 'Pumpwell', [], 'mangalore-city', ['575031'], 'very-high'],
  // ---- mangalore-north ----
  ['surathkal', 'Surathkal', [], 'mangalore-north', ['575018'], 'very-high'],
  ['panambur', 'Panambur', [], 'mangalore-north', ['575019'], 'high'],
  ['katipalla', 'Katipalla', [], 'mangalore-north', ['575020'], 'high'],
  ['bajpe', 'Bajpe', [], 'mangalore-north', ['575025'], 'high'],
  // ---- mangalore-south ----
  ['ullal', 'Ullal', [], 'mangalore-south', ['575021'], 'high'],
  ['konaje', 'Konaje', [], 'mangalore-south', ['575022'], 'high'],
  ['mudipu', 'Mudipu', [], 'mangalore-south', ['575023'], 'high'],
];

export const MANGALORE_LOCALITIES: Locality[] = buildLocalities(
  'mangalore',
  rows,
  enrichment as Record<string, LocalityEnrichment>,
);
