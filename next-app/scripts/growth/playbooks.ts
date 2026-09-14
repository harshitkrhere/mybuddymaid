// scripts/growth/playbooks.ts — the off-site playbooks (Google Business Profile, backlinks,
// paid search and click-to-WhatsApp), generated from the data layer so that every service
// area, pincode, locality and price band in them traces to next-app/data/seo and nothing
// outside the footprint can appear (the growth brief's locality lock).
//
//   npm run growth:playbooks
//
// Writes docs/growth/gbp.md, backlinks.md, backlink-pipeline.csv, sem.md, ads/geo-targets.csv
// and ads/negative-keywords.csv. Anything a customer would read — the profile description,
// the review request, the ad copy — is marked DRAFT: the owner approves wording; this file
// only proposes it. The scripts never touch an account: the owner does the clicking.
import * as path from 'node:path';
import { CITIES, GLOBAL_FAQS, LOCALITIES_BY_CITY, PINCODES, PLANS, SERVICES, ZONES } from '../../data/seo';
import { SUPPORT_EMAIL, SUPPORT_HOURS, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_E164 } from '../../data/seo/contact';
import { BLOG_TAGS } from '../../data/blog/tags';
import { BLOG_BY_SLUG } from '../../data/blog/posts';
import { ORGANIZATION } from '../../lib/seo-engine/jsonld';
import { SITE_URL } from '../../lib/seo-engine/meta';
import { outsideFootprintCandidates } from '../../lib/growth/expansion';
import { GROWTH_DIR, readJson, REPO, writeText } from './_env';

const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN').format(n)}`;
const tier1 = CITIES.filter((c) => c.tier === 1);
const tier2 = CITIES.filter((c) => c.tier === 2);
const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const csv = (rows: string[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
const today = new Date().toISOString().slice(0, 10);
const legacy = readJson<Array<{ slug: string; name: string }>>(path.join(REPO, 'docs', 'seo', 'legacy-data', 'cities.json')) ?? [];
const outside = outsideFootprintCandidates(legacy, CITIES, ZONES);

// ─── Google Business Profile ────────────────────────────────────────────────────────────────

function gbp(): string {
  // GBP allows 20 service areas: the eight cities, then the largest Tier-1 zones by locality count.
  const zonesByTier = [...ZONES].sort((a, b) => {
    const ta = CITIES.find((c) => c.slug === a.city)?.tier ?? 9;
    const tb = CITIES.find((c) => c.slug === b.city)?.tier ?? 9;
    return ta - tb || b.localities.length - a.localities.length;
  });
  const areas = [...CITIES.map((c) => `${c.name}, ${c.state}`), ...zonesByTier.slice(0, 20 - CITIES.length).map((z) => `${z.name}, ${CITIES.find((c) => c.slug === z.city)?.name}`)];
  const services = SERVICES.map((s) => `| ${s.name} | ${s.shortDescription} | from ${inr(s.pricing.metro.from)} to ${inr(s.pricing.metro.to)} a month (helper's salary, indicative) |`);
  const posts = Object.entries(BLOG_TAGS)
    .filter(([, t]) => !t.outsideFootprint)
    .map(([slug]) => BLOG_BY_SLUG.get(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  return `# Google Business Profile — service-area business setup

Generated ${today} by \`npm run growth:playbooks\` from \`next-app/data/seo\`. Everything here is a
field to fill or a step to take in the GBP dashboard; nothing is created automatically.

## 1. The profile

| Field | Value | Note |
|---|---|---|
| Business name | ${ORGANIZATION.name} | exactly this — no "Verified maids" suffix, no city; GBP suspends keyword-stuffed names |
| Phone | ${SUPPORT_PHONE_DISPLAY} (${SUPPORT_PHONE_E164}) | the one number on every surface; the legacy site published +91 95993 90188 — hunt down and correct any directory that still shows it |
| Website | ${SITE_URL} | apex, https, no trailing slash |
| E-mail | ${SUPPORT_EMAIL} | |
| Address | ${ORGANIZATION.address.streetAddress}, ${ORGANIZATION.address.addressLocality} ${ORGANIZATION.address.postalCode} | registered office, **not a walk-in centre** (the contact page says so) — set the profile up as a **service-area business and hide the address**; a shown storefront customers cannot visit is the classic suspension trigger |
| Hours | ${SUPPORT_HOURS.label} | the published support hours (Terms §14.4); mark special hours for public holidays |
| Opening date | ${ORGANIZATION.foundingDate} | |
| Social | ${ORGANIZATION.sameAs.join(', ')} | the same profiles the site's Organization schema names |

**Category.** Pick the primary category from GBP's own list by searching "domestic" / "home help";
choose the one that describes a domestic-help service, and do **not** pick "Employment agency"
(MyBuddyMaid is a marketplace, not an employer — the brief's own rule) or "House cleaning
service" (that says the company cleans; it places helpers). Add secondary categories for
child care and elder care if the list offers them. Record the exact category chosen here.

## 2. Service areas (20 allowed — these, in this order)

${areas.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Only cities and zones from the data layer. If GBP will not match a zone name, use the city.
Nothing outside this list — a Hyderabad or Chennai area on the profile would draw calls we
cannot fulfil (\`docs/growth/expansion-candidates.md\` is where that demand is logged).

## 3. Services (the "Services" tab)

| Service | Description | Price shown |
|---|---|---|
${services.join('\n')}

Add each of the three plans as a service too, priced at the one-time platform fee:
${PLANS.map((p) => `- **${p.name} plan** — ${inr(p.fee)} one-time, ${p.termMonths}-month replacement cover, ${p.verifiedProfiles} verified profiles${p.policeVerification ? ', police verification' : ''}`).join('\n')}

## 4. Description — DRAFT, needs the owner's approval before it is pasted (750-character limit)

> MyBuddyMaid connects households with verified maids, cooks, babysitters and nannies,
> elder-care helpers and domestic help across ${CITIES.map((c) => c.name).join(', ')}. Every
> helper is identity- and address-verified and interviewed before placement; every plan
> includes a replacement policy. Tell us your locality and the service you need on WhatsApp
> and we shortlist helpers who already travel there.

## 5. Q&A seeds (already-published answers from the site — safe to post as the owner)

${GLOBAL_FAQS.slice(0, 6)
  .map((f) => `**Q: ${f.q}**\n${f.a}`)
  .join('\n\n')}

## 6. Weekly posts — a rotation built from the guides that already exist

One post a week, 150–300 words, one photo, one link to the guide or the city hub. Cycle:

${posts
  .slice(0, 12)
  .map((p, i) => `${i + 1}. ${p.title} → ${SITE_URL}/blog/${p.slug}`)
  .join('\n')}

Then the six Tier-1 city hubs (${tier1.map((c) => `${SITE_URL}/${c.slug}`).join(', ')}) and repeat.

## 7. Photos

Monthly: one real photo per category — the team (with consent), a helper onboarding session
(with consent, faces optional), the office, a service in progress in a customer's home (with
the customer's written consent). No stock images: GBP down-ranks them and customers can tell.

## 8. Reviews

- Target: 2–4 genuine reviews a month per active city. Ask only after a booking is active
  or completed (the Supabase status), never before placement and never for a fee, voucher
  or discount — an incentivised review breaches Google's policy and is a removal risk.
- Reply to every review within 48 hours; a complaint gets a reply that names the fix.
- Message to send with the review link — DRAFT, needs the owner's approval:
  > Thank you for booking with MyBuddyMaid. If your helper has started well, a short
  > Google review helps other families in ${'{locality}'} find verified help: ${'{review link}'}.
  > If anything is not right, reply here first and we will fix it.
- Automation of the ask (from the booking record) waits for WhatsApp inside Chatwoot; until
  then it is a manual step in the ops routine.

## 9. NAP consistency

The name, address and phone above must be byte-identical on every listing: Justdial, Sulekha,
IndiaMART, UrbanPro or any directory that carries the business, plus Instagram and Facebook.
Check each for the old number (+91 95993 90188) and the old "12,000+ families / 4.9 rating"
claims the site removed (ASSUMPTIONS.md #47) — a listing that still makes them contradicts
the site.
`;
}

// ─── Backlinks ──────────────────────────────────────────────────────────────────────────────

const LINK_TYPES: Array<{ type: string; what: string; angle: string }> = [
  { type: 'RWA / housing society', what: 'resident welfare associations and society portals in the hero localities', angle: 'a vetted vendor listing for residents; offer the society a verified-helper briefing' },
  { type: 'Corporate HR / relocation', what: 'HR and relocation teams at companies with large campuses in the city', angle: 'a domestic-help onboarding guide for relocating employees, hosted on their intranet or benefits page' },
  { type: 'Parenting blog', what: 'city parenting communities and blogs', angle: 'the nanny and babysitter guides; a guest column on choosing child care' },
  { type: 'Real-estate / moving blog', what: '"moving to {city}" content and real-estate portals', angle: 'the city guide as the "setting up your home" resource' },
  { type: 'Local press', what: 'city desks of digital publications', angle: 'the data story below, with the real price bands' },
  { type: 'Forum / Q&A', what: 'Quora, Reddit India and local forums', angle: 'answer the actual question in full; link only when it genuinely helps; never anchor-text spam' },
];

function backlinks(): string {
  const story = (c: (typeof CITIES)[number]) =>
    SERVICES.map((s) => `| ${s.name} | ${inr(s.pricing[c.pricingTier].from)}–${inr(s.pricing[c.pricingTier].to)} a month |`).join('\n');
  const cityGuide = (slug: string) => Object.entries(BLOG_TAGS).find(([, t]) => t.kind === 'city-guide' && !t.outsideFootprint && t.cities?.[0] === slug)?.[0];
  return `# Backlinks — locally relevant, nothing bought

Generated ${today} by \`npm run growth:playbooks\`. The pipeline itself is
\`backlink-pipeline.csv\` (one row per prospect; fill \`target\`, \`contact\` and \`status\` as
outreach happens). Outreach messages are sent by the owner, not by any script.

## Rules

- One genuinely local link outweighs ten directory links. Every prospect must have a
  topical or geographic reason to link to a maid-service page in *that* city.
- Never: PBNs, paid links, link exchanges, guest-post farms, directory blasts, or any link
  from a domain with no relevance to home help in the eight cities.
- Anchor targets: the city guide first (it links every hub beneath it), then the city hub,
  then a service × city page. Never a locality page from a national site — it reads as a
  doorway.

## Prospect types, per Tier-1 city

${LINK_TYPES.map((t) => `- **${t.type}** — ${t.what}. Angle: ${t.angle}.`).join('\n')}

## The data story (real numbers from the data layer)

"What it actually costs to hire domestic help in {city} in 2026" — the helper's monthly salary
band by service, plus the one-time platform fee (${PLANS.map((p) => `${p.name} ${inr(p.fee)}`).join(', ')}).
Bands are indicative and identical across the cities today (ASSUMPTIONS.md #4); the story
gets city-specific the day the ops team records real placement salaries.

${tier1
  .map(
    (c) => `### ${c.name}

| Service | Salary band (indicative) |
|---|---|
${story(c)}

Pitch to: ${c.name} city desks, parenting and real-estate blogs. Link target: ${cityGuide(c.slug) ? `${SITE_URL}/blog/${cityGuide(c.slug)}` : `${SITE_URL}/${c.slug}`}. Society prospects to start with: ${c.heroLocalities
      .map((h) => LOCALITIES_BY_CITY.get(c.slug)?.find((l) => l.slug === h)?.name ?? h)
      .join(', ')}.`,
  )
  .join('\n\n')}

Tier-2 (${tier2.map((c) => c.name).join(', ')}): the same playbook at lower priority; no press
pitch until the Tier-1 stories have landed.
`;
}

function backlinkPipeline(): string {
  const rows: string[][] = [['city', 'type', 'target', 'url', 'contact', 'status', 'link_target', 'anchor_theme', 'notes', 'updated']];
  for (const c of tier1) {
    for (const t of LINK_TYPES) {
      rows.push([c.slug, t.type, '', '', '', 'prospect', `${SITE_URL}/${c.slug}`, `domestic help in ${c.name}`, t.angle, today]);
    }
  }
  return csv(rows);
}

// ─── SEM ────────────────────────────────────────────────────────────────────────────────────

const JOB_SEEKER_NEGATIVES = ['job', 'jobs', 'vacancy', 'vacancies', 'naukri', 'hiring', 'wanted', 'recruitment', 'apply', 'salary for maid', 'maid salary', 'work as maid', 'maid work', 'housekeeping job', 'cook job', 'nanny job', 'driver', 'security guard', 'office boy'];
const IRRELEVANT_NEGATIVES = ['maid cafe', 'maid outfit', 'maid dress', 'maid costume', 'maid of honor', 'maid of honour', 'mermaid', 'milkmaid', 'maiden', 'robot', 'app download', 'free', 'training', 'course', 'certificate', 'agency registration', 'franchise'];

function negatives(): string {
  const rows: string[][] = [['keyword', 'match_type', 'reason']];
  for (const c of outside) rows.push([c.name.toLowerCase(), 'phrase', `city outside the footprint (${c.slug})`]);
  for (const k of JOB_SEEKER_NEGATIVES) rows.push([k, 'phrase', 'job-seeker intent: a helper looking for work, not a household hiring one']);
  for (const k of IRRELEVANT_NEGATIVES) rows.push([k, 'phrase', 'unrelated meaning of "maid" or non-buyer intent']);
  return csv(rows);
}

function geoTargets(): string {
  const rows: string[][] = [['pincode', 'city', 'tier', 'localities']];
  for (const p of PINCODES) {
    const c = CITIES.find((x) => x.slug === p.city);
    const names = p.localities.map((s) => LOCALITIES_BY_CITY.get(p.city)?.find((l) => l.slug === s)?.name ?? s);
    rows.push([p.pin, p.city, String(c?.tier ?? ''), names.join(' | ')]);
  }
  return csv(rows);
}

function sem(): string {
  const adCopy = SERVICES.map(
    (s) => `| ${s.name} | Verified ${s.name} in {City} | ${s.shortDescription.slice(0, 88)} | Identity-verified helpers · replacement policy · book on WhatsApp |`,
  ).join('\n');
  return `# Paid search and click-to-WhatsApp — the playbook, prepared, not launched

Generated ${today} by \`npm run growth:playbooks\`. **No campaign runs until the owner sets a
test budget and a per-city daily cap** (growth brief §11; decision 6 in the plan). Everything
below is ready to paste.

## Geography (the locality lock, enforced in the ad account)

- \`ads/geo-targets.csv\` — the ${PINCODES.length} pincodes we serve, with city, tier and the
  localities behind each. Target these, and **exclude** the rest of each metro region and
  state so a lead from an unserved suburb never reaches the team (an unfulfillable lead is
  a conversation the team still has to have).
- \`ads/negative-keywords.csv\` — ${outside.length} cities we do not serve (from the legacy
  site's city list), ${JOB_SEEKER_NEGATIVES.length} job-seeker terms (the largest source of
  wasted spend in this category: helpers searching for work), and ${IRRELEVANT_NEGATIVES.length}
  unrelated meanings of "maid".

## Structure

### Meta — click-to-WhatsApp (the best fit for a WhatsApp-first funnel)

- One campaign per Tier-1 city (${tier1.map((c) => c.name).join(', ')}), objective **Engagement →
  Messaging apps → WhatsApp**, optimised for *conversations started*, never link clicks or reach.
- Ad sets by service (${SERVICES.map((s) => s.name).join(', ')}); the WhatsApp greeting names the
  service and city, exactly as the site's CTAs do
  (\`Hi MyBuddyMaid, I need a {service} in {City}.\`).
- Geo: the city's pincodes from \`geo-targets.csv\`, radius 0; exclude the rest of the state.
- Run 5–7 days at the test cap before judging; then move budget toward the city with the
  lowest cost per conversation **that became a booking** (the weekly report's Bookings
  column by city), not the lowest cost per click.

### Google Search

- One campaign per Tier-1 city; ad groups per service; exact and phrase match on the
  tracked keyword set for that city (\`docs/seo/keywords.csv\`, \`city\` column), transactional
  intent only ("hire", "near me", "{service} in {locality}").
- Landing page = the service × city page (\`${SITE_URL}/services/{service}/{city}\`) — it carries
  the WhatsApp and call CTAs above the fold and is indexable; with robots.txt no longer
  blocking query strings (branch \`growth/seo-fixes\`), \`?gclid=\` landing URLs are crawlable
  and Ads will stop flagging "destination not crawlable".
- Call extension and WhatsApp (message) asset on every ad; final URL suffix carries
  \`utm_source=google&utm_medium=cpc&utm_campaign={city}-{service}\`, which the site now stores
  and passes to the lead form (branch \`growth/tracking\`).
- Local Services Ads: check eligibility for this category in India when the account is
  opened; if eligible, the verification badge is worth the paperwork.

### Retargeting

The single highest-value audience is anyone who clicked WhatsApp, call or "Book in the app"
and did not become a lead or booking within 48 hours. Building it needs a Meta Pixel and a
Google Ads tag, and **both wait for the consent gate (audit task 2.6) and a privacy-policy
amendment** — the policy names its providers, so this is a legal step before a technical one.

## Conversions

- Import the GA4 events as conversions: \`whatsapp_click\`, \`call_click\` (top of funnel),
  \`lead_submit\` (a lead, once Phase 1d is on), and — the ones that count — the booking
  request and confirmed booking, which are only in Supabase today. Until a server-side
  conversion upload exists, judge campaigns weekly against the report's Leads and Bookings
  columns per city, not against the ad platform's own counts.
- Cost per confirmed booking, blended, is the only number that decides the budget.

## Ad copy — DRAFT, needs the owner's approval

| Service | Headline | Description (from the data layer) | Trust line |
|---|---|---|---|
${adCopy}

Plans as an offer line: ${PLANS.map((p) => `${p.name} ${inr(p.fee)} one-time, ${p.replacements} replacements over ${p.termMonths} months`).join(' · ')}.
Do not claim "100% police verified" — the site's own wording is "police verification on Gold
and Diamond plans"; an ad may not promise more than the plan delivers.

## Budget gate

Before the first rupee: the test cap per city per day, the total test budget, and the date
of the first review are written into \`docs/growth/changelog.md\` by the owner. The weekly
report then carries cost per conversation and cost per booking per city from the ad exports
(a manual CSV until an API connection is worth building).
`;
}

const out = (rel: string, text: string) => {
  const file = path.join(GROWTH_DIR, rel);
  writeText(file, text);
  console.log(`wrote ${file}`);
};

out('gbp.md', gbp());
out('backlinks.md', backlinks());
out('backlink-pipeline.csv', backlinkPipeline());
out('sem.md', sem());
out(path.join('ads', 'geo-targets.csv'), geoTargets());
out(path.join('ads', 'negative-keywords.csv'), negatives());
