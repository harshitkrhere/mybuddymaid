# 10 — API and data flow

## Surface inventory

The product has an unusually small API surface. That is a strength — but it means the few
endpoints that exist carry a lot.

| Endpoint | Runtime | Auth | Method | Status |
|---|---|---|---|---|
| `POST /api/lead` | Next.js Node | none (public) | POST | Live, returns 503 (feature-gated) |
| `GET /og` | Next.js Edge | **none** | GET | Live, unauthenticated (FIN-S05) |
| `GET /sitemap.xml`, `/sitemaps/[shard]` | Next.js | none | GET | Live, static |
| `GET /robots.txt` | Next.js | none | GET | Live, static |
| `POST functions/v1/create-razorpay-order` | Deno | user JWT ✅ | POST | Live |
| `POST functions/v1/verify-razorpay-payment` | Deno | user JWT ✅ | POST | Live |
| `POST functions/v1/delete-account` | Deno | user JWT ✅ | POST | Live |
| `POST functions/v1/send-package-email` | Deno | **none** ❌ | POST | Live (FIN-S01) |
| `POST functions/v1/send-booking-email` | Deno | **none** ❌ | POST | Live (FIN-S01) |
| `POST functions/v1/send-plan-email` | — | none | — | **Not deployed** (404). Dead. |
| `GET/POST/PATCH rest/v1/{profiles,bookings,user_plans}` | Supabase PostgREST | anon key + **RLS** | all | Live, called directly from the browser |

**The most important row is the last one.** The booking app does not go through an API layer
of its own; it talks to PostgREST directly with the public anon key. There is no server-side
request validation, no rate limiting, no input sanitisation and no business-logic layer
between the browser and the database for `profiles`, `bookings` and `user_plans`. RLS is the
entire API contract. Every column exposed by RLS is effectively a public API.

## `/api/lead` — the only first-party HTTP API

`next-app/app/api/lead/route.ts`, 80 lines. Reviewed in full.

**Validation — good.** Every location value is checked against the data layer, not against a
regex:
```ts
if (!CITY_BY_SLUG.has(city))                                        → 400 Unknown city
if (!ALL_LOCALITIES.some(l => l.city===city && l.slug===locality))  → 400 We do not serve that locality yet
if (service && !SERVICE_BY_SLUG.has(service))                       → 400 Unknown service
if (body.pincode && !isServiceable(body.pincode))                   → 400 Pincode outside service area
```
This is the right pattern — an attacker cannot write a locality the company does not serve,
and it cannot drift from the SEO pages because it reads the same module they render from.

Name is trimmed and clamped to 80; phone is normalised (`replace(/\D/g,'').slice(-10)`) then
required to be exactly 10 digits, which correctly handles `+91 98765 43210`, `098765 43210`
and `9876543210` alike. `source_page` is clamped to 300.

**Status codes — mostly correct.** 503 (disabled), 400 (invalid JSON / validation), 503
(storage not configured), 502 (upstream insert failed), 200 (ok). One nit: "lead capture is
not enabled" is arguably 404 rather than 503, since it is not a temporary condition — but 503
is defensible and the message is clear.

**Findings:**

| ID | Issue | Severity |
|---|---|---|
| FIN-B03 | Inserts `city` / `locality` / `service`; the schema declares `city_slug` / `locality_slug` / `service_slug`. Every insert would 400 → route returns 502. See `03-BUGS.md`. | HIGH (latent) |
| FIN-S06 | No rate limiting, CAPTCHA, honeypot or duplicate suppression on a public write endpoint using the service-role key. See `04-SECURITY.md`. | MEDIUM |
| FIN-API01 | Pincode regex mismatch — the route accepts `^\d{6}$` via `isServiceable()`; the DB CHECK is `^[1-9][0-9]{5}$`. A `0`-leading pincode passes the route and is rejected by Postgres. | LOW |
| FIN-API02 | No `Origin` check. Any site can POST leads from a user's browser. Combined with no rate limit, a competitor can fill the funnel from their own page. | LOW |
| FIN-API03 | `console.error('lead insert failed', res.status, await res.text())` logs the full PostgREST error. Server-side only (Vercel logs), so not a client leak — but it will contain the payload shape and should be reduced once the schema mismatch is fixed. | LOW |

**Not a finding, checked:** the response body never echoes user input, so there is no
reflected-XSS surface; `runtime = 'nodejs'` is correct (the service-role key must not be in
an edge bundle); `dynamic = 'force-dynamic'` is correct for a POST handler.

## Edge function API design

**Consistent and good:** all six share the same `corsHeaders` pinned to
`https://mybuddymaid.in`, the same `jsonResponse()` helper, the same `{ error: string }` body
shape, and the same top-level try/catch returning a generic 500 without leaking internals
(`console.error` keeps the detail server-side). Status codes are used correctly — 401
unauthenticated, 402 payment not completed, 403 verification failed, 409 already has a plan,
502 upstream failure, 503 not configured.

**Inconsistent and problematic:**

1. **Auth is per-function copy-paste, and two functions forgot it.** The same six lines appear
   verbatim in three functions and are absent from two others (FIN-S01). There is no
   `_shared/` directory. This is the root cause of the highest-severity finding in the audit,
   and the fix is structural: one shared module, imported by all six.

2. **No request schema validation.** Every function does `await req.json()` and then reads
   properties. `zod` is already a devDependency in `next-app` and Deno can import it from
   `esm.sh` exactly as it imports `supabase-js`. A schema per function would have caught the
   `plan_name`-from-body issue (FIN-P01) and would make `phone`, `email` and `notes`
   length-bounded, which they currently are not.

3. **Mass assignment on the email functions.** `send-package-email` takes `user_id`,
   `user_email`, `plan_name`, `amount_paid`, `razorpay_payment_id`, `expires_at` and
   `replacements_total` from the body and renders all of them into a customer-facing email.
   Every one of those is derivable server-side from `user.id`. This is the textbook mass
   assignment shape, and it is what makes FIN-S01 a phishing tool rather than a spam annoyance.

4. **No rate limiting on any function.** Supabase applies platform-level limits, but nothing
   application-specific. `create-razorpay-order` in particular creates a real Razorpay order
   per call; a loop creates unbounded orphaned orders in the Razorpay account.

5. **No API versioning.** Function names are unversioned. Since the SPA is a committed build
   artifact, a breaking change to a function's contract breaks every cached copy of the
   bundle until someone rebuilds and redeploys. There is no way to run old and new contracts
   side by side.

## Error handling across external dependencies

The brief asks: *what happens if this dependency is down?* Answered per dependency.

| Dependency | Timeout | Retry | Backoff | User feedback | Logged | Alerted | If it is down |
|---|---|---|---|---|---|---|---|
| Supabase Postgres (from browser) | client default | none | none | generic message | `console.error` only | **no** | Pages render empty; `AuthContext` catch blocks return `null`/`[]` and set state anyway, so the UI shows "No bookings yet" rather than an error. **A database outage is indistinguishable from having no data.** |
| Supabase Auth | client default | SDK-internal | — | friendly-mapped message | no | **no** | Sign-in fails with "Network error. Please check your connection." Reasonable. |
| Razorpay Orders API | none | none | none | "Failed to create payment order" | yes | **no** | Purchase blocked; correct behaviour. |
| Razorpay Payments API | none | none | none | **none — silently skipped** | yes | **no** | **Plan activates without verification** (FIN-S03). |
| Resend | none | none | none | none (fire-and-forget `.catch(()=>{})`) | `email_logs` | **no** | No confirmation email; the customer is never told. `email_logs` records it but nobody reads that table. |
| Vercel / the site itself | — | — | — | — | — | **no** | No uptime monitoring exists. |

**The pattern:** every failure is caught, logged to a console nobody watches, and converted
into an empty or generic state. Nothing retries, nothing backs off, and nothing alerts. The
most consequential instance is the Razorpay one (FIN-S03), where the failure path silently
grants a paid product.

**Minimum viable fix:**
1. `AbortSignal.timeout(8000)` on every outbound `fetch` in the edge functions.
2. One retry with jittered backoff for idempotent GETs (the Razorpay payment lookup).
3. Distinguish "error" from "empty" in `AuthContext` — add an `error` field to the context and
   render a retry affordance instead of an empty state.
4. Error tracking (Sentry) on both front-ends and in the edge functions. This is the single
   highest-value operational addition available, and it is an afternoon of work.

## Observability

Assessed against the brief's question: *can a production incident actually be diagnosed?*
**No.**

| Capability | Present |
|---|---|
| Error tracking (Sentry/Rollbar/etc.) | **none** |
| Structured logging | **none** — `console.log`/`console.error` with ad-hoc `[function-name]` prefixes |
| Request IDs / correlation IDs | **none** — a customer's failed purchase cannot be traced across SPA → function → Razorpay → database |
| Uptime monitoring / health endpoint | **none** — there is not even a `/api/health` to point a monitor at |
| Alerting | **none** |
| Audit log of privileged actions | **none** — plan activation, account deletion and (hypothetically) status changes leave no trail beyond `console.log` |
| Product analytics | GA4 + Umami + Vercel Analytics — three tools, all measuring page-level behaviour, none measuring system health |
| Payment funnel metrics | **none** — orders created, attempted, captured and activated are four numbers that do not exist anywhere |
| Email deliverability | `email_logs` table exists and is written; nothing reads it |

There is a real asymmetry here: the marketing side is instrumented three times over
(GA4, Umami, Vercel Analytics, Speed Insights), while the transactional side — payments,
bookings, account deletion, email — has no instrumentation at all. If a customer says "I paid
and got nothing", the only investigative tool is the Supabase dashboard and Razorpay's own
console, correlated by hand.

**Recommended minimum, in order:**
1. **Sentry** in `next-app`, the SPA and the edge functions. Catches FIN-S03-class silent
   failures immediately.
2. **A request id** generated in the SPA, passed as a header to every function, logged at both
   ends and stored on `user_plans` / `bookings`.
3. **`/api/health`** returning build SHA and a Supabase connectivity check, pointed at any
   uptime monitor.
4. **Read `email_logs`** — a weekly query for `status != 'sent'` is five minutes of work and
   turns an unread table into a working alert.
