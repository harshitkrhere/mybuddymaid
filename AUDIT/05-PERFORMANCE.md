# 05 — Performance

## Measurement status

**Core Web Vitals: NOT MEASURED.** No lab or field measurement was taken during this audit.
The in-app browser available here blocks `_next/static` and `_spa/assets` subresources
(`ERR_BLOCKED_BY_CLIENT`), so no meaningful LCP/INP/CLS/TTFB number could be produced, and
none is invented below.

The site already collects real field data — `@vercel/speed-insights` is mounted in the root
layout (`components/shared/VercelAnalytics.tsx:9`) — so **the numbers exist; nobody has read
them.** Before doing any performance work:

1. Vercel dashboard → Speed Insights → p75 LCP / INP / CLS, segmented by device and by route
   group (`/`, `/[city]/[area]/[slug]`, `/blog/[slug]`).
2. Chrome UX Report for `mybuddymaid.in` (field, 28-day) — the only data Google actually ranks on.
3. Lighthouse CI on three representative URLs: `/`, `/delhi/dwarka/part-time-maid`, `/app`.

Everything below is a structural finding from reading the code, not a metric.

---

## [FIN-PF01] AdSense loads on every blog post with zero ad units on the page

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Performance / Policy

**Location:** `next-app/app/blog/[slug]/page.tsx:79`, `next-app/components/shared/Analytics.tsx:65-73`

`<AdSense />` injects `adsbygoogle.js` (~150 KB compressed, plus its own downstream
requests) on all 35 blog posts. A repository-wide search for `adsbygoogle` finds it in
exactly two places: this loader, and `app/index.html:9` (the SPA shell). **There is not a
single `<ins class="adsbygoogle">` ad slot anywhere in the codebase.**

So the script downloads, parses, executes, opens connections to Google's ad infrastructure
and renders nothing. It is pure cost — bytes, main-thread time, connection setup and a
third-party dependency on the critical path of the site's most link-worthy pages — for zero
revenue.

Two secondary concerns:
- `strategy="lazyOnload"` limits the damage (it waits for window load), but it still lands
  during the INP measurement window on slower devices.
- Running AdSense at all on a site whose blog is 35 ported posts, and whose main body is
  2,052 programmatically-composed pages, invites AdSense's "low value content" / scaled
  content policy review. Loading it without monetising is taking that risk for nothing.

**Fix:** delete `<AdSense />` from `app/blog/[slug]/page.tsx:79` and the `AdSense` export
from `Analytics.tsx`, and remove the AdSense script from `app/index.html:9` (the SPA is
`noindex` and logged-in; ads there are both pointless and hostile). Keep `public/ads.txt` if
you intend to monetise later. If you do intend to monetise, add real ad units — do not leave
the loader without them.

**Regression risk:** none. Nothing renders today.

---

## [FIN-PF02] The booking SPA ships one 558 KB unsplit JavaScript bundle plus two unused third-party scripts

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Performance

**Location:** `next-app/public/_spa/assets/index-BXK52Lnq.js` (558,519 bytes),
`index-CPbRuLey.css` (51,068 bytes), `app/index.html:7-9,15`

Measured from the committed artifact:

| Asset | Size (uncompressed) |
|---|---|
| `index-BXK52Lnq.js` | 558 KB |
| `index-CPbRuLey.css` | 51 KB |
| `checkout.razorpay.com/v1/checkout.js` | third-party, render-blocking (`<script>` in `<head>`, no `async`/`defer`) |
| `pagead2.googlesyndication.com/…/adsbygoogle.js` | third-party |
| `cloud.umami.is/script.js` | third-party |

Structural issues:

1. **No code splitting.** `App.jsx` imports all eleven pages statically. A user opening
   `/app/auth` downloads `PricingPage`, `BookingsPage`, `ProfilePage`, `ServiceDetailPage`,
   `TermsPage` and the whole `lucide-react` icon surface before they can type an email.
2. **`serviceability.json` is bundled whole.** 342 localities, 267 pincodes and 8 cities are
   inlined into the JS, but the only screen that needs the locality list is the booking sheet
   in `ServiceDetailPage`. This is a large share of the bundle for a payload most sessions
   never use.
3. **Razorpay's checkout script is loaded synchronously in `<head>` on every SPA page load —
   while purchases are paused.** `PURCHASES_PAUSED = true` means `window.Razorpay` is never
   used. It is a render-blocking request for a disabled feature.
4. **AdSense inside a `noindex`, authenticated app** — see FIN-PF01.

**Fix, in order of value:**
```jsx
// App.jsx
const PricingPage = lazy(() => import('./pages/PricingPage'));
const BookingsPage = lazy(() => import('./pages/BookingsPage'));
// ...wrap <Routes> in <Suspense fallback={<Spinner/>}>
```
- Remove the Razorpay `<script>` from `index.html` and inject it on demand inside
  `handleBuyPlan` when `PURCHASES_PAUSED` is false. Roughly ten lines, and it also means
  un-pausing checkout does not require an `index.html` change.
- Remove the AdSense script.
- Import `serviceability.json` dynamically inside `ServiceDetailPage`, or split it into
  `cities.json` (small, always needed) and `localities-by-city/*.json` (fetched on city
  selection).

**Tests required:** assert the built entry chunk stays under a budget (e.g. 250 KB) in CI.
**Regression risk:** low; `Suspense` fallbacks must be styled to match the existing spinner.

---

## [FIN-PF03] Two Google font families on the home page and blog index

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Performance

**Location:** `app/layout.tsx:14` (Inter, site-wide), `app/page.tsx:27` and `app/blog/page.tsx:17`
(Plus Jakarta Sans, weights 400/500/600/700/800)

The layout comment explicitly records that a second family cost ~28 KB and an extra preload
and hurt FCP — and then the home page and blog index each load one anyway, at five weights.
Both use `next/font`, so the files are self-hosted and preloaded rather than fetched from
Google, which is the right mitigation; but the home page is the site's highest-traffic LCP
surface and is now paying the cost the comment warned about.

Corroborating signal from the live page: the browser reported two `.woff2` files
*"preloaded using link preload but not used within a few seconds"* — i.e. at least two font
files are being preloaded and not used on first paint.

**Fix:** cut Plus Jakarta Sans to the two weights actually used for headings (likely 700 and
800 — audit `styles/home.css`), or drop it and use Inter's heavier weights. Verify against
Speed Insights p75 LCP before and after rather than by intuition.

---

## [FIN-PF04] `buildShards()` recomposes all 2,513 pages twice per sitemap shard

**Severity:** LOW (build-time only) · **Confidence:** CONFIRMED · **Category:** Performance

**Location:** `next-app/app/sitemaps/[shard]/route.ts:7,13`

`generateStaticParams()` calls `buildShards()`, and then `GET()` calls it again for each of
the 18 shards. Each call runs `allCorePages()`-equivalent work: composing every city, zone,
locality, service×locality and pincode model from scratch. That is ~19 full compositions of
2,513 page models per build.

Both routes are `force-static`, so this is build time, not request time — but it is a
meaningful share of a build that already prerenders 2,500+ pages, and the cost grows
quadratically with the footprint as more cities are added.

**Fix:** memoise at module scope.
```ts
let cache: Shard[] | null = null;
export function buildShards(): Shard[] { return (cache ??= compute()); }
```
Six lines, safe in a build process, and it also speeds up `seo:validate` / `seo:gate` /
`seo:crawl`, which all traverse the same models.

---

## Structural strengths — deliberately not flagged

These are correct and unusually well-executed for a project this size:

- **Near-zero JavaScript on 2,513 SEO pages.** Only two client components exist on the
  entire marketing site, and one of them never renders in production. Every CTA is a plain
  server-rendered `<a>`; click tracking is a single delegated listener. This is the single
  best performance decision in the codebase and should be protected in review.
- **Analytics deferred off the critical path** (`Analytics.tsx:37-53`): gtag and Umami load
  on first interaction or after 4 s, with a `dataLayer` shim so pre-load clicks are queued
  and replayed. The trade-off is documented with the measured cost (~190 KB, ~560 ms of
  main-thread blocking) that motivated it.
- **Everything static.** `dynamicParams = false` plus SSG means TTFB is CDN-bound, not
  compute-bound, on every content page.
- **CLS defences in place:** all `next/image` uses carry explicit `width`/`height`;
  `body { padding-bottom: var(--sticky-h) }` reserves the mobile sticky bar's height so it
  never shifts content (`globals.css:242`); `img { max-width:100%; height:auto }` globally.
- **Image handling:** AVIF/WebP enabled in `next.config.ts:15-17`; hero uses `priority` with
  a `sizes` attribute; all images are first-party and served through `next/image`.
- **Cache headers:** one-year immutable on `/_spa/assets/*` and on all image/font extensions
  (`next.config.ts:22-27`) — verified live on `/og`.

**One caveat on caching:** prerendered HTML is served with
`Cache-Control: public, max-age=0, must-revalidate` (verified live). That is Next.js's
default and Vercel's own CDN layer still caches the static output, so this is not a defect —
but it does mean the site has no explicit `s-maxage`/`stale-while-revalidate` policy of its
own. If you ever move off Vercel, this becomes a real problem. Worth documenting as an
assumption.
