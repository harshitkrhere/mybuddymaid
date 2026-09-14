# Baseline — week ending 2026-09-11

Recorded 2026-09-14T18:51:15.860Z from the first weekly growth run. This file is not regenerated; later reports show deltas against it. Every value is a measurement; where a source was not connected the cell says so rather than carrying an estimate.

| Metric | Baseline | 90-day target | 180-day target | Source |
|---|---|---|---|---|
| Indexable pages (data layer) | 2533 | | | `allIndexableUrls()` |
| Indexed pages, Google (PASS census) | 6 | | | URL Inspection API |
| Indexed pages, Bing (InIndex) | 3306 | | | Bing Webmaster API |
| Impressions, all cities | 42537 | | | Search Console |
| Clicks, all cities | 2398 | | | Search Console |
| Organic sessions | 0 | | | GA4 (Organic Search channel) |
| WhatsApp / call / app clicks | 0 / 0 / 0 | | | GA4 events |
| Chat conversations (escalated) | 12 (8) | | | support_conversations |
| Leads | 0 | | | leads table |
| Signups | 186 | | | profiles |
| Booking requests (active or completed) | 81 (0) | | | bookings |
| Session → WhatsApp/call click rate | n/a | | | derived |
| Click → signup rate | n/a | | | derived (all clicks, not only organic) |
| Signup → booking request rate | 43.5% | | | derived |
| Cost per WhatsApp conversation (ads) | n/a — no paid campaign | | | Meta / Google Ads |
| Cost per confirmed booking | n/a — no paid campaign | | | derived |

## Per-city baseline

| City | Tier | Indexable | Indexed (PASS) | Impressions | Clicks | Avg pos | Top-20 kw pos (seen/tracked) | Organic sessions | WhatsApp | Call | App | Chats | Leads | Booking requests |
|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|
| Delhi | 1 | 602 | 0 | 729 (new) | 33 (new) | 9.6 | n/a (0/20) | 0 | 0 | 0 | 0 | 0 | 0 | 5 (-50%) |
| Noida | 1 | 413 | 0 | 161 (new) | 5 (new) | 22.5 | 81.0 (1/20) | 0 | 0 | 0 | 0 | 0 | 0 | 2 (new) |
| Gurgaon | 1 | 367 | 0 | 445 (new) | 19 (new) | 21.1 | 61.3 (1/20) | 0 | 0 | 0 | 0 | 0 | 0 | 2 (new) |
| Mumbai | 1 | 371 | 0 | 559 (new) | 10 (new) | 15.0 | 58.0 (1/20) | 0 | 0 | 0 | 0 | 1 (new) | 0 | 2 (new) |
| Pune | 1 | 228 | 0 | 503 (new) | 16 (new) | 9.0 | 126.0 (1/20) | 0 | 0 | 0 | 0 | 0 | 0 | 3 (new) |
| Bangalore | 1 | 226 | 4 | 443 (new) | 12 (new) | 14.5 | 23.0 (1/20) | 0 | 0 | 0 | 0 | 0 | 0 | 6 (new) |
| Greater Noida | 2 | 92 | 0 | 165 (new) | 7 (new) | 10.6 | n/a | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Mangalore | 2 | 182 | 0 | 300 (new) | 23 (new) | 6.8 | n/a | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Caveats

- None recorded.

## Setting targets

Targets are city-specific and tier-weighted (Tier-1 cities carry the tighter ones) and are agreed at the first Monday review after this baseline, once the census has covered the whole estate at least once. A blank target cell means "not yet set", never "zero".
