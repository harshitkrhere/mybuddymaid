// lib/assistant/copy.ts — every sentence the support assistant says in its own voice.
//
// ┌──────────────────────────────────────────────────────────────────────────────────────────┐
// │ CUSTOMER-FACING COPY. Changes here need the owner's approval before they are committed.  │
// │ The notice text is also the DPDP Section 5 notice promised in Privacy Policy 2.0 §2.2,   │
// │ so its wording carries legal weight; keep it identical to the policy draft.              │
// │                                                                                          │
// │ Approved by the owner on 2026-09-11, as committed in 5202d53a and 7411edb0; the           │
// │ after-handoff strings (forwarded / team label / closed) approved the same day.           │
// └──────────────────────────────────────────────────────────────────────────────────────────┘
//
// Anything that quotes a price, a policy term or a place name is NOT here — those come from
// the data layer through knowledge.ts and retrieve.ts, and the assistant never phrases them
// freely. This file holds only the connective tissue: greetings, refusals, handoffs, and the
// sentence shapes that wrap a looked-up fact.

import { SUPPORT_HOURS, SUPPORT_PHONE_DISPLAY } from '@/data/seo/contact';

const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

export const COPY = {
  /**
   * Shown above the input before the first message. Verbatim from Privacy Policy 2.0 §2.2. The
   * sentence on contact details was revised on 2026-09-12 at the owner's direction, in both
   * places, when the assistant began asking for a name and number before a handoff.
   */
  notice:
    'You are chatting with MyBuddyMaid’s automated assistant. It answers from our published service, pricing and policy information, and it can pass you to a member of our team. ' +
    'We keep a record of this conversation, and by continuing you agree that we may analyse conversations in aggregate to improve our service; we do not use them to build advertising profiles. ' +
    'Please type only what the assistant needs to answer you. There is no need to send your phone number, email address or address here unless our team needs to call you back, in which case the assistant will ask for your name and mobile number; we use them only to contact you about your request and keep them with the record of this conversation. You must never send card numbers, UPI PINs, passwords or one-time passwords. We will never ask for them. ' +
    'If you are not signed in we store a random reference in your browser so the conversation can continue; sign in and it is linked to your account. ' +
    'You can withdraw consent, ask what we hold, or complain to our Grievance Officer — see our Privacy Policy.',

  greeting:
    'Hi, I’m MyBuddyMaid’s assistant. I can check whether we serve your area, explain our plans and prices, and answer questions about how verification and replacements work. What would you like to know?',

  /** When the answer is not in the knowledge base. Never guesses. */
  refuse:
    'I don’t have a reliable answer for that in our published information, and I’d rather not guess. I can connect you to a member of our team, or you can ask me about our areas, plans, prices, verification or replacements.',

  // ── Serviceability sentence shapes. Place names and pincodes are inserted from the data. ──
  servedPincode: (pin: string, city: string, localities: string[]) =>
    localities.length
      ? `Yes — we serve pincode ${pin} in ${city}, covering ${list(localities)}. Tell me which service you need and I can explain the options.`
      : `Yes — we serve pincode ${pin} in ${city}. Tell me which service you need and I can explain the options.`,
  notServedPincode: (pin: string, cities: string[]) =>
    `Sorry — we don’t serve pincode ${pin} yet. We currently serve ${list(cities)}. If you’re in one of those, tell me the locality and I’ll check.`,
  servedLocality: (locality: string, city: string, service?: string) =>
    service
      ? `Yes — we serve ${locality}, ${city}, and we place ${service.toLowerCase()} helpers there. Would you like to know the plans and prices, or how booking works?`
      : `Yes — we serve ${locality}, ${city}. Tell me which service you need and I can explain the options and prices.`,
  servedCity: (city: string, service?: string) =>
    service
      ? `Yes — we serve ${city}, including ${service.toLowerCase()} placements. Tell me your locality or pincode and I’ll confirm coverage for your exact area.`
      : `Yes — we serve ${city}. Tell me your locality or pincode and I’ll confirm coverage for your exact area.`,

  /** Price of a service: the helper's salary band and, separately, our fee. All figures from the data. */
  servicePricing: (service: string, from: number, to: number, unit: string, planList: string) =>
    `${service}: the helper’s salary in metro cities is typically ₹${new Intl.NumberFormat('en-IN').format(from)} to ₹${new Intl.NumberFormat('en-IN').format(to)} per ${unit}, and you agree and pay that directly to the helper. ` +
    `Separately, our one-time platform fee for verification, shortlisting and replacement cover is ${planList}.`,

  notOffered: (services: string[]) =>
    `Sorry — that isn’t something we place. We introduce households to ${list(services.map((s) => s.toLowerCase()))}. If one of those would help, tell me which and where you are.`,
  whichCity: (locality: string, cities: string[]) => `There’s a ${locality} in ${list(cities)} — which city are you in?`,
  askLocality: (cities: string[]) => `Tell me your locality or 6-digit pincode and I’ll check. We serve ${list(cities)}.`,

  serviceList: (lines: string[]) => `We place helpers for six kinds of work:\n${lines.map((l) => `• ${l}`).join('\n')}\nWhich one do you need?`,

  bookingProcessFallback:
    'Tell us the service you need, your locality and your preferred timings — on WhatsApp, by phone, or through the app. We shortlist matching verified profiles and arrange interviews before you confirm anyone.',

  bookingStatusNeedsSignIn:
    'To see the status of a booking, sign in to the app and open Bookings — I can only show booking details to the account that made them. If you’d rather, a member of our team can look it up for you.',

  // ── Handoffs. Each lead-in is followed by handoffInHours or handoffOutOfHours. ──
  escalateHuman: 'Of course — let me hand you to a member of our team.',
  escalateComplaint:
    'I’m sorry — that shouldn’t have happened, and a person should sort it out with you. I’m passing this to our team now; if a replacement is needed, our replacement policy covers it.',
  escalateRefund: 'Refunds are decided by a person, not by me, so I’m passing your request to our team. The policy is below for reference.',
  escalateSafety: `If anyone is in danger, please call the police first. I’m alerting our team right now, and you can also call us on ${SUPPORT_PHONE_DISPLAY}.`,
  escalatePayment: 'Anything to do with a payment needs a person to check the records, so I’m passing this to our team. Please don’t pay again until we’ve confirmed.',
  escalateTurnLimit: 'I don’t seem to be getting you what you need, so let me hand this to a member of our team.',

  /** The state shown while a handoff is being arranged, in hours. */
  connecting: 'Connecting you to a specialist…',
  /** In hours: WhatsApp and phone are live, and the team sees the transcript. */
  handoffInHours: (phone: string) =>
    `The fastest way to reach them right now is WhatsApp or a call on ${phone}. They’ll see what you’ve told me, so you won’t need to repeat yourself.`,
  /** Outside hours: the 24-hour promise from Terms 2.0 §14.4. */
  handoffOutOfHours: (hoursLabel: string, replyWithinHours: number) =>
    `Our team is available ${hoursLabel}. Leave your name and a phone number here and we’ll get back to you within ${replyWithinHours} hours — everything you’ve told me is saved for them.`,
  /** Label on the button the widget shows whenever a handoff is offered. */
  talkToTeam: 'Talk to our team',

  // ── After the handoff: the customer keeps typing, the person replies in the same window. ──
  /** Acknowledgement when a message is forwarded to the team during support hours. */
  forwardedInHours: 'Sent to our team — a reply will appear here shortly.',
  /** Outside hours: the 24-hour promise, and where the reply will come. */
  forwardedOutOfHours: (hoursLabel: string, replyWithinHours: number) =>
    `Sent to our team. They’re back ${hoursLabel} and will get back to you within ${replyWithinHours} hours.`,
  /** Shown above a reply written by a person. */
  teamLabel: 'MyBuddyMaid team',
  /** When the team resolves the conversation; the assistant takes over again. */
  conversationClosed: 'Our team has closed this conversation. Ask me anything else and I’ll start fresh.',

  /** Rung 3: the retrieved answer shown without a model, with its source. */
  unphrasedPrefix: 'Here’s what our help pages say:',
  sourceLabel: 'Source',

  /** Shown when the message is blocked before it is sent anywhere. */
  tooLong: 'That message is a bit long for me — could you put the main question in a sentence or two?',
  rateLimited: 'You’re sending messages faster than I can read them — give me a moment.',
  dailyCeiling: 'I’m at capacity for automated answers right now, but I can still show you what our help pages say, and our team is reachable on WhatsApp.',

  // ── Prompts the widget offers as buttons; a tap sends the text as the customer's message. ──
  // Each is a question retrieve.ts answers with the intent it names (suggestions.test.ts holds
  // it to that), so a tap never lands in the refusal it was meant to save the customer from.
  // Approved by the owner on 2026-09-12, with the widget redesign.
  /** Under the greeting of a fresh conversation. */
  starters: ['What services do you offer?', 'What are your plans and prices?', 'Which areas do you serve?', 'How do you verify helpers?'],
  /** Under an answer; lib/assistant/suggestions.ts picks up to three from what was just answered. */
  prompts: {
    services: 'What services do you offer?',
    pricing: 'What are your plans and prices?',
    areas: 'Which areas do you serve?',
    verification: 'How do you verify helpers?',
    replacements: 'How do replacements work?',
    booking: 'How does booking work?',
    gold: 'What is included in Gold?',
    team: 'Talk to our team',
  },
  /** Shown for a moment after the reference in the panel's header is tapped, which copies it. */
  copied: 'Copied',

  // ── Contact before the handoff (owner decision, 2026-09-12): the team gets a conversation
  // only with a way to reach the customer back. Approved by the owner on 2026-09-12. ──
  /** Follows the escalation lead-in in place of the hours text, until the details are in. */
  askContact: 'So our team can reach you, please share your name and mobile number below.',
  /** The card's title; the second when the number on the customer's account is offered back. */
  contactTitle: 'So our team can call you back',
  contactTitlePrefilled: 'Is this the best number to reach you on?',
  contactNameLabel: 'Your name',
  contactPhoneLabel: 'Mobile number',
  contactPhonePlaceholder: '10-digit mobile number',
  contactSubmit: 'Send details',
  /** How the details read in the transcript — the widget's bubble and the record use the same words. */
  contactLineLabels: { name: 'Name', phone: 'Phone' },
  invalidPhone: 'That doesn’t look like an Indian mobile number. Please enter 10 digits starting with 6, 7, 8 or 9.',
  /** Once the details are in and the conversation is with the team. */
  contactThanksInHours: (name: string | null) =>
    `Thanks${name ? `, ${name}` : ''} — I’ve passed this to our team with everything you’ve told me. A reply will appear here shortly.`,
  contactThanksOutOfHours: (name: string | null, phone: string, hoursLabel: string, replyWithinHours: number) =>
    `Thanks${name ? `, ${name}` : ''} — I’ve passed this to our team with everything you’ve told me. They’re back ${hoursLabel} and will call you on ${phone} within ${replyWithinHours} hours.`,
  /** The details are saved but the conversation could not be opened for the team just now. */
  contactSaved: (name: string | null, phone: string) =>
    `Thanks${name ? `, ${name}` : ''} — I’ve saved your details and our team will call you on ${phone}. For anything urgent, WhatsApp or call us.`,
  /** Nothing could be saved at all (the record is unreachable): say so, and point at the ways that work. */
  contactNotSaved: 'I couldn’t pass your details to our team just now. The fastest way to reach them is WhatsApp or a call.',

  hoursLabel: SUPPORT_HOURS.label,
} as const;
