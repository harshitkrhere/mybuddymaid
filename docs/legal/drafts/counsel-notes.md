# Counsel's notes on the drafts

Version: review memo accompanying Terms of Service 2.0 and Privacy Policy 2.0 (drafts)
Effective date: not applicable
Supersedes: none

## At a glance

- These drafts were produced by an AI system acting on a brief. They are not legal advice and must be reviewed by an advocate enrolled with a State Bar Council before publication. The brief asked for "bulletproof" terms; the most protective terms are the ones a consumer commission will actually enforce, so several requested clauses were drafted in their most defensible form rather than verbatim.
- The brief describes an on-demand cleaning marketplace. MyBuddyMaid is a placement service: a one-time plan fee, the household employs the helper and pays the salary directly, and the remedy for a failed placement is a replacement. Every slot-based rule in the brief was mapped onto interviews, trials and placements. Terms that describe a flow the business does not run are exactly the defect the audit recorded as FIN-C02.
- Three requested provisions carried real enforceability risk as specified: the 45-business-day refund timeline, the liquidated-damages figure, and reporting customers to credit bureaus. **All three are now resolved** (2026-09-10): the credit-bureau clause was removed, damages set at ₹21,000, the refund commitment reduced to 14 Business Days to initiate, and the Restricted Period cut from 24 months to 12. Every High-risk row in the enforceability register has been closed.
- The privacy policy states facts that must be true on the day it goes live: a consent gate for analytics, a named Grievance Officer, the Aadhaar-handling method, and — added 2026-09-10 — the five promises the support assistant makes in Privacy 3.6. **None of those is true today.** The Supabase region is now known (Sydney, Australia) and filled.

## 1. How the brief was mapped onto the real service {#mapping}

> **Summary:** Where the brief assumed per-visit cleaning slots, the drafts substitute the equivalent event in a placement: the interview, the trial, the 60-day matching window, and the plan term.

| Brief | What the draft says | Why |
|---|---|---|
| "Service Provider/Cleaner" as independent contractor | Helper defined as an independent individual; the Client is responsible, as between the parties, for the terms on which the Helper works (ToS 2.2 to 2.4), with ToS 2.3.1 stating that this allocation does not bind a court or authority | Matches the published model, where the household pays the salary. Household responsibility is the strongest insulation available; "independent contractor of the platform" would imply the platform contracts for the work, which it does not. **Softened on 2026-09-10 from "employer for every purpose" — see Section 7.** A contract can allocate responsibility between its parties; it cannot decide how a labour authority characterises the relationship |
| Refund claims within 4 hours of service completion, with time-stamped photos | Refund claim window: days 61 to 75 after payment (ToS 7.4). Incident reports (damage, theft, misconduct) within 48 hours with time-stamped photographs and a police complaint where an offence is alleged (ToS 7.5) | There is no "service completion" event in a placement. The published refund test is a 60-day matching window, so the claim window sits after it. Incidents are replacement grounds, not refund grounds, and a 4-hour window for a household to document a theft would be attacked as an unreasonable condition |
| Denial grounds: cleaner denied entry, no water or electricity, client approved verbally | Kept, adapted to interviews and placements (ToS 7.3(e) to (g)), with seven further grounds | The requested grounds fit; the added grounds close the gaps a placement model actually sees: hires, unresponsiveness, changed requirements, promotional plans |
| 100% non-refundable fee for cancellation inside 24 hours of a slot | Late cancellation or no-show for a confirmed interview or trial uses one of the plan's profile introductions, and forfeits any session fee (ToS 8.2); reciprocal protection when the Company or Helper cancels late (ToS 8.4) | No per-slot fee exists today; the profile allowance is the real currency. The Consumer Protection (E-Commerce) Rules, 2020 do not permit cancellation charges on consumers unless the entity bears similar charges when it cancels, so the reciprocal clause is not optional |
| Late cancellation applies to "bookings" | A cancelled plan is not refundable beyond Section 7 (ToS 8.1) | A booking request costs nothing and creates no plan |
| Class-action waiver, New Delhi venue | Individual proceedings with a severability fallback (ToS 17.6); seat Bengaluru (ToS 17.3) | Registered office is Bengaluru and the existing terms already say so; the brief allowed the primary corporate city |
| "Credit bureaus" for chargeback abusers | Evidence to the gateway and card network, recovery of the amount and fees, police report, fraud-prevention services "to the extent permitted by law" (ToS 13.2) | See Section 2.6 below |

## 2. Enforceability register {#register}

> **Summary:** Ranked by the chance that a consumer commission or arbitrator reads the clause out of the contract. High means expect it to be cut down; Medium means it holds with the carve-outs drafted; Low means it holds.

### 2.1 Refund processing time: **resolved — 14 Business Days to initiate** {#refund-time}

> **Resolved 2026-09-10.** The owner reduced this from forty-five Business Days to **fourteen**, close to the ten this note recommended, and changed the commitment from "credited" to "initiated" — which is the more honest promise, because settlement to the instrument is the gateway's to control, not ours. ToS 7.7 now says we initiate within 14 Business Days, will give the gateway reference on request, and that the credit thereafter depends on the bank. **The risk in this row is retired.** One follow-up: once PayU confirms its own settlement window, consider stating the expected total, because a consumer who reads "14 days" and is paid on day 21 will still complain.

Forty-five Business Days is roughly nine calendar weeks. The current published terms promise seven business days, and an Indian card or UPI gateway typically settles a refund to the customer's instrument within about five to seven working days, so the delay is not a processing necessity and will be read as one. (Confirm PayU's stated refund settlement window against the merchant agreement before publication; the argument does not depend on the exact figure, but the number quoted to a customer should be one we can stand behind.) Under the Consumer Protection Act, 2019, a term that imposes "any unreasonable charge, obligation or condition which puts such consumer to disadvantage" is an unfair contract term (Section 2(46)), and the District, State and National Commissions can declare such a term null and void (Sections 49(2) and 59(2)). Separately, a customer who is told to wait nine weeks will raise a chargeback with their bank, whose dispute window is 120 days; the chargeback clause in ToS 13 is then fighting a dispute the refund timeline provoked. The processing-fee deduction and the strict eligibility test already give the business the protection it needs. Ten Business Days keeps a buffer over the gateway's timeline and is defensible.

### 2.2 Liquidated damages for direct engagement: **resolved — ₹21,000** {#liquidated-damages}

> **Resolved 2026-09-10.** The owner set the figure at **₹21,000**, the top of the range
> recommended below and almost exactly three times the Diamond fee (3 × ₹6,999 = ₹20,997).
> ToS 10.3 now states the multiple and its components on the face of the clause, expressly
> preserves Section 74, and adds ToS 10.3.1 — a household may regularise by buying the Diamond
> Plan for that Helper instead. That last point is the one that turns the clause from punitive
> into commercial, and it is what an arbitrator is most likely to look at.
>
> **Also resolved:** the Restricted Period was cut from 24 months to **12** on 2026-09-10,
> adopting the recommendation in the second paragraph below. Together with the reduced sum and
> the regularisation route in ToS 10.3.1, the restraint-of-trade exposure under Section 27 is
> now as low as this clause can reasonably be drafted.

The original analysis, retained because the reasoning still governs the clause:

Section 74 of the Indian Contract Act, 1872 allows a party to recover "reasonable compensation not exceeding the amount so named", whether or not actual loss is proved, but the Supreme Court has held repeatedly that the named sum must be a genuine pre-estimate of loss and that a sum fixed in terrorem is a penalty which the court will reduce to the loss actually suffered (Kailash Nath Associates v. Delhi Development Authority, 2015). One lakh rupees against a platform fee of ₹4,999 to ₹6,999 is fourteen to twenty times the contract value, and the Company's demonstrable loss from a bypass is the fee it did not receive plus its verification cost. Expect an arbitrator to award something near a plan fee and to treat the clause as evidence of overreach when reading the rest of the contract.

Two further points. Section 27 of the Contract Act voids agreements in restraint of trade; the clause is drafted to bind only the Client and to permit the continuation of a placement (ToS 10.2, 10.5), which is the strongest available position, but an argument that it indirectly restrains the Helper's livelihood remains open. And the 24-month Restricted Period runs from the last introduction or placement, which is long by Indian standards for a consumer contract; twelve months would be safer.

Recommendation: state the sum as two to three times the Diamond fee (₹14,000 to ₹21,000), or, better commercially, as a "direct-engagement fee" equal to the Diamond fee plus a fixed amount, so that a household that bypasses the platform can regularise by paying for the plan it should have bought. The draft leaves the amount as the variable in Annexure B so this is a single decision.

### 2.3 Limitation of liability at the lesser of ₹5,000 or the fee: Medium risk {#liability-cap}

The cap is drafted as instructed (ToS 11.1) with the carve-outs the law requires (ToS 11.5). Two observations. First, the structural protection is not the cap but Section 2: because the household is the employer, claims for theft, damage or injury caused by a Helper lie against the Helper and not the Company, and the cap only has to hold for the Company's own conduct. Second, for the Company's own negligence a consumer commission is unlikely to hold a consumer to ₹5,000; the same unfair-term provisions in Section 2.1 above apply. Keep the cap, expect it to bind in arbitration and to be disregarded for the Company's own fault before a consumer forum, and do not rely on it in place of professional-indemnity insurance.

A time bar on bringing claims was deliberately left out. Since the 1997 amendment, Section 28 of the Contract Act voids a term that extinguishes a right or discharges a liability on the expiry of a specified period. ToS 11.6 asks for prompt notification without extinguishing anything.

### 2.4 Mandatory arbitration and the consumer carve-out: Medium risk, drafted to hold {#arbitration}

An arbitration agreement in a consumer contract is valid, but the Supreme Court has held that a consumer may still elect the consumer commissions and cannot be compelled to arbitrate (Emaar MGF Land Ltd. v. Aftab Singh, 2018; M. Hemalatha Devi v. B. Udayasri, 2023). ToS 17.5 records that election expressly. Without it the arbitration clause would itself be attacked as an unfair term, and its presence costs the Company nothing, because the consumer already has the right.

The appointment mechanism matters. A clause that lets the Company appoint the sole arbitrator, or lets a person interested in the dispute do so, is invalid (Perkins Eastman Architects v. HSCC (India), 2019; Central Organisation for Railway Electrification v. ECI-SPIC-SMO-MCML (JV), 2024, Constitution Bench). ToS 17.3(a) therefore provides for appointment by agreement, failing which by an arbitral institution. Name the institution before publication; two Bengaluru options are given as the variable.

The class-action waiver (ToS 17.6) has limited work to do in India: Section 35(1)(c) of the Consumer Protection Act, 2019 allows numerous consumers with the same interest to complain jointly, and no contract removes that. It is drafted "to the fullest extent permitted by law" with a severability fallback, which is what makes it useful for users in jurisdictions where such waivers are enforced, and harmless here.

### 2.5 Reciprocity for cancellations: Low risk once drafted, High if removed {#reciprocity}

The Consumer Protection (E-Commerce) Rules, 2020 prohibit an e-commerce entity from imposing cancellation charges on a consumer unless similar charges are borne by the entity when it cancels unilaterally. ToS 8.4 and 8.5 supply the reciprocal commitment. If the business does not want to refund a session fee when a Helper fails to attend, it cannot charge one when the household does.

### 2.6 Reporting chargeback abusers to credit bureaus: removed {#credit-bureaus}

> **Critical:** A merchant cannot furnish information to a credit information company, and saying so in a contract is a misrepresentation.

Under the Credit Information Companies (Regulation) Act, 2005 only "credit institutions" (banks, non-banking financial companies and similar specified entities) furnish credit information to CIBIL, Experian, Equifax and CRIF, and only about credit facilities. MyBuddyMaid is neither. A term threatening a credit-bureau report is unenforceable, is a false statement to a consumer, and invites a complaint of unfair trade practice. The draft replaces it with what the Company can actually do: contest the dispute with evidence, recover the sum and fees, suspend the account, report suspected fraud to the police, and share transaction information with the gateway and payments-industry fraud services to the extent the law permits.

### 2.7 Indemnity: Low risk, one caution {#indemnity-note}

The indemnity (ToS 12) is drafted broadly and will hold between the parties. It cannot transfer the Company's own statutory duties. If any operating State regulates private placement agencies for domestic workers, those duties are the Company's. Delhi does, under the Delhi Private Placement Agencies (Regulation) Order, 2014, which requires registration with the Labour Department; confirm the position in each State in the footprint. The Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013 extends to domestic workers, which is why ToS 9.3 names it: it is the household's obligation, and the household should know it.

### 2.8 Safety withdrawal: Low risk {#safety-note}

ToS 9.4 is drafted as instructed and is one of the more valuable clauses commercially: it protects Helpers, which is consistent with the brand's verification-first positioning, and it gives the Company a clean basis to decline replacement cover where the household caused the failure.

## 3. Facts the documents assert that must be true on publication day {#preconditions}

> **Summary:** A policy that describes controls the site does not have is worse than a thin one. These are the statements to make true, or to remove, before the effective date.

- **Analytics consent gate.** Privacy Policy 9.2 says Google Analytics loads only after consent and that a Cookie preferences link sits in the footer. Today GA4 loads unconditionally and no such link exists (audit finding FIN-S07; remediation Phase 2, task 2.6). Ship the consent gate first, including Google consent-mode defaults and support for the Global Privacy Control signal that 9.4 promises to honour.
- **Grievance Officer.** Both documents name a Grievance Officer with an email and address. The E-Commerce Rules, 2020 and the Intermediary Guidelines, 2021 require a named individual, and the DPDP Act requires a published contact for grievances. Appoint the person and create the mailbox before publication.
- **Where the database lives.** Privacy Policy 4.2 and 5.2 state the Supabase project region. Read it from the Supabase dashboard (Project Settings, General) and fill the variable. The Umami Cloud region is a second variable.
- **Aadhaar handling.** Privacy Policy 11.1 and 11.4 state that identity validation uses offline verification and that Aadhaar numbers are neither stored nor published. After the Supreme Court's 2018 judgment in Puttaswamy, a private entity may not require Aadhaar authentication, and the offline-verification route is the compliant one. Confirm the current practice with the operations team; if Aadhaar numbers are being copied and filed, that is a practice to change, not a sentence to soften.
- **Deletion versus financial records.** The app's Delete My Account function removes the profile, bookings, plan rows and email logs and deletes the login. Privacy Policy 6 and 8.2 say financial records are kept for eight years in a restricted archive. That archive is the payment gateway's transaction ledger and the Company's own invoices and books, not the app database. Confirm that invoices are issued and retained outside the app so the statement is true. **Note the gateway change:** the ledger for plans sold before the switch is Razorpay's and for plans sold after it is PayU's, so the eight-year archive spans two providers. Both must remain reachable for the full period, which means the Razorpay merchant account cannot simply be closed when the code is retired.
- **The payment gateway named throughout is PayU.** Every clause naming a gateway was updated on 2026-09-10 following the decision to switch completely from Razorpay. Do not publish until PayU onboarding is complete and the merchant entity name is confirmed — the drafts say "PayU Payments Private Limited", which must be checked against the merchant agreement, as Razorpay's entity name differed from its brand name too.
- **The support assistant's claims.** Privacy Policy 3.6 makes five testable promises: the assistant looks answers up rather than inventing them; prices and policy terms are inserted exactly as published; no account data (name, contact number, address, bookings, payment details) is sent to the model provider; **telephone numbers, email addresses and card-like numbers are stripped from the user's own message on our servers before it leaves**; and only providers who do not train on our inputs are used. All five are engineering commitments. The fourth is the one added after review — the first draft claimed no personal data reached the model, which was false, because people type their phone number into a chat box unprompted. The fifth depends on an OpenRouter account setting. Verify all five against the shipped code before the effective date, and do not publish 3.6 ahead of the bot.
- **The assistant's providers are named in the policy, not on a separate page.** Privacy 4.2 lists OpenRouter plus each language-model provider, and 4.2.1 commits to updating the policy when the list changes. There is deliberately no second document to keep in sync. The cost is that adding or reordering a provider is a policy amendment; treat that as a release step for the bot, not an afterthought.
- **DPDP Section 7 sub-clauses were wrong in the first draft and have been corrected.** Section 7(c) was cited three times for "compliance with law". **7(c) is available only to the State and its instrumentalities** — it cannot be relied on by a private company. The corrected mapping: 7(a) for data voluntarily provided for a stated purpose; **7(d)** for an obligation under Indian law to disclose information to the State; **7(e)** for compliance with a judgment, decree or order; and **8(7)** for retention required by another law, which is a retention permission rather than a processing basis. Counsel should re-check this mapping against the bare Act, but it should not be reverted to 7(c).
- **Consent and Section 7(a) are alternatives, not a pair.** The first draft stated several purposes as "Consent; Section 7(a)", which is muddled: 7(a) is a legitimate use that applies precisely because consent was not separately taken. Each row of the 3.1 table now names one basis. The two rows that genuinely rest on consent are sharing details with a Helper the Client chooses to meet, and the aggregate analysis of support conversations.
- **Foreign-law scope is now conditional (1.1).** The first draft asserted flatly that the entity is a GDPR/UK GDPR controller and a CCPA "business". Both depend on tests the company may not meet — GDPR Article 3 territorial scope, and the CCPA revenue and volume thresholds. 1.1 now says "where, and only to the extent that" those laws apply. Confirm with counsel whether either in fact reaches the business; if neither does, Section 14 can be cut entirely, which would shorten the policy considerably.
- **Support-conversation retention.** Privacy Policy 6 commits to deleting support messages 12 months after the last message, deleting an anonymous visitor's browser reference after 30 days, and keeping only non-identifying counts thereafter. All three need a scheduled job, and the same table must be enforced in Chatwoot, whose own retention is a plan-tier setting. Deletion on account closure must reach Chatwoot too, or an erasure request is quietly incomplete.
- **Retention in practice.** The retention table commits to erasing accounts after 24 months of inactivity with notice, and to a 14-month retention setting in Google Analytics. Both need to be implemented (a scheduled job; a setting in the GA4 admin console).
- **Call recording.** ToS 14.3 says calls are announced as recorded where they are recorded. If no calls are recorded, delete the sentence.
- **Helper consent form and languages.** Privacy Policy 11.6 promises the policy and consent form in named languages with an in-person explanation. Produce the form and pick the languages.
- **Log retention.** Privacy Policy 5.4 and 6 refer to the 180-day log-retention direction of the Indian Computer Emergency Response Team. Confirm which logs the hosting providers retain and for how long.
- **DPDP rules and dates.** The drafts refer to the "form and period prescribed" for breach notification rather than quoting numbers, because the rules under the DPDP Act and their commencement schedule should be checked by counsel on the date of publication.
- **The in-app terms page.** The booking app carries its own Terms and Privacy tab with different wording and different dates (March and April 2026). Two versions of the agreement is the defect recorded in the audit's content notes. Replace that tab with the canonical documents, rendered from the same source, when these are published.
- **Numbers from one source.** Plan fees, terms, replacement counts, profile counts, the 60-day window and the 3-profile threshold appear in Annexure A and ToS 7.2. Render them from `data/seo/plans.ts` as the audit's FIN-C01 recommends, so the terms, the pricing page and the replacement-policy page cannot drift apart.
- **Profile counts changed to 3 / 4 / 5 (owner, 2026-09-10) and the code has been updated to match.** Silver went 1 → 3 and Gold 3 → 4; Diamond is unchanged at 5. Annexure A, `next-app/data/seo/plans.ts`, `app/src/lib/serviceability.json` and the embedded booking-app bundle all read 3/4/5. The chain, for the next time it changes: `plans.ts` → `npm run seo:export-spa` → `npm run build:spa` from the repo root → commit the regenerated `next-app/public/_spa`. **CI fails the build if the committed bundle is stale, but nothing compares Annexure A with `plans.ts` — that check does not exist**, so this table remains prose that can silently drift from the data it claims to be rendered from. Closing that gap is the audit's FIN-C01 recommendation.
- **The Silver change fixes an existing incoherence, which is the strongest argument for it.** ToS 7.2(a) entitles a Client to a refund if we do not introduce **three** suitable Verified Profiles within the Refund Window, and `REFUND_PROFILE_THRESHOLD` is 3 for every plan. A Silver Client promised **one** profile could therefore claim a refund for not receiving three — a term the Client is entitled to read literally and which the business would probably lose. Raising Silver to three aligns the promise with the refund test, and 3 is now the floor across every plan, so the mismatch cannot recur.
- **The Gold change restores the differentiator.** An earlier draft of this note flagged that Silver and Gold would both sit at three profiles, leaving nothing on that line to justify the upgrade. Raising Gold to four gives a clean 3 / 4 / 5 progression against fees of ₹4,999 / ₹5,999 / ₹6,999, so every step up buys one more profile as well as a longer term, more replacements and, from Gold, police verification. No further commercial question arises from this row.

## 4. Decisions required {#decisions}

> **Summary:** Each of these is a business decision the draft could not make. The draft carries the brief's figure where one was given, and a variable where none was.

| Decision | Draft position | Counsel's recommendation |
|---|---|---|
| Refund initiation time | **14 Business Days (resolved 2026-09-10)** | Was 45; counsel had recommended 10 |
| Liquidated damages for direct engagement | ₹21,000 (as instructed) | ₹14,000 to ₹21,000, or a direct-engagement fee equal to the Diamond fee plus a fixed sum; see 2.2 |
| Restricted Period for non-solicitation | **12 months (resolved 2026-09-10)** | Was 24; counsel recommendation adopted |
| Refund processing fee | Variable; the site says "minus a processing fee" and no amount is published anywhere | A published percentage, for example 10% of the fee; an unpublished deduction is itself an unfair-term risk |
| Silver plan and the 3-profile refund test | Kept the published test of 3 profiles in 60 days for every plan | Silver includes 1 profile per matching round, so 3 profiles in 60 days is a commitment to run three rounds. Either keep it and staff for it, or change the test to "the number of profiles included in the plan"; the audit's FIN-C01 already asks for this number to be rendered from `plans.ts` |
| Session or trial fee | "Not applicable" unless introduced | Leave out unless a paid trial is launched; if launched, the reciprocal refund in 8.4 applies |
| GST | Variable: inclusive or exclusive | State fees inclusive of GST; the E-Commerce Rules require the total price to be displayed |
| Arbitral institution | Variable, two Bengaluru options given | Pick one and confirm its current fee schedule for small claims |
| Fast-track threshold | ₹10,00,000 | Fine for a consumer contract of this size |
| Testimonials | First name and city only; full name or photo needs separate consent | Keep; it matches the stated practice of publishing only genuine reviews |

## 5. Variables to fill before publication {#variables}

- MyBuddyMaid Pvt Limited, private limited company, [CIN / REGISTRATION NUMBER], [GSTIN]
- 15 September 2026 on both documents, at least 15 days after the notice to existing users required by ToS 1.6
- [GRIEVANCE OFFICER NAME], governance@mybuddymaid.in, governance@mybuddymaid.in, info@mybuddymaid.in, legal@mybuddymaid.in
- [AMOUNT OR PERCENTAGE] for the refund processing fee; [AMOUNT, or "Not applicable"] for the session fee; ₹21,000 for liquidated damages
- [inclusive of / exclusive of] GST
- [APPOINTING AUTHORITY] for the arbitrator
**Filled on 2026-09-10** (owner): entity name **MyBuddyMaid Pvt Limited**; entity type **private
limited company**; effective date **15 September 2026**; liquidated damages **₹21,000**; Silver
verified profiles **3**; Supabase region **Sydney, Australia**; Chatwoot region **United States**.

Email mapping used, and one flag:

| Placeholder | Filled with |
|---|---|
| Privacy contact | governance@mybuddymaid.in |
| Grievance Officer | governance@mybuddymaid.in |
| Legal notices | legal@mybuddymaid.in |
| Refund claims | info@mybuddymaid.in |

> **Two cautions on the values.** The registered name must match the Certificate of Incorporation
> **character for character** — "Pvt Limited" and "Private Limited" are not interchangeable in a
> contract, and the CoI form governs. Confirm before publication. And routing refund claims to
> the general **info@** inbox is a risk the business is taking on itself: ToS 7.6 promises
> acknowledgement within 2 Business Days and a decision within 10, against a claim window that
> closes on day 75. A missed email in a shared inbox is a breach of a published term. A dedicated
> refunds@ address, or a filter with an owner, is worth the ten minutes.

**Still open:** [CIN / REGISTRATION NUMBER], [GSTIN], [GRIEVANCE OFFICER NAME],
[AMOUNT OR PERCENTAGE] for the refund processing fee, [AMOUNT] for the session fee,
[inclusive of / exclusive of] GST, [APPOINTING AUTHORITY], [AADHAAR VERIFICATION METHOD],
[LANGUAGES], and the EU/UK representatives if those laws apply at all.

- [UMAMI REGION], [BOT-PROTECTION PROVIDER]
- *(Resolved 2026-09-10: the Supabase project is in **Sydney, Australia**, AWS `ap-southeast-2`.
  Named as such in Privacy 4.2 and 5.2. Note that this makes Australia — not India and not
  Singapore — the location of the authoritative copy of every Client, Helper, booking and
  support record. Lawful under DPDP Section 16, which restricts only countries the Central
  Government notifies, and Australia is not notified. Two consequences for counsel: Privacy 5.4
  promises that logs CERT-In requires to stay in Indian jurisdiction do stay there, which must
  be checked against where Supabase and Vercel actually keep them; and if the Central Government
  ever notifies a restriction affecting Australia, the remedy is a database migration, not a
  contractual fix.)*
- *(Resolved 2026-09-10: Chatwoot's hosted region is the United States, with no region choice
  offered, and it is named as such in Privacy 4.2. Keeping support data in India would require
  self-hosting Chatwoot, which is a decision about infrastructure, not a setting to change.)*
- *(Resolved 2026-09-10: there is no separate assistant-providers page. The providers are named
  in Privacy 4.2 and 4.2.1 so there is one document to keep current.)*
- [AADHAAR VERIFICATION METHOD], [LANGUAGES] for the Helper consent form
- [EU REPRESENTATIVE NAME AND ADDRESS], [UK REPRESENTATIVE NAME AND ADDRESS], only if the business markets to those regions; otherwise delete 14.1(a)'s bracketed sentence

## 6. Suggested publication sequence {#sequence}

1. Advocate's review of both drafts, with this memo, and the decisions in Section 4 taken.
2. Engineering: consent gate and Cookie preferences link (FIN-S07); render plan numbers from `plans.ts` (FIN-C01); replace the in-app terms tab; version archive page.
3. Operations: appoint the Grievance Officer; create the mailboxes; confirm the Aadhaar method, invoice retention and region variables; produce the Helper consent form.
4. Fill every variable; set the effective date at least 15 days out.
5. Notify existing account holders by email and in-app notice of the new terms and the effective date.
6. Publish both documents with version 2.0 and the archived 1.x versions linked.

## 7. The 2026-09-10 Terms of Service review — what landed {#tos-review}

A second external review of the Terms was supplied on 2026-09-10. Each point was checked
against the clause text before anything was changed. **Two of its twelve points identified
something this memo had not already covered. The rest restate risks Section 2 above already
registers, or describe clauses as missing when they are present.** Both halves are recorded,
because a review accepted wholesale is as dangerous as one ignored.

### Landed — changed

| Point | What was wrong | Change |
|---|---|---|
| **2 — the employer clause is too absolute** | The one genuinely new point. ToS 2.3 said the Client is the employer "**for all purposes**". A contract can allocate responsibility between its parties; it cannot decide how a labour authority or court characterises a relationship, and Indian tribunals look at substance over label. The absolute form also invites the argument that the whole clause is overreaching | 2.3 now says the Client is **responsible for the terms on which the Helper works** rather than declaring universal employer status, and new **2.3.1** states plainly that the allocation does not bind any court, tribunal or authority, and that a law which applies regardless of contract applies |
| **6 — liquidated damages need a genuine-pre-estimate framing** | Section 2.2 above already required this and 10.3 already carried the "genuine pre-estimate… not as a penalty" wording with the loss heads enumerated. What was genuinely missing was an express saving for Section 74 | 10.3 now states the multiple (≈3× the highest Platform Fee) and its components on the face of the clause, and expressly preserves Section 74 and the tribunal's power to reduce. New **10.3.1** lets a household regularise by buying the Diamond Plan for that Helper — the change most likely to persuade an arbitrator that the clause is commercial rather than punitive |

The review's point **4** (refund "suitable" is vague) was half right and is left as it stands:
7.2(a) already ties suitability to "the requirements you stated when you confirmed the Plan",
and 7.3 lists ten objective denial grounds including a defined "Unresponsive". Enumerating the
matching criteria — category, locality, availability, language, experience, budget band — would
tighten it further and is worth doing if counsel agrees, but it is a refinement, not a defect.

### Did not land — already in the document

| Point | Where it already is |
|---|---|
| 3, 7 — liability cap needs carve-outs for fraud, wilful misconduct, statutory rights | **11.5** already carves out fraud, fraudulent misrepresentation, death or personal injury from gross negligence or wilful misconduct, and non-waivable Consumer Protection Act rights |
| 5, 8 — arbitration must preserve consumer forum rights | **17.5** already says a consumer may go to the District, State or National Commission or the CCPA and **is not required to arbitrate**. 17.6 preserves joint complaints under s.35 |
| 10A — acceptable use / misuse | **14.2**, seven sub-clauses |
| 10B — user representations | **9.1** |
| 10C — safety and household conditions | **9.1–9.7**: safe entry, lawful working conditions, the POSH Act 2013 applied to dwellings, animals, valuables, no insurance |
| 10D — complaints and abuse reporting, suspension | **9.4** (immediate withdrawal, no refund) and **16** (suspension and termination) |
| 10E — confidentiality of the Helper dossier | **5.3** |
| 10F — force majeure | **18.1**, a full standalone clause, plus 11.4 |
| 10G — communications consent | **14.3** |
| 5 (replacements) — define count, triggers, exhaustion | **6.1–6.5**: entitlement per Annexure A, when it applies, when it does not, and that a Replacement is not a refund |
| 1 — account security responsibility | **14.1** |
| 11 — platform must not imply it handles wages | **2.2, 4.2** and the At-a-glance already say the fee is not wages and no part of it reaches the Helper |

### What this says about the two reviews

Both external reviews followed the same pattern: a small number of sharp, correct points buried
in a majority of confident assertions that the document omits things it already contains in the
right terms. On the Terms, the hit rate was two of twelve. The useful ones were worth having —
the employer clause was a real exposure and nobody else had flagged it — but the reviews should
be read as prompts to check, not as findings to apply.

**Neither review, nor this memo, is legal advice.** The drafts still need an advocate enrolled
with a State Bar Council before publication. As of 2026-09-10 **every High-risk row in the
enforceability register has been closed by owner decision** — the refund timeline cut to 14
Business Days to initiate, liquidated damages reduced to ₹21,000 with a regularisation route,
the Restricted Period halved to 12 months, and the credit-bureau clause removed. Nothing in
Section 2 now stands against advice. That materially improves the document's prospects if it is
ever tested, and it is worth telling the reviewing advocate, because it changes what they should
be looking for.
