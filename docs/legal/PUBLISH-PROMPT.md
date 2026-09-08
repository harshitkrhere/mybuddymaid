# Publishing the 2.0 legal documents — session prompt

A paste-ready prompt for putting the 2.0 Terms of Service and Privacy Policy on the live
site in a fresh session, once the company values are known.

**How to use it**
1. Fill in **§B — Values** below. Leave a row blank to accept its fallback.
2. Start a new session in `C:\Users\conta\dev\mybuddymaid`.
3. Paste **§A** and your filled-in **§B** together as the first message.
4. Answer the session's questions. It will stop before committing legal text and before
   pushing; both need your explicit go.

Written 2026-09-08, after Phase 1a batch 2. §C records what was already done by then.

---

# §A — The prompt

> Copy everything between the rules, then paste your filled-in §B under it.

---

You are publishing the version 2.0 Terms of Service and Privacy Policy for MyBuddyMaid, a
domestic-helper placement service. The documents were drafted on 2026-09-08 and reviewed in
`docs/legal/drafts/counsel-notes.md`. Your job is to apply the values I give you in §B,
render both documents onto the live pages, and stop for my approval before anything is
committed or pushed.

**Read before writing any code**

- `docs/legal/drafts/terms-of-service.md` and `docs/legal/drafts/privacy-policy.md` — the
  text to publish. Bracketed tokens like `[LEGAL ENTITY NAME]` are variables from §B.
- `docs/legal/drafts/counsel-notes.md` — what each clause depends on. Section 3 lists facts
  the privacy policy asserts that must be true on publication day; Section 4 lists the
  decisions §B answers; Section 5 lists every variable.
- `AUDIT/20-IMPLEMENTATION-PROMPT.md` — read the parts headed "Repo facts you must not get
  wrong", "Stop and ask me before" and "Checks that must pass before every commit". They
  apply to this session unchanged. Three sub-projects, three deploy paths; the booking app
  under `app/` is a committed build artifact; edge functions deploy by name only.
- `docs/legal/drafts/legal-pages-design.md` — the target layout. **Do not build it in this
  session** unless I say so in §B; the default is the existing `TrustPage` shell.

**Session-opening checks.** Run these and tell me the results before editing:

```
git rev-parse --abbrev-ref HEAD            # branch off main as fix/legal-2.0-publish
git status --short                         # must be clean; if not, stop and ask
git log --oneline -20                      # confirm the sign-up consent checkbox and the
                                           # FIN-U03 wording were committed (see §C)
cd next-app && npx tsc --noEmit && npm test
cd app && npm test
npx supabase projects list                 # gives the Supabase region for the privacy policy
grep -rn "consent\|cookie" next-app/components/shared/Analytics.tsx next-app/components/shared/Footer.tsx
```

The last line tells you whether the analytics consent gate exists. If it does not, that is
Step 0 and it comes before any legal text.

**Step 0 — make the privacy policy's claims true.** The 2.0 privacy policy says (Section 9)
that Google Analytics loads only after the visitor accepts analytics cookies, that a
"Cookie preferences" link in the footer reopens the choice, and that a Global Privacy
Control signal is honoured. Audit finding FIN-S07 describes the fix: in
`components/shared/Analytics.tsx`, send `gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied'})`
before anything loads, show a small consent notice on first visit, load gtag only on
accept and send `gtag('consent','update',…)`, store the choice for 12 months, treat
`navigator.globalPrivacyControl === true` as decline, and add the footer link. Umami,
Vercel Analytics and Speed Insights are cookieless and keep running. Keep the site's
near-zero-JavaScript approach: the notice is a small inline script, no dependency. Test it
in the browser at both states. Commit it on its own, citing FIN-S07, before touching the
legal pages.

Also confirm from §B that a Grievance Officer is named, and read the Supabase region from
the CLI. If any of the privacy policy's Section 3 preconditions in the counsel's notes is
still false and cannot be made true in this session, remove the sentence that asserts it
and tell me which sentence you removed.

**Step 1 — apply §B to the drafts.** Replace every bracketed variable in both Markdown
drafts with the value from §B, and apply the decisions: refund processing days (ToS 7.7 and
Annexure B), refund processing fee (Annexure B), liquidated damages and restricted period
(ToS 10.1, 10.3, Annexure B, and the At-a-glance bullet), the Silver refund test (ToS 7.2),
session fee (ToS 8.2 and Annexure B), arbitral institution (ToS 17.3), GST wording (ToS
4.5 and Annexure A), call recording (ToS 14.3: delete the sentence if "no"), helper
consent-form languages (Privacy 11.6), and the EU/UK representative sentence (Privacy
14.1(a): delete it unless a representative is named). Set the effective date on both
documents and the "Supersedes" lines. Write a test that fails if any `[` … `]` variable
remains in either draft, and run it.

**Step 2 — render onto the site.** Put the 2.0 text into
`next-app/app/terms-of-service/page.tsx` and `next-app/app/privacy-policy/page.tsx` inside
the existing `TrustPage` shell, exactly as `/about` and `/replacement-policy` use it. Keep
the section numbering and headings; render each draft's "In plain English" summary as a
short paragraph under its heading; render tables with `<div className="table-wrap">` as
`/pricing` does. Every plan number — fees, terms, replacement counts, profile counts, the
60-day window and the 3-profile threshold — must be interpolated from `data/seo/plans.ts`
(`PLANS`, `REFUND_WINDOW_DAYS`, `REFUND_PROFILE_THRESHOLD`), never typed as literals; this
closes audit finding FIN-C01. Then:

- rewrite the Refunds paragraph on `next-app/app/replacement-policy/page.tsx` to a one-line
  summary that links to the terms, so the rule is stated in one place;
- update the metadata descriptions, the "Last updated" line and the version line on both
  pages;
- set the `lastmod` for both pages in `lib/seo-engine/sitemaps.ts` `TRUST_PAGES` to the
  publication date;
- save the superseded August 2026 text of both pages, taken from git, under
  `docs/legal/archive/` with their dates, so a "previous versions" page can be built later;
- add a data-driven test in `next-app/lib/__tests__/` asserting that the rendered terms
  contain the plan fees and counts from `plans.ts` and the effective date, and that no
  bracketed variable survives in either page.

**Step 3 — the booking app.** Confirm `app/src/pages/AuthPage.jsx` links its consent
checkbox to `/terms-of-service` and `/privacy-policy` and that no in-app copy of the terms
exists (the old `TermsPage.jsx` was deleted in Phase 1a). Nothing in `app/src` should need
to change; if it does, rebuild with `npm run build:spa` from the repo root and commit
`next-app/public/_spa` in the same commit.

**Step 4 — show me before committing.** Run the checks in `AUDIT/20-IMPLEMENTATION-PROMPT.md`
("Checks that must pass before every commit"). Then open both pages on the dev server, tell
me the URLs, and paste the two rendered "At a glance" blocks and the refund clause into the
chat. This is customer-facing legal text: **do not commit until I say so.** When I approve,
commit on the branch with a message citing FIN-C01, FIN-C02 and FIN-S07, and stop. Do not
push; do not open a PR; do not deploy any edge function. Nothing in this work touches
`supabase/functions/`.

**After I merge**, Vercel builds the site. Then check the live pages: `curl -s
https://mybuddymaid.in/terms-of-service | grep -c "\["` must return 0 for bracketed
variables, the version line must show 2.0 and the effective date, `sitemaps/global-core-1.xml`
must carry the new `lastmod`, and the sign-up page's links must open the new text. Remind
me that existing account holders are owed the 15-day notice email the terms promise in
Section 1.6; that email is my task, not yours.

**Working agreement.** Small batches; show me each step's result; report honestly,
including anything you removed or could not make true; ask before every production-mutating
step, individually. If something in my data or dashboard looks wrong, ask me before
investigating.

---

# §B — Values

> Fill in the second column. A blank row takes the fallback.

| # | Value | Your answer | Fallback if blank |
|---|---|---|---|
| 1 | Legal entity name and type (e.g. "… Private Limited", sole proprietorship, LLP) | | Cannot publish |
| 2 | Registration number (CIN, firm registration, or "none") | | Cannot publish |
| 3 | GSTIN, or "not registered" | | Cannot publish |
| 4 | Plan fees inclusive or exclusive of GST | | Inclusive |
| 5 | Grievance Officer: full name | | Cannot publish |
| 6 | Mailboxes: grievance@, privacy@, refunds@, legal@ mybuddymaid.in, or "info@ for all" | | info@ for all |
| 7 | Refund processing time, in business days | | 45 as briefed; counsel recommends 10 |
| 8 | Refund processing fee (percentage or rupees) | | 10% of the plan fee |
| 9 | Direct-hire liquidated damages, in rupees | | ₹1,00,000 as briefed; counsel recommends ₹14,000–₹21,000 |
| 10 | Non-solicitation period, in months | | 24 as briefed; counsel recommends 12 |
| 11 | Silver refund test: "3 profiles in 60 days for every plan" or "the plan's own profile count" | | 3 for every plan, as published today |
| 12 | Interview or trial session fee, in rupees, or "none" | | None |
| 13 | Arbitral institution: Arbitration Centre – Karnataka, or Bangalore International Mediation, Arbitration and Conciliation Centre | | Arbitration Centre – Karnataka |
| 14 | How Aadhaar is verified today: offline QR scan, masked copy, photocopy kept, other | | Cannot publish the privacy policy |
| 15 | Are calls recorded: yes / no | | No; the sentence is removed |
| 16 | Languages for the helper consent form | | English and Hindi |
| 17 | Are invoices kept outside the app (accounting software, Razorpay dashboard): yes / no | | Assumed yes |
| 18 | Effective date (at least 15 days out) and whether to email existing users | | 15 days after publish, with the email |
| 19 | EU or UK representative, if you market there | | None; the sentence is removed |
| 20 | Layout: "TrustPage shell" (default) or "build the split-screen layout from the design spec" | | TrustPage shell |
| 21 | Has a lawyer reviewed the drafts: yes / no | | Recorded in the commit message either way |

---

# §C — State when this prompt was written (2026-09-08)

- Both legal pages were moved into the `TrustPage` shell in commit `56654dd9` (FIN-B01,
  FIN-SEO04); their text is still the August 2026 version.
- The 2.0 drafts, the counsel's notes and the layout spec are in `docs/legal/drafts/`. A
  review page showing them in the proposed layout is at
  https://claude.ai/code/artifact/9549feb1-517a-450d-94fb-4f6e1f813bc9.
- The booking app's sign-up form has a required consent checkbox whose label links to
  `/terms-of-service` and `/privacy-policy` in a new tab; the in-app `TermsPage.jsx` and its
  `/terms` route were deleted. At the time of writing that change and the FIN-U03 wording
  ("Request received" and four `send-booking-email` subjects) were implemented and tested
  but not yet committed, pending the owner's approval of the wording. The session should
  confirm from `git log` that both were committed before it starts.
- Recording each user's consent (timestamp and document version) is not implemented; it
  needs a column on `profiles` and a migration, and is a separate decision.
- Findings this work closes when finished: FIN-C01 (contradictory refund terms), FIN-C02
  (terms describing a payment flow that does not run), FIN-C06/FIN-S07 (privacy policy gaps
  and the consent gate). The sign-up checkbox and the deleted in-app terms page also close
  the "reconcile /app/terms with /terms-of-service" item in the audit's content notes.
