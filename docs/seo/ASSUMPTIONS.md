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
