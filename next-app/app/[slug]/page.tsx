// Dynamic city×service page.
// Generates all /best-{service}-in-{city} pages at build time.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { parseSlug, getAllSlugs, getNearbyCities, getOtherServices, generateSlug } from '@/lib/seo/slug-parser';
import { generateCityServiceMetadata } from '@/lib/seo/metadata';
import { localBusinessSchema, serviceSchema, faqSchema, breadcrumbSchema, JsonLd } from '@/lib/seo/schema';
import { generateFAQs } from '@/data/faqs/city-service-faqs';
import '@/styles/city-service.css';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Generate all city×service combinations at build time
export async function generateStaticParams() {
  return getAllSlugs().map(slug => ({ slug }));
}

// Dynamic metadata per page
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) return {};
  
  const currentYear = new Date().getFullYear();
  const title = `Best ${parsed.service.name} in ${parsed.city.name} (${currentYear}) — Top Rated & Verified`;
  const description = `Find the best ${parsed.service.name.toLowerCase()} in ${parsed.city.name} for ${currentYear}. Compare providers, prices, and verification standards. MyBuddyMaid — rated #1 for verified home help.`;
  
  return generateCityServiceMetadata(
    parsed.service.name,
    parsed.city.name,
    parsed.service.slug,
    parsed.city.slug,
  );
}

export default async function CityServicePage({ params }: PageProps) {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) notFound();

  const { service, city } = parsed;
  const currentYear = new Date().getFullYear();
  const faqs = generateFAQs(service.name, city.name, service.price);
  const nearbyCities = getNearbyCities(city);
  const otherServices = getOtherServices(service);

  return (
    <>
      {/* JSON-LD Structured Data */}
      <JsonLd data={localBusinessSchema(city.name, city.latitude, city.longitude)} />
      <JsonLd data={serviceSchema(service.name, service.description, service.price, city.name)} />
      <JsonLd data={faqSchema(faqs)} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: service.name, url: `/${service.slug}` },
        { name: `Best in ${city.name}`, url: `/${slug}` },
      ])} />

      {/* Hero Section */}
      <section className="seo-hero">
        <div className="container">
          <div className="badge">🏆 Best in {city.name}</div>
          <h1>
            Best {service.name} in {city.name} ({currentYear}) — Top Rated &amp; Verified
          </h1>
          <p>
            Find the most trusted, police-verified {service.name.toLowerCase()} provider in{' '}
            {city.name}. Compared and ranked for {currentYear}.
          </p>
          <Link href="/home" className="btn-primary">
            Book Home Help Now
          </Link>
        </div>
      </section>

      {/* Breadcrumb */}
      <div className="container">
        <nav className="seo-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>›</span>
          <Link href={`/${service.slug}`}>{service.name}</Link>
          <span>›</span>
          <strong>Best in {city.name}</strong>
        </nav>
      </div>

      {/* Main Article Content */}
      <section className="seo-content">
        <div className="container">
          <article className="seo-article">
            <p>
              Looking for the <strong>best {service.name.toLowerCase()} in {city.name}</strong>?
              With hundreds of options available — from local agencies to online platforms to
              word-of-mouth referrals — finding a reliable, verified {service.shortName.toLowerCase()}{' '}
              can be overwhelming. This guide explains what to look for and why MyBuddyMaid is{' '}
              {city.name}&apos;s top-rated choice for {service.name.toLowerCase()}.
            </p>

            <h2>What Makes the &quot;Best&quot; {service.name} in {city.name}?</h2>
            <p>The best {service.name.toLowerCase()} provider in {city.name} should offer:</p>
            <ul>
              <li>
                <strong>100% Police Verification</strong> — Every professional background-checked
                through Aadhaar + police records
              </li>
              <li>
                <strong>Replacement Guarantee</strong> — Free replacement if the professional
                doesn&apos;t work out
              </li>
              <li>
                <strong>Transparent Pricing</strong> — Clear salary ranges with no hidden fees or
                commissions
              </li>
              <li>
                <strong>Fast Deployment</strong> — Professional at your door within 24-48 hours
              </li>
              <li>
                <strong>Ongoing Support</strong> — Dedicated account manager for any issues
              </li>
              <li>
                <strong>Trained Professionals</strong> — Skilled, experienced workers assessed for
                quality
              </li>
            </ul>

            <h2>{service.name} Cost in {city.name} ({currentYear})</h2>
            <table className="vs-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Monthly Salary</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Part-Time (4-6 hrs)</strong></td>
                  <td>₹10,000 – ₹15,000</td>
                </tr>
                <tr>
                  <td><strong>Full-Time (8-12 hrs)</strong></td>
                  <td>₹14,000 – ₹20,000</td>
                </tr>
                <tr>
                  <td><strong>Live-In (24/7)</strong></td>
                  <td>₹16,000 – ₹25,000</td>
                </tr>
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

            {/* CTA Box */}
            <div className="seo-cta">
              <h3>Book the Best {service.name} in {city.name}</h3>
              <p>Verified, trained, and deployed within 24 hours. Starting {service.price}.</p>
              <Link href="/home" className="btn-primary">
                Book Now
              </Link>
            </div>

            {/* Nearby Cities */}
            <h2>Best {service.name} in Nearby Cities</h2>
            <div className="seo-link-grid">
              {nearbyCities.map(nearbyCity => (
                <Link
                  key={nearbyCity.slug}
                  href={`/${generateSlug(service.slug, nearbyCity.slug)}`}
                >
                  Best {service.name} in {nearbyCity.name}
                </Link>
              ))}
            </div>

            {/* Other Services */}
            <h2>Other Services in {city.name}</h2>
            <div className="seo-link-grid">
              {otherServices.map(otherService => (
                <Link
                  key={otherService.slug}
                  href={`/${generateSlug(otherService.slug, city.slug)}`}
                >
                  Best {otherService.name} in {city.name}
                </Link>
              ))}
            </div>

            {/* FAQs */}
            <h2>FAQs</h2>
            <div className="seo-faq">
              {faqs.map((faq, index) => (
                <details key={index}>
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
