# Ship checklist — `seo-rebuild` → `main` → production

One page, in order. Production today still serves the legacy site (`/gurgaon/dlf-phase-1`
404s, `/best-cook-service-in-agra` 200s); nothing built on this branch earns anything
until this list is done. Owner-only items are marked **[owner]**.

## A. Must be true before the merge

| # | Check | How to prove it | State |
|---|---|---|---|
| A1 | `www.mybuddymaid.in` TLS certificate valid | Vercel → Project → Domains: `www` shows a valid cert; `curl -I https://www.mybuddymaid.in` returns 308 to apex | **DONE 2026-09-07** — the domain had never been attached to the Vercel project, so nothing renewed it; re-added as a 308 to apex. Verified `https://www.mybuddymaid.in` → 308 → `https://mybuddymaid.in` → 200, cert valid |
| A2 | Vercel Root Directory = `next-app` | Project Settings → General → Root Directory | done (preview built) |
| A3 | Production env vars set | Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; `MAINTENANCE_MODE` unset; `LEADS_ENABLED` / `NEXT_PUBLIC_LEADS_ENABLED` unset until the `leads` migration is applied. Not required: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (GSC is a DNS-verified Domain property — no meta tag needed). Pending, not blocking: `NEXT_PUBLIC_BING_SITE_VERIFICATION` (Bing will be created by importing from GSC, which needs no tag) | **[owner]** — Supabase vars |
| A4 | `tsc --noEmit` clean, `next build` green | `cd next-app; npx tsx --version; npx tsc --noEmit; npm run build` | done 2026-09-07 on the code at `17d82642`; only docs and `public/` changed since. Vercel rebuilds on merge regardless |
| A5 | `seo:validate` GREEN | `npm run seo:validate` | see §C |
| A6 | `seo:gate` — 0 duplicate pairs, indexable count recorded | `npm run seo:gate` | see §C |
| A7 | `seo:jsonld` GREEN — no AggregateRating / Review / per-locality LocalBusiness | `npm run seo:jsonld` | see §C |
| A8 | No locality carries another locality's coordinates | `npm run seo:geocode` prints `0 rejected as a sibling's point`; the audit in ASSUMPTIONS.md #45 | see §C |
| A9 | Preview deploy of the merge candidate passes `seo:check-redirects` (single-hop 301s, deliberate 410s, 0 chains, 0 loops) | needs the Deployment-Protection bypass secret; PowerShell block in README §5.4 | **GREEN 2026-09-07** against the preview of `1bdf8716` (`mybuddymaid-git-seo-rebuild-…vercel.app`): 1,970 single-hop 301s, 5,696 410s, 0 chains, 0 loops — this is the run that exercises `vercel.json` |
| A10 | Same preview passes `seo:crawl` (0 broken links, 0 orphans, click depth ≤ 3) | same block | **GREEN 2026-09-07**: 2,557 pages, 2,496 indexable expected, 0 broken links, 0 orphans, 0 redirecting internal links, depth ≤ 3 |
| A11 | Booking SPA rebuilt into `next-app/public/_spa` | `node scripts/build-spa.mjs` from the repo root, then `/app/` loads on the preview | done — `_spa` was rebuilt in the same commit as the last `serviceability.json` export (`a31abe5e`) and the bundle carries the 8-city footprint. **Do not rebuild on this machine**: there is no `app/.env`, so a rebuild would inline empty Supabase/Razorpay keys. Rebuild only where the `VITE_*` vars are set, and only after the next `seo:export-spa` |
| A12 | IndexNow key file present in `next-app/public/<key>.txt` | §D — generated and committed | done (`b8604069…`) |
| A13 | `robots.txt` allows crawling and points at `/sitemap.xml` | `curl https://<preview>/robots.txt` | verified on the local build 2026-09-07: `Allow: /`, disallows only `/api/`, `/app`, `/_spa/`, `/maintenance`, `/og` and query-string URLs; `Sitemap: https://mybuddymaid.in/sitemap.xml`. Same file ships to the preview |
| A14 | `entities.json` has 0 `ready` unless their facts are sourced | `npm run seo:stats` shows entity pages = 0 | true today (614 drafts, 0 ready) |

Merge only when every row is true. Nothing in A can be waived by a later fix.

## B. Deploy day, in order — DONE 2026-09-07

Steps 1–3 completed and verified (see §E). Remaining for the owner: step 4 is already
done for Google (DNS Domain property), step 5 (submit `https://mybuddymaid.in/sitemap.xml`
in GSC, then Bing via Import from GSC), and step 7 (watch Coverage; fill the week 1/3/8
table in `rollout-log.md`).

1. Merge `seo-rebuild` → `main` (fast-forward; the branch is linear).
2. Vercel builds production. Confirm `https://mybuddymaid.in/gurgaon/dlf-phase-1` is 200
   and `https://mybuddymaid.in/best-cook-service-in-agra` is **410**.
3. Run the two deployed-site checks against production (no bypass secret needed):
   ```powershell
   cd C:\Users\conta\dev\mybuddymaid\next-app
   $env:BASE_URL = 'https://mybuddymaid.in'
   npm run seo:check-redirects
   npm run seo:crawl
   Remove-Item Env:\BASE_URL
   ```
4. Verify the two search-console properties (§C) — the meta tags are already live.
5. Submit the sitemap index in both consoles (§C).
6. IndexNow (§D).
7. Watch GSC Coverage + the 404 report daily for a week; record indexed counts at weeks
   1, 3 and 8 in `rollout-log.md` (target ≥ 80 % of core pages indexed by week 8).

## C. Verifying Google Search Console and Bing Webmaster Tools

The site already emits both verification meta tags from environment variables
(`next-app/app/layout.tsx` → `metadata.verification`): `google` from
`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, and `msvalidate.01` from
`NEXT_PUBLIC_BING_SITE_VERIFICATION`. You never edit code for this — you set two env vars.

**Google Search Console — VERIFIED 2026-09-07.** A **Domain** property
(`mybuddymaid.in`, covers apex, `www`, http and https), auto-verified through DNS at the
registrar. Because verification is by DNS, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is
redundant and the meta tag is not required — leave the var unset. The property already
holds ~10,486 clicks over 16 months from the legacy site, which is the baseline every
post-cutover number is measured against.

Remaining, after the production deploy: Sitemaps → add
`https://mybuddymaid.in/sitemap.xml` (the index; the shards under `/sitemaps/<shard>.xml`
are discovered from it).

**Bing Webmaster Tools — pending, not blocking.** bing.com/webmasters → Add site →
**Import from Google Search Console**: it copies the verified property and its sitemaps,
so `NEXT_PUBLIC_BING_SITE_VERIFICATION` is very likely unnecessary too. Only if the import
is refused: Add manually → **HTML Meta Tag** → copy the `content` value of the
`msvalidate.01` tag → Vercel env `NEXT_PUBLIC_BING_SITE_VERIFICATION` (Production) →
redeploy → Verify. Then Sitemaps → `https://mybuddymaid.in/sitemap.xml` if the import did
not carry it over.

Do **not** use the Google Indexing API for these pages — it is only for `JobPosting` and
`BroadcastEvent`; misuse risks a manual action. Google finds the pages through the sitemap.

## D. IndexNow — exact sequence

IndexNow reaches Bing, Yandex, Naver, Seznam and Yep in one call. Google does not use it.

**Once, before the merge — DONE 2026-09-06.** The key is
`b860406956ab0b87541f89f1bae98b3b` and the file `next-app/public/b860406956ab0b87541f89f1bae98b3b.txt`
is committed on `seo-rebuild`; after the production deploy it is served at
`https://mybuddymaid.in/b860406956ab0b87541f89f1bae98b3b.txt`. The key is public by
design (IndexNow verifies ownership by fetching that file), so it is safe in the repo.
**[owner]** Add it to Vercel as `INDEXNOW_KEY` (Production) so anyone can run submissions.
To rotate: generate 32 hex chars, `INDEXNOW_KEY=<new> npm run seo:indexnow -- --write-key`,
delete the old file, commit, redeploy.

**After the production deploy:**
```powershell
cd C:\Users\conta\dev\mybuddymaid\next-app
$env:INDEXNOW_KEY = 'b860406956ab0b87541f89f1bae98b3b'
curl.exe -s https://mybuddymaid.in/$env:INDEXNOW_KEY.txt     # must print the key
npm run seo:indexnow                                          # all indexable URLs, ≤10,000 per request
Remove-Item Env:\INDEXNOW_KEY
```
That first run submits every indexable core URL (2,496 today). Expect HTTP 200 or 202.

**First attempt, 2026-09-07, minutes after the deploy:** HTTP 403
`SiteVerificationNotCompleted` — "Site Verification is not completed. Please wait for
some time for the verification to complete and try again." The key file was already
serving 200 with the right content; IndexNow verifies it asynchronously and needs time
after a brand-new host/key. Retry the same command; a 200/202 closes this row.

**After any later deploy that changes content:**
```powershell
npm run seo:indexnow -- --since 2026-09-06     # only URLs with updatedAt on/after the date
```

**After an entity batch goes live:**
```powershell
npm run seo:indexnow -- --batch entities-<city>-<n>   # exactly one sitemap shard
```

Submitting the same URL repeatedly is harmless; submitting a `noindex` URL is pointless
— the script only ever reads `indexablePaths()` from the gate.

## E. What "still green" means, and the last run

Recorded by the session that closes this checklist:

| Check | Result | Where |
|---|---|---|
| `seo:validate` | GREEN — 0 errors, 2,513 metas unique | 2026-09-06, after the geocoding fix |
| `seo:gate` | 2,489 indexable / 24 noindexed / 0 duplicate pairs above 0.60 — 0 verdict flips vs. the pre-fix gate; 282 pages' neighbour text changed | same |
| `seo:jsonld` | GREEN — no AggregateRating / Review / per-locality LocalBusiness | same |
| geocode audit (A8) | 0 localities on a sibling's point; 22 without coordinates (curated neighbours); Sector 150 ↔ Sector 18 link gone | same |
| `seo:crawl` (local `next start`) | GREEN — 2,557 pages crawled, 2,496 indexable URLs expected, 0 broken links, 0 orphans, 0 redirecting internal links, click depth ≤ 3 | 2026-09-07, against the build that carries the geocoding fix |
| `seo:check-redirects` (local `next start`) | GREEN — 1,970 single-hop 301s, 5,696 410s, 0 chains, 0 loops | same |
| production, after the merge (`main` → `3c8718f6`) | live after ~4.5 min: `/gurgaon/dlf-phase-1` 200 · `/best-cook-service-in-agra` 410 · `www` 308 → apex · `/noida/sector-150` 200 · `robots.txt`, `sitemap.xml`, IndexNow key file 200 · `check-redirects` GREEN (1,970 / 5,696 / 0 chains) · `crawl` GREEN (2,557 pages, 0 broken, 0 orphans) | 2026-09-07 |
| `seo:crawl` / `seo:check-redirects` (preview) | both GREEN — see A9/A10. One wrapper fix was needed first: `_fetch.ts` also sent `x-vercel-set-bypass-cookie`, which Vercel answers with a 307 to set the cookie, and with `redirect: 'manual'` the scripts read that 307 as the site's response. The bypass header alone is stateless and returns 200; the cookie request is gone | 2026-09-07 |
