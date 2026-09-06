// data/seo/localities/gurgaon.ts — Gurgaon base rows (Appendix B.4, normalized per B.9).
// Golf Course Road merges [122002+122011]; South City 1 added per B.9.6 (122001);
// Sohna Road is a road-kind locality at 122102 (it also touches 122018/122101 —
// recorded here as a comment, not extra pins, to keep pincode pages clean);
// 122001 "Gurgaon Main" and 122505 "New Gurgaon surroundings" are zone-level pins;
// the suggested manesar zone is folded into new-gurgaon (ASSUMPTIONS.md #18).
// Appendix C raises Sohna Road and South City to very-high.
import type { Locality } from '../types';
import { buildLocalities, type BaseRow, type LocalityEnrichment } from './_build';
import enrichment from './enrichment/gurgaon.json';

const s = (
  n: number,
  pins: string[],
  priority: 'very-high' | 'high' | 'medium',
  zone: string,
): BaseRow => [`sector-${n}`, `Sector ${n}`, [`Sector ${n} Gurgaon`, `Sector ${n} Gurugram`], zone, pins, priority, 'sector'];

const rows: BaseRow[] = [
  // ---- dlf-golf-course-road ----
  ['dlf-phase-1', 'DLF Phase 1', ['DLF City Phase 1'], 'dlf-golf-course-road', ['122002'], 'very-high'],
  ['dlf-phase-2', 'DLF Phase 2', ['DLF City Phase 2'], 'dlf-golf-course-road', ['122002'], 'very-high'],
  ['dlf-phase-3', 'DLF Phase 3', ['DLF City Phase 3'], 'dlf-golf-course-road', ['122010'], 'very-high'],
  ['dlf-phase-4', 'DLF Phase 4', ['DLF City Phase 4'], 'dlf-golf-course-road', ['122009'], 'very-high'],
  ['dlf-phase-5', 'DLF Phase 5', ['DLF City Phase 5'], 'dlf-golf-course-road', ['122011'], 'very-high'],
  ['golf-course-road', 'Golf Course Road', ['GCR'], 'dlf-golf-course-road', ['122002', '122011'], 'very-high', 'road'],
  s(42, ['122011'], 'very-high', 'dlf-golf-course-road'),
  s(43, ['122011'], 'very-high', 'dlf-golf-course-road'),
  s(53, ['122011'], 'very-high', 'dlf-golf-course-road'),
  s(54, ['122011'], 'very-high', 'dlf-golf-course-road'),
  s(55, ['122011'], 'very-high', 'dlf-golf-course-road'),
  s(56, ['122011'], 'very-high', 'dlf-golf-course-road'),
  s(57, ['122011'], 'very-high', 'dlf-golf-course-road'),
  s(58, ['122011'], 'very-high', 'dlf-golf-course-road'),
  s(59, ['122011'], 'very-high', 'dlf-golf-course-road'),
  s(60, ['122011'], 'very-high', 'dlf-golf-course-road'),
  s(61, ['122011'], 'very-high', 'dlf-golf-course-road'),
  // ---- sohna-road-south-city ----
  ['south-city-1', 'South City 1', [], 'sohna-road-south-city', ['122001'], 'very-high'],
  ['south-city-2', 'South City 2', [], 'sohna-road-south-city', ['122018'], 'very-high'],
  ['sohna-road', 'Sohna Road', [], 'sohna-road-south-city', ['122102'], 'very-high', 'road'],
  s(47, ['122018'], 'very-high', 'sohna-road-south-city'),
  s(49, ['122018'], 'very-high', 'sohna-road-south-city'),
  s(50, ['122018'], 'very-high', 'sohna-road-south-city'),
  s(51, ['122018'], 'very-high', 'sohna-road-south-city'),
  s(65, ['122018'], 'very-high', 'sohna-road-south-city'),
  s(66, ['122018'], 'very-high', 'sohna-road-south-city'),
  s(67, ['122101'], 'very-high', 'sohna-road-south-city'),
  s(68, ['122101'], 'very-high', 'sohna-road-south-city'),
  s(69, ['122101'], 'very-high', 'sohna-road-south-city'),
  s(70, ['122101'], 'very-high', 'sohna-road-south-city'),
  s(71, ['122101'], 'very-high', 'sohna-road-south-city'),
  // ---- new-gurgaon (incl. Manesar belt) ----
  s(72, ['122004'], 'very-high', 'new-gurgaon'),
  s(73, ['122004'], 'very-high', 'new-gurgaon'),
  s(74, ['122004'], 'very-high', 'new-gurgaon'),
  s(75, ['122004'], 'very-high', 'new-gurgaon'),
  s(76, ['122004'], 'very-high', 'new-gurgaon'),
  s(77, ['122004'], 'very-high', 'new-gurgaon'),
  s(82, ['122004'], 'very-high', 'new-gurgaon'),
  s(83, ['122004'], 'very-high', 'new-gurgaon'),
  s(84, ['122004'], 'very-high', 'new-gurgaon'),
  s(85, ['122004'], 'very-high', 'new-gurgaon'),
  s(86, ['122004'], 'very-high', 'new-gurgaon'),
  s(88, ['122004'], 'very-high', 'new-gurgaon'),
  ['manesar', 'Manesar', [], 'new-gurgaon', ['122051'], 'high'],
  ['imt-manesar', 'IMT Manesar', [], 'new-gurgaon', ['122052'], 'high'],
  // ---- old-gurgaon ----
  s(21, ['122016'], 'high', 'old-gurgaon'),
  s(44, ['122003'], 'high', 'old-gurgaon'),
  s(45, ['122003'], 'high', 'old-gurgaon'),
  s(46, ['122003'], 'high', 'old-gurgaon'),
  s(52, ['122003'], 'high', 'old-gurgaon'),
];

export const GURGAON_LOCALITIES: Locality[] = buildLocalities(
  'gurgaon',
  rows,
  enrichment as Record<string, LocalityEnrichment>,
);
