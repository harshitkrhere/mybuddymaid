// Service types and data — single source of truth for the Next.js app.
// Migrated from app/src/lib/constants.js with TypeScript types added.

export interface ServiceFeature {
  title: string;
  desc: string;
}

export interface Service {
  id: string;
  slug: string;           // URL-safe slug for routing
  name: string;
  shortName: string;
  icon: string;
  color: string;
  image: string;
  price: string;
  description: string;
  features: ServiceFeature[];
}

export const SERVICES: Service[] = [
  {
    id: 'part-time',
    slug: 'maid-service',
    name: 'Part-Time Buddy',
    shortName: 'Cleaning',
    icon: '🧹',
    color: '#E8F5F6',
    image: '/images/part-time.jpg',
    price: '₹5,000/mo',
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
    slug: 'full-time-maid-service',
    name: 'Full-Time Live-In',
    shortName: 'Live-In',
    icon: '🏠',
    color: '#FFF3E0',
    image: '/images/full-time.jpg',
    price: '₹12,000/mo',
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
    slug: 'elderly-care-service',
    name: 'Elderly Care',
    shortName: 'Elder Care',
    icon: '❤️',
    color: '#FDE8E8',
    image: '/images/eldercare.jpg',
    price: '₹14,000/mo',
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
    slug: 'cook-service',
    name: 'Specialized Cook',
    shortName: 'Cook',
    icon: '👨‍🍳',
    color: '#E8F5E9',
    image: '/images/cook.jpg',
    price: '₹8,000/mo',
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
    slug: 'nanny-service',
    name: 'Babysitting & Nanny',
    shortName: 'Nanny',
    icon: '👶',
    color: '#EDE7F6',
    image: '/images/nanny.jpg',
    price: '₹10,000/mo',
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
    slug: 'postnatal-care-service',
    name: 'Postnatal Care',
    shortName: 'Postnatal',
    icon: '🤱',
    color: '#FCE4EC',
    image: '/images/postnatal.jpg',
    price: 'Premium',
    description: 'Premium care inspired by global standards. Specialized infant handling, mother wellness, and holistic postpartum recovery.',
    features: [
      { title: 'Newborn Care', desc: 'Specialized infant handling & bathing' },
      { title: 'Mother Recovery', desc: 'Postpartum wellness support' },
      { title: 'Night Support', desc: 'Overnight feeding & care assistance' },
      { title: 'Expert Training', desc: 'Hospital-grade care standards' },
    ],
  },
];

// Helper: find service by slug
export function getServiceBySlug(slug: string): Service | undefined {
  return SERVICES.find(s => s.slug === slug);
}

// Helper: find service by id
export function getServiceById(id: string): Service | undefined {
  return SERVICES.find(s => s.id === id);
}

// All service slugs (for generateStaticParams)
export function getAllServiceSlugs(): string[] {
  return SERVICES.map(s => s.slug);
}
