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
