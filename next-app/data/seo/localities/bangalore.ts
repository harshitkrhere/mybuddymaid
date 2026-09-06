// data/seo/localities/bangalore.ts — Bangalore base rows (Appendix B.7).
// Merges per B.9.2: Indiranagar [560008+560038], Koramangala [560029+560034+560095],
// Whitefield [560049+560066], Banashankari [560050+560085], Bannerghatta Road
// [560076+560083]. Sarjapur Road added per B.9.6 (560035). 560001 "Central Bangalore"
// stays a zone-level pin on bangalore-central (B.9.5). Fraser Town moved to
// bangalore-north and Malleswaram to bangalore-west so both zones keep >= 3
// localities (ASSUMPTIONS.md #18). Appendix C raises Jayanagar and Domlur to very-high.
import type { Locality } from '../types';
import { buildLocalities, type BaseRow, type LocalityEnrichment } from './_build';
import enrichment from './enrichment/bangalore.json';

const rows: BaseRow[] = [
  // ---- bangalore-east ----
  ['whitefield', 'Whitefield', [], 'bangalore-east', ['560049', '560066'], 'very-high'],
  ['marathahalli', 'Marathahalli', [], 'bangalore-east', ['560037'], 'very-high'],
  ['hoodi', 'Hoodi', [], 'bangalore-east', ['560048'], 'high'],
  ['ramamurthy-nagar', 'Ramamurthy Nagar', ['Ramamurthi Nagar'], 'bangalore-east', ['560016'], 'high'],
  // ---- bangalore-south-east ----
  ['koramangala', 'Koramangala', [], 'bangalore-south-east', ['560029', '560034', '560095'], 'very-high'],
  ['hsr-layout', 'HSR Layout', ['HSR'], 'bangalore-south-east', ['560102'], 'very-high'],
  ['bellandur', 'Bellandur', [], 'bangalore-south-east', ['560103'], 'very-high'],
  ['sarjapur-road', 'Sarjapur Road', ['Sarjapura Road'], 'bangalore-south-east', ['560035'], 'very-high', 'road'],
  ['bommanahalli', 'Bommanahalli', [], 'bangalore-south-east', ['560068'], 'very-high'],
  ['electronic-city', 'Electronic City', ['E-City'], 'bangalore-south-east', ['560100'], 'very-high'],
  ['begur', 'Begur', [], 'bangalore-south-east', ['560114'], 'high'],
  // ---- bangalore-south ----
  ['jp-nagar', 'JP Nagar', ['J.P. Nagar'], 'bangalore-south', ['560078'], 'very-high'],
  ['jayanagar', 'Jayanagar', [], 'bangalore-south', ['560011'], 'very-high'],
  ['bannerghatta-road', 'Bannerghatta Road', ['Bannerghatta'], 'bangalore-south', ['560076', '560083'], 'very-high', 'road'],
  ['banashankari', 'Banashankari', [], 'bangalore-south', ['560050', '560085'], 'high'],
  ['basavanagudi', 'Basavanagudi', [], 'bangalore-south', ['560004'], 'high'],
  ['wilson-garden', 'Wilson Garden', [], 'bangalore-south', ['560027'], 'high'],
  ['adugodi', 'Adugodi', [], 'bangalore-south', ['560030'], 'high'],
  // ---- bangalore-central ----
  ['vasanth-nagar', 'Vasanth Nagar', ['Vasanthnagar'], 'bangalore-central', ['560003'], 'high'],
  ['richmond-town', 'Richmond Town', [], 'bangalore-central', ['560025'], 'high'],
  ['domlur', 'Domlur', [], 'bangalore-central', ['560017'], 'very-high'],
  ['indiranagar', 'Indiranagar', ['Indira Nagar'], 'bangalore-central', ['560008', '560038'], 'very-high'],
  ['viveknagar', 'Viveknagar', ['Vivek Nagar'], 'bangalore-central', ['560047'], 'high'],
  ['chickpet', 'Chickpet', ['Chickpete'], 'bangalore-central', ['560053'], 'high'],
  ['seshadripuram', 'Seshadripuram', [], 'bangalore-central', ['560020'], 'high'],
  // ---- bangalore-north ----
  ['kalyan-nagar', 'Kalyan Nagar', [], 'bangalore-north', ['560043'], 'high'],
  ['nagawara', 'Nagawara', [], 'bangalore-north', ['560045'], 'high'],
  ['fraser-town', 'Fraser Town', ['Frazer Town', 'Pulikeshi Nagar'], 'bangalore-north', ['560005'], 'high'],
  // ---- bangalore-west ----
  ['rajajinagar', 'Rajajinagar', [], 'bangalore-west', ['560010'], 'high'],
  ['vijayanagar', 'Vijayanagar', [], 'bangalore-west', ['560040'], 'high'],
  ['malleswaram', 'Malleswaram', ['Malleshwaram'], 'bangalore-west', ['560022'], 'high'],
];

export const BANGALORE_LOCALITIES: Locality[] = buildLocalities(
  'bangalore',
  rows,
  enrichment as Record<string, LocalityEnrichment>,
);
