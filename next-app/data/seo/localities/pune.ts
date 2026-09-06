// data/seo/localities/pune.ts — Pune base rows incl. PCMC zone (Appendix B.6).
// Merges per B.9.2: Kothrud [411021+411038], Hadapsar [411013+411028],
// Pimpri [411017+411018+411034], Chinchwad [411019+411033], Kondhwa [411041+411048].
// 411048 "NIBM / Kondhwa" splits into nibm + kondhwa (B.9.4); 411008 "University area"
// → pune-university-area with alts Ganeshkhind/SPPU (B.9.5). Pimple Saudagar moved to
// the pcmc zone (it is in PCMC; keeps pcmc >= 3 localities — ASSUMPTIONS.md #18).
// Appendix C clusters raise Bavdhan and Hadapsar to very-high.
import type { Locality } from '../types';
import { buildLocalities, type BaseRow, type LocalityEnrichment } from './_build';
import enrichment from './enrichment/pune.json';

const rows: BaseRow[] = [
  // ---- pune-west ----
  ['aundh', 'Aundh', [], 'pune-west', ['411007'], 'very-high'],
  ['baner', 'Baner', [], 'pune-west', ['411045'], 'very-high'],
  ['balewadi', 'Balewadi', [], 'pune-west', ['411062'], 'very-high'],
  ['pashan', 'Pashan', [], 'pune-west', ['411061'], 'very-high'],
  ['sus', 'Sus', ['Sus Road'], 'pune-west', ['411060'], 'high'],
  ['bavdhan', 'Bavdhan', [], 'pune-west', ['411023'], 'very-high'],
  ['wakad', 'Wakad', [], 'pune-west', ['411058'], 'very-high'],
  ['hinjawadi', 'Hinjawadi', ['Hinjewadi'], 'pune-west', ['411057'], 'very-high'],
  // ---- pune-central ----
  ['pune-camp', 'Pune Camp', ['Camp', 'Pune Cantonment'], 'pune-central', ['411001'], 'high'],
  ['deccan', 'Deccan', [], 'pune-central', ['411004'], 'high'],
  ['deccan-gymkhana', 'Deccan Gymkhana', [], 'pune-central', ['411030'], 'high'],
  ['shivajinagar', 'Shivajinagar', [], 'pune-central', ['411005'], 'high'],
  ['pune-university-area', 'Pune University Area', ['Ganeshkhind', 'SPPU'], 'pune-central', ['411008'], 'high'],
  ['sadashiv-peth', 'Sadashiv Peth', [], 'pune-central', ['411011'], 'high'],
  ['kothrud', 'Kothrud', ['Paud Road'], 'pune-central', ['411021', '411038'], 'very-high'],
  ['karve-nagar', 'Karve Nagar', [], 'pune-central', ['411052'], 'very-high'],
  ['warje', 'Warje', [], 'pune-central', ['411024'], 'high'],
  ['anandnagar', 'Anandnagar', ['Anand Nagar'], 'pune-central', ['411051'], 'high'],
  // ---- pune-east ----
  ['kharadi', 'Kharadi', [], 'pune-east', ['411014'], 'very-high'],
  ['viman-nagar', 'Viman Nagar', [], 'pune-east', ['411022'], 'very-high'],
  ['hadapsar', 'Hadapsar', [], 'pune-east', ['411013', '411028'], 'very-high'],
  ['dhanori', 'Dhanori', [], 'pune-east', ['411036'], 'high'],
  ['lohegaon', 'Lohegaon', ['Lohgaon'], 'pune-east', ['411047'], 'high'],
  ['wanowrie', 'Wanowrie', ['Wanowrie Village', 'Wanwadi'], 'pune-east', ['411040'], 'high'],
  // ---- pune-south ----
  ['nibm', 'NIBM', ['NIBM Road'], 'pune-south', ['411048'], 'very-high'],
  ['kondhwa', 'Kondhwa', [], 'pune-south', ['411041', '411048'], 'very-high'],
  ['bibwewadi', 'Bibwewadi', [], 'pune-south', ['411043'], 'high'],
  ['katraj', 'Katraj', [], 'pune-south', ['411046'], 'high'],
  // ---- pcmc ----
  ['pimpri', 'Pimpri', ['Pimpri IT-residential belt'], 'pcmc', ['411017', '411018', '411034'], 'very-high'],
  ['chinchwad', 'Chinchwad', [], 'pcmc', ['411019', '411033'], 'high'],
  ['pimple-saudagar', 'Pimple Saudagar', [], 'pcmc', ['411027'], 'very-high'],
];

export const PUNE_LOCALITIES: Locality[] = buildLocalities(
  'pune',
  rows,
  enrichment as Record<string, LocalityEnrichment>,
);
