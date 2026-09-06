// data/seo/localities/delhi.ts — Delhi base rows (Appendix B.1, normalized per B.9).
// Notable normalizations: R.K. Puram [110022+110066], Vasant Kunj [110070+110072],
// Palam [110045+110061], Najafgarh [110043+110073], Rohini [110085/86/89],
// Okhla [110020+110025], Shahdara [110032+110095], Dwarka [110075+110078];
// 110029 split into safdarjung-enclave with green-park added at 110016 (B.9.5);
// slash rows split (New Friends Colony/Okhla, Rajouri Garden/Tagore Garden,
// Preet Vihar/Laxmi Nagar); Defence Colony added per B.9.6; 110004 & 110011 stay
// zone/city-level with no locality hub (B.9.7).
import type { Locality } from '../types';
import { buildLocalities, type BaseRow, type LocalityEnrichment } from './_build';
import enrichment from './enrichment/delhi.json';

const rows: BaseRow[] = [
  // ---- central-delhi ----
  ['connaught-place', 'Connaught Place', ['New Delhi', 'CP'], 'central-delhi', ['110001'], 'high'],
  ['lodi-road', 'Lodi Road', ['Lodhi Road'], 'central-delhi', ['110003'], 'high'],
  ['karol-bagh', 'Karol Bagh', [], 'central-delhi', ['110005'], 'high'],
  ['patel-nagar', 'Patel Nagar', [], 'central-delhi', ['110008'], 'high'],
  ['pusa', 'Pusa', [], 'central-delhi', ['110012'], 'high'],
  ['rajinder-nagar', 'Rajinder Nagar', [], 'central-delhi', ['110060'], 'medium'],
  ['daryaganj', 'Daryaganj', [], 'central-delhi', ['110002'], 'medium'],
  ['old-delhi', 'Old Delhi', ['Chandni Chowk'], 'central-delhi', ['110006'], 'medium'],
  ['paharganj', 'Paharganj', [], 'central-delhi', ['110055'], 'medium'],
  // ---- south-delhi ----
  ['nizamuddin', 'Nizamuddin', ['Hazrat Nizamuddin'], 'south-delhi', ['110013'], 'high'],
  ['jangpura', 'Jangpura', [], 'south-delhi', ['110014'], 'high'],
  ['hauz-khas', 'Hauz Khas', [], 'south-delhi', ['110016'], 'very-high'],
  ['green-park', 'Green Park', [], 'south-delhi', ['110016'], 'high'],
  ['safdarjung-enclave', 'Safdarjung Enclave', ['Green Park belt', 'AIIMS area'], 'south-delhi', ['110029'], 'high'],
  ['malviya-nagar', 'Malviya Nagar', [], 'south-delhi', ['110017'], 'high'],
  ['kalkaji', 'Kalkaji', [], 'south-delhi', ['110019'], 'high'],
  ['chanakyapuri', 'Chanakyapuri', ['Diplomatic Enclave'], 'south-delhi', ['110021'], 'very-high'],
  ['rk-puram', 'R.K. Puram', ['Rama Krishna Puram'], 'south-delhi', ['110022', '110066'], 'very-high'],
  ['lajpat-nagar', 'Lajpat Nagar', [], 'south-delhi', ['110024'], 'very-high'],
  ['defence-colony', 'Defence Colony', [], 'south-delhi', ['110024'], 'very-high'],
  ['new-friends-colony', 'New Friends Colony', ['NFC'], 'south-delhi', ['110025'], 'very-high'],
  ['okhla', 'Okhla', [], 'south-delhi', ['110020', '110025'], 'high'],
  ['mehrauli', 'Mehrauli', [], 'south-delhi', ['110030'], 'high'],
  ['greater-kailash', 'Greater Kailash', ['GK', 'GK 1', 'GK 2'], 'south-delhi', ['110048'], 'very-high'],
  ['andrews-ganj', 'Andrews Ganj', [], 'south-delhi', ['110049'], 'high'],
  ['vasant-vihar', 'Vasant Vihar', [], 'south-delhi', ['110057'], 'very-high'],
  ['pushp-vihar', 'Pushp Vihar', ['Madangir'], 'south-delhi', ['110062'], 'high'],
  ['east-of-kailash', 'East of Kailash', [], 'south-delhi', ['110065'], 'very-high'],
  ['munirka', 'Munirka', [], 'south-delhi', ['110067'], 'high'],
  ['saket', 'Saket', ['IGNOU belt'], 'south-delhi', ['110068'], 'very-high'],
  ['vasant-kunj', 'Vasant Kunj', [], 'south-delhi', ['110070', '110072'], 'very-high'],
  ['chhatarpur', 'Chhatarpur', [], 'south-delhi', ['110074'], 'high'],
  ['sarita-vihar', 'Sarita Vihar', [], 'south-delhi', ['110076'], 'high'],
  ['sangam-vihar', 'Sangam Vihar', [], 'south-delhi', ['110080'], 'high'],
  ['sarojini-nagar', 'Sarojini Nagar', [], 'south-delhi', ['110023'], 'medium'],
  ['badarpur', 'Badarpur', [], 'south-delhi', ['110044'], 'medium'],
  // ---- south-west-delhi ----
  ['dwarka', 'Dwarka', [], 'south-west-delhi', ['110075', '110078'], 'very-high'],
  ['delhi-cantt', 'Delhi Cantt', ['Delhi Cantonment'], 'south-west-delhi', ['110010'], 'medium'],
  ['mahipalpur', 'Mahipalpur', [], 'south-west-delhi', ['110037'], 'medium'],
  ['rajokari', 'Rajokari', [], 'south-west-delhi', ['110038'], 'medium'],
  ['najafgarh', 'Najafgarh', [], 'south-west-delhi', ['110043', '110073'], 'medium'],
  ['palam', 'Palam', [], 'south-west-delhi', ['110045', '110061'], 'medium'],
  ['nangal-raya', 'Nangal Raya', [], 'south-west-delhi', ['110046'], 'medium'],
  ['arjun-garh', 'Arjun Garh', ['Arjangarh'], 'south-west-delhi', ['110047'], 'medium'],
  ['chhawla', 'Chhawla', [], 'south-west-delhi', ['110071'], 'medium'],
  ['mahavir-enclave', 'Mahavir Enclave', [], 'south-west-delhi', ['110077'], 'medium'],
  // ---- west-delhi ----
  ['ramesh-nagar', 'Ramesh Nagar', [], 'west-delhi', ['110015'], 'high'],
  ['punjabi-bagh', 'Punjabi Bagh', [], 'west-delhi', ['110026'], 'high'],
  ['rajouri-garden', 'Rajouri Garden', [], 'west-delhi', ['110027'], 'high'],
  ['tagore-garden', 'Tagore Garden', [], 'west-delhi', ['110027'], 'high'],
  ['naraina', 'Naraina', [], 'west-delhi', ['110028'], 'high'],
  ['janakpuri', 'Janakpuri', [], 'west-delhi', ['110058'], 'high'],
  ['tilak-nagar', 'Tilak Nagar', [], 'west-delhi', ['110018'], 'medium'],
  ['nangloi', 'Nangloi', [], 'west-delhi', ['110041'], 'medium'],
  ['uttam-nagar', 'Uttam Nagar', [], 'west-delhi', ['110059'], 'medium'],
  ['paschim-vihar', 'Paschim Vihar', [], 'west-delhi', ['110063'], 'medium'],
  ['hari-nagar', 'Hari Nagar', [], 'west-delhi', ['110064'], 'medium'],
  // ---- north-delhi ----
  ['kamla-nagar', 'Kamla Nagar', ['North Delhi'], 'north-delhi', ['110007'], 'high'],
  ['model-town', 'Model Town', [], 'north-delhi', ['110009'], 'medium'],
  ['azadpur', 'Azadpur', [], 'north-delhi', ['110033'], 'medium'],
  ['civil-lines', 'Civil Lines', [], 'north-delhi', ['110054'], 'medium'],
  ['burari', 'Burari', [], 'north-delhi', ['110084'], 'medium'],
  // ---- north-west-delhi ----
  ['ashok-vihar', 'Ashok Vihar', [], 'north-west-delhi', ['110052'], 'high'],
  ['pitampura', 'Pitampura', [], 'north-west-delhi', ['110034'], 'medium'],
  ['shakurpur', 'Shakurpur', [], 'north-west-delhi', ['110035'], 'medium'],
  ['alipur', 'Alipur', [], 'north-west-delhi', ['110036'], 'medium'],
  ['bawana', 'Bawana', [], 'north-west-delhi', ['110039'], 'medium'],
  ['narela', 'Narela', [], 'north-west-delhi', ['110040'], 'medium'],
  ['samaypur-badli', 'Samaypur Badli', [], 'north-west-delhi', ['110042'], 'medium'],
  ['shakur-basti', 'Shakur Basti', [], 'north-west-delhi', ['110056'], 'medium'],
  ['kanjhawala', 'Kanjhawala', [], 'north-west-delhi', ['110081'], 'medium'],
  ['rohini', 'Rohini', [], 'north-west-delhi', ['110085', '110086', '110089'], 'medium'],
  ['shalimar-bagh', 'Shalimar Bagh', [], 'north-west-delhi', ['110088'], 'medium'],
  // ---- east-delhi ----
  ['mayur-vihar', 'Mayur Vihar', ['Mayur Vihar Phase 1', 'Mayur Vihar Phase 2'], 'east-delhi', ['110091'], 'high'],
  ['mayur-vihar-phase-3', 'Mayur Vihar Phase III', [], 'east-delhi', ['110096'], 'medium'],
  ['preet-vihar', 'Preet Vihar', [], 'east-delhi', ['110092'], 'high'],
  ['laxmi-nagar', 'Laxmi Nagar', [], 'east-delhi', ['110092'], 'high'],
  ['vasundhara-enclave', 'Vasundhara Enclave', [], 'east-delhi', ['110096'], 'high'],
  ['gandhi-nagar', 'Gandhi Nagar', [], 'east-delhi', ['110031'], 'medium'],
  // ---- north-east-delhi ----
  ['vivek-vihar', 'Vivek Vihar', [], 'north-east-delhi', ['110095'], 'high'],
  ['shahdara', 'Shahdara', [], 'north-east-delhi', ['110032', '110095'], 'medium'],
  ['bhajanpura', 'Bhajanpura', [], 'north-east-delhi', ['110053'], 'medium'],
  ['seelampur', 'Seelampur', [], 'north-east-delhi', ['110093'], 'medium'],
  ['karawal-nagar', 'Karawal Nagar', [], 'north-east-delhi', ['110094'], 'medium'],
];

export const DELHI_LOCALITIES: Locality[] = buildLocalities(
  'delhi',
  rows,
  enrichment as Record<string, LocalityEnrichment>,
);
