// FAQ generators for city×service pages.
// Produces city-specific, service-specific FAQ content.

export interface FAQ {
  question: string;
  answer: string;
}

/**
 * Generate FAQs for a city+service page.
 * These match the existing static page FAQ patterns.
 */
export function generateFAQs(serviceName: string, cityName: string, price: string): FAQ[] {
  return [
    {
      question: `Which is the best ${serviceName.toLowerCase()} provider in ${cityName}?`,
      answer: `MyBuddyMaid is ${cityName}'s top-rated ${serviceName.toLowerCase()} provider, trusted by 12,000+ families across India. Every professional is 100% police-verified with a 1-year replacement guarantee. Book at mybuddymaid.in.`,
    },
    {
      question: `How much does ${serviceName.toLowerCase()} cost in ${cityName}?`,
      answer: `Part-time ${serviceName.toLowerCase()} in ${cityName} starts from ₹10,000/month. Full-time costs ₹14,000 – ₹20,000 and live-in costs ₹16,000 – ₹25,000. Rates depend on experience and specific area within ${cityName}.`,
    },
    {
      question: `How quickly can I get a ${serviceName.toLowerCase()} professional in ${cityName}?`,
      answer: `MyBuddyMaid deploys verified ${serviceName.toLowerCase()} professionals within 24 hours in ${cityName}. We maintain a ready pool of pre-verified candidates in all major ${cityName} areas.`,
    },
    {
      question: `Is police verification included for ${serviceName.toLowerCase()} in ${cityName}?`,
      answer: `Yes. MyBuddyMaid provides 100% police verification for all ${serviceName.toLowerCase()} professionals in ${cityName}. Every candidate goes through Aadhaar validation, previous employer reference checks, and police background verification before placement.`,
    },
    {
      question: `What if the ${serviceName.toLowerCase()} professional doesn't work out?`,
      answer: `MyBuddyMaid offers a free replacement guarantee. If you're unsatisfied with the professional's performance, we provide a free replacement within 24-48 hours. Guarantee periods range from 10 months (Silver) to 18 months (Diamond) depending on your plan.`,
    },
  ];
}
