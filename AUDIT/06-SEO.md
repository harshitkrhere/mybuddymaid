# 06 — SEO

## Baseline — what is already correct

Verified live and in code. This is a well-built technical SEO implementation, and most of
the standard checklist passes. Listing it so the findings below are read in proportion.

| Check | Status | Evidence |
|---|---|---|
| Unique `<title>` per page | Pass | `lib/seo-engine/meta.ts`, one template per page type, ≤68 chars via `fitTitle()`; `scripts/seo/validate.ts` asserts global uniqueness |
| Unique meta description ≤155 | Pass | `desc()` in `meta.ts:25-34`, neighbours trimmed first |
| Self-referencing canonical | Pass | `alternates.canonical` on every page; verified live on `/delhi/dwarka` |
| `robots` meta driven by content quality | Pass | `gate.ts` → `page-metadata.ts:22-26`; verified `index, follow` live |
| Single `<h1>` | Pass | Including on ported blog posts — verified live, exactly 1 |
| Sitemap index + shards | Pass | 18 shards, `lastmod` from data `updatedAt` not build time; verified live |
| `robots.txt` | Pass, with a flaw | See FIN-SEO03 |
| OpenGraph + Twitter | Pass | Per-page dynamic image via `/og` |
| BreadcrumbList JSON-LD | Pass on SEO/trust/blog | Missing on the two legal pages (FIN-SEO04) |
| `Organization` JSON-LD | Pass | Root layout, single `@id`, referenced by `Service` and `BlogPosting` |
| `Service` + `Offer` JSON-LD | Pass | Price band + `areaServed` city and postal codes |
| `FAQPage` JSON-LD | Pass, correctly gated | Emitted only where FAQs are actually visible |
| No fake `AggregateRating` / reviews | Pass | Explicitly removed; see `ASSUMPTIONS.md` #47. Correct and rare |
| Legacy URL migration | Pass | 301 single-hop from a prebuilt map, 410 for retired URLs; verified live |
| Trailing slashes | Pass | `trailingSlash: false`, consistent |
| Internal linking | Pass | Rotated anchor text (4–5 variants), no orphans by construction; `seo:crawl` enforces it |
| Image alt text | Pass | Descriptive alts on content images, `alt=""` on decorative ones |
| `hreflang` | N/A | Single language; hook documented in `layout.tsx:26` |

---

## [FIN-SEO01] 2,052 service×locality pages are differentiated mainly by name substitution — scaled-content risk

**Severity:** HIGH · **Confidence:** LIKELY (the mechanism is CONFIRMED; Google's response to it is a judgement) · **Category:** SEO / Strategy

**Location:** `lib/seo-engine/compose.ts:382-489` (`composeServiceLocality`, `serviceLocalityIntro`,
`accessParagraphs`, `helperTravelParagraphs`, `trustSections`)

**What is happening.** Each of the 342 localities gets six service pages. Reading the
generator, the per-page prose is assembled from:

- **A 4-way switch on `housingProfile`** (`gated-societies` / `independent-houses` /
  `builder-floors` / `mixed`) producing one of four fixed paragraphs, with the locality name
  interpolated — `compose.ts:302-320` and `473-478`.
- **A conditional on `helperSourceAreas.length`** — one of two fixed paragraphs (`323-332`).
- **A conditional on `landmarks.length`** — one fixed paragraph with names slotted in (`313-317`).
- **`demandProfile`** mapped through a 4-entry lookup into one fixed sentence (`334-346`).
- **`svc.tasksIncluded` / `tasksExcluded` / `typicalHours` / `modes`** — **identical for all
  342 localities** of a given service.
- **`trustSections(loc.name)`** — three sections whose text is the same on every one of the
  2,513 pages except for the place name (`compose.ts:352-378`).
- **FAQs**: 3 from `localFaqs` + 1 housing + 2 service + 1 global, drawn from shared pools by
  a deterministic hash.

So two localities with the same `housingProfile`, similar `demandProfile` and no
`helperSourceAreas` produce pages whose differences are: the name, the pincodes, the
neighbour names, the landmark names, and which pooled FAQs the hash selected.

**Why the existing gate does not settle this.** `scripts/seo/uniqueness.ts` applies two
tests, and both are satisfiable by name substitution:
- **MinHash/LSH near-duplicate at Jaccard > 0.6 on 5-word shingles.** Interpolating a
  distinct locality name into most sentences breaks a large fraction of 5-word shingles.
  The report records "no pair exceeded 0.60" — that is a real result, but it measures
  *lexical* difference produced by the substitution itself.
- **Local-token ratio ≥ 0.50** — literally *"share of main-content sentences containing the
  page's own name, alt names, pincodes, a neighbour, a landmark or its zone."* This measures
  how often the locality name appears, not whether the page says anything specific to it.

Only 24 of 2,513 pages (0.95%) failed, all for local-token ratio. A gate that passes 99% of
a programmatically-generated corpus is measuring the generator, not the content.

**Why it is a problem.** Google's March 2024 spam policy on *scaled content abuse* targets
"generating many pages primarily for search rankings rather than for people," explicitly
including cases where pages are made from a template with location swapped in. Historically
this pattern also draws *doorway page* classification. Real-world outcomes are usually not a
manual penalty but **soft-404s, "Crawled – currently not indexed" at scale, and a site-wide
quality signal that suppresses the pages that would otherwise rank** — including the good
hub pages.

To be fair to the implementation: this is a *far* better version of this pattern than most.
The data layer carries genuinely local facts (pincodes, real landmarks, curated neighbours,
housing profiles, commute notes), `[VERIFY]` claims are withheld rather than asserted, and
2,489 vs 24 is a deliberate quality gate that most competitors do not have at all. The
problem is not fabrication — it is that the *volume of pages exceeds the volume of genuinely
distinct information available*.

**Evidence.**
- `data/seo/quality/gate.json`: 2,513 gated, 2,489 indexable, 24 noindexed, all 24 for the
  same reason.
- `docs/seo/quality-report.md`: "no pair of same-type pages exceeded the 0.60 Jaccard threshold."
- `compose.ts` — the four `housingProfile` branches are the primary source of prose variance
  across 2,052 pages.

**Recommended solution — reduce surface, raise the bar, measure with Google's own data.**

1. **Get the actual data before acting.** Google Search Console → Pages report. Count
   *Indexed* vs *Crawled – currently not indexed* vs *Discovered – currently not indexed*
   for the `/[city]/[area]/[slug]` group specifically. `npm run seo:gsc` already exists
   (`scripts/seo/gsc-report.ts`). If the majority of the 2,052 are unindexed, Google has
   already made this decision and the remediation is urgent rather than precautionary.
2. **Publish service×locality pages only where the locality has genuinely local data.**
   Gate on `localIntro` word count ≥ 120 **and** `landmarks.length ≥ 3` **and**
   `localFaqs.length ≥ 3` **and** `helperSourceAreas.length ≥ 1` — the fields the data model
   already defines and `composeServiceLocality:392-395` already computes as `missingRequired`
   but does **not** currently use to noindex. Ship perhaps 300–600 of these, not 2,052.
3. **Keep all 342 locality hubs.** Those carry real per-area information and are the right
   granularity for "maid service in X".
4. **Raise the local-token floor for service×locality to ~0.65**, and add a second metric the
   current gate lacks: *share of sentences that do not appear on any other page* (exact
   sentence-level dedupe after name normalisation). That measures what the Jaccard test is
   being credited with measuring.
5. **Do not delete — demote.** Set the failing pages to `noindex, follow`. They keep their
   internal-link value, the URLs stay valid, and each one becomes indexable the moment real
   local content is written for it. The `gate.ts` machinery already supports exactly this.

**Business impact if unaddressed:** the site's entire organic strategy rests on these pages.
A scaled-content classification does not just fail them — it drags down the city hubs and
trust pages that would otherwise rank well.
**Effort:** the gate change is ~20 lines in `uniqueness.ts` plus a threshold in `compose.ts`.
The content work behind it is months of operator input. Start with the measurement.

---

## [FIN-SEO02] The OG image endpoint is blocked in `robots.txt`

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** SEO

**Location:** `next-app/app/robots.ts:10`; images generated at `lib/seo-engine/page-metadata.ts:9-12`

Every page's `og:image` and `twitter:image` points at `/og?t=…&s=…`. `robots.txt` blocks that
URL twice over: `Disallow: /og` and `Disallow: /*?*`. **Verified live.**

Facebook, WhatsApp and X ignore `robots.txt`, so link previews still work in chat and social
— which is why this has gone unnoticed. But Google respects it, so:
- Google Images cannot index a single OG image for the site;
- rich results and Discover surfaces that use the OG image have nothing to fetch.

**Fix:** remove `Disallow: /og` (and `/*?*`, per FIN-B10). If the open-generator risk in
FIN-S05 concerns you, sign the parameters rather than blocking crawlers — signing solves both
problems, blocking solves neither properly.

---

## [FIN-SEO03] `Disallow: /*?*` blocks paid-traffic landing URLs

Covered as **FIN-B10** in `03-BUGS.md` — cross-referenced here because it is primarily an
SEO/SEM configuration issue. Self-referencing canonicals are already emitted on every page,
which is the correct and sufficient control for parameter duplication.

---

## [FIN-SEO04] The two legal pages are outside the sitemap and carry no breadcrumb schema

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** SEO

**Location:** `lib/seo-engine/sitemaps.ts:22-30` (`TRUST_PAGES`), `app/privacy-policy/page.tsx`, `app/terms-of-service/page.tsx`

`TRUST_PAGES` lists `/how-we-verify`, `/replacement-policy`, `/pricing`, `/about`,
`/contact`, `/services`, `/blog`. It omits `/privacy-policy` and `/terms-of-service`. Both
pages are indexable (`staticMetadata` defaults `index: true`) and linked from the footer, so
they will be found — but they are absent from the sitemap and, unlike every other page on
the site, emit no `BreadcrumbList` JSON-LD because they hand-roll their breadcrumb markup
instead of using `TrustPage`.

**Fix:** falls out of FIN-B01 — moving both onto `TrustPage` gives them breadcrumb schema
automatically. Add both to `TRUST_PAGES` with a real `lastmod`.

Related: the `TRUST_PAGES` `lastmod` values are hard-coded `'2026-09-05'` string literals.
They will silently go stale. Derive them from the file's git mtime or a per-page constant
that lives with the page.

---

## [FIN-SEO05] The home page emits a single-item BreadcrumbList

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** SEO

**Location:** `lib/seo-engine/compose.ts:912` — `const crumbs: Crumb[] = [{ name: 'Home', path: '/' }]`

A `BreadcrumbList` with one `ListItem` conveys nothing and can produce a "breadcrumb trail
has only one item" note in the Rich Results Test. Harmless, but noise in Search Console.

**Fix:** in `composeHome`, pass `jsonld: [...(faqs.length ? [faqLd(faqs)] : [])]` and skip
`breadcrumbLd` when `crumbs.length < 2`. Also skip rendering the `<nav aria-label="Breadcrumb">`
in `SeoPage` for a single crumb — currently it renders a lone `<span aria-current="page">Home</span>`,
which is meaningless to a screen-reader user too.

---

## Keyword cannibalisation and duplication analysis

Examined specifically, as requested. The URL architecture is deliberately designed against
cannibalisation and mostly succeeds:

- **`RESERVED_SLUGS`** (`data/seo/index.ts:94-123`) prevents any city, zone, locality or
  entity from taking a slug that a service or system route owns. This is the right control
  and it is enforced by the validator.
- **One "maid service" umbrella page**, not one per locality — `/services/maid-service` owns
  the generic term, and `services.ts:1-5` documents the decision explicitly.
- **No service×zone pages.** Zones link straight to service×locality, avoiding a third
  competing tier for the same query.
- **`altNames` are on-page keyword variants, never separate URLs** — the correct call.
- **Pincode pages exist only for many-to-many pins**; 1:1 pins 301 to their locality hub, so
  a pincode and a locality never compete for the same query.

**Where competition does exist, and is real:**

1. `/[city]/[locality]` vs `/[city]/[locality]/[service]` — "maid service in Dwarka" vs
   "part-time maid in Dwarka". Different intents, defensible.
2. `/services/[service]/[city]` vs the six `/[city]/[locality]/[service]` pages beneath it —
   "cook in Delhi" is genuinely competed for by 84 Delhi locality-cook pages, all of which
   contain "cook" and "Delhi". This is the real cannibalisation risk, and it is another
   argument for FIN-SEO01's recommendation to reduce the service×locality tier.
3. `/[city]/[zone]` vs `/[city]` — zone pages are thin by design (their content is a list of
   localities plus a curated intro) and 35 of them sit between two stronger tiers.

**Are 2,513 pages "automatically good SEO"?** No — and this codebase, to its credit, does
not assume so: it has a gate, it noindexes failures, and `ASSUMPTIONS.md` records the
deliberate refusal to publish invented social proof. The gap is that the gate measures
lexical novelty rather than informational value. Fixing the metric is the highest-leverage
SEO change available.
