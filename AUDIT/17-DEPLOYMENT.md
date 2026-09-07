# 17 — Environment and deployment

## Deployment topology

```
git push main
   └─ Vercel builds  next-app/  (Root Directory must be set to `next-app`)
        prebuild: seo:validate && seo:redirects && seo:gate
        build:    next build → 2,513 SSG pages + 35 blog + statics
        serves:   everything, including /_spa/* (the committed SPA build)

app/  is NOT built by Vercel.  It is built manually:
   npm run build:spa  →  vite build (base=/_spa/)  →  copy to next-app/public/_spa  →  commit

supabase/functions/  are NOT deployed by Vercel.
   Deployed manually via the Supabase CLI/dashboard. No script in the repo does this.
```

Three deployment mechanisms, two of them manual, none of them automated or verified.

## Environment variables — the complete contract

Assembled by scanning every `process.env`, `Deno.env.get` and `import.meta.env` reference.
**There is no `.env.example` anywhere in the repository.**

### Vercel (`next-app`) — runtime

| Variable | Used by | Required? | Notes |
|---|---|---|---|
| `LEADS_ENABLED` | `api/lead/route.ts:23` | no | `'true'` enables the endpoint. Currently unset → 503 (verified live) |
| `NEXT_PUBLIC_LEADS_ENABLED` | `components/seo/SeoPage.tsx:11` | no | Must be flipped **together with** the one above, or the form renders and every submit 503s |
| `NEXT_PUBLIC_SUPABASE_URL` | `api/lead/route.ts:49` | only if leads enabled | |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/lead/route.ts:50` | only if leads enabled | **Server-only.** Correctly not `NEXT_PUBLIC_` |
| `MAINTENANCE_MODE` | `lib/maintenance.ts:4` | no | `'true'` rewrites every route to `/maintenance` |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | `app/layout.tsx:23` | no | |
| `NEXT_PUBLIC_BING_SITE_VERIFICATION` | `app/layout.tsx:24` | no | |

### Vite (`app`) — inlined at build time

| Variable | Used by | Required? |
|---|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabase.js:3` | **yes** |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.js:4` | **yes** |
| `VITE_RZP_KEY` | `src/lib/constants.js:133` | no (unused while checkout is paused) |

Held in the untracked `app/.env` (confirmed present on disk, correctly gitignored, not
tracked by git).

### Supabase Edge Functions — per-function secrets

| Variable | Used by |
|---|---|
| `SUPABASE_URL` | all six |
| `SUPABASE_SERVICE_ROLE_KEY` | all six |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | the two payment functions |
| `RESEND_API_KEY` | the three email functions |
| `RAZORPAY_WEBHOOK_SECRET` | — **does not exist yet**; needed for FIN-P02 |

### Scripts only (never runtime)

`BASE_URL`, `CRAWL_CONCURRENCY`, `CHECK_CONCURRENCY`, `FETCH_RETRIES`, `GATE_STAMP`,
`IMPORT_DATE`, `INDEXNOW_KEY`, `OVERPASS_GAP_MS`, `SAMPLE`, `GSC_SERVICE_ACCOUNT_JSON`,
`VERCEL_AUTOMATION_BYPASS_SECRET`, `SPA_BASE`.

---

## [FIN-E01] No `.env.example`, so the environment contract is undocumented

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Deployment / Operations

**Location:** repository root, `next-app/`, `app/` — none exists in any of them

Nineteen environment variables across three runtimes, and the only way to discover any of them
is to grep the source. A new deployment, a new environment, or a new developer has no
reference. This is not hypothetical: `ASSUMPTIONS.md` #50 records that the whole Supabase
project was replaced and lists from memory what the new project still needs.

Two of the flags are also **coupled and non-obvious**: setting `LEADS_ENABLED` without
`NEXT_PUBLIC_LEADS_ENABLED` produces a working API nobody can reach; setting the reverse
produces a visible form where every submission fails. Nothing documents that pairing.

**Fix:** add `.env.example` to each project with every variable, a one-line comment, and a
`# required` / `# optional` marker. Add a `supabase/functions/.env.example` too. Then add a
short "Deploying" section to the README naming all three deployment mechanisms.

---

## [FIN-E02] Two of the three deployment steps are manual and unverified

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Deployment / Operations

**Location:** `scripts/build-spa.mjs`, `supabase/functions/*`, root `package.json` `//deploy` note

**The SPA.** `next-app/public/_spa/` is a committed build artifact. The root `package.json`
carries the instruction as a comment: *"Run `npm run build:spa` whenever app/ changes."*
Nothing enforces it. If someone edits `app/src` and forgets, the site silently serves the
previous booking app — with no error, no warning and no visible difference until a user hits
the missing behaviour.

It happens to be current today (verified: the shipped bundle contains ₹4,999/₹5,999/₹6,999
matching `plans.ts`), which is a credit to discipline, not to process.

**The edge functions.** There is no deployment script, no `supabase/config.toml`, and no
record of what is deployed. The audit found the discrepancy by probing production:
`send-plan-email` returns 404 while the other five return 200. Nothing in the repository would
have told you that.

**Fix.**
1. Add a CI step that rebuilds `app/` and fails if the output differs from
   `next-app/public/_spa/`. Roughly 10 lines, and it eliminates an entire class of "the app is
   stale" incidents.
2. Add `supabase/config.toml` and a `deploy:functions` script:
   ```json
   "deploy:functions": "supabase functions deploy create-razorpay-order verify-razorpay-payment delete-account send-package-email send-booking-email"
   ```
   Note that the webhook from FIN-P02, when added, needs `--no-verify-jwt` and must be listed
   separately.
3. Better long-term: stop committing the SPA build. Make `next-app`'s build command
   `npm run build:spa && next build` so Vercel builds both from source. The trade-off is a
   longer build; the gain is that the artifact can never be stale. Note this requires the
   `VITE_*` variables in Vercel's build environment.

---

## [FIN-E03] `vercel.json` and `next.config.ts` set overlapping, inconsistent headers

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Deployment / Configuration

**Location:** `next-app/vercel.json:5-45` vs `next-app/next.config.ts:5-12,20-29`

Both files configure headers for `/(.*)`:

| Header | `next.config.ts` | `vercel.json` |
|---|---|---|
| `X-Content-Type-Options` | nosniff | nosniff |
| `X-Frame-Options` | DENY | DENY |
| `Referrer-Policy` | strict-origin-when-cross-origin | strict-origin-when-cross-origin |
| `Strict-Transport-Security` | **yes** | no |
| `Permissions-Policy` | **yes** | no |
| `X-DNS-Prefetch-Control` | **yes** | no |
| image `Cache-Control` | `.(png\|jpg\|jpeg\|webp\|avif\|svg\|ico\|woff2)` | `.jpg`, `.png`, `/logo.png` only |

Live verification shows the `next.config.ts` set winning (HSTS and `Permissions-Policy` are
present on every response), so **the `vercel.json` headers block is redundant**. But two
sources of truth for security headers is a trap: a future edit to `vercel.json` may or may not
take effect depending on Next.js's merge behaviour, and no one will know which without testing.

`vercel.json` also declares `"buildCommand": "npm run build"` and `"framework": "nextjs"`,
which are Vercel's defaults for a Next.js project — also redundant.

**Fix:** delete the `headers` array from `vercel.json` and keep all headers in
`next.config.ts`, which already has the more complete set. If `vercel.json` ends up with
nothing but defaults, delete the file. Note the root `package.json` comment warns there is
*deliberately* no root `vercel.json` (the old one deployed a retired static site) — that
warning should stay.

---

## [FIN-E04] No health endpoint, no uptime monitoring, no deploy verification

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Deployment / Operations

There is no `/api/health`, no smoke test after deploy, and no uptime monitor. Nothing checks
after a deploy that the site renders, that Supabase is reachable, or that the edge functions
respond. The `send-plan-email` 404 discovered in this audit is exactly the kind of drift a
one-line post-deploy check would surface.

**Fix:**
```ts
// app/api/health/route.ts
export const dynamic = 'force-dynamic';
export async function GET() {
  const supabase = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`)
    .then(r => r.status === 401 || r.ok).catch(() => false);
  return Response.json({ ok: supabase, sha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev', ts: Date.now() },
                       { status: supabase ? 200 : 503 });
}
```
Point any free uptime monitor at it. Add `/api/health` to the `robots.txt` disallow list
(`/api/` already covers it).

---

## Configuration reviewed and found correct

| Item | Verdict |
|---|---|
| Secrets exposed to the client | **None.** `SUPABASE_SERVICE_ROLE_KEY` is read only in the Node runtime of `/api/lead` and in Deno functions. The SPA bundle contains only the anon key (public by design) and **no Razorpay key** (verified by grep of the shipped bundle). |
| `.gitignore` | Correct and thorough — `.env`, `.env.*`, `app/.env`, `app/dist`, `node_modules`, plus the importer's lock and temp files. `app/.env` exists on disk and is untracked (verified). |
| Debug flags in production | **None found.** No `NODE_ENV` branches that change behaviour, no debug routes, no verbose logging toggles. `import.meta.env.DEV` guards exactly one `console.error` in `supabase.js:7`. |
| Source maps | Not explicitly enabled; Next.js does not emit client source maps in production by default. Vite emits none by default either. Verified: no `.map` files in `public/_spa/assets/`. |
| CORS | Correctly pinned to `https://mybuddymaid.in` in all six edge functions. Not a wildcard. |
| Security headers | **Verified live** on production: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS `max-age=63072000; includeSubDomains; preload`. No CSP — see FIN-S10. |
| Redirects | **Verified live**: `www` → apex 308 single hop; `.html` → clean 301; `/maintenance` → `/` 302 when off. |
| Robots on non-public surfaces | **Verified live**: `/app` returns `X-Robots-Tag: noindex, nofollow`, and `robots.txt` disallows `/app`, `/_spa/`, `/api/`, `/maintenance`. |
| Caching | One-year immutable on `/_spa/assets/*` and image/font extensions; **verified live** on `/og`. HTML uses Next.js's `max-age=0, must-revalidate` with Vercel's CDN in front — correct for this host. |
| Build gate | `prebuild` runs `seo:validate && seo:redirects && seo:gate`, so a malformed data layer or a failed uniqueness gate blocks the build. This is a genuinely good control and the closest thing to CI in the project. |
| Environment separation | **Not assessable from the repository.** There is no staging configuration, no preview-specific env handling, and no indication whether Vercel Preview deployments point at the production Supabase project. **If they do, preview builds write to production data.** Worth checking in the Vercel dashboard as a matter of urgency — it is a one-minute check with a large downside. |
