# 15 — Dead code

Split into **confirmed dead** (verified unreferenced or unreachable) and **uncertain**
(likely dead, but needs an owner decision). Nothing here was deleted.

## Confirmed dead

### [FIN-D01] `supabase/functions/send-plan-email/` — not deployed, no caller

**Confidence:** CONFIRMED (verified live and by search) · 200 lines

- **Not deployed.** `OPTIONS https://…/functions/v1/send-plan-email` → **404**, while the
  other five functions return 200. Verified 2026-09-08.
- **No caller.** `grep -rn "send-plan-email" app/ next-app/` → no matches. The SPA calls
  `send-package-email` instead (`PricingPage.jsx:125`).
- It is also the least safe of the three email functions: no auth check *and* no
  `email_logs` write *and* it renders a `platinum` "Legacy Package" tier that no longer
  exists in `plans.ts`.

**Action:** delete the directory. It contributes nothing and it is a second, worse copy of a
security bug being fixed elsewhere (FIN-S01).

### [FIN-D02] `AuthContext.purchasePlan` — unreachable and would fail if reached

**Confidence:** CONFIRMED · `app/src/context/AuthContext.jsx:171-192`

Performs a direct client `INSERT` into `user_plans`. `app/security-migration.sql:11-12`
**dropped the INSERT policy** on that table, so RLS would reject it. It is destructured in
`PricingPage.jsx:32` and never called — the purchase path goes through
`verify-razorpay-payment` instead.

**Action:** delete the function and remove it from the context value and from
`PricingPage`'s destructure. Leaving it is actively dangerous: it looks like a working
purchase path to the next developer.

### [FIN-D03] The splash screen's redirect-context router

**Confidence:** CONFIRMED · `app/src/pages/SplashScreen.jsx:27-37`, `AuthPage.jsx:50-52,83-85`

Reads `sessionStorage.getItem('mbm_redirect_context')` in three places. **Nothing anywhere in
the repository writes that key** (`grep -rn "setItem('mbm_redirect_context'"` → zero results).
The `ctx` branching for service ids and plan names is therefore unreachable, and
`location.state?.redirectContext` is always `null` because `AuthPage` only ever passes what it
just read from the same empty key.

**Action:** do **not** simply delete — this is the consumer half of FIN-B02, and the correct
fix is to make it work by reading the query parameters the site already sends. See
`03-BUGS.md` FIN-B02 for the code. If FIN-B02 is deferred, then delete this so it stops
looking like a working feature.

### [FIN-D04] Two orphan stylesheets

**Confidence:** CONFIRMED

| File | Size | Status |
|---|---|---|
| `next-app/styles/static-pages.css` | 3.0 KB | **Not imported. Its classes are used by two live pages** → those pages render unstyled. This is FIN-B01, a bug, not dead code. |
| `next-app/styles/cities-hub.css` | 3.3 KB | Not imported, and no page uses its classes. Genuinely dead. |

`styles/city-service.css` (6.0 KB) and `styles/service-hub.css` (2.3 KB) are also not imported
by any page — the SEO pages are styled entirely by `globals.css`. Verified: the only CSS
imports in the whole app are `globals.css` (layout), `home.css` (`app/page.tsx:16`) and
`blog.css` (`app/blog/page.tsx:10`).

`components/shared/Header.css` and `Footer.css` are likewise never imported — `Header.tsx` and
`Footer.tsx` import no CSS, and their styles are in `globals.css` (verified: `site-header`
appears there and in the served stylesheet).

**Action:** delete `cities-hub.css`, `city-service.css`, `service-hub.css`, `Header.css`,
`Footer.css` (≈16 KB of misleading source). Handle `static-pages.css` under FIN-B01 — the
recommendation there is to delete it too and move both legal pages onto `TrustPage`.

### [FIN-D05] `app/src/App.css` — never imported

**Confidence:** CONFIRMED · The file's own first line says *"App-level overrides - all styles
are in index.css"*, and `main.jsx:7` imports only `./index.css`.

**Action:** delete.

### [FIN-D06] Vite scaffolding assets

**Confidence:** CONFIRMED · `app/src/assets/react.svg`, `app/src/assets/vite.svg`,
`app/src/assets/hero.png`

`grep -rn "assets/" app/src` finds no import of any of them. `react.svg` and `vite.svg` are
`create-vite` scaffolding. `hero.png` was presumably used by an earlier home page.

**Action:** delete all three.

### [FIN-D07] Unused exports in the SEO engine

**Confidence:** CONFIRMED — each appears only in its defining file:

| Export | File |
|---|---|
| `hasUnverified()` | `lib/seo-engine/compose.ts:118-122` |
| `indexablePaths()` | `lib/seo-engine/gate.ts:43-45` |
| `getLocalityByPincode()` | `data/seo/index.ts:149-152` |
| `LocationLdInput` (type) | `lib/seo-engine/jsonld.ts:117` |

`hasUnverified` in particular looks like it was meant to feed the quality gate and does not.
`ogImagePath` is used only within its own module, which is fine.

**Action:** delete, or wire `hasUnverified` into `uniqueness.ts` if the `[VERIFY]` gate was
meant to use it (the gate currently checks for `[VERIFY]` in the composed text, which reaches
the same result by a different route — so deleting is the honest choice).

### [FIN-D08] `platinum` plan residue

**Confidence:** CONFIRMED · `app/supabase-schema.sql:101` CHECK includes `'platinum'` with the
comment *"kept for historical records only"*; `send-plan-email/index.ts:14,39-41` renders a
"Legacy Package" tier for it.

The schema comment is a legitimate reason to keep the CHECK value if historical rows exist —
**verify that first**: `SELECT count(*) FROM user_plans WHERE plan_name = 'platinum'`. If
zero, drop it from the constraint. The `send-plan-email` copy dies with FIN-D01 either way.

### [FIN-D09] Unreachable `confirmed` booking status

**Confidence:** CONFIRMED · `app/src/pages/BookingsPage.jsx:11` — see FIN-B11.

---

## Uncertain — needs an owner decision, not a deletion

### The maintenance page's fabricated status display
`next-app/lib/maintenance.ts:11-22` hard-codes `progressPercent: 84`, a 180-minute countdown
and four subsystem statuses ("Maid Matching Algorithm — Optimized (v2.4)", "Real-time Booking
Engine — Upgrading Data Pipelines…"). None of these correspond to anything real. The page is
env-gated and currently off (`/maintenance` 302s to `/`, verified live), so it harms nobody
today — but if it is ever switched on it displays invented technical progress to customers.

**Decision needed:** keep the page (it is useful) but replace the fake telemetry with an
honest message and a real ETA, or delete the page.

### `next-app/scripts/seo/` — 19 scripts, ~unknown current use
`_fetch`, `check-redirects`, `crawl`, `draft-copy`, `export-serviceability`, `gen-keywords`,
`gen-redirects`, `geocode`, `gsc-report`, `import-entities`, `indexnow`, `merge-enrichment`,
`port-blog`, `refine-neighbours`, `stats`, `uniqueness`, `validate-jsonld`, `validate`.

Three are wired into `prebuild` (`validate`, `gen-redirects`, `uniqueness`) and are load-bearing.
`export-serviceability` is load-bearing whenever plans or localities change. The rest are
one-shot migration tooling (`port-blog`, `import-entities`, `merge-enrichment`, `geocode`,
`refine-neighbours`) or operational reporting (`gsc-report`, `crawl`, `stats`, `indexnow`).

**Not dead** — but they should be split into `scripts/seo/build/` (load-bearing) and
`scripts/seo/tools/` (occasional) so the next reader can tell which is which. Two of them,
`gsc-report` and `crawl`, are the tools that would answer the most important open question in
this audit (FIN-SEO01: is Google actually indexing the 2,052 service pages?) and should be
*used*, not deleted.

### `entities.json` is empty
`data/seo/entities.json` contains `{}` — zero entities. The entire Phase 5 machinery
(`compose-entity.ts` 237 lines, `lib/entities.ts`, `entities.ts`, `quality/rollout.json`,
`import-entities.ts`, entity sitemap shards, the `ENTITY_PATHS` fail-closed branch in
`gate.ts`) currently generates nothing.

**Not dead** — it is unshipped scaffolding for a documented roadmap phase, and it is blocked
on FIN-DB03 (the placement columns that would supply real entities are not applied). Leave it,
but understand that ~400 lines of the codebase are currently inert.

### Duplicated public assets
`app/public/` and `next-app/public/` both contain `ads.txt`, `apple-touch-icon.png`,
`favicon-32.png`, `icons.svg`, `logo.png`. This is **not** duplication to remove: `app/public/`
is the Vite build's source, which lands in `next-app/public/_spa/` — so there are in fact
three copies of each file in the repository, two of them generated. Expected given the
embedded-SPA architecture. Worth a one-line comment in `scripts/build-spa.mjs` so nobody
"cleans it up".

## Summary

| Category | Files / symbols | Approx. lines |
|---|---|---|
| Confirmed dead, safe to delete now | `send-plan-email/`, `purchasePlan`, 5 CSS files, `App.css`, 3 assets, 4 exports, `confirmed` status | ~450 |
| Dead but should be *fixed* not deleted | splash redirect context (FIN-B02), `static-pages.css` (FIN-B01) | ~60 |
| Inert but intentional | entity/Phase-5 machinery | ~400 |
| Needs a decision | maintenance page telemetry, `platinum` CHECK value | ~40 |
