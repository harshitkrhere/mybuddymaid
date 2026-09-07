# 02 — Routes

Every route in both applications. All Next.js SEO routes use `dynamicParams = false`, so an
unknown slug is a build-time-known 404 rather than a runtime lookup.

## A. Next.js marketing site

| URL | File | Purpose | Auth | Rendering | Count | Notes / issues |
|---|---|---|---|---|---|---|
| `/` | `app/page.tsx` | landing | public | force-static | 1 | Uses `composeHome()` for copy, lays out its own sections. CSS grid reorders hero pieces → DOM order ≠ visual order (FIN-A01). All CTAs point at `/app/auth` (FIN-U01). |
| `/[city]` | `app/[city]/page.tsx` | city hub | public | SSG | 8 | Clean. `composeCity` |
| `/[city]/[area]` | `app/[city]/[area]/page.tsx` | zone **or** locality hub | public | SSG | 35 + 342 | One route resolves two entity types; validator guarantees slugs never collide within a city. |
| `/[city]/[area]/[slug]` | `app/[city]/[area]/[slug]/page.tsx` | service×locality **or** entity | public | SSG | 2,052 (+0 entities live) | The money pages. Scaled-content risk — FIN-SEO01. `entities.json` is `{}` so no entity page exists yet. |
| `/services` | `app/services/page.tsx` | services index | public | force-static | 1 | Clean |
| `/services/[service]` | `app/services/[service]/page.tsx` | national service hub | public | SSG | 7 | Includes the synthetic `maid-service` umbrella |
| `/services/[service]/[city]` | `app/services/[service]/[city]/page.tsx` | service×city | public | SSG | 48 | 1 page noindexed by the gate (`/services/cook/mangalore`) |
| `/pincode/[pin]` | `app/pincode/[pin]/page.tsx` | pincode hub | public | SSG | 20 | Only pins mapping to ≥2 localities; 1:1 pins 301 via the redirect map |
| `/blog` | `app/blog/page.tsx` | guides index | public | force-static | 1 | 35 posts grouped into 6 topics by regex on legacy category labels |
| `/blog/[slug]` | `app/blog/[slug]/page.tsx` | blog post | public | SSG | 35 | `dangerouslySetInnerHTML` on ported HTML (verified: 0 `<script>`, 0 inline handlers). Loads AdSense with **no ad units** — FIN-PF01 |
| `/about` | `app/about/page.tsx` | trust | public | force-static | 1 | Clean |
| `/contact` | `app/contact/page.tsx` | trust | public | force-static | 1 | No form — WhatsApp / phone / email only |
| `/how-we-verify` | `app/how-we-verify/page.tsx` | trust | public | force-static | 1 | Claims have no system behind them — FIN-C04 |
| `/pricing` | `app/pricing/page.tsx` | trust | public | force-static | 1 | Imports `REFUND_WINDOW_DAYS`/`REFUND_PROFILE_THRESHOLD` but never uses them (dead import) |
| `/replacement-policy` | `app/replacement-policy/page.tsx` | trust | public | force-static | 1 | Refund terms contradict `/terms-of-service` — FIN-C01 |
| `/privacy-policy` | `app/privacy-policy/page.tsx` | legal | public | force-static | 1 | **Ships zero matching CSS — renders unstyled. FIN-B01** |
| `/terms-of-service` | `app/terms-of-service/page.tsx` | legal | public | force-static | 1 | Same CSS bug; content contradicts live behaviour — FIN-C02 |
| `/maintenance` | `app/maintenance/page.tsx` | maintenance | public | static | 1 | 302 → `/` when `MAINTENANCE_MODE` is off. Contains a hard-coded fake progress bar (84%) and fake subsystem statuses |
| `/not-found` | `app/not-found.tsx` | 404 | public | static | — | Verified live: 404 with city links. Good. |
| `/robots.txt` | `app/robots.ts` | — | public | static | 1 | `Disallow: /*?*` blocks all query URLs incl. ad landing pages and `/og` — FIN-B12 |
| `/sitemap.xml` | `app/sitemap.xml/route.ts` | index | public | force-static | 1 | 18 shards, verified live |
| `/sitemaps/[shard]` | `app/sitemaps/[shard]/route.ts` | shard | public | force-static | 18 | Calls `buildShards()` twice per request (build-time only) |
| `/og` | `app/og/route.tsx` | OG image | **public, unauthenticated** | **edge, dynamic** | ∞ | **Renders arbitrary caller-supplied text on a branded card. FIN-S05** |
| `/api/lead` | `app/api/lead/route.ts` | lead capture | public POST | force-dynamic | 1 | 503 today. Would 502 if enabled — column-name mismatch. FIN-B03 |

**Total prerendered: 2,513 gated pages + 35 blog + 8 static + sitemaps.**

### Middleware — `proxy.ts`
Matcher: `/((?!_next/static|_next/image|_spa/|favicon.ico).*)`. Order:
1. `www.mybuddymaid.in` → apex, 308 — **verified live**
2. `410 Gone` for retired legacy URLs (from `lib/seo-engine/redirect-map.json`)
3. `301` from the legacy map, single hop
4. bare `.html` → clean URL, 301 — **verified live** (`/blog/x.html` → `/blog/x`)
5. maintenance rewrite when `MAINTENANCE_MODE=true`
6. `/maintenance` → `/` 302 when maintenance is off

No admin routes, no preview routes, no debug routes, no health endpoint. **There is no
health-check endpoint at all** — worth adding for uptime monitoring.

### Routes NOT protected that arguably should be
None on the marketing site: it is entirely public by design, holds no user data, and the
only secret (`SUPABASE_SERVICE_ROLE_KEY`) never leaves the Node runtime of `/api/lead`.

## B. Booking SPA (`/app/*`)

Served by rewrite from `public/_spa/index.html`; `X-Robots-Tag: noindex, nofollow` verified
live on `/app`.

| URL | Component | Auth | Data | Issues |
|---|---|---|---|---|
| `/app/auth` | `AuthPage` | public | Supabase Auth | Ignores the `?city&locality&service` params every site CTA sends — FIN-B02. Client-only rate limiting resets on reload |
| `/app/terms` | `TermsPage` | public | static copy | Duplicates `/terms-of-service` with **different** text |
| `/app/splash` | `SplashScreen` | public | — | Forced 4s delay on every login — FIN-B08. Its redirect-context branching is dead — FIN-D03 |
| `/app/onboarding` | `OnboardingPage` | Protected | `profiles` upsert | Error text says "state", label says "City" — FIN-B07 |
| `/app/home` | `HomePage` | Protected + Onboarding | context | — |
| `/app/services` | `ServicesPage` | Protected + Onboarding | `constants.js` | — |
| `/app/services/:serviceId` | `ServiceDetailPage` | Protected + Onboarding | `createBooking` + `send-booking-email` | Phone field never syncs from profile — FIN-B05. Writes free-text `city`; the locality columns are not applied — FIN-DB02. Says "Booking Confirmed!" for a pending request — FIN-U04 |
| `/app/bookings` | `BookingsPage` | Protected + Onboarding | context | Unbounded `SELECT *` — FIN-DB05. Has a `confirmed` status branch the DB CHECK forbids — FIN-B13 |
| `/app/pricing` | `PricingPage` | Protected + Onboarding | edge functions | `PURCHASES_PAUSED = true` → the entire Razorpay path is unreachable. Razorpay modal would say "12 days" for 12 months — FIN-B04 |
| `/app/profile` | `ProfilePage` | Protected + Onboarding | `profiles`, `delete-account` | Correct type-DELETE confirmation. Deletion is non-transactional — FIN-S10 |
| `/app/*` (any other) | → `/app/home` | — | — | Catch-all `Navigate`, so `/app/anything` silently becomes home rather than 404 |

### Route-guard analysis
`ProtectedRoute` waits on `loading` then checks `isAuthenticated`. `OnboardingGuard`
additionally waits on `profileLoaded` then checks `profile?.full_name`. Both are **client-side
only** — which is correct here, because the actual authorisation is enforced by Postgres RLS
on every query, not by the router. Bypassing the router shows a shell with no data.

One real consequence: `AuthContext` calls `setLoading(false)` *before* profile/plan/bookings
resolve (deliberate, to unblock paint). Pages that read `profile` in a `useState` initialiser
therefore capture `undefined` — the root cause of FIN-B05.
