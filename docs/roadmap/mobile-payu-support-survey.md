# Survey — native apps, PayU, a support chatbot, and the support record

Written 2026-09-10 against `main` (`584e76a3`), working tree clean apart from an untracked
`.claude/`; revised the same day after the owner's decisions.

**This document plans work; it does not do any.** No dependency was installed, nothing was
deployed, and no production system, dashboard or database was touched. Two sets of files under
`docs/` were changed, both deliberately and both unpublished:

- **`docs/roadmap/mobile-payu-support-survey.md`** — this document.
- **`docs/legal/drafts/`** — per decision 2, so the 2.0 documents ship once. `privacy-policy.md`
  and `terms-of-service.md` now name PayU instead of Razorpay throughout, and carry the
  chatbot, support-record and sub-processor disclosures; `counsel-notes.md` gained the new
  variables and the new publication preconditions. **These are drafts, not published pages, and
  the wording is the owner's to approve.**

## Session-opening checks

| Check | Result |
|---|---|
| `git status --short` | clean except untracked `.claude/` |
| Branch | `fix/phase-1c-conversion-path`, fully contained in `main` (`main` is the merge commit on top of it) |
| `cd next-app && npm test` | **19 passed, 0 failed** (4.3 s) |
| `cd app && npm test` | **20 passed in 8 files** (23.5 s) — see note below |

The booking-app suite failed on its first invocation with eight `[vitest-pool]: Failed to start
forks worker … Timeout waiting for worker to respond` errors after 60 s. No test failed; the
worker pool never started. It passed clean on an immediate retry. This is a Windows/vitest
flake rather than a defect in the suite, but it is the same command CI runs
(`.github/workflows/ci.yml:59`), so a one-off red build with that signature should be re-run
before it is investigated.

## Decisions taken — 2026-09-10

The owner answered the open questions the same day this survey was written. **These decisions
supersede the recommendations they overrule**, and the sections below have been rewritten to
match rather than left as options.

| # | Decision |
|---|---|
| 1 | **Payments: complete switch to PayU.** Razorpay is retired, not kept as a fallback, so the account-hold question is moot. History stays read-only. The three Razorpay functions are removed and the webhook unregistered **only after PayU is live and verified, in that order.** |
| 2 | **Legal 2.0: not publishing yet** — the §B values are still pending. The drafts are being updated now so they ship once. Done in this session: PayU replaces Razorpay throughout, plus the chatbot, interaction-record and sub-processor disclosures. |
| 3 | **Escalation: Chatwoot Cloud** to start; revisit self-hosting when volume justifies it. |
| 4 | **Who answers:** one customer-support person. **Superseded by decision 11: 10 AM–7 PM, Mon–Sat.** Out of hours the bot takes a message and promises a callback **within 24 hours**. |
| 5 | **Model: free models via OpenRouter's OpenAI-compatible API**, behind one adapter and one environment variable, with no-training providers only, a fallback list, and grounding that does not depend on the model's tool-calling. |
| 6 | **Android first, iOS after.** Bundle id / applicationId: `in.mybuddymaid.app`. |
| 7 | **Keep Google sign-in on iOS; add Sign in with Apple.** |
| 8 | **WhatsApp goes secondary only when, over 4 weeks:** ≥60% of chats resolve without a human, escalations get a human reply within 5 minutes **within published hours** (decision 11), and chat leads per week match or beat the WhatsApp-click leads of the preceding 4 weeks. |
| 9 | **FIN-C01 is covered by the 2.0 terms** (a single refund term); no separate fix. |
| 10 | **New requirement:** one record of every support interaction, on every channel. Designed in [Initiative 4](#initiative-4). |

### Second round — after the first revision

| # | Decision |
|---|---|
| 11 | **Published support hours become 10 AM–7 PM, Mon–Sat** — the hours one person can actually cover. The 24-hour reply promise carries the rest. **Decision 8's five-minute condition now reads "within published hours."** |
| 12 | The 4-week clock starts **only once WhatsApp is in Chatwoot**, so both channels are counted the same way. |
| 13 | Razorpay: merchant account stays open for the ledger. **A test-mode end-to-end run and a written go-live checklist are mandatory before `PURCHASES_PAUSED` flips.** |
| 14 | RLS: no team role. Team access is service-role behind an authenticated route. |
| 15 | System of record: Supabase, Chatwoot in by webhook, nightly reconciliation. |
| 16 | Models: the Gemma chain with the account-level opt-out; buy the $10 credit; **exclude Nex AGI**. The 20/min queue and rung 3 are **required, not optional**, and **a test must assert that rung 3 fires when the model fails.** |
| 17 | **Correction to the privacy claim.** The model receives no *account* data — but it receives whatever the person types, and people type phone numbers. Phone numbers, email addresses and card-like numbers are **redacted server-side before any model call**; the widget notice asks people not to type details the assistant does not need; the policy says exactly that and no more. |
| 18 | `[CHATWOOT CLOUD REGION]` = **United States** (Chatwoot's hosted service offers no region choice). `[ASSISTANT PROVIDERS PAGE]` is **dropped** — the provider list lives inside the privacy policy, so there is one document to keep current, not two. |

### Third round — legal values and clause decisions

| # | Decision |
|---|---|
| 19 | Entity **MyBuddyMaid Pvt Limited**, a private limited company; effective date **15 September 2026**; CIN and GSTIN to follow. Emails: privacy and grievance → governance@, legal notices → legal@, refunds → info@. |
| 20 | Supabase region **Sydney, Australia** (`ap-southeast-2`) — see the residency note in Initiative 3 §4. |
| 21 | **Every High-risk clause in `counsel-notes.md` §2 is now closed by owner decision:** liquidated damages **₹21,000** (≈3× the Diamond fee) with a regularisation route; Restricted Period **24 → 12 months**; refunds **initiated within 14 Business Days** rather than credited in 45; credit-bureau clause already removed. The employer clause was also softened after review. |
| 22 | **Verified profiles become 3 / 4 / 5** — Silver 1 → 3, Gold 3 → 4, Diamond unchanged. This is a **data-layer change, not a docs change** — see the warning below. |

> **Decision 22 is the only one that reached code, and it is done.** `next-app/data/seo/plans.ts`
> now reads 3 / 4 / 5, `app/src/lib/serviceability.json` was regenerated with
> `npm run seo:export-spa`, and the booking-app bundle at `next-app/public/_spa` was rebuilt
> with `npm run build:spa` and committed. The rebuild was run twice and produced an identical
> hash, so the CI committed-bundle check passes. All checks green: `tsc` clean, next-app 19/19,
> app 20/20, lint 0 errors, `seo:validate` GREEN, `seo:gate` 2,489 indexable and 0 duplicate
> pairs.
>
> **Both halves of the change earn their place.** Silver 1 → 3 fixes an existing incoherence —
> ToS 7.2(a) and `REFUND_PROFILE_THRESHOLD` both entitle a Client to a refund if fewer than
> **three** profiles are introduced, while Silver promised **one**, so a Silver customer could
> claim a refund for not receiving something Silver never offered. Gold 3 → 4 then restores the
> upgrade reason that Silver's rise would otherwise have flattened, giving a clean 3 / 4 / 5
> against ₹4,999 / ₹5,999 / ₹6,999.
>
> **Note what nothing checks.** CI fails the build if the committed SPA bundle is stale, but no
> test compares Annexure A against `plans.ts`. The audit's FIN-C01 recommendation — render the
> terms' figures from `plans.ts` — would close that gap, and this is the second time in one
> session that the two have had to be reconciled by hand.

Two consequences worth stating up front, because they change the plan rather than just its wording:

- **Legal is no longer the blocker it was.** The previous version of this document said "start
  the legal publication today" because all three initiatives waited on it. With publication
  deferred pending the §B values, the drafts are being made ready instead. The store submission
  still cannot happen without published documents, so this moves the constraint onto Initiative
  1's tail rather than removing it.
- **Retiring Razorpay removes the rollback I had assumed.** With no dual-gateway period, the
  test-mode verification in phase P4 stops being a formality and becomes the only thing standing
  between a bug and a customer who has paid. That is reflected in the risk table.

## Effort scale

The audit's S/M/L/XL, used here with the same meaning as `AUDIT/18-REMEDIATION-PLAN.md`:

| | Meaning |
|---|---|
| **S** | up to about half a day |
| **M** | about one day |
| **L** | two to four days |
| **XL** | a week or more, or open-ended because it depends on somebody outside engineering |

## What this survey could not verify

Stated up front, because several recommendations rest on facts that a read-only session cannot
establish:

1. **PayU merchant capability.** Which PayU product the account would be on (PayU Hosted
   Checkout / PayU Biz / PayU Money), which payment methods are enabled, and whether webhooks
   are available on that plan. All of Initiative 2 assumes standard Hosted Checkout plus the
   `verify_payment` API plus webhooks. If any of those is not on the account, the design changes.
2. **PayU webhook authentication, precisely.** PayU's public docs say the payment
   success/failure webhook is a form-encoded POST carrying the same fields as the browser
   response *including* a `hash` field, and that merchants must verify it. I could not confirm
   from the docs whether an additional transport-level signature header is offered for payment
   webhooks (one exists for the separate "real-time merchant status" webhook, an HMAC-SHA256 in
   the `Authorization` header). **The design below therefore treats the reverse-hash as the only
   authentication and never trusts the webhook body on its own — every webhook is confirmed with
   a server-to-server `verify_payment` call before anything activates.** That is stricter than
   the Razorpay design and is deliberate.
3. **`razorpay-webhook` has never received a real event**
   (`AUDIT/20-IMPLEMENTATION-PROMPT.md`, "What Phase 0 left open"). The current webhook path is
   verified only by the 22 offline tests in
   `supabase/functions/__tests__/razorpay-webhook.test.ts`. Any statement that "the Razorpay
   design is proven in production" would be false, and none is made here.
4. **Live production state.** Which functions are deployed today, what is in Supabase secrets,
   the Razorpay account status, and what is set in Vercel. I did not probe production. The
   audit's 2026-09-08 live verification is the most recent evidence and is two days old.
5. **Store account state.** Whether an Apple Developer Program membership or a Play Console
   account exists. I assumed neither.
6. **Chatwoot Cloud pricing** was read from chatwoot.com/pricing on 2026-09-10 and is annual
   billing in USD; Indian GST is not modelled. Crisp and Intercom figures are order-of-magnitude
   list prices.
7. **The OpenRouter free-model analysis is a live snapshot, not a guarantee.** It was built from
   OpenRouter's own APIs on 2026-09-10 — `/api/v1/models`, each model's `:free` endpoints, and
   `/api/frontend/v1/all-providers` for the `dataPolicy` flags. Two limits: `/api/frontend/*` is
   an internal endpoint the docs page consumes, not a documented public API, so its shape can
   change without notice; and I could not run the decisive end-to-end test — an actual request
   with the training opt-out set — because that needs an API key. **Verify by sending one real
   request per configured model before launch, and keep the scheduled re-check.**
8. **PayU's refund settlement window.** The counsel notes previously quoted Razorpay's five-to-
   seven working days. I generalised it rather than substitute an unverified PayU figure; it
   needs confirming against the merchant agreement.
9. **The DPDP statutory citations are researched, not advised.** Section 7's sub-clauses were
   read from the bare Act (Section 7(a)–(i), and specifically that **7(c) is confined to the
   State and its instrumentalities**) before the §3.1 table was rewritten. That is engineering
   diligence, not legal advice: a lawyer should still confirm the mapping, and the commercial
   judgments in `counsel-notes.md` §2 were never in scope. What I can say is that the previous
   citation of 7(c) by a private company was wrong, and that it is no longer in the document.
10. **Whether GDPR or CCPA reach this business at all** is unresolved and is a counsel question.
    §1.1 is now conditional so the policy is not wrong either way, but if neither applies, §14
    of the policy is dead weight and can be removed.

---

# Initiative 1 — native Android and iOS apps

## Current state

The booking app is a Vite + React 19 SPA under `app/`, built with `base=/_spa/` by
`scripts/build-spa.mjs:17`, copied to `next-app/public/_spa`, and rewritten onto `/app/*` by
the Next.js site. It is a **committed build artifact** — CI rebuilds it and fails if the
committed copy differs (`.github/workflows/ci.yml:65-78`).

The required flow already exists in the SPA, screen for screen:

| Required | Where it is today |
|---|---|
| Splash | `app/src/pages/SplashScreen.jsx` (800 ms minimum, gated on auth resolving — FIN-B08 fixed) |
| Sign in / sign up, email + password and Google | `app/src/pages/AuthPage.jsx`, `app/src/context/AuthContext.jsx:106-128` |
| Stay signed in until sign-out | `app/src/lib/supabase.js:12-17` — `persistSession: true`, `autoRefreshToken: true` |
| Home, services, booking form, bookings, pricing, profile | `app/src/App.jsx:33-54` |
| Account deletion | `app/src/pages/ProfilePage.jsx:50-67` → `supabase.functions.invoke('delete-account')` |

So the product surface is not the problem. The problem is a short, specific list of browser
assumptions.

### Everything in `app/src` that assumes a browser

| # | Assumption | Location | Cost to remove |
|---|---|---|---|
| 1 | `<BrowserRouter basename="/app">` | `app/src/main.jsx:13` | **S.** Swap for `HashRouter` (no basename) or `MemoryRouter` under a build flag. Everything below this line is relative-routed, so nothing else changes. |
| 2 | Asset base `/_spa/` | `scripts/build-spa.mjs:17`, `app/vite.config.js:9` | **S.** A native build sets `SPA_BASE=./`. The variable already exists. |
| 3 | `window.Razorpay` from a `<script>` in the page head | `app/index.html:13`, `app/src/pages/PricingPage.jsx:62,153` | **M**, and it disappears entirely if Initiative 2 lands first — see "Do payments before mobile" below. |
| 4 | `sessionStorage` for the redirect context | `app/src/pages/AuthPage.jsx:55-56,94-95`, `app/src/pages/SplashScreen.jsx:28-29` | **S.** Works in a WebView; does *not* survive an OAuth round-trip through an external browser, which is exactly the native sign-in flow. Must move to a real store. |
| 5 | OAuth redirect to `window.location.origin + '/app/splash'` | `app/src/context/AuthContext.jsx:109,118` | **M.** Must become a custom scheme / app link on native. |
| 6 | `detectSessionInUrl: true` | `app/src/lib/supabase.js:16` | **S**, but it interacts with 5 — on native the session arrives via a deep link the app hands to Supabase explicitly. |
| 7 | Session stored in `localStorage` (supabase-js default) | `app/src/lib/supabase.js:12-17` (no `storage` override) | **M.** Refresh tokens in WebView `localStorage` is the main security gap of the Capacitor route. See §2. |
| 8 | `injectSpeedInsights()` | `app/src/main.jsx:9` | **S.** Vercel Speed Insights is a web beacon; drop it from the native build. |
| 9 | Umami analytics `<script>` | `app/index.html:7` | **S.** Same. |
| 10 | `window.scrollTo` | `app/src/pages/PricingPage.jsx:393` | **S.** Works in a WebView; harmless. |
| 11 | **`ALLOWED_ORIGIN = 'https://mybuddymaid.in'` in every edge function** | `create-razorpay-order/index.ts:7`, `verify-razorpay-payment/handler.ts:33`, `razorpay-webhook/handler.ts:41`, `delete-account/index.ts:7`, `send-package-email/handler.ts:30`, `send-booking-email/handler.ts:34` | **M, and the single biggest native blocker.** See below. |

**#11 deserves its own paragraph.** A Capacitor WebView's origin is `capacitor://localhost` on
iOS and `http://localhost` on Android (both configurable; `iosScheme` may be `https` or a
custom scheme, never `http`). WebViews enforce CORS on `fetch`, and `supabase-js`'s
`functions.invoke` is `fetch`. Every one of the six functions replies with a single hard-coded
`Access-Control-Allow-Origin`, so **from a Capacitor app, account deletion, payment
verification and both confirmation emails would fail the preflight and never leave the
device** — the same failure the audit already documents for `localhost:5173`
(`AUDIT/20-IMPLEMENTATION-PROMPT.md`, "Edge functions cannot be called from localhost").
Ordinary PostgREST reads and writes are unaffected, so home, services, bookings and profile
would appear to work while exactly the money and erasure paths silently broke. Fixing it means
an allow-list (echo the request's `Origin` when it is in a known set, else refuse) in a shared
`_shared/cors.ts`, applied to all six functions in one change. React Native does not enforce
CORS at all, which removes this item on that route — one of its few genuine advantages.

## 1. Three routes compared

### A. Capacitor wrapper around the existing React app — **recommended**

Reuses `app/src` essentially whole. The eleven items above are the entire delta, and eight of
them are S.

- **Reuse:** near-total. One codebase serves `/app/*` on the web and both stores.
- **Native gaps to fill:** secure token storage (§2), native Google sign-in and Sign in with
  Apple (§3), deep links (§4), and the CORS change (#11).
- **Cost:** the wrapper and first store-ready builds are **L**. Native auth is **L** on its own.
- **Main risk:** the session lives in a WebView. Without a secure-storage adapter the refresh
  token sits in WebView `localStorage`, which is not Keychain/Keystore and is a genuine finding
  on a device that is rooted, jailbroken, or backed up unencrypted. This is fixable (§2) and
  must be treated as mandatory, not a follow-up.
- **Second risk:** the committed-bundle CI check and the mobile build consume the same `app/`
  source with different `SPA_BASE` and different routers. Getting that wrong ships a web bundle
  that fails the CI diff, or a mobile bundle with web-only routing. §6 handles it.

### B. Rebuild in React Native / Expo, sharing only the data layer

- **Reuse:** `app/src/lib/serviceability.js`, `serviceability.json` and `constants.js` port
  unchanged. `AuthContext.jsx` ports with edits. Every screen and all of `App.css` /
  `index.css` is rewritten.
- **Cost: XL**, and it forks the product: two booking forms, two pricing screens, two places to
  change a price label. The audit's headline structural criticism of this repo is already "two
  front-ends, two design systems, two auth models, one product"
  (`AUDIT/01-ARCHITECTURE.md` §8.1). This route makes it three.
- **Genuine advantages:** no CORS problem; `expo-secure-store` is the idiomatic Keychain/
  Keystore adapter; native navigation and gestures; Google and Apple sign-in are well-trodden.
- **When it would be right:** if the mobile app were going to diverge from the web app —
  push-heavy, offline-first, camera or location work. Nothing in the required flow does.

### C. PWA first

- **Cost: S.** A manifest, icons the repo already has (`app/index.html:10-11`), and a service
  worker. `app/index.html:9` is `noindex, nofollow`, which does not block installability.
- **What it buys:** an installable icon and standalone display, on Android in particular.
- **What it does not buy, and this is decisive:** no Play Store or App Store listing, no store
  search, no native Google sign-in, no Sign in with Apple, and on iOS a home-screen web app has
  a history of storage eviction that makes "stays signed in until they sign out" a promise the
  platform can break. It does not satisfy the stated requirement.

### Recommendation

**Capacitor (A).** The required flow is the SPA's existing flow; the delta is eleven concrete
items, most of them small, and it keeps one codebase for a business with one product team.
Ship a PWA manifest alongside it (**S**) because it costs almost nothing and gives an
installable Android experience while store review runs. Revisit React Native only if the
mobile app acquires requirements the web app does not have.

## 2. Session persistence on a device

**Where the refresh token must live.** `app/src/lib/supabase.js:12-17` passes no `storage`, so
supabase-js uses `localStorage`. In a WebView that is app-private but is not Keychain or
Keystore. The fix is a custom storage adapter — supabase-js accepts `auth.storage` with
`getItem` / `setItem` / `removeItem`:

- **Do not use `@capacitor/preferences`.** It maps to `UserDefaults` (iOS) and
  `SharedPreferences` (Android) — plaintext, and included in device backups. It is the example
  most commonly found online and it is the wrong one for a refresh token.
- **Use a Keychain/Keystore-backed plugin** (`@aparajita/capacitor-secure-storage` or
  equivalent) — `EncryptedSharedPreferences`/Keystore on Android, Keychain on iOS. Adapter
  methods are async, which supabase-js supports.

**Auto-refresh on native.** supabase-js's `autoRefreshToken` is a timer, and the library has no
concept of an app being backgrounded. On a suspended app the timer does not fire on schedule.
Supabase's documented answer for non-browser platforms is `auth.startAutoRefresh()` /
`auth.stopAutoRefresh()`, driven from app-state changes — `AppState` on React Native, the
`@capacitor/app` `appStateChange` listener on Capacitor. This is not optional on native; without
it the session goes stale in the background and the first action after resume fails.

**Token expiry while offline — a real and currently unresolved hazard.** There is a reported
supabase-js behaviour where an app started with no connectivity loses its persisted session:
`getSession()` returns `null` even with `persistSession: true`, apparently because the
auto-refresh attempt fails and clears the session rather than preserving it. It is reported
against supabase-js 2.50.2 and, at the time of writing, has no official fix (supabase
discussion #36906). **This must be reproduced against whatever version we ship before the app
goes to a store**, because the symptom is "opened the app on the metro and it logged me out",
which is precisely the promise being made. Mitigations if it reproduces: gate
`startAutoRefresh` on connectivity, and treat a refresh failure as "offline, keep the session"
rather than "signed out" — never sign the user out on a network error.

**Sign out.** `AuthContext.signOut` (`app/src/context/AuthContext.jsx:130-137`) calls
`supabase.auth.signOut()` and clears local state. On native it must additionally clear the
secure-storage entry, and — if native Google sign-in is used — sign out of the Google client so
the next sign-in shows the account chooser rather than silently reusing the last account.

**"Clear app data".** Android's *Settings → Apps → Storage → Clear data* wipes both
`SharedPreferences` and the Keystore-backed store, so the session is gone and the user lands on
the auth screen: correct behaviour, no code needed. iOS has no equivalent per-app control;
deleting the app is the equivalent, and iOS Keychain items can outlive an app deletion if
written with the wrong accessibility class. Use
`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (no iCloud Keychain sync, does not migrate
to a new device) so an uninstall/reinstall does not resurrect somebody's session.

## 3. Native sign-in

**Google.** The web flow (`AuthContext.jsx:106-112`) is `signInWithOAuth` with
`redirectTo: window.location.origin + '/app/splash'`. On native, a redirect to a
`https://mybuddymaid.in` URL leaves the app. Two workable shapes:

1. **Native Google Sign-In SDK → `supabase.auth.signInWithIdToken({ provider: 'google', token,
   nonce })`.** Best UX: the OS account picker, no browser. Needs a Google OAuth client per
   platform (Android client keyed to the package name + SHA-1 of the signing cert; iOS client
   keyed to the bundle id) plus the existing Web client id registered in Supabase.
2. **`signInWithOAuth` with `skipBrowserRedirect`, opened in an ASWebAuthenticationSession /
   Custom Tab, returning to a custom scheme or an App Link / Universal Link**, with the app
   handing the returned code to `exchangeCodeForSession`. Fewer console prerequisites, worse UX.

Either way `detectSessionInUrl` (`app/src/lib/supabase.js:16`) must be `false` on native, the
deep link must be handled explicitly, and the redirect URL must be added to Supabase's
allow-list.

**Sign in with Apple — required.** Guideline 4.8 says an app that uses a third-party or social
login service to set up or authenticate the user's primary account "must also offer as an
equivalent option another login service" that limits collection to name and email, lets the
user keep the email private, and does not collect in-app interactions for advertising without
consent. The exemption is for an app that "exclusively uses your company's own account setup
and sign-in systems" — MyBuddyMaid offers Google alongside email+password, so **the exemption
does not apply and an equivalent option is required.** Strictly, any provider meeting the three
criteria satisfies it; in practice that is Sign in with Apple. Supabase supports it as a
provider, so this is configuration plus a button plus the Apple-side setup, not new
architecture.

*(Worth putting to the owner: dropping Google sign-in from the iOS build would restore the
exemption. It is a real option and it is cheaper, but it costs conversion and diverges the two
platforms' auth. Not recommended.)*

**Account, certificate and console prerequisites — owner-only, and the long pole.**

| | Android | iOS |
|---|---|---|
| Account | Google Play Console developer account, one-time fee, identity verification | Apple Developer Program membership, annual, D-U-N-S number for an organisation account |
| Identifier | `applicationId`, e.g. `in.mybuddymaid.app` — permanent, cannot be changed after first publish | Bundle id, same permanence |
| Signing | Play App Signing upload key; the **SHA-1 of the release cert** must be registered against the Google OAuth Android client, and again for the Play-managed signing cert | Certificates, an App ID with the Sign in with Apple and Associated Domains capabilities, provisioning profiles |
| Sign-in config | Google OAuth Android client (package + SHA-1); Web client id in Supabase | Google OAuth iOS client; Apple Services ID, key and team id in Supabase |
| Deep links | `assetlinks.json` at `https://mybuddymaid.in/.well-known/assetlinks.json` | `apple-app-site-association` at `https://mybuddymaid.in/.well-known/apple-app-site-association` |
| Review | Data safety form, target-SDK requirements | App Review, privacy nutrition labels, and — because helpers enter homes — expect questions about safety and verification claims |

Both `.well-known` files are served by the Next.js site, so the mobile initiative touches
`next-app/` before the app exists. They go in `next-app/public/`; there is no collision with
`RESERVED_SLUGS` (`next-app/data/seo/index.ts:94-123`) because `.well-known` is not a city slug.

## 4. Deep links, and how they meet 1c batch 2

**The gap that exists today.** `components/seo/CtaButtons.tsx:29` builds
`/app/auth?city=…&locality=…&service=…` on every page of the site. The SPA never reads those
query parameters: `AuthPage.jsx:55` and `SplashScreen.jsx:28` read
`sessionStorage.getItem('mbm_redirect_context')`, and **nothing anywhere writes that key.**
`SplashScreen.jsx:31-38` can only route on a bare service id or plan name — it has no notion of
city or locality at all. That is FIN-B02, and closing it is Phase 1c batch 2 (task 1.3 in
`AUDIT/18-REMEDIATION-PLAN.md:119`), which is explicitly not this session's work.

**Why the mobile initiative should wait for it.** The native deep link and the web CTA want to
carry an identical payload — city, locality, service, and now plan:

```
https://mybuddymaid.in/app/auth?city=gurgaon&locality=dlf-phase-3&service=full-time-maid&plan=gold
mybuddymaid://app/auth?city=…&locality=…&service=…&plan=…
```

Built correctly, batch 2 introduces one entry-point parser that reads the query string,
validates every value against `app/src/lib/serviceability.js` (`cityBySlug`, `localityBySlug`,
`SPA_SERVICE_MAP`), persists it, and hands it to `SplashScreen` — and the native app then needs
**only** a link handler feeding the same parser, plus a store that survives the OAuth
round-trip. Built the other way round, we write the parser twice and one of them drifts.

Two design notes for whoever does batch 2, so it does not have to be redone for mobile:

- **Do not use `sessionStorage`** (the current, non-functional design). It does not survive an
  OAuth redirect through an external browser, which is the native sign-in path. `localStorage`
  with a short TTL, or the secure store, survives both.
- **Validate against the data layer, never trust the link.** An App Link is an
  attacker-controllable input; `isServiceable()` and the slug maps exist for exactly this, and
  the lead route already does it (`next-app/app/api/lead/route.ts:42-47`).

Universal Links and App Links additionally give the app the marketing site's URLs for free: a
customer tapping a locality-page link from WhatsApp opens the app if it is installed, with the
locality already known.

## 5. Store requirements

| Requirement | Status |
|---|---|
| In-app account deletion | **Already exists** — `ProfilePage.jsx:50-67` → `delete-account`, which authenticates the caller and deletes only their own data. Both stores require this and it is done. Two caveats: it is non-transactional and can leave orphans (FIN-S09, `AUDIT/04-SECURITY.md`), and it will fail from a Capacitor origin until the CORS change lands. |
| Published terms and privacy policy | **Blocked.** The live pages exist but the 2.0 documents are drafts (`docs/legal/drafts/`) and unpublished. Both stores require reachable public URLs, and the privacy policy must actually describe what the app does. |
| Privacy labels / Data safety form | Derivable from the 2.0 privacy draft's §2 table (`docs/legal/drafts/privacy-policy.md:32-56`): identity and contact data, locality, requirements, payment references, technical data, communications. Analytics disclosure must match reality — GA4 and Umami load on the site (`components/shared/Analytics.tsx:41-49`); the native build should ship neither, which makes the form simpler and should be a deliberate decision, not an accident. |
| External payments for a home-help placement | **Permitted on both stores, and not a close call.** Apple 3.1.3(e): "If your app enables people to purchase physical goods or services that will be consumed outside of the app, you must use purchase methods other than in-app purchase to collect those payments." Google Play's Payments policy is explicit that Play Billing is not required for physical services and names **cleaning services** in its examples. A domestic-helper placement is consumed in the customer's home. Razorpay or PayU is the correct mechanism; IAP would in fact be the violation. |
| Support hours and contact | The paused-checkout modal publishes hours and a phone number (`app/src/pages/PricingPage.jsx:207`) — currently the old Mon–Sun 9 AM–9 PM, to be changed to 10 AM–7 PM Mon–Sat. Store listings need a support URL and email. |

**The dependency to state plainly: the app cannot be submitted until the 2.0 legal documents are
published.** That is Initiative 3's dependency too, and it is owner-and-counsel work, not
engineering (`docs/legal/PUBLISH-PROMPT.md`). It is the longest lead time in this survey.

## 6. Build and release

**Where the mobile project lives.** Put the Capacitor configuration **inside `app/`**, not in a
new `mobile/` sub-project. Capacitor consumes `app/dist`; a separate sub-project would need
either a copy of the SPA or a build-time dependency across directories, and the repo has no
monorepo tool (`AUDIT/01-ARCHITECTURE.md` §1). Concretely: `app/capacitor.config.ts`,
`app/android/`, `app/ios/`, and a `build:native` script running Vite with the native flags.
This keeps the sub-project count at three.

**The committed-bundle check must not be disturbed.** `.github/workflows/ci.yml:65-78` rebuilds
`app/` with `scripts/build-spa.mjs` and fails if `next-app/public/_spa` would change. The
native build must therefore:

- use **different** Vite settings (`SPA_BASE=./`, hash routing, no Speed Insights, no Umami)
  and write to a **different** output directory than `app/dist` — otherwise the two builds race
  and the CI diff goes red for reasons unrelated to anyone's change;
- add `app/android/`, `app/ios/` and the native output directory to `.gitignore`, but **not**
  `app/capacitor.config.ts`;
- keep `scripts/build-spa.mjs` untouched, because it is what CI runs.

The cleanest shape is a single `NATIVE=1` env flag read by `vite.config.js`, in the same style
as the existing `SPA_BASE` (`app/vite.config.js:9`), with the router and the analytics imports
behind `import.meta.env`.

**CI.** Add a fourth job that runs the web-side checks against the native config (lint, tests,
`vite build` with `NATIVE=1` to prove it compiles). **Do not put signed store builds in the
public CI workflow** — that means uploading a keystore and an Apple certificate as repository
secrets, and the repo currently has no secrets beyond public `VITE_*` variables
(`.github/workflows/ci.yml:44-47`). Release builds should be manual and local until there is a
reason otherwise, with `workflow_dispatch` as the later upgrade path.

**Over-the-air updates.** Capacitor supports OTA web-asset updates (Appflow, Capgo,
self-hosted), and both stores permit it for JavaScript that does not change the app's purpose.
**Recommendation: not in phase 1.** It adds an update server, a signing story and a rollback
story to an initiative that already has enough of those, and the release cadence here does not
need it. Revisit once there is a reason to ship weekly.

## Phased plan — Initiative 1

| Phase | Work | Effort | Depends on |
|---|---|---|---|
| M0 | Owner: Play Console + Apple Developer Program enrolment; choose bundle id / applicationId | **XL** (calendar, not engineering) | owner |
| M0 | Publish the 2.0 terms and privacy policy | **L** + counsel | owner |
| M1 | `_shared/cors.ts` allow-list; apply to all six functions; extend the offline test suite | **M** | — |
| M1 | Phase 1c batch 2 done link-first (one entry-point parser, `localStorage` not `sessionStorage`) | **L** | already planned as task 1.3 |
| M2 | Capacitor scaffold in `app/`; `NATIVE=1` build; hash router; drop web-only beacons; PWA manifest | **L** | M1 |
| M2 | Secure-storage adapter for supabase-js; `startAutoRefresh`/`stopAutoRefresh` on app-state; **reproduce and resolve the offline-session issue** | **L** | M2 scaffold |
| M3 | Native Google sign-in + Sign in with Apple; deep-link handler feeding the batch-2 parser | **L** | M0, M2 |
| M3 | `assetlinks.json` + `apple-app-site-association` on the site | **S** | M0 |
| M4 | Store listings, data-safety and privacy labels, screenshots, first submission | **L** | everything above |

## Owner decisions — Initiative 1

1. Enrol in both developer programmes, or Android first?
2. Bundle id / applicationId — permanent after first publish.
3. Keep Google sign-in on iOS (requires Sign in with Apple) or drop it there (cheaper, diverges)?
4. Analytics inside the native app: none, Umami only, or GA4 too? This drives the privacy labels.
5. Company legal name and address for both store listings, and a support email.

## Risks — Initiative 1

| Risk | Severity | Mitigation |
|---|---|---|
| Refresh token in WebView `localStorage` | **High** | Secure-storage adapter is mandatory in M2, not a follow-up |
| Offline start loses the session | **High** | Reproduce before submission; never sign out on a network error |
| CORS pin silently breaks payments, emails and deletion in the native build | **High** | M1 lands before any device testing; add a native-origin case to the function tests |
| Native build and web build fight over `app/dist` and turn CI red | Medium | Separate output directory; leave `build-spa.mjs` alone |
| Store rejection on legal pages | Medium | M0 blocks submission by design |
| Signing cert / OAuth SHA-1 mismatch (silent "sign-in failed") | Medium | Register both the upload and the Play-managed signing certs |

## What must not break — Initiative 1

- **RLS stays the only authorisation layer.** A native client is still an anon-key client
  talking to PostgREST from an untrusted device. Nothing about mobile justifies a new permissive
  policy (`AUDIT/01-ARCHITECTURE.md` §7).
- **The committed-bundle CI check** (`.github/workflows/ci.yml:65-78`) must keep passing
  byte-for-byte.
- **The paused-checkout switch.** `PURCHASES_PAUSED` is read from `serviceability.json`
  (`app/src/lib/serviceability.js:17`), so the native build inherits it automatically. It must
  stay that way — no native-only checkout path.
- **`send-plan-email` is never deployed** (FIN-S12). A CORS change applied by name to six
  functions must not sweep it up.

---

# Initiative 2 — Razorpay → PayU

## Current state: what Phase 0 built, and what must survive

These are not aspirations; each is in the code today and each has tests. **The PayU design is
judged by whether it reproduces every one of them.**

| # | Guarantee | Where | Test |
|---|---|---|---|
| G1 | The client never sets a price. It sends `plan_name`; the amount comes from a server-held table | `create-razorpay-order/index.ts:23-27,59,103` | — |
| G2 | The caller is authenticated with `auth.getUser(token)`, not the anon key | `_shared/auth.ts:41-57`; used at `verify-razorpay-payment/handler.ts:151` | "rejects the public anon key" |
| G3 | The plan is read **from the order**, never from the request body | `verify-razorpay-payment/handler.ts:158-159,263-268` | "a body claiming a different plan gets the order's plan, not the body's (FIN-P01)" |
| G4 | The order is bound to the caller: `notes.user_id !== user.id` → 403 | `handler.ts:256-261` | "rejects an order that belongs to another account" |
| G5 | **Fails closed.** A gateway we cannot reach is a payment we cannot verify → 503, no activation | `handler.ts:246-252,281-287`; `razorpayGet` returns `null` on any doubt, `handler.ts:107-137` | two "FAILS CLOSED" tests |
| G6 | Idempotency: redemption is checked **first, before any write**, and a partial unique index makes a second insert impossible | `handler.ts:180-220`; `migrations/20260908051500_payment_integrity_indexes.sql:42-44` | "replaying the same payment creates exactly one plan" |
| G7 | One active plan per user, enforced in the database | same migration, lines 47-49 | — |
| G8 | The webhook verifies HMAC over the **raw bytes**, before parsing | `razorpay-webhook/handler.ts:80-93` and the main handler's `req.arrayBuffer()` → verify → `JSON.parse` | 22 webhook tests |
| G9 | The webhook binds a payment from the **order's** notes, never `payment.notes` (which is browser-settable) | `razorpay-webhook/handler.ts` `resolvePlanBinding` | — |
| G10 | Constant-time signature comparison | `verify-razorpay-payment/handler.ts:91-99`, `razorpay-webhook/handler.ts:95-103` | — |
| G11 | Refunds revoke; partial refunds do **not** revoke and are flagged for a human | `razorpay-webhook/handler.ts` `handleRefundProcessed` | — |
| G12 | Timeouts and one retry, with 4xx treated as a final answer and 429/5xx retried | `verify-razorpay-payment/handler.ts:107-137` (8 s), `razorpay-webhook/handler.ts:70` (3 s) | — |
| G13 | The `.or()` exclusion in the deactivate step, so the two activation paths cannot switch each other off | `verify.../handler.ts:332-337`, `razorpay-webhook/handler.ts` step 2 | "a webhook activation landing mid-verification is not deactivated" |
| G14 | Client INSERT to `user_plans` is blocked by RLS; the functions are the only path | security migration | RLS suite |
| G15 | `PURCHASES_PAUSED` is one owner switch, in `plans.ts`, exported to every consumer | `next-app/data/seo/plans.ts:69`; `app/src/lib/serviceability.js:17`; `PricingPage.jsx:54` | site + app tests |

Known open items carried into any migration: **FIN-P05** — `PLAN_DETAILS` is hand-copied into
*three* Deno files (`create-razorpay-order/index.ts:23-27`,
`verify-razorpay-payment/handler.ts:49-53`, `razorpay-webhook/handler.ts:63-67`) plus
`plans.ts:21-53` plus `serviceability.json`. **FIN-B13** — `functions-js` throws on non-2xx, so
the SPA cannot display any function error message; every failure shows the generic fallback.

## 1. A PayU design that keeps all fifteen guarantees

### Shape

Hosted Checkout: the browser POSTs a form to PayU's `_payment` endpoint with a
**server-generated** request hash. Card data never touches our servers or the SPA. PayU
redirects the browser to `surl`/`furl` with a response payload, and separately POSTs a webhook.
**Neither of those is trusted.** Both are only triggers for a server-to-server
`verify_payment` call, which is the sole source of truth about whether money moved.

```
PricingPage.handleBuyPlan(planKey)
  └─ invoke('create-payu-order', { plan_name, phone })
       ├─ authenticateCaller(req)                                        G2
       ├─ plan = PLAN_DETAILS[plan_name]  →  amount from the server       G1
       ├─ reject if the user already has an active plan (honest 409)      G7
       ├─ txnid = crypto.randomUUID()
       ├─ INSERT payment_intents { txnid, user_id, plan_name, amount_paise, status:'created' }   ← the binding
       ├─ hash = SHA512(key|txnid|amount|productinfo|firstname|email|udf1||||||||||SALT)
       └─ return { action_url, key, txnid, amount, productinfo, firstname, email, phone,
                   surl, furl, hash }        ← never the salt                      G1
  └─ browser auto-submits the form to PayU (hosted page; no card data on our side)
  └─ PayU redirects to surl/furl  ──┐
  └─ PayU POSTs the webhook       ──┤
                                    ├─→ BOTH call the SAME verify path:
                                    │     verify-payu-payment (browser-triggered, authenticated)
                                    │     payu-webhook        (server-triggered, reverse-hash + verify_payment)
                                    └─→  activatePlan(...)  — idempotent on mihpayid AND txnid   G6
```

### Guarantee by guarantee

**G1 — amount from the server.** Identical to today. The SPA sends `plan_name` only; the
function resolves `pricePaise` and puts it in the hash. **The hash is what makes this
enforceable**: PayU rejects any request whose posted `amount` disagrees with the hash, and the
salt never leaves Supabase secrets, so the browser cannot re-hash a tampered amount.

**G2 — authenticated caller.** `create-payu-order` and `verify-payu-payment` both use
`_shared/auth.ts`. This is where PayU is *worse* than Razorpay unless we compensate: Razorpay's
`notes` are server-written order metadata that a payment cannot forge. PayU's equivalent
carriers are `udf1`–`udf5`, which are **request fields the browser posts** — visible and, absent
the hash, editable. Two things make them safe:

1. `udf1` is inside the request hash. A tampered `udf1` invalidates the hash and PayU refuses
   the transaction.
2. **We do not rely on that alone.** The `payment_intents` row written at order-creation time
   is the authoritative binding. `txnid → (user_id, plan_name, amount_paise)` is a database
   fact written by an authenticated server call before any browser round-trip. `udf1` carries
   the `user_id` for human debugging and cross-checking; **the row is the truth.** This is
   strictly stronger than the current Razorpay design, which re-fetches the order from the
   gateway every time.

**G3 — plan from the server, not the body.** `verify-payu-payment` reads only `txnid` from the
request. `plan_name` comes from `payment_intents`. The body cannot influence the plan at all,
which is the FIN-P01 fix carried across intact and made simpler.

**G4 — order bound to the caller.** `payment_intents.user_id !== auth.user.id` → 403. Same
shape as the current `notes.user_id` check, but against our own row rather than a gateway
round-trip — one fewer network dependency in the customer's path.

**G5 — fail closed.** `verify_payment` is a POST to
`https://info.payu.in/merchant/postservice.php?form=2` (test:
`https://test.payu.in/merchant/postservice.php?form=2`) with `key`, `command=verify_payment`,
`var1=<txnid>` (pipe-separated for several), and `hash = SHA512(key|command|var1|salt)`. It
returns `status`, `msg`, and `transaction_details` keyed by txnid with `mihpayid`, `amt`,
`status`, `mode`. **If that call fails, times out, or returns anything we do not understand, we
return 503 and activate nothing** — the exact `razorpayGet` contract, ported: `null` means "we
do not know", and not knowing is always a refusal. This is only safe because the webhook exists,
which is why they must ship together.

**G6 — idempotency, on two columns.** PayU has two identifiers and both matter:

- `txnid` — ours, generated at order creation, unique by construction.
- `mihpayid` — PayU's, the true payment identity, and the one a refund refers to.

The unique index goes on **both**: `txnid` prevents one intent producing two plans;
`mihpayid` prevents a resubmitted or duplicated payment producing two. The Razorpay ordering
discipline is preserved exactly: **check redemption first, before any write**, so a replay
returns the existing plan calmly rather than deactivating a real plan and then dying on a 23505
(the reasoning at `verify-razorpay-payment/handler.ts:180-183` applies verbatim).

**G8 — webhook authentication, and where we go beyond PayU.** PayU's payment success/failure
webhook is a form-encoded POST carrying the same fields as the browser response, including a
`hash`. We verify the reverse hash:

```
SHA512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
```

with the `additionalCharges|` prefix when that field is present and the `splitInfo` variant when
it is, compared in constant time. **But the reverse hash is a shared-secret MAC over
attacker-visible fields, not a per-event signature over raw bytes**, and unlike Razorpay it does
not cover a canonical serialisation. So the webhook is treated as an *unauthenticated trigger*:
its only privilege is to name a `txnid`. The handler then calls `verify_payment` server-to-server
and acts on **that** answer. Two consequences: a forged webhook can at worst cause us to look up
a transaction that is not ours, which is harmless; and the field-ordering fragility of the
reverse hash cannot cause a wrong activation, only a rejected event. Refund and dispute webhooks
are JSON rather than form-encoded — the handler must branch on content type and must not assume
one shape.

**G10, G12 — constant-time comparison and timeouts** port unchanged: reuse `timingSafeEqual`
verbatim, `AbortSignal.timeout` with one retry, 4xx final and 429/5xx retried.

**G11 — refunds.** PayU's refund event is `refund` (successful and failed). Same rule as today:
full refund revokes; partial refund leaves the plan active and logs `MANUAL RECONCILE REQUIRED`;
a refund with no matching plan row is acknowledged. Add PayU's **dispute** (chargeback) event,
which Razorpay's handler has no analogue for — a chargeback should revoke and alert, and the
2.0 terms already have a chargebacks clause (`docs/legal/drafts/terms-of-service.md:293`).

**G15 — the paused switch** is untouched. It lives in `plans.ts:69` and is gateway-agnostic; a
PayU migration must not move it, rename it, or add a second flag.

### The `payment_intents` table — the one genuinely new piece

Razorpay's design leans on `GET /v1/orders/{id}` for the binding. PayU has no equivalent
server-created order object, so the binding must be ours. That is a net improvement, and it
also finally provides what FIN-P03 says is missing: a measurable funnel. Order created →
redirected → verified → activated becomes four counts that exist, where today none of them does.

## 2. Threat model

| Threat | Control | Where enforced |
|---|---|---|
| **Amount tampering** — customer edits `amount` in the posted form | The amount is inside the request hash; the salt is server-only. PayU rejects it. Belt and braces: `verify_payment`'s `amt` is compared with `payment_intents.amount_paise` before activation | Hash + server comparison |
| **Plan tampering** — pays for Silver, asks for Diamond | `plan_name` is read from `payment_intents`, never from the request. `udf1` is in the hash | DB row is authoritative |
| **Replay** — resubmitting a good response payload | Redemption check before any write; unique indexes on `mihpayid` **and** `txnid` | DB constraint (authoritative) + function early-return |
| **Forged browser callback** — hand-crafted POST to `surl` | The browser return is a *navigation*, not an activation. Nothing activates until `verify_payment` answers | Design |
| **Forged webhook** | Reverse-hash rejects it; even if it passed, `verify_payment` is what decides | Two independent checks |
| **Double activation** (webhook races the browser) | Both paths run the same idempotent `activatePlan`; the `.or()` exclusion means neither switches off the other's row; a 23505 is treated as success | G13 ported verbatim |
| **Double submit** (impatient user, two tabs) | `uq_user_plans_one_active` makes it impossible in the database; the check-then-act in `create-payu-order` exists only to return an honest 409 | DB constraint |
| **Cross-user redemption** | `payment_intents.user_id` compared with the token's user; a `mihpayid` already redeemed by another user → 409 with a log line | Function |
| **Secret exposure** | The salt is `Deno.env.get` only, never returned, never logged, never in the SPA bundle. Note the bundle is **committed** (`next-app/public/_spa`) — a secret that reaches `import.meta.env` is committed to git forever | Discipline + review |
| **PII in logs** | Follow the existing rule: `razorpay-webhook/handler.ts` deliberately excludes `payment.email` and `payment.contact` from the failed-payment log. PayU's payloads carry `firstname`, `email`, `phone` and card metadata — log `txnid`, `mihpayid`, `status`, `amount`, error codes, and **nothing else** | Code review |
| **Rate limiting** | Today there is none on the payment functions. `create-payu-order` mints a `payment_intents` row per call, so an authenticated user could spam rows. Add a per-user cap (n intents per hour) — cheap, and it did not exist before | New |
| **Hash-formula drift** | The reverse hash has four variants depending on `additionalCharges` and `splitInfo`. Getting it wrong rejects every real event and looks identical to an attack. Offline tests must cover all four | Tests |
| **Mode mismatch** | Test-mode keys against a live-mode webhook produce an authentication failure that reads like a forged signature — the trap already documented at `razorpay-webhook/handler.ts` lines 170-184. Carry that comment across | Comment + log |

## 3. The migration

### 3a. SQL — additive, reversible, keeps Razorpay history

Two migrations, in this order, with the functions deployed between them (the ordering discipline
from `20260908051500_payment_integrity_indexes.sql` lines 26-33 applies again: **an index live
against an old function can deactivate a real plan**).

**Migration A — provider-neutral columns (additive only).**

```sql
ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS payment_provider   TEXT,
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT,  -- Razorpay pay_… / PayU mihpayid
  ADD COLUMN IF NOT EXISTS provider_order_id   TEXT;  -- Razorpay order_… / PayU txnid

-- Backfill history. Every existing row is Razorpay by definition.
UPDATE user_plans
   SET payment_provider    = 'razorpay',
       provider_payment_id = razorpay_payment_id
 WHERE razorpay_payment_id IS NOT NULL
   AND provider_payment_id IS NULL;

-- Same shape as uq_user_plans_rzp_payment, one provider up.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_plans_provider_payment
  ON user_plans (payment_provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_plans_provider_order
  ON user_plans (payment_provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;
```

`razorpay_payment_id` is **kept**, still populated by the Razorpay functions while they remain
deployed, and `uq_user_plans_rzp_payment` is **not dropped**. Dropping either is a separate,
later, deliberate migration once no Razorpay code path is live. Rollback for A is three
`DROP INDEX` and three `DROP COLUMN`, and it loses nothing because the old column still carries
the history.

**Migration B — `payment_intents`.**

```sql
CREATE TABLE IF NOT EXISTS payment_intents (
  txnid           TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name       TEXT NOT NULL,
  amount_paise    INTEGER NOT NULL,
  provider        TEXT NOT NULL DEFAULT 'payu',
  status          TEXT NOT NULL DEFAULT 'created',  -- created|redirected|success|failure|expired
  mihpayid        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
-- No policies: service role only. Same posture as email_logs after the security migration.
CREATE INDEX IF NOT EXISTS ix_payment_intents_user ON payment_intents (user_id, created_at DESC);
```

**RLS on, no policies** — deliberately. The customer's own plan is already visible through
`user_plans`; an intent row is internal reconciliation data and there is no product reason for
the browser to read it. This keeps the rule that RLS is the whole authorisation layer and that
new tables default to closed. The `ON DELETE CASCADE` keeps account deletion (FIN-S09) from
gaining a new orphan class.

### 3b. Functions

| Razorpay today | PayU replacement | Note |
|---|---|---|
| `create-razorpay-order` | `create-payu-order` | Writes the intent row; returns the form fields + hash; **never the salt** |
| `verify-razorpay-payment` | `verify-payu-payment` | Takes `txnid` only; calls `verify_payment`; idempotent activation |
| `razorpay-webhook` | `payu-webhook` | Reverse-hash → `verify_payment` → same `activatePlan`. **Deploy with `--no-verify-jwt`, and it is still the only function that may be** |
| — | `_shared/payu.ts` | `requestHash`, `reverseHash` (all four variants), `verifyPayment`, `timingSafeEqual`, `PLAN_DETAILS` |
| — | `_shared/cors.ts` | Origin allow-list — needed for mobile anyway (Initiative 1 #11) |

**Take FIN-P05 off the table at the same time.** The migration adds a fourth and fifth copy of
`PLAN_DETAILS` if done naively. Generate `supabase/functions/_shared/plans.ts` from
`next-app/data/seo/plans.ts` inside the script that already writes `serviceability.json`
(`next-app/scripts/seo/export-serviceability.ts`, run via `npm run seo:export-spa`), have all
functions import it, and add a CI check that the generated file is current — exactly the shape
of the existing committed-bundle check. This is remediation task 3.2 and this is the moment it
becomes nearly free.

**Decommissioning Razorpay — decision 1, and the order matters.** This is a complete switch, so
the Razorpay code is not kept as a fallback. It is removed in this order and no earlier:

1. **PayU is live and verified end to end** — the P4 checklist below, every box.
2. **Then** the three Razorpay functions are deleted from the repo and undeployed
   (`supabase functions delete create-razorpay-order verify-razorpay-payment razorpay-webhook`,
   by name — never a bare command).
3. **Then** the webhook endpoint is unregistered in the Razorpay dashboard.

Step 3 last is not arbitrary: while the endpoint is registered and the function is gone,
Razorpay retries a delivery for 24 hours against a dead URL, which is noisy but harmless.
Unregistering *first* and then discovering a stranded in-flight payment leaves no way to
recover it.

**What survives the decommission, permanently:**

- `user_plans.razorpay_payment_id`, its partial unique index, and every existing row. Retiring
  the code is not the same as deleting the record of what customers paid.
- **The Razorpay merchant account itself.** The 2.0 privacy policy commits to an eight-year
  retention of financial records, and for plans sold before the switch that ledger is
  Razorpay's. The account cannot simply be closed when the code is retired — noted in
  `docs/legal/drafts/counsel-notes.md` under "Deletion versus financial records".

**And what this costs us: there is no rollback.** The previous draft of this plan kept Razorpay
deployed precisely so that a bad PayU launch could be reversed by flipping `PURCHASES_PAUSED`
back to `true`. That option is gone by decision. Flipping the pause back still stops *new*
purchases, which is the important half — but a PayU defect that mis-activates or fails to
activate a plan has to be fixed forward. Two things follow, and both are now mandatory rather
than advisable: the P4 test-mode run is the gate, not a formality; and `payment_intents` gives
us a row for every attempt, so a failure is at least always reconstructable.

### 3c. SPA changes in `PricingPage.jsx`

- `handleBuyPlan` (line 52) loses the `window.Razorpay` branch (lines 62, 153) entirely. That
  is browser assumption #3 from Initiative 1 — **doing PayU first removes it for free.**
- The paused-checkout early return (lines 54-59) and the modal (lines 167-217) **do not change.
  That modal is the owner's design and must not be redesigned** (`AUDIT/20-IMPLEMENTATION-PROMPT.md`,
  Phase 1c note).
- Remove `<script src="https://checkout.razorpay.com/v1/checkout.js">` from `app/index.html:13`
  — a render-blocking third-party script that is dead weight while checkout is paused (part of
  FIN-PF02).
- `PLATFORM_FEATURES` (line 27) says "Secure Razorpay payments". **Customer-facing copy — show
  the owner before changing it.**
- The verify call currently posts `plan_name`, `email` and `phone` (lines 112-119); the PayU
  version posts `txnid` and nothing else.
- **FIN-B13 still bites**: `functions-js` throws on non-2xx, so the honest 503 message ("no
  amount has been lost — contact support") never reaches the customer. Worth fixing in the same
  phase, because fail-closed is only humane if the customer is told what happened.

### 3d. PayU on Android and iOS

**Recommendation: the hosted page in an in-app browser sheet, not a native SDK.** Reasons: it is
the same code path as the web, so there is one integration to secure and one to test; card data
stays entirely off our surface, which is the point of hosted checkout; and PayU's native SDKs
would need their own hash plumbing, their own version upgrades and their own store review
surface. Concretely: `@capacitor/browser` (SFSafariViewController / Chrome Custom Tabs), with
`surl`/`furl` pointing at an HTTPS URL on `mybuddymaid.in` that is also a Universal Link / App
Link, so the sheet closes and the app resumes. Then the app calls `verify-payu-payment` with the
`txnid` **it already holds** — it never has to trust anything the browser returns. That last
point matters: the mobile flow is *more* robust than the web one, because the app kept the
`txnid` in memory the whole time.

### 3e. Tests — mirroring `verify-payment.test.ts`

The existing suite is 18 tests, 526 lines, entirely offline with `fetch` stubbed
(`supabase/functions/__tests__/verify-payment.test.ts`), plus 22 webhook tests. Reproduce it
case for case; the FIN reference in each name should carry over so the lineage is visible:

- no `Authorization` header → 401; anon key → 401 (G2)
- tampered hash → 403
- a body naming a different plan gets the intent's plan (G3)
- an intent belonging to another account → 403 (G4)
- `verify_payment` `amt` ≠ intent amount → 403
- `verify_payment` status not success → 402
- already refunded → 403
- **fails closed** when `verify_payment` errors, times out, or returns unparseable output (G5) —
  at least three tests, because PayU's `postservice.php` can return non-JSON
- replay of the same `txnid` → exactly one plan; replay of the same `mihpayid` → exactly one plan (G6)
- another user's `mihpayid` → 409
- a webhook landing mid-verification is not deactivated (G13)
- an older plan is superseded while the current payment is spared
- a legacy Razorpay plan with a NULL provider id is still superseded
- malformed identifiers refused
- **reverse-hash: all four variants**, plus wrong-salt, plus field-reorder
- webhook: form-encoded success, form-encoded failure, JSON refund, JSON dispute, unsubscribed event

Add them to the CI `functions` job's `deno test` step and to the `deno check` loop
(`.github/workflows/ci.yml:92-98`) by name — never a bare `functions deploy`, and never a glob
that would sweep up `send-plan-email`.

### 3f. The re-enabling checklist, redone for PayU

`AUDIT/11-PAYMENTS.md`'s checklist is Razorpay-shaped. The PayU equivalent, which should replace
it in that file when the work is done:

- [ ] `uq_user_plans_provider_payment` and `uq_user_plans_provider_order` deployed, Razorpay
      indexes retained
- [ ] `payment_intents` created, RLS on, no policies, cascade from `auth.users` verified
- [ ] `verify-payu-payment` fails closed on every `verify_payment` failure mode, including
      non-JSON
- [ ] The plan comes from `payment_intents`, never the request body
- [ ] Idempotency returns the existing plan on replay of `txnid` **and** of `mihpayid`
- [ ] `payu-webhook` deployed **with `--no-verify-jwt`**, reverse-hash verified, and confirmed
      to have received a real event — **this is the box Razorpay never ticked**
- [ ] `PAYU_SALT` proven correct by an end-to-end test-mode transaction, not by inspection
- [ ] Refund revokes; partial refund does not; dispute revokes and alerts
- [ ] `PLAN_DETAILS` generated from `plans.ts`, not copied, with a CI freshness check
- [ ] `_shared/cors.ts` allow-list in place (needed for mobile regardless)
- [ ] Prices agree across `plans.ts`, `serviceability.json` and the generated shared file — one
      command, not five files by eye
- [ ] Full test-mode run: successful purchase, replayed verification, tampered amount, tampered
      `udf1`, browser closed before return, refund, partial refund, chargeback
- [ ] `PURCHASES_PAUSED` still `true` at this point — flipping it is a separate, owner-only act

## 4. What only the owner can do

1. **PayU merchant onboarding and KYC** — entity documents, PAN, GST, bank account, website
   review. PayU reviews the site; the unpublished 2.0 terms and the refund-policy contradiction
   (FIN-C01: `/replacement-policy` and `/terms-of-service` publish materially different refund
   terms) are the kind of thing a gateway's compliance review flags. **Fixing FIN-C01 before
   applying is cheaper than fixing it during a review.**
2. **Key and salt handling.** `PAYU_KEY` and `PAYU_SALT` go into Supabase secrets, by the owner,
   never into `.env`, never into the SPA, never into a chat message. Rotation is owner-only, and
   because the salt is in both the request hash and the reverse hash, a rotation must be done in
   a maintenance window or every in-flight transaction fails.
3. **GST invoicing.** Nothing in this repo issues an invoice today. `user_plans` has no invoice
   number and no GST fields, and Annexure B of the 2.0 terms
   (`docs/legal/drafts/terms-of-service.md:424`) is where the commitment lives. This is a real
   gap, it is a legal/finance decision before it is an engineering one, and it should be settled
   before checkout re-opens rather than after.
4. **When to flip `PURCHASES_PAUSED`.** Explicitly and only the owner's call
   (`AUDIT/20-IMPLEMENTATION-PROMPT.md`, "Things that are deliberately off"). Nothing in this
   initiative changes that.
5. **Confirming the PayU merchant entity name** before the legal drafts are published. The
   drafts now say "PayU Payments Private Limited"; that must be checked against the merchant
   agreement. Razorpay's registered entity name differed from its brand name, and this one may
   too.
6. **Keeping the Razorpay merchant account open** for the eight-year financial-records
   retention, even after the code is gone.

## Phased plan — Initiative 2

| Phase | Work | Effort | Depends on |
|---|---|---|---|
| P0 | Owner: PayU onboarding + KYC; confirm the merchant entity name for the legal drafts | **XL** (calendar) | owner |
| P0 | FIN-C01/C02 — **decision 9: covered by the 2.0 terms' single refund term, no separate fix.** Still worth confirming the live `/replacement-policy` and `/terms-of-service` pages before PayU's compliance review reads them, since the 2.0 documents are not published yet | **S** | owner |
| P1 | Generate `_shared/plans.ts` from `plans.ts`; all functions import it; CI freshness check (FIN-P05) | **M** | — |
| P1 | `_shared/cors.ts` origin allow-list | **M** | — |
| P2 | Migration A (provider-neutral columns) + Migration B (`payment_intents`) | **M** | P1 |
| P2 | `_shared/payu.ts` + `create-payu-order` + `verify-payu-payment`, with the full offline suite | **L** | P2 SQL |
| P3 | `payu-webhook` + refund + dispute, with the full offline suite | **L** | P2 |
| P3 | `PricingPage.jsx` PayU path; drop the Razorpay script tag; fix FIN-B13 | **M** | P2 |
| P4 | Test-mode end-to-end run, all eight scenarios; **register the webhook and prove a real event arrives** | **M** | P3 + owner |
| P4 | Rewrite the checklist in `AUDIT/11-PAYMENTS.md`; add a `payment_events`/intent funnel report (closes the rest of FIN-P03) | **S** | P4 |
| P5 | Owner flips `PURCHASES_PAUSED` | — | owner |
| P6 | **Decommission Razorpay, in order:** delete + undeploy the three functions by name, then unregister the webhook. Merchant account stays open | **S** | P5 + a settled period on PayU |

## Risks — Initiative 2

| Risk | Severity | Mitigation |
|---|---|---|
| Reverse-hash variant handled wrongly → every real event rejected, looks like an attack | **High** | All four variants under test; log the variant chosen, never the hash |
| Wrong salt → silent, permanent 401-equivalent | **High** | Prove it with a test-mode transaction before go-live; this is the mistake Razorpay's webhook is still exposed to |
| `verify_payment` returns non-JSON on error | Medium | Parse defensively; unparseable = unknown = refuse |
| **No rollback** — Razorpay is retired by decision, so a PayU defect must be fixed forward | **High** | P4 test-mode run is a gate, not a formality; `payment_intents` makes every attempt reconstructable; `PURCHASES_PAUSED` still stops new purchases |
| Razorpay merchant account closed too early, breaking the 8-year financial retention | Medium | Called out in the decommission steps and in `counsel-notes.md`; the account stays open after the code goes |
| Split history across two providers | Low | Additive migration; Razorpay column and index retained; `payment_provider` makes every row attributable |
| Losing a Phase 0 guarantee in translation | **High** | The G1–G15 table is the acceptance criteria; each maps to at least one test |
| A fifth copy of `PLAN_DETAILS` | Medium | P1 generates it before any PayU function exists |
| PayU compliance review stalls on the refund contradiction | Medium | P0 fixes FIN-C01 first |

## What must not break — Initiative 2

- **All fifteen guarantees.** Each is a row in the table above, each maps to a test.
- **RLS as the only authorisation layer.** `payment_intents` ships RLS-on with no policies.
- **`PURCHASES_PAUSED`** stays one flag in `plans.ts:69`, owner-controlled, gateway-agnostic.
- **The paused-checkout modal** (`PricingPage.jsx:167-217`) is the owner's design; do not
  redesign it, and show any wording change before committing.
- **`razorpay-webhook` remains the only function deployed with `--no-verify-jwt`** — and
  `payu-webhook` becomes the second, with the same reasoning and the same warning comment.
- **Never `supabase functions deploy` without names** — it would sweep up `send-plan-email`
  (FIN-S12).
- **CI's three jobs** keep passing, including the committed-bundle diff after any
  `PricingPage.jsx` change (`npm run build:spa`, commit `public/_spa`).

---

# Initiative 3 — a support chatbot with live-agent escalation

## Current state, stated honestly

**WhatsApp is the only working conversion path, and that is by design right now.** Phase 1c
batch 1 (`bc217a62`, FIN-U01) re-pointed the home page's plan buttons straight at WhatsApp,
because the previous route was eight steps to a "use WhatsApp instead" modal. The site's CTAs
are WhatsApp, call, and "book in the app" (`components/seo/CtaButtons.tsx:32-42`), the sticky
mobile bar is WhatsApp and call (lines 48-58), and the booking app's paused-checkout modal is
WhatsApp and call (`PricingPage.jsx:186-210`). There are tests asserting this
(`next-app/lib/.../*.test.ts`: "while checkout is paused a plan CTA goes straight to WhatsApp").

**So: removing WhatsApp is a staged decision taken after the chatbot and the live handoff are
proven, not a day-one change.** The chatbot ships *alongside* WhatsApp, is measured against it,
and only when deflection and CSAT justify it does WhatsApp move from primary to secondary. If
the bot ships and WhatsApp is pulled at the same time, a bad week costs the business every lead.

**What already exists in our favour:** the site's knowledge is unusually well-structured for
grounding, and the `@anthropic-ai/sdk` is already a dependency of `next-app`
(`next-app/package.json`, devDependencies, used by `scripts/seo/draft-copy.ts` for SEO copy
drafting). The pattern of "the model drafts, the data layer supplies the facts, unverified
claims are dropped" is already established in this repo.

## 1. Knowledge and grounding

Every number below was read from the data layer, not estimated:

| Source | Content | Count |
|---|---|---|
| `data/seo/cities.ts` | cities with zones, hero localities, city-level pincodes | **8** |
| `data/seo/zones.ts` + derived | zones | **35** |
| `data/seo/localities/*.ts` | localities with pincodes, neighbours, housing profile | **342** |
| derived `PINCODES` (`data/seo/index.ts:78-91`) | pincodes | **267** |
| `data/seo/services.ts` | services with `tasksIncluded`, `tasksExcluded`, `typicalHours`, pricing bands, `altNames` | **6** |
| `data/seo/plans.ts` | plans with fee, term, replacements, verified profiles, police verification | **3** |
| `data/seo/faqs/shared-faqs.ts` | global + housing-profile FAQs | **20** |
| `data/seo/faqs/service-faqs.ts` | per-service FAQs | **54** |
| `data/seo/content/city-content.json` | city FAQs | **40** |
| `data/seo/content/zone-content.json` | zone FAQs | **70** |
| `data/blog/posts.ts` | blog posts | **35** (per `AUDIT/02-ROUTES.md:35`) |
| `/how-we-verify`, `/replacement-policy` | trust and policy copy | 2 pages |
| `docs/legal/drafts/` | 2.0 terms (448 lines) and privacy policy (298 lines) | **not yet published** |

That is **184 curated FAQ answers** before a single one is written for the bot.

**The grounding rules, and they are not negotiable:**

1. **Prices and contractual terms are quoted from data, never generated.** `PLANS`
   (`plans.ts:21-53`), `REFUND_WINDOW_DAYS = 60` (line 58), `REFUND_PROFILE_THRESHOLD = 3`
   (line 60), and the service pricing bands. The bot's tool returns these as structured values
   and the answer template interpolates them. A model that can phrase a price is a model that
   can get one wrong, and getting a price wrong here is a consumer-law problem, not an
   embarrassment.
2. **Serviceability is answered by a function call, never by recall.** `isServiceable()`,
   `getLocalitiesByPincode()`, `lookupPincode()` already exist
   (`data/seo/index.ts:132-152`, `app/src/lib/serviceability.js:33-45`) and the rule the repo
   already lives by is "if a locality is not here, it has no page and is not serviceable"
   (`data/seo/index.ts:3`). The bot inherits that rule exactly.
3. **Show the source.** Every answer cites the page it came from and links to it. This is not
   decoration: it is how a wrong answer gets caught, and it feeds the SEO pages traffic.
4. **Refuse and escalate when the answer is not in the knowledge.** The repo already has a name
   for this discipline — `dropUnverified()`, singled out in `AUDIT/01-ARCHITECTURE.md` §8 as
   "rare discipline". The bot's version: no grounded source → do not answer → offer a specialist.
5. **The legal documents are quoted only once published.** The 2.0 drafts are not live. A bot
   quoting unpublished terms is quoting something the customer cannot read and the company has
   not adopted. Until publication, the bot says "our team will confirm the exact terms" and
   escalates.

**Retrieval — and decision 5 rules out the obvious shape.** With this corpus, do **not** build a
vector database: 184 FAQs, 6 services, 3 plans, 342 localities and 35 blog posts is small enough
for keyword/BM25 retrieval over the FAQ and blog text plus direct lookups against the typed data.

The important architectural point is **what runs the lookup**. The natural design is a
tool-calling agent that decides which function to call. Decision 5 rules that out, and correctly:
free models vary enormously in tool-calling reliability, and a model that calls
`check_serviceability` badly produces a *wrong serviceability answer*, which is worse than no
answer. So the pipeline is inverted:

```
customer message
  → classify intent + extract entities   (deterministic: regex, slug matching against the
                                          342 localities / 267 pincodes / 6 services / 3 plans,
                                          then a keyword search over the FAQ corpus)
  → look the answer up in our own data   (the same functions, called by OUR code, not the model:
                                          isServiceable(), lookupPincode(), PLANS, SERVICES,
                                          searchFaqs())
  → REDACT the customer's message        (decision 17 — phone numbers, email addresses and
                                          card-like digit runs stripped server-side. The
                                          UNREDACTED message is what we store and what the
                                          agent sees; the REDACTED one is what leaves.)
  → hand the model {redacted question, retrieved facts, conversation so far}
  → the model returns ONE thing: the wording
  → we splice prices and policy terms in verbatim from the data layer before display
```

**The redaction step is decision 17 and it is not optional.** The first version of this design
claimed the model receives no personal data because we never attach account data to the
request. That was wrong: the customer's own message goes to the model, and people type their
phone number into a chat box without being asked. Three properties matter:

- **Redact for the model only.** The stored transcript and the agent's view keep the original —
  a customer who typed their number so the team could call back must not have that silently
  discarded. Redaction is a property of the outbound provider call, not of the record.
- **Entity extraction runs before redaction**, so a pincode is still recognised as a pincode.
  Six-digit pincodes and ten-digit phone numbers are both digit runs; get the order wrong and
  serviceability breaks.
- **It cannot be perfect, and the policy says so.** Privacy §3.6 states the removal is automatic
  and that we ask people not to send such details as well, rather than promising the filter is
  complete. Do not let that sentence be "tidied" into a stronger claim.

Four properties fall out of this, and each one is why it is the right call here:

- **A weak model cannot produce a wrong fact**, only awkward phrasing. The facts were resolved
  before it was called.
- **Prices and policy terms never pass through the model as free text.** They are inserted
  after it returns, from `PLANS` / `REFUND_WINDOW_DAYS` / `REFUND_PROFILE_THRESHOLD`.
- **The retrieval step is testable with ordinary unit tests** — no model, no network, no
  flakiness. It goes straight into `next-app`'s `tsx --test` suite.
- **The answer survives the model being unavailable** — rung 3 of the degradation ladder in §5.

It also cannot hallucinate a locality that does not exist, because the lookup would return
nothing and the refusal-and-escalate rule takes over.

**English and Hindi/Hinglish.** Claude handles Hinglish natively; no translation layer.
Constraints worth stating: the *data* is English (locality names, service names, plan names), so
prices and policy terms are quoted in English inside a Hindi/Hinglish sentence. The FAQ corpus
already carries Hinglish service vocabulary (`services.ts` `altNames`: "jhadu-pocha maid",
"bartan maid"), which should feed the retrieval index so a query in that vocabulary matches.
Language detection is per-message, not per-session — people switch mid-conversation.

## 2. What it does

Every lookup below is called by **our** code during the retrieval step, before the model is
involved — never by the model as a tool. See §1.

| Capability | Lookup | Notes |
|---|---|---|
| Answer service, plan, policy and process questions | `searchFaqs` + `SERVICES` + `PLANS` | 184 curated answers |
| Check serviceability by locality or pincode | `isServiceable` / `lookupPincode` | 267 pincodes, 342 localities; "not served" is a correct and useful answer |
| Explain plans and prices | `PLANS` — spliced verbatim after the model returns | ₹4,999 / ₹5,999 / ₹6,999; 10/12/18 months; 3/5/10 replacements |
| Capture a lead | `leads` table via `/api/lead`, **Phase 1d** | Straight from the widget to Supabase; lead details never reach the model |
| Booking status for signed-in users | `bookings` under the user's own JWT | Summarised to a status before the model sees it — no addresses, no phone numbers |
| Hand off to a person | §3 | |

**Lead capture is blocked and must not be worked around.** The `leads` table does not exist —
the migration sits in `supabase/migrations-pending/2026-09-06-leads-and-placement-locality.sql`,
and `next-app/app/api/lead/route.ts:23` returns 503 unless `LEADS_ENABLED=true`. That flag is
explicitly the owner's (`AUDIT/20-IMPLEMENTATION-PROMPT.md`). The bot must therefore go through
`/api/lead` when Phase 1d lands, reusing its footprint validation
(`next-app/app/api/lead/route.ts:42-47`) and its rate limiting (FIN-S06) rather than writing a
second, unvalidated write path. Note the route's own bug, FIN-B03: it inserts `city`/`locality`/
`service` while the schema declares `*_slug`, so **the first lead it ever receives will 502**
until 1d fixes it.

**Booking status must go through RLS, not a service-role query.** The bot backend must use the
signed-in user's JWT so `bookings` RLS applies. A convenience service-role lookup here would be
a cross-tenant read waiting to happen and would break the one architectural rule this system
depends on. For anonymous visitors, booking status is simply unavailable — offer the app or a
handoff.

## 3. Smart escalation

**Triggers** — any one hands off:

1. The user asks for a person, in any phrasing or language.
2. **Low confidence:** no grounded source, or the retrieval score is below threshold. This is
   the refusal rule from §1.4 and it is the most important trigger.
3. **Complaint or dissatisfaction** — a helper who did not turn up, a bad experience.
4. **Refund or replacement request.** The bot may *explain* the 60-day / 3-profile policy; it
   must never *decide* one.
5. **Safety** — theft, harassment, injury, a child or elderly person at risk. Immediate,
   unconditional, and it should also alert out-of-band, not just queue.
6. **Turn count** — three unresolved exchanges on the same question.
7. Anything about an existing payment.

**The handoff state.** "Connecting you to a specialist…" with the queue position or an expected
wait, and — critically — **the conversation stays in the same thread.** Punting the customer to
a different channel is the failure mode the whole initiative exists to fix.

**Outside support hours (10 AM–7 PM, Mon–Sat — decision 11; note `app/src/pages/PricingPage.jsx:207` still says Mon–Sun 9 AM–9 PM and must be updated in the same release).** The bot says so
plainly with the local time, takes a message with name, phone, locality and question, **promises
a callback within 24 hours** (decision 4), notifies the team, and — for safety triggers only —
shows the phone number regardless. Publishing support hours next to every WhatsApp CTA is
already a Phase 4 item in `AUDIT/18-REMEDIATION-PLAN.md`; the bot makes it load-bearing.

The 24-hour promise is written into the terms draft at §14.4, so it is now a contractual
commitment rather than a UI string. It needs a measurement: Initiative 4's interaction record
carries the escalation time and the first agent reply, so "did we keep the 24-hour promise" is a
query, and it belongs in the weekly report.

**Continuity.** The specialist opens the conversation and sees the full transcript, the tools
the bot called and what they returned, the page the visitor was on
(`components/seo/CtaButtons.tsx:17-25` already tracks city/zone/locality/service/pincode for
GA4 — the same attributes should attach to a conversation), the signed-in user id if any, and
their plan and bookings if signed in. **The bot must never make the customer repeat themselves.**
On resolution, the transcript is retrievable by conversation id.

## 4. How the team replies — the operational comparison

This is the part that decides whether the initiative works, because the bot is the easy half.

### Option A — internal support inbox on Supabase

`conversations` and `messages` tables, Supabase Realtime for live updates, RLS so a customer
sees only their own conversation and an `agent` role sees the queue, and an agent page in the
booking app or a separate `/admin` route.

- **Cost:** ₹0 additional. Supabase and Vercel are already paid for; Realtime is included.
- **Setup: L–XL.** The agent UI is a real product — inbox, assignment, typing indicators,
  canned replies, search, unread state, sound. Every one of those is a day nobody is building
  the booking product.
- **The RLS work is the serious part.** A new `agent` role is **a change to the only
  authorisation layer this system has** (`AUDIT/01-ARCHITECTURE.md` §7). It needs its own RLS
  tests in `supabase/__tests__/rls.test.ts` before it is switched on. Get it wrong and every
  customer conversation is readable by every authenticated user.
- **Verdict:** correct destination, wrong starting point. Build it when conversation volume
  justifies owning it.

### Option B — Chatwoot Cloud with the bot in front — **chosen (decision 3)**

Current Chatwoot Cloud pricing, checked 2026-09-10:

| Tier | Price | What matters here |
|---|---|---|
| **Hacker** | **$0**, up to 2 agents, **500 conversations/month** | Live chat only — **no WhatsApp channel**, which is the main strategic reason we want Chatwoot |
| **Startups** | **$19/agent/month** billed annually | All channels except voice, **WhatsApp Business API included**, business hours, auto-responder, transcripts, help centre. 1-year data retention |
| **Business** | **$39/agent/month** billed annually | Adds **CSAT reports**, SLA, pre-chat forms, **custom attributes**, automation rules, teams. 2-year retention |
| Enterprise | $99/agent/month | SSO/SAML, audit logs, branding removal — not needed |

With one support person (decision 4), that is **$19/month ≈ ₹1,700** on Startups or
**$39/month ≈ ₹3,400** on Business.

**Recommendation: start on Startups ($19), not Business.** The two Business features that look
necessary — CSAT and custom attributes — are both things Initiative 4 stores in Supabase anyway,
where they can be joined to localities, services, plans and bookings. Paying twice as much to
duplicate them inside Chatwoot buys nothing. Revisit Business only if the team wants Chatwoot's
own SLA and automation tooling.

*(The free Hacker tier is worth knowing about but is not the right start: no WhatsApp channel,
and unifying WhatsApp with web chat in one inbox is the whole reason Chatwoot beat the
alternatives.)*

For the record, the alternatives considered: **Crisp**, around **$25–45/team/month**, fast to
set up but weaker on self-hosting and data residency; **Intercom**, roughly **$29–85/seat/month**
plus resolution-based AI pricing, the strongest product and the most expensive way to discover
what a one-person support team actually needs.

- **Setup: M.** Subscribe, embed the widget, wire the bot as an agent-bot, define the handoff,
  connect WhatsApp.
- **Main risk:** a second data store holding customer PII, with its own retention, its own
  deletion path, and its own entry in the privacy policy — now drafted. Cloud rather than
  self-hosted means the retention setting is a plan-tier feature rather than ours to enforce,
  which is exactly why Initiative 4 makes Supabase the system of record and Chatwoot the working
  surface.
- **Revisit self-hosting** when volume justifies it (decision 3). The trigger to watch is agent
  count: self-hosting becomes clearly cheaper somewhere around three or four agents, and it also
  returns control of retention and residency.

**Data residency — settled, and worth stating plainly (decision 18).** Chatwoot's hosted service
stores and processes data on servers in the **United States** and offers **no choice of region**
at signup; this was confirmed against Chatwoot's own privacy policy on 2026-09-10. It is named
as a United States sub-processor in privacy §4.2.

The consequence is worth understanding before it becomes a surprise: **support transcripts —
including WhatsApp and phone records once those channels land in the inbox — leave India.** The
DPDP Act permits transfer to countries not restricted by the Central Government, so this is
lawful today. But three things follow:

- **India-resident support data would require self-hosting Chatwoot, not a setting.** There is
  no region toggle to flip later; it is a migration.
- **Payment data is unaffected.** It stays in India with PayU under the RBI's storage direction,
  and privacy §5.1 says so. Do not let the two get conflated in a compliance conversation.
- **If the Central Government later restricts transfers** to the relevant country under §16 of
  the DPDP Act, self-hosting stops being an optimisation and becomes the remedy. Worth a note in
  the risk register rather than a plan.

**Supabase is in Sydney, Australia** (`ap-southeast-2`, confirmed 2026-09-10), and since
Initiative 4 makes Supabase the system of record, that is where the authoritative copy of every
transcript lives — along with every profile, booking and plan the system has ever held.

So the honest summary of residency is: **nothing except payment data is in India.** Supabase in
Sydney, Chatwoot in the United States, Vercel logs in the United States, Resend in the United
States, OpenRouter and the model providers in the United States. Only PayU holds Indian data,
under the RBI storage direction. That is lawful — DPDP Section 16 restricts only countries the
Central Government notifies, and none of these is notified — and the policy now says so
plainly rather than implying a local database.

Two things follow that are worth deciding rather than inheriting:

- **Latency.** Every customer is in one of eight Indian cities, and every PostgREST query from
  their browser crosses to Sydney and back. India–Sydney is typically in the 130–160 ms range,
  against roughly 50–60 ms to Singapore (`ap-southeast-1`) and well under 30 ms to Mumbai
  (`ap-south-1`). The booking app's entry path issues several round trips before the first
  screen settles (`AuthContext.loadUserData` parallelises three queries, but the session lookup
  precedes them), so this is a real component of perceived speed, not a rounding error.
  **Measure it before acting** — but if it matters, moving regions is far cheaper now, before
  the support tables exist and while the data is small, than after Initiative 4 ships.
- **A region change is a migration, not a setting.** Supabase does not move a project between
  regions in place; it is a new project, a restore, and a new URL and keys — which, in this
  repo, means rebuilding and recommitting the SPA bundle, because the keys are inlined at build
  time (`AUDIT/20-IMPLEMENTATION-PROMPT.md`, "API keys"). That has already broken production
  once. If the region is going to change, it should change before the chatbot writes its first
  transcript.

### Option C — escalate to the team's WhatsApp Business API while the customer stays in chat

Bot in the web widget; on escalation the transcript is pushed to the team's WhatsApp; the agent
replies in WhatsApp; replies are relayed back into the widget.

- **Cost:** WhatsApp Business API is per-conversation (service conversations are cheap or free
  within the 24-hour window) plus a BSP fee. Realistically **₹1,500–4,000/month** at low volume.
- **Setup: L**, and most of it is the relay: message mapping, media, ordering, the 24-hour
  window, and delivery failures.
- **Where it is genuinely attractive:** the team already lives in WhatsApp. Zero behaviour
  change for the people answering.
- **Where it breaks:** a relay is a distributed system with two sources of truth and no
  transactional boundary. Every message can be dropped, duplicated or reordered, and the
  customer sees the failure. It also *entrenches* WhatsApp exactly when the goal is to stop
  depending on it.
- **Verdict:** not as the primary mechanism. **But Chatwoot's WhatsApp channel gives most of
  this benefit with none of the relay** — the agent can answer WhatsApp and web chat from one
  inbox. That is the reason B beats C rather than a compromise between them.

### Comparison

| | A — Supabase inbox | B — Chatwoot Cloud **(chosen)** | C — WhatsApp relay |
|---|---|---|---|
| Monthly cost | ₹0 | **$19/agent ≈ ₹1,700** (Startups) | ₹1,500–4,000 |
| Setup | **L–XL** | **M** | **L** |
| Ongoing engineering | High — it is a product | Low | Medium — the relay needs care |
| Transcript ownership | Ours | Ours in Supabase (Initiative 4); Chatwoot holds a working copy | Split across Meta and us |
| WhatsApp in the same inbox | No | **Yes** | Yes, but it *is* WhatsApp |
| RLS blast radius | **New `agent` role — high** | One customer-facing SELECT policy (Initiative 4); **no team role** | None |
| DPDP deletion | Ours to implement | Ours in Supabase + one API call to Chatwoot | Meta holds a copy |
| Path to retiring WhatsApp-first | Good | **Best** | Actively works against it |

**One honest correction to the earlier draft of this table.** It said choosing Chatwoot avoided
new RLS work entirely. The new interaction-record requirement (decision 10) means that is no
longer true — Initiative 4 adds tables that need policies. What choosing Chatwoot still avoids
is the expensive and dangerous half: a `team`/`agent` role in RLS that can read every customer's
conversations. Initiative 4 is designed so that role never exists.

### A day in the life — the runbook for whoever answers (Option B)

**Before 9 AM.** Open the Chatwoot inbox (web or the mobile agent app). Read the overnight
queue: out-of-hours messages the bot took, each with name, phone, locality and question. Sort
safety and complaints first.

**Opening the day.** Return every overnight callback, oldest first. The bot promised a reply
within 24 hours and the terms now say so, so the real rule is that nothing sits past its
24-hour mark — the queue view should sort by deadline, not by arrival.

**During the day.** Conversations arrive already triaged: the bot's transcript, the tools it
called, the page the visitor was on, and — if signed in — their plan and bookings. Read it before
typing; the customer has already explained themselves once.

- **Serviceability** — the bot has already answered from the data layer. If the customer is
  outside the footprint, say so and offer to note the locality (it becomes demand evidence for
  which locality to open next).
- **Pricing** — quote from the plan table, never from memory. The bot's message already has the
  correct figures; reuse them.
- **Refunds and replacements** — a human decision. 60 days, 3 profiles
  (`plans.ts:58-60`). Do not improvise a variation; if it is borderline, escalate to the owner.
- **Safety** — stop, phone the customer, escalate to the owner immediately. Do not handle it in
  chat.
- **Anything you had to answer from your own head** — flag it. That is a gap in the knowledge
  base and it is the single most valuable thing an agent produces.

**Closing a conversation.** Resolve it with a tag: `serviceability`, `pricing`, `booking`,
`complaint`, `refund`, `safety`, `other`. The tags are the eval set for the next quarter.

**End of day.** Snooze anything waiting on the customer. Anything unanswered rolls to the
overnight queue with a message telling the customer when they will hear back — never silence.

**The staffing problem, and how it was resolved (decision 11).** The original 9 AM–9 PM, seven
days is **84 hours a week** — not coverable by one person, which made decision 8's five-minute
condition unreachable in principle. Published hours are now **10 AM–7 PM, Monday to Saturday:
54 hours a week**, which one person can genuinely cover, and the five-minute condition is
measured only within them. Everything outside is the bot plus the 24-hour reply promise.

Two consequences to carry into the build:

- **The published hours are now load-bearing in three places** — the bot's out-of-hours branch,
  Annexure B of the terms, and the `v_support_sla` view's filter. They are the same fact; they
  should come from one constant, in the same spirit as `PLANS` and `PURCHASES_PAUSED`. Hard-code
  them in three places and they will drift, and one of the three is a contract.
- **`v_support_demand_by_hour` should be reviewed after the first month.** If real demand runs
  past 7 PM or lands on Sundays, the hours were set from what one person can staff rather than
  from when customers need help, and that is worth knowing before it is treated as settled.

The live surfaces still publish the old hours — `app/src/pages/PricingPage.jsx:207` says
"Mon–Sun 9 AM–9 PM". **That has to change with the same release**, or the site contradicts the
terms. It is a one-line change but it touches `app/src`, so it needs `npm run build:spa` and a
committed `public/_spa`.

**Weekly, 30 minutes.** Review deflection rate, escalation rate, first response time, and every
flagged gap. Turn the top three gaps into FAQ entries in `data/seo/faqs/` — which improves the
bot *and* the 2,513 SEO pages, because they read the same pool. That feedback loop is the
strongest argument for grounding the bot in the repo's own data rather than a separate CMS.

## 5. Architecture

**Model — decision 5: OpenRouter, free models, behind one adapter.**

The call is made **only** from a server-side route (`next-app/app/api/chat/route.ts`,
`runtime = 'nodejs'`, `dynamic = 'force-dynamic'` — the same shape as
`app/api/lead/route.ts:9-10`) or a Supabase edge function. The key never reaches the browser.

**The adapter.** One module, `lib/assistant/provider.ts`, exposing a single function —
`phrase(retrieved, question, history) → string`. It speaks the OpenAI-compatible chat-completions
shape, which OpenRouter, OpenAI, and (through compatibility endpoints) most others accept.
Configuration is two environment variables: `ASSISTANT_BASE_URL` and `ASSISTANT_API_KEY`, plus
`ASSISTANT_MODELS` as a comma-separated fallback chain. Moving to OpenAI, Anthropic or Gemini
later changes those variables and, at most, the adapter file. **No vendor SDK in the request
path.** (Note `@anthropic-ai/sdk` is already a `next-app` devDependency — it is used by the
offline SEO copy script `scripts/seo/draft-copy.ts` and is not a precedent for the runtime.)

### Which free models pass the no-training test today

Verified 2026-09-10 against OpenRouter's live API — `/api/v1/models` (430 models, **18 free**),
`/api/v1/models/{id}:free/endpoints` for the provider actually serving each free variant, and
`/api/frontend/v1/all-providers` for each provider's `dataPolicy` (`training`, `retainsPrompts`,
`canPublish`). **This is a snapshot and it will go stale — see "Do not hard-code this list".**

| Free model | Provider | Trains on prompts? | Retains prompts? | Context | Uptime 24 h |
|---|---|---|---|---|---|
| `google/gemma-4-31b-it:free` | Google AI Studio (US) | **no** | yes | 262 k | 99.7% |
| `google/gemma-4-26b-a4b-it:free` | Google AI Studio (US) | **no** | yes | 262 k | 99.6% |
| `dots-studio/dots-3-note-preview:free` | AtlasCloud (US) | **no** | yes | 512 k | 100% |
| `nex-agi/nex-n2.5-mini:free` | Nex AGI (**CN**, SG datacentre) | **no** | yes | 262 k | 99.9% |
| `nex-agi/nex-n2.5-pro:free` | Nex AGI (**CN**, SG datacentre) | **no** | yes | 262 k | 95.7% |
| `poolside/laguna-s-2.1:free` | Poolside | **no** | yes | 262 k | 100% |
| `poolside/laguna-xs-2.1:free` | Poolside | **no** | yes | 262 k | 99.6% |
| `cohere/north-mini-code:free` | Cohere (US) | **no** | yes | 256 k | 95.7% |
| `inclusionai/ling-3.0-flash-sante:free` | NovitaAI (US) | **no** | **no** | 262 k | 100% |
| `inclusionai/ling-3.0-flash-fin:free` | NovitaAI (US) | **no** | **no** | 262 k | 100% |
| ~~`nvidia/nemotron-3.5-lightning:free`~~ | NVIDIA | **YES** | yes | 1 M | 98.9% |
| ~~`nvidia/nemotron-3-ultra-550b-a55b:free`~~ | NVIDIA | **YES** | yes | 1 M | 97.3% |
| ~~`nvidia/nemotron-3-super-120b-a12b:free`~~ | NVIDIA | **YES** | yes | 262 k | 98.8% |
| ~~`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`~~ | NVIDIA | **YES** | yes | 256 k | 86.9% |
| ~~`nvidia/nemotron-3.5-content-safety:free`~~ | NVIDIA | **YES** | yes | 128 k | 97.8% |
| ~~`thinkingmachines/inkling:free`~~ | Thinking Machines | **YES** | yes | 1 M | 100% |
| ~~`thinkingmachines/inkling-small:free`~~ | Thinking Machines | **YES** | yes | 1 M | 100% |
| ~~`liquid/lfm-2.5-2.6b:free`~~ | Liquid | **YES** | yes | 65 k | 99.9% |

**10 of 18 pass; 8 fail.** Two things in that table deserve to be read twice:

- **The most tempting models are the disqualified ones.** NVIDIA serves five of the eighteen
  free models, including both 1 M-context options, and NVIDIA trains on prompts. Anyone picking
  a free model on context length and uptime alone lands squarely on a provider we have just
  promised in the privacy policy not to use.
- **The strict filter is unusable.** OpenRouter also offers a per-request
  `provider: { data_collection: "deny" }`, which excludes providers that *store* prompts, not
  just those that train. Applying it collapses the free pool from ten models to **two** — both
  from NovitaAI, and both domain-tuned variants (`-sante` is health, `-fin` is finance), which
  is a poor fit for domestic-help support and a single point of failure besides.

**So the recommendation is: use the account-level opt-out, not the strict per-request filter.**
OpenRouter's privacy settings have separate toggles for paid and free models; set the free-model
toggle to disallow training providers. That gives ten models to build a fallback chain from,
and OpenRouter will not route to a training provider even if one is named by mistake.

**Retention is then handled by not sending anything worth retaining.** Eight of the ten passing
providers retain prompts under their own terms. That is acceptable *only* because the
architecture decision 5 already requires — look the answer up first, then have the model phrase
it — means the model receives the customer's question and the published facts we retrieved, and
**never their name, phone number, address, booking history or payment details.** Lead details go
straight from the widget to Supabase and never through the model. This is written into the
privacy policy draft at §3.6 as a promise, so it is now a testable commitment, not a design
preference.

**Data residency is an owner decision, not a default.** Nex AGI is headquartered in China with a
Singapore datacentre. For a trust-led Indian consumer brand whose privacy policy names its
sub-processors, that belongs at the end of the chain or off it. My recommendation is to exclude
it; the Google AI Studio and AtlasCloud entries cover the same ground from US-headquartered
providers.

### The recommended chain

```
ASSISTANT_MODELS=google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,dots-studio/dots-3-note-preview:free
```

**Confirmed by decision 16, including the exclusion of Nex AGI.** Instruction-tuned (`-it`)
models first, because the job is phrasing a retrieved answer in plain English or Hinglish, not
coding or reasoning. The Poolside and Cohere entries are coding models and the NovitaAI pair are
domain-tuned; keep them out of the primary chain. `dots-3-note-preview` is third because it is
the only non-Google option that both passes and supports structured outputs. Nex AGI is excluded
on data residency despite passing the training test and posting the best uptime in the set —
China-headquartered, Singapore datacentre, and now a named sub-processor question in a published
privacy policy.

Note what the exclusion costs: the chain is **two providers deep, not three** — Google AI Studio
twice and AtlasCloud once. If Google AI Studio has an outage, one option remains before the paid
floor. That is the argument for buying the $10 of credits early rather than treating the paid
floor as a later refinement.

These three providers are now **named in the privacy policy** (§4.2, with §4.2.1 committing to
update the policy when the list changes) rather than on a separate page — decision 18, one
document to keep current. The practical consequence: **adding, removing or reordering a provider
is a privacy-policy amendment.** Treat it as a release step for the bot, not a config tweak.

### Do not hard-code this list

Every source consulted agrees that free models rotate out without warning and that a model free
today may not be tomorrow. Two of the eighteen above are already labelled "preview". So the list
is configuration, not code, and it needs a check that fails loudly:

- `ASSISTANT_MODELS` is an environment variable, never a literal in a source file.
- **A scheduled job re-runs the check in this section** — fetch `/api/v1/models`, fetch each
  configured model's `:free` endpoints, join to `/api/frontend/v1/all-providers`, and alert if
  any configured model has disappeared, changed provider, or acquired `training: true`. Without
  this, a provider policy change silently breaks a promise the published privacy policy makes.
- **The same job is what keeps the privacy policy honest.** Since decision 18 puts the provider
  list in §4.2 of the policy itself, a provider that silently changes its training terms makes a
  *published legal document* false. The check should therefore alert loudly enough that somebody
  acts on it the same day, and its failure mode should be to drop the affected model from the
  chain automatically rather than wait for a human.

**One trap, because it cost me a wrong answer while writing this.** The provider name on an
endpoint (`provider_name`, e.g. `"Nvidia"`, `"Novita"`) is *not* the provider's display name in
the policy list (`"NVIDIA"`, `"NovitaAI"`). Joining on the wrong field does not error — it
silently produces a miss, and a miss reads as "no policy found", which is easy to treat as
"fine". My first pass did exactly that and cleared all five NVIDIA models, which train on
prompts. **Join on `name`, and assert that every endpoint matched a provider.**

### Rate limits, and what they actually constrain

| | Limit |
|---|---|
| Requests per minute, free models | **20**, for everyone — buying credits does not raise it |
| Requests per day, unfunded account | **50** |
| Requests per day, after a one-time purchase of **$10** in credits | **1,000**, permanently (the credits do not expire and the tier does not lapse) |

At roughly one model call per customer turn, 1,000/day is about **165 conversations a day**,
comfortably above any expected volume. **The binding constraint is 20 requests per minute**,
which is about three concurrent conversations at peak — so the route needs a small queue with a
"one moment…" state rather than an error, and the top-question cache below takes most of the
load off it.

**Buy the $10 of credits.** It is the difference between 50 and 1,000 requests a day, it never
expires, and the same balance doubles as the paid floor described next.

### What the bot does when every free model is unavailable

This is where the architecture the owner specified earns its keep. A tool-calling agent has *no
answer* without a model. This design has already retrieved the answer before the model is
called, so the model is only doing the phrasing — and phrasing is the part we can do without.

Four rungs, in order:

1. **Model-level failover, free.** Pass the whole chain as OpenRouter's `models` array;
   OpenRouter fails over between them automatically, and between providers within a model on a
   429 or 5xx. Most outages never reach rung 2.
2. **Paid floor.** Once the $10 balance exists for the rate-limit tier, the last entry in the
   chain is a cheap paid model. At a few conversations an hour the spend is negligible, and it
   converts "all free models are down" from an outage into a line item. Guard it with the daily
   spend ceiling below.
3. **Serve the retrieved answer unphrased.** If no model is reachable at all, render the
   retrieved FAQ answer verbatim with its source link, under a plain line such as *"Here's what
   our help pages say —"*. The answer is correct, sourced and useful; it just is not
   conversational. **The bot does not go down, it goes terse.** For a corpus of 184 curated
   answers this is a genuinely acceptable degraded mode, and it should be built first and
   tested, not added later.
4. **Retrieval found nothing either.** Show a short form — name, phone, locality, service,
   question — which writes an interaction record and a Chatwoot conversation, and say when
   somebody will reply (within support hours, or within 24 hours outside them, per decision 4).
   WhatsApp and phone stay visible throughout, because they remain live for the whole of this
   initiative.

Rung 3 is the one to insist on in review. It is easy to build rungs 1, 2 and 4 and leave rung 3
as a `try/catch` that shows "sorry, something went wrong" — which throws away an answer we
already have in hand.

**Decision 16 makes rung 3 and the 20/min queue required rather than advisable, and requires a
test that rung 3 actually fires.** The test is cheap and belongs in `next-app`'s `tsx --test`
suite alongside the hallucination gate:

- Stub the provider adapter to reject for **every** model in the chain, including the paid
  floor, then assert the route still returns **200** with the retrieved answer text and its
  source link — not a 5xx, and not an apology.
- Assert `model_id` is NULL on the stored `support_messages` row, which is the signal in the
  interaction record that rung 3 served it.
- Assert the answer's price and policy figures still match `PLANS` — the splice happens after
  the model would have run, so it must survive the model not running at all.

That third assertion is the one worth having: it proves the degraded path is not just present
but *correct*, which is the whole claim being made for this architecture.

**Two supporting mechanisms.** A **circuit breaker** per model (three consecutive failures →
skip it for five minutes) so a dead model does not cost every conversation a timeout. And a
**phrasing cache** keyed on the retrieved answer id plus the language, so the top questions are
answered without a model call at all — which cuts both cost and rate-limit pressure, and
directly improves rung 3's coverage.

**Cost.** Free models are $0 per token. The real monthly cost of Initiative 3 is Chatwoot
(below) plus the one-time $10 of OpenRouter credits plus whatever the paid floor consumes.
Budget **$10 one-off and under $5/month** for the model layer at expected volume, and set a hard
daily ceiling in the route that degrades to rung 3 rather than failing.

**Streaming.** Stream to the widget. A grounded answer that calls two tools first has real
latency, and a cursor is the difference between "thinking" and "broken".

**Rate limiting and abuse.** The site has none today, and FIN-S06 already records that
`/api/lead` is a public write endpoint using the service-role key with no rate limit or bot
protection. A chat endpoint is strictly worse: it is a public endpoint that spends money per
request. Minimum before launch: per-IP and per-session limits, a per-conversation turn cap, a
daily global spend ceiling that degrades to "our team will reply" rather than failing, an input
length cap, and Turnstile on the first message from an anonymous visitor (which FIN-S06 already
proposes for `/api/lead`, so the two share the work).

**Loading the widget on 2,513 static pages without breaking the near-zero-JS rule.** This is a
real constraint: the site has **exactly two client components**
(`AUDIT/01-ARCHITECTURE.md` §3), every CTA is server-rendered, and analytics loads on first
interaction. The widget follows `components/shared/Analytics.tsx` precisely:

- Server-render a **static launcher button** — no React, no hydration, just markup and CSS.
- A tiny inline script (a few hundred bytes, in the same `<Script strategy="afterInteractive">`
  block style as `Analytics.tsx:58-63`) listens for a click on it.
- **On first click**, dynamically inject the chat bundle — the pattern at
  `Analytics.tsx:38-49`, where `load()` runs once on the first `pointerdown`/`keydown`/
  `touchstart`/`scroll`.
- **Difference from analytics: no idle timeout.** `Analytics.tsx:53` has
  `setTimeout(load, 4000)`; the chat widget must load on *intent only*. Nobody who never clicks
  the button should download a chat bundle.

Net cost to a visitor who never opens the chat: the launcher markup and a few hundred bytes of
inline script. That preserves the property `AUDIT/01-ARCHITECTURE.md` calls "a genuinely good
decision and the main reason the site ships almost no JavaScript".

The **booking app** has no such constraint — it is already a 558 KB SPA — so the widget can be a
normal lazy-loaded route component there, and it inherits the signed-in session for free.

## 6. Data protection

**Transcripts are personal data under the DPDP Act.** They contain name, phone, locality,
household details, and sometimes complaints about named individuals. Treat them with the same
seriousness as `bookings`.

- **Consent.** A one-line notice at the top of the chat linking the privacy policy, before the
  first message. The repo already has the pattern: `AuthPage.jsx` requires a ticked consent box
  to create an account (commit `8732257e`). Do not silently start recording.
- **The privacy policy has now been amended — in draft.** Done in this session, per decision 2,
  so the documents ship in one pass. What changed in `docs/legal/drafts/privacy-policy.md`:

  | Section | Change |
  |---|---|
  | At a glance | PayU replaces Razorpay; a line on the assistant and the support record |
  | §2.1 | New **"Support interaction data"** row listing every field Initiative 4 stores |
  | §2.2 (new) | The verbatim notice shown before an anonymous visitor types, and how an anonymous conversation is linked on sign-in |
  | §1.1 | Foreign-law status is now conditional — "where, and only to the extent that" GDPR/CCPA apply |
  | §3.1 | One basis per purpose. **Section 7(c) removed** (State-only); 7(d), 7(e) and 8(7) used correctly. The ambiguous "Section 14" now says "of this policy, not of the Act" |
  | §3.2 (new) | **The DPDP Section 5 notice** — the three places it appears and what each must say |
  | §3 table | Two new purpose rows — answering support questions, and aggregate analysis of conversations |
  | §3.6 (new) | **How the assistant works**: retrieval first, prices spliced verbatim, no account data to the model, **phone numbers / emails / card-like numbers stripped from the user's own message**, no-training providers only |
  | §4.2 | PayU replaces Razorpay; new rows for **Chatwoot (United States)**, **OpenRouter** and the two named model providers; §4.2.1 commits to updating the policy when the list changes |
  | §4.6 | Explicit "we do not profile individuals from support conversations" |
  | §6 | Retention rows: **12 months** for messages, **30 days** for an anonymous browser reference, non-identifying counts indefinitely |
  | §8 | Erasure now names support conversations on every channel |
  | §9.1 | PayU checkout cookies; the support-chat reference in local storage |
  | §16 / Annexure | Support hours **10 AM–7 PM Mon–Sat** (decision 11) |

  `terms-of-service.md` gained **§14.4**, which commits to the 24-hour out-of-hours reply and
  states that nothing the assistant says varies the Terms, grants a discount, extends
  Replacement cover or approves a refund; Annexure B now carries the new support hours.
  `counsel-notes.md` records the resolved variables, the Section 7 correction, the
  consent-versus-7(a) correction, the conditional foreign-law scope, and the publication
  preconditions.

  **§3.6 is the clause to take seriously.** It makes five engineering promises testable in
  court: retrieval-first, verbatim prices, no account data to the model, redaction of what the
  user types, and no-training providers. Do not publish it ahead of the code that makes it true.
- **Retention — now proposed, and awaiting confirmation.** The draft commits to 12 months for
  messages, 30 days for an anonymous visitor's browser reference, and non-identifying counts
  kept indefinitely. Enforce all three in scheduled jobs, not in prose. Initiative 4's R4 phase
  owns them, and the roll-up to counts is what lets the analytics survive the deletion.
- **Deletion with the account.** `delete-account` (`supabase/functions/delete-account/index.ts`)
  must gain the conversation store. If Chatwoot is used, that is an API call to delete the
  contact and its conversations — and it must be part of the same erasure path, or a DPDP
  erasure request is quietly incomplete. Note FIN-S09: that function is already
  non-transactional and can leave orphans; adding a fourth system makes fixing it (remediation
  task 3.7) more urgent rather than less.
- **What must never enter a transcript or a log.** Payment details, card data, passwords, OTPs.
  The bot must refuse to accept them and say why. The repo already sets this precedent:
  `razorpay-webhook/handler.ts` deliberately excludes `payment.email` and `payment.contact` from
  logs "because customer PII does not belong in a log stream that cannot be purged on an erasure
  request".
- **Anonymous visitors.** A random `conversation_id` in `localStorage` (or a first-party session
  cookie), used only to continue a conversation. Never fingerprinting, never joined to GA4 or
  Umami identifiers, and it must appear in the privacy policy's cookie table with a stated
  lifetime. If the visitor later signs in, link the conversation to their user id **from that
  point forward** — and say so in the interface.
- **Sub-processors — three, now drafted.** OpenRouter, the model providers it routes to, and
  Chatwoot. The model-provider row deliberately points at a published page rather than naming
  providers inline, because the fallback chain changes when a model is withdrawn; naming them in
  the policy would mean a policy amendment every time OpenRouter retires a free model. That page
  has to exist and stay current — it is a new variable in `counsel-notes.md`.
- **What the model provider actually receives.** Worth restating because it is the reason
  prompt-retaining providers are acceptable at all: the customer's question and the published
  facts we retrieved. Not their name, phone, address, bookings or payment data. Lead details go
  from the widget straight to Supabase. If that ever stops being true, §3.6 of the published
  policy becomes false, and the provider list has to be re-evaluated against retention as well
  as training.

## 7. Quality

**Evaluation set — at least 50 questions, and the corpus already contains them.** Draw from the
184 curated FAQs: 20 global, 54 per-service, 40 city, 70 zone. A defensible split:

| Bucket | n | Source |
|---|---|---|
| Serviceability, served localities | 10 | sample `ALL_LOCALITIES` across all 8 cities |
| Serviceability, **not** served | 5 | localities and pincodes deliberately outside the footprint |
| Pricing and plans | 8 | `plans.ts` — every plan, every field |
| Service scope (what is and is not included) | 8 | `services.ts` `tasksIncluded` / `tasksExcluded` |
| Replacement and refund policy | 6 | `/replacement-policy`, `plans.ts:58-60` |
| Verification process | 4 | `/how-we-verify` |
| Booking process | 5 | `GLOBAL_FAQS` |
| Escalation triggers (each of the seven) | 7 | written by hand |
| Hindi/Hinglish variants | 8 | translations of the above, plus `altNames` vocabulary |
| Adversarial | 6 | prompt injection, requests for a discount, requests for card details, a question about a city we do not serve |
| **Total** | **67** | |

**The hallucination check is a hard gate, and it is mechanical.** For every eval question that
touches money or policy, assert that any rupee figure in the answer appears in `PLANS` or a
service pricing band, that any month count matches `termMonths`, that any replacement count
matches `replacements`, and that "60 days" and "3 profiles" match `REFUND_WINDOW_DAYS` and
`REFUND_PROFILE_THRESHOLD`. **A single unsourced number is a failure, not a warning.** This fits
the house test style — source-level and data-driven assertions rather than a component test —
and it belongs in `next-app`'s `tsx --test` suite so CI runs it.

**Metrics.**

| Metric | Definition | Target for a first quarter |
|---|---|---|
| Deflection rate | resolved without a human / total | 50–60% (higher is suspicious — check CSAT) |
| Escalation rate | handed to a human / total | 30–40%, falling as gaps close |
| First response time (human) | escalation → first agent message, in hours | < 5 min in hours; < 1 h into the next window |
| CSAT | thumbs up/down at resolution | > 80% positive |
| Hallucination rate | eval failures on money/policy | **0** |
| Cost per conversation | API spend / conversations | tracked weekly against the ceiling |
| **Lead conversion vs WhatsApp** | chat leads per week vs WhatsApp leads per week | **the number that decides whether WhatsApp moves to secondary** |

### The decision-8 gate, as three queries

WhatsApp is the only working conversion path today, so it does not move to secondary on a
hunch. Decision 8 sets the bar; Initiative 4's interaction record makes each condition a query
over a rolling 4-week window:

| Condition | Query |
|---|---|
| ≥60% of chats resolve without a human | `count(outcome='resolved' AND escalated=false) / count(*)` |
| Escalations get a human reply within 5 minutes **within published hours (10 AM–7 PM Mon–Sat)** | 95th percentile of (first agent message − escalation time), filtered to published support hours |
| Chat leads/week ≥ WhatsApp leads of the preceding 4 weeks | `count(outcome='lead_captured' AND channel IN ('site_chat','app_chat'))` per week vs the WhatsApp baseline |

**The third condition has a measurement problem that must be fixed before the clock starts.**
Today the only WhatsApp signal is a GA4 `whatsapp_click` event fired by the delegated listener
in `components/shared/Analytics.tsx:28-36`. **A click is not a lead.** It records that somebody
tapped the button, not that they sent a message, said anything useful, or converted — and it
misses everyone who messages the business directly. Comparing chat *leads* against WhatsApp
*clicks* would compare a strict measure against a loose one and make the bot look worse than it
is, possibly by a lot.

The fix follows directly from decision 3: **connect WhatsApp to Chatwoot before starting the
4-week measurement.** Then both sides land in the same interaction record, both are counted as
conversations with outcomes, and the comparison is like-for-like. Keep the GA4 click event as a
top-of-funnel measure, but do not use it as the baseline.

This is a sequencing point, not a detail: starting the 4-week window before WhatsApp is in
Chatwoot means the four weeks have to be run again.

## 8. The DPDP compliance review — what landed, and what did not

A DPDP compliance review of the privacy policy was supplied on 2026-09-10. I checked each point
against the actual draft and, where it turned on statutory detail, against the bare Act. **Four
of its eleven points identified real defects and have been fixed. Five criticise things the
draft already did correctly.** Recording both, because a review that is accepted wholesale is
as dangerous as one ignored.

### Landed — fixed

| # | Point | What was actually wrong | Fix |
|---|---|---|---|
| **3** | "Consent; Section 7(a)" is muddled drafting | Correct, and it appeared in **six** rows of the §3.1 table. Section 6 consent and Section 7(a) legitimate use are **alternatives**: 7(a) applies precisely *because* separate consent was not taken. Claiming both is not belt-and-braces, it is an admission that we have not decided | Each row now names one basis. Two rows genuinely rest on consent — sharing details with a Helper the Client chooses to meet, and the aggregate analysis of conversations |
| **3 (statutory detail)** | Tax retention should not be Section 7(c) | **Correct, and more serious than the review said.** I fetched the bare Act: **7(c) is available only to "the State or any of its instrumentalities"** for functions under law, sovereignty or security. A private company cannot rely on it, and the draft cited it **three times**. The review's proposed "7(d) or 7(c)" is half-right | 7(c) removed entirely. **7(d)** (obligation under Indian law to disclose to the State), **7(e)** (compliance with a judgment, decree or order), and **8(7)** (retention required by another law — a retention permission, not a processing basis) |
| **1** | §1.1 asserts GDPR/CCPA status unconditionally | Correct, and internally inconsistent: `counsel-notes.md` already treated the EU/UK representative as conditional while §1.1 declared the company a GDPR controller and a CCPA "business" outright. CCPA has revenue and volume thresholds this business is unlikely to meet | §1.1 now reads "where, and only to the extent that" those laws apply, and says plainly that the paragraph does not extend a foreign law to processing it does not reach |
| **3 / Section 5 notice** | No dedicated notice clause | Fair. The *content* Section 5 requires was spread across §2, §3.2, §8 and §16, which satisfies the substance but makes it hard to demonstrate | New **§3.2**, naming the three places the notice appears and what each must say, with the Section 5(3) language option |

Plus one defect **neither** the review nor the earlier draft caught: §3.1 said *"For Data
Principals in the EU, the UK or California, **Section 14** sets out the corresponding lawful
bases"* — in a paragraph that had just cited "Section 7 of the Act". Section 14 of the **Act** is
the right to nominate. It now reads "Section 14 **of this policy** (not of the Act)".

### Did not land — already addressed in the draft

| # | Point | Why it does not apply |
|---|---|---|
| **6** | "Add access (s.11), nomination (s.14), grievance (s.13) rights" | **All six rights were already in §8.1(a)–(f)**, each with the correct section number: access s.11, correction s.12, erasure s.12, withdrawal s.6, grievance s.13, nomination s.14 |
| **8** | "Grievance redressal needs stronger wording" | **§8.5 already has** the Grievance Officer contact, a 48-hour acknowledgement, a 30-day resolution target, and escalation to the Data Protection Board. §8.6 already cites the s.15 duties |
| **9** | "Helper section should say what is in the dossier, the purpose, whether references are contacted, whether police verification is third-party" | **§11.1–11.6 already covers every one of those**, plus Aadhaar handling (11.4, offline verification only), retention (11.5) and languages (11.6) |
| **10** | "Children's data needs parental consent, age-gating, s.9 restrictions" | **§10.2 already cites DPDP Section 9 by name** and covers parental consent, no tracking, no behavioural monitoring and no directed advertising |
| **11** | "Separate the international rights section" | **§14 is already a separate, clearly headed section** with its own summary. The real version of this concern was point 1, which is fixed |

Point **7** ("deletion is too absolute") was already half-addressed — §8.1(c) carried "unless
retention is required by law" and §8.2 carried the financial carve-out — but the At-a-glance
summary did overstate it, and that has been softened. Point **2** is largely cosmetic, with one
part that does now matter: §2.3 says we collect nothing from files, so **the chat widget must
not offer file upload** unless that sentence changes.

### What this says about using the review

The review's statutory reasoning on Section 7 was its most valuable contribution and it was
still only half right — it proposed 7(d) *or* 7(c) without noticing that 7(c) is closed to
private parties. Its weakest points were confident assertions that the policy omitted things it
had already covered in the correct terms, which suggests it was working from a partial copy.

**Neither the review's approval nor mine is a substitute for counsel.** Everything above is
engineering-side drafting hygiene: correct statutory citations, one basis per purpose, no
overclaimed foreign-law status, and no promise the code does not keep. The commercial judgments
in `counsel-notes.md` §2 — the 45-day refund window, the ₹1,00,000 liquidated damages, the
₹5,000 liability cap, the arbitration clause — were not in scope of this review and remain
where that memo left them.

## Phased plan — Initiative 3

| Phase | Work | Effort | Depends on |
|---|---|---|---|
| C0 | Owner: Chatwoot Cloud subscription (Startups); OpenRouter account with the free-model training opt-out set and $10 of credits | **S** | owner |
| C0 | Owner + counsel: the §B values, then publish the 2.0 documents. **Deferred by decision 2**, so C1–C3 proceed without it; C4 and public launch do not | **XL** (calendar) | owner |
| C1 | Deterministic retrieval layer over the data layer (intent classification, entity extraction, `isServiceable`/`lookupPincode`/`PLANS`/`SERVICES`/`searchFaqs`) + the 67-question eval + the hallucination gate, in CI | **L** | **DONE 2026-09-11** — `lib/assistant/retrieve.ts`, 84-case eval, gate in CI |
| C1 | **Outbound redaction** (phone / email / card-like numbers) between retrieval and the model call, with the unredacted message still stored — decision 17 | **S** | **DONE** — `lib/assistant/redact.ts`, tested |
| C1 | `lib/assistant/provider.ts` adapter + the four-rung degradation ladder, **rung 3 built and tested first**, with the three-assertion rung-3 test — decision 16 | **M** | **DONE** — rung-3 test with all three assertions in `answer.test.ts` |
| C1 | **Rung 0 — the model as reader.** When the rules draw a blank, the model restates the message as a plain question the rules know, and THAT is retrieved; the answer still comes from the data and still passes the number gate. Owner asked for a smarter bot on 2026-09-11 | **M** | **DONE 2026-09-11** — `lib/assistant/understand.ts`, 8 tests; a rewrite may not add a number the customer did not type; personal-detail asks are now also refused by the gate |
| C1 | Server-side `/api/chat` route: streaming, queue for the 20 rpm cap, rate limiting, daily spend ceiling, phrasing cache | **L** | **DONE except the phrasing cache** — `app/api/chat/route.ts`; limits are in-memory per instance |
| C2 | Chatwoot Cloud configured; bot wired as an agent-bot; escalation triggers; out-of-hours capture with the 24-hour promise | **M** | **DONE (code) 2026-09-11** — account 185110, API inbox 136538; an escalation opens the Chatwoot conversation with the transcript (`lib/support/chatwoot.ts`, `handoff.ts`), later messages are forwarded to the person, and the widget polls `/api/chat/replies` for the team's replies (free tier: no webhook needed). Needs the bot token in Vercel and the migrations applied |
| C2 | **Connect WhatsApp to Chatwoot** — prerequisite for the decision-8 baseline | **M** | C0 |
| C2 | Lazy launcher on the site (`Analytics.tsx` pattern, intent-only, no idle timeout) | **M** | **DONE** — `components/shared/AssistantLauncher.tsx`, verified in the browser |
| C2 | **Support hours to 10 AM–7 PM Mon–Sat from one constant** — bot branch, `PricingPage.jsx:207`, terms Annexure B, `v_support_sla` filter. Touches `app/src`, so `npm run build:spa` and commit `public/_spa` | **S** | **DONE** — `data/seo/contact.ts` → site, SPA via serviceability.json, bot |
| C3 | Widget in the booking app with the signed-in session; booking status under the user's JWT | **M** | **DONE (widget + token)**; booking status under the JWT still to build |
| C3 | Lead capture through `/api/lead` | **M** | **Phase 1d** |
| C3 | Scheduled job re-checking the free-model list against OpenRouter's policy data | **S** | C1 |
| C4 | Consent notice live, retention jobs, deletion wired into `delete-account` **and Chatwoot**, privacy policy published | **M** | C0 legal |
| C5 | 4-week measurement against the decision-8 gate; **then** the owner decides on WhatsApp | — | C2 WhatsApp-in-Chatwoot, owner |

## Owner decisions — Initiative 3

Decisions 3, 4, 5, 8, 11, 16, 17 and 18 are taken. What remains:

1. **Transcript retention numbers.** The privacy draft commits to **12 months** for messages,
   **30 days** for an anonymous visitor's browser reference, and non-identifying counts kept
   indefinitely. These are now in a document that will be published — confirm or change them.
2. **Daily spend ceiling** for the paid floor, and confirmation that hitting it should degrade
   to the unphrased answer (rung 3) rather than show an error.
3. **Whether the bot's greeting, refusal wording, escalation message and the widget notice** are
   approved — all four are customer-facing copy, and the widget notice is also the DPDP
   Section 5 notice, so its wording carries legal weight as well as tone.
4. **Whether GDPR or CCPA actually reach the business.** Privacy §1.1 now says those laws apply
   "where, and only to the extent that" they do. If neither reaches MyBuddyMaid, §14 of the
   policy can be deleted outright, which would shorten it considerably. A counsel question.

## Risks — Initiative 3

| Risk | Severity | Mitigation |
|---|---|---|
| The bot states a wrong price or policy term | **High** | Tool-quoted only; hallucination gate in CI; a single unsourced number fails the build |
| WhatsApp retired before the bot is proven | **High** | C5 is measurement, not deployment; the decision is explicitly staged |
| Escalation queue unstaffed, customers wait | Medium *(was High)* | Resolved by decision 11 — published hours cut to 54/week, which one person can cover; out-of-hours capture with the 24-hour promise |
| A customer types their phone number and it reaches a prompt-retaining provider | **High** | Server-side redaction before every model call (decision 17); the widget notice asks as well; privacy §3.6 is deliberately worded not to overclaim |
| A provider silently changes its training terms, making the published policy false | **High** | Scheduled policy re-check that drops the affected model automatically and alerts the same day |
| Published support hours drift between the app, the terms and the SLA view | Medium | One constant, three consumers — the same discipline as `PLANS` and `PURCHASES_PAUSED` |
| Support transcripts leave India via Chatwoot Cloud (US, no region choice) | Medium | Lawful under DPDP today; Supabase holds the authoritative copy; self-hosting is the remedy if transfers are ever restricted |
| Widget breaks the near-zero-JS property | Medium | Intent-only load; measure bundle impact on a locality page before and after |
| Unbounded API spend from abuse | Medium | Rate limits, turn cap, daily ceiling, Turnstile |
| Transcripts become an undeleted PII store | Medium | Retention job + wired into `delete-account` before launch, not after |
| A new `agent` RLS role is written wrong | **High** *(Option A only)* | Choosing Chatwoot avoids it entirely — a real reason to prefer B |

## What must not break — Initiative 3

- **The near-zero-JavaScript property of 2,513 static pages.** Two client components today
  (`AUDIT/01-ARCHITECTURE.md` §3); the launcher adds none.
- **RLS as the only authorisation layer.** Booking status uses the customer's own JWT. No
  service-role convenience reads.
- **WhatsApp keeps working** throughout — the CTAs, the sticky bar, and the paused-checkout
  modal are untouched until the staged decision.
- **The paused-checkout modal is the owner's design.** The bot may link to it; it must not
  replace it.
- **Customer-facing copy needs owner approval** before it is committed — the bot's greeting,
  its refusal wording and its escalation message are all customer-facing copy.
- **The lead path** goes through `/api/lead` with its footprint validation, never a direct
  insert.

---

<a id="initiative-4"></a>

# Initiative 4 — one record of every support interaction

Decision 10. Three channels feed it: the website chatbot (anonymous visitor), the chatbot inside
the web or mobile app (signed-in user), and direct contact with the team on WhatsApp, phone and
email, handled through Chatwoot.

## Recommendation: Supabase is the system of record, Chatwoot is the working surface

The question was Supabase-with-RLS versus Chatwoot-with-a-nightly-export. **Supabase, and not
by a small margin.** Five reasons, in order of weight:

1. **Chatwoot can never hold the whole record.** Only *escalated* conversations reach it. A
   customer who asks about pincode 110016, gets a correct answer and leaves never touches
   Chatwoot — and that conversation is the single most valuable row in the entire dataset,
   because it is a deflection. Making Chatwoot the source means the majority of interactions
   have to be pushed into it and pulled back out, which is strictly worse than writing them
   where they already are.
2. **The analytics require joins Chatwoot cannot do.** "Conversion by locality and service"
   joins the conversation to the 342 localities, the 6 services, `leads`, `bookings` and
   `user_plans` — all in Postgres. A nightly export ends up doing those joins in Postgres
   anyway, one day late.
3. **DPDP deletion is provable with one cascade.** `delete-account` gains one more
   `ON DELETE CASCADE` rather than a cross-system reconciliation. With Chatwoot as source, an
   erasure request is only as complete as last night's export.
4. **The fields wanted are a paid Chatwoot feature.** City, locality, service, plan, intent and
   outcome map to Chatwoot "custom attributes", which is on the **$39** Business tier. Storing
   them in Supabase keeps Chatwoot on **$19** and puts the data where the joins are.
5. **A nightly export means a day of lag** on the one number the owner has said decides
   WhatsApp's future.

**Chatwoot still earns its place** — it is where a person actually answers, on web, WhatsApp,
email and phone, with a mobile app and notifications we are not building. Its conversations
flow *into* Supabase by webhook, not nightly export, so the record is live.

```
  site widget  ─┐
  app widget   ─┼─→  /api/chat  ─→  support_conversations + support_messages  (Supabase)
                │                              ▲
  WhatsApp     ─┤                              │  webhook on every message
  email        ─┼─→  Chatwoot  ────────────────┘  (+ nightly reconciliation as a backstop)
  phone        ─┘
```

The nightly job is kept, demoted to a **reconciliation backstop** — it re-reads the last 48
hours from Chatwoot's API and fills anything a missed webhook dropped. Webhooks fail; a record
that claims to be complete needs a way to prove it.

## Schema — additive migrations

```sql
-- Migration C: the support record. Additive; touches no existing table except
-- delete-account's cascade behaviour, which is inherited from the FK.

CREATE TABLE IF NOT EXISTS support_conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref               text UNIQUE NOT NULL,        -- short, quotable: "MBM-7Q4K2"
  channel           text NOT NULL,               -- site_chat|app_chat|whatsapp|phone|email
  anon_id           text,                        -- browser reference; NULL once linked
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  started_from      text,                        -- page path or app screen
  city_slug         text,
  locality_slug     text,
  service_slug      text,
  plan_key          text,
  topic             text,                        -- classified intent
  escalated         boolean NOT NULL DEFAULT false,
  escalated_at      timestamptz,
  escalation_reason text,                        -- asked_for_human|low_confidence|complaint|
                                                 -- refund|safety|turn_limit|payment
  handled_by        text,                        -- agent identifier
  first_agent_reply_at timestamptz,              -- the 5-minute and 24-hour measurements
  outcome           text,                        -- resolved|lead_captured|booking|dropped|
                                                 -- out_of_hours_message
  lead_id           bigint REFERENCES leads(id) ON DELETE SET NULL,
  booking_id        uuid   REFERENCES bookings(id) ON DELETE SET NULL,
  csat              smallint,                    -- 1..5, null if not given
  device            text,                        -- mobile|tablet|desktop|app_android|app_ios
  language          text,                        -- en|hi|hinglish, detected per conversation
  chatwoot_conversation_id bigint UNIQUE,
  started_at        timestamptz NOT NULL DEFAULT now(),
  last_message_at   timestamptz NOT NULL DEFAULT now(),
  closed_at         timestamptz
);

CREATE TABLE IF NOT EXISTS support_messages (
  id               bigserial PRIMARY KEY,
  conversation_id  uuid NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender           text NOT NULL,                -- customer|assistant|agent|system
  body             text NOT NULL,
  grounded_sources jsonb,                        -- which FAQ/page ids the answer came from
  model_id         text,                         -- which model phrased it, NULL for rung 3
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_sc_user      ON support_conversations (user_id, started_at DESC);
CREATE INDEX ix_sc_anon      ON support_conversations (anon_id) WHERE anon_id IS NOT NULL;
CREATE INDEX ix_sc_analytics ON support_conversations (started_at DESC, channel, outcome);
CREATE INDEX ix_sc_locality  ON support_conversations (city_slug, locality_slug)
  WHERE city_slug IS NOT NULL;
CREATE INDEX ix_sm_conv      ON support_messages (conversation_id, created_at);
```

`grounded_sources` and `model_id` are not decoration: together they answer "why did the bot say
that", which is the first question asked when a customer reports a wrong answer, and `model_id`
being NULL is the signal that rung 3 served the answer.

## RLS — and a deliberate departure from what was asked

The brief said "a person sees only their own; a team role sees all". The first half goes into
RLS. **The second half should not.**

```sql
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages      ENABLE ROW LEVEL SECURITY;

-- A person sees only their own. SELECT only: every write is service-role,
-- exactly as user_plans works today.
CREATE POLICY sc_own ON support_conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY sm_own ON support_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM support_conversations c
     WHERE c.id = support_messages.conversation_id
       AND c.user_id = auth.uid()
  ));
```

**No `team` role in RLS.** The reasoning is the one that runs through this whole survey: RLS is
the entire authorisation layer for this system (`AUDIT/01-ARCHITECTURE.md` §7), the browser
talks to PostgREST directly with a public key, and a role that can read every customer's
support conversations is one policy mistake away from being the worst data exposure this
codebase could have. Meanwhile the team does not need it: **the agent answers in Chatwoot**, and
the analytics are aggregates.

So team access is **server-side, service-role, behind its own authenticated route** — a
Next.js admin route or a scheduled job that emails the weekly report. Same posture as
`/api/lead` (`next-app/app/api/lead/route.ts:49-53`), which already holds the service-role key
server-side and never exposes it. Nothing new is added to the browser's trust boundary.

If a Supabase-native team role is wanted later it is purely additive — but it should arrive with
its own RLS tests in `supabase/__tests__/rls.test.ts` before it is switched on, and it should be
a genuine requirement rather than a convenience.

## Anonymous → signed-in merge

The widget generates a random `anon_id` and keeps it in `localStorage` (30-day life, per the
privacy draft). Conversations are written with `anon_id` set and `user_id` NULL.

On sign-in or sign-up in the same session, the client calls an edge function
`link-support-conversations` with its `anon_id`. The function, running as service-role after
`authenticateCaller` resolves the user from their token (`supabase/functions/_shared/auth.ts`):

```
UPDATE support_conversations
   SET user_id = <caller>, anon_id = NULL
 WHERE anon_id = <presented>
   AND user_id IS NULL
   AND last_message_at > now() - interval '24 hours'
```

Three guards, each doing real work:

- **`user_id IS NULL`** — an already-linked conversation cannot be re-claimed.
- **The 24-hour window** — the authorisation here is *possession of the `anon_id`*, which is a
  secret held only by that browser. That is reasonable for "the same person, moments later" and
  unreasonable as a permanent bearer token. The window bounds the damage if one leaks.
- **Rate-limited per user**, so the endpoint cannot be used to probe for valid `anon_id` values.

This must be an edge function, not a client-side update: a customer must never be able to claim
an arbitrary `anon_id`, and RLS alone cannot express "and you knew the secret".

## Chatwoot ingest

A Chatwoot webhook (`message_created`, `conversation_updated`, `conversation_resolved`) hits a
`chatwoot-webhook` edge function, which upserts on `chatwoot_conversation_id`. Two notes carried
straight over from the payments work, because the same mistakes are available here:

- **Verify the webhook before parsing it.** Chatwoot signs webhook payloads with the account's
  HMAC token; verify over the raw body, exactly as `razorpay-webhook/handler.ts:80-93` does, and
  parse only after.
- **Deploy it with `--no-verify-jwt`** — Chatwoot cannot present a Supabase token. That makes it
  the *third* function with that flag, alongside `razorpay-webhook` and `payu-webhook`, and the
  same warning comment belongs on it.

When a bot conversation escalates, we create the Chatwoot conversation and store its id, so the
two systems are linked from the escalation onward rather than reconciled by guesswork.

## Analytics

All of these are SQL views over `support_conversations`, refreshed on read. None of them
contains message text, a name or a phone number — **aggregate by default, as the brief
requires**, and individual transcripts are opened one at a time in Chatwoot by the person
handling a live conversation.

| View | Question it answers | Shape |
|---|---|---|
| `v_support_top_topics` | What are people actually asking? | `topic`, count, share, 30-day trend |
| `v_support_dropoff` | Where do people give up? | conversations with `outcome='dropped'` bucketed by turn index and by last `topic` — the highest-value view for improving the bot |
| `v_support_escalations` | Why do we need a human? | `escalation_reason`, count, share, median time-to-first-reply |
| `v_support_conversion_by_locality` | Which areas convert? | `city_slug`, `locality_slug`, conversations, leads, bookings, conversion rate — joins to the 342 localities |
| `v_support_conversion_by_service` | Which services convert? | same, by `service_slug` across the 6 services |
| `v_support_demand_by_hour` | When do people need us? | count by hour-of-day × day-of-week in IST — **this is what settles the support-hours question empirically** |
| `v_support_sla` | Are we keeping our promises? | p50/p95 time-to-first-agent-reply, split by in-hours and out-of-hours, against the 5-minute and 24-hour targets |
| `v_support_gate` | Can WhatsApp go secondary? | the three decision-8 conditions over a rolling 4 weeks |

Two of these are worth more than they look. **`v_support_dropoff`** is the improvement engine:
every drop-off is a question the bot answered badly or not at all, and the fix is usually one
new FAQ entry in `data/seo/faqs/` — which improves the bot *and* the 2,513 SEO pages, because
they read the same pool. And **`v_support_demand_by_hour`** turns the staffing question from an
argument into a measurement: if demand collapses after 7 PM, publishing 9 AM–7 PM costs almost
nothing and makes the five-minute promise real.

## The weekly report

A Monday-morning email (Resend is already a sub-processor and already sends transactional mail)
plus the same content on an authenticated admin page. One page, readable in three minutes:

1. **Headline** — conversations this week by channel, versus last week.
2. **The gate** — the three decision-8 numbers, each with a tick or a cross and the 4-week
   trend. This is the top of the report because it is the decision being tracked.
3. **Deflection and escalation** — resolved-without-a-human %, escalation rate, and the
   escalation reasons ranked.
4. **Promises kept** — p95 first reply in hours against 5 minutes; out-of-hours against 24
   hours; the count of anything that breached.
5. **Top 10 questions**, and **top 5 drop-off points** with the topic each one died on.
6. **Demand by hour**, as a small heatmap.
7. **Conversion by locality (top 10) and by service** — the commercial view, and the input to
   "which locality do we open next".
8. **Gaps flagged by the agent** during the week, as a to-do list for the FAQ corpus.

**No message text, no names, no phone numbers in the report.** If a specific conversation needs
attention it is referenced by `ref` and opened in Chatwoot.

## Phased plan — Initiative 4

| Phase | Work | Effort | Depends on |
|---|---|---|---|
| R1 | Migration C: `support_conversations`, `support_messages`, indexes, RLS SELECT policies | **M** | **WRITTEN, NOT APPLIED** — `supabase/migrations/20260911090000_support_conversations.sql`; owner runs `supabase db push` |
| R1 | `/api/chat` writes the record from the first message; `ref` generation | **M** | **DONE** — writes via `after()` once the Supabase variables are set |
| R2 | `link-support-conversations` edge function + the widget's `anon_id` handling | **M** | R1 |
| R2 | `chatwoot-webhook` edge function (signature-verified, `--no-verify-jwt`) + nightly reconciliation | **L** | **RECEIVER DONE** as a Next.js route (`app/api/chatwoot/webhook`, signature-verified); reconciliation is covered for website conversations by the polling pull in `lib/support/handoff.ts`; a nightly sweep for WhatsApp/email conversations is still to build |
| R3 | The eight analytics views + the `v_support_gate` query | **M** | R2 |
| R3 | Weekly report: email via Resend + authenticated admin page | **M** | R3 views |
| R4 | Retention jobs (12-month message deletion, 30-day `anon_id` expiry, roll-up to counts) | **M** | R1 |
| R4 | `delete-account` extended to support conversations **and** the Chatwoot contact | **M** | R2 |

## Risks — Initiative 4

| Risk | Severity | Mitigation |
|---|---|---|
| A `team` RLS role reads every customer's conversations | **High** | Not built — team access is server-side service-role only |
| `anon_id` leaks and is used to claim someone's conversation | Medium | 24-hour window, `user_id IS NULL` guard, rate limit, 30-day expiry |
| Chatwoot webhook missed → an incomplete record we believe is complete | Medium | Nightly reconciliation over a 48-hour window; alert on gaps |
| Erasure request leaves data in Chatwoot | **High** | `delete-account` calls Chatwoot's delete API in the same path; R4 is not optional |
| Transcripts accumulate as an undeleted PII store | Medium | Retention jobs in R4, matching the numbers now written into the privacy policy |
| The record becomes an individual-profiling tool | Medium | Views are aggregates; the report carries no message text; policy §4.6 says so explicitly |

## What must not break — Initiative 4

- **RLS as the only authorisation layer**, with no new role widening it.
- **`delete-account` remains complete.** It is already non-transactional and can leave orphans
  (FIN-S09); adding a fifth system makes remediation task 3.7 more urgent, not less.
- **`razorpay-webhook` / `payu-webhook` / `chatwoot-webhook` are the only `--no-verify-jwt`
  functions**, each authenticated by its own signature.
- **Never `supabase functions deploy` without names** — `send-plan-email` (FIN-S12).


# Sequencing across the four initiatives and the remaining audit phases

## What changed, now that the decisions are in

The previous version of this section said *"start the legal publication today"* — it was the
only item blocking all three initiatives. Decision 2 defers publication until the §B values are
settled, so the constraint has moved rather than disappeared:

- **Legal no longer blocks the chatbot's build**, only its public launch and its consent basis.
  The drafts are now updated and ready to ship in one pass.
- **Legal still blocks the store submission absolutely.** Both stores require reachable,
  accurate policy URLs. Initiative 1 therefore ends behind a gate nobody in engineering can open.
- **Retiring Razorpay removed the rollback**, which raises the stakes on the PayU test-mode run
  and argues for doing payments while attention is on it, not alongside a store submission.

Three things now compete for first place, and they resolve cleanly:

1. **The chatbot attacks the actual bottleneck** — a manual, single-channel conversion path —
   and its cost is now near zero (free models, $19/month of Chatwoot).
2. **Payments unblocks revenue** and, as a side effect, removes `window.Razorpay` from
   Initiative 1's problem list.
3. **Mobile is last on merit**: it reaches an audience that can already reach the site, it needs
   Play Console enrolment and published legal documents, and its two device-level hazards
   (secure storage, the offline-session bug) need real hardware time.

## Recommended order

**Stage 1 — shared prerequisites (2–3 weeks).**

| Work | Why first | Effort |
|---|---|---|
| Owner: settle the §B values so the 2.0 documents can publish | Longest lead time; gates the store submission and the chatbot's launch | **XL** calendar |
| Owner: PayU onboarding + KYC; confirm the merchant entity name | Longest external dependency on the payments side | **XL** calendar |
| Owner: Chatwoot Cloud (Startups) + OpenRouter account, free-model training opt-out set, $10 credits | Unblocks Initiative 3 C1 immediately; costs about ₹2,500 | **S** |
| **Phase 1c batch 2** (FIN-B02, FIN-B09) — CTA context into the app, **link-first** | Already task 1.3; build it as the one entry-point parser mobile reuses | **L** |
| **`_shared/plans.ts` generated from `plans.ts`** (FIN-P05, task 3.2) | Removes three hand-copied tables before PayU would add two more | **M** |
| **`_shared/cors.ts` origin allow-list** | Needed by mobile; harmless now | **M** |
| **Phase 1d** — lead capture | The chatbot's lead path depends on it; FIN-B03 means the first lead 502s until fixed | **L** |
| **SEO measurement (task 2.1)** — start the GSC baseline | 2 hours of work, then a long wait. Starting it late costs weeks later | **S** |

**Stage 2 — chatbot and the interaction record, together (4–6 weeks).**

Initiatives 3 and 4 are one piece of work and should be built as one: the record is written by
the same route that serves the chat, and every analytics view depends on it. Run C1–C3 and
R1–R3 interleaved.

Two ordering points inside the stage:

- **Build rung 3 of the degradation ladder first** — the unphrased, retrieved answer. It is the
  proof that the retrieval layer is correct, and it makes every later rung a wrapper rather than
  a rescue.
- **Connect WhatsApp to Chatwoot before anything else in C2**, because the decision-8 baseline
  cannot be measured until both sides are counted the same way. Starting the four weeks early
  means running them again.

**Stage 3 — payments (3–4 weeks).**

P1–P4, ending with the rewritten checklist and a real PayU webhook event received. **The owner
flips `PURCHASES_PAUSED`.** P6 — decommissioning Razorpay — waits for a settled period on PayU,
not for the flip.

Note the one genuine overlap with Stage 2: the 2.0 terms and privacy policy now name PayU, so
publication should follow PayU onboarding rather than precede it, or the documents name a
gateway that is not yet live.

**Stage 4 — mobile, Android first (5–7 weeks).**

M1–M4, Android only. iOS follows once the Android build is in the store and the device-level
questions (secure storage, offline session) have real answers. Sign in with Apple is built with
iOS, not before.

By this stage the CORS allow-list is done, batch 2 has supplied the deep-link parser, and PayU
has deleted `window.Razorpay` from `PricingPage.jsx` — three of the eleven browser assumptions
resolved by work done for other reasons. **This is the concrete argument for payments before
mobile.**

**Stage 5 — the rest of the audit.**

- **Phase 2**: 2.1 moved into Stage 1. 2.6 (consent and privacy, FIN-S07) merges into the
  chatbot's consent notice — both need a cookie/consent gate and both are described by the same
  policy sections. 2.4 accessibility and 2.5 performance follow; FIN-PF02 partly resolves itself
  when the Razorpay script tag goes.
- **Phase 3**: 3.2 pulled into Stage 1. 3.4 (build the SPA in CI rather than committing it)
  becomes materially more attractive once a mobile build exists, because two consumers of `app/`
  make the committed artifact harder to defend. **3.7 (transactional account deletion) is now
  more urgent than the audit rated it** — `delete-account` has to erase from Supabase, Chatwoot
  and the support tables, and it is already non-transactional (FIN-S09).
- **Phase 4**: unchanged, opportunistic. Note that "publish support hours next to every WhatsApp
  CTA" stops being cosmetic once the terms commit to a 24-hour response.

## Timeline

```
Weeks    1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22
Legal §B ████████                        (owner + counsel — the long pole)
PayU KYC ████████████                    (owner — start now, runs in parallel)
Stage 1  ██████████
GSC      ██·······················       (2 h, then wait)
Bot + R4        ████████████████
  └ 4-wk gate            ████████        (only after WhatsApp is in Chatwoot)
Payments                    ████████████
  └ publish legal              ◆         (after PayU is live, before store submission)
Mobile (Android)                    ████████████████
iOS                                              ████████
Razorpay off                            ◆        (settled period after PURCHASES_PAUSED=false)
```

## The three things that would most change this plan

1. **The support-hours staffing answer.** One person cannot cover 84 hours a week, and decision
   8's five-minute condition is unreachable until that is resolved. It costs nothing to decide
   now and it invalidates the Stage 2 exit criteria if left.
2. **PayU onboarding stalling.** It is the only Stage 3 dependency engineering cannot influence,
   and with Razorpay retired there is no alternative path to revenue. Start it in week 1.
3. **A free model that disappears mid-build.** Two of the ten passing models are already
   labelled preview. The scheduled policy re-check (C3) is what turns this from an outage into
   a notification, and it should be built with the adapter rather than after it.
