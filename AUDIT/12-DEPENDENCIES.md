# 12 — Dependencies

No upgrades were performed. Versions below are read from the lockfiles; advisories are from
`npm audit` run in each project on 2026-09-08.

## next-app

**29 production dependencies, 385 dev, 452 total.**

```
next                     16.3.0
react / react-dom        19.2.8
@supabase/ssr            0.12.4
@supabase/supabase-js    2.112.2
@vercel/analytics        2.0.1
@vercel/speed-insights   2.0.0
lucide-react             1.30.0
-- dev --
@anthropic-ai/sdk        0.124.0
zod                      4.5.4
tsx / typescript / eslint / eslint-config-next
```

**`npm audit`: 1 high, 0 critical, 0 moderate, 0 low.**

| Package | Severity | Advisory | Assessment |
|---|---|---|---|
| `nanoid` | high | custom generators can loop indefinitely when size is zero | **Transitive, dev-only.** Not reachable from any production code path. Resolve with `npm audit fix` at the next routine maintenance; no urgency. |

### Observations

- **`@supabase/ssr` and `@supabase/supabase-js` are production dependencies of `next-app`
  but are never imported by it.** `grep -rn "@supabase" next-app/app next-app/lib
  next-app/components` returns nothing — `/api/lead` deliberately uses raw `fetch` against
  PostgREST (a good choice: it avoids shipping a client for one insert). These two packages
  are dead weight in the dependency tree. **Remove them**, or if they are being kept for a
  planned server-side Supabase integration, note that in the package.json.
- **`lucide-react` 1.30.0 is a production dependency of `next-app` and is also never
  imported.** The site uses hand-written inline SVG (`components/home/HomeIcons.tsx`) —
  which is the better choice and is documented as deliberate in `ASSUMPTIONS.md` #47. Another
  removable production dependency.
- **`@anthropic-ai/sdk` and `zod` are correctly dev dependencies**, used only by
  `scripts/seo/draft-copy.ts` and `scripts/seo/validate.ts`. Correct placement — they do not
  reach the bundle.
- **No unnecessary UI framework.** No Tailwind, no component library, no CSS-in-JS runtime.
  81 KB of hand-written CSS across nine files. For a site of this size that is the right call
  and a meaningful part of why the pages are fast.

## app (booking SPA)

```
react / react-dom        19.2.6
react-router-dom         7.15.1        ← runtime, shipped to users
react-router             7.15.1        ← runtime, shipped to users
@supabase/supabase-js    2.106.0       ← runtime
lucide-react             1.16.0        ← runtime
@vercel/speed-insights   2.0.0         ← runtime
-- dev --
vite                     8.0.13
@vitejs/plugin-react     6.0.1
eslint 10 / globals 17
```

**`npm audit`: 6 high, 1 moderate, 1 low, 0 critical.**

| Package | Severity | Runtime-affecting? | Assessment |
|---|---|---|---|
| **`react-router` / `react-router-dom` 7.15.1** | high / moderate | **YES — shipped in the bundle** | Five advisories. Four are SSR/RSC-only (`deserializeErrors` constructor injection, RSC hydration XSS, RSC-mode CSRF, RSCErrorHandler protocol validation) and **do not apply** — this is a client-only `BrowserRouter` with no SSR. Two are potentially relevant: **open redirect via backslash in `<Link>`/`useNavigate` (CVE-2025-68470 bypass)** and **unauthenticated DoS via inefficient route matching**. The open redirect needs a user-controlled navigation target; this app has none (every `<Link>`/`navigate()` target is a hard-coded literal — verified). So the practical exposure today is **nil**, but this is the one dependency worth upgrading on its merits rather than for hygiene. |
| `vite` 8.0.13 | high | no — build only | `server.fs.deny` bypass on Windows; launch-editor NTLMv2 hash disclosure. Both affect the **dev server**, not the built artifact. Relevant to developers on Windows (this machine is Windows), not to production. Worth upgrading for developer safety. |
| `postcss` | high | no — build only | Path traversal via `sourceMappingURL` when reading source maps at build time. |
| `browserslist` | high | no — build only | OOM via unbounded cache / prototype write from untrusted `browserslist-stats.json`. Not applicable — no custom stats file. |
| `brace-expansion` | high | no — build only | ReDoS/OOM. Transitive through the tooling. |
| `@babel/core` | low | no — build only | Arbitrary file read via `sourceMappingURL`. |

**Summary:** 6 of the 8 advisories are build-time only and do not affect any user. One
(`react-router-dom`) ships to users but has no reachable exploit path in this application's
code. **None of these are emergencies.** They should be cleared at the next maintenance pass
so the audit signal stays meaningful — a project that has learned to ignore `npm audit`
output will ignore the one that matters.

## Cross-project observations

### [FIN-DEP01] Two Supabase client versions, two React installs, one product

**Severity:** LOW · **Confidence:** CONFIRMED

`@supabase/supabase-js` is 2.112.2 in `next-app` and 2.106.0 in `app`; React is 19.2.8 and
19.2.6. Two lockfiles, two `node_modules`, no workspace linkage. The edge functions pin a
third version implicitly: `https://esm.sh/@supabase/supabase-js@2` — an **unpinned major
range**, so every cold start of every function may resolve a different patch or minor
release than the last.

That last one is the real risk: an `esm.sh@2` specifier means a Supabase minor release can
change the behaviour of your payment verification function with no deploy on your side.

**Fix:**
1. Pin the edge functions to an exact version: `https://esm.sh/@supabase/supabase-js@2.112.2`.
   This is a one-character-class change across six files and removes an entire category of
   "it broke and we changed nothing".
2. Adopt npm workspaces at the repo root so `app` and `next-app` share a lockfile and a
   single React/Supabase resolution.

### [FIN-DEP02] No Node version pinned anywhere

**Severity:** LOW · **Confidence:** CONFIRMED

No `engines` field in any `package.json`, no `.nvmrc`, no `.node-version`, and no explicit
Node version in `vercel.json`. Vercel picks its current default, which changes over time.
Builds are therefore not reproducible across time or across machines.

**Fix:** add to both `package.json` files:
```json
"engines": { "node": ">=22 <23" }
```
and a matching `.nvmrc`. Vercel reads `engines` and will pin the build image accordingly.

### [FIN-DEP03] `public/_spa` is linted as source

**Severity:** LOW · **Confidence:** CONFIRMED

`npx eslint` in `next-app` reports **1,259 problems (119 errors)**. Of those, **54 errors and
1,137 warnings come from a single file**: `public/_spa/assets/index-BXK52Lnq.js`, the minified
SPA bundle. The eslint config's `globalIgnores` does not exclude `public/`.

The remaining 65 errors are all in source, and all but one are the same rule:

```
@next/next/no-html-link-for-pages   64 errors   (Header.tsx 31, Footer.tsx 30, SeoPage.tsx 3)
react/no-unescaped-entities          1 error    (app/maintenance/page.tsx)
```

The `no-html-link-for-pages` errors are **deliberate** — `CtaButtons.tsx:1-5` explains that
plain `<a>` elements are used specifically to avoid a client boundary and the associated
hydration cost across 2,513 pages. That is a defensible architectural decision, and the
performance benefit is real. But leaving it as 64 lint *errors* means `npm run lint` can never
be a CI gate, so lint provides no protection at all.

**Fix:**
```js
// eslint.config.mjs
globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/**"]),
{ files: ["components/shared/*.tsx", "components/seo/*.tsx"],
  rules: { "@next/next/no-html-link-for-pages": "off" } }   // deliberate: see CtaButtons.tsx
```
Fix the one `react/no-unescaped-entities` error properly. Then `npm run lint` exits 0 and can
be gated in CI.

## Recommended upgrades — documented, not performed

Ordered by value. None is urgent.

| # | Change | Why | Risk |
|---|---|---|---|
| 1 | Pin `esm.sh/@supabase/supabase-js@2` → `@2.112.2` in all six edge functions | Removes silent third-party drift in payment code | none |
| 2 | `npm audit fix` in `app/` | Clears 8 advisories, mostly build-time | low; verify the build after |
| 3 | Remove `@supabase/ssr`, `@supabase/supabase-js`, `lucide-react` from `next-app` prod deps | Three unused production dependencies | none — verified unimported |
| 4 | `npm audit fix` in `next-app/` | Clears the `nanoid` advisory | none |
| 5 | Add `engines` + `.nvmrc` to both projects | Reproducible builds | none |
| 6 | Ignore `public/**` in eslint, disable `no-html-link-for-pages` where deliberate | Makes lint gateable | none |
| 7 | Adopt npm workspaces | Single lockfile, single React resolution | medium — touches both build setups; do it when there is time to verify |
