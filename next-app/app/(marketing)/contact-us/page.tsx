import type { Metadata } from 'next';
import Link from 'next/link';
import { generatePageMetadata } from '@/lib/seo/metadata';
import { organizationSchema, breadcrumbSchema, JsonLd } from '@/lib/seo/schema';
import '@/styles/static-pages.css';

export const metadata: Metadata = generatePageMetadata({
  title: 'Contact Us',
  description: 'Get in touch with MyBuddyMaid. Call +91 9599390188, email info@mybuddymaid.in, or WhatsApp us for verified maid, cook, nanny & elderly care services.',
  path: '/contact-us',
});

export default function ContactPage() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Contact Us', url: '/contact-us' },
      ])} />

      <section className="static-hero">
        <div className="container">
          <h1>Contact Us</h1>
          <p>We&apos;re here to help you find the perfect home help professional.</p>
        </div>
      </section>

      <div className="container">
        <nav className="seo-breadcrumb">
          <Link href="/">Home</Link> <span>›</span> <strong>Contact Us</strong>
        </nav>
      </div>

      <section className="static-content">
        <div className="container">
          <article className="static-article">
            <div className="contact-grid">
              <div className="contact-card">
                <div className="contact-icon">📞</div>
                <h3>Phone</h3>
                <a href="tel:+919599390188">+91 9599390188</a>
                <p>Mon–Sun, 8 AM – 9 PM IST</p>
              </div>
              <div className="contact-card">
                <div className="contact-icon">💬</div>
                <h3>WhatsApp</h3>
                <a href="https://wa.me/919599390188" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>
                <p>Fastest response — usually within 5 minutes</p>
              </div>
              <div className="contact-card">
                <div className="contact-icon">📧</div>
                <h3>Email</h3>
                <a href="mailto:info@mybuddymaid.in">info@mybuddymaid.in</a>
                <p>We respond within 24 hours</p>
              </div>
            </div>

            <h2>Our Office</h2>
            <p>175, 5th Floor, Main Road, Chandra Layout<br />Bengaluru, Karnataka 560040<br />India</p>

            <div className="static-cta">
              <h3>Need Home Help Urgently?</h3>
              <p>We can deploy a verified professional within 24 hours.</p>
              <Link href="/home" className="btn btn-primary">Book Now</Link>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
