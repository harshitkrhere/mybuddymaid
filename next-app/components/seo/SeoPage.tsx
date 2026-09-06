// components/seo/SeoPage.tsx — renders any PageModel (server component). Everything
// SEO-relevant is in the HTML response: content, links, JSON-LD. Only the CTA buttons
// and the lead form are client components.
import type { PageModel } from '@/lib/seo-engine/compose';
import { inr } from '@/lib/seo-engine/compose';
import { CITIES, ALL_LOCALITIES, SERVICES } from '@/data/seo';
import { JsonLd } from './JsonLd';
import { CtaButtons, StickyCta } from './CtaButtons';
import { LeadForm } from './LeadForm';

const LEADS_ENABLED = process.env.NEXT_PUBLIC_LEADS_ENABLED === 'true';

const TRUST_LINKS = [
  { href: '/how-we-verify', label: 'How we verify' },
  { href: '/replacement-policy', label: 'Replacement policy' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function SeoPage({ model, children }: { model: PageModel; children?: React.ReactNode }) {
  const m = model;
  const options = LEADS_ENABLED
    ? {
        cities: CITIES.map((c) => ({ slug: c.slug, name: c.name })),
        localities: ALL_LOCALITIES.map((l) => ({ slug: l.slug, name: l.name, city: l.city })),
        services: SERVICES.map((s) => ({ slug: s.slug, name: s.name })),
      }
    : null;
  return (
    <>
      <JsonLd data={m.jsonld} />
      <nav aria-label="Breadcrumb" className="crumbs">
        <ol>
          {m.crumbs.map((c, i) => (
            <li key={c.path}>
              {i < m.crumbs.length - 1 ? <a href={c.path}>{c.name}</a> : <span aria-current="page">{c.name}</span>}
            </li>
          ))}
        </ol>
      </nav>

      <header className="hero">
        <h1>{m.hero.h1}</h1>
        <p className="hero__tagline">{m.hero.tagline}</p>
        <ul className="badges">
          {m.hero.badges.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <CtaButtons ctx={m.cta} />
        {options && <LeadForm ctx={m.cta} options={options} />}
      </header>

      <main className="content">
        {children}
        {m.sections.slice(0, 2).map((s) => (
          <Section key={s.id} s={s} />
        ))}

        {m.serviceCards.length > 0 && (
          <section className="cards" id="services">
            <h2>{m.type === 'home' ? 'What you can book' : `Services available in ${m.crumbs[m.crumbs.length - 1].name}`}</h2>
            <ul className="card-grid">
              {m.serviceCards.map((c) => (
                <li key={c.path} className="card">
                  <h3>
                    <a href={c.path}>{c.service.name}</a>
                  </h3>
                  <p>{c.service.shortDescription}</p>
                  <p className="card__price">from {inr(c.from)}/month</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {m.sections.slice(2).map((s) => (
          <Section key={s.id} s={s} />
        ))}

        {m.pricing && (
          <section className="pricing" id="pricing">
            <h2>Indicative pricing</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Indicative band</th>
                  </tr>
                </thead>
                <tbody>
                  {m.pricing.rows.map((r) => (
                    <tr key={r.service.slug}>
                      <td>{r.path ? <a href={r.path}>{r.service.name}</a> : r.service.name}</td>
                      <td>
                        {inr(r.from)} – {inr(r.to)} / {r.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">{m.pricing.note}</p>
            <p>What moves the price:</p>
            <ul>
              {m.pricing.factors.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p>
              See the full <a href="/pricing">pricing page</a> for plans.
            </p>
          </section>
        )}

        {m.faqs.length > 0 && (
          <section className="faqs" id="faqs">
            <h2>Frequently asked questions</h2>
            {m.faqs.map((f) => (
              <details key={f.id} className="faq" open={false}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </section>
        )}

        {m.nearby.length > 0 && (
          <section className="nearby" id="nearby">
            <h2>{nearbyHeading(m)}</h2>
            <ul className="link-list">
              {m.nearby.map((n) => (
                <li key={n.path}>
                  <a href={n.path}>{n.anchor}</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {m.related.length > 0 && (
          <section className="related">
            <h2>{relatedHeading(m)}</h2>
            <ul className="link-list">
              {m.related.map((n) => (
                <li key={n.path}>
                  <a href={n.path}>{n.anchor}</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="trust-links">
          <h2>Why families trust MyBuddyMaid</h2>
          <ul className="link-list">
            {TRUST_LINKS.map((t) => (
              <li key={t.href}>
                <a href={t.href}>{t.label}</a>
              </li>
            ))}
          </ul>
        </section>

        <section className="final-cta">
          <h2>Ready to book?</h2>
          <p>Message us on WhatsApp with your requirement, or call — we reply during working hours.</p>
          <CtaButtons ctx={m.cta} />
        </section>
      </main>
      <StickyCta ctx={m.cta} />
    </>
  );
}

function Section({ s }: { s: PageModel['sections'][number] }) {
  if (!s.paragraphs.length && !s.bullets?.length) return null;
  return (
    <section id={s.id} className="section">
      <h2>{s.heading}</h2>
      {s.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {s.bullets && (
        <ul>
          {s.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function nearbyHeading(m: PageModel): string {
  switch (m.type) {
    case 'locality':
      return 'Nearby areas we serve';
    case 'service-locality':
      return 'Same service in nearby areas';
    case 'zone':
      return 'Localities in this zone';
    case 'city':
      return 'Most requested areas';
    case 'service-city':
      return 'Choose your area';
    case 'pincode':
      return 'Localities under this pincode';
    default:
      return 'Cities we serve';
  }
}

function relatedHeading(m: PageModel): string {
  switch (m.type) {
    case 'locality':
      return 'Zone and city';
    case 'service-locality':
      return 'Other services in this area';
    case 'zone':
      return 'Services and adjacent zones';
    case 'city':
      return 'Zones';
    case 'service-city':
      return 'Other services';
    case 'pincode':
      return 'Nearby pincodes';
    default:
      return 'Related';
  }
}
