# MyBuddyMaid SEO system — how it works and how to run it

Everything location-aware on this site is generated from one data layer. If a locality
is not in `next-app/data/seo/`, it has no page and is not serviceable. This document is
the hand-off: architecture, how to add data, every script, and the rollout policy.

Companion documents: [AUDIT.md](AUDIT.md) (the pre-rebuild audit) ·
[ASSUMPTIONS.md](ASSUMPTIONS.md) (every decision made) ·
[quality-report.md](quality-report.md) (which pages are noindexed and why) ·
[redirects.csv](redirects.csv) · [keywords.csv](keywords.csv) ·
[rollout-log.md](rollout-log.md) · [removal-plan.md](removal-plan.md)

---

## 1. Architecture

```
data/seo/                         the single source of truth
  cities.ts        8 cities        zones.ts       35 zone definitions
  services.ts      6 services      types.ts       shared types
  localities/<city>.ts             base rows: slug, name, altNames, zone, pincodes,
                                   priority, kind (Appendix B, normalised)
  localities/enrichment/<city>.json  generated: coordinates, neighbours, landmarks,
                                   housing/demand profile, curated prose, local FAQs
  localities/enrichment/fragments/   raw drafting output, merged by merge-enrichment.ts
  content/{city,zone}-content.json   hub intros and city/zone FAQ pools
  faqs/{service,shared}-faqs.ts      generated FAQ pools
  quality/gate.json                  generated index/noindex verdict per page
  entities.json                      Phase 5 entities (draft/ready/live)

lib/seo-engine/                   composition and output
  compose.ts        every page model, built from data only
  compose-entity.ts Phase 5 entity x service pages
  meta.ts           Appendix D title/description templates + length fitting
  faqs.ts           FAQ assembly (3 local + housing + service/city + global)
  jsonld.ts         Organization, BreadcrumbList, Service+Offer, FAQPage
  links.ts          URL builders + anchor-text rotation
  gate.ts           reads quality/gate.json -> robots directives
  sitemaps.ts       sitemap index + shards
  redirect-map.json generated legacy -> new map, read by proxy.ts
```

**Routes.** `/` · `/services` · `/services/[service]` · `/services/[service]/[city]` ·
`/[city]` · `/[city]/[area]` (area resolves as a zone **or** a locality) ·
`/[city]/[area]/[slug]` (slug is a service) · `/[city]/[area]/[slug]/[service]`
(Phase 5: slug is an entity) · `/pincode/[pin]` · `/blog`, `/blog/[slug]` ·
the five trust pages · `/app/*` (the booking SPA, noindex).

Two dynamic segments cannot share a level under different names, which is why level 3 is
always `[slug]`: a service on the three-segment route, an entity on the four-segment one.

**Current footprint** (run `npm run seo:stats` for live numbers):

| | count |
|---|---|
| Cities / zones / localities | 8 / 35 / 342 |
| Services generating pages | 6 |
| Pincodes (indexable pages) | 267 (20) |
| Composed core pages | 2,513 |
| Indexable after the quality gate | 2,489 |

---

## 2. How to add data

### Add a locality
1. Add a row to `next-app/data/seo/localities/<city>.ts`:
   `['slug', 'Name', ['Alt Name'], 'zone-slug', ['110001'], 'high', 'locality']`
   (the last field is optional and defaults to `locality`; use `sector`, `township`,
   `road` or `belt` where they apply).
2. Add its enrichment to `localities/enrichment/<city>.json` — or draft it with the
   process in §4 — so it has neighbours, landmarks, a housing profile, a demand profile,
   a 120–200 word `localIntro`, commute and housing notes, and 3 locality FAQs.
3. `npm run seo:geocode` to fetch its coordinates, then `npm run seo:neighbours`.
4. `npm run seo:validate && npm run seo:gate` and rebuild.

A locality with incomplete data still builds: the quality gate marks its pages
`noindex, follow` and lists them in `quality-report.md`. It never breaks the build and
never publishes a thin page.

### Add a service
Add an entry to `data/seo/services.ts` with pricing for all three tiers, at least three
`tasksIncluded`, and at least eight FAQs in its pool. Add its slug to `RESERVED_SLUGS` in
`data/seo/index.ts` so no locality can collide with it. Every locality automatically
gains a `/[city]/[locality]/[service]` page.

### Add a zone
Add a seed to `data/seo/zones.ts` and point localities at it via their `zone` field. The
zone's `localities` array is derived, so the two can never drift. A zone needs at least
three localities or the validator fails.

### Change pricing
Edit the `pricing` block in `data/seo/services.ts` for helper salary bands, or
`data/seo/plans.ts` for the platform plans. Both feed the SEO pages, the `/pricing`
and `/replacement-policy` trust pages **and** the booking app (via
`npm run seo:export-spa`), so there is one source of truth for money in the repo. Bands are indicative and render as
"from ₹X/month" everywhere; nothing else needs touching.

---

## 3. Scripts

Run from `next-app/`. All are `npm run <name>`.

| Script | What it does |
|---|---|
| `seo:validate` | Zod schema, slug/reserved-word/collision rules, pincode prefixes per city, structure minimums, neighbour symmetry, metadata uniqueness, count diff vs the last run. **Fails the build on any data error.** |
| `seo:stats` | Page counts per type and the total indexable count. |
| `seo:gate` | The quality engine: MinHash + LSH near-duplicate detection, local-token ratio, word floors, required sections, `[VERIFY]` markers. Writes `quality/gate.json` and `quality-report.md`. |
| `seo:redirects` | Rebuilds the legacy redirect map from the real legacy filenames plus the data layer. Writes `redirects.csv` and `redirect-map.json`. |
| `seo:merge` | Merges drafting fragments into the enrichment files, re-applies cached coordinates, symmetrises neighbours, regenerates FAQ modules. |
| `seo:geocode` | One-off OpenStreetMap Nominatim geocoder, 1 req/s, cached. **Never runs at build or request time.** |
| `seo:neighbours` | Refines neighbours to the 6–10 closest within ~8 km, with geography guards, keeping curated picks. |
| `seo:jsonld` | Validates every page's structured data offline; rejects AggregateRating, Review and per-locality LocalBusiness outright. |
| `seo:crawl` | Crawls a running build: broken links, orphans, redirecting internal links, canonical/robots correctness, click depth per page type. |
| `seo:check-redirects` | Requests every old URL and its `.html` variant; asserts exactly one 301 hop to a 200, or a deliberate 410. No chains, no loops. |
| `seo:keywords` | Regenerates `keywords.csv`, the rank-tracking set. |
| `seo:indexnow` | Submits new or changed URLs to IndexNow in batches of ≤10,000. |
| `seo:entities` | Phase 5 entity importer (CSV or OpenStreetMap) and readiness gate. |
| `seo:export-spa` | Exports the footprint, service price bands and plans into `app/src/lib/serviceability.json`, so the booking app reads the same data layer. Re-run before `node scripts/build-spa.mjs`. |
| `seo:draft` | Drafts locality prose through the Anthropic API. Run manually; output is committed. |
| `seo:gsc` | Weekly Search Console export, broken down by city, locality and service. |

`prebuild` runs `seo:validate`, `seo:redirects` and `seo:gate`, so `npm run build`
cannot ship stale data or an unevaluated quality gate.

### Verifying structured data against Google
`seo:jsonld` checks the invariants offline. To confirm against Google itself:
`npm run build && npm start`, then paste the rendered HTML of a sample page into the
[Rich Results Test](https://search.google.com/test/rich-results) (Code mode) or
[Schema Markup Validator](https://validator.schema.org/). Expect Organization,
BreadcrumbList, Service (+Offer) and FAQPage with no errors. Google no longer shows FAQ
rich results for sites like ours; the markup is kept for machine-readability.

---

## 4. The quality engine

Uniqueness comes from **data, not synonyms**. There is no spinner anywhere in this
codebase, and no LLM is ever called at build or request time.

1. **Data-first composition.** Every section renders from structured fields — pincodes,
   neighbours, landmarks, housing profile, demand profile, helper source areas, pricing
   tier, service modes. Two localities with different data produce different pages by
   construction.
2. **Curated prose.** Each locality carries a 120–200 word `localIntro`, commute and
   housing notes, and three FAQs written for that locality. First drafts are produced
   offline under a strict prompt (see [enrichment-brief.md](enrichment-brief.md)) that
   supplies only that locality's own fields, forbids claims not derivable from them, and
   requires an explicit `[VERIFY]` marker on anything uncertain. Drafts are committed
   with `reviewed: false`.
3. **`[VERIFY]` handling.** A sentence marked `[VERIFY]` is **dropped at render time**
   rather than published. The claim is withheld, never asserted, and the locality stays
   flagged for review. Sixty-three localities currently carry at least one such marker.
4. **The gate** (`seo:gate`) decides index/noindex per page:
   - near-duplicate: 5-word shingles, MinHash (96 hashes) + LSH (24 bands), fail above
     0.60 Jaccard against another page of the same type — this scales to 100k pages
     because it never does an O(n²) comparison;
   - local-token ratio: share of main-content sentences containing the page's own name,
     alt names, pincodes, a neighbour, a landmark or its zone. Floor 0.50 for locality,
     service × locality, entity and pincode pages; 0.35 for zone and city pages;
   - word-count floors per page type, required sections present, no `[VERIFY]` left.

   A failing page renders `noindex, follow` and is listed in `quality-report.md`. **The
   build fails on data errors, never on content gaps.**

Current gate result: **2,489 of 2,513 indexable, 24 noindexed, zero duplicate pairs
above 0.60.** The 24 are marginal local-token-ratio failures; they publish as soon as
their locality data is enriched further.

---

## 5. Redirects and the cutover

`docs/seo/redirects.csv` is generated from the actual legacy filenames, so it cannot
drift from what was published. `proxy.ts` serves it as a prebuilt lookup map.

| | count |
|---|---|
| Rows | 3,833 |
| 301 (single hop, including `.html` variants) | 1,970 verified |
| 410 Gone (out-of-footprint) | 5,696 verified |
| Chains or loops | 0 |

Also enforced in `proxy.ts`: `www` → apex (308), no trailing slash, and env-gated
maintenance mode (`MAINTENANCE_MODE=true`, off by default — it must never be hard-coded
on again).

### Cutover checklist

**The repository no longer builds the old site.** The root `vercel.json`, the merge
build script and the 3,846-page `mybuddymaid/` folder are deleted, and the root
`package.json` now delegates to `next-app`. Vercel must be pointed at it:
**set the project's Root Directory to `next-app`.** The exact set of URLs the legacy
site published is preserved in [legacy-urls.txt](legacy-urls.txt) and its generator
data in `legacy-data/`, so the redirect map stays reproducible without those files.

1. Set env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_BING_SITE_VERIFICATION`.
   Leave `MAINTENANCE_MODE` unset.
2. `node scripts/build-spa.mjs` from the repo root to rebuild the booking app into
   `next-app/public/_spa` (it is served under `/app/*`).
3. Point the Vercel project at `next-app/`. **Provision the `www` certificate** — it is
   currently expired, so `https://www.mybuddymaid.in` is unreachable.
4. Deploy to a preview URL, then run both checks against it. Preview deployments sit
   behind Vercel Deployment Protection, which 302s every request to Vercel SSO — the
   scripts detect that and refuse to run rather than reporting phantom redirects. Create a
   secret under **Project Settings → Deployment Protection → Protection Bypass for
   Automation** and pass it in (PowerShell):

   ```powershell
   cd next-app
   $env:VERCEL_AUTOMATION_BYPASS_SECRET = '<secret>'
   $env:BASE_URL = 'https://<preview>.vercel.app'
   npm run seo:check-redirects
   npm run seo:crawl
   Remove-Item Env:\BASE_URL, Env:\VERCEL_AUTOMATION_BYPASS_SECRET
   ```

   This is the only environment that exercises the `vercel.json` layer: platform redirects
   run *before* middleware, and `next start` does not apply them at all. A `.html` redirect
   chain hid in exactly that gap during the rebuild, so do not skip this step.
5. Promote to production, submit the sitemap index in Google Search Console and Bing
   Webmaster Tools, then `INDEXNOW_KEY=<key> npm run seo:indexnow -- --write-key`,
   deploy the key file, and run `npm run seo:indexnow`.
6. Watch GSC Coverage and the 404 report for a week. The legacy data in
   `seo-generator/data/` is the reference for any remapping.

Do **not** use the Google Indexing API for these pages: it is only for `JobPosting` and
`BroadcastEvent`, and misuse risks a manual action.

---

## 6. Phase 5 rollout policy

The system can generate 100,000+ entity × service pages, but capacity is the deliverable,
not volume. A page is generated only when it deserves to exist.

- Import candidates with `npm run seo:entities -- --csv <file>` or
  `-- --osm --city <city> --locality <locality>`. Everything lands as `draft`.
- **A `draft` entity has no URL at all** — not a noindexed page, no page.
- `npm run seo:entities -- --promote` moves entities with **≥ 5 entity-specific facts**
  to `ready`. Ready entities get ISR pages and the same quality gate as core pages.
- Publish in batches of **≤ 2,000 URLs per city per week**. Record each batch in
  `data/seo/quality/rollout.json`; it becomes its own sitemap shard and its own IndexNow
  submission (`npm run seo:indexnow -- --batch <shard>`).
- **Before releasing the next batch, check GSC: continue only if ≥ 60 % of the previous
  batch is indexed after 3 weeks.** Otherwise stop, improve that batch, and re-evaluate.
- Log every batch in [rollout-log.md](rollout-log.md).

---

## 7. Measurement

- **Rank tracking**: `docs/seo/keywords.csv` — 5,464 keywords, each mapped to the single
  URL that owns it, with a column showing whether that target is currently indexable.
  Keyword variants never get their own URL; the mapping is the proof.
- **Analytics**: GA4 `G-R24QC81J4P` plus Umami. Clicks on WhatsApp, call and app CTAs
  fire `whatsapp_click`, `call_click` and `app_click` with `city`, `zone`, `locality`,
  `service` and `pincode`, so every lead is attributable to the page that produced it.
  The lead form would fire `lead_submit` with the same parameters, but it ships
  disabled (see the cutover checklist), so that event is dormant until the Supabase
  `leads` migration is applied.
- **Analytics loading**: gtag.js is ~190KB and cost ~560ms of main-thread blocking when
  loaded eagerly. It now loads on first interaction or after 4 seconds, whichever comes
  first. Events fired before it loads are queued and flushed, so no click attribution is
  lost; the only trade-off is a missing `page_view` for a visitor who leaves within a few
  seconds without interacting.
- **Core Web Vitals** (Lighthouse mobile, simulated 4G, local `next start` — a Vercel
  deployment with CDN and HTTP/2 should do better):

| Page | Perf | SEO | A11y | Best practices | FCP | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| `/` | 96 | 100 | 100 | 96 | 0.8 s | 2.6 s | 0 | 110 ms |
| `/gurgaon` | 95 | 100 | 100 | 96 | 0.9 s | 2.7 s | 0 | 140 ms |
| `/gurgaon/dlf-phase-1` | 95 | 100 | 100 | 96 | 0.9 s | 2.6 s | 0 | 160 ms |
| `/noida/sector-50/cook` | 93 | 100 | 100 | 96 | 0.9 s | 2.5 s | 0 | 240 ms |
| `/pincode/122011` | 97 | 100 | 100 | 96 | 0.8 s | 2.5 s | 0 | 100 ms |
| `/pricing` | 98 | 100 | 100 | 96 | 0.8 s | 2.3 s | 0 | 80 ms |
| `/blog` | 93 | 100 | 100 | 96 | 1.1 s | 2.8 s | 0 | 200 ms |

  CLS is 0 and SEO and accessibility are 100 on every page type. LCP lands at 2.3–2.8 s
  locally against a target of < 2.5 s, so the fastest pages meet it and the heaviest sit
  just above. These are simulated-4G numbers from a local Node server with no CDN;
  confirm in the field with CrUX after deploy before treating the target as met.

---

## 8. Rules that must not be broken

1. The data layer is the only source of location, service and pricing data. Nothing
   hard-codes a city, locality, pincode or price.
2. One page per search intent. Keyword variants and city-name variants are on-page
   variants, never separate URLs.
3. Never invent facts. If a field is missing, omit the section; if a required section is
   missing, the page is noindex until the data exists.
4. No fabricated reviews, ratings, addresses or branches. No `AggregateRating`, no
   `Review`, and no `LocalBusiness` per locality — `seo:jsonld` fails the build on any of
   them.
5. Server-rendered HTML. Content, links and JSON-LD must be present with JavaScript off.
6. Never call an LLM at build or request time.
7. Every old URL keeps a single-hop 301 or a deliberate 410. No 404s from old URLs.
8. Never publish a page that fails the quality gate, and never publish 100k URLs at once.

---

## 9. Licences and attribution

Locality coordinates come from OpenStreetMap via the Nominatim API and are © OpenStreetMap
contributors, licensed under the ODbL 1.0. The attribution is rendered in the site footer.
Phase 5 entity candidates imported from Overpass carry the same licence on each record.
No competitor site is scraped anywhere in this system.
