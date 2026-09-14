# Google Business Profile — service-area business setup

Generated 2026-09-14 by `npm run growth:playbooks` from `next-app/data/seo`. Everything here is a
field to fill or a step to take in the GBP dashboard; nothing is created automatically.

## 1. The profile

| Field | Value | Note |
|---|---|---|
| Business name | MyBuddyMaid | exactly this — no "Verified maids" suffix, no city; GBP suspends keyword-stuffed names |
| Phone | +91 93551 14869 (+919355114869) | the one number on every surface; the legacy site published +91 95993 90188 — hunt down and correct any directory that still shows it |
| Website | https://mybuddymaid.in | apex, https, no trailing slash |
| E-mail | info@mybuddymaid.in | |
| Address | 175, 5th Floor, Main Road, Chandra Layout, Bengaluru 560040 | registered office, **not a walk-in centre** (the contact page says so) — set the profile up as a **service-area business and hide the address**; a shown storefront customers cannot visit is the classic suspension trigger |
| Hours | Mon–Sat, 10 AM–7 PM IST | the published support hours (Terms §14.4); mark special hours for public holidays |
| Opening date | 2021 | |
| Social | https://www.instagram.com/mybuddymaid, https://www.facebook.com/mybuddymaid | the same profiles the site's Organization schema names |

**Category.** Pick the primary category from GBP's own list by searching "domestic" / "home help";
choose the one that describes a domestic-help service, and do **not** pick "Employment agency"
(MyBuddyMaid is a marketplace, not an employer — the brief's own rule) or "House cleaning
service" (that says the company cleans; it places helpers). Add secondary categories for
child care and elder care if the list offers them. Record the exact category chosen here.

## 2. Service areas (20 allowed — these, in this order)

1. Delhi, Delhi
2. Noida, Uttar Pradesh
3. Greater Noida, Uttar Pradesh
4. Gurgaon, Haryana
5. Mumbai, Maharashtra
6. Pune, Maharashtra
7. Bangalore, Karnataka
8. Mangalore, Karnataka
9. Noida Central, Noida
10. South Delhi, Delhi
11. Noida Expressway, Noida
12. Western Suburbs, Mumbai
13. DLF & Golf Course Road, Gurgaon
14. South Mumbai, Mumbai
15. Sohna Road & South City, Gurgaon
16. New Gurgaon, Gurgaon
17. West Delhi, Delhi
18. North West Delhi, Delhi
19. South West Delhi, Delhi
20. Central Pune, Pune

Only cities and zones from the data layer. If GBP will not match a zone name, use the city.
Nothing outside this list — a Hyderabad or Chennai area on the profile would draw calls we
cannot fulfil (`docs/growth/expansion-candidates.md` is where that demand is logged).

## 3. Services (the "Services" tab)

| Service | Description | Price shown |
|---|---|---|
| Full-Time Maid | A dedicated helper for 8–12 hours a day (or live-in) who handles all daily household chores. | from ₹16,000 to ₹26,000 a month (helper's salary, indicative) |
| Part-Time Maid | Task-based help for 1–4 hours a day — sweeping-mopping, utensils, dusting and laundry on a fixed daily slot. | from ₹4,500 to ₹9,000 a month (helper's salary, indicative) |
| Cook | A home cook for one or more daily meal slots, matched to your cuisine and diet preferences. | from ₹10,000 to ₹18,000 a month (helper's salary, indicative) |
| Babysitter / Nanny | Trained childcare help for infants, toddlers and school-age children — including japa/postnatal support for newborns and mothers. | from ₹14,000 to ₹24,000 a month (helper's salary, indicative) |
| Elder Care | Non-medical companionship and daily assistance for senior citizens at home — mobility support, meals, medication reminders and company. | from ₹15,000 to ₹25,000 a month (helper's salary, indicative) |
| Domestic Help | An all-rounder housekeeping helper — cleaning, utensils, laundry and dusting combined, part-time or full-time. | from ₹5,000 to ₹19,000 a month (helper's salary, indicative) |

Add each of the three plans as a service too, priced at the one-time platform fee:
- **Silver plan** — ₹4,999 one-time, 10-month replacement cover, 3 verified profiles
- **Gold plan** — ₹5,999 one-time, 12-month replacement cover, 4 verified profiles, police verification
- **Diamond plan** — ₹6,999 one-time, 18-month replacement cover, 5 verified profiles, police verification

## 4. Description — DRAFT, needs the owner's approval before it is pasted (750-character limit)

> MyBuddyMaid connects households with verified maids, cooks, babysitters and nannies,
> elder-care helpers and domestic help across Delhi, Noida, Greater Noida, Gurgaon, Mumbai, Pune, Bangalore, Mangalore. Every
> helper is identity- and address-verified and interviewed before placement; every plan
> includes a replacement policy. Tell us your locality and the service you need on WhatsApp
> and we shortlist helpers who already travel there.

## 5. Q&A seeds (already-published answers from the site — safe to post as the owner)

**Q: What does MyBuddyMaid do?**
MyBuddyMaid connects households with verified domestic helpers: full-time and part-time maids, cooks, babysitters and nannies, elder-care attendants and all-rounder domestic help. You share your requirements, matching helpers are shortlisted, and you interview and trial before confirming. The service is available in Delhi NCR, Mumbai, Pune, Bangalore and Mangalore.

**Q: How do I book a helper?**
You can reach out on WhatsApp, call the helpline, or book through the app. Share the service you need, your locality, preferred timings and any specific requirements such as language or cuisine. Matching profiles are then shortlisted and interviews or a trial are arranged with you.

**Q: Are the helpers verified?**
Yes. Every helper's documents are checked and background verification is completed before they are placed with a household. Helper details are kept on record, and you can ask about a profile's verification status before the interview.

**Q: What if the helper leaves or does not work out?**
A replacement policy is in place across all services. If a helper leaves, is irregular, or the fit is not right, you can raise a replacement request and a new profile is matched to your original requirements. The specific terms are shared with you at the time of booking.

## 6. Weekly posts — a rotation built from the guides that already exist

One post a week, 150–300 words, one photo, one link to the guide or the city hub. Cycle:

1. Complete Guide to Domestic Help in Bangalore (2026) → https://mybuddymaid.in/blog/domestic-help-guide-bangalore-2026
2. Complete Guide to Domestic Help in Delhi (2026) → https://mybuddymaid.in/blog/domestic-help-guide-delhi-2026
3. Complete Guide to Domestic Help in Gurugram (2026) → https://mybuddymaid.in/blog/domestic-help-guide-gurugram-2026
4. Complete Guide to Domestic Help in Mumbai (2026) → https://mybuddymaid.in/blog/domestic-help-guide-mumbai-2026
5. Complete Guide to Domestic Help in Noida (2026) → https://mybuddymaid.in/blog/domestic-help-guide-noida-2026
6. Complete Guide to Domestic Help in Pune (2026) → https://mybuddymaid.in/blog/domestic-help-guide-pune-2026
7. How to Find a Reliable Maid in Delhi NCR in 2026 → https://mybuddymaid.in/blog/find-reliable-maid-delhi
8. How to Hire a Cook for Your Indian Home — Types, Cost & Tips → https://mybuddymaid.in/blog/hiring-cook-for-indian-home-guide
9. Swiggy/Zomato vs Hiring a Cook — The Real Cost Comparison → https://mybuddymaid.in/blog/swiggy-vs-home-cook-cost-comparison
10. Maid vs Cook — Which Should You Hire First? → https://mybuddymaid.in/blog/maid-vs-cook-which-to-hire
11. When Should You Hire a Nanny? — A Guide for New Indian Parents → https://mybuddymaid.in/blog/when-to-hire-nanny-for-baby
12. Nanny vs Daycare in India — Complete 2026 Comparison → https://mybuddymaid.in/blog/nanny-vs-daycare-india

Then the six Tier-1 city hubs (https://mybuddymaid.in/delhi, https://mybuddymaid.in/noida, https://mybuddymaid.in/gurgaon, https://mybuddymaid.in/mumbai, https://mybuddymaid.in/pune, https://mybuddymaid.in/bangalore) and repeat.

## 7. Photos

Monthly: one real photo per category — the team (with consent), a helper onboarding session
(with consent, faces optional), the office, a service in progress in a customer's home (with
the customer's written consent). No stock images: GBP down-ranks them and customers can tell.

## 8. Reviews

- Target: 2–4 genuine reviews a month per active city. Ask only after a booking is active
  or completed (the Supabase status), never before placement and never for a fee, voucher
  or discount — an incentivised review breaches Google's policy and is a removal risk.
- Reply to every review within 48 hours; a complaint gets a reply that names the fix.
- Message to send with the review link — DRAFT, needs the owner's approval:
  > Thank you for booking with MyBuddyMaid. If your helper has started well, a short
  > Google review helps other families in {locality} find verified help: {review link}.
  > If anything is not right, reply here first and we will fix it.
- Automation of the ask (from the booking record) waits for WhatsApp inside Chatwoot; until
  then it is a manual step in the ops routine.

## 9. NAP consistency

The name, address and phone above must be byte-identical on every listing: Justdial, Sulekha,
IndiaMART, UrbanPro or any directory that carries the business, plus Instagram and Facebook.
Check each for the old number (+91 95993 90188) and the old "12,000+ families / 4.9 rating"
claims the site removed (ASSUMPTIONS.md #47) — a listing that still makes them contradicts
the site.
