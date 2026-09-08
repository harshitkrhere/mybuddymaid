# 20 — Implementation prompt

A paste-ready prompt for running the remediation in fresh sessions, one phase at a time.

**Phase 0 is complete and merged** (`e9d8d00d`, 2026-09-08). This document has been rewritten
against what the repository and the production project actually look like after it. The
original Phase 0 version is in git history if you need it.

**How to use it**
1. Start a new session in `C:\Users\conta\dev\mybuddymaid`.
2. Paste **§A — The prompt**, replacing `{{PHASE}}` with `PHASE 1`, `PHASE 2`, etc.
3. Paste the matching **task card** from §B underneath it.
4. When the phase is done and merged, start a fresh session for the next one.

Do the phases in order.

---

# §A — The prompt

> Copy everything between the rules, replacing `{{PHASE}}`.

---

You are a senior engineer implementing a remediation phase on the MyBuddyMaid codebase.

A complete forensic audit of this repository exists in `AUDIT/`. It is the source of truth for
what is wrong. **Read these before writing any code:**

- `AUDIT/18-REMEDIATION-PLAN.md` — the plan. Find **{{PHASE}}** and work only that section.
- `AUDIT/19-FINDINGS-MATRIX.md` — every finding, including an "Added during remediation"
  section at the bottom with findings raised after the audit was written.
- `AUDIT/01-ARCHITECTURE.md` — how the three sub-projects fit together.

Then read the full write-up for each finding in your phase. Every task cites its finding ID
(e.g. `FIN-B01`); each ID has a full entry — root cause, evidence, recommended solution, tests
required, regression risk — in the relevant numbered document (`03-BUGS.md`, `04-SECURITY.md`,
`06-SEO.md`, `09-DATABASE.md`, `10-API.md`, and so on).

**The audit is not infallible.** `FIN-DOC01` records two places where its own recommended fix
was wrong and would have caused an outage if followed literally. Read the recommendation, then
check it against the code before you trust it.

## Your scope

Implement **{{PHASE}}** and nothing else.

- Do not start work from a later phase, even if it looks quick or related.
- Do not refactor code you are not otherwise touching.
- Do not add abstraction the task does not require.
- If you find a new problem outside your phase, add it to the "Added during remediation" table
  in `AUDIT/19-FINDINGS-MATRIX.md` with a new ID and tell me — do not fix it.

Prefer the smallest safe fix. Several findings are one missing conditional. Match the
surrounding code style, comment density and naming — the file-header comments explain design
decisions and are worth reading before you change a file.

## Working agreement

**Plan first.** Before editing, list the tasks in this phase in order, note dependencies, and
tell me the order you will work in.

**Work in small batches.** Two or three findings, then stop and show me. Do not implement a
whole phase and then present it. Phase 0 was done as one large batch and it took four hours to
discover that five defects had shipped in the new code.

**Review your own new code adversarially before you tell me it is done.** Not "do the tests
pass" — ask what interleaving, what forged input, what failure mode would break it. In Phase 0
the tests passed on code that let a buyer upgrade their own plan by forging a browser-supplied
field. Tests passing is not the same as correct.

**Tests are part of the task, not a follow-up.** A task is not done until the behaviour it
fixes has a test that fails against the old code and passes against the new. Show me both runs.
`AUDIT/13-TESTING.md` lists the required assertions per finding.

**Ask before every production-mutating step**, each one individually — not as a batch I approve
once. That includes applying a migration, deploying a function, changing dashboard settings and
pushing.

**When something looks wrong in my data or my dashboard, ask me before investigating.** I may
have just deleted a test row.

**Report honestly.** If a test fails, show the output. If you skipped something, say so. If a
fix turned out to be wrong or bigger than the plan estimated, stop and tell me rather than
expanding scope silently. Do not describe a phase as "verified 100%" — say what was verified,
how, and what was not.

**Commit per task group**, with a message saying what changed and why, citing finding IDs.
Branch off `main` as `fix/{{PHASE}}-<short-name>` before the first commit; never commit directly
to `main`.

## Checks that must pass before every commit

```
cd next-app && npx tsc --noEmit          # currently clean — keep it clean
cd next-app && npm test                  # currently 7/7 — keep it green
cd next-app && npm run seo:validate      # data-layer gate; prebuild runs this too
```

If you touched `app/src/**`, also:
```
cd app && npx vite build
npm run build:spa      # from the repo root, then COMMIT next-app/public/_spa
```

If you touched `supabase/functions/**`:
```
npx deno@2 check --no-lock supabase/functions/<name>/index.ts
npx deno@2 test --no-lock --no-check --allow-env --allow-net supabase/functions/__tests__/
```

## Stop and ask me before

- Deploying anything — Supabase functions, migrations against the live database, Vercel.
- Any command that sends a real email, creates a real Razorpay order, or writes production data.
  **`create-razorpay-order` creates a real order on a live Razorpay account. Do not call it as a
  probe.**
- Changing a published price, a refund term, or any customer-facing legal text.
- Flipping a feature flag (`PURCHASES_PAUSED`, `LEADS_ENABLED`, `NEXT_PUBLIC_LEADS_ENABLED`,
  `MAINTENANCE_MODE`).
- Rotating or disabling any API key.
- Any schema change you cannot express as an additive, idempotent, reversible migration.
- `git push` or opening a PR.

## Repo facts you must not get wrong

These are non-obvious and a fresh session will otherwise assume the opposite.

**Three sub-projects, three deploy paths.**
- `next-app/` — Next.js 16, the public site. Vercel Root Directory is `next-app`. Do not create
  a root `vercel.json`.
- `app/` — the Vite booking SPA served at `/app/*`. Its build output is **committed** to
  `next-app/public/_spa/`. Vercel runs only `next build` and never rebuilds the SPA, so if you
  change `app/src/**` you must run `npm run build:spa` from the repo root and commit the
  regenerated `public/_spa/`, or production keeps serving the old app with no error.
- `supabase/functions/` — Deno edge functions. Not deployed by Vercel. Deploy with the CLI,
  naming functions explicitly.

**Deploying edge functions.**
```
npx supabase functions deploy create-razorpay-order verify-razorpay-payment delete-account send-package-email send-booking-email
npx supabase functions deploy razorpay-webhook --no-verify-jwt
```
`razorpay-webhook` is the only function that may be deployed with `--no-verify-jwt`; its
authentication is the Razorpay signature. Deployed without the flag, every event is rejected by
the gateway with no symptom except plans quietly not activating.

**Never deploy `send-plan-email`.** It is undeployed, has no caller, fails `deno check`, and has
the FIN-S01 open-relay defect (`FIN-S12`). A bare `functions deploy` with no names would sweep
it up. Always name functions explicitly.

**Migrations exist now.** `supabase/config.toml` and `supabase/migrations/` are in use and the
history is baselined on the live project. `supabase db push` applies anything new.
`supabase/migrations-pending/` holds reviewed-but-deliberately-unapplied SQL — the leads
migration lives there and applying it is Phase 1 task 1.4. To ship a pending file, `git mv` it
into `migrations/` with a **fresh timestamp later than every applied migration**; the CLI orders
by filename and a back-dated file is applied out of order or skipped.

**API keys.** The project uses Supabase newer API keys: `sb_publishable_…` in the browser and
`sb_secret_…` on servers. The legacy `anon`/`service_role` JWTs are also currently enabled.
`app/.env` holds the publishable key as `VITE_SUPABASE_ANON_KEY`, and it is inlined into the
committed SPA bundle. **Changing the browser key means rebuilding and recommitting the SPA, or
the live booking app breaks for everyone with no warning.** That has already happened once.

**Edge functions cannot be called from localhost.** All of them pin
`ALLOWED_ORIGIN = 'https://mybuddymaid.in'`, so a browser preflight from `localhost:5173` is
rejected and the request never leaves the machine. Bookings work locally (PostgREST allows any
origin) but booking emails, payment verification and everything else in `supabase/functions/`
do not. **Do not diagnose "the email did not send" from a localhost test** — there will be no
`email_logs` row because the function was never reached. Test those paths on the live site.

**Function layout.** `verify-razorpay-payment`, `send-package-email`, `send-booking-email` and
`razorpay-webhook` are each a three-line `index.ts` entry point plus a `handler.ts` holding the
logic, so tests can import the handler without `Deno.serve` binding a port. `_shared/auth.ts`
holds the caller-identity check. `create-razorpay-order` and `delete-account` still carry inline
copies of that check.

**Testing.** Deno is not installed; use `npx deno@2`. `deno test` needs `--no-check` because the
esm.sh supabase-js chain pulls an unresolvable `npm:@types/node` reference; types are gated
separately by `deno check`. There are 47 assertions in `supabase/functions/__tests__/` (all
offline, everything stubbed at the `fetch` boundary) and an RLS suite in `supabase/__tests__/`
that needs a live project and creates throwaway users.

**Security model.** The SPA talks to Supabase directly from the browser. Vercel is not in that
path. Row Level Security is the entire authorisation layer for `profiles`, `bookings` and
`user_plans`. Any RLS change is an internet-facing security change. The browser key is public —
"requires the browser key" is not authentication. Only a function that itself calls
`supabaseAdmin.auth.getUser(token)` is actually protected.

**Things that are deliberately off — do not turn them on as part of a fix.**
- `PURCHASES_PAUSED = true` in `app/src/pages/PricingPage.jsx`. The Razorpay account is on hold.
  Checkout stays off until every box in `AUDIT/11-PAYMENTS.md` → "Verification checklist before
  re-enabling checkout" is ticked, and that is my decision.
- `LEADS_ENABLED` and `NEXT_PUBLIC_LEADS_ENABLED` are unset and must be flipped together.
- `MAINTENANCE_MODE` is unset. Setting it rewrites every route to `/maintenance`.

**Data lives in more than one place.** Plan prices exist in `next-app/data/seo/plans.ts`
(source), `app/src/lib/serviceability.json` (generated by `npm run seo:export-spa`), and are
hand-copied into `create-razorpay-order`, `verify-razorpay-payment` **and now
`razorpay-webhook`** — three Deno copies since Phase 0. Change one, change all five.

**Environment.** Windows PowerShell 5.1. No `&&` chaining (use `;` and `if ($?) { }`), no
`ConvertFrom-SecureString -AsPlainText`, no ternary or null-coalescing operators.

**Build gates.** `npm run build` in `next-app` runs `prebuild = seo:validate && seo:redirects &&
seo:gate`. `tsc --noEmit` is clean. `npm run lint` reports ~64 deliberate errors plus ~1,190
problems from linting the minified SPA bundle in `public/` — do not "fix" those by converting
`<a>` to `<Link>`; the fix is the eslint config (`FIN-DEP03`).

## What Phase 0 left open

Carry these forward; they are not yours to fix unless your phase names them.

- **`FIN-P03` is partial.** Refunds revoke a plan and failed payments are logged, but there is
  no `payment_events` table, so the payment funnel is still not measurable.
- **`razorpay-webhook` has never received a real event.** The endpoint is not registered in the
  Razorpay dashboard, `RAZORPAY_WEBHOOK_SECRET` has not been proven correct, and auto-capture
  has not been confirmed. A wrong secret produces the same 401 as a forged signature, forever.
- **`FIN-S01` is partial.** `create-razorpay-order` and `delete-account` still carry inline auth
  checks rather than importing `_shared/auth.ts`.
- **`FIN-E05`.** Preview deployments are production Supabase clients, because the SPA bundle is
  committed with production credentials. Not fixable by Vercel settings; needs `FIN-E02`.
- **`FIN-B13`.** The SPA cannot display any edge function error message — `functions-js` throws
  on non-2xx, so `verifyData?.error` is always undefined and the generic fallback always shows.
- **No end-to-end payment test has ever run**, in test mode or otherwise.

## When the phase is done

Give me: a short summary per finding ID; the test output verbatim; anything you did not do and
why; what must be deployed, in what order, and what to check after each step; and any new
finding you added to the matrix. Then stop. Do not start the next phase.

---

# §B — Task cards

Paste the matching card under the prompt above.

## PHASE 1 — Critical

`{{PHASE}} = PHASE 1`

Findings: FIN-B01, FIN-U01, FIN-B02, FIN-B09, FIN-B03, FIN-B06, FIN-S06, FIN-DB03, FIN-U02,
FIN-API01, FIN-API02, FIN-T01, FIN-T02, FIN-DEP03, FIN-B04, FIN-B05, FIN-U03, FIN-C07, FIN-B07,
FIN-B08, FIN-PF01, FIN-C01, FIN-C02, FIN-SEO04.

This is the biggest phase in the plan. **Do it in four separate sessions**, one per group below,
merging between them. Do not attempt it in one pass.

- **1a — legal pages and small bug fixes** (1.1, 1.6): FIN-B01, FIN-SEO04, FIN-B04, FIN-B05,
  FIN-U03, FIN-C07, FIN-B07, FIN-B08, FIN-PF01. Mostly one-line changes. Several touch
  `app/src/**`, so remember `npm run build:spa` and commit `public/_spa`.
- **1b — CI and the test suite** (1.5): FIN-T01, FIN-T02, FIN-DEP03. Fix the eslint config first
  so `lint` can pass. Include the SPA staleness check from `AUDIT/17-DEPLOYMENT.md`: rebuild
  `app/` in CI and diff against `public/_spa`. Do this early — it protects every later phase.
- **1c — the conversion path** (1.2, 1.3): FIN-U01, FIN-B02, FIN-B09. 1.2 re-points the paused
  checkout funnel. **The paused-checkout modal itself is the owner design and must not be
  redesigned** — show me any change to it before building. 1.3 needs the Playwright test in
  `AUDIT/13-TESTING.md` Tier 5.
- **1d — lead capture** (1.4): FIN-B03, FIN-B06, FIN-S06, FIN-DB03, FIN-U02, FIN-API01,
  FIN-API02. Strict order given in the plan. Promote the leads migration out of
  `migrations-pending/` with a fresh timestamp. Do **not** set either `LEADS_ENABLED` flag; that
  is my call once the rest is verified. Note `SUPABASE_SERVICE_ROLE_KEY` and
  `NEXT_PUBLIC_SUPABASE_URL` do not exist in Vercel yet — when you add them, scope to Production
  only (`FIN-E05`).

1.7 (refund policy, FIN-C01/FIN-C02) changes customer-facing legal text. Draft it, show me, and
do not commit until I approve — this needs a lawyer eye, not just an engineer.

## PHASE 2 — Growth

`{{PHASE}} = PHASE 2`

Findings: FIN-SEO01, FIN-PF05, FIN-B10, FIN-SEO02, FIN-S05, FIN-SEO05, FIN-A01, FIN-A02,
FIN-A03, FIN-A05, FIN-A06, FIN-PF02, FIN-PF03, FIN-PF04, FIN-S07.

**START WITH 2.1 AND STOP.** Task 2.1 is measurement: run `npm run seo:gsc` for Search Console
indexation on the `/[city]/[area]/[slug]` group, and read Vercel Speed Insights p75 LCP/INP/CLS
by route group. Report both numbers and wait.

Everything in 2.2 (reducing the indexed surface from ~2,489 pages) and 2.5 (performance) depends
on those numbers. Do not change the content gate or delete/noindex a single page before I have
seen the indexation data. 2.6 (privacy policy rewrite) needs legal review — draft only.

## PHASE 3 — Engineering quality

`{{PHASE}} = PHASE 3`

Findings: FIN-C04, FIN-C05, FIN-P05, FIN-TD01, FIN-TD02, FIN-TD03, FIN-TD04, FIN-TD05, FIN-TD08,
FIN-S09, FIN-S10, FIN-DB04, FIN-DB05, FIN-DEP01, FIN-DEP02, FIN-E01, FIN-E02, FIN-E03, FIN-E04.

3.1 (the `helpers` / `helper_verifications` / `placements` schema) is the most valuable item here
and the one with real business consequences — the site makes five verification claims on 2,513
pages with no system of record behind them. Design the schema, show me, get sign-off before
writing the migration. No UI in this phase; ops will populate through the Supabase dashboard.

3.2 (FIN-P05) must now generate **three** Deno copies of `PLAN_DETAILS`, not two —
`razorpay-webhook` is the third.

3.4 (FIN-E02) is what closes `FIN-E05`: build the SPA in CI with per-environment `VITE_*`
variables instead of committing the artifact. Note the three `VITE_*` variables currently in
Vercel are inert and Production-scoped; the day the build command changes, Preview will have
none. 3.5 (npm workspaces) touches both build setups — do it last, on its own commit, and verify
both builds and the Vercel Root Directory still work.

## PHASE 4 — Nice to have

`{{PHASE}} = PHASE 4`

Findings: FIN-D01 through FIN-D09 (dead code), FIN-B11, FIN-B12, FIN-U04, FIN-S11, plus the
loose items in the plan Phase 4 table.

Deletions only after a fresh grep confirms each symbol is still unreferenced — earlier phases
will have moved code. `FIN-D01` (delete `send-plan-email`) also closes `FIN-S12`.

Two need a decision from me rather than a fix:
- the `platinum` value in the `user_plans` CHECK constraint (run
  `SELECT count(*) FROM user_plans WHERE plan_name = 'platinum'` first);
- the maintenance page fabricated progress bar and subsystem names.

---

# §C — Session-opening checklist

Have the fresh session confirm these before it writes code. If any is wrong, say so rather than
proceeding on assumptions.

```
git rev-parse --abbrev-ref HEAD        # expect a fix/ branch, not main
git status --short                     # expect clean
ls AUDIT/ | wc -l                      # expect 21
cd next-app && npx tsc --noEmit        # expect clean
cd next-app && npm test                # expect 7 pass / 0 fail
npx deno@2 test --no-lock --no-check --allow-env --allow-net supabase/functions/__tests__/
                                       # expect 47 passed / 0 failed
npx supabase migration list            # expect 5 migrations, all present on remote
npx supabase functions list            # expect 6 ACTIVE; razorpay-webhook verify_jwt=false;
                                       # send-plan-email absent
```

Baseline after Phase 0 — commit `e9d8d00d`:

| Check | Baseline |
|---|---|
| `tsc --noEmit` | clean |
| `npm test` (next-app) | 7 pass / 0 fail |
| `deno test` (functions) | 47 pass / 0 fail |
| RLS suite | 9 steps pass (needs a live project) |
| `npm run lint` | ~1,259 problems / 119 errors (65 in source, 64 deliberate) |
| Gated SEO pages | 2,513 composed · 2,489 indexable · 24 noindexed |
| Edge functions live | 6 of 7 (`send-plan-email` deliberately not deployed) |
| Applied migrations | 5 |

If a number moved and your change did not cause it, investigate before continuing.
