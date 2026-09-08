# Counsel's notes on the drafts

Version: review memo accompanying Terms of Service 2.0 and Privacy Policy 2.0 (drafts)
Effective date: not applicable
Supersedes: none

## At a glance

- These drafts were produced by an AI system acting on a brief. They are not legal advice and must be reviewed by an advocate enrolled with a State Bar Council before publication. The brief asked for "bulletproof" terms; the most protective terms are the ones a consumer commission will actually enforce, so several requested clauses were drafted in their most defensible form rather than verbatim.
- The brief describes an on-demand cleaning marketplace. MyBuddyMaid is a placement service: a one-time plan fee, the household employs the helper and pays the salary directly, and the remedy for a failed placement is a replacement. Every slot-based rule in the brief was mapped onto interviews, trials and placements. Terms that describe a flow the business does not run are exactly the defect the audit recorded as FIN-C02.
- Three requested provisions carry real enforceability risk as specified: the 45-business-day refund timeline, the ₹1,00,000 liquidated-damages figure, and reporting customers to credit bureaus. Each is explained below with the alternative.
- The privacy policy states facts that must be true on the day it goes live: a consent gate for analytics, a named Grievance Officer, the Supabase region, and the Aadhaar-handling method. Four of those are not true today.

## 1. How the brief was mapped onto the real service {#mapping}

> **Summary:** Where the brief assumed per-visit cleaning slots, the drafts substitute the equivalent event in a placement: the interview, the trial, the 60-day matching window, and the plan term.

| Brief | What the draft says | Why |
|---|---|---|
| "Service Provider/Cleaner" as independent contractor | Helper defined as an independent individual; the Client is the employer for every purpose (ToS 2.2 to 2.4) | Matches the published model, where the household pays the salary. Employer status for the household is the strongest insulation available; "independent contractor of the platform" would imply the platform contracts for the work, which it does not |
| Refund claims within 4 hours of service completion, with time-stamped photos | Refund claim window: days 61 to 75 after payment (ToS 7.4). Incident reports (damage, theft, misconduct) within 48 hours with time-stamped photographs and a police complaint where an offence is alleged (ToS 7.5) | There is no "service completion" event in a placement. The published refund test is a 60-day matching window, so the claim window sits after it. Incidents are replacement grounds, not refund grounds, and a 4-hour window for a household to document a theft would be attacked as an unreasonable condition |
| Denial grounds: cleaner denied entry, no water or electricity, client approved verbally | Kept, adapted to interviews and placements (ToS 7.3(e) to (g)), with seven further grounds | The requested grounds fit; the added grounds close the gaps a placement model actually sees: hires, unresponsiveness, changed requirements, promotional plans |
| 100% non-refundable fee for cancellation inside 24 hours of a slot | Late cancellation or no-show for a confirmed interview or trial uses one of the plan's profile introductions, and forfeits any session fee (ToS 8.2); reciprocal protection when the Company or Helper cancels late (ToS 8.4) | No per-slot fee exists today; the profile allowance is the real currency. The Consumer Protection (E-Commerce) Rules, 2020 do not permit cancellation charges on consumers unless the entity bears similar charges when it cancels, so the reciprocal clause is not optional |
| Late cancellation applies to "bookings" | A cancelled plan is not refundable beyond Section 7 (ToS 8.1) | A booking request costs nothing and creates no plan |
| Class-action waiver, New Delhi venue | Individual proceedings with a severability fallback (ToS 17.6); seat Bengaluru (ToS 17.3) | Registered office is Bengaluru and the existing terms already say so; the brief allowed the primary corporate city |
| "Credit bureaus" for chargeback abusers | Evidence to the gateway and card network, recovery of the amount and fees, police report, fraud-prevention services "to the extent permitted by law" (ToS 13.2) | See Section 2.6 below |

## 2. Enforceability register {#register}

> **Summary:** Ranked by the chance that a consumer commission or arbitrator reads the clause out of the contract. High means expect it to be cut down; Medium means it holds with the carve-outs drafted; Low means it holds.

### 2.1 Refund processing time of 45 business days: High risk {#refund-time}

> **Critical:** The clause is drafted as instructed (ToS 7.7). Counsel recommends ten Business Days.

Forty-five Business Days is roughly nine calendar weeks. The current published terms promise seven business days, and Razorpay settles refunds to the customer's instrument in five to seven working days, so the delay is not a processing necessity and will be read as one. Under the Consumer Protection Act, 2019, a term that imposes "any unreasonable charge, obligation or condition which puts such consumer to disadvantage" is an unfair contract term (Section 2(46)), and the District, State and National Commissions can declare such a term null and void (Sections 49(2) and 59(2)). Separately, a customer who is told to wait nine weeks will raise a chargeback with their bank, whose dispute window is 120 days; the chargeback clause in ToS 13 is then fighting a dispute the refund timeline provoked. The processing-fee deduction and the strict eligibility test already give the business the protection it needs. Ten Business Days keeps a buffer over the gateway's timeline and is defensible.

### 2.2 Liquidated damages of ₹1,00,000 for direct engagement: High risk {#liquidated-damages}

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
- **Deletion versus financial records.** The app's Delete My Account function removes the profile, bookings, plan rows and email logs and deletes the login. Privacy Policy 6 and 8.2 say financial records are kept for eight years in a restricted archive. That archive is Razorpay's transaction ledger and the Company's own invoices and books, not the app database. Confirm that invoices are issued and retained outside the app so the statement is true.
- **Retention in practice.** The retention table commits to erasing accounts after 24 months of inactivity with notice, and to a 14-month retention setting in Google Analytics. Both need to be implemented (a scheduled job; a setting in the GA4 admin console).
- **Call recording.** ToS 14.3 says calls are announced as recorded where they are recorded. If no calls are recorded, delete the sentence.
- **Helper consent form and languages.** Privacy Policy 11.6 promises the policy and consent form in named languages with an in-person explanation. Produce the form and pick the languages.
- **Log retention.** Privacy Policy 5.4 and 6 refer to the 180-day log-retention direction of the Indian Computer Emergency Response Team. Confirm which logs the hosting providers retain and for how long.
- **DPDP rules and dates.** The drafts refer to the "form and period prescribed" for breach notification rather than quoting numbers, because the rules under the DPDP Act and their commencement schedule should be checked by counsel on the date of publication.
- **The in-app terms page.** The booking app carries its own Terms and Privacy tab with different wording and different dates (March and April 2026). Two versions of the agreement is the defect recorded in the audit's content notes. Replace that tab with the canonical documents, rendered from the same source, when these are published.
- **Numbers from one source.** Plan fees, terms, replacement counts, profile counts, the 60-day window and the 3-profile threshold appear in Annexure A and ToS 7.2. Render them from `data/seo/plans.ts` as the audit's FIN-C01 recommends, so the terms, the pricing page and the replacement-policy page cannot drift apart.

## 4. Decisions required {#decisions}

> **Summary:** Each of these is a business decision the draft could not make. The draft carries the brief's figure where one was given, and a variable where none was.

| Decision | Draft position | Counsel's recommendation |
|---|---|---|
| Refund processing time | 45 Business Days (as instructed) | 10 Business Days; see 2.1 |
| Liquidated damages for direct engagement | [₹1,00,000] (as instructed) | ₹14,000 to ₹21,000, or a direct-engagement fee equal to the Diamond fee plus a fixed sum; see 2.2 |
| Restricted Period for non-solicitation | 24 months (as instructed) | 12 months |
| Refund processing fee | Variable; the site says "minus a processing fee" and no amount is published anywhere | A published percentage, for example 10% of the fee; an unpublished deduction is itself an unfair-term risk |
| Silver plan and the 3-profile refund test | Kept the published test of 3 profiles in 60 days for every plan | Silver includes 1 profile per matching round, so 3 profiles in 60 days is a commitment to run three rounds. Either keep it and staff for it, or change the test to "the number of profiles included in the plan"; the audit's FIN-C01 already asks for this number to be rendered from `plans.ts` |
| Session or trial fee | "Not applicable" unless introduced | Leave out unless a paid trial is launched; if launched, the reciprocal refund in 8.4 applies |
| GST | Variable: inclusive or exclusive | State fees inclusive of GST; the E-Commerce Rules require the total price to be displayed |
| Arbitral institution | Variable, two Bengaluru options given | Pick one and confirm its current fee schedule for small claims |
| Fast-track threshold | ₹10,00,000 | Fine for a consumer contract of this size |
| Testimonials | First name and city only; full name or photo needs separate consent | Keep; it matches the stated practice of publishing only genuine reviews |

## 5. Variables to fill before publication {#variables}

- [LEGAL ENTITY NAME], [ENTITY TYPE], [CIN / REGISTRATION NUMBER], [GSTIN]
- [EFFECTIVE DATE] on both documents, at least 15 days after the notice to existing users required by ToS 1.6
- [GRIEVANCE OFFICER NAME], [GRIEVANCE EMAIL], [PRIVACY EMAIL], [REFUND EMAIL], [LEGAL NOTICES EMAIL]
- [AMOUNT OR PERCENTAGE] for the refund processing fee; [AMOUNT, or "Not applicable"] for the session fee; [₹1,00,000] for liquidated damages
- [inclusive of / exclusive of] GST
- [APPOINTING AUTHORITY] for the arbitrator
- [SUPABASE PROJECT REGION], [UMAMI REGION], [BOT-PROTECTION PROVIDER]
- [AADHAAR VERIFICATION METHOD], [LANGUAGES] for the Helper consent form
- [EU REPRESENTATIVE NAME AND ADDRESS], [UK REPRESENTATIVE NAME AND ADDRESS], only if the business markets to those regions; otherwise delete 14.1(a)'s bracketed sentence

## 6. Suggested publication sequence {#sequence}

1. Advocate's review of both drafts, with this memo, and the decisions in Section 4 taken.
2. Engineering: consent gate and Cookie preferences link (FIN-S07); render plan numbers from `plans.ts` (FIN-C01); replace the in-app terms tab; version archive page.
3. Operations: appoint the Grievance Officer; create the mailboxes; confirm the Aadhaar method, invoice retention and region variables; produce the Helper consent form.
4. Fill every variable; set the effective date at least 15 days out.
5. Notify existing account holders by email and in-app notice of the new terms and the effective date.
6. Publish both documents with version 2.0 and the archived 1.x versions linked.
