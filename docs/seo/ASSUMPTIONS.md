# Assumptions & Decisions Log

Every business decision made during the SEO rebuild, with a one-line rationale.
Decisions marked **[operator]** were answered explicitly by the operator on 2026-09-05;
the rest are recorded assumptions applying the documented recommendation, reversible by
editing one data file unless noted.

## Operator-confirmed decisions

1. **[operator] SPA moves to `/app/*`.** The booking SPA vacates `/services/:id`, `/home`,
   `/pricing` etc. and lives under `/app/*` (`/app`, `/app/auth`, `/app/services/:id`,
   `/app/bookings`, `/app/profile`, `/app/pricing`, `/app/onboarding`, `/app/terms`,
   `/app/splash`), freeing `/services/[service]` for indexable hubs and `/pricing` for the
   trust page. Old SPA paths 301 to the new ones.
2. **[operator] Out-of-footprint legacy URLs → 410.** The 34 legacy cities outside
   Appendix B (and all their locality/salary/city-hub pages) return 410 Gone. Any URL a
   future GSC export shows to carry equity can be flipped to a 301 in `redirects.csv`.
3. **[operator] Postnatal folds into babysitter-nanny.** All 574 legacy postnatal-care
   URLs 301 to the babysitter-nanny equivalent for their location; "japa maid /
   postnatal" become on-page keyword variants of babysitter-nanny pages.
4. **[operator] Pricing bands derive from the app's published prices.** Bands are built
   around SPA `constants.js` prices (part-time ₹5,000; cook ₹12,000; nanny ₹16,000;
   elder-care ₹17,000; full-time ₹19,000/mo), identical across all three city pricing
   tiers for now, labelled indicative. Refine per-tier by editing `data/seo/services.ts`.

## Recorded assumptions (recommendation applied, operator may override)

5. **Non-Appendix-B localities in footprint cities → 301 to the city hub** (e.g. legacy
   Delhi localities not in Appendix B). Rationale: keeps users and equity in-city without
   creating out-of-footprint pages; flip individual rows to 410 in `redirects.csv` if preferred.
6. **Salary-guide pages**: footprint cities 301 → `/pricing`; out-of-footprint → 410.
   Rationale: `/pricing` owns the pricing intent; the topical blog post
   `maid-salary-trends-india-2026` (kept) owns the editorial salary intent.
7. **AdSense is removed from all location/service (money) pages and kept only on blog
   pages.** Rationale: ad scripts hurt CWV and quality signals exactly where rankings are
   being fought for; blog keeps the revenue surface. Reverting = re-adding one component.
8. **domestic-help is kept as the sixth page-generating service** per Appendix A's default
   architecture (the brief reserves dropping it as an option; nothing legacy redirects to
   it either way).
9. **Canonical host stays apex `https://mybuddymaid.in`**, matching everything indexed
   today; www gets a 308 to apex once its (currently expired) certificate is fixed in Vercel.
10. **Trailing-slash policy: no trailing slash**, matching live canonicals; slash variants 301.
11. **Trust-page content** (`/how-we-verify`, `/replacement-policy`) is written strictly
    from claims the company already publishes (site copy + SPA TermsPage replacement
    terms: Silver 3 / Gold 5 / Diamond 10 replacements, 60-day refund rule). Anything not
    already published is omitted rather than invented; the operator should review before
    indexing.
12. **Lead capture**: primary conversion is WhatsApp (`wa.me/919355114869` with
    locality+service prefilled) + `tel:+919355114869` + deep-link into the booking app via
    the existing `mbm_redirect_context` handshake (now pointing at `/app/auth`). An
    unauthenticated lead form is scaffolded but ships disabled behind an env flag until
    the accompanying Supabase migration (new `leads` table) is applied — the repo cannot
    apply DB migrations itself.
13. **Support phone number**: `9355114869` is treated as canonical (used by every tel/wa.me
    link); the stray display-only "+91 93184 29135" in PricingPage is treated as stale copy.
14. **Blog port**: the 25 `blog/*` + 3 flat `blog-*` + 7 comparison guides are ported
    verbatim (content-preserving) to the new `/blog/[slug]` route; flat and comparison
    slugs 301 into `/blog/*`. Editorial rewrite is out of scope for this rebuild.
15. **Copy drafting**: locality prose (localIntro, commuteNotes, housingNotes, localFaqs)
    is drafted by Claude during the rebuild under the same constraints the brief sets for
    `scripts/seo/draft-copy.ts` (only that locality's data fields, no underivable claims,
    `[VERIFY]` on anything uncertain, committed with `reviewed: false`); the script itself
    is still delivered for future re-drafting via the Anthropic API.
16. **Baseline branch**: work happens on `seo-rebuild` branched from `main` (64f6e771) in a
    fresh clone at `C:\Users\conta\dev\mybuddymaid`; the OneDrive folder
    `mybuddymaid-main` is a stale unversioned snapshot and is left untouched.
17. **Greater Noida pincode prefixes**: Appendix B's validator rule (Greater Noida
    `2013xx`/`2032xx`) is applied as written; legacy rows 203207 (Dadri) and 203201 map to
    the `2032xx` allowance.

## Decisions made during implementation (Phases 2–4)

18. **Zone consolidation.** The brief's suggested zone map listed a few zones that would
    have had fewer than three localities once Appendix B was normalised, which the
    validator forbids. Merged: Greater Noida "outskirts" into `greater-noida-central`
    (Dadri and the 203201 belt), and Gurgaon `manesar` into `new-gurgaon` (Manesar and
    IMT Manesar). Pimple Saudagar was placed in `pcmc` rather than `pune-west` because it
    is in Pimpri-Chinchwad; Fraser Town moved to `bangalore-north` and Malleswaram to
    `bangalore-west` so both zones clear the three-locality minimum. Result: 35 zones.
19. **Green Park vs Safdarjung Enclave (Appendix B.9.5).** Applied the brief's own
    proposal: `green-park` at 110016 alongside Hauz Khas, and `safdarjung-enclave` at
    110029 with "Green Park belt" and "AIIMS area" as alt names. Confirm if you prefer a
    single record.
20. **Rashtrapati Bhawan (110004) and Central Delhi (110011)** carry no locality hub, per
    Appendix B.9.7. They are attached as city- and zone-level pincodes so the areas stay
    serviceable without generating a page for a non-residential market. Same treatment for
    Mangalore 575001/575036 and Greater Noida 203201.
21. **Service × zone pages are not enabled.** The brief makes them optional, gated on a
    zone carrying 500+ words of zone-specific content. No zone has that data yet, so zone
    hubs link straight to service × locality pages. Turning them on later is a routing
    change only; the data layer already supports it.
22. **Four localities have no coordinates.** Nominatim could not resolve Shakur Basti
    (Delhi), Kasna (Greater Noida), Kodialbail and Kulshekar (Mangalore) after three query
    forms each. They keep their hand-curated neighbour lists, which pass the validator's
    minimum, and are excluded from distance refinement. Re-run `npm run seo:geocode` if
    better source data appears.
23. **`[VERIFY]` sentences are dropped, not published.** Sixty-three localities carry at
    least one drafted sentence marked `[VERIFY]` (mostly metro-proximity and helper-origin
    claims). Rather than noindex those pages wholesale, the composer removes the marked
    sentence at render time: the claim is withheld, never asserted. The localities stay
    flagged for review. Confirm or correct them and the sentences can be restored.
24. **Analytics load on first interaction or after 4 seconds.** gtag.js is ~190KB and cost
    roughly 560ms of main-thread blocking when loaded eagerly, which was the single
    largest Core Web Vitals cost. Click events queue into `dataLayer` and flush when it
    loads, so no lead attribution is lost. The trade-off is a missing `page_view` for a
    visitor who leaves within a few seconds without interacting at all.
25. **One font family.** Plus Jakarta Sans was dropped in favour of Inter alone. The
    second family cost ~28KB and an extra preload on the critical path and moved First
    Contentful Paint from 0.9s to 2.8s.
26. **CTA buttons are server-rendered.** They are plain anchors tagged with `data-mbm-*`
    attributes, with one delegated listener converting clicks into GA4 events. This
    removes the React client boundary from every SEO page. Bulk in-content links are plain
    `<a>` elements rather than `next/link`, per the brief's internal-linking rule, which
    also stops Next.js prefetching ~40 RSC payloads per page.
27. **Legacy blog content is ported verbatim.** All 35 posts (25 `blog/*`, 3 flat
    `blog-*`, 7 comparison guides) moved to `/blog/[slug]` with their content preserved;
    only the wrapper chrome, the old CTA blocks and `.html`/`/home` links were rewritten.
    Editorial review of these posts is outstanding — several contain the pre-rebuild
    "police verified" and salary claims that should be checked against current policy.
28. **`/services` is a real page again.** The booking SPA moved to `/app/*`, so
    `/services` and `/services/[service]` are indexable hubs. The old robots.txt disallow
    on `/services` is gone.
29. **AdSense remains only on blog pages.** It is loaded lazily there and nowhere else.
30. **The lead form ships disabled.** `LEADS_ENABLED` and `NEXT_PUBLIC_LEADS_ENABLED`
    default to unset, because the `leads` table and its RLS policy need a Supabase
    migration this repository cannot apply. Until then the CTAs are WhatsApp, phone and
    the booking app, all of which are live. The API route validates every location value
    against the data layer, so nothing outside the footprint can ever be submitted.
31. **A cross-city slug collision was found and fixed.** `sector-50` exists in both Noida
    and Gurgaon. The first version of the enrichment merger keyed fragments by slug alone,
    which silently wrote 18 Noida sectors into Gurgaon's file. Fragments are now keyed by
    batch → city explicitly, and the merger rejects any slug that is not a locality of the
    named city. Worth remembering for any future importer.
32. **The booking app now reads the data layer.** `npm run seo:export-spa` writes
    `app/src/lib/serviceability.json` from `data/seo`, and the Vite app consumes it
    through `app/src/lib/serviceability.js`. The booking form's single "State" dropdown
    (29 hard-coded Indian states) is replaced by City → Area selects listing only served
    localities with their pincodes; the onboarding and profile pages now offer the eight
    served cities. `INDIAN_STATES` is deleted from `app/src/lib/constants.js`. The
    `bookings.city` column is free text and needs no migration: it now receives
    "Locality, City" instead of a state name, which is what operations actually need.
    Any previously saved profile value that is not a served city stays selectable so it
    is never silently lost. Re-run `seo:export-spa` and `node scripts/build-spa.mjs`
    whenever the footprint changes.
33. **The legacy site and its build pipeline are deleted.** `mybuddymaid/` (3,846 generated
    pages), `seo-generator/`, `scripts/merge-build.js`, `inject-head-scripts.ps1` and the
    root `vercel.json` are gone, and the root `package.json` now delegates to `next-app`.
    Leaving them in place meant a deploy from the repo root would still ship the retired
    static site, and its rewrites of `/services` and `/pricing` collided with two new
    indexable pages. The exact URL set the legacy site published is preserved in
    `docs/seo/legacy-urls.txt` and its generator data in `docs/seo/legacy-data/`, and
    `gen-redirects.ts` reads those, so the redirect map is still reproducible byte for
    byte (verified: identical output before and after the deletion). **Vercel's project
    Root Directory must be set to `next-app`.**
34. **`.html` redirects removed from `next-app/vercel.json`.** Platform redirects run
    before middleware, so those rules turned every legacy `.html` URL into a two-hop chain
    (`.html` → clean → 301/410). `proxy.ts` already normalises the extension itself and
    resolves in one hop. The local redirect check ran against `next start`, where
    vercel.json redirects do not apply, which is why it did not catch this. The deprecated
    `X-XSS-Protection` header was dropped at the same time.
35. **Fabricated testimonials removed from the booking app.** `app/src/pages/PricingPage.jsx`
    carried three invented named reviewers with 5-star ratings, and a "Pan-India coverage
    (7+ cities)" claim. Both are gone; the coverage line now names the cities we actually
    serve. Real reviews can be added when they exist.
36. **Pricing has one source.** `data/seo/services.ts` (salary bands) and the new
    `data/seo/plans.ts` (platform plans) now feed the trust pages and, through
    `seo:export-spa`, the booking app. The hard-coded plan table in the Next.js pricing
    page and the point prices and `PLAN_DETAILS` in `app/src/lib/constants.js` are gone;
    only presentation (colours, emoji, feature bullets) stays local. The booking app's
    `postnatal` service has no band in the data layer, so it displays "Premium" as before.
37. **Deployment-protection bypass for automated checks.** Vercel preview deployments are
    protected by default: every request 302s to `vercel.com/sso-api`, so `check-redirects`
    and `crawl` would measure Vercel's login flow rather than the site. Both scripts now
    route through `scripts/seo/_fetch.ts`, which sends the
    `x-vercel-protection-bypass` header when `VERCEL_AUTOMATION_BYPASS_SECRET` is set and
    otherwise fails fast with instructions. Running them against production needs no
    secret. This matters because the preview is the *only* environment that exercises the
    `vercel.json` layer — platform redirects run before middleware, and `next start`
    ignores them entirely.
38. **OpenStreetMap is a candidate source for Phase 5, not a fact source.** Measured in
    the 2026-09-06 pilot: a 1,200 m Overpass sweep of Sector 76 returned 400 elements, 7
    of them named, and only 3 with more than four tags — all three metro stations. No
    residential way carried `building:levels`, `operator`, `start_date` or `units`. So
    `--osm` produces names, positions and parent localities; every entity-specific fact
    comes from the operator through `--export-worksheet` → `--csv`. The eight worksheet
    columns (towers or blocks, approximate homes, builder, possession year, typical flat
    sizes, helper entry process, who issues the helper ID card, service lift) were chosen
    as things an agency placing maids already knows and a household actually asks about.
    Nothing about them is inferred or generated.
39. **Entity candidates are attributed to the nearest Appendix-B locality, not the one
    queried.** A radius search around one centroid also sweeps its neighbours: 5 of 22
    pilot candidates landed under the wrong parent, the worst being `DLF Phase 3-U Block`
    at 1,761 m from DLF Phase 1 and 233 m from DLF Phase 3. Publishing "…is a society in
    DLF Phase 1" would have been a fabricated fact (rule 3). Candidates further than
    2,000 m from every Appendix-B locality are rejected rather than attached to the least
    bad parent. Sector names, plot codes and names identical to the parent locality are
    rejected too — a sector belongs in Appendix B or nowhere, and an entity named after
    its parent restates the locality page's intent (rule 2).
40. **The readiness gate counts entity-specific facts only.** It previously counted every
    key in `facts`, including the four inherited from the parent locality, which are
    identical for every entity under that parent — so a single operator fact plus four
    borrowed ones passed a "5 facts" check and produced a facts block that repeated across
    the whole locality. `INHERITED_FACT_KEYS` in `data/seo/entities.ts` now excludes them
    from the count; they are still rendered, because they are true and useful.
41. **Entity pages are gated, and the gate fails closed for them.** `seo:gate` and
    `seo:jsonld` composed `allCorePages()` only, so no entity path ever received a verdict
    — and `gateFor()` treats an unknown path as a reviewed hand-written page and returns
    `index: true`. Every `ready` entity would have shipped indexable without a duplicate
    check, against rule 8. Both scripts now compose entity pages, and `gateFor()` returns
    `noindex` for an ungated path on the 4-segment entity route. Entity pages are ISR, so
    an entity promoted after the last gate run would otherwise be served unchecked.
42. **One page per entity, not entity × service — decided by the owner, 2026-09-06.**
    A round-trip test promoted one entity and the gate noindexed 5 of its 6 service pages
    at 0.72–0.76 Jaccard: the facts block, the access paragraph, the verification section
    and two of five FAQs are identical across services, and ~480 words leaves no room to
    separate them. The five extra URLs would have existed only as noindexed filler, so
    entity pages moved to `/<city>/<area>/<entity>`, covering all six services on one
    page; the service cards and the pricing table link to the locality money pages, which
    is also what keeps those linked from every entity page. The parent locality page links
    its entities so they are never orphans. Re-measured after the change: 906 words, 0.64
    local-token ratio, indexable, no duplicate pair anywhere in the estate. This lowers the
    Phase 5 projection from ~100,000 pages to ~17,000, which the owner accepted — the gap
    to 200 leads/day comes from more entities per locality, the Google Business Profile
    and paid search, not from more URLs per entity.
43. **Entity pages are prerendered, not ISR.** The original route used
    `dynamicParams = true` with a 24-hour revalidate. An entity only changes when
    `entities.json` is committed, which already requires a deploy, so ISR bought nothing
    and would have served pages the quality gate had not seen. They are now built with the
    service × locality pages from the same `generateStaticParams`. `gateFor()` still fails
    closed for a `ready` entity with no verdict, as a second guard.
44. **The first entity batch covers only societies where we already have placements.**
    The owner's decision, and the same fulfilment-bound logic as the eight-city footprint:
    the facts the worksheet asks for (towers, entry process, who issues the helper ID
    card) are already in the CRM and WhatsApp history for those societies, so every
    published fact is verifiable, and those are the societies that actually convert.
