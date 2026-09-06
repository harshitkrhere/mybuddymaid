// components/seo/TrustPage.tsx — shared shell for the five trust pages. They carry the
// site-wide Organization schema (from the root layout) plus their own breadcrumbs, and
// are linked from every location page.
import Link from 'next/link';
import { JsonLd } from './JsonLd';
import { breadcrumbLd } from '@/lib/seo-engine/jsonld';
import { CtaButtons } from './CtaButtons';

export function TrustPage({
  title,
  intro,
  path,
  children,
}: {
  title: string;
  intro: string;
  path: string;
  children: React.ReactNode;
}) {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: title, path },
  ];
  return (
    <>
      <JsonLd data={[breadcrumbLd(crumbs)]} />
      <nav aria-label="Breadcrumb" className="crumbs">
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <span aria-current="page">{title}</span>
          </li>
        </ol>
      </nav>
      <main className="content prose">
        <h1>{title}</h1>
        <p className="hero__tagline">{intro}</p>
        {children}
        <section className="final-cta">
          <h2>Questions about this?</h2>
          <p>Message us on WhatsApp or call and we will walk you through it.</p>
          <CtaButtons ctx={{ whatsappText: `Hi MyBuddyMaid, I have a question about ${title.toLowerCase()}.`, city: '' }} compact />
        </section>
      </main>
    </>
  );
}
