// data/seo/localities/greater-noida.ts — Greater Noida base rows (Appendix B.3).
// "Greater Noida West / Noida Extension" is the ZONE greater-noida-west (alt name
// Noida Extension), not a locality. The suggested outskirts zone is folded into
// greater-noida-central so every zone keeps >= 3 localities (ASSUMPTIONS.md #18).
// 203201 stays a city-level pincode.
import type { Locality } from '../types';
import { buildLocalities, type BaseRow, type LocalityEnrichment } from './_build';
import enrichment from './enrichment/greater-noida.json';

const rows: BaseRow[] = [
  // ---- greater-noida-west ----
  ['gaur-city', 'Gaur City', ['Gaur City 1', 'Gaur City 2'], 'greater-noida-west', ['201306'], 'very-high', 'township'],
  ['techzone', 'Techzone', ['Techzone 4'], 'greater-noida-west', ['201306'], 'very-high', 'township'],
  ['surajpur', 'Surajpur', [], 'greater-noida-west', ['201306'], 'high'],
  // ---- greater-noida-central ----
  ['alpha', 'Alpha', ['Alpha 1', 'Alpha 2', 'Alpha Greater Noida'], 'greater-noida-central', ['201310'], 'very-high', 'sector'],
  ['beta', 'Beta', ['Beta 1', 'Beta 2', 'Beta Greater Noida'], 'greater-noida-central', ['201310'], 'very-high', 'sector'],
  ['gamma', 'Gamma', ['Gamma 1', 'Gamma 2'], 'greater-noida-central', ['201310'], 'very-high', 'sector'],
  ['delta', 'Delta', ['Delta 1', 'Delta 2'], 'greater-noida-central', ['201310'], 'very-high', 'sector'],
  ['knowledge-park', 'Knowledge Park', ['Knowledge Park 1', 'Knowledge Park 2', 'Knowledge Park 3'], 'greater-noida-central', ['201310'], 'very-high'],
  ['pari-chowk', 'Pari Chowk', [], 'greater-noida-central', ['201310'], 'high'],
  ['jaypee-greens', 'Jaypee Greens', [], 'greater-noida-central', ['201310'], 'very-high', 'township'],
  ['kasna', 'Kasna', [], 'greater-noida-central', ['201310'], 'high'],
  ['dadri', 'Dadri', [], 'greater-noida-central', ['203207'], 'medium'],
];

export const GREATER_NOIDA_LOCALITIES: Locality[] = buildLocalities(
  'greater-noida',
  rows,
  enrichment as Record<string, LocalityEnrichment>,
);
