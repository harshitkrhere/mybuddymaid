// City and locality data for programmatic SEO pages.
// This drives the /best-{service}-in-{city} URL pattern.

export interface City {
  slug: string;           // URL-safe: "delhi", "gurugram"
  name: string;           // Display: "Delhi", "Gurugram"
  state: string;
  tier: 1 | 2 | 3;       // Metro tier for priority
  latitude: number;
  longitude: number;
  isPrimary: boolean;     // Cities where MyBuddyMaid actively operates
}

// Primary cities (where MyBuddyMaid has active operations)
export const PRIMARY_CITIES: City[] = [
  { slug: 'delhi', name: 'Delhi', state: 'Delhi', tier: 1, latitude: 28.6139, longitude: 77.2090, isPrimary: true },
  { slug: 'gurugram', name: 'Gurugram', state: 'Haryana', tier: 1, latitude: 28.4595, longitude: 77.0266, isPrimary: true },
  { slug: 'noida', name: 'Noida', state: 'Uttar Pradesh', tier: 1, latitude: 28.5355, longitude: 77.3910, isPrimary: true },
  { slug: 'ghaziabad', name: 'Ghaziabad', state: 'Uttar Pradesh', tier: 1, latitude: 28.6692, longitude: 77.4538, isPrimary: true },
  { slug: 'faridabad', name: 'Faridabad', state: 'Haryana', tier: 1, latitude: 28.4089, longitude: 77.3178, isPrimary: true },
  { slug: 'mumbai', name: 'Mumbai', state: 'Maharashtra', tier: 1, latitude: 19.0760, longitude: 72.8777, isPrimary: true },
  { slug: 'bangalore', name: 'Bangalore', state: 'Karnataka', tier: 1, latitude: 12.9716, longitude: 77.5946, isPrimary: true },
  { slug: 'thane', name: 'Thane', state: 'Maharashtra', tier: 1, latitude: 19.2183, longitude: 72.9781, isPrimary: true },
  { slug: 'navi-mumbai', name: 'Navi Mumbai', state: 'Maharashtra', tier: 1, latitude: 19.0330, longitude: 73.0297, isPrimary: true },
];

// Expansion cities (SEO pages exist but service availability is limited)
export const EXPANSION_CITIES: City[] = [
  { slug: 'pune', name: 'Pune', state: 'Maharashtra', tier: 1, latitude: 18.5204, longitude: 73.8567, isPrimary: false },
  { slug: 'hyderabad', name: 'Hyderabad', state: 'Telangana', tier: 1, latitude: 17.3850, longitude: 78.4867, isPrimary: false },
  { slug: 'chennai', name: 'Chennai', state: 'Tamil Nadu', tier: 1, latitude: 13.0827, longitude: 80.2707, isPrimary: false },
  { slug: 'kolkata', name: 'Kolkata', state: 'West Bengal', tier: 1, latitude: 22.5726, longitude: 88.3639, isPrimary: false },
  { slug: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', tier: 1, latitude: 23.0225, longitude: 72.5714, isPrimary: false },
  { slug: 'jaipur', name: 'Jaipur', state: 'Rajasthan', tier: 2, latitude: 26.9124, longitude: 75.7873, isPrimary: false },
  { slug: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh', tier: 2, latitude: 26.8467, longitude: 80.9462, isPrimary: false },
  { slug: 'chandigarh', name: 'Chandigarh', state: 'Chandigarh', tier: 2, latitude: 30.7333, longitude: 76.7794, isPrimary: false },
  { slug: 'indore', name: 'Indore', state: 'Madhya Pradesh', tier: 2, latitude: 22.7196, longitude: 75.8577, isPrimary: false },
  { slug: 'nagpur', name: 'Nagpur', state: 'Maharashtra', tier: 2, latitude: 21.1458, longitude: 79.0882, isPrimary: false },
  { slug: 'surat', name: 'Surat', state: 'Gujarat', tier: 2, latitude: 21.1702, longitude: 72.8311, isPrimary: false },
  { slug: 'patna', name: 'Patna', state: 'Bihar', tier: 2, latitude: 25.6093, longitude: 85.1376, isPrimary: false },
  { slug: 'kochi', name: 'Kochi', state: 'Kerala', tier: 2, latitude: 9.9312, longitude: 76.2673, isPrimary: false },
  { slug: 'coimbatore', name: 'Coimbatore', state: 'Tamil Nadu', tier: 2, latitude: 11.0168, longitude: 76.9558, isPrimary: false },
  { slug: 'vadodara', name: 'Vadodara', state: 'Gujarat', tier: 2, latitude: 22.3072, longitude: 73.1812, isPrimary: false },
  { slug: 'bhopal', name: 'Bhopal', state: 'Madhya Pradesh', tier: 2, latitude: 23.2599, longitude: 77.4126, isPrimary: false },
  { slug: 'dehradun', name: 'Dehradun', state: 'Uttarakhand', tier: 2, latitude: 30.3165, longitude: 78.0322, isPrimary: false },
  { slug: 'ranchi', name: 'Ranchi', state: 'Jharkhand', tier: 2, latitude: 23.3441, longitude: 85.3096, isPrimary: false },
  { slug: 'raipur', name: 'Raipur', state: 'Chhattisgarh', tier: 2, latitude: 21.2514, longitude: 81.6296, isPrimary: false },
  { slug: 'guwahati', name: 'Guwahati', state: 'Assam', tier: 2, latitude: 26.1445, longitude: 91.7362, isPrimary: false },
  { slug: 'visakhapatnam', name: 'Visakhapatnam', state: 'Andhra Pradesh', tier: 2, latitude: 17.6868, longitude: 83.2185, isPrimary: false },
  { slug: 'mysore', name: 'Mysore', state: 'Karnataka', tier: 2, latitude: 12.2958, longitude: 76.6394, isPrimary: false },
  { slug: 'mangalore', name: 'Mangalore', state: 'Karnataka', tier: 2, latitude: 12.9141, longitude: 74.8560, isPrimary: false },
  { slug: 'nashik', name: 'Nashik', state: 'Maharashtra', tier: 2, latitude: 19.9975, longitude: 73.7898, isPrimary: false },
  { slug: 'varanasi', name: 'Varanasi', state: 'Uttar Pradesh', tier: 2, latitude: 25.3176, longitude: 83.0063, isPrimary: false },
  { slug: 'ludhiana', name: 'Ludhiana', state: 'Punjab', tier: 2, latitude: 30.9010, longitude: 75.8573, isPrimary: false },
  { slug: 'kanpur', name: 'Kanpur', state: 'Uttar Pradesh', tier: 2, latitude: 26.4499, longitude: 80.3319, isPrimary: false },
  { slug: 'madurai', name: 'Madurai', state: 'Tamil Nadu', tier: 2, latitude: 9.9252, longitude: 78.1198, isPrimary: false },
  { slug: 'jodhpur', name: 'Jodhpur', state: 'Rajasthan', tier: 2, latitude: 26.2389, longitude: 73.0243, isPrimary: false },
  { slug: 'vijayawada', name: 'Vijayawada', state: 'Andhra Pradesh', tier: 2, latitude: 16.5062, longitude: 80.6480, isPrimary: false },
  { slug: 'thiruvananthapuram', name: 'Thiruvananthapuram', state: 'Kerala', tier: 2, latitude: 8.5241, longitude: 76.9366, isPrimary: false },
  { slug: 'bhubaneswar', name: 'Bhubaneswar', state: 'Odisha', tier: 2, latitude: 20.2961, longitude: 85.8245, isPrimary: false },
];

// All cities combined
export const ALL_CITIES: City[] = [...PRIMARY_CITIES, ...EXPANSION_CITIES];

// Helper: find city by slug
export function getCityBySlug(slug: string): City | undefined {
  return ALL_CITIES.find(c => c.slug === slug);
}

// All city slugs (for generateStaticParams)
export function getAllCitySlugs(): string[] {
  return ALL_CITIES.map(c => c.slug);
}
