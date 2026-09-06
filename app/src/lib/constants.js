// Service data used across the app.
//
// Presentation only: names, icons, colours and feature bullets live here, but the
// PRICE of every service and the plan fees come from the SEO data layer via
// serviceability.json (regenerate with `npm run seo:export-spa` in next-app/), so
// there is exactly one source of truth for pricing across the whole repo.
import { priceLabelForServiceId, planDetails } from './serviceability';

const SERVICE_DEFS = [
  {
    id: 'part-time',
    name: 'Part-Time Buddy',
    shortName: 'Cleaning',
    icon: '🧹',
    color: '#E8F5F6',
    image: '/images/part-time.jpg',
    description: 'Flexible daily help for 4-12 hours. Ideal for working professionals needing daily cleaning, laundry, and kitchen management.',
    features: [
      { title: 'Flexible Hours', desc: 'Choose 4 to 12 hours daily' },
      { title: 'Multi-Tasking', desc: 'Cleaning, laundry, dishwashing, mopping' },
      { title: 'Background Verified', desc: 'Aadhaar & reference checked' },
      { title: 'Replacement Guarantee', desc: 'Free replacement if unsatisfied' },
    ],
  },
  {
    id: 'full-time',
    name: 'Full-Time Live-In',
    shortName: 'Live-In',
    icon: '🏠',
    color: '#FFF3E0',
    image: '/images/full-time.jpg',
    description: 'Complete 24x7 household management. A dedicated professional who stays with your family for ultimate convenience.',
    features: [
      { title: '24/7 Availability', desc: 'Lives with your family full-time' },
      { title: 'Complete Management', desc: 'Cooking, cleaning, laundry, everything' },
      { title: 'Police Verified', desc: 'Full background & police check' },
      { title: 'Dedicated Support', desc: 'Account manager for any issues' },
    ],
  },
  {
    id: 'elderly-care',
    name: 'Elderly Care',
    shortName: 'Elder Care',
    icon: '❤️',
    color: '#FDE8E8',
    image: '/images/eldercare.jpg',
    description: 'Compassionate, patient companions trained for senior needs — mobility support, medication reminders, and loving care.',
    features: [
      { title: 'Trained Caregivers', desc: 'Specialized in elderly needs' },
      { title: 'Medication Reminders', desc: 'Timely medicine management' },
      { title: 'Mobility Support', desc: 'Help with walking & daily activities' },
      { title: 'Companionship', desc: 'Emotional support & engagement' },
    ],
  },
  {
    id: 'cook',
    name: 'Specialized Cook',
    shortName: 'Cook',
    icon: '👨‍🍳',
    color: '#E8F5E9',
    image: '/images/cook.jpg',
    description: 'Expert chefs for North Indian, South Indian, or Continental cuisine. Hygienic, healthy, and tailored to your dietary needs.',
    features: [
      { title: 'Multi-Cuisine', desc: 'North, South Indian, Continental & more' },
      { title: 'Diet Conscious', desc: 'Follows your dietary requirements' },
      { title: 'Hygiene Trained', desc: 'Certified in food safety practices' },
      { title: 'Meal Planning', desc: 'Weekly menu planning support' },
    ],
  },
  {
    id: 'nanny',
    name: 'Babysitting & Nanny',
    shortName: 'Nanny',
    icon: '👶',
    color: '#EDE7F6',
    image: '/images/nanny.jpg',
    description: 'Verified, loving caretakers who engage your children safely. Focus on nutrition, hygiene, and developmental activities.',
    features: [
      { title: 'Child Development', desc: 'Age-appropriate activities & learning' },
      { title: 'Safety First', desc: 'First-aid trained caregivers' },
      { title: 'Nutrition Focus', desc: 'Healthy meal preparation for kids' },
      { title: 'Trusted & Verified', desc: 'Extensive background checks' },
    ],
  },
  {
    id: 'postnatal',
    name: 'Postnatal Care',
    shortName: 'Postnatal',
    icon: '🤱',
    color: '#FCE4EC',
    image: '/images/postnatal.jpg',
    description: 'Premium care inspired by global standards. Specialized infant handling, mother wellness, and holistic postpartum recovery.',
    features: [
      { title: 'Newborn Care', desc: 'Specialized infant handling & bathing' },
      { title: 'Mother Recovery', desc: 'Postpartum wellness support' },
      { title: 'Night Support', desc: 'Overnight feeding & care assistance' },
      { title: 'Expert Training', desc: 'Hospital-grade care standards' },
    ],
  },
];

/** The exported list, with each service's indicative price resolved from the data layer. */
export const SERVICES = SERVICE_DEFS.map((s) => ({
  ...s,
  // postnatal has no band in the data layer (it is sold as a premium bespoke service)
  price: priceLabelForServiceId(s.id) ?? 'Premium',
}));


// Presentation only — money and contractual terms come from the data layer.
const PLAN_PRESENTATION = {
  silver: {
    color: '#94A3B8',
    gradient: 'linear-gradient(135deg, #94A3B8, #CBD5E1)',
    emoji: '\u{1F948}',
  },
  gold: {
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
    emoji: '\u{1F947}',
    extraBenefits: ['Dedicated relationship manager'],
  },
  diamond: {
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6, #60A5FA)',
    emoji: '\u{1F48E}',
    extraBenefits: ['24-hour deployment'],
  },
};

export const PLAN_DETAILS = planDetails(PLAN_PRESENTATION);

export const RZP_KEY = import.meta.env.VITE_RZP_KEY || '';

// All 28 States + 8 Union Territories of India (alphabetical)
// INDIAN_STATES was removed in the SEO rebuild: location options now come from the
// data layer via app/src/lib/serviceability.js, so the app can only ever offer areas
// we actually serve. Regenerate with `npm run seo:export-spa` in next-app/.
