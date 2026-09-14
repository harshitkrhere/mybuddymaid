# Growth changelog — what shipped, week by week

Hand-kept. The Monday report (`reports/latest.md`) links here for "what changed this week";
the numbers are the report's job, the causes are this file's. One line per shipped change,
newest week first, with the lever it was meant to move.

## Week of 2026-09-14 (branch `growth/week-1`, awaiting the owner's merge)

- Measurement pipeline (`next-app/lib/growth`, `next-app/scripts/growth`, three workflows):
  Search Console, GA4, Bing and database snapshots; the daily URL Inspection census; the
  weekly report and the baseline; the `growth-alert` issue. Lever: a baseline to move against,
  per the brief's rule that nothing is optimised before it is measured. Waits on the owner's
  service account and API keys (README §"One-time setup").
- Tracking completeness: the footer, header and contact-page links, the chat widget's three
  moments and the booking app's five moments (sign-up started, onboarding completed, booking
  requested, paused-checkout modal shown, its buttons) all reach GA4, with `source` site/app;
  UTM and ad click ids are captured and travel with the lead form. Lever: the funnel from a
  location page to a booking request becomes one report, and an ad or referral visitor is no
  longer indistinguishable from everyone else.
- The booking app's home page loses the invented "4.9 rating", "12K+ families" and "24hr
  deployment" figures. Lever: none directly; it removes a trust liability the site had
  already removed.
- robots.txt no longer blocks query-string URLs (every ad landing URL) or the OG image
  endpoint; OG images are signed instead. Lever: paid landing pages become crawlable and
  every shared link gets its image.
- Guides linked both ways: each locality and service page links its city guide and a
  matching guide; each guide lists the places it applies to; hub-page nearby anchors rotate;
  snippets name neighbours properly. Lever: the six existing Tier-1 city guides start passing
  authority to the hubs beneath them instead of hanging off the header.
- Off-site playbooks generated from the data layer (`docs/growth/gbp.md`, `backlinks.md`,
  `sem.md`, `ads/*.csv`). Lever: the Google Business Profile, the first backlinks and a paid
  test can start the day the owner decides, inside the footprint by construction.
