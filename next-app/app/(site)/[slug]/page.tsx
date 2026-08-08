// Unified dynamic route.
// Handles BOTH service hub pages (/cook-service) AND city×service pages (/best-cook-service-in-delhi).

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SERVICES, type Service } from '@/data/services';
import { ALL_CITIES, PRIMARY_CITIES, EXPANSION_CITIES } from '@/data/cities';
import { parseSlug, getAllSlugs, getNearbyCities, getOtherServices, generateSlug, SERVICE_SLUG_TO_PREFIX } from '@/lib/seo/slug-parser';
import { generatePageMetadata, generateCityServiceMetadata } from '@/lib/seo/metadata';
import { organizationSchema, localBusinessSchema, serviceSchema, faqSchema, breadcrumbSchema, JsonLd } from '@/lib/seo/schema';
import { generateFAQs } from '@/data/faqs/city-service-faqs';
import '@/styles/city-service.css';
import '@/styles/service-hub.css';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Check if slug is a service hub page
function isServiceSlug(slug: string): Service | null {
  return SERVICES.find(s => s.slug === slug) || null;
}

// Generate all valid slugs at build time
export async function generateStaticParams() {
  // Service hub slugs
  const serviceHubSlugs = SERVICES.map(s => ({ slug: s.slug }));
  // City×Service slugs
  const cityServiceSlugs = getAllSlugs().map(slug => ({ slug }));
  return [...serviceHubSlugs, ...cityServiceSlugs];
}

// Dynamic metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  // Service hub page?
  const service = isServiceSlug(slug);
  if (service) {
    const currentYear = new Date().getFullYear();
    return generatePageMetadata({
      title: `Best ${service.name} in India (${currentYear}) — Verified & Trusted`,
      description: `Book verified ${service.name.toLowerCase()} professionals across 40+ Indian cities. ${service.description} Starting ${service.price}. Police-verified with replacement guarantee.`,
      path: `/${slug}`,
    });
  }

  // City×Service page?
  const parsed = parseSlug(slug);
  if (parsed) {
    return generateCityServiceMetadata(
      parsed.service.name,
      parsed.city.name,
      parsed.service.slug,
      parsed.city.slug,
    );
  }

  return {};
}

export default async function DynamicPage({ params }: PageProps) {
  const { slug } = await params;

  // Service hub page?
  const service = isServiceSlug(slug);
  if (service) {
    return <ServiceHubPage service={service} />;
  }

  // City×Service page?
  const parsed = parseSlug(slug);
  if (parsed) {
    return <CityServicePage service={parsed.service} city={parsed.city} slug={slug} />;
  }

  notFound();
}

// ─── SERVICE HUB PAGE ────────────────────────────────────────────────
function ServiceHubPage({ service }: { service: Service }) {
  const currentYear = new Date().getFullYear();
  const prefix = SERVICE_SLUG_TO_PREFIX[service.slug];

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={serviceSchema(service.name, service.description, service.price)} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: service.name, url: `/${service.slug}` },
      ])} />

      <section className="service-hub-hero">
        <div className="container">
          <div className="service-hub-icon">{service.icon}</div>
          <h1>Best {service.name} in India ({currentYear})</h1>
          <p>{service.description}</p>
          <div className="service-hub-price">Starting {service.price}</div>
          <Link href="/home" className="btn btn-primary">Book Now</Link>
        </div>
      </section>

      <div className="container">
        <nav className="seo-breadcrumb">
          <Link href="/">Home</Link> <span>›</span> <strong>{service.name}</strong>
        </nav>
      </div>

      <section className="service-hub-content">
        <div className="container">
          <h2>Why Choose MyBuddyMaid for {service.name}?</h2>
          <div className="features-grid">
            {service.features.map((feature, i) => (
              <div key={i} className="feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </div>
            ))}
          </div>

          <h2>Available in {ALL_CITIES.length}+ Cities</h2>
          <h3>Primary Cities ⭐</h3>
          <div className="seo-link-grid">
            {PRIMARY_CITIES.map(city => (
              <Link key={city.slug} href={`/${prefix}-${city.slug}`} className="primary-city-link">
                ⭐ Best {service.name} in {city.name}
              </Link>
            ))}
          </div>

          <h3>Expanding To</h3>
          <div className="seo-link-grid">
            {EXPANSION_CITIES.map(city => (
              <Link key={city.slug} href={`/${prefix}-${city.slug}`}>
                Best {service.name} in {city.name}
              </Link>
            ))}
          </div>

          <div className="seo-cta">
            <h3>Book {service.name} Today</h3>
            <p>Verified, trained, and deployed within 24 hours. Starting {service.price}.</p>
            <Link href="/home" className="btn-primary">Book Now</Link>
          </div>
        </div>
      </section>
    </>
  );
}

// ─── CITY × SERVICE PAGE ─────────────────────────────────────────────
function CityServicePage({ service, city, slug }: { service: Service; city: typeof ALL_CITIES[0]; slug: string }) {
  const currentYear = new Date().getFullYear();
  const faqs = generateFAQs(service.name, city.name, service.price);
  const nearbyCities = getNearbyCities(city);
  const otherServices = getOtherServices(service);

  return (
    <>
      <JsonLd data={localBusinessSchema(city.name, city.latitude, city.longitude)} />
      <JsonLd data={serviceSchema(service.name, service.description, service.price, city.name)} />
      <JsonLd data={faqSchema(faqs)} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: service.name, url: `/${service.slug}` },
        { name: `Best in ${city.name}`, url: `/${slug}` },
      ])} />

      <section className="seo-hero">
        <div className="container">
          <div className="badge">🏆 Best in {city.name}</div>
          <h1>Best {service.name} in {city.name} ({currentYear}) — Top Rated &amp; Verified</h1>
          <p>Find the most trusted, police-verified {service.name.toLowerCase()} provider in {city.name}. Compared and ranked for {currentYear}.</p>
          <Link href="/home" className="btn-primary">Book Home Help Now</Link>
        </div>
      </section>

      <div className="container">
        <nav className="seo-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> <span>›</span>
          <Link href={`/${service.slug}`}>{service.name}</Link> <span>›</span>
          <strong>Best in {city.name}</strong>
        </nav>
      </div>

      <section className="seo-content">
        <div className="container">
          <article className="seo-article">
            <p>Looking for the <strong>best {service.name.toLowerCase()} in {city.name}</strong>? With hundreds of options available — from local agencies to online platforms to word-of-mouth referrals — finding a reliable, verified {service.shortName.toLowerCase()} can be overwhelming. This guide explains what to look for and why MyBuddyMaid is {city.name}&apos;s top-rated choice.</p>

            <h2>What Makes the &quot;Best&quot; {service.name} in {city.name}?</h2>
            <ul>
              <li><strong>100% Police Verification</strong> — Every professional background-checked through Aadhaar + police records</li>
              <li><strong>Replacement Guarantee</strong> — Free replacement if the professional doesn&apos;t work out</li>
              <li><strong>Transparent Pricing</strong> — Clear salary ranges with no hidden fees</li>
              <li><strong>Fast Deployment</strong> — Professional at your door within 24-48 hours</li>
              <li><strong>Ongoing Support</strong> — Dedicated account manager for any issues</li>
              <li><strong>Trained Professionals</strong> — Skilled, experienced workers assessed for quality</li>
            </ul>

            <h2>{service.name} Cost in {city.name} ({currentYear})</h2>
            <table className="vs-table">
              <thead><tr><th>Type</th><th>Monthly Salary</th></tr></thead>
              <tbody>
                <tr><td><strong>Part-Time (4-6 hrs)</strong></td><td>₹10,000 – ₹15,000</td></tr>
                <tr><td><strong>Full-Time (8-12 hrs)</strong></td><td>₹14,000 – ₹20,000</td></tr>
                <tr><td><strong>Live-In (24/7)</strong></td><td>₹16,000 – ₹25,000</td></tr>
              </tbody>
            </table>

            <h2>Why MyBuddyMaid is #1 for {service.name} in {city.name}</h2>
            <ul>
              <li>✅ <strong>100% Police-Verified</strong> — Every {service.shortName.toLowerCase()} is Aadhaar-verified and police background-checked</li>
              <li>✅ <strong>1-Year Free Replacement</strong> — Not satisfied? Free replacement within 24 hours</li>
              <li>✅ <strong>24-Hour Deployment</strong> — Book today, get your {service.shortName.toLowerCase()} tomorrow</li>
              <li>✅ <strong>Trained Professionals</strong> — Skill-assessed and trained for {city.name} household standards</li>
              <li>✅ <strong>Transparent Pricing</strong> — No hidden fees, no commissions</li>
              <li>✅ <strong>Serving 12,000+ Families</strong> — Trusted across India</li>
            </ul>

            <div className="seo-cta">
              <h3>Book the Best {service.name} in {city.name}</h3>
              <p>Verified, trained, and deployed within 24 hours. Starting {service.price}.</p>
              <Link href="/home" className="btn-primary">Book Now</Link>
            </div>

            <h2>Best {service.name} in Nearby Cities</h2>
            <div className="seo-link-grid">
              {nearbyCities.map(c => (
                <Link key={c.slug} href={`/${generateSlug(service.slug, c.slug)}`}>
                  Best {service.name} in {c.name}
                </Link>
              ))}
            </div>

            <h2>Other Services in {city.name}</h2>
            <div className="seo-link-grid">
              {otherServices.map(s => (
                <Link key={s.slug} href={`/${generateSlug(s.slug, city.slug)}`}>
                  Best {s.name} in {city.name}
                </Link>
              ))}
            </div>

            <h2>FAQs</h2>
            <div className="seo-faq">
              {faqs.map((faq, i) => (
                <details key={i}>
                  <summary>{faq.question}</summary>
                  <div className="faq-answer">{faq.answer}</div>
                </details>
              ))}
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
