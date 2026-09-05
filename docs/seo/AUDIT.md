# MyBuddyMaid — Phase 1 SEO Audit

Date: 2026-09-05 · Read-only audit · Companion files: [url-inventory.csv](url-inventory.csv), [removal-plan.md](removal-plan.md)
Method: 7 parallel code auditors over the repo + live fetches of mybuddymaid.in + 10-query SERP snapshot + Lighthouse (local Chrome, mobile simulation). Every claim below was verified by reading the named file or fetching the named URL.

---

## 1. Stack detection

| Item | Finding |
|---|---|
| Repo layout | **Four sub-projects**: `app/` (Vite 8 React 19 SPA, plain JSX — auth/booking/profile), `mybuddymaid/` (legacy static site, 3,846 generated HTML pages), `next-app/` (Next.js **16.3.0**, App Router, TypeScript strict, React 19.2.8), and `seo-generator/` (plain-Node generator that writes the static pages: `generate.js` + templates + `data/{config,services,cities,comparisons,blogs}.json`) |
| Package manager | npm everywhere (lockfiles in `app/` and `next-app/`; no root lockfile) |
| Hosting | Vercel. **Two competing deploy configs**: root `vercel.json` (deploys `app/dist` = Vite build + `scripts/merge-build.js` merging all of `mybuddymaid/` in, SPA index renamed `_app.html`) vs `next-app/vercel.json` (framework nextjs) |
| **What is actually live** | **The root merge deployment.** Verified: live `/`, `/robots.txt`, `/sitemap.xml` are byte-identical to `mybuddymaid/index.html`, `robots.txt`, `sitemap.xml`; `/home` serves the 1.2KB Vite shell as `_app`; response headers match root vercel.json exactly; zero `/_next/` markers anywhere. **next-app has never shipped.** |
| Middleware | next-app: `proxy.ts` (Next 16's rename of middleware.ts) — implements maintenance mode. Root deployment: none (pure vercel.json routing) |
| next.config / vercel.json split | `next-app/next.config.ts` contains **only** SPA rewrites — no redirects, no headers, no `images` config (consistent with zero `next/image` usage), no `trailingSlash` setting (so live's missing slash normalization would persist under next-app by default). Redirects (`.html`→clean, single-segment only) and security/cache headers live in `next-app/vercel.json`; the live root `vercel.json` carries its own cleanUrls + rewrites + `.html` redirect + headers |
| Maintenance mode | `next-app/lib/maintenance.ts` has `isMaintenanceActive: true` **hard-coded** — deploying next-app as-is serves a maintenance page (HTTP 200, no noindex, no metadata) on every route |
| i18n | None (only `en_IN` OG locale) |
| SEO packages | None — no next-seo, no next-sitemap; everything hand-rolled in `next-app/lib/seo/{metadata.ts,slug-parser.ts,schema.tsx}` + `app/sitemap.ts` + `app/robots.ts` |
| Analytics | GA4 `G-R24QC81J4P`, Umami `90b0b752-39a0-4d32-a614-8dcc9d242af8`, AdSense `ca-pub-4135055194908677` (on every page incl. all SEO pages and inside the logged-in SPA), Vercel Analytics + Speed Insights. **No GTM. No custom events anywhere** — no locality/service attribution on any conversion action |
| Env vars | `VITE_SUPABASE_URL/ANON_KEY`, `VITE_RZP_KEY` (app); `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` (next-app). Nothing else env-gated — maintenance flag, analytics IDs, site URL all hard-coded |
| Git | Working folder is **not a git repo**; real repo is github.com/harshitkrhere/mybuddymaid. Phase 2+ changes must be applied to a clone |
| Next 16 caveat | `next-app/AGENTS.md` warns this Next version has breaking changes (e.g. proxy.ts); rebuild code must follow `node_modules/next/dist/docs/`, not Next 13/14 conventions |

## 2. Route inventory

Full detail in [url-inventory.csv](url-inventory.csv). Counts:

**Live site (legacy static, what Google sees today): 3,846 HTML pages**
- 3,444 `{service}-service-in-{location}`: 6 services (maid, full-time-maid, cook, nanny, elderly-care, postnatal-care) × 574 locations (**42 cities + 532 localities** — the legacy site already went locality-level: Noida sectors, DLF phases, Sohna Road, Hauz Khas, Saket, plus 20 localities each in Chennai/Kolkata/Hyderabad etc.)
- 252 `best-{service}-service-in-{city}` (6 × 42 cities)
- 42 salary guides, 42 `cities/{city}`, 20 `state/{state}` (orphaned, title bug "1 Cities"), 28 blog pages, 17 hubs/guides + the homepage
- **34 of the 42 cities are outside the Appendix B footprint** (Agra, Patna, Guwahati, Thane, Ghaziabad, Hyderabad, Chennai, Kolkata…)
- No API routes exist anywhere: next-app has no `app/api/` and neither vercel.json defines functions (server logic lives in Supabase edge functions, covered in §7)

**Live sitemap: 1,702 URLs — only 44% of the estate.** All clean/extensionless, all `lastmod 2026-08-03`, single urlset (no index). Absent from it: three entire service families (maid, nanny, postnatal × 574 = 1,722), 387 full-time-maid + 3 elderly-care locations, all 20 state pages, and ~12 hub/comparison stragglers (4 service hubs, 6 comparison guides, `/services`, `/salary-guides`) = 2,144 served-but-unlisted pages.

**next-app (not deployed): 13 page files → 258 sitemap URLs.** 6 service hubs + 246 `best-{service}-in-{city}` (41 cities: 9 "primary" + 32 "expansion") + 5 marketing pages + home. Unknown slugs correctly hard-404 via `notFound()`.

**SPA: 10 client-only routes**, noindex by design, reached via rewrites (`/_app` live; `/_spa` in next-app).

## 3. Existing SEO surface (what Phase 2 removes)

- `seo-generator/` — generator, templates, JSON data (the true "source" of the legacy estate)
- `mybuddymaid/` — 3,846 generated pages + static robots.txt + static sitemap.xml
- `scripts/merge-build.js` + root `vercel.json` + `inject-head-scripts.ps1` (regex-mutates analytics into all 3,846 files)
- next-app: `[slug]` catch-all + `slug-parser.ts` + `metadata.ts` + `schema.tsx` + `data/cities.ts` (41 cities) + `data/services.ts` + `city-service-faqs.ts` + `sitemap.ts` + `robots.ts` + iframe homepage (`(landing)/page.tsx`, `LandingPageContent.tsx`, `public/_landing/`)
- No dynamic OG-image routes anywhere (`opengraph-image.*` absent from next-app); og:image everywhere is the static 800×800 `hero-new.png` — square, not 1200×630, and 715 KB
- Hard-coded location/service arrays found in **eight places**: seo-generator JSON, data/cities.ts, data/services.ts, sitemap.ts's own duplicated prefix map, Footer.tsx 10-city list, `_landing` 9-city areaServed, SPA `constants.js` SERVICES + INDIAN_STATES, robots.ts disallow list
- **No serviceability check exists anywhere.** The SPA's only geographic input is a 29-entry State dropdown stored in a Supabase column named `city` (default 'Delhi'). No city/locality/pincode capture on any lead

## 4. Live-site technical findings (fetched 2026-09-05)

| Area | Status |
|---|---|
| Canonical host | Apex `https://mybuddymaid.in`; http→https 308 OK. **`https://www.mybuddymaid.in` serves an EXPIRED TLS certificate** — the whole www variant is dead (http://www 308s into the broken https://www) |
| Trailing slash | **No normalization** — `/cities` and `/cities/` both 200, no redirect; only canonicals disambiguate |
| .html handling | `.html` → clean 308 single hop (root vercel.json + cleanUrls) — correct |
| 404s | Real 404s (Vercel NOT_FOUND), no soft-404 — correct |
| `/services` conflict | robots.txt **Disallows `/services`** and vercel.json rewrites it to the SPA, but Vercel's filesystem match wins and serves the static, indexable `services.html` — an indexable landing page that is crawl-blocked |
| CTA vs robots | Every SEO page's primary CTA points to `/home`, which is robots-disallowed (fine for crawl budget, but all conversion is behind a noindexed auth wall) |
| Verification | **No GSC or Bing verification tags/files on the live site or anywhere in the repo** (if verified at all, it's DNS-level — migrating DNS could silently drop it) |
| Canonical vs links | Page canonicals are clean URLs but **all internal links and BreadcrumbList items use `.html` URLs** — every internal link goes through a 308 |
| Schema | No AggregateRating/Review anywhere on live (good). But 252 per-city `LocalBusiness` blocks (city-level address only) + homepage LocalBusiness with a Bengaluru street address; next-app's `_landing` file adds `aggregateRating 4.9 (500 reviews)` with no review system and OfferCatalog prices contradicting `data/services.ts` |

## 5. Baseline quality — Lighthouse (mobile, simulated 4G, local Chrome) & CWV blockers

| Page | Perf | SEO | A11y | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| `/` (home) | **44** | 100 | 84 | 7.1 s | **12.8 s** | 560 ms | 0 |
| `/best-cook-service-in-delhi` (city page) | 67 | 100 | 88 | 3.1 s | 4.1 s | 356 ms | **0.117** |
| `/cook-service-in-adyar-chennai` (locality page) | 50 | 100 | 87 | 7.8 s | **10.3 s** | 329 ms | 0.049 |

*(Local Lighthouse runs — PSI API was quota-blocked. Every page fails the LCP < 2.5 s target; the city page also fails CLS < 0.1. Lighthouse SEO 100 across the board confirms the problem is content/architecture quality and performance, not basic tag hygiene.)*

Root causes, in priority order (all verified in code):
1. **715 KB `hero-new.png`** is the homepage LCP element and og:image — no srcset, no modern format, no width/height.
2. **LCP is JS-gated**: `.reveal { opacity: 0 }` is applied to the hero; visibility requires `script.js` (loaded at end of body, no defer) to run an IntersectionObserver. Without JS the page is blank below the nav.
3. Render-blocking Google Fonts `<link>` + 38 KB unhashed `styles.css` on all 3,846 pages (cached immutable for 1 year — stale-CSS hazard).
4. AdSense + GA4 + Umami + Vercel Insights + unpkg phosphor-icons on every page (incl. a bug loading a CSS file via `<script>`); Razorpay checkout.js parser-blocking in the SPA head.
5. next-app-specific: **zero `next/image` usage**; homepage is a client iframe that (a) is blocked by its own `X-Frame-Options: DENY`, (b) references assets that 404 under `/_landing/`, and (c) contributes 0 words and 0 links.
6. Good news: programmatic pages are light (21 KB, no hero image, inline critical CSS, gradient-hero LCP), fixed header space is reserved (no CLS), and next-app's root layout already uses `next/font` correctly.

## 6. Competitor snapshot (10 Appendix C queries, US-proxy SERP — directional)

- **mybuddymaid.in appeared in 0 of 10 SERPs.**
- Who ranks: sulekha.com 8/10 (directory, `/maids/{locality}-{city}`, double-ranks via category/micro-locality splits), broomees.com 5/10 (strongest dedicated competitor — real package pricing but zero localization), justdial 5/10 (sub-category pages, bot-blocked to fetch), urmigroup.in 3/10 (the only genuinely localized pages seen — names DLF phases, Sushant Lok, gated-society entry realities — but no prices, no reviews).
- Depth and word count of fetched ranking pages: Sulekha HSR Layout ~3,000–4,000 words but nearly all listings/duplicated enquiry blocks/reviews; Broomees Gurgaon ~2,500–3,000 words, zero locality content; Urmi Gurgaon ~2,500–3,000 words, genuinely local. URL depth is shallow everywhere — flat root slugs (broomees, urmigroup) or one category level (sulekha `/maids/{locality}-{city}`, ezyhelpers); only maxathome.in runs a 3-level `{service}/{city}/{locality}` tree.
- **No ranker combines localization + pricing + reviews + FAQ on one page.** Each has at most two of the four.
- **Hyperlocal SERPs are nearly empty**: "babysitter in sector 50 noida", "maid service in greater noida west", "maid service in dlf phase 1" are won by Facebook posts, IndiaMART pages, About pages and Wikipedia padding. Only maxathome.in has a clean `{service}/{city}/{locality}` architecture anywhere.
- Technical bar is low (`.html`/`.php` pages still rank); the content bar at locality level is even lower. The brief's architecture — fewer, data-rich locality pages — attacks exactly the open space.
- Caveats: US-proxy results (no local pack; Urban Company absent), job-board mixing on "part time maid" queries shows dual intent worth designing for.

## 7. What must survive the rebuild (preserved surface)

1. **Booking flow** (SPA): auth → onboarding → `bookings` insert (Supabase RLS) → `send-booking-email` edge function. Edge functions live only in Supabase — export before touching anything.
2. **`sessionStorage['mbm_redirect_context']`** handoff from marketing `script.js` → `/auth` → splash deep-link. Same-origin dependency.
3. Supabase schema quirks to respect: state stored in `city` column; `bookings.status` CHECK excludes `'confirmed'` though the UI renders it; `user_plans` writes are server-side-only post-migration.
4. Known SPA bugs to not copy forward: displayed support number `+91 93184 29135` vs dialed `9355114869`; `purchasePlan()` client insert is dead vs RLS; `PURCHASES_PAUSED = true` baked into the committed `_spa` bundle.
5. The `next-app/public/_spa` bundle is an out-of-band artifact (`vite build --base=/_spa/` — no script in the repo reproduces it) with env baked in; next-app's rewrites also miss `/pricing`, `/onboarding`, `/terms`.

## 8. Top risks

1. **Cutover risk**: next-app ships the maintenance takeover (200-status duplicate content on all routes, no noindex) unless the flag is env-gated first.
2. **Equity risk**: ~3,850 live URLs vs 246 next-app combos — a naive cutover 301s most legacy URLs into 404s. The redirect map (removal-plan §3) is the core Phase 2 deliverable.
3. **Doorway inheritance**: the legacy estate is a textbook scaled-content pattern (slot-filled copy, self-awarded "#1" claims inside FAQPage JSON-LD, 252 per-city LocalBusiness blocks, contradictory prices). The domain carries this history; the rebuild must be visibly different in kind, not just larger.
4. **/services collision**: the SPA owns `/services/:id` while the target architecture puts indexable service hubs at `/services/[service]` — must be resolved before Phase 4 (recommendation: move the SPA under `/app/*`).
5. **www is dead** (expired cert) and there is no on-site GSC/Bing verification — both must be fixed at cutover or measurement is blind.
6. **No lead attribution**: zero analytics events and zero location capture on leads today; the brief's locality-level attribution requires new event plumbing and a lead-form change.
7. **OneDrive + no git**: the working folder is unversioned and file-heavy operations are slow; Phase 2+ should run in a git clone of the real repo.

## 9. Open questions for the operator

Listed with recommendations in [removal-plan.md §5](removal-plan.md): `/services` collision, postnatal-care mapping, 410-vs-301 for 34 out-of-footprint cities and non-Appendix-B localities, salary-guide destiny, AdSense on money pages, domestic-help as a distinct service. Plus: provide a GSC "Pages" export at `docs/seo/gsc-pages.csv` if one exists (none found in the repo — without it, every old URL is treated as needing a redirect/410 decision), and confirm how GSC/Bing are currently verified (nothing on-site).
