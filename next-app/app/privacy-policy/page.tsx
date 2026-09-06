import type { Metadata } from 'next';
import Link from 'next/link';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';

export const dynamic = 'force-static';

export const metadata: Metadata = staticMetadata({
  title: 'Privacy Policy',
  description: 'MyBuddyMaid Privacy Policy — how we collect, use, and protect your personal information.',
  path: '/privacy-policy',
});

export default function PrivacyPolicyPage() {
  return (
    <>
      <section className="static-hero">
        <div className="container">
          <h1>Privacy Policy</h1>
          <p>Last updated: August 2026</p>
        </div>
      </section>
      <div className="container"><nav className="seo-breadcrumb"><Link href="/">Home</Link> <span>›</span> <strong>Privacy Policy</strong></nav></div>
      <section className="static-content">
        <div className="container">
          <article className="static-article legal">
            <h2>1. Information We Collect</h2>
            <p>We collect information you provide directly: name, phone number, email, address, and service preferences when you create an account or book a service.</p>
            <h2>2. How We Use Your Information</h2>
            <p>Your information is used to: match you with verified professionals, process bookings and payments, communicate service updates, and improve our platform.</p>
            <h2>3. Information Sharing</h2>
            <p>We share your information only with: the assigned home help professional (contact details for coordination), payment processors (Razorpay), and as required by law.</p>
            <h2>4. Data Security</h2>
            <p>We implement industry-standard security measures including encryption, secure servers, and access controls to protect your personal information.</p>
            <h2>5. Cookies</h2>
            <p>We use essential cookies for authentication and analytics cookies (Google Analytics, Umami) to improve our services. You can disable analytics cookies in your browser settings.</p>
            <h2>6. Your Rights</h2>
            <p>You may request access to, correction of, or deletion of your personal data by contacting us at info@mybuddymaid.in.</p>
            <h2>7. Contact</h2>
            <p>For privacy-related questions, email us at <a href="mailto:info@mybuddymaid.in">info@mybuddymaid.in</a> or call +91 9355114869.</p>
          </article>
        </div>
      </section>
    </>
  );
}
