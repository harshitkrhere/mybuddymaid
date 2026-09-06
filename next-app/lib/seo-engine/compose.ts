// lib/seo-engine/compose.ts — composes every SEO page from the data layer.
// Data-first: two localities with different data produce different pages by
// construction (brief §6.3). The same models feed the React routes AND the quality
// gate (scripts/seo/uniqueness.ts), so what is measured is exactly what is rendered.
import type { City, FAQ, Locality, PincodeRecord, Service, Zone } from '@/data/seo/types';
import {
  ALL_LOCALITIES,
  CITIES,
  CITY_BY_SLUG,
  LOCALITY_BY_PATH,
  PINCODES,
  PINCODE_BY_PIN,
  SERVICES,
  ZONES,
  ZONES_BY_CITY,
  LOCALITIES_BY_CITY,
  GLOBAL_FAQS,
  getNearby,
} from '@/data/seo';
import { ENTITIES_BY_LOCALITY } from '@/data/seo/entities';
import { cityFaqs, localityFaqs, serviceCityFaqs, serviceHubFaqs, serviceLocalityFaqs, zoneFaqs } from './faqs';
import { paths } from './links';
import {
  cityMeta,
  homeMeta,
  localityMeta,
  maidServiceHubMeta,
  pincodeMeta,
  serviceCityMeta,
  serviceHubMeta,
  serviceLocalityMeta,
  zoneMeta,
  type PageMeta,
} from './meta';
import { breadcrumbLd, faqLd, serviceLd } from './jsonld';

export const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN').format(n)}`;

export interface Crumb {
  name: string;
  path: string;
}
export interface TextSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}
export interface ServiceCard {
  service: Service;
  path: string;
  from: number;
  blurb: string;
}
export interface PricingRow {
  service: Service;
  from: number;
  to: number;
  unit: string;
  path?: string;
}
export interface LinkItem {
  name: string;
  path: string;
  anchor: string;
}

export type PageType =
  | 'home'
  | 'city'
  | 'zone'
  | 'locality'
  | 'service-locality'
  | 'entity'
  | 'service-city'
  | 'service-hub'
  | 'pincode';

export interface PageModel {
  type: PageType;
  path: string;
  meta: PageMeta;
  crumbs: Crumb[];
  hero: { h1: string; tagline: string; badges: string[] };
  sections: TextSection[];
  serviceCards: ServiceCard[];
  pricing: { rows: PricingRow[]; factors: string[]; note: string } | null;
  faqs: FAQ[];
  nearby: LinkItem[];
  related: LinkItem[];
  jsonld: unknown[];
  /** Tokens that make this page unique (name/alt names/pincodes/neighbours/landmarks…). */
  localTokens: string[];
  /** Sections whose absence makes the page noindex (Appendix E). */
  missingRequired: string[];
  wordFloor: number;
  localRatioFloor: number;
  updatedAt: string;
  cta: { whatsappText: string; city: string; zone?: string; locality?: string; service?: string; pincode?: string };
  /** All main-content text, for the uniqueness gate. */
  mainText: string;
}

const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;

/**
 * Drops sentences a drafter marked `[VERIFY]` instead of publishing an unconfirmed
 * claim. The claim is withheld, never asserted, and the locality is listed for operator
 * review in docs/seo/quality-report.md (see ASSUMPTIONS.md #15).
 */
export function dropUnverified(text: string): string {
  if (!text || !text.includes('[VERIFY]')) return text;
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !sentence.includes('[VERIFY]'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when any drafted prose on this locality still carries a [VERIFY] marker. */
export function hasUnverified(loc: Locality): boolean {
  return [loc.localIntro, loc.commuteNotes, loc.housingNotes, ...loc.localFaqs.map((f) => f.a)].some((t) =>
    (t ?? '').includes('[VERIFY]'),
  );
}

/** FAQ list with any `[VERIFY]` sentences removed from the answers. */
export function cleanFaqs(faqs: FAQ[]): FAQ[] {
  return faqs
    .map((f) => (f.a.includes('[VERIFY]') ? { ...f, a: dropUnverified(f.a) } : f))
    .filter((f) => f.a.length > 30);
}
export const PRICE_FACTORS = [
  'Hours per day and days per week',
  'Tasks included (cooking, laundry, childcare add-ons)',
  'Household size and home size',
];
export const PRICE_NOTE =
  'Indicative monthly bands, not quotes. The exact salary is agreed with the helper after the interview.';

export function tierRows(city: City): PricingRow[] {
  return SERVICES.map((s) => ({ service: s, ...s.pricing[city.pricingTier], path: paths.serviceHub(s.slug) }));
}

export function joinNames(names: string[], max = 3): string {
  const n = names.slice(0, max);
  if (n.length <= 1) return n.join('');
  return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}

function collectText(m: Omit<PageModel, 'mainText'>): string {
  const parts: string[] = [m.hero.h1, m.hero.tagline];
  for (const s of m.sections) parts.push(s.heading, ...s.paragraphs, ...(s.bullets ?? []));
  for (const c of m.serviceCards) parts.push(`${c.service.name} in ${c.blurb}`);
  if (m.pricing) parts.push(...m.pricing.rows.map((r) => `${r.service.name} from ${inr(r.from)} to ${inr(r.to)} per ${r.unit}`), ...m.pricing.factors, m.pricing.note);
  for (const f of m.faqs) parts.push(f.q, f.a);
  parts.push(...m.nearby.map((n) => n.anchor));
  return parts.join('\n');
}

const finish = (m: Omit<PageModel, 'mainText'>): PageModel => ({ ...m, mainText: collectText(m) });

// ---------------------------------------------------------------------------
// Locality hub — the "Maid Service in {Locality}" flagship page
// ---------------------------------------------------------------------------
export function composeLocality(loc: Locality): PageModel {
  const city = CITY_BY_SLUG.get(loc.city)!;
  const zone = ZONES.find((z) => z.city === loc.city && z.slug === loc.zone)!;
  const meta = localityMeta(loc, city);
  const nearbyLocs = getNearby(loc.city, loc.slug, 10);
  const nearbyNames = nearbyLocs.map((n) => n.name);
  const pins = loc.pincodes.join(', ');
  const key = `${loc.city}/${loc.slug}`;
  const missing: string[] = [];
  if (wc(loc.localIntro) < 120) missing.push('localIntro (120–200 words)');
  if (loc.neighbours.length < 4) missing.push('neighbours (>=4)');
  if (loc.localFaqs.length < 3) missing.push('localFaqs (3)');
  if (!loc.landmarks.length) missing.push('landmarks');

  const sections: TextSection[] = [];
  const introText = dropUnverified(loc.localIntro);
  sections.push({ id: 'intro', heading: `About maid service in ${loc.name}`, paragraphs: introText ? introText.split(/\n\n+/) : [] });
  const coverage: string[] = [
    `We place helpers across ${loc.name} (pincode${loc.pincodes.length > 1 ? 's' : ''} ${pins}) in the ${zone.name} belt of ${city.name}.`,
  ];
  if (loc.landmarks.length) coverage.push(`Landmarks our helpers use as reference points here include ${joinNames(loc.landmarks, 4)}.`);
  const commute = dropUnverified(loc.commuteNotes);
  if (commute) coverage.push(commute);
  sections.push({ id: 'coverage', heading: `Areas and pincodes covered in ${loc.name}`, paragraphs: coverage, bullets: loc.altNames.length ? [`Also known as: ${loc.altNames.join(', ')}`] : undefined });

  const comparison = fullVsPartTime(loc, nearbyNames);
  sections.push({ id: 'comparison', heading: `Full-time vs part-time maid in ${loc.name}`, paragraphs: comparison });
  const housingText = dropUnverified(loc.housingNotes);
  if (housingText) sections.push({ id: 'housing', heading: `Homes and helpers in ${loc.name}`, paragraphs: [housingText] });
  sections.push(...trustSections(loc.name));

  const serviceCards: ServiceCard[] = SERVICES.map((s) => ({
    service: s,
    path: paths.serviceLocality(loc.city, loc.slug, s.slug),
    from: s.pricing[city.pricingTier].from,
    blurb: `${loc.name} — ${s.shortDescription}`,
  }));
  const faqs = cleanFaqs(localityFaqs(loc));
  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: city.name, path: paths.city(city.slug) },
    { name: zone.name, path: paths.zone(city.slug, zone.slug) },
    { name: loc.name, path: meta.canonicalPath },
  ];
  const nearby: LinkItem[] = nearbyLocs.map((n) => ({ name: n.name, path: paths.locality(n.city, n.slug), anchor: `maid service in ${n.name}` }));
  const jsonld = [
    breadcrumbLd(crumbs),
    serviceLd({
      name: `Maid Service in ${loc.name}, ${city.name}`,
      serviceType: 'Domestic help placement',
      description: meta.description,
      path: meta.canonicalPath,
      city,
      pincodes: loc.pincodes,
      band: SERVICES.find((s) => s.slug === 'part-time-maid')!.pricing[city.pricingTier],
      services: SERVICES,
    }),
    faqLd(faqs),
  ];
  const localTokens = [loc.name, ...loc.altNames, ...loc.pincodes, ...nearbyNames, ...loc.landmarks, zone.name, ...loc.helperSourceAreas];
  return finish({
    type: 'locality',
    path: meta.canonicalPath,
    meta,
    crumbs,
    hero: {
      h1: meta.h1,
      tagline: `Verified, background-checked maids, cooks and nannies for homes in ${loc.name} (${pins}) — with a replacement policy.`,
      badges: ['Verified helpers', 'Replacement policy', 'Book on WhatsApp'],
    },
    sections,
    serviceCards,
    pricing: { rows: tierRows(city).map((r) => ({ ...r, path: paths.serviceLocality(loc.city, loc.slug, r.service.slug) })), factors: PRICE_FACTORS, note: PRICE_NOTE },
    faqs,
    nearby,
    related: [
      // Phase 5 entity pages hang off their parent locality; without these links they
      // would be orphans and seo:crawl would fail.
      ...(ENTITIES_BY_LOCALITY.get(key) ?? []).map((e) => ({
        name: e.name,
        path: `/${e.city}/${e.locality}/${e.slug}`,
        anchor: `maid service in ${e.name}`,
      })),
      { name: zone.name, path: paths.zone(city.slug, zone.slug), anchor: `all areas in ${zone.name}` },
      { name: city.name, path: paths.city(city.slug), anchor: `maid service in ${city.name}` },
      // pincode pages exist only for pins shared by 2+ localities; link the ones this
      // locality sits in so they are never orphans
      ...loc.pincodes
        .filter((pin) => (PINCODE_BY_PIN.get(pin)?.localities.length ?? 0) >= 2)
        .map((pin) => ({ name: pin, path: paths.pincode(pin), anchor: `maid service in ${pin}` })),
    ],
    jsonld,
    localTokens,
    missingRequired: missing,
    wordFloor: 700,
    localRatioFloor: 0.5,
    updatedAt: loc.updatedAt,
    cta: { whatsappText: `Hi MyBuddyMaid, I need a maid in ${loc.name}, ${city.name} (${loc.pincodes[0]}).`, city: city.slug, zone: zone.slug, locality: loc.slug, pincode: loc.pincodes[0] },
  });
}

function fullVsPartTime(loc: Locality, nearby: string[]): string[] {
  const nb = nearby[0] ? ` Most helpers serving ${loc.name} also cover ${joinNames(nearby, 2)}, so slots can be combined across neighbouring homes.` : '';
  switch (loc.housingProfile) {
    case 'gated-societies':
      return [
        `${loc.name} is dominated by gated societies, where part-time maids on fixed morning or evening slots are the norm: the society gate registers each helper, and a 1–4 hour daily visit for sweeping-mopping, utensils and laundry fits most apartments.${nb}`,
        `Full-time and live-in helpers are common in larger apartments and for households with young children or elderly members; these societies usually require a helper ID card and an entry pass, which we help arrange before day one.`,
      ];
    case 'independent-houses':
      return [
        `Homes in ${loc.name} are largely independent houses and bungalows, where full-time or live-in help — 8–12 hours a day covering cleaning, utensils, laundry and often cooking — is the usual arrangement and separate staff quarters are common.${nb}`,
        `Part-time maids are still widely used here for a fixed daily slot, especially by smaller households; because there is no society gate, timings are flexible and helpers can start earlier than in gated complexes.`,
      ];
    case 'builder-floors':
      return [
        `${loc.name} is mostly builder floors and low-rise apartments, so part-time maids covering two or three homes in the same building or lane on consecutive slots are typical, with no society gate or entry pass involved.${nb}`,
        `Full-time help suits families who need cooking alongside cleaning; live-in is less common because builder floors rarely have separate helper rooms.`,
      ];
    default:
      return [
        `${loc.name} mixes apartment blocks with independent homes, so both arrangements are common: part-time maids on fixed daily slots for apartments, and full-time or live-in helpers for larger homes and families with children or elderly parents.${nb}`,
        `Where a society gate is involved we arrange the helper's ID and entry pass before the first day; in independent homes timings are more flexible.`,
      ];
  }
}

/** Access and timing prose from the locality's housing profile, landmarks and commute notes. */
function accessParagraphs(svc: Service, loc: Locality, zone: Zone): string[] {
  const out: string[] = [];
  const access: Record<Locality['housingProfile'], string> = {
    'gated-societies': `${loc.name} is built around gated societies, so a ${svc.name.toLowerCase()} placed here is registered at the society gate and issued an entry pass before the first day. We start that paperwork as soon as you confirm the helper, because in ${loc.name} it is usually the step that decides whether work begins this week or next.`,
    'independent-houses': `${loc.name} is mostly independent houses, so there is no society gate between your ${svc.name.toLowerCase()} and your door. Timings are agreed directly with you, which makes early-morning and late-evening slots easier to arrange in ${loc.name} than in tower complexes.`,
    'builder-floors': `${loc.name} is largely builder floors and low-rise blocks, so a ${svc.name.toLowerCase()} here typically walks between homes on the same lane rather than passing a central gate. Stair access and the absence of a service lift are worth mentioning when you describe your floor in ${loc.name}.`,
    mixed: `${loc.name} mixes apartment blocks with independent homes, so access depends on your building: societies in ${loc.name} register the helper at the gate, while independent homes agree timings directly with you.`,
  };
  out.push(access[loc.housingProfile]);
  const housingText = dropUnverified(loc.housingNotes);
  if (housingText) out.push(housingText);
  const commute = dropUnverified(loc.commuteNotes);
  if (commute) out.push(commute);
  if (loc.landmarks.length) {
    out.push(
      `Helpers navigate ${loc.name} by its landmarks — ${joinNames(loc.landmarks, 3)} — so quoting the nearest one alongside your address in ${loc.pincodes[0]} usually gets the first visit right.`,
    );
  }
  out.push(
    `${loc.name} sits in the ${zone.name} belt, and slots here are planned around that area's travel times rather than city-wide averages.`,
  );
  return out;
}

/** Where helpers come from, and which nearby areas the same helpers cover. */
function helperTravelParagraphs(loc: Locality, nearby: string[]): string[] {
  const out: string[] = [];
  if (loc.helperSourceAreas.length) {
    out.push(
      `Most helpers working in ${loc.name} travel in from ${joinNames(loc.helperSourceAreas, 3)}, which is why morning slots in ${loc.name} fill up earlier than afternoon ones.`,
    );
  } else {
    out.push(
      `Helpers serving ${loc.name} generally live in the surrounding neighbourhoods rather than commuting across the city, which keeps timings in ${loc.name} predictable.`,
    );
  }
  if (nearby.length >= 3) {
    out.push(
      `The same helpers usually cover ${joinNames(nearby, 4)} as well, so if a slot in ${loc.name} is taken we can often place someone already working a few minutes away.`,
    );
  }
  const demand = loc.demandProfile
    .map(
      (d) =>
        ({
          'working-professionals': 'working professionals',
          families: 'families with children',
          elderly: 'senior citizens at home',
          students: 'students in shared flats',
        })[d],
    )
    .filter(Boolean) as string[];
  if (demand.length) {
    out.push(`Demand in ${loc.name} comes mainly from ${joinNames(demand, 3)}, and that shapes which timings are hardest to book here.`);
  }
  return out;
}

export function trustSections(placeName: string): TextSection[] {
  return [
    {
      id: 'verify',
      heading: `How we verify helpers placed in ${placeName}`,
      paragraphs: [
        `Every helper we place in ${placeName} goes through identity and address document checks and a background verification before an interview is arranged. Our full process is described on the how-we-verify page.`,
      ],
    },
    {
      id: 'replacement',
      heading: `Replacement policy for ${placeName} placements`,
      paragraphs: [
        `If a helper placed in ${placeName} does not work out, our replacement policy covers a replacement within the plan you choose. The exact terms are on the replacement-policy page.`,
      ],
    },
    {
      id: 'how-it-works',
      heading: `How booking works in ${placeName}`,
      paragraphs: [],
      bullets: [
        `Tell us your requirement on WhatsApp or the app — service, hours, and your address in ${placeName}.`,
        `We shortlist verified helpers who already travel to ${placeName} and arrange interviews with you.`,
        `Confirm your helper and start in ${placeName}; replacement support stays available under your plan.`,
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Service × locality — the money pages
// ---------------------------------------------------------------------------
export function composeServiceLocality(svc: Service, loc: Locality): PageModel {
  const city = CITY_BY_SLUG.get(loc.city)!;
  const zone = ZONES.find((z) => z.city === loc.city && z.slug === loc.zone)!;
  const meta = serviceLocalityMeta(svc, loc, city);
  const nearbyLocs = getNearby(loc.city, loc.slug, 10);
  const nearbyNames = nearbyLocs.map((n) => n.name);
  const pins = loc.pincodes.join(', ');
  const band = svc.pricing[city.pricingTier];
  const missing: string[] = [];
  if (wc(loc.localIntro) < 120) missing.push('locality intro data');
  if (loc.neighbours.length < 4) missing.push('neighbours (>=4)');
  if (loc.localFaqs.length < 3) missing.push('localFaqs (3)');

  const intro = serviceLocalityIntro(svc, loc, city, zone, nearbyNames);
  const sections: TextSection[] = [
    { id: 'intro', heading: `${svc.name} for homes in ${loc.name}`, paragraphs: intro },
    {
      id: 'access',
      heading: `Timings and access for a ${svc.name.toLowerCase()} in ${loc.name}`,
      paragraphs: accessParagraphs(svc, loc, zone),
    },
    {
      id: 'helpers',
      heading: `Where helpers serving ${loc.name} travel from`,
      paragraphs: helperTravelParagraphs(loc, nearbyNames),
    },
    { id: 'included', heading: `What a ${svc.name.toLowerCase()} in ${loc.name} does`, paragraphs: [], bullets: svc.tasksIncluded },
    { id: 'excluded', heading: 'Not included (ask us for add-ons)', paragraphs: [], bullets: svc.tasksExcluded },
    {
      id: 'modes',
      heading: `Modes and typical hours in ${loc.name}`,
      paragraphs: [
        `Available as ${svc.modes.join(', ')} in ${loc.name}. Typical hours: ${svc.typicalHours}.`,
        `Households across ${loc.pincodes.join(' and ')} book these slots, and the same helper often covers more than one home in ${loc.name}, so an agreed start time matters more here than a flexible one.`,
      ],
    },
    ...trustSections(loc.name),
  ];
  const faqs = cleanFaqs(serviceLocalityFaqs(svc, loc));
  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: city.name, path: paths.city(city.slug) },
    { name: zone.name, path: paths.zone(city.slug, zone.slug) },
    { name: loc.name, path: paths.locality(loc.city, loc.slug) },
    { name: svc.name, path: meta.canonicalPath },
  ];
  const nearby: LinkItem[] = nearbyLocs.map((n) => ({
    name: n.name,
    path: paths.serviceLocality(n.city, n.slug, svc.slug),
    anchor: `${svc.name.toLowerCase()} in ${n.name}`,
  }));
  const related: LinkItem[] = SERVICES.filter((s) => s.slug !== svc.slug).map((s) => ({
    name: s.name,
    path: paths.serviceLocality(loc.city, loc.slug, s.slug),
    anchor: `${s.name.toLowerCase()} in ${loc.name}`,
  }));
  const jsonld = [
    breadcrumbLd(crumbs),
    serviceLd({ name: `${svc.name} in ${loc.name}, ${city.name}`, serviceType: svc.name, description: meta.description, path: meta.canonicalPath, city, pincodes: loc.pincodes, band }),
    faqLd(faqs),
  ];
  return finish({
    type: 'service-locality',
    path: meta.canonicalPath,
    meta,
    crumbs,
    hero: {
      h1: meta.h1,
      tagline: `${svc.shortDescription} Verified helpers for ${loc.name} (${pins}), with a replacement policy.`,
      badges: ['Verified helpers', 'Replacement policy', `From ${inr(band.from)}/month`],
    },
    sections,
    serviceCards: [],
    pricing: { rows: [{ service: svc, ...band }], factors: PRICE_FACTORS, note: PRICE_NOTE },
    faqs,
    nearby,
    related,
    jsonld,
    localTokens: [loc.name, ...loc.altNames, ...loc.pincodes, ...nearbyNames, ...loc.landmarks, zone.name, ...loc.helperSourceAreas],
    missingRequired: missing,
    wordFloor: 450,
    localRatioFloor: 0.5,
    updatedAt: loc.updatedAt > svc.updatedAt ? loc.updatedAt : svc.updatedAt,
    cta: { whatsappText: `Hi MyBuddyMaid, I need a ${svc.name.toLowerCase()} in ${loc.name}, ${city.name} (${loc.pincodes[0]}).`, city: city.slug, zone: zone.slug, locality: loc.slug, service: svc.slug, pincode: loc.pincodes[0] },
  });
}

function serviceLocalityIntro(svc: Service, loc: Locality, city: City, zone: Zone, nearby: string[]): string[] {
  const housing: Record<Locality['housingProfile'], string> = {
    'gated-societies': `gated societies with registered helper entry`,
    'independent-houses': `independent houses and bungalows with flexible timings`,
    'builder-floors': `builder floors and low-rise blocks without society gates`,
    mixed: `a mix of apartment blocks and independent homes`,
  };
  const demand = loc.demandProfile
    .map((d) => ({ 'working-professionals': 'working professionals', families: 'families with children', elderly: 'senior citizens', students: 'students and shared homes' })[d])
    .join(', ');
  const p1 = `Households in ${loc.name} (${loc.pincodes.join(', ')}), in ${city.name}'s ${zone.name} belt, are mostly ${housing[loc.housingProfile]}, with demand led by ${demand}. That shapes how a ${svc.name.toLowerCase()} is placed here: ${svc.modes.includes('part-time') ? 'fixed daily slots are the most requested arrangement' : 'full-day or live-in arrangements are the most requested'}, with ${svc.typicalHours.toLowerCase()}.`;
  const src = loc.helperSourceAreas.length ? ` Helpers serving ${loc.name} typically travel from ${joinNames(loc.helperSourceAreas, 3)}.` : '';
  const lm = loc.landmarks.length ? ` Placements are arranged relative to ${joinNames(loc.landmarks, 2)} so travel time is predictable.` : '';
  const p2 = `The same helpers usually cover ${joinNames(nearby, 3)}, which keeps timings reliable across the area.${src}${lm}`;
  return [p1, p2];
}

// ---------------------------------------------------------------------------
// Zone hub
// ---------------------------------------------------------------------------
export function composeZone(zone: Zone): PageModel {
  const city = CITY_BY_SLUG.get(zone.city)!;
  const meta = zoneMeta(zone, city);
  const locs = zone.localities.map((s) => LOCALITY_BY_PATH.get(`${zone.city}/${s}`)!).filter(Boolean);
  const missing: string[] = [];
  if (wc(zone.intro) < 150) missing.push('zone intro (150+ words)');
  if (locs.length < 3) missing.push('localities (>=3)');
  const pins = Array.from(new Set(locs.flatMap((l) => l.pincodes))).sort();
  const sections: TextSection[] = [
    { id: 'intro', heading: `About ${zone.name}`, paragraphs: zone.intro ? zone.intro.split(/\n\n+/) : [] },
    {
      id: 'localities',
      heading: `Localities we serve in ${zone.name}`,
      paragraphs: [`${locs.length} locality hubs across pincodes ${pins.slice(0, 8).join(', ')}${pins.length > 8 ? ' and more' : ''}.`],
      bullets: locs.map((l) => `${l.name} (${l.pincodes.join(', ')})`),
    },
    {
      id: 'services',
      heading: `Services across ${zone.name}`,
      paragraphs: [`Every locality hub in ${zone.name} has its own pages for ${SERVICES.map((s) => s.name.toLowerCase()).join(', ')}; the city-level service pages below cover all of ${city.name}.`],
    },
    ...trustSections(zone.name),
  ];
  const faqs = zoneFaqs(zone.slug, zone.city);
  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: city.name, path: paths.city(city.slug) },
    { name: zone.name, path: meta.canonicalPath },
  ];
  const nearby: LinkItem[] = locs.map((l) => ({ name: l.name, path: paths.locality(l.city, l.slug), anchor: `maid service in ${l.name}` }));
  const adjacent = (ZONES_BY_CITY.get(zone.city) ?? []).filter((z) => z.slug !== zone.slug);
  const related: LinkItem[] = [
    ...SERVICES.map((s) => ({ name: s.name, path: paths.serviceCity(s.slug, city.slug), anchor: `${s.name.toLowerCase()} in ${city.name}` })),
    ...adjacent.map((z) => ({ name: z.name, path: paths.zone(z.city, z.slug), anchor: `maid service in ${z.name}` })),
  ];
  const jsonld = [
    breadcrumbLd(crumbs),
    serviceLd({ name: `Maid Service in ${zone.name}, ${city.name}`, serviceType: 'Domestic help placement', description: meta.description, path: meta.canonicalPath, city, pincodes: pins.slice(0, 20), band: SERVICES[1].pricing[city.pricingTier], services: SERVICES }),
    faqLd(faqs),
  ];
  return finish({
    type: 'zone',
    path: meta.canonicalPath,
    meta,
    crumbs,
    hero: { h1: meta.h1, tagline: `Verified maids, cooks and nannies across ${locs.length} localities of ${zone.name}, ${city.name}.`, badges: ['Verified helpers', 'Replacement policy', `${locs.length} localities`] },
    sections,
    serviceCards: [],
    pricing: { rows: tierRows(city), factors: PRICE_FACTORS, note: PRICE_NOTE },
    faqs,
    nearby,
    related,
    jsonld,
    localTokens: [zone.name, ...zone.altNames, ...locs.map((l) => l.name), ...pins],
    missingRequired: missing,
    wordFloor: 600,
    localRatioFloor: 0.35,
    updatedAt: zone.updatedAt,
    cta: { whatsappText: `Hi MyBuddyMaid, I need a maid in ${zone.name}, ${city.name}.`, city: city.slug, zone: zone.slug },
  });
}

// ---------------------------------------------------------------------------
// City hub
// ---------------------------------------------------------------------------
export function composeCity(city: City): PageModel {
  const meta = cityMeta(city);
  const zones = ZONES_BY_CITY.get(city.slug) ?? [];
  const locs = LOCALITIES_BY_CITY.get(city.slug) ?? [];
  const heroes = city.heroLocalities.map((s) => LOCALITY_BY_PATH.get(`${city.slug}/${s}`)!).filter(Boolean);
  const missing: string[] = [];
  if (wc(city.intro) < 200) missing.push('city intro (200+ words)');
  const sections: TextSection[] = [
    { id: 'intro', heading: `Maid service across ${city.name}`, paragraphs: city.intro ? city.intro.split(/\n\n+/) : [] },
    { id: 'zones', heading: `Zones we cover in ${city.name}`, paragraphs: [`${zones.length} zones, ${locs.length} locality hubs.`], bullets: zones.map((z) => `${z.name} — ${z.localities.length} localities`) },
    { id: 'hero', heading: `Most requested areas in ${city.name}`, paragraphs: [], bullets: heroes.map((h) => `${h.name} (${h.pincodes.join(', ')})`) },
    ...trustSections(city.name),
    {
      id: 'pincodes',
      heading: `Pincodes we serve in ${city.name}`,
      paragraphs: [
        `We place helpers across ${Array.from(new Set(locs.flatMap((l) => l.pincodes))).length} pincodes in ${city.name}. Where a single pincode covers several localities, it has its own page listing them.`,
      ],
    },
    { id: 'all', heading: `All localities in ${city.name} A–Z`, paragraphs: [], bullets: [...locs].sort((a, b) => a.name.localeCompare(b.name)).map((l) => l.name) },
  ];
  const faqs = cityFaqs(city.slug);
  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: city.name, path: meta.canonicalPath },
  ];
  const serviceCards: ServiceCard[] = SERVICES.map((s) => ({ service: s, path: paths.serviceCity(s.slug, city.slug), from: s.pricing[city.pricingTier].from, blurb: `${city.name} — ${s.shortDescription}` }));
  const nearby: LinkItem[] = heroes.map((h) => ({ name: h.name, path: paths.locality(h.city, h.slug), anchor: `maid service in ${h.name}` }));
  const cityPins = PINCODES.filter((p) => p.city === city.slug && p.localities.length >= 2);
  const related: LinkItem[] = [
    ...zones.map((z) => ({ name: z.name, path: paths.zone(z.city, z.slug), anchor: `maid service in ${z.name}` })),
    ...cityPins.map((p) => ({ name: p.pin, path: paths.pincode(p.pin), anchor: `maid service in ${p.pin}` })),
  ];
  const jsonld = [
    breadcrumbLd(crumbs),
    serviceLd({ name: `Maid Service in ${city.name}`, serviceType: 'Domestic help placement', description: meta.description, path: meta.canonicalPath, city, pincodes: [], band: SERVICES[1].pricing[city.pricingTier], services: SERVICES }),
    faqLd(faqs),
  ];
  return finish({
    type: 'city',
    path: meta.canonicalPath,
    meta,
    crumbs,
    hero: { h1: meta.h1, tagline: `Verified maids, cooks, nannies and elder-care helpers across ${zones.length} zones and ${locs.length} localities of ${city.name}.`, badges: ['Verified helpers', 'Replacement policy', `${locs.length} localities`] },
    sections,
    serviceCards,
    pricing: { rows: tierRows(city).map((r) => ({ ...r, path: paths.serviceCity(r.service.slug, city.slug) })), factors: PRICE_FACTORS, note: PRICE_NOTE },
    faqs,
    nearby,
    related,
    jsonld,
    localTokens: [city.name, ...city.altNames, ...zones.map((z) => z.name), ...locs.map((l) => l.name)],
    missingRequired: missing,
    wordFloor: 900,
    localRatioFloor: 0.35,
    updatedAt: city.updatedAt,
    cta: { whatsappText: `Hi MyBuddyMaid, I need a maid in ${city.name}.`, city: city.slug },
  });
}

// ---------------------------------------------------------------------------
// Service × city
// ---------------------------------------------------------------------------
export function composeServiceCity(svc: Service, city: City): PageModel {
  const meta = serviceCityMeta(svc, city);
  const zones = ZONES_BY_CITY.get(city.slug) ?? [];
  const locs = LOCALITIES_BY_CITY.get(city.slug) ?? [];
  const heroes = city.heroLocalities.map((s) => LOCALITY_BY_PATH.get(`${city.slug}/${s}`)!).filter(Boolean);
  const band = svc.pricing[city.pricingTier];
  const byProfile = (p: Locality['housingProfile']) => locs.filter((l) => l.housingProfile === p).length;
  const sections: TextSection[] = [
    {
      id: 'intro',
      heading: `${svc.name} across ${city.name}`,
      paragraphs: [
        `${svc.shortDescription} We place ${svc.name.toLowerCase()}s in ${locs.length} localities across ${city.name}'s ${zones.map((z) => z.name).join(', ')} belts.`,
        `Housing shapes the arrangement: ${byProfile('gated-societies')} of our ${city.name} localities are dominated by gated societies (registered helper entry, fixed slots), ${byProfile('independent-houses')} by independent houses (flexible timings, live-in common), and the rest are mixed or builder-floor areas.`,
      ],
    },
    { id: 'included', heading: `What's included`, paragraphs: [], bullets: svc.tasksIncluded },
    { id: 'excluded', heading: `Not included`, paragraphs: [], bullets: svc.tasksExcluded },
    { id: 'modes', heading: `Modes and hours`, paragraphs: [`Available as ${svc.modes.join(', ')}. Typical hours: ${svc.typicalHours}.`] },
    { id: 'zones', heading: `${svc.name} by zone in ${city.name}`, paragraphs: [], bullets: zones.map((z) => `${z.name}: ${z.localities.length} localities`) },
    ...trustSections(city.name),
  ];
  const faqs = serviceCityFaqs(svc, city.slug);
  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: svc.name, path: paths.serviceHub(svc.slug) },
    { name: city.name, path: meta.canonicalPath },
  ];
  const nearby: LinkItem[] = heroes.map((h) => ({ name: h.name, path: paths.serviceLocality(h.city, h.slug, svc.slug), anchor: `${svc.name.toLowerCase()} in ${h.name}` }));
  const related: LinkItem[] = [
    ...SERVICES.filter((s) => s.slug !== svc.slug).map((s) => ({ name: s.name, path: paths.serviceCity(s.slug, city.slug), anchor: `${s.name.toLowerCase()} in ${city.name}` })),
    { name: city.name, path: paths.city(city.slug), anchor: `maid service in ${city.name}` },
  ];
  const jsonld = [
    breadcrumbLd(crumbs),
    serviceLd({ name: `${svc.name} in ${city.name}`, serviceType: svc.name, description: meta.description, path: meta.canonicalPath, city, pincodes: [], band }),
    faqLd(faqs),
  ];
  return finish({
    type: 'service-city',
    path: meta.canonicalPath,
    meta,
    crumbs,
    hero: { h1: meta.h1, tagline: `${svc.shortDescription} Verified helpers across ${city.name}, with a replacement policy.`, badges: ['Verified helpers', 'Replacement policy', `From ${inr(band.from)}/month`] },
    sections,
    serviceCards: [],
    pricing: { rows: [{ service: svc, ...band }], factors: PRICE_FACTORS, note: PRICE_NOTE },
    faqs,
    nearby: [...nearby, ...locs.filter((l) => !city.heroLocalities.includes(l.slug)).map((l) => ({ name: l.name, path: paths.serviceLocality(l.city, l.slug, svc.slug), anchor: `${svc.name.toLowerCase()} in ${l.name}` }))],
    related,
    jsonld,
    localTokens: [city.name, ...city.altNames, ...zones.map((z) => z.name), ...locs.map((l) => l.name)],
    missingRequired: [],
    wordFloor: 600,
    localRatioFloor: 0.35,
    updatedAt: svc.updatedAt > city.updatedAt ? svc.updatedAt : city.updatedAt,
    cta: { whatsappText: `Hi MyBuddyMaid, I need a ${svc.name.toLowerCase()} in ${city.name}.`, city: city.slug, service: svc.slug },
  });
}

// ---------------------------------------------------------------------------
// Service hub (national) and the maid-service overview
// ---------------------------------------------------------------------------
export function composeServiceHub(svc: Service): PageModel {
  const meta = serviceHubMeta(svc);
  const sections: TextSection[] = [
    { id: 'intro', heading: `What our ${svc.name.toLowerCase()} service covers`, paragraphs: [svc.shortDescription, `Available as ${svc.modes.join(', ')}. Typical hours: ${svc.typicalHours}.`] },
    { id: 'included', heading: `Included`, paragraphs: [], bullets: svc.tasksIncluded },
    { id: 'excluded', heading: `Not included`, paragraphs: [], bullets: svc.tasksExcluded },
    { id: 'cities', heading: `${svc.name} by city`, paragraphs: [], bullets: CITIES.map((c) => `${c.name}${c.altNames[0] && ['gurgaon', 'bangalore', 'mangalore'].includes(c.slug) ? ` (${c.altNames[0]})` : ''} — ${(LOCALITIES_BY_CITY.get(c.slug) ?? []).length} localities`) },
    { id: 'variants', heading: `Also searched as`, paragraphs: [svc.altNames.join(' · ')] },
    ...trustSections('every city we serve'),
  ];
  const faqs = serviceHubFaqs(svc);
  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: svc.name, path: meta.canonicalPath },
  ];
  const nearby: LinkItem[] = CITIES.map((c) => ({ name: c.name, path: paths.serviceCity(svc.slug, c.slug), anchor: `${svc.name.toLowerCase()} in ${c.name}` }));
  const related: LinkItem[] = svc.relatedServices.map((s) => ({ name: s, path: paths.serviceHub(s), anchor: SERVICES.find((x) => x.slug === s)?.name.toLowerCase() ?? s }));
  return finish({
    type: 'service-hub',
    path: meta.canonicalPath,
    meta,
    crumbs,
    hero: { h1: meta.h1, tagline: svc.shortDescription, badges: ['Verified helpers', 'Replacement policy', `${CITIES.length} cities`] },
    sections,
    serviceCards: [],
    pricing: { rows: [{ service: svc, ...svc.pricing.metro }], factors: PRICE_FACTORS, note: PRICE_NOTE },
    faqs,
    nearby,
    related,
    jsonld: [breadcrumbLd(crumbs), faqLd(faqs)],
    localTokens: [svc.name, ...svc.altNames],
    missingRequired: [],
    wordFloor: 700,
    localRatioFloor: 0,
    updatedAt: svc.updatedAt,
    cta: { whatsappText: `Hi MyBuddyMaid, I need a ${svc.name.toLowerCase()}.`, city: '', service: svc.slug },
  });
}

export function composeMaidServiceHub(): PageModel {
  const meta = maidServiceHubMeta();
  const sections: TextSection[] = [
    {
      id: 'intro',
      heading: 'One page per area, not one page per keyword',
      paragraphs: [
        'Whether you searched for a maid agency, a maid provider, a house maid or simply a verified maid service, the right page is the one for your locality: every locality hub lists the helpers, modes and indicative pricing for that area and links to its full-time, part-time, cook, babysitter/nanny, elder-care and domestic-help pages.',
        `We currently serve ${ALL_LOCALITIES.length} localities across ${CITIES.length} cities. Choose a city below to find your area.`,
      ],
    },
    { id: 'cities', heading: 'Cities', paragraphs: [], bullets: CITIES.map((c) => `${c.name} — ${(ZONES_BY_CITY.get(c.slug) ?? []).length} zones, ${(LOCALITIES_BY_CITY.get(c.slug) ?? []).length} localities`) },
    { id: 'services', heading: 'Services', paragraphs: [], bullets: SERVICES.map((s) => `${s.name}: ${s.shortDescription}`) },
    ...trustSections('every city we serve'),
  ];
  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'Maid Service', path: meta.canonicalPath },
  ];
  return finish({
    type: 'service-hub',
    path: meta.canonicalPath,
    meta,
    crumbs,
    hero: { h1: meta.h1, tagline: 'Verified, background-checked house maids across Delhi NCR, Mumbai, Pune, Bangalore and Mangalore.', badges: ['Verified helpers', 'Replacement policy', `${CITIES.length} cities`] },
    sections,
    serviceCards: [],
    pricing: null,
    faqs: [],
    nearby: CITIES.map((c) => ({ name: c.name, path: paths.city(c.slug), anchor: `maid service in ${c.name}` })),
    related: SERVICES.map((s) => ({ name: s.name, path: paths.serviceHub(s.slug), anchor: s.name.toLowerCase() })),
    jsonld: [breadcrumbLd(crumbs)],
    localTokens: [],
    missingRequired: [],
    wordFloor: 400,
    localRatioFloor: 0,
    updatedAt: '2026-09-05',
    cta: { whatsappText: 'Hi MyBuddyMaid, I need a maid.', city: '' },
  });
}

// ---------------------------------------------------------------------------
// Pincode page (many-to-many pins only)
// ---------------------------------------------------------------------------
export function composePincode(rec: PincodeRecord): PageModel {
  const city = CITY_BY_SLUG.get(rec.city)!;
  const locs = rec.localities.map((s) => LOCALITY_BY_PATH.get(`${rec.city}/${s}`)!).filter(Boolean);
  const meta = pincodeMeta(rec, locs.map((l) => l.name));
  const nearbyPins = PINCODES.filter((p) => p.city === rec.city && p.pin !== rec.pin && p.localities.length >= 2).slice(0, 8);
  const zones = Array.from(new Set(locs.map((l) => l.zone)));
  const zoneNames = Array.from(
    new Set(locs.map((l) => ZONES.find((z) => z.city === l.city && z.slug === l.zone)?.name).filter(Boolean) as string[]),
  );
  const housingMix = Array.from(new Set(locs.map((l) => l.housingProfile)));
  const allLandmarks = Array.from(new Set(locs.flatMap((l) => l.landmarks))).slice(0, 6);
  const sections: TextSection[] = [
    {
      id: 'covers',
      heading: `Which areas pincode ${rec.pin} covers`,
      paragraphs: [
        `Pincode ${rec.pin} in ${city.name} spans ${locs.length} localities: ${locs.map((l) => l.name).join(', ')}. ${zoneNames.length === 1 ? `All of them sit in the ${zoneNames[0]} belt.` : `They fall across the ${joinNames(zoneNames, 3)} belts.`} Each locality has its own hub page with services, indicative pricing, nearby areas and locality-specific answers.`,
        housingMix.length === 1
          ? `Housing under ${rec.pin} is consistent — predominantly ${housingMix[0].replace(/-/g, ' ')} — so helper timings and entry formalities work much the same way across the whole pincode.`
          : `Housing under ${rec.pin} is mixed: ${joinNames(housingMix.map((h) => h.replace(/-/g, ' ')), 3)}. That matters because a gated society registers helpers at the gate, while an independent home simply agrees timings with you.`,
      ],
      bullets: locs.map(
        (l) => `${l.name} — ${l.housingProfile.replace(/-/g, ' ')}${l.landmarks.length ? `, near ${l.landmarks[0]}` : ''}`,
      ),
    },
    {
      id: 'services',
      heading: `Services available in ${rec.pin}`,
      paragraphs: [
        `All six services are available across ${rec.pin}: ${SERVICES.map((s) => s.name.toLowerCase()).join(', ')}. Because these localities adjoin one another, a helper already working in one part of ${rec.pin} can often take a slot in another the same week.`,
      ],
      bullets: SERVICES.map(
        (s) => `${s.name} — from ${inr(s.pricing[city.pricingTier].from)}/month. ${s.shortDescription}`,
      ),
    },
    {
      id: 'landmarks',
      heading: `Landmarks inside ${rec.pin}`,
      paragraphs: allLandmarks.length
        ? [
            `Helpers navigate ${rec.pin} by landmarks rather than pincodes, so it helps to name the nearest one when you share your address. Across these localities the common reference points are ${joinNames(allLandmarks, 5)}.`,
          ]
        : [],
    },
    ...trustSections(`pincode ${rec.pin}`).slice(0, 2),
  ];
  const faqs: FAQ[] = [
    {
      id: `faq-pin-${rec.pin}-1`,
      q: `Which localities does maid service in ${rec.pin} include?`,
      a: `Pincode ${rec.pin} covers ${locs.map((l) => l.name).join(', ')} in ${city.name}. Use the locality page closest to your address, because timings and society entry rules differ between them.`,
      scope: 'locality',
      tags: [rec.pin],
    },
    {
      id: `faq-pin-${rec.pin}-2`,
      q: `Do you serve every part of ${rec.pin}?`,
      a: `We serve the ${locs.length} localities listed above within ${rec.pin}. If your society or street is not named, message us on WhatsApp with your address and we will confirm before you book anything.`,
      scope: 'locality',
      tags: [rec.pin],
    },
    {
      id: `faq-pin-${rec.pin}-3`,
      q: `Can one helper cover two homes in ${rec.pin}?`,
      a: `Yes, and it is common in ${rec.pin} because ${locs.map((l) => l.name).slice(0, 2).join(' and ')} adjoin each other. Part-time helpers usually serve several homes within a short walk, so a fixed, punctual slot works better than a floating one.`,
      scope: 'locality',
      tags: [rec.pin],
    },
    {
      id: `faq-pin-${rec.pin}-4`,
      q: `Is the pincode enough to book a helper in ${rec.pin}?`,
      a: `The pincode tells us the area, but we still need the locality and your building type inside ${rec.pin} to shortlist helpers who already travel there. Share the locality name from the list above along with ${rec.pin}.`,
      scope: 'locality',
      tags: [rec.pin],
    },
  ];
  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: city.name, path: paths.city(city.slug) },
    { name: `Pincode ${rec.pin}`, path: meta.canonicalPath },
  ];
  const nearby: LinkItem[] = locs.map((l) => ({ name: l.name, path: paths.locality(l.city, l.slug), anchor: `maid service in ${l.name}` }));
  const related: LinkItem[] = nearbyPins.map((p) => ({ name: p.pin, path: paths.pincode(p.pin), anchor: `maid service in ${p.pin}` }));
  return finish({
    type: 'pincode',
    path: meta.canonicalPath,
    meta,
    crumbs,
    hero: { h1: meta.h1, tagline: `Verified maids, cooks and nannies for every locality under pincode ${rec.pin}, ${city.name}.`, badges: ['Verified helpers', 'Replacement policy', `${locs.length} localities`] },
    sections,
    serviceCards: [],
    pricing: null,
    faqs,
    nearby,
    related,
    jsonld: [breadcrumbLd(crumbs), serviceLd({ name: `Maid Service in ${rec.pin}`, serviceType: 'Domestic help placement', description: meta.description, path: meta.canonicalPath, city, pincodes: [rec.pin], services: SERVICES }), faqLd(faqs)],
    localTokens: [rec.pin, ...locs.map((l) => l.name)],
    missingRequired: [],
    wordFloor: 300,
    localRatioFloor: 0.5,
    updatedAt: '2026-09-05',
    cta: { whatsappText: `Hi MyBuddyMaid, I need a maid in pincode ${rec.pin}, ${city.name}.`, city: city.slug, pincode: rec.pin },
  });
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------
export function composeHome(): PageModel {
  const meta = homeMeta();
  const totalLocs = ALL_LOCALITIES.length;
  const sections: TextSection[] = [
    {
      id: 'intro',
      heading: 'Verified domestic help, matched to your locality',
      paragraphs: [
        `MyBuddyMaid places verified, background-checked maids, cooks, babysitters and nannies, elder-care helpers and all-round domestic help in ${totalLocs} localities across ${CITIES.map((c) => c.name).join(', ')}. Every helper is identity- and address-verified and interviewed before placement, and every plan includes a replacement policy.`,
        'Rather than one generic page per city, every locality we serve has its own hub: the pincodes it covers, the housing it is made of, how helpers commute there, indicative pricing bands, locality-specific answers, and the nearby areas the same helpers cover. Pick your city below, then your area.',
      ],
    },
    {
      id: 'cities',
      heading: 'Cities we serve',
      paragraphs: [],
      bullets: CITIES.map((c) => `${c.name}${['gurgaon', 'bangalore', 'mangalore'].includes(c.slug) ? ` (${c.altNames[0]})` : ''} — ${(ZONES_BY_CITY.get(c.slug) ?? []).length} zones, ${(LOCALITIES_BY_CITY.get(c.slug) ?? []).length} localities`),
    },
    {
      id: 'services',
      heading: 'Services',
      paragraphs: [],
      bullets: SERVICES.map((s) => `${s.name}: ${s.shortDescription} Available ${s.modes.join(', ')}.`),
    },
    {
      id: 'how-it-works',
      heading: 'How booking works',
      paragraphs: [],
      bullets: [
        'Tell us your requirement on WhatsApp, by phone or in the app — service, hours and your address.',
        'We shortlist verified helpers who already travel to your area and arrange interviews.',
        'Confirm your helper and start; replacement support stays available under your plan.',
      ],
    },
    {
      id: 'verify',
      heading: 'How we verify',
      paragraphs: [
        'Every helper goes through Aadhaar validation, previous-employer reference checks and a behavioural assessment before an interview is arranged; police verification is completed for Gold and Diamond plans and the dossier is shared with you before placement. The full process is on our how-we-verify page.',
      ],
    },
    {
      id: 'replacement',
      heading: 'Replacement policy',
      paragraphs: [
        'If a helper leaves or does not work out, we provide replacements within your plan term — 3 replacements over 10 months on Silver, 5 over 12 months on Gold and 10 over 18 months on Diamond — and aim to share the new profile within 48 hours. Details are on the replacement-policy page.',
      ],
    },
  ];
  const faqs = GLOBAL_FAQS.slice(0, 4);
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }];
  return finish({
    type: 'home',
    path: '/',
    meta,
    crumbs,
    hero: { h1: meta.h1, tagline: `Verified maids, cooks, nannies and elder-care helpers in ${totalLocs} localities across ${CITIES.length} cities — with a replacement policy.`, badges: ['Verified helpers', 'Replacement policy', `${CITIES.length} cities`] },
    sections,
    serviceCards: SERVICES.map((s) => ({ service: s, path: paths.serviceHub(s.slug), from: s.pricing.metro.from, blurb: s.shortDescription })),
    pricing: null,
    faqs,
    nearby: CITIES.map((c) => ({ name: c.name, path: paths.city(c.slug), anchor: `maid service in ${c.name}` })),
    related: [],
    jsonld: [breadcrumbLd(crumbs), ...(faqs.length ? [faqLd(faqs)] : [])],
    localTokens: [],
    missingRequired: [],
    wordFloor: 600,
    localRatioFloor: 0,
    updatedAt: '2026-09-05',
    cta: { whatsappText: 'Hi MyBuddyMaid, I need a maid.', city: '' },
  });
}

// ---------------------------------------------------------------------------
// Enumerate every core page (sitemaps, gate, crawl)
// ---------------------------------------------------------------------------
export function* allCorePages(): Generator<PageModel> {
  yield composeHome();
  yield composeMaidServiceHub();
  for (const s of SERVICES) {
    yield composeServiceHub(s);
    for (const c of CITIES) yield composeServiceCity(s, c);
  }
  for (const c of CITIES) yield composeCity(c);
  for (const z of ZONES) yield composeZone(z);
  for (const l of ALL_LOCALITIES) {
    yield composeLocality(l);
    for (const s of SERVICES) yield composeServiceLocality(s, l);
  }
  for (const p of PINCODES) if (p.localities.length >= 2) yield composePincode(p);
}
