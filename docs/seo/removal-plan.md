# Removal Plan — Legacy SEO Layer → Programmatic Local SEO System

Phase 1 deliverable. Nothing is deleted until this plan is approved (Phase 2 gate).
Companion documents: [AUDIT.md](AUDIT.md), [url-inventory.csv](url-inventory.csv).

## 0. Context that shapes the plan

Two facts discovered in the audit change how "removal" works here:

1. **The live site is NOT next-app.** Production at `https://mybuddymaid.in` is the root
   pipeline: Vite SPA (`app/`) + the entire `mybuddymaid/` static folder merged into
   `app/dist` by `scripts/merge-build.js`, served via root `vercel.json`
   (verified byte-identical robots.txt / sitemap.xml / homepage). next-app — the rebuild
   target — has never shipped and currently has maintenance mode hard-coded ON.
2. **The legacy pages are generated output, not source.** `seo-generator/` (generate.js +
   templates + JSON data) writes the ~3,846 HTML files into `mybuddymaid/`. Removing the
   legacy SEO layer means removing the generator, its data, and its output together.

So Phase 2 is not "delete pages from the live codebase" — it is: build the redirect layer
into next-app, cut production over to next-app, and retire the root pipeline. The old URLs
only stop resolving at cutover, which is exactly when the redirects go live. Zero-gap.

## 1. DELETE (at Phase 2 cutover, after redirects are implemented and verified)

| What | Paths | Why |
|---|---|---|
| Legacy static SEO site | `mybuddymaid/` (3,846 HTML: 3,444 service×location + 252 best-×city + 42 salary + 42 cities/ + 20 state/ + 28 blog + 18 hubs/guides; plus its robots.txt, sitemap.xml, styles.css, script.js) | Doorway-pattern estate covering 42 cities (34 outside the Appendix B footprint); replaced by the new page system. Blog content is ported first (see KEEP). |
| Static-page generator | `seo-generator/` (generate.js, build-blogs.js, build-cities.js, check-links.js, fix-links.js, templates/, data/*.json) | Superseded by `data/seo/` + Next.js generation. Its cities/localities/blogs JSON is archived to `docs/seo/legacy-data/` first — it is the source for the redirect map and blog port. |
| Root merge pipeline | `scripts/merge-build.js`, root `package.json` build script, root `vercel.json`, `inject-head-scripts.ps1` | The deployment moves to next-app; the merge hack and the head-script regex injector die with it. SPA rewrites move into next-app config. |
| next-app legacy [slug] system | `app/(site)/[slug]/page.tsx`, `lib/seo/slug-parser.ts`, `lib/seo/metadata.ts`, `lib/seo/schema.tsx`, `data/cities.ts`, `data/services.ts`, `data/faqs/city-service-faqs.ts` | The 41-city × 6-service flat-slug system is the wrong architecture (best-X-in-Y slugs, per-city LocalBusiness for non-operational cities, 95% templated copy). Replaced by `data/seo/` + the hub-and-spoke routes. |
| next-app iframe homepage | `app/(landing)/page.tsx`, `components/LandingPageContent.tsx`, `public/_landing/` | 0-word iframe homepage, blocked by its own X-Frame-Options DENY, with broken relative assets and an unverifiable aggregateRating 4.9/500-review LocalBusiness. Rebuilt as a server-rendered page. |
| next-app sitemap/robots | `app/sitemap.ts`, `app/robots.ts` | Replaced by sitemap-index + shards and new robots per the target architecture. |
| Maintenance takeover | `lib/maintenance.ts` hard-coded flag + `proxy.ts` rewrite (mechanism kept, flag env-gated) | As committed it serves the maintenance page on every route at HTTP 200 with no noindex. |
| Dead code | `next-app/lib/supabase/{client,server}.ts` (imported nowhere) | Unused; misleading "service role" comment is a foot-gun. Re-add properly if/when needed. |
| Misc SEO debris | `mybuddymaid/state/*` (orphaned, "1 Cities" title bug), empty JSON-LD block in blog template, unpkg phosphor CSS-as-script tag | Broken artifacts. |

## 2. KEEP (untouched logic; metadata redone in Phase 4)

- **`app/` Vite SPA** — auth, onboarding, booking flow (Supabase `bookings` insert +
  `send-booking-email` edge function), bookings dashboard, profile, pricing/plans,
  DPDP delete-account. All of it is noindex by design and stays that way.
  Two integration contracts to preserve at cutover:
  - the `sessionStorage['mbm_redirect_context']` handoff from marketing pages → `/auth`;
  - same-origin embedding (a proper `vite build --base=/_spa/` step must be scripted —
    today `next-app/public/_spa/` is a committed, unreproducible hand-built bundle).
  - next-app's rewrites must add the missing `/pricing`, `/onboarding`, `/terms` routes.
- **Supabase backend** — schema, RLS, edge functions (live only in Supabase; export before
  any change). The lead form rewiring in Phase 3 adds to it, never breaks it.
- **Blog content** — 25 `blog/*` posts + 3 flat `blog-*` posts + 7 comparison guides are
  KEPT as content: ported to a Next.js blog route (likely `/blog/[slug]`) with their URLs
  preserved or 301'd (flat `blog-*` → `/blog/*`). Editorial rewrite is out of scope.
- **Legal/trust text** — SPA TermsPage, next-app privacy-policy/terms-of-service pages
  (content kept; metadata and internal linking redone in Phase 4).
- **Analytics identities** — GA4 `G-R24QC81J4P`, Umami `90b0b752…`, Vercel
  Analytics/Speed Insights. (AdSense: decision needed, §5.)
- **ads.txt** — kept as long as AdSense stays.
- **Brand assets** — logo, favicons, service photos (re-encoded to AVIF/WebP in Phase 4;
  filenames with spaces fixed with redirects if ever linked).

## 3. Redirect strategy (`docs/seo/redirects.csv` built in Phase 2)

**Scale**: ~3,850 old clean URLs (+ their `.html` variants). Way over the ~500-rule
threshold → implement as a **prebuilt lookup map in next-app middleware (`proxy.ts`)**,
generated from `seo-generator/data/*.json` + the new `data/seo/` layer, with pattern rules
as fallback. Single-hop only: `.html` variants are caught by the middleware and sent
straight to the final new URL (no `.html → clean → new` chains).

Mapping rules (old → new), using the Appendix B footprint (8 cities) and service mapping
`maid→locality-hub`, `full-time-maid→full-time-maid`, `cook→cook`, `nanny→babysitter-nanny`,
`elderly-care→elder-care`, `postnatal-care→(decision, §5)`:

| Old pattern | In footprint? | New target | Status |
|---|---|---|---|
| `/{svc}-service-in-{locality}-{city}` | locality matches Appendix B (incl. alt names) | `/{city}/{locality}/{new-svc}`; maid-service rows → `/{city}/{locality}` (locality hub) | 301 |
| `/{svc}-service-in-{locality}-{city}` | footprint city, locality NOT in Appendix B | `/{city}` city hub (default) — or 410; decision §5 | 301/410 |
| `/{svc}-service-in-{city}` and `/best-{svc}-service-in-{city}` | city in footprint (delhi, noida, gurugram→gurgaon, mumbai, navi-mumbai→mumbai zone, pune, bangalore, mangalore) | `/services/{new-svc}/{city}`; maid rows → `/{city}` | 301 |
| same | city NOT in footprint (34 of 42: agra, patna, thane, ghaziabad, faridabad, hyderabad, chennai, kolkata…) | none | **410** (unless GSC export shows equity → then 301 to `/services/{new-svc}`) |
| `/cities/{city}` | footprint | `/{city}` | 301 |
| `/cities/{city}` | non-footprint | none | 410 |
| `/{svc}-service` hubs | all | `/services/{new-svc}` (`/maid-service` → `/services/maid-service`) | 301 |
| `/domestic-help-salary-in-{city}-2026` | any | `/pricing` (or blog salary guide; decision §5) | 301 |
| `/state/{state}` | — | none (never in sitemap, orphaned) | 410 |
| `/blog/{slug}` | — | same URL on new blog route | 200 (no redirect) |
| `/blog-{slug}` (flat) | — | `/blog/{slug}` | 301 |
| comparison guides | — | `/blog/{slug}` equivalents | 301 |
| `/cities`, `/salary-guides` | — | `/` and `/pricing` (or blog) | 301 |
| `/services` (static services.html) | — | becomes the new services index or 301 to `/` | decision §5 |
| `/index.html`, any `/*.html` | — | final new URL in one hop | 301 |

**Host & URL hygiene at cutover** (all single-hop 301/308):
- Canonical host stays apex `https://mybuddymaid.in` (matches everything indexed today).
- **Fix www**: provision/renew the certificate in Vercel (currently EXPIRED — https://www is
  dead) and 308 `www → apex`.
- Add trailing-slash normalization (today `/cities` and `/cities/` both 200 with no redirect).
- Keep real-404 behavior for unknown slugs (already correct on live).

**Verification** (`scripts/seo/check-redirects.ts`): every one of the ~3,850 old URLs +
sampled `.html` variants asserted to resolve in exactly one hop to a 200 (or a deliberate
410), zero chains, zero loops; crawler reports zero internal links to redirecting URLs.

**GSC input**: no `docs/seo/gsc-pages.csv` exists in the repo, so per the brief every old
indexable URL is treated as needing a redirect/410 decision. If a GSC "Pages" export is
provided before Phase 2, it will be used to rank redirect priority and to promote
would-be-410 URLs with real impressions to 301s.

## 4. Cutover sequence (Phase 2, after approval)

1. Build the `data/seo/` skeleton (Phase 3 head-start) so redirect targets exist as data.
2. Implement middleware redirect map + host/slash rules in next-app; port blog; fix the
   `_spa` build script and rewrite gaps; env-gate maintenance mode (OFF by default).
3. Verify on a preview deployment: `check-redirects.ts` green, crawler green.
4. Switch the Vercel production project to next-app (or repoint the domain).
5. Delete the items in §1; commit `seo: remove legacy SEO layer, add redirect map`.
6. Watch GSC coverage + 404 reports for a week; keep the legacy data archive for remapping.

## 5. Decisions needed before Phase 2 (blocking)

1. **`/services/:id` collision** — the booking SPA owns `/services/:id` (rewrites) and
   robots.txt disallows `/services`, but the target architecture puts indexable service hubs
   at `/services/[service]`. Options: (a) move the SPA to `/app/*` paths (needs redirects +
   handoff testing), or (b) move SEO hubs elsewhere. Recommendation: (a).
2. **postnatal-care service** — Appendix A folds "japa maid (postnatal)" into
   babysitter-nanny "only if we offer it". 574 legacy postnatal URLs need a target:
   301 to `/{…}/babysitter-nanny`, or 410?
3. **Non-footprint city equity** — 410 (recommended, clean footprint) vs 301-to-service-hub
   for the 34 out-of-footprint cities. A GSC export would settle which URLs carry equity.
4. **Non-Appendix-B localities in footprint cities** — 301 to city hub (recommended) or 410?
5. **Salary-guide pages** — redirect to `/pricing`, or keep as blog content (they earn
   long-tail salary queries; "2026" slugs need a year-neutral home)?
6. **AdSense on SEO pages** — every programmatic page currently runs AdSense; it hurts CWV
   and quality signals on money pages. Keep, restrict to blog, or drop?
7. **domestic-help service** — Appendix A asks whether it's a distinct offer or folded into
   the hubs. Legacy has no domestic-help pages (only salary guides), so nothing redirects
   there either way; needed for Phase 3 services.ts.
