import type { Metadata } from 'next';
import Link from 'next/link';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';

export const dynamic = 'force-static';

export const metadata: Metadata = staticMetadata({
  title: 'Terms of Service',
  description: 'MyBuddyMaid Terms of Service — conditions for using our home help services platform.',
  path: '/terms-of-service',
});

export default function TermsPage() {
  return (
    <>
      <section className="static-hero">
        <div className="container">
          <h1>Terms of Service</h1>
          <p>Last updated: August 2026</p>
        </div>
      </section>
      <div className="container"><nav className="seo-breadcrumb"><Link href="/">Home</Link> <span>›</span> <strong>Terms of Service</strong></nav></div>
      <section className="static-content">
        <div className="container">
          <article className="static-article legal">
            <h2>1. Service Overview</h2>
            <p>MyBuddyMaid is a platform that connects families with verified home help professionals including maids, cooks, nannies, elderly care providers, and postnatal care specialists.</p>
            <h2>2. User Accounts</h2>
            <p>You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your account credentials.</p>
            <h2>3. Booking & Payments</h2>
            <p>Bookings are confirmed upon payment. All payments are processed securely through Razorpay. Prices are displayed in Indian Rupees (INR).</p>
            <h2>4. Replacement Guarantee</h2>
            <p>We offer free replacements within the guarantee period of your plan (10–18 months depending on the plan). Replacement requests must be made through the platform or by contacting support.</p>
            <h2>5. Cancellation & Refunds</h2>
            <p>Cancellation requests are processed within 7 business days. Refund eligibility depends on the stage of service and is assessed on a case-by-case basis.</p>
            <h2>6. Liability</h2>
            <p>MyBuddyMaid acts as a marketplace connecting families with professionals. While we verify all professionals, we are not liable for actions performed by them outside the scope of their engagement.</p>
            <h2>7. Governing Law</h2>
            <p>These terms are governed by the laws of India. Any disputes shall be resolved through arbitration in Bengaluru, Karnataka.</p>
            <h2>8. Contact</h2>
            <p>Questions about these terms? Contact us at <a href="mailto:info@mybuddymaid.in">info@mybuddymaid.in</a> or +91 9355114869.</p>
          </article>
        </div>
      </section>
    </>
  );
}
