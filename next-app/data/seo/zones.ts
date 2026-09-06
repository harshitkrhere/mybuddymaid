// data/seo/zones.ts — zone hub definitions. The `localities` array on the Zone type is
// DERIVED from locality records (their `zone` field) in data/seo/index.ts so the two can
// never drift; only zone-level metadata is authored here.
import type { CitySlug, Zone } from './types';

const UPDATED = '2026-09-05';

type ZoneSeed = Omit<Zone, 'localities' | 'intro' | 'updatedAt'> & { intro?: string };

const z = (city: CitySlug, slug: string, name: string, altNames: string[] = [], zonePincodes: string[] = []): ZoneSeed => ({
  slug,
  city,
  name,
  altNames,
  zonePincodes,
});

export const ZONE_SEEDS: ZoneSeed[] = [
  // Delhi
  z('delhi', 'central-delhi', 'Central Delhi', [], ['110011', '110004']),
  z('delhi', 'south-delhi', 'South Delhi'),
  z('delhi', 'south-west-delhi', 'South West Delhi'),
  z('delhi', 'west-delhi', 'West Delhi'),
  z('delhi', 'north-delhi', 'North Delhi'),
  z('delhi', 'north-west-delhi', 'North West Delhi'),
  z('delhi', 'east-delhi', 'East Delhi', [], ['110092']),
  z('delhi', 'north-east-delhi', 'North East Delhi'),
  // Noida
  z('noida', 'noida-central', 'Noida Central', ['Sectors 1-63'], ['201301']),
  z('noida', 'noida-expressway', 'Noida Expressway', ['Noida-Greater Noida Expressway']),
  // Greater Noida (outskirts zone folded into central — see ASSUMPTIONS.md #18)
  z('greater-noida', 'greater-noida-west', 'Greater Noida West', ['Noida Extension'], ['201306']),
  z('greater-noida', 'greater-noida-central', 'Greater Noida Central', [], ['203201']),
  // Gurgaon (manesar zone folded into new-gurgaon — see ASSUMPTIONS.md #18)
  z('gurgaon', 'dlf-golf-course-road', 'DLF & Golf Course Road'),
  z('gurgaon', 'sohna-road-south-city', 'Sohna Road & South City'),
  z('gurgaon', 'new-gurgaon', 'New Gurgaon', [], ['122505']),
  z('gurgaon', 'old-gurgaon', 'Old Gurgaon', ['Gurgaon Main'], ['122001']),
  // Mumbai
  z('mumbai', 'south-mumbai', 'South Mumbai', ['SoBo']),
  z('mumbai', 'central-mumbai', 'Central Mumbai'),
  z('mumbai', 'western-suburbs', 'Western Suburbs'),
  z('mumbai', 'eastern-suburbs', 'Eastern Suburbs'),
  z('mumbai', 'navi-mumbai', 'Navi Mumbai'),
  // Pune
  z('pune', 'pune-west', 'West Pune'),
  z('pune', 'pune-central', 'Central Pune'),
  z('pune', 'pune-east', 'East Pune'),
  z('pune', 'pune-south', 'South Pune'),
  z('pune', 'pcmc', 'Pimpri-Chinchwad', ['PCMC']),
  // Bangalore
  z('bangalore', 'bangalore-east', 'East Bangalore'),
  z('bangalore', 'bangalore-south-east', 'South East Bangalore'),
  z('bangalore', 'bangalore-south', 'South Bangalore'),
  z('bangalore', 'bangalore-central', 'Central Bangalore', [], ['560001']),
  z('bangalore', 'bangalore-north', 'North Bangalore'),
  z('bangalore', 'bangalore-west', 'West Bangalore'),
  // Mangalore
  z('mangalore', 'mangalore-city', 'Mangalore City', [], ['575001', '575036']),
  z('mangalore', 'mangalore-north', 'Mangalore North', ['Surathkal belt']),
  z('mangalore', 'mangalore-south', 'Mangalore South', ['Ullal belt']),
];

export { UPDATED as ZONES_UPDATED_AT };
