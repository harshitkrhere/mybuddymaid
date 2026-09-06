// lib/seo-engine/compose-entity.ts — Phase 5 entity × service page model (Appendix E).
// An entity page exists only when the entity carries >= 5 entity-specific facts, so the
// facts block is always substantive; a `draft` entity has no URL at all.
import type { Entity, Service } from '@/data/seo/types';
import { CITY_BY_SLUG, LOCALITY_BY_PATH, SERVICES, ZONES, getNearby } from '@/data/seo';
import { ENTITIES_BY_LOCALITY, LIVE_ENTITIES, MIN_ENTITY_FACTS, entitySpecificFacts } from '@/data/seo/entities';
import { serviceLocalityFaqs } from './faqs';
import { paths } from './links';
import { breadcrumbLd, faqLd, serviceLd } from './jsonld';
import { BRAND, SITE_URL } from './meta';
import { inr, type Crumb, type LinkItem, type PageModel, type TextSection } from './compose';

export function composeEntityService(svc: Service, entity: Entity): PageModel {
  const city = CITY_BY_SLUG.get(entity.city)!;
  const loc = LOCALITY_BY_PATH.get(`${entity.city}/${entity.locality}`)!;
  const zone = ZONES.find((z) => z.city === loc.city && z.slug === loc.zone)!;
  const band = svc.pricing[city.pricingTier];
  const factEntries = Object.entries(entity.facts ?? {}).filter(([, v]) => v.trim() !== '');
  const ownFacts = entitySpecificFacts(entity);
  const path = `/${entity.city}/${entity.locality}/${entity.slug}/${svc.slug}`;

  const title = `${svc.name} in ${entity.name}, ${loc.name} | ${BRAND}`;
  const meta = {
    title: title.length <= 68 ? title : `${svc.name} in ${entity.name} | ${BRAND}`,
    h1: `${svc.name} in ${entity.name}, ${loc.name}`,
    description: `${svc.name} for homes in ${entity.name}, ${loc.name} (${entity.pincode}): verified helpers, replacement policy. Book on WhatsApp.`.slice(0, 155),
    canonicalPath: path,
  };

  const siblings = (ENTITIES_BY_LOCALITY.get(`${entity.city}/${entity.locality}`) ?? [])
    .filter((e) => e.slug !== entity.slug)
    .slice(0, 10);
  const nearbyLocs = getNearby(entity.city, entity.locality, 6);

  const sections: TextSection[] = [
    {
      id: 'facts',
      heading: `${entity.name} at a glance`,
      paragraphs: [
        `${entity.name} is a ${entity.kind.replace(/-/g, ' ')} in ${loc.name}, ${city.name}, under pincode ${entity.pincode}. The details below decide how a ${svc.name.toLowerCase()} is placed here.`,
      ],
      bullets: factEntries.map(([k, v]) => `${k}: ${v}`),
    },
    {
      id: 'intro',
      heading: `${svc.name} for households in ${entity.name}`,
      paragraphs: [
        `Helpers working in ${entity.name} are placed through the wider ${loc.name} pool, so the same ${svc.name.toLowerCase()} who serves a home here often covers other addresses within ${loc.name}. That keeps timings realistic rather than aspirational.`,
        loc.housingProfile === 'gated-societies'
          ? `Entry to ${entity.name} follows the society's own process: the helper is registered at the gate and issued a pass before the first day, and we begin that step as soon as you confirm.`
          : `Access to ${entity.name} is agreed directly with you, so start times are more flexible than in a gated complex.`,
        `Typical hours for this service are ${svc.typicalHours.toLowerCase()}, available as ${svc.modes.join(', ')}.`,
      ],
    },
    {
      id: 'verify',
      heading: 'Verification and replacement',
      paragraphs: [
        `Every helper placed in ${entity.name} is identity- and background-checked before you interview them, and the replacement policy for your plan applies exactly as it does anywhere else in ${loc.name}.`,
      ],
    },
  ];

  const faqs = [
    {
      id: `faq-ent-${entity.slug}-${svc.slug}-1`,
      q: `Do you place a ${svc.name.toLowerCase()} inside ${entity.name}?`,
      a: `Yes. ${entity.name} sits inside ${loc.name} (${entity.pincode}), which we serve, so helpers who already work in ${loc.name} can take a slot at ${entity.name}.`,
      scope: 'entity' as const,
      tags: [entity.slug, svc.slug],
    },
    {
      id: `faq-ent-${entity.slug}-${svc.slug}-2`,
      q: `How does helper entry work at ${entity.name}?`,
      a:
        loc.housingProfile === 'gated-societies'
          ? `${entity.name} registers domestic helpers at the gate. We share the helper's verified ID so the society can issue an entry pass before the first working day.`
          : `${entity.name} does not have a central society gate, so entry and timings are agreed directly between you and the helper.`,
      scope: 'entity' as const,
      tags: [entity.slug],
    },
    ...serviceLocalityFaqs(svc, loc).slice(0, 3),
  ];

  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: city.name, path: paths.city(city.slug) },
    { name: loc.name, path: paths.locality(loc.city, loc.slug) },
    { name: entity.name, path: `/${entity.city}/${entity.locality}/${entity.slug}/${SERVICES[0].slug}` },
    { name: svc.name, path },
  ];

  const nearby: LinkItem[] = siblings.map((e) => ({
    name: e.name,
    path: `/${e.city}/${e.locality}/${e.slug}/${svc.slug}`,
    anchor: `${svc.name.toLowerCase()} in ${e.name}`,
  }));
  const related: LinkItem[] = [
    ...SERVICES.filter((s) => s.slug !== svc.slug).map((s) => ({
      name: s.name,
      path: `/${entity.city}/${entity.locality}/${entity.slug}/${s.slug}`,
      anchor: `${s.name.toLowerCase()} in ${entity.name}`,
    })),
    { name: loc.name, path: paths.locality(loc.city, loc.slug), anchor: `maid service in ${loc.name}` },
    ...nearbyLocs.slice(0, 4).map((n) => ({ name: n.name, path: paths.locality(n.city, n.slug), anchor: `maid service in ${n.name}` })),
  ];

  const model: Omit<PageModel, 'mainText'> = {
    type: 'service-locality',
    path,
    meta,
    crumbs,
    hero: {
      h1: meta.h1,
      tagline: `${svc.shortDescription} Verified helpers for ${entity.name} in ${loc.name} (${entity.pincode}).`,
      badges: ['Verified helpers', 'Replacement policy', `From ${inr(band.from)}/month`],
    },
    sections,
    serviceCards: [],
    pricing: { rows: [{ service: svc, ...band }], factors: ['Hours per day and days per week', 'Tasks included', 'Household size and home size'], note: 'Indicative monthly bands, not quotes.' },
    faqs,
    nearby,
    related,
    jsonld: [
      breadcrumbLd(crumbs),
      serviceLd({
        name: `${svc.name} in ${entity.name}, ${loc.name}`,
        serviceType: svc.name,
        description: meta.description,
        path,
        city,
        pincodes: [entity.pincode],
        band,
      }),
      faqLd(faqs),
    ],
    localTokens: [entity.name, ...entity.altNames, entity.pincode, loc.name, ...loc.landmarks, zone.name, ...nearbyLocs.map((n) => n.name)],
    missingRequired:
      ownFacts.length >= MIN_ENTITY_FACTS
        ? []
        : [`entity-specific facts (${ownFacts.length} < ${MIN_ENTITY_FACTS})`],
    wordFloor: 350,
    localRatioFloor: 0.5,
    updatedAt: entity.updatedAt,
    cta: {
      whatsappText: `Hi MyBuddyMaid, I need a ${svc.name.toLowerCase()} in ${entity.name}, ${loc.name} (${entity.pincode}).`,
      city: city.slug,
      zone: zone.slug,
      locality: loc.slug,
      service: svc.slug,
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

export const ENTITY_SITE_URL = SITE_URL;

/**
 * Every page a `ready`/`live` entity produces. The uniqueness gate and the JSON-LD
 * validator must see these: an entity page that is never composed by the gate gets no
 * verdict in quality/gate.json, and an ungated page would ship indexable (rule 8).
 */
export function* allEntityPages(): Generator<PageModel> {
  for (const e of LIVE_ENTITIES) for (const s of SERVICES) yield composeEntityService(s, e);
}
