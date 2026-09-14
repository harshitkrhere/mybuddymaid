# Growth measurement — how the numbers are made

The growth brief's first rule is "baseline first": nothing is optimised against a number
nobody measured. This directory holds that measurement — a weekly report per city, a daily
index census, and the raw snapshots they are composed from — plus the playbooks that come
later in the plan. Everything under `docs/growth/` is written by scripts in
`next-app/scripts/growth/`; the pure logic and its tests live in `next-app/lib/growth/`.

```
docs/growth/
  README.md                 this file
  baseline.md               the first real numbers (written once with --baseline)
  reports/<date>.md         the Monday report, one per week; latest.md is a copy
  expansion-candidates.md   demand recorded for cities we do not serve — logged, never actioned
  alerts.json               what the last weekly run flagged
  changelog.md              hand-kept: what shipped each week (the report links to it)
  data/gsc/<date>.json      Search Console: per-city and per-page-type metrics, tracked keywords, sitemap health
  data/ga4/<date>.json      GA4: CTA clicks by city/locality/service, organic sessions by geo
  data/bing/<date>.json     Bing: pages in index, clicks/impressions, top queries, feeds
  data/supabase/<date>.json signups, booking requests, chats, leads — counts only
  data/inspection/ledger.json  one URL Inspection verdict per indexable URL (the census)
  data/weekly/<date>.json   the small summary each report was built from (trend lines)
```

Every snapshot carries two adjacent 7-day windows ("this week" and "last week") ending three
days before the run, because Search Console data is final about three days after the fact.
A source that did not report shows as `n/a` in the report with the reason; nothing is ever
estimated, and no snapshot ever contains a name, a phone number or a message.

## What runs when

| Job | Schedule (IST) | Does |
|---|---|---|
| `growth-daily.yml` | 07:47 daily | inspects 400 due URLs with the URL Inspection API (never-inspected first, then oldest) and commits the ledger — the whole 2,533-URL estate roughly weekly, inside the 2,000/day quota |
| `growth-weekly.yml` | Monday 08:17 | pulls Search Console, GA4, Bing and the database counts, composes `reports/<date>.md`, commits it, crawls production (`seo:crawl`) and samples the redirect map (`seo:check-redirects`), then opens or updates the `growth-alert` issue if anything failed or a threshold tripped |
| `growth-monthly.yml` | 1st, 09:03 | opens a `growth-freshness` issue listing the top-traffic pages whose data-layer facts are older than 90 days |
| `npm run release:batch -- <shard>` | after a deploy that released a sitemap shard | IndexNow for the shard plus a Bing sitemap re-submission; Google reads the sitemap index on its own (the Indexing API is deliberately not used) |

The workflows commit under `docs/growth/**` only — the commit step fails if anything else is
staged — and use `[skip ci]`. Failure e-mails go to the person who committed the workflow
files, so the owner should be that committer.

Alert thresholds (in `lib/growth/report.ts`, tested): Google PASS census −10 % week over
week · Bing InIndex −10 % · Bing 5xx > 1 % of crawled pages · any sitemap shard with errors or
pending > 7 days · census freshness < 80 % · Tier-1 clicks −30 % when last week had ≥ 50 ·
more than 10 leads waiting in `new` for over 24 h · a `www` host receiving impressions.

## One-time setup (owner)

1. **Google Cloud** — create a project (or reuse one), enable the *Search Console API*, the
   *Google Analytics Data API* and the *Google Analytics Admin API*; create a service account
   and download its JSON key.
2. **Search Console** — Settings → Users and permissions → add the service account's
   `client_email` as a **Full** user on `sc-domain:mybuddymaid.in`. Full, not Restricted: the
   URL Inspection API refuses Restricted users.
3. **GA4** — Admin → Property access management → add the same e-mail as **Editor** (needed once,
   for step 6), note the numeric property id (Admin → Property settings, or
   `npm run growth:ga4 -- --list-properties`).
4. **Bing Webmaster Tools** — finish the import from Search Console (that verifies the site),
   then Settings → API access → generate an API key.
5. **GitHub** — Settings → Secrets and variables → Actions → add `GSC_SERVICE_ACCOUNT_JSON`
   (the whole key file's JSON), `GA4_PROPERTY_ID`, `BING_WEBMASTER_API_KEY`, `SUPABASE_URL`
   and `SUPABASE_SERVICE_ROLE_KEY` (the last two already exist for the RLS job).
6. **Register the GA4 dimensions** once: `npm run growth:ga4:register`. GA4 can only break an
   event down by a parameter that is registered as an event-scoped custom dimension, and
   registration is not retroactive, so CTA clicks by city exist only from 24–48 hours after
   this run. Record the date here: **registered on: _(not yet)_**. Then downgrade the service
   account to Viewer.
7. Run the two workflows once by hand (Actions → *Growth — daily index census* → Run workflow
   with cap `25`; then *Growth — weekly report* with `baseline` ticked) and read
   `reports/latest.md`. Reconcile any GA4 geo city listed as "unmapped" into
   `lib/growth/ga4.ts` before trusting the per-city session column.

## Running locally (PowerShell)

```powershell
cd C:\Users\conta\dev\mybuddymaid\next-app
$env:GSC_SERVICE_ACCOUNT_JSON = 'C:\keys\mbm-growth.json'
$env:GA4_PROPERTY_ID = '123456789'
$env:BING_WEBMASTER_API_KEY = '<key>'
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://<ref>.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = '<sb_secret_...>'
npm run growth:inspect -- --cap 25          # smoke test: 25 URLs into the ledger
npm run growth:gsc                          # window ends three days ago; --end YYYY-MM-DD to pick one
npm run growth:ga4                          # --metadata lists the dimensions the property exposes
npm run growth:bing
npm run growth:supabase
npm run growth:report -- --baseline         # composes the report; --baseline writes baseline.md once
Remove-Item Env:\SUPABASE_SERVICE_ROLE_KEY, Env:\BING_WEBMASTER_API_KEY
```

Every script accepts `--end YYYY-MM-DD`; `GROWTH_DIR` redirects all output (useful for a dry
run), `GROWTH_RAW_DIR` dumps raw API responses (the workflows keep them as artifacts for 90
days, never in the repo).

### Without API access

`growth:report` composes from whatever snapshots exist. With none it still writes a report
and a baseline in which every column reads `n/a — source not connected`, so the file
structure and the Monday habit start before the credentials arrive. Search Console's own UI
export (Performance → Export) can be read into a snapshot by hand if access is delayed; ask
before building that path, it should not be needed.

## Reading the report

- **Cities** — one row per city, Tier 1 first. "Indexed (PASS)" is the census count of URLs
  whose URL Inspection verdict is PASS; it is the only honest indexed number (the Sitemaps
  API's `indexed` field is deprecated). "Top-20 kw pos" is the mean position of the tracked
  keywords that had impressions, with seen/tracked beside it; "—" in the keyword table means
  no impressions were recorded, not zero.
- **On target** — the tracked keyword's top-ranking URL is the one `docs/seo/keywords.csv`
  assigns. A **no** is a cannibalisation signal worth a look.
- **Funnel** — site-wide, top to bottom: organic sessions → WhatsApp/call/app clicks → chats →
  leads → signups → booking requests → bookings active or completed. A click is not a lead;
  the lead and booking rows are the ones that pay.
- **Demand outside the footprint** — queries naming a city we do not serve. It goes to
  `expansion-candidates.md` and nowhere else.
- **Alerts** — the same list the `growth-alert` issue carries.

## The census, in more detail

`data/inspection/ledger.json` keeps one entry per indexable URL: verdict, coverage state,
indexing state, robots state, fetch state, last crawl time, Google's chosen canonical, and the
previous verdict when it changed. Entries are written one per line, sorted by path, so a
day's commit is a readable diff. A URL that leaves the estate is marked `retired` and kept.
The weekly report tabulates coverage states verbatim ("Crawled – currently not indexed" and
the like) rather than interpreting them; the decision on the content gate (audit task 2.2)
is taken from that table at the week-3 review, not by the pipeline.
