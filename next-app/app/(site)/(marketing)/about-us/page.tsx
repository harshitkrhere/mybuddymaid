import type { Metadata } from 'next';
import Link from 'next/link';
import { generatePageMetadata } from '@/lib/seo/metadata';
import { organizationSchema, breadcrumbSchema, JsonLd } from '@/lib/seo/schema';
import '@/styles/static-pages.css';

export const metadata: Metadata = generatePageMetadata({
  title: 'About Us',
  description: 'MyBuddyMaid is India\'s premier network of police-verified maids, cooks, nannies & elderly care professionals. Trusted by 12,000+ families across 40+ cities.',
  path: '/about-us',
});

export default function AboutPage() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'About Us', url: '/about-us' },
      ])} />

      <section className="static-hero">
        <div className="container">
          <h1>About MyBuddyMaid</h1>
          <p>India&apos;s most trusted network of police-verified home help professionals.</p>
        </div>
      </section>

      <div className="container">
        <nav className="seo-breadcrumb">
          <Link href="/">Home</Link> <span>›</span> <strong>About Us</strong>
        </nav>
      </div>

      <section className="static-content">
        <div className="container">
          <article className="static-article">
            <h2>Our Mission</h2>
            <p>MyBuddyMaid was founded with a simple mission: to make finding trustworthy home help as easy as booking a cab. We believe every family deserves access to verified, skilled, and compassionate domestic professionals.</p>

            <div className="stats-grid">
              <div className="stat-card"><div className="stat-number">12,000+</div><div className="stat-label">Families Served</div></div>
              <div className="stat-card"><div className="stat-number">40+</div><div className="stat-label">Cities</div></div>
              <div className="stat-card"><div className="stat-number">6</div><div className="stat-label">Service Categories</div></div>
              <div className="stat-card"><div className="stat-number">100%</div><div className="stat-label">Police Verified</div></div>
            </div>

            <h2>Why Families Trust Us</h2>
            <ul>
              <li><strong>100% Police Verification</strong> — Every professional undergoes Aadhaar validation and police background checks.</li>
              <li><strong>1-Year Replacement Guarantee</strong> — Free replacement if a professional doesn&apos;t meet expectations.</li>
              <li><strong>24-Hour Deployment</strong> — Pre-verified candidates for rapid placement.</li>
              <li><strong>Transparent Pricing</strong> — No hidden fees. Plans starting at ₹2,499.</li>
              <li><strong>Dedicated Support</strong> — Every family gets a relationship manager.</li>
            </ul>

            <div className="static-cta">
              <h3>Ready to Find Your Perfect Home Help?</h3>
              <p>Join 12,000+ families who trust MyBuddyMaid.</p>
              <Link href="/home" className="btn btn-primary">Book Now</Link>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
