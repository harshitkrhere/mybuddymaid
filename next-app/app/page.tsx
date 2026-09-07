// app/page.tsx — the landing page, restored to the company's original obsidian + mint design
// (dark hero, rounded white cards, Plus Jakarta Sans headings) on top of the SEO skeleton.
//
// Presentation only. Every sentence comes from composeHome(); every number comes from the
// data layer (CITIES, ALL_LOCALITIES, SERVICES, PLANS, BLOG_POSTS). There is no social proof
// of any kind — no customer counts, ratings, reviews or testimonials — because none exists
// in the data layer to render. SeoPage keeps the SEO skeleton (JSON-LD, the breadcrumb nav,
// the single <h1> from homeMeta(), the tracked CTA buttons, the trust links, the closing CTA
// and the sticky bar) and receives a trimmed model so nothing renders twice; this file lays
// out every list itself. Plus Jakarta Sans is loaded here and only here, so no other page
// pays for the second font family. All styling is in styles/home.css under .home.
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Plus_Jakarta_Sans } from 'next/font/google';
import '@/styles/home.css';
import { SeoPage } from '@/components/seo/SeoPage';
import { SalaryEstimator, type EstimatorRow, type EstimatorTier, type EstimatorTierKey } from '@/components/home/SalaryEstimator';
import { Icon, type IconName } from '@/components/home/HomeIcons';
import { composeHome, inr, type PageModel } from '@/lib/seo-engine/compose';
import { metadataFor } from '@/lib/seo-engine/page-metadata';
import { whatsappUrl } from '@/lib/seo-engine/links';
import { ALL_LOCALITIES, CITIES, SERVICES, PLANS, REFUND_WINDOW_DAYS } from '@/data/seo';
import type { ServiceSlug } from '@/data/seo/types';
import { BLOG_POSTS, type BlogPost } from '@/data/blog/posts';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap', variable: '--font-jakarta' });

export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return metadataFor(composeHome(), { ogTitle: 'Verified maids, cooks & nannies', ogSubtitle: 'Delhi NCR · Mumbai · Pune · Bangalore · Mangalore' });
}

// Same href shape and data-mbm-* attribute set as components/seo/CtaButtons.tsx, so the
// delegated click listener in the root layout attributes these clicks like every other CTA.
// The home page has no city context, hence "(none)" everywhere but the service.
const appHref = (service = '') => `/app/auth?city=&locality=&service=${encodeURIComponent(service)}`;
const track = (event: 'app_click' | 'whatsapp_click', service = '') => ({
  'data-mbm-track': event,
  'data-mbm-city': '(none)',
  'data-mbm-zone': '(none)',
  'data-mbm-locality': '(none)',
  'data-mbm-service': service || '(none)',
  'data-mbm-pincode': '(none)',
});

// Photographs already in next-app/public, served through next/image (never hotlinked).
// The two filenames with spaces are URL-encoded; next/image passes them through as-is.
type Photo = { src: string; width: number; height: number; alt: string };
const SERVICE_PHOTOS: Record<ServiceSlug, Photo | null> = {
  'full-time-maid': { src: '/a%20full%20time%20live%20in.jpg', width: 800, height: 533, alt: 'Full-time live-in helper at work in a home' },
  'part-time-maid': { src: '/part%20time%20buddy.jpg', width: 800, height: 1200, alt: 'Part-time helper cleaning a living room' },
  cook: { src: '/cook.jpg', width: 800, height: 640, alt: 'Cook preparing a meal in a home kitchen' },
  'babysitter-nanny': { src: '/babbysitting.jpg', width: 800, height: 1200, alt: 'Nanny looking after a young child' },
  'elder-care': { src: '/eldercare.jpg', width: 800, height: 1200, alt: 'Care helper with an elderly person' },
  'domestic-help': null,
};
const SERVICE_ICONS: Record<ServiceSlug, IconName> = {
  'full-time-maid': 'house',
  'part-time-maid': 'broom',
  cook: 'cook',
  'babysitter-nanny': 'baby',
  'elder-care': 'heart',
  'domestic-help': 'users',
};

// One icon per booking step (tell us → shortlist → confirm).
const STEP_ICONS: IconName[] = ['message', 'search', 'check'];

// The three guides the original landing page featured; falls back to the newest posts if a
// slug is ever removed. Images are the same photographs the original page used.
const HOME_POST_SLUGS = ['find-reliable-maid-delhi', 'elderly-care-at-home-guide', 'maid-vs-cook-vs-nanny'];
const POST_PHOTOS: Photo[] = [
  { src: '/blog-maid-guide.png', width: 1024, height: 1024, alt: 'Helper working in a home kitchen' },
  { src: '/eldercare.jpg', width: 800, height: 1200, alt: 'Care helper with an elderly person' },
  { src: '/cook.jpg', width: 800, height: 640, alt: 'Cook preparing a meal in a home kitchen' },
];
function homePosts(): BlogPost[] {
  const picked = HOME_POST_SLUGS.map((s) => BLOG_POSTS.find((p) => p.slug === s)).filter((p): p is BlogPost => Boolean(p));
  if (picked.length === HOME_POST_SLUGS.length) return picked;
  return [...BLOG_POSTS].sort((a, b) => b.datePublished.localeCompare(a.datePublished)).slice(0, 3);
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${d}, ${y}`;
};
// Some ported categories carry an emoji prefix ("🏙️ Bangalore Guide"); the badge shows the words.
const cleanCategory = (c: string) => c.replace(/^[^A-Za-z]+/, '').trim();

// Salary estimator inputs: one row per service, one tier per group of cities.
const TIER_ORDER: EstimatorTierKey[] = ['metro', 'metro-premium', 'tier-2'];
function estimatorInputs(): { rows: EstimatorRow[]; tiers: EstimatorTier[] } {
  const rows: EstimatorRow[] = SERVICES.map((s) => ({
    slug: s.slug,
    name: s.name,
    bands: {
      'metro-premium': { from: s.pricing['metro-premium'].from, to: s.pricing['metro-premium'].to },
      metro: { from: s.pricing.metro.from, to: s.pricing.metro.to },
      'tier-2': { from: s.pricing['tier-2'].from, to: s.pricing['tier-2'].to },
    },
  }));
  const tiers: EstimatorTier[] = TIER_ORDER.map((key) => ({ key, label: CITIES.filter((c) => c.pricingTier === key).map((c) => c.name).join(', ') })).filter((t) => t.label);
  return { rows, tiers };
}

export default function HomePage() {
  const model = composeHome();
  // SeoPage renders only the hero and closing blocks; every list is laid out below.
  const shell: PageModel = { ...model, sections: [], serviceCards: [], faqs: [], nearby: [], related: [] };
  const section = (id: string) => model.sections.find((s) => s.id === id);
  const intro = section('intro');
  const cities = section('cities');
  const steps = section('how-it-works');
  const verify = section('verify');
  const replacement = section('replacement');
  const posts = homePosts();
  const estimator = estimatorInputs();
  const minTerm = Math.min(...PLANS.map((p) => p.termMonths));
  const maxTerm = Math.max(...PLANS.map((p) => p.termMonths));
  const minReplacements = Math.min(...PLANS.map((p) => p.replacements));
  const maxReplacements = Math.max(...PLANS.map((p) => p.replacements));

  return (
    <div className={`home ${jakarta.variable}`}>
      <SeoPage model={shell}>
        {/* — hero pieces, placed around SeoPage's h1 by the .home grid (DOM order untouched) — */}
        <p className="home-eyebrow">
          <Icon name="shield" size={16} />
          Verified home help in {CITIES.length} cities
        </p>

        <p className="home-anchor">
          <Icon name="tag" size={16} />
          <span>
            Starting at <strong>{inr(PLANS[0].fee)}</strong> one-time fee · monthly salary paid directly to the helper
          </span>
        </p>

        <div className="home-visual">
          <Image src="/hero-new.png" alt="Family at home with a helper serving tea in the living room" width={1024} height={1024} priority quality={75} sizes="(min-width: 992px) 520px, 100vw" />
          <div className="home-visual__card">
            <span className="home-visual__icon">
              <Icon name="clock" size={20} />
            </span>
            <span className="home-visual__text">
              <strong>48 hrs</strong>
              <span>Aim to share a replacement profile</span>
            </span>
          </div>
        </div>

        {/* — facts the data layer holds: no ratings, no counts of customers — */}
        <ul className="home-stats">
          <li>
            <Icon name="map-pin" size={30} />
            <strong>{ALL_LOCALITIES.length} localities</strong>
            <span>Across {CITIES.map((c) => c.name).join(', ')}.</span>
          </li>
          <li>
            <Icon name="broom" size={30} />
            <strong>{SERVICES.length} services</strong>
            <span>{SERVICES.map((s) => s.name).join(' · ')}.</span>
          </li>
          <li>
            <Icon name="refresh" size={30} />
            <strong>Replacement policy</strong>
            <span>
              {minReplacements}–{maxReplacements} replacements over {minTerm}–{maxTerm} months, by plan.
            </span>
          </li>
        </ul>

        {intro && (
          <section id="about" className="home-section">
            <div className="home-wrap home-about">
              <div className="home-about__photo">
                <Image src="/about-us.jpg" alt="Care helper assisting an elderly person at home" width={640} height={640} sizes="(min-width: 992px) 560px, 100vw" />
              </div>
              <div className="home-about__body">
                <span className="home-badge">About MyBuddyMaid</span>
                <h2>{intro.heading}</h2>
                <p className="home-lede">{intro.paragraphs[0]}</p>
                <div className="home-features">
                  {verify && (
                    <div id="verify" className="home-feature">
                      <span className="home-feature__icon">
                        <Icon name="search" size={22} />
                      </span>
                      <div>
                        <h3>{verify.heading}</h3>
                        {verify.paragraphs.map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                        <Link href="/how-we-verify" className="home-more">
                          How we verify <Icon name="arrow-right" size={16} />
                        </Link>
                      </div>
                    </div>
                  )}
                  {replacement && (
                    <div id="replacement" className="home-feature">
                      <span className="home-feature__icon">
                        <Icon name="refresh" size={22} />
                      </span>
                      <div>
                        <h3>{replacement.heading}</h3>
                        {replacement.paragraphs.map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                        <Link href="/replacement-policy" className="home-more">
                          Replacement policy <Icon name="arrow-right" size={16} />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        <section id="services" className="home-section home-section--alt">
          <div className="home-wrap">
            <header className="home-head">
              <span className="home-badge">Our services</span>
              <h2>What you can book</h2>
            </header>
            <ul className="home-services">
              {model.serviceCards.map((c) => {
                const photo = SERVICE_PHOTOS[c.service.slug];
                return (
                  <li key={c.path} className="home-card">
                    <div className="home-card__media">
                      {photo ? (
                        <Image src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" />
                      ) : (
                        <span className="home-card__placeholder" aria-hidden="true">
                          <Icon name={SERVICE_ICONS[c.service.slug]} size={56} />
                        </span>
                      )}
                    </div>
                    <div className="home-card__body">
                      <span className="home-card__icon">
                        <Icon name={SERVICE_ICONS[c.service.slug]} size={22} />
                      </span>
                      <h3>
                        <a href={c.path}>{c.service.name}</a>
                      </h3>
                      <p>{c.service.shortDescription}</p>
                      <p className="home-card__meta">Available {c.service.modes.join(', ')}.</p>
                      <span className="home-price">From {inr(c.from)} / month</span>
                      <a className="btn btn-outline" href={appHref(c.service.slug)} {...track('app_click', c.service.slug)}>
                        Book Now
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {steps?.bullets && (
          <section id="how-it-works" className="home-section">
            <div className="home-wrap">
              <header className="home-head">
                <span className="home-badge">The process</span>
                <h2>{steps.heading}</h2>
              </header>
              <ol className="home-steps">
                {steps.bullets.map((b, i) => (
                  <li key={i} className="home-step">
                    <span className="home-step__n" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="home-step__icon" aria-hidden="true">
                      <Icon name={STEP_ICONS[i] ?? 'check'} size={26} />
                    </span>
                    <p>{b}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        <section id="pricing" className="home-section home-section--alt">
          <div className="home-wrap">
            <header className="home-head">
              <span className="home-badge">Transparent pricing</span>
              <h2>Platform plans</h2>
              <p>One-time platform fee. The helper&apos;s monthly salary is agreed at interview and paid directly to them.</p>
            </header>
            <ul className="home-plans">
              {PLANS.map((p) => (
                <li key={p.key} className={p.popular ? 'home-plan home-plan--popular' : 'home-plan'}>
                  {p.popular && <span className="home-plan__badge">Most popular</span>}
                  <h3>{p.name} package</h3>
                  <p className="home-plan__sub">{p.termMonths} months of replacement cover.</p>
                  <p className="home-plan__amount">
                    {inr(p.fee)} <span>/ one-time</span>
                  </p>
                  <ul className="home-plan__list">
                    <li>{p.termMonths} months replacement cover</li>
                    <li>{p.replacements} replacements</li>
                    <li>
                      {p.verifiedProfiles} verified {p.verifiedProfiles === 1 ? 'profile' : 'profiles'}
                    </li>
                    <li>{p.policeVerification ? 'Police verification included' : 'Aadhaar and reference checks'}</li>
                    <li>{REFUND_WINDOW_DAYS}-day refund window (see terms)</li>
                  </ul>
                  <a className={p.popular ? 'btn btn-primary' : 'btn btn-outline'} href={appHref()} {...track('app_click')}>
                    Choose {p.name}
                  </a>
                </li>
              ))}
            </ul>
            <p className="home-fine">
              <Link href="/pricing">Full pricing and plan terms</Link> · <Link href="/replacement-policy">Replacement policy</Link>
            </p>
            <SalaryEstimator rows={estimator.rows} tiers={estimator.tiers} appHrefBase={appHref()} />
          </div>
        </section>

        {cities && (
          <section id="cities" className="home-section">
            <div className="home-wrap">
              <header className="home-head">
                <span className="home-badge">Where we work</span>
                <h2>{cities.heading}</h2>
                {intro && <p>{intro.paragraphs[1]}</p>}
              </header>
              <ul className="home-cities">
                {/* nearby and cities.bullets are both CITIES.map(...) in composeHome, same order */}
                {model.nearby.map((n, i) => (
                  <li key={n.path}>
                    <Icon name="map-pin" size={18} />
                    <a href={n.path}>{n.anchor}</a>
                    {cities.bullets?.[i] && <span>{cities.bullets[i]}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {posts.length > 0 && (
          <section id="blog" className="home-section home-section--alt">
            <div className="home-wrap">
              <header className="home-head">
                <span className="home-badge">Expert insights</span>
                <h2>Guides &amp; resources</h2>
                <p>Practical guides on hiring, verifying and paying household help.</p>
              </header>
              <ul className="home-blog">
                {posts.map((p, i) => {
                  const photo = POST_PHOTOS[i % POST_PHOTOS.length];
                  return (
                    <li key={p.slug}>
                      <a className="home-post" href={`/blog/${p.slug}`}>
                        <span className="home-post__media">
                          <Image src={photo.src} alt="" width={photo.width} height={photo.height} sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" />
                          <span className="home-post__badge">{cleanCategory(p.category)}</span>
                        </span>
                        <span className="home-post__body">
                          <span className="home-post__meta">
                            {fmtDate(p.datePublished)} · {p.readingMinutes} min read
                          </span>
                          <h3>{p.title}</h3>
                          <p>{p.description}</p>
                          <span className="home-post__link">
                            Read article <Icon name="arrow-right" size={16} />
                          </span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
              <p className="home-fine">
                <Link href="/blog">All guides</Link>
              </p>
            </div>
          </section>
        )}

        {model.faqs.length > 0 && (
          <section id="faq" className="home-section">
            <div className="home-wrap">
              <header className="home-head">
                <span className="home-badge">Knowledge base</span>
                <h2>Frequently asked questions</h2>
              </header>
              <div className="home-faq">
                {model.faqs.map((f, i) => (
                  <details key={f.id} className="faq" open={i === 0}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* floating WhatsApp button — hidden on phones, where the sticky bar carries the same link */}
        <a className="home-wa" href={whatsappUrl(model.cta.whatsappText)} target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp" {...track('whatsapp_click')}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <span>Chat with us</span>
        </a>
      </SeoPage>
    </div>
  );
}
