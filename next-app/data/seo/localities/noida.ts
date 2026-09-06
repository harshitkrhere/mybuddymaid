// data/seo/localities/noida.ts — Noida base rows (Appendix B.2, normalized per B.9).
// "201301 — Noida Central / Sectors 1–11" stays a zone-level pin on noida-central
// (individual Sectors 1–11 not added pending operator confirmation, B.9.5).
// Duplicate-band sectors keep the higher band (142 [201305+201306]; 143, 150, 152
// merge to [201306(+201310)] per B.9.1/B.9.2). Very-high overrides from Appendix C.
import type { Locality } from '../types';
import { buildLocalities, type BaseRow, type LocalityEnrichment } from './_build';
import enrichment from './enrichment/noida.json';

const s = (
  n: number,
  pins: string[],
  priority: 'very-high' | 'high' | 'medium',
  zone: 'noida-central' | 'noida-expressway',
): BaseRow => [`sector-${n}`, `Sector ${n}`, [`Sector ${n} Noida`], zone, pins, priority, 'sector'];

const rows: BaseRow[] = [
  // ---- noida-central (Sectors 12–79) ----
  s(12, ['201301'], 'high', 'noida-central'),
  s(15, ['201301'], 'high', 'noida-central'),
  s(16, ['201301'], 'high', 'noida-central'),
  s(18, ['201301'], 'high', 'noida-central'),
  s(19, ['201301'], 'high', 'noida-central'),
  s(20, ['201301'], 'high', 'noida-central'),
  s(21, ['201301'], 'high', 'noida-central'),
  s(22, ['201301'], 'high', 'noida-central'),
  s(27, ['201301'], 'high', 'noida-central'),
  s(28, ['201301'], 'high', 'noida-central'),
  s(29, ['201301'], 'high', 'noida-central'),
  s(30, ['201301'], 'high', 'noida-central'),
  s(37, ['201303'], 'high', 'noida-central'),
  s(41, ['201303'], 'high', 'noida-central'),
  s(43, ['201303'], 'high', 'noida-central'),
  s(44, ['201303'], 'high', 'noida-central'),
  s(45, ['201303'], 'high', 'noida-central'),
  s(46, ['201303'], 'high', 'noida-central'),
  s(47, ['201303'], 'high', 'noida-central'),
  s(50, ['201301'], 'very-high', 'noida-central'),
  s(51, ['201301'], 'very-high', 'noida-central'),
  s(52, ['201301'], 'very-high', 'noida-central'),
  s(55, ['201301'], 'high', 'noida-central'),
  s(56, ['201301'], 'high', 'noida-central'),
  s(61, ['201301'], 'very-high', 'noida-central'),
  s(62, ['201301'], 'very-high', 'noida-central'),
  s(63, ['201301'], 'high', 'noida-central'),
  s(71, ['201301'], 'high', 'noida-central'),
  s(72, ['201301'], 'high', 'noida-central'),
  s(74, ['201301'], 'very-high', 'noida-central'),
  s(75, ['201301'], 'very-high', 'noida-central'),
  s(76, ['201301'], 'very-high', 'noida-central'),
  s(77, ['201301'], 'very-high', 'noida-central'),
  s(78, ['201301'], 'very-high', 'noida-central'),
  s(79, ['201301'], 'very-high', 'noida-central'),
  // ---- noida-expressway (Sectors 93–152) ----
  s(93, ['201304'], 'very-high', 'noida-expressway'),
  s(100, ['201304'], 'very-high', 'noida-expressway'),
  s(104, ['201304'], 'very-high', 'noida-expressway'),
  s(107, ['201304'], 'very-high', 'noida-expressway'),
  s(108, ['201304'], 'very-high', 'noida-expressway'),
  s(110, ['201304'], 'high', 'noida-expressway'),
  s(135, ['201305'], 'medium', 'noida-expressway'),
  s(136, ['201305'], 'medium', 'noida-expressway'),
  s(137, ['201305'], 'very-high', 'noida-expressway'),
  s(140, ['201305'], 'medium', 'noida-expressway'),
  s(141, ['201305'], 'medium', 'noida-expressway'),
  s(142, ['201305', '201306'], 'medium', 'noida-expressway'),
  s(143, ['201306'], 'very-high', 'noida-expressway'),
  s(144, ['201306'], 'medium', 'noida-expressway'),
  s(145, ['201306'], 'medium', 'noida-expressway'),
  s(146, ['201306'], 'medium', 'noida-expressway'),
  s(147, ['201306'], 'medium', 'noida-expressway'),
  s(148, ['201306'], 'medium', 'noida-expressway'),
  s(149, ['201306'], 'medium', 'noida-expressway'),
  s(150, ['201306', '201310'], 'very-high', 'noida-expressway'),
  s(151, ['201306'], 'medium', 'noida-expressway'),
  s(152, ['201306', '201310'], 'high', 'noida-expressway'),
];

export const NOIDA_LOCALITIES: Locality[] = buildLocalities(
  'noida',
  rows,
  enrichment as Record<string, LocalityEnrichment>,
);
