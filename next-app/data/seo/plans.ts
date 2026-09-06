// data/seo/plans.ts — the platform plans, in one place.
//
// These were previously duplicated in three files: the booking app's constants, the
// Next.js pricing page, and the trust-page copy. Terms come from the company's own
// published Terms & Conditions (see docs/seo/ASSUMPTIONS.md #11): the platform fee buys
// access to the verified pool and the replacement cover below.
export interface Plan {
  key: 'silver' | 'gold' | 'diamond';
  name: string;
  /** One-time platform fee in rupees. */
  fee: number;
  /** Paise, for the payment gateway. */
  feePaise: number;
  termMonths: number;
  replacements: number;
  verifiedProfiles: number;
  policeVerification: boolean;
  popular?: boolean;
}

export const PLANS: Plan[] = [
  {
    key: 'silver',
    name: 'Silver',
    fee: 3999,
    feePaise: 399900,
    termMonths: 10,
    replacements: 3,
    verifiedProfiles: 1,
    policeVerification: false,
  },
  {
    key: 'gold',
    name: 'Gold',
    fee: 4999,
    feePaise: 499900,
    termMonths: 12,
    replacements: 5,
    verifiedProfiles: 3,
    policeVerification: true,
    popular: true,
  },
  {
    key: 'diamond',
    name: 'Diamond',
    fee: 6999,
    feePaise: 699900,
    termMonths: 18,
    replacements: 10,
    verifiedProfiles: 5,
    policeVerification: true,
  },
];

export const PLAN_BY_KEY = new Map(PLANS.map((p) => [p.key, p]));

/** Refund window from the published terms, in days. */
export const REFUND_WINDOW_DAYS = 60;
/** Profiles we must supply within the refund window for the fee to be non-refundable. */
export const REFUND_PROFILE_THRESHOLD = 3;
