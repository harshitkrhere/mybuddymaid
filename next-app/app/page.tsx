import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { SERVICES } from '@/data/services';
import { PRIMARY_CITIES } from '@/data/cities';
import { generatePageMetadata } from '@/lib/seo/metadata';
import { organizationSchema, JsonLd } from '@/lib/seo/schema';
import '@/styles/home.css';

export const metadata: Metadata = generatePageMetadata({
  title: 'Verified Maid Service in Delhi NCR, Mumbai & Bangalore — MyBuddyMaid | Book Online',
  description: 'Book 100% police-verified maids, cooks, nannies & elderly care helpers in Delhi NCR, Mumbai & Bangalore. 1-year free replacement guarantee. Trusted by 12,000+ families. Starting ₹2,499.',
  path: '/',
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationSchema()} />

      {/* ── HERO ── */}
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-text">
            <span className="hero-badge">🏆 India&apos;s Most Trusted Home Help Platform</span>
            <h1>Verified Maids, Cooks &amp; Caregivers — <span className="text-mint">Delivered to Your Door</span></h1>
            <p>100% police-verified professionals. 1-year free replacement guarantee. Trusted by <strong>12,000+ families</strong> across 40+ cities.</p>
            <div className="hero-cta-group">
              <Link href="/home" className="btn btn-primary btn-lg">Book Home Help Now</Link>
              <Link href="/cities" className="btn btn-outline btn-lg">View All Cities →</Link>
            </div>
            <div className="hero-trust-badges">
              <span>✅ Police Verified</span>
              <span>✅ 1-Year Replacement</span>
              <span>✅ 24hr Deployment</span>
            </div>
          </div>
          <div className="hero-image">
            <Image src="/hero-new.png" alt="Trusted home help professionals" width={600} height={600} priority />
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="services-section" id="services">
        <div className="container">
          <h2 className="section-title">Our Services</h2>
          <p className="section-subtitle">Choose from 6 categories of verified home help professionals</p>
          <div className="services-grid">
            {SERVICES.map(service => (
              <Link href={`/${service.slug}`} key={service.id} className="service-card">
                <div className="service-icon">{service.icon}</div>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <span className="service-price">{service.price}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="how-section">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">3 simple steps to find your perfect home help</p>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Choose Your Service</h3>
              <p>Select from maids, cooks, nannies, elderly care, or postnatal care</p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>We Match &amp; Verify</h3>
              <p>We find the best match from our pool of police-verified professionals</p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>They Start Working</h3>
              <p>Your verified professional arrives within 24-48 hours. Free replacement if needed</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-row">
            <div className="stat-item"><span className="stat-num">12,000+</span><span className="stat-text">Families Served</span></div>
            <div className="stat-item"><span className="stat-num">40+</span><span className="stat-text">Cities</span></div>
            <div className="stat-item"><span className="stat-num">100%</span><span className="stat-text">Police Verified</span></div>
            <div className="stat-item"><span className="stat-num">1 Year</span><span className="stat-text">Free Replacement</span></div>
          </div>
        </div>
      </section>

      {/* ── CITIES ── */}
      <section className="cities-section">
        <div className="container">
          <h2 className="section-title">We Serve 40+ Cities</h2>
          <div className="seo-link-grid">
            {PRIMARY_CITIES.map(city => (
              <Link href={`/best-maid-service-in-${city.slug}`} key={city.slug}>⭐ Maid Service in {city.name}</Link>
            ))}
            <Link href="/cities" className="view-all-link">View All Cities →</Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="final-cta">
        <div className="container">
          <h2>Ready to Find Your Perfect Home Help?</h2>
          <p>Join 12,000+ families who trust MyBuddyMaid for reliable, verified domestic help.</p>
          <Link href="/home" className="btn btn-primary btn-lg">Book Now — Free Consultation</Link>
        </div>
      </section>
    </>
  );
}
