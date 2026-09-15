import type { Metadata } from 'next';
import Link from 'next/link';
import { SERVICES, CITIES } from '@/data/seo';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbLd } from '@/lib/seo-engine/jsonld';
import { inr } from '@/lib/seo-engine/compose';
import { CtaButtons, StickyCta, siteContext } from '@/components/seo/CtaButtons';
import { GENERIC_WHATSAPP_TEXT } from '@/lib/blog/links';

export const dynamic = 'force-static';

export const metadata: Metadata = staticMetadata({
  title: 'Services – Maids, Cooks, Nannies & Elder Care',
  description: 'All MyBuddyMaid services: full-time and part-time maids, cooks, babysitters and nannies, elder care and domestic help — verified helpers with a replacement policy.',
  path: '/services',
});

export default function ServicesIndex() {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
  ];
  const cta = siteContext(GENERIC_WHATSAPP_TEXT);
  return (
    <>
      <JsonLd data={[breadcrumbLd(crumbs)]} />
      <main className="content">
        <h1>Services</h1>
        <p className="hero__tagline">Six services, verified helpers, one replacement policy. Every service has a national page and a page for each city and locality we serve.</p>
        <ul className="card-grid">
          <li className="card">
            <h3>
              <Link href="/services/maid-service">Maid service</Link>
            </h3>
            <p>The umbrella page: how maid placement works and where we serve.</p>
          </li>
          {SERVICES.map((s) => (
            <li key={s.slug} className="card">
              <h3>
                <Link href={`/services/${s.slug}`}>{s.name}</Link>
              </h3>
              <p>{s.shortDescription}</p>
              <p className="card__price">from {inr(s.pricing.metro.from)}/month</p>
            </li>
          ))}
        </ul>
        <section className="final-cta">
          <h2>Ready to book?</h2>
          <p>Message us on WhatsApp with your requirement, or call — we reply during working hours.</p>
          <CtaButtons ctx={cta} />
        </section>
        <h2>By city</h2>
        <ul className="link-list">
          {CITIES.map((c) => (
            <li key={c.slug}>
              <Link href={`/${c.slug}`}>maid service in {c.name}</Link>
            </li>
          ))}
        </ul>
      </main>
      <StickyCta ctx={cta} />
    </>
  );
}
