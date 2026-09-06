// data/seo/localities/mumbai.ts — Mumbai base rows incl. Navi Mumbai zone (Appendix B.5).
// Merges per B.9.2: Andheri East [400059+400093], Goregaon East [400063+400065],
// Dadar [400014+400028], Nerul [400703+400706]. Gaps added per B.9.6: Juhu 400049,
// Malad West 400064, Malad East 400097. Appendix C clusters raise Juhu, Malad and
// Kandivali (West) to very-high. "Fort / South Mumbai" → fort in zone south-mumbai.
import type { Locality } from '../types';
import { buildLocalities, type BaseRow, type LocalityEnrichment } from './_build';
import enrichment from './enrichment/mumbai.json';

const rows: BaseRow[] = [
  // ---- south-mumbai ----
  ['fort', 'Fort', ['South Mumbai'], 'south-mumbai', ['400001'], 'very-high'],
  ['colaba', 'Colaba', [], 'south-mumbai', ['400005'], 'very-high'],
  ['malabar-hill', 'Malabar Hill', [], 'south-mumbai', ['400006'], 'very-high'],
  ['worli', 'Worli', [], 'south-mumbai', ['400018'], 'very-high'],
  ['nariman-point', 'Nariman Point', [], 'south-mumbai', ['400021'], 'very-high'],
  ['prabhadevi', 'Prabhadevi', [], 'south-mumbai', ['400025'], 'very-high'],
  ['cumballa-hill', 'Cumballa Hill', ['Cumbala Hill'], 'south-mumbai', ['400026'], 'very-high'],
  ['tardeo', 'Tardeo', [], 'south-mumbai', ['400034'], 'very-high'],
  ['kalbadevi', 'Kalbadevi', [], 'south-mumbai', ['400002'], 'high'],
  ['girgaon', 'Girgaon', ['Girgaum'], 'south-mumbai', ['400004'], 'high'],
  ['grant-road', 'Grant Road', [], 'south-mumbai', ['400007'], 'high'],
  ['mumbai-central', 'Mumbai Central', [], 'south-mumbai', ['400008'], 'high'],
  ['mazgaon', 'Mazgaon', ['Mazagaon'], 'south-mumbai', ['400010'], 'high'],
  ['parel', 'Parel', ['Lower Parel'], 'south-mumbai', ['400012'], 'high'],
  ['sewri', 'Sewri', ['Sewree'], 'south-mumbai', ['400015'], 'high'],
  ['wadala', 'Wadala', [], 'south-mumbai', ['400031'], 'high'],
  ['antop-hill', 'Antop Hill', [], 'south-mumbai', ['400037'], 'high'],
  // ---- central-mumbai ----
  ['dadar', 'Dadar', ['Dadar West', 'Dadar East'], 'central-mumbai', ['400014', '400028'], 'high'],
  ['mahim', 'Mahim', [], 'central-mumbai', ['400016'], 'high'],
  ['matunga', 'Matunga', [], 'central-mumbai', ['400019'], 'high'],
  ['sion', 'Sion', [], 'central-mumbai', ['400022'], 'high'],
  ['kurla', 'Kurla', [], 'central-mumbai', ['400070'], 'high'],
  // ---- western-suburbs ----
  ['bandra-west', 'Bandra West', ['Bandra'], 'western-suburbs', ['400050'], 'very-high'],
  ['bandra-east', 'Bandra East', [], 'western-suburbs', ['400051'], 'very-high'],
  ['khar', 'Khar', ['Khar West'], 'western-suburbs', ['400052'], 'very-high'],
  ['santacruz-west', 'Santacruz West', ['Santacruz'], 'western-suburbs', ['400054'], 'very-high'],
  ['juhu', 'Juhu', [], 'western-suburbs', ['400049'], 'very-high'],
  ['vile-parle', 'Vile Parle', [], 'western-suburbs', ['400056'], 'very-high'],
  ['andheri', 'Andheri', [], 'western-suburbs', ['400058'], 'very-high'],
  ['andheri-west', 'Andheri West', [], 'western-suburbs', ['400053'], 'very-high'],
  ['andheri-east', 'Andheri East', [], 'western-suburbs', ['400059', '400093'], 'very-high'],
  ['versova', 'Versova', [], 'western-suburbs', ['400061'], 'very-high'],
  ['jogeshwari-east', 'Jogeshwari East', [], 'western-suburbs', ['400096'], 'high'],
  ['jogeshwari-west', 'Jogeshwari West', [], 'western-suburbs', ['400102'], 'high'],
  ['goregaon-east', 'Goregaon East', ['Goregaon'], 'western-suburbs', ['400063', '400065'], 'very-high'],
  ['goregaon-west', 'Goregaon West', [], 'western-suburbs', ['400104'], 'very-high'],
  ['malad-west', 'Malad West', ['Malad'], 'western-suburbs', ['400064'], 'very-high'],
  ['malad-east', 'Malad East', [], 'western-suburbs', ['400097'], 'very-high'],
  ['kandivali-east', 'Kandivali East', ['Kandivali'], 'western-suburbs', ['400101'], 'very-high'],
  ['kandivali-west', 'Kandivali West', [], 'western-suburbs', ['400067'], 'very-high'],
  ['dahisar', 'Dahisar', [], 'western-suburbs', ['400068'], 'high'],
  // ---- eastern-suburbs ----
  ['powai', 'Powai', [], 'eastern-suburbs', ['400076'], 'very-high'],
  ['ghatkopar', 'Ghatkopar', ['Ghatkopar West', 'Ghatkopar East'], 'eastern-suburbs', ['400086'], 'very-high'],
  ['chembur', 'Chembur', [], 'eastern-suburbs', ['400088'], 'very-high'],
  ['vikhroli', 'Vikhroli', [], 'eastern-suburbs', ['400078'], 'high'],
  ['bhandup', 'Bhandup', [], 'eastern-suburbs', ['400083'], 'high'],
  ['mulund', 'Mulund', ['Mulund West'], 'eastern-suburbs', ['400080'], 'high'],
  ['mulund-east', 'Mulund East', [], 'eastern-suburbs', ['400081'], 'high'],
  // ---- navi-mumbai ----
  ['vashi', 'Vashi', [], 'navi-mumbai', ['400701'], 'high'],
  ['nerul', 'Nerul', [], 'navi-mumbai', ['400703', '400706'], 'high'],
  ['sanpada', 'Sanpada', [], 'navi-mumbai', ['400705'], 'high'],
  ['airoli', 'Airoli', [], 'navi-mumbai', ['400708'], 'high'],
];

export const MUMBAI_LOCALITIES: Locality[] = buildLocalities(
  'mumbai',
  rows,
  enrichment as Record<string, LocalityEnrichment>,
);
