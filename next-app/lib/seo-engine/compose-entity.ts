// lib/seo-engine/compose-entity.ts — Phase 5 entity pages (Appendix E).
//
// ONE page per entity, at /<city>/<area>/<entity>, covering all six services. The
// original design gave each entity six service pages; the 2026-09-06 pilot measured those
// six at 0.72–0.76 Jaccard against each other and the quality gate noindexed five of six,
// because the facts block, the access paragraph, the verification section and two of five
// FAQs are identical across services. The extra five URLs would have existed only as
// noindexed filler, so the model is one page per entity — see rollout-log.md and
// ASSUMPTIONS.md #42. Deeper service intent is sent to the locality money pages, which is
// also what keeps those pages linked from here.
//
// An entity page exists only when the entity carries >= 5 entity-specific facts, so the
// facts block is always substantive; a `draft` entity has no URL at all.
import type { Entity } from '@/data/seo/types';
import { CITY_BY_SLUG, LOCALITY_BY_PATH, SERVICES, ZONES, getNearby } from '@/data/seo';
import { ENTITIES_BY_LOCALITY, LIVE_ENTITIES, MIN_ENTITY_FACTS, entitySpecificFacts } from '@/data/seo/entities';
import { localityFaqs } from './faqs';
import { paths } from './links';
import { breadcrumbLd, faqLd, serviceLd } from './jsonld';
import { BRAND, SITE_URL } from './meta';
import {
  PRICE_FACTORS,
  PRICE_NOTE,
  cleanFaqs,
  inr,
  joinNames,
  tierRows,
  trustSections,
  type Crumb,
  type LinkItem,
  type PageModel,
  type ServiceCard,
  type TextSection,
} from './compose';

export const entityPath = (e: Entity) => `/${e.city}/${e.locality}/${e.slug}`;

export function composeEntity(entity: Entity): PageModel {
  const city = CITY_BY_SLUG.get(entity.city)!;
  const loc = LOCALITY_BY_PATH.get(`${entity.city}/${entity.locality}`)!;
  const zone = ZONES.find((z) => z.city === loc.city && z.slug === loc.zone)!;
  const factEntries = Object.entries(entity.facts ?? {}).filter(([, v]) => v.trim() !== '');
  const ownFacts = entitySpecificFacts(entity);
  const path = entityPath(entity);
  const kindLabel = entity.kind.replace(/-/g, ' ');
  const gated = loc.housingProfile === 'gated-societies';
  const nearbyLocs = getNearby(entity.city, entity.locality, 6);

  const title = `Maid Service in ${entity.name}, ${loc.name} | ${BRAND}`;
  const meta = {
    title: title.length <= 68 ? title : `Maid Service in ${entity.name} | ${BRAND}`,
    h1: `Maid Service in ${entity.name}, ${loc.name}`,
    description:
      `Verified maids, cooks and nannies for homes in ${entity.name}, ${loc.name} (${entity.pincode}). Replacement policy. Book on WhatsApp.`.slice(
        0,
        155,
      ),
    canonicalPath: path,
  };

  const entryFact = entity.facts?.['Helper entry process'];
  const idFact = entity.facts?.['Helper ID card issued by'];
  const liftFact = entity.facts?.['Service lift for helpers'];

  const sections: TextSection[] = [
    {
      id: 'facts',
      heading: `${entity.name} at a glance`,
      paragraphs: [
        `${entity.name} is a ${kindLabel} in ${loc.name}, ${city.name}, under pincode ${entity.pincode}. The details below are what decide how a helper is placed and how they get in each day.`,
      ],
      bullets: factEntries.map(([k, v]) => `${k}: ${v}`),
    },
    {
      id: 'placement',
      heading: `How helpers are placed in ${entity.name}`,
      paragraphs: [
        `Helpers working in ${entity.name} are placed through the wider ${loc.name} pool, so the same helper who serves a home here often covers other addresses within ${loc.name}. That keeps timings realistic rather than aspirational.`,
        entryFact
          ? `Entry to ${entity.name}: ${entryFact.toLowerCase().startsWith('gate') || /pass|verif|regist/i.test(entryFact) ? entryFact.charAt(0).toLowerCase() + entryFact.slice(1) : entryFact}. We start that step as soon as you confirm, so the helper is cleared before the first working day.`
          : gated
            ? `Entry to ${entity.name} follows the society's own process: the helper is registered at the gate and issued a pass before the first day, and we begin that step as soon as you confirm.`
            : `Access to ${entity.name} is agreed directly with you, so start times are more flexible than in a gated complex.`,
        [
          idFact ? `Helper ID cards here are issued by ${idFact}.` : '',
          liftFact ? `Service lift for helpers: ${liftFact}.` : '',
          loc.landmarks.length ? `Helpers use ${joinNames(loc.landmarks, 3)} as reference points when travelling to ${entity.name}.` : '',
        ]
          .filter(Boolean)
          .join(' '),
      ].filter(Boolean),
    },
    {
      id: 'services',
      heading: `Which service suits a home in ${entity.name}`,
      paragraphs: [
        `All six services are available at ${entity.name}. Which one fits depends on how many hours you need each day and whether the helper lives in.`,
      ],
      bullets: SERVICES.map(
        (s) =>
          `${s.name} — ${s.shortDescription.replace(/\s+$/, '')} Typically ${s.typicalHours.toLowerCase()}, available as ${s.modes.join(', ')}, from ${inr(s.pricing[city.pricingTier].from)}/month in ${city.name}.`,
      ),
    },
    ...trustSections(entity.name),
  ];

  const faqs = cleanFaqs([
    {
      id: `faq-ent-${entity.slug}-1`,
      q: `Do you place helpers inside ${entity.name}?`,
      a: `Yes. ${entity.name} sits inside ${loc.name} (${entity.pincode}), which we serve, so helpers who already work in ${loc.name} can take a slot at ${entity.name}.`,
      scope: 'entity' as const,
      tags: [entity.slug],
    },
    {
      id: `faq-ent-${entity.slug}-2`,
      q: `How does helper entry work at ${entity.name}?`,
      a: entryFact
        ? `${entryFact}${/[.!?]$/.test(entryFact) ? '' : '.'} We share the helper's verified ID so that step is completed before the first working day.`
        : gated
          ? `${entity.name} registers domestic helpers at the gate. We share the helper's verified ID so the society can issue an entry pass before the first working day.`
          : `${entity.name} does not have a central society gate, so entry and timings are agreed directly between you and the helper.`,
      scope: 'entity' as const,
      tags: [entity.slug],
    },
    ...localityFaqs(loc).slice(0, 3),
  ]);

  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: city.name, path: paths.city(city.slug) },
    { name: zone.name, path: paths.zone(city.slug, zone.slug) },
    { name: loc.name, path: paths.locality(loc.city, loc.slug) },
    { name: entity.name, path },
  ];

  // Service cards point at the locality money pages: deeper service intent belongs there,
  // and it keeps those pages linked from every entity page.
  const serviceCards: ServiceCard[] = SERVICES.map((s) => ({
    service: s,
    path: paths.serviceLocality(loc.city, loc.slug, s.slug),
    from: s.pricing[city.pricingTier].from,
    blurb: `${entity.name}, ${loc.name} — ${s.shortDescription}`,
  }));

  const siblings = (ENTITIES_BY_LOCALITY.get(`${entity.city}/${entity.locality}`) ?? []).filter((e) => e.slug !== entity.slug);
  const nearby: LinkItem[] = siblings.slice(0, 10).map((e) => ({
    name: e.name,
    path: entityPath(e),
    anchor: `maid service in ${e.name}`,
  }));

  const related: LinkItem[] = [
    { name: loc.name, path: paths.locality(loc.city, loc.slug), anchor: `maid service in ${loc.name}` },
    { name: zone.name, path: paths.zone(city.slug, zone.slug), anchor: `all areas in ${zone.name}` },
    ...nearbyLocs.slice(0, 4).map((n) => ({ name: n.name, path: paths.locality(n.city, n.slug), anchor: `maid service in ${n.name}` })),
  ];

  const model: Omit<PageModel, 'mainText'> = {
    type: 'entity',
    path,
    meta,
    crumbs,
    hero: {
      h1: meta.h1,
      tagline: `Verified, background-checked maids, cooks and nannies for homes in ${entity.name}, ${loc.name} (${entity.pincode}) — with a replacement policy.`,
      badges: ['Verified helpers', 'Replacement policy', 'Book on WhatsApp'],
    },
    sections,
    serviceCards,
    pricing: {
      rows: tierRows(city).map((r) => ({ ...r, path: paths.serviceLocality(loc.city, loc.slug, r.service.slug) })),
      factors: PRICE_FACTORS,
      note: PRICE_NOTE,
    },
    faqs,
    nearby,
    related,
    jsonld: [
      breadcrumbLd(crumbs),
      serviceLd({
        name: `Maid Service in ${entity.name}, ${loc.name}`,
        serviceType: 'Domestic help placement',
        description: meta.description,
        path,
        city,
        pincodes: [entity.pincode],
        band: SERVICES.find((s) => s.slug === 'part-time-maid')!.pricing[city.pricingTier],
        services: SERVICES,
      }),
      faqLd(faqs),
    ],
    localTokens: [
      entity.name,
      ...entity.altNames,
      entity.pincode,
      loc.name,
      ...loc.landmarks,
      zone.name,
      ...ownFacts.map(([, v]) => v),
      ...nearbyLocs.map((n) => n.name),
    ],
    missingRequired:
      ownFacts.length >= MIN_ENTITY_FACTS ? [] : [`entity-specific facts (${ownFacts.length} < ${MIN_ENTITY_FACTS})`],
    wordFloor: 450,
    localRatioFloor: 0.5,
    updatedAt: entity.updatedAt,
    cta: {
      whatsappText: `Hi MyBuddyMaid, I need a helper in ${entity.name}, ${loc.name} (${entity.pincode}).`,
      city: city.slug,
      zone: zone.slug,
      locality: loc.slug,
      pincode: entity.pincode,
    },
  };

  const mainText = [
    model.hero.h1,
    model.hero.tagline,
    ...model.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])]),
    ...model.faqs.flatMap((f) => [f.q, f.a]),
    ...model.nearby.map((n) => n.anchor),
  ].join('\n');

  return { ...model, mainText };
}

/**
 * Every page a `ready`/`live` entity produces. The uniqueness gate and the JSON-LD
 * validator must see these: an entity page that is never composed by the gate gets no
 * verdict in quality/gate.json, and an ungated page would ship indexable (rule 8).
 */
export function* allEntityPages(): Generator<PageModel> {
  for (const e of LIVE_ENTITIES) yield composeEntity(e);
}

export const ENTITY_SITE_URL = SITE_URL;
