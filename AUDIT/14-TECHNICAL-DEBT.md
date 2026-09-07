# 14 — Technical debt

Debt that is not itself a defect, but that makes future defects likelier or fixes more
expensive. Ordered by compounding cost.

## [FIN-TD01] Business constants are duplicated across runtime boundaries

**Severity:** MEDIUM · **Confidence:** CONFIRMED

The repository's stated principle — one source of truth for money and locations — is real and
mostly holds. It breaks at every runtime boundary, because the boundaries cannot import from
each other.

| Constant | Copies | Where |
|---|---|---|
| Plan prices, terms, replacement counts | **4** | `data/seo/plans.ts` → `serviceability.json` (generated ✅) → `create-razorpay-order/index.ts:23-27` (hand-copied ❌) → `verify-razorpay-payment/index.ts:23-27` (hand-copied ❌) |
| Support phone `9355114869` | **14 files**, 5 formats | `links.ts`, `jsonld.ts`, `maintenance.ts`, `about`, `contact`, `privacy-policy`, `terms-of-service`, `PricingPage.jsx`, `ServiceDetailPage.jsx`, both live email functions |
| Registered office address | **4** | `jsonld.ts:27-34`, `about/page.tsx:49`, `contact/page.tsx:38`, `Footer.tsx:69` |
| Support email `info@mybuddymaid.in` | **8** | across all three projects |
| Brand colours | **3 systems** | `globals.css` custom properties · `BRAND` objects in two email functions · inline styles in the SPA |
| Plan benefit copy | **3** | `plans.ts` (data) · `serviceability.js:92-97` (derived ✅) · email templates (hand-written ❌) |

The plan-price duplication is the dangerous one and is written up as **FIN-P05** in
`11-PAYMENTS.md` — a mismatch between the two edge functions produces either a total
purchase outage or a pricing discrepancy, visible only in production.

**Fix:** extend `scripts/seo/export-serviceability.ts`, which already generates
`serviceability.json` from `plans.ts`, to also emit `supabase/functions/_shared/plans.ts`.
Create `_shared/contact.ts` for the phone, email and address. Both are small changes to a
script that already runs.

## [FIN-TD02] Two front-ends with no shared code, design system or session

**Severity:** MEDIUM · **Confidence:** CONFIRMED

`next-app` and `app` share nothing: not a component, not a stylesheet, not a type, not a
constant, not a lockfile, not a session. They have opposite design languages (light obsidian
+ mint marketing site; a dark `#0F0F0F` app), opposite styling approaches (hand-written CSS
files vs heavy inline styles), and opposite icon strategies (inline SVG in
`HomeIcons.tsx` vs `lucide-react`).

This is not automatically wrong — the constraints are genuinely different, and the SEO site's
zero-JS discipline would be impossible inside a React SPA. But the cost is concrete and
already being paid:

- The handoff between them is broken (FIN-B02) and nothing would have caught it, because no
  code, test or type spans the seam.
- `PURCHASES_PAUSED` lives in the SPA, so the marketing site cannot know checkout is off and
  keeps sending users to it (FIN-U01).
- A price change requires touching four files across three runtimes (FIN-TD01).
- A user who signs in has no session on the marketing side, so no page can be personalised or
  measured against a known customer.

**Fix — incremental, not a rewrite.** Do not merge the applications. Instead:
1. Add a `shared/` directory at the repo root with plan data, contact constants and the
   service/locality types, consumed by all three runtimes via npm workspaces.
2. Export `PURCHASES_PAUSED` (and any future feature flag) through `serviceability.json` so
   both front-ends read one flag.
3. Fix the URL handoff (FIN-B02) so context, at minimum, crosses the seam.

## [FIN-TD03] `AuthContext.jsx` is the SPA's entire architecture

**Severity:** MEDIUM · **Confidence:** CONFIRMED · `app/src/context/AuthContext.jsx` (223 lines)

One file is simultaneously: the auth provider, the data-fetching layer, the cache, the
mutation API, and the error boundary for the whole booking app. It exposes 15 values, holds 6
pieces of state, and every screen depends on it.

Specific consequences already visible:
- **All errors are swallowed identically.** Every fetch is wrapped in `try/catch` that
  `console.error`s and returns `null` or `[]`, then sets state anyway. A database outage
  renders as "No bookings yet" — see `10-API.md`.
- **No error state exists in the context**, so no screen can distinguish "empty" from "broken"
  even if it wanted to.
- **The `loading` flag is deliberately decoupled from the data** (`setLoading(false)` before
  the profile resolves). That is a good decision for paint, and it is the direct cause of
  FIN-B05, because consumers were not told about it.
- **`purchasePlan` is dead and would fail** (FIN-D02) but looks like a working purchase API.

**Fix — smallest useful step, not a rewrite:** split the data concerns out of the auth
concern. `AuthContext` keeps `user`/`session`/sign-in/sign-out. Move `profile`, `userPlan` and
`userBookings` into small hooks (`useProfile`, `usePlan`, `useBookings`) that each return
`{ data, error, loading, refresh }`. That single change gives every screen a real error state
and makes FIN-B05-class bugs structurally impossible.

## [FIN-TD04] The SPA build is a committed artifact with no staleness check

**Severity:** MEDIUM · **Confidence:** CONFIRMED

Covered as **FIN-E02** in `17-DEPLOYMENT.md`. Listed here because it is debt, not a bug: the
artifact is current today, and the arrangement works right up until the day someone forgets.

## [FIN-TD05] `compose.ts` is 967 lines and mixes three responsibilities

**Severity:** LOW · **Confidence:** CONFIRMED · `next-app/lib/seo-engine/compose.ts`

The file contains: the `PageModel` type system, nine page composers, and roughly a dozen prose
generators (`fullVsPartTime`, `accessParagraphs`, `helperTravelParagraphs`,
`serviceLocalityIntro`, `trustSections`). It is well organised, heavily commented and clearly
written — this is not messy code. But the copy templates that determine SEO outcomes are
interleaved with the structural composition logic, which means a copywriter cannot touch the
prose without touching the page model.

Given that FIN-SEO01 recommends substantial changes to what these templates produce, splitting
them out first would make that work safer:

```
lib/seo-engine/
  compose/          city.ts zone.ts locality.ts service-locality.ts service-city.ts pincode.ts home.ts
  copy/             housing.ts access.ts helpers.ts trust.ts      ← prose templates, testable in isolation
  model.ts          types + finish() + collectText()
```
No behaviour change; each file becomes independently testable (see `13-TESTING.md` Tier 4).

## [FIN-TD06] Lint cannot be gated because 64 deliberate violations are left as errors

**Severity:** LOW · **Confidence:** CONFIRMED

Covered as **FIN-DEP03** in `12-DEPENDENCIES.md`. The `no-html-link-for-pages` violations are
a documented, defensible architectural choice; leaving them as errors means `npm run lint`
exits non-zero and can never be a CI gate, so lint currently protects nothing. Configure the
exception explicitly and the tool starts working again.

## [FIN-TD07] Three SQL files, no migration tool, no history

Covered as **FIN-DB06** in `09-DATABASE.md`. This is the prerequisite for shipping the
database fixes in the remediation plan with any confidence, which is why it appears in
Phase 0 there rather than in the refactoring phase.

## [FIN-TD08] Documentation is excellent, and lives in the wrong place for it

**Severity:** LOW · **Confidence:** CONFIRMED

`docs/seo/ASSUMPTIONS.md` (50 numbered, dated, reasoned entries), `quality-report.md`,
`leads-schema-proposal.md` and the inline file-header comments throughout `next-app` are
**genuinely unusually good**. Several findings in this audit were confirmed faster because a
comment explained exactly why a decision was made and what it cost. `ASSUMPTIONS.md` #50 is
effectively an incident log for the Supabase migration.

Two gaps:
- It is all under `docs/seo/`, so a developer looking for architecture, deployment or
  environment documentation will not find it. There is no root `README` describing the
  three-project structure, and `next-app/README.md` is the Next.js scaffold default.
- It documents the *SEO* system thoroughly and the *payment/auth/booking* system not at all.
  The three most dangerous findings in this audit are in the least-documented code.

**Fix:** a root `README.md` covering the three projects, the three deployment paths, the
environment contract (FIN-E01), and a link to `ASSUMPTIONS.md`. Half a day, and it is the
highest-value documentation in the repository because it is the part a new person needs first.

## Smaller debts

| Debt | Location | Note |
|---|---|---|
| Inline styles throughout the SPA | `AppLayout.jsx`, `App.jsx` guards | Colours hard-coded at the element level; a theme change means editing JSX |
| No `updated_at` triggers | all tables | Only `profiles` is maintained, by application code |
| `select('*')` everywhere in the SPA | `AuthContext.jsx:19,35,54` | Couples the client to the full schema; a new column ships to the browser automatically |
| Two `TermsPage` implementations | `app/src/pages/TermsPage.jsx`, `next-app/app/terms-of-service` | Different text for the same agreement |
| `styles/` contains 4 unimported files | `next-app/styles/` | ~14 KB of CSS that looks live and is not — see `15-DEAD-CODE.md` |
| No `engines` / `.nvmrc` | both projects | Builds are not reproducible over time — FIN-DEP02 |
| `esm.sh/@supabase/supabase-js@2` unpinned in edge functions | all six | A Supabase minor release can change payment behaviour with no deploy — FIN-DEP01 |
| Hard-coded `lastmod` strings in `TRUST_PAGES` | `sitemaps.ts:22-30` | Will silently go stale |
| GA4 and AdSense IDs hard-coded | `Analytics.tsx:19,69`, `app/index.html:9` | Not secrets, but they should be env vars so staging does not pollute production analytics |
