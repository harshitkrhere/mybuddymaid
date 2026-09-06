// scripts/seo/validate-jsonld.ts — validates every page's JSON-LD without a network call.
// Checks the invariants the brief sets out (§6.4) and the rules Google's Rich Results
// Test enforces for the types we emit. Exits non-zero on any failure, so it can gate CI.
//
// How to check a sample page against Google/Schema.org validators (documented per brief):
//   1. npx next build && npx next start
//   2. Open https://search.google.com/test/rich-results and paste the rendered HTML of
//      e.g. http://localhost:3000/gurgaon/dlf-phase-1 (use "Code" mode), or
//      https://validator.schema.org/ for a pure schema.org check.
//   3. Expect: Organization, BreadcrumbList, Service (+Offer) and FAQPage detected, with
//      no errors. Google no longer shows FAQ rich results for sites like ours; the markup
//      is kept for machine-readability, not for a rich result.
// Run: npx tsx scripts/seo/validate-jsonld.ts
import { allCorePages } from '../../lib/seo-engine/compose';
import { allEntityPages } from '../../lib/seo-engine/compose-entity';
import { organizationLd, serializeLd } from '../../lib/seo-engine/jsonld';
import { SITE_URL } from '../../lib/seo-engine/meta';

const errors: string[] = [];
const err = (m: string) => errors.push(m);
const typeCounts = new Map<string, number>();

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkBlock(path: string, block: unknown) {
  if (!isObj(block)) return err(`${path}: JSON-LD block is not an object`);
  const type = block['@type'];
  if (typeof type !== 'string') return err(`${path}: block has no string @type`);
  typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  if (block['@context'] !== 'https://schema.org') err(`${path}: ${type} missing @context https://schema.org`);

  // Serialisation must escape `<` so the script tag can never be broken out of.
  const serialised = serializeLd(block);
  if (serialised.includes('<')) err(`${path}: ${type} serialisation contains a raw '<'`);
  try {
    JSON.parse(serialised.replace(/\\u003c/g, '<'));
  } catch {
    err(`${path}: ${type} does not round-trip through JSON.parse`);
  }

  switch (type) {
    case 'BreadcrumbList': {
      const items = block.itemListElement;
      if (!Array.isArray(items) || items.length < 1) return err(`${path}: BreadcrumbList has no items`);
      items.forEach((it, i) => {
        if (!isObj(it)) return err(`${path}: breadcrumb item ${i} is not an object`);
        if (it['@type'] !== 'ListItem') err(`${path}: breadcrumb item ${i} is not a ListItem`);
        if (it.position !== i + 1) err(`${path}: breadcrumb item ${i} position ${String(it.position)} is not ${i + 1}`);
        if (typeof it.name !== 'string' || !it.name) err(`${path}: breadcrumb item ${i} has no name`);
        if (typeof it.item !== 'string' || !String(it.item).startsWith(SITE_URL)) {
          err(`${path}: breadcrumb item ${i} url is not absolute on ${SITE_URL}`);
        }
      });
      break;
    }
    case 'FAQPage': {
      const qs = block.mainEntity;
      if (!Array.isArray(qs) || qs.length < 2) return err(`${path}: FAQPage needs at least 2 questions`);
      qs.forEach((q, i) => {
        if (!isObj(q) || q['@type'] !== 'Question') return err(`${path}: FAQ ${i} is not a Question`);
        if (typeof q.name !== 'string' || q.name.length < 8) err(`${path}: FAQ ${i} has no usable name`);
        const a = q.acceptedAnswer;
        if (!isObj(a) || a['@type'] !== 'Answer' || typeof a.text !== 'string' || a.text.length < 20) {
          err(`${path}: FAQ ${i} has no usable acceptedAnswer`);
        }
      });
      break;
    }
    case 'Service': {
      if (typeof block.name !== 'string') err(`${path}: Service has no name`);
      if (typeof block.serviceType !== 'string') err(`${path}: Service has no serviceType`);
      const provider = block.provider;
      if (!isObj(provider) || provider['@id'] !== `${SITE_URL}/#organization`) {
        err(`${path}: Service provider does not reference the site Organization`);
      }
      const area = block.areaServed;
      if (!Array.isArray(area) || area.length < 1) err(`${path}: Service has no areaServed`);
      const offers = block.offers;
      if (offers !== undefined) {
        if (!isObj(offers) || offers['@type'] !== 'Offer') return err(`${path}: Service offers is not an Offer`);
        const spec = offers.priceSpecification;
        if (!isObj(spec)) return err(`${path}: Offer has no priceSpecification`);
        if (spec.priceCurrency !== 'INR') err(`${path}: priceSpecification currency is not INR`);
        const min = Number(spec.minPrice);
        const max = Number(spec.maxPrice);
        if (!(min > 0)) err(`${path}: priceSpecification minPrice is not positive`);
        if (!(max >= min)) err(`${path}: priceSpecification maxPrice ${max} < minPrice ${min}`);
      }
      break;
    }
    case 'Organization':
      if (block['@id'] !== `${SITE_URL}/#organization`) err(`${path}: Organization @id mismatch`);
      if (!isObj(block.address)) err(`${path}: Organization has no address`);
      break;
    default:
      err(`${path}: unexpected JSON-LD @type '${type}'`);
  }

  // Rules that apply to every block, everywhere.
  const flat = JSON.stringify(block);
  if (flat.includes('aggregateRating') || flat.includes('AggregateRating')) {
    err(`${path}: ${type} contains AggregateRating — only real, visible reviews may be marked up`);
  }
  if (flat.includes('"Review"') || flat.includes('reviewCount')) {
    err(`${path}: ${type} contains Review markup — we have no review system`);
  }
  if (flat.includes('LocalBusiness')) {
    err(`${path}: ${type} contains LocalBusiness — we have no branch in each locality`);
  }
}

// Site-wide Organization (emitted once in the root layout).
checkBlock('(root layout)', organizationLd());

let pages = 0;
for (const page of [...allCorePages(), ...allEntityPages()]) {
  pages++;
  if (!page.jsonld.length) err(`${page.path}: page emits no JSON-LD`);
  const types = new Set<string>();
  for (const block of page.jsonld) {
    checkBlock(page.path, block);
    if (isObj(block) && typeof block['@type'] === 'string') types.add(block['@type']);
  }
  if (!types.has('BreadcrumbList')) err(`${page.path}: missing BreadcrumbList`);
  // A FAQPage may only be emitted when the FAQs are actually visible on the page.
  if (types.has('FAQPage') && page.faqs.length < 2) err(`${page.path}: FAQPage emitted but fewer than 2 FAQs are rendered`);
  if (page.faqs.length >= 2 && !types.has('FAQPage')) err(`${page.path}: renders FAQs but emits no FAQPage`);
  const isLocation = ['city', 'zone', 'locality', 'service-locality', 'service-city', 'pincode'].includes(page.type);
  if (isLocation && !types.has('Service')) err(`${page.path}: location page missing Service schema`);
}

console.log('--- validate-jsonld ---');
console.log(`pages checked: ${pages}`);
for (const [t, n] of [...typeCounts].sort((a, b) => b[1] - a[1])) console.log(`  ${t}: ${n}`);

if (errors.length) {
  console.error(`\n${errors.length} JSON-LD error(s):`);
  for (const e of errors.slice(0, 60)) console.error(`  FAIL ${e}`);
  if (errors.length > 60) console.error(`  ... and ${errors.length - 60} more`);
  process.exit(1);
}
console.log('\nvalidate-jsonld: GREEN');
