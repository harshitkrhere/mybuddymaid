# Paid search and click-to-WhatsApp — the playbook, prepared, not launched

Generated 2026-09-14 by `npm run growth:playbooks`. **No campaign runs until the owner sets a
test budget and a per-city daily cap** (growth brief §11; decision 6 in the plan). Everything
below is ready to paste.

## Geography (the locality lock, enforced in the ad account)

- `ads/geo-targets.csv` — the 267 pincodes we serve, with city, tier and the
  localities behind each. Target these, and **exclude** the rest of each metro region and
  state so a lead from an unserved suburb never reaches the team (an unfulfillable lead is
  a conversation the team still has to have).
- `ads/negative-keywords.csv` — 34 cities we do not serve (from the legacy
  site's city list), 19 job-seeker terms (the largest source of
  wasted spend in this category: helpers searching for work), and 17
  unrelated meanings of "maid".

## Structure

### Meta — click-to-WhatsApp (the best fit for a WhatsApp-first funnel)

- One campaign per Tier-1 city (Delhi, Noida, Gurgaon, Mumbai, Pune, Bangalore), objective **Engagement →
  Messaging apps → WhatsApp**, optimised for *conversations started*, never link clicks or reach.
- Ad sets by service (Full-Time Maid, Part-Time Maid, Cook, Babysitter / Nanny, Elder Care, Domestic Help); the WhatsApp greeting names the
  service and city, exactly as the site's CTAs do
  (`Hi MyBuddyMaid, I need a {service} in {City}.`).
- Geo: the city's pincodes from `geo-targets.csv`, radius 0; exclude the rest of the state.
- Run 5–7 days at the test cap before judging; then move budget toward the city with the
  lowest cost per conversation **that became a booking** (the weekly report's Bookings
  column by city), not the lowest cost per click.

### Google Search

- One campaign per Tier-1 city; ad groups per service; exact and phrase match on the
  tracked keyword set for that city (`docs/seo/keywords.csv`, `city` column), transactional
  intent only ("hire", "near me", "{service} in {locality}").
- Landing page = the service × city page (`https://mybuddymaid.in/services/{service}/{city}`) — it carries
  the WhatsApp and call CTAs above the fold and is indexable; with robots.txt no longer
  blocking query strings (branch `growth/seo-fixes`), `?gclid=` landing URLs are crawlable
  and Ads will stop flagging "destination not crawlable".
- Call extension and WhatsApp (message) asset on every ad; final URL suffix carries
  `utm_source=google&utm_medium=cpc&utm_campaign={city}-{service}`, which the site now stores
  and passes to the lead form (branch `growth/tracking`).
- Local Services Ads: check eligibility for this category in India when the account is
  opened; if eligible, the verification badge is worth the paperwork.

### Retargeting

The single highest-value audience is anyone who clicked WhatsApp, call or "Book in the app"
and did not become a lead or booking within 48 hours. Building it needs a Meta Pixel and a
Google Ads tag, and **both wait for the consent gate (audit task 2.6) and a privacy-policy
amendment** — the policy names its providers, so this is a legal step before a technical one.

## Conversions

- Import the GA4 events as conversions: `whatsapp_click`, `call_click` (top of funnel),
  `lead_submit` (a lead, once Phase 1d is on), and — the ones that count — the booking
  request and confirmed booking, which are only in Supabase today. Until a server-side
  conversion upload exists, judge campaigns weekly against the report's Leads and Bookings
  columns per city, not against the ad platform's own counts.
- Cost per confirmed booking, blended, is the only number that decides the budget.

## Ad copy — DRAFT, needs the owner's approval

| Service | Headline | Description (from the data layer) | Trust line |
|---|---|---|---|
| Full-Time Maid | Verified Full-Time Maid in {City} | A dedicated helper for 8–12 hours a day (or live-in) who handles all daily household cho | Identity-verified helpers · replacement policy · book on WhatsApp |
| Part-Time Maid | Verified Part-Time Maid in {City} | Task-based help for 1–4 hours a day — sweeping-mopping, utensils, dusting and laundry on | Identity-verified helpers · replacement policy · book on WhatsApp |
| Cook | Verified Cook in {City} | A home cook for one or more daily meal slots, matched to your cuisine and diet preferenc | Identity-verified helpers · replacement policy · book on WhatsApp |
| Babysitter / Nanny | Verified Babysitter / Nanny in {City} | Trained childcare help for infants, toddlers and school-age children — including japa/po | Identity-verified helpers · replacement policy · book on WhatsApp |
| Elder Care | Verified Elder Care in {City} | Non-medical companionship and daily assistance for senior citizens at home — mobility su | Identity-verified helpers · replacement policy · book on WhatsApp |
| Domestic Help | Verified Domestic Help in {City} | An all-rounder housekeeping helper — cleaning, utensils, laundry and dusting combined, p | Identity-verified helpers · replacement policy · book on WhatsApp |

Plans as an offer line: Silver ₹4,999 one-time, 3 replacements over 10 months · Gold ₹5,999 one-time, 5 replacements over 12 months · Diamond ₹6,999 one-time, 10 replacements over 18 months.
Do not claim "100% police verified" — the site's own wording is "police verification on Gold
and Diamond plans"; an ad may not promise more than the plan delivers.

## Budget gate

Before the first rupee: the test cap per city per day, the total test budget, and the date
of the first review are written into `docs/growth/changelog.md` by the owner. The weekly
report then carries cost per conversation and cost per booking per city from the ad exports
(a manual CSV until an API connection is worth building).
