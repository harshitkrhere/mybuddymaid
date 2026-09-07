# 20 — Implementation prompt

A paste-ready prompt for running the remediation in fresh sessions, one phase at a time.

**How to use it**
1. Start a new session in `C:\Users\conta\dev\mybuddymaid`.
2. Paste **§A — The prompt** (below), replacing `{{PHASE}}` with `PHASE 0`, `PHASE 1`, etc.
3. Paste the matching **task card** from §B underneath it.
4. When the phase is done and merged, start a fresh session for the next one.

Do the phases in order. Phase 0 has dependencies inside it (0.6 before 0.2/0.5) that are
called out in its card.

---

# §A — The prompt

> Copy everything between the rules, replacing `{{PHASE}}`.

---

You are a senior engineer implementing a remediation phase on the MyBuddyMaid codebase.

A complete forensic audit of this repository already exists in `AUDIT/`. It is the source of
truth for this work. **Read these three files before writing any code:**

- `AUDIT/18-REMEDIATION-PLAN.md` — the plan you are executing. Find **{{PHASE}}** and work only that section.
- `AUDIT/19-FINDINGS-MATRIX.md` — every finding with file, impact, fix and effort.
- `AUDIT/01-ARCHITECTURE.md` — how the three sub-projects fit together.

Then read the detailed write-up for each finding in your phase. Every task in the plan cites
its finding ID (e.g. FIN-S01); each ID has a full entry — root cause, evidence, recommended
solution, tests required, regression risk — in the relevant numbered document
(`04-SECURITY.md`, `03-BUGS.md`, `09-DATABASE.md`, `11-PAYMENTS.md`, and so on).

## Your scope

Implement **{{PHASE}}** and nothing else.

- Do not start work from a later phase, even if it looks quick or related.
- Do not refactor code you are not otherwise touching.
- Do not add abstraction that the task does not require.
- If you find a *new* problem outside your phase, add it to `AUDIT/19-FINDINGS-MATRIX.md` with
  a new ID and tell me — do not fix it.

Prefer the smallest safe fix. This codebase has good bones; several findings are one missing
conditional. Match the surrounding code's style, comment density and naming — the existing
file-header comments explain design decisions and are worth reading before you change a file.

## Working agreement

1. **Plan first.** Before editing, list the tasks in this phase in order, note which depend on
   which, and tell me the order you will work in. Wait for my go-ahead only if something in
   the plan looks wrong to you; otherwise proceed.
2. **One task group at a time.** Group related tasks (e.g. all the payment-function changes).
   After each group: write the tests, run them, run the checks below, then commit.
3. **Tests are part of the task, not a follow-up.** A task is not done until the behaviour it
   fixes has a test that fails against the old code and passes against the new. The specific
   assertions required for each finding are listed in `AUDIT/13-TESTING.md` — use them.
4. **Commit per task group**, with a message that says what changed and why, citing the
   finding IDs. Branch off `main` as `fix/{{PHASE}}-<short-name>` before the first commit;
   never commit directly to `main`.
5. **Report honestly.** If a test fails, show the output. If you skipped something, say so and
   why. If a fix turned out to be wrong or bigger than the plan estimated, stop and tell me
   rather than expanding scope silently.

## Checks that must pass before every commit

```bash
cd next-app && npx tsc --noEmit          # currently clean — keep it clean
cd next-app && npm test                  # currently 7/7 — keep it green
cd next-app && npm run seo:validate      # data-layer gate; prebuild runs this too
```
If you touched `app/src/**`, also:
```bash
cd app && npx vite build                 # must succeed
```
If you touched `supabase/functions/**`:
```bash
deno check supabase/functions/<name>/index.ts
```

## Stop and ask me before

- Deploying anything (Supabase functions, migrations against the live database, Vercel).
- Running any command that sends a real email, creates a real Razorpay order, or writes to
  production data.
- Changing a published price, a refund term, or any customer-facing legal text.
- Flipping a feature flag (`PURCHASES_PAUSED`, `LEADS_ENABLED`, `MAINTENANCE_MODE`).
- Any schema change you cannot express as an additive, idempotent, reversible migration.
- `git push` or opening a PR.

## Repo facts you must not get wrong

These are non-obvious and a fresh session will otherwise assume the opposite. All are
established in the audit.

**Three sub-projects, three deploy paths.**
- `next-app/` — Next.js 16, the public site. Vercel's Root Directory is `next-app`. Do **not**
  create a root `vercel.json`; the old one deployed a retired static site.
- `app/` — the Vite booking SPA, served at `/app/*`. **Its build output is committed** to
  `next-app/public/_spa/`. If you change anything in `app/src/**`, you must run
  `npm run build:spa` from the repo root and commit the regenerated `public/_spa/`, or
  production keeps serving the old app with no error.
- `supabase/functions/` — Deno edge functions. **Not deployed by Vercel.** They deploy
  separately via the Supabase CLI. Five of six are live; `send-plan-email` is not deployed
  (404) and has no caller, so deleting it is safe.

**Security model.**
- The SPA talks to Supabase **directly from the browser** with the anon key. Vercel is not in
  that path. **Row Level Security is the entire authorisation layer** for `profiles`,
  `bookings` and `user_plans`. Any RLS change is an internet-facing security change.
- The anon key is **public** — it ships inside `/_spa/assets/index-BXK52Lnq.js`. "Requires the
  anon key" is **not** authentication. Only a function that itself calls
  `supabaseAdmin.auth.getUser(token)` is actually protected.
- `SUPABASE_SERVICE_ROLE_KEY` must never reach a client bundle. It is legitimate only in the
  Node runtime of `app/api/lead/route.ts` and inside Deno functions.

**Things that are deliberately off — do not turn them on as part of a fix.**
- `PURCHASES_PAUSED = true` in `app/src/pages/PricingPage.jsx:12`. The Razorpay account is on
  hold. Checkout stays off until every box in `AUDIT/11-PAYMENTS.md` → *"Verification
  checklist before re-enabling checkout"* is ticked, and that is my decision, not yours.
- `LEADS_ENABLED` and `NEXT_PUBLIC_LEADS_ENABLED` are unset. They must be flipped **together**
  — one without the other gives either an unreachable API or a visible form where every
  submission fails.
- `MAINTENANCE_MODE` is unset. Setting it rewrites every route to `/maintenance`, which is
  fatal for indexing.

**Data and money live in more than one place.**
- Plan prices exist in **four** places: `next-app/data/seo/plans.ts` (source),
  `app/src/lib/serviceability.json` (generated by `npm run seo:export-spa`), and hand-copied
  into `create-razorpay-order/index.ts` and `verify-razorpay-payment/index.ts`. If you change
  one you must change all four, or you get a purchase outage visible only in production.
- The `leads` table and the `bookings` locality columns are a **proposal that has never been
  applied** (`app/migrations/2026-09-06-*.sql` says so on line 1). Code that assumes they
  exist will fail.

**Build gates.**
- `npm run build` in `next-app` runs `prebuild` = `seo:validate && seo:redirects && seo:gate`.
  A malformed data layer or a failed uniqueness gate blocks the build. This is intentional.
- `tsc --noEmit` is currently clean. `npm run lint` currently reports 64 errors that are
  **deliberate** (`@next/next/no-html-link-for-pages`, explained in
  `components/seo/CtaButtons.tsx:1-5`) plus ~1,190 problems from linting the minified SPA
  bundle in `public/`. Do not "fix" those by converting `<a>` to `<Link>` — the fix is the
  eslint config (FIN-DEP03).

**Testing constraints.**
- Never verify an email function by actually sending. Stub the Resend endpoint.
- Never verify a payment path with a real charge. Use Razorpay **test mode**, or stub.
- There is no staging environment configured in the repo. Assume any credential you are given
  points at production unless proven otherwise.

## When the phase is done

Give me:
1. A short summary of what changed, per finding ID.
2. The test output, verbatim.
3. Anything from the phase you did **not** do, and why.
4. What must be deployed, in what order, and what to check after each step — the plan's tasks
   often need a migration applied before the code that depends on it.
5. Any new finding you added to the matrix.

Then stop. Do not start the next phase.

---

# §B — Task cards

Paste the matching card under the prompt above.

## PHASE 0 — Emergency

```
{{PHASE}} = PHASE 0

Order matters inside this phase:
  - Do 0.6 (migration tooling) FIRST. Tasks 0.2 and 0.5 are schema changes and must be
    written as real migrations, not as more paste-into-the-dashboard SQL files.
  - Then 0.2 and 0.5 (database constraints + column-level GRANT). These retire the worst
    risk for the least work and need no code deploy.
  - Then 0.1 (authenticate the email functions).
  - Then 0.3 and 0.4 together (fail-closed verification + the Razorpay webhook). These ship
    as a pair: failing closed without a webhook turns a silent over-grant into a stranded
    paying customer.
  - 0.7 is a dashboard check I will do myself — remind me, do not attempt it.

Findings: FIN-S01, FIN-S02, FIN-S03, FIN-P01, FIN-P02, FIN-P03, FIN-P04, FIN-S04,
          FIN-DB01, FIN-DB02, FIN-DB06

Before the schema tasks, run the two duplicate-detection SELECTs in plan §0.2 and show me
the results. If either returns rows, stop — the indexes will fail and we need to decide how
to resolve the duplicates first.

Tests: AUDIT/13-TESTING.md Tier 1 (11 payment/auth assertions) and Tier 2 (RLS suite).
Write the FIN-S04 RLS assertion FIRST and show me it failing against the current schema
before you change anything.
```

## PHASE 1 — Critical

```
{{PHASE}} = PHASE 1

Findings: FIN-B01, FIN-U01, FIN-B02, FIN-B09, FIN-B03, FIN-B06, FIN-S06, FIN-DB03,
          FIN-U02, FIN-API01, FIN-API02, FIN-T01, FIN-T02, FIN-DEP03, FIN-B04, FIN-B05,
          FIN-U03, FIN-C07, FIN-B07, FIN-B08, FIN-PF01, FIN-C01, FIN-C02, FIN-SEO04

Note:
  - 1.3 (CTA context) touches app/src — remember `npm run build:spa` and commit public/_spa.
  - 1.4 (lead capture) has a strict order given in the plan. Do not set either LEADS_ENABLED
    flag; that is my call once the rest is verified.
  - 1.7 (refund policy) changes customer-facing legal text. Draft it, show me, and do not
    commit until I approve — this needs a lawyer's eye, not just an engineer's.
  - 1.5 stands up CI. Include the SPA staleness check described in AUDIT/17-DEPLOYMENT.md
    (rebuild app/ and diff against public/_spa).
```

## PHASE 2 — Growth

```
{{PHASE}} = PHASE 2

Findings: FIN-SEO01, FIN-PF05, FIN-B10, FIN-SEO02, FIN-S05, FIN-SEO05, FIN-A01, FIN-A02,
          FIN-A03, FIN-A05, FIN-A06, FIN-PF02, FIN-PF03, FIN-PF04, FIN-S07

START WITH 2.1 AND STOP. Task 2.1 is measurement: run `npm run seo:gsc` for Search Console
indexation on the /[city]/[area]/[slug] group, and read Vercel Speed Insights p75 LCP/INP/CLS
by route group. Report both numbers to me and wait.

Everything in 2.2 (reducing the indexed page surface from ~2,489 pages) and 2.5 (performance)
depends on those numbers. Do not change the content gate or delete/noindex a single page
before I have seen the indexation data.

2.6 (privacy policy rewrite) needs legal review — draft only.
```

## PHASE 3 — Engineering quality

```
{{PHASE}} = PHASE 3

Findings: FIN-C04, FIN-C05, FIN-P05, FIN-TD01, FIN-TD02, FIN-TD03, FIN-TD04, FIN-TD05,
          FIN-TD08, FIN-S09, FIN-S10, FIN-DB04, FIN-DB05, FIN-DEP01, FIN-DEP02, FIN-E01,
          FIN-E02, FIN-E03, FIN-E04

3.1 (the helpers/verifications/placements schema) is the most valuable item here and the one
with real business consequences — the site makes five verification claims on 2,513 pages with
no system of record behind them. Design the schema, show me, and get my sign-off before
writing the migration. Do not build UI for it in this phase; ops will populate it through the
Supabase dashboard initially.

3.5 (npm workspaces) touches both build setups. Do it last in the phase, on its own commit,
and verify both builds and the Vercel Root Directory setting still work.
```

## PHASE 4 — Nice to have

```
{{PHASE}} = PHASE 4

Findings: FIN-D01 through FIN-D09 (dead code), FIN-B11, FIN-B12, FIN-U04, plus the loose
items listed in the plan's Phase 4 table.

Deletions only after a fresh grep confirms each symbol is still unreferenced — the audit was
taken at commit 540cb1cd and earlier phases will have moved code.

Two need a decision from me rather than a fix:
  - the `platinum` value in the user_plans CHECK constraint (run
    `SELECT count(*) FROM user_plans WHERE plan_name = 'platinum'` first)
  - the maintenance page's fabricated progress bar and subsystem names
```

---

# §C — Session-opening checklist

Have the fresh session confirm these before it writes code. If any is wrong, the audit is
stale relative to the tree and the session should say so rather than proceed on assumptions.

```bash
git rev-parse --abbrev-ref HEAD        # expect a fix/ branch, not main
git status --short                     # expect clean
ls AUDIT/ | wc -l                      # expect 21 (20 audit docs + this file)
cd next-app && npx tsc --noEmit        # expect clean
cd next-app && npm test                # expect 7 pass / 0 fail
```

Baseline at the time of the audit — commit `540cb1cd`:

| Check | Baseline |
|---|---|
| `tsc --noEmit` | clean |
| `npm test` | 7 pass, 0 fail |
| `npm run lint` | 1,259 problems / 119 errors (65 in source, 64 of them deliberate) |
| Gated SEO pages | 2,513 composed · 2,489 indexable · 24 noindexed |
| `npm audit` (next-app) | 1 high (nanoid, transitive dev) |
| `npm audit` (app) | 6 high, 1 moderate, 1 low — all build-time except react-router |
| Edge functions live | 5 of 6 (`send-plan-email` returns 404) |

If a number moved and your change did not cause it, investigate before continuing.
