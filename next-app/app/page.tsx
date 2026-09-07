// app/page.tsx — the landing page, implementing screens 2a (desktop) and 2b (mobile) of
// the approved "MyBuddyMaid Redesign" canvas in the Modernist system, on this page only.
//
// Presentation only. Every sentence comes from composeHome(); the numbers come from the
// data layer (CITIES, ALL_LOCALITIES, SERVICES). Nothing is invented and there is no
// social proof of any kind. SeoPage keeps the SEO skeleton — JSON-LD, the breadcrumb
// nav, the single <h1> from homeMeta(), the tracked CTA buttons, the closing CTA — and
// receives a trimmed model so nothing renders twice; this file lays out the rest.
// Archivo is loaded here and only here, so no other page pays for the font.
import type { Metadata } from 'next';
import Image from 'next/image';
import { Archivo } from 'next/font/google';
import '@/styles/home.css';
import { SeoPage } from '@/components/seo/SeoPage';
import { composeHome, inr, type PageModel } from '@/lib/seo-engine/compose';
import { metadataFor } from '@/lib/seo-engine/page-metadata';
import { ALL_LOCALITIES, CITIES, SERVICES } from '@/data/seo';
import type { ServiceSlug } from '@/data/seo/types';

const archivo = Archivo({ subsets: ['latin'], weight: ['400', '600', '800'], display: 'swap', variable: '--font-archivo' });

export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return metadataFor(composeHome(), { ogTitle: 'Verified maids, cooks & nannies', ogSubtitle: 'Delhi NCR · Mumbai · Pune · Bangalore · Mangalore' });
}

// Photographs already in next-app/public, served through next/image (never hotlinked).
// The two filenames with spaces are URL-encoded; next/image passes them through as-is.
const SERVICE_PHOTOS: Record<ServiceSlug, { src: string; width: number; height: number; alt: string } | null> = {
  'full-time-maid': { src: '/a%20full%20time%20live%20in.jpg', width: 800, height: 533, alt: 'Full-time live-in helper at work in a home' },
  'part-time-maid': { src: '/part%20time%20buddy.jpg', width: 800, height: 1200, alt: 'Part-time helper cleaning a living room' },
  cook: { src: '/cook.jpg', width: 800, height: 640, alt: 'Cook preparing a meal in a home kitchen' },
  'babysitter-nanny': { src: '/babbysitting.jpg', width: 800, height: 1200, alt: 'Nanny looking after a young child' },
  'elder-care': { src: '/eldercare.jpg', width: 800, height: 1200, alt: 'Care helper with an elderly person' },
  'domestic-help': null,
};

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
  const cityNames = CITIES.map((c) => c.name);

  return (
    <div className={`home ${archivo.variable}`}>
      <SeoPage model={shell}>
        {/* hero photographs — placed beside the h1 on desktop, under it on mobile (CSS grid) */}
        <div className="home-visual" aria-hidden="true">
          <Image src="/hero-new.png" alt="" width={1024} height={1024} priority sizes="(min-width: 900px) 46vw, 100vw" className="home-visual__main" />
          <div className="home-visual__pair">
            <Image src="/eldercare.jpg" alt="" width={800} height={1200} sizes="(min-width: 900px) 23vw, 50vw" />
            <Image src="/cook.jpg" alt="" width={800} height={640} sizes="(min-width: 900px) 23vw, 50vw" />
          </div>
        </div>

        {/* ticker — the model's badges and the real footprint; the repeat is decorative */}
        <div className="home-marquee" role="presentation">
          <div className="home-marquee__track">
            {[0, 1].map((rep) => (
              <span key={rep} className="home-marquee__group" aria-hidden={rep === 1 || undefined}>
                {[...model.hero.badges, ...cityNames].map((t, i) => (
                  <span key={i}>{t}</span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {intro && (
          <div className="home-strip">
            <p>{intro.paragraphs[0]}</p>
            <a href="#cities" className="home-strip__link">
              Find your locality
            </a>
          </div>
        )}

        {/* facts the data layer holds — no ratings, no counts of customers */}
        <ul className="home-facts">
          <li>
            <strong>{ALL_LOCALITIES.length}</strong>
            <span>Localities served</span>
          </li>
          <li>
            <strong>{CITIES.length}</strong>
            <span>Cities</span>
          </li>
          <li>
            <strong>{SERVICES.length}</strong>
            <span>Services</span>
          </li>
          <li className="home-facts__accent">
            <strong>48 hrs</strong>
            <span>Aim to share a replacement profile</span>
          </li>
        </ul>

        {intro && (
          <section id="intro" className="home-about">
            <div className="home-about__photo">
              <Image src="/about-us.jpg" alt="Care helper assisting an elderly person at home" width={640} height={640} sizes="(min-width: 900px) 44vw, 100vw" />
            </div>
            <div className="home-about__body">
              <p className="home-kicker">
                <span>02</span>
                <i></i>
                <span>Locality-first</span>
              </p>
              <h2>{intro.heading}</h2>
              {intro.paragraphs.slice(1).map((p, i) => (
                <p key={i} className="home-lede">
                  {p}
                </p>
              ))}
              {verify && (
                <div id="verify" className="home-about__block">
                  <h3>{verify.heading}</h3>
                  {verify.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              )}
              {replacement && (
                <div id="replacement" className="home-about__block home-about__block--mint">
                  <h3>{replacement.heading}</h3>
                  {replacement.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <section id="services" className="home-services">
          <div className="home-head">
            <p className="home-kicker">
              <span>03</span>
              <i></i>
              <span>Services</span>
            </p>
            <h2>What you can book</h2>
          </div>
          <ul className="home-services__grid">
            {model.serviceCards.map((c) => {
              const photo = SERVICE_PHOTOS[c.service.slug];
              return (
                <li key={c.path} className={photo ? 'home-service' : 'home-service home-service--mint'}>
                  {photo && <Image src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} sizes="(min-width: 900px) 33vw, 100vw" className="home-service__photo" />}
                  <div className="home-service__body">
                    <h3>
                      <a href={c.path}>{c.service.name}</a>
                    </h3>
                    <p>{c.service.shortDescription}</p>
                    <p className="home-service__meta">Available {c.service.modes.join(', ')}.</p>
                    <div className="home-service__foot">
                      <div>
                        <span className="home-service__from">From</span>
                        <strong>
                          {inr(c.from)}
                          <small> / month</small>
                        </strong>
                      </div>
                      <a href={c.path} className="home-service__cta">
                        View service
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {steps?.bullets && (
          <section id="how-it-works" className="home-process">
            <div className="home-head">
              <p className="home-kicker home-kicker--light">
                <span>04</span>
                <i></i>
                <span>The process</span>
              </p>
              <h2>{steps.heading}</h2>
            </div>
            <ol className="home-process__steps">
              {steps.bullets.map((b, i) => (
                <li key={i}>
                  <span className="home-process__n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <p>{b}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {cities && (
          <section id="cities" className="home-cities">
            <div className="home-head">
              <p className="home-kicker">
                <span>05</span>
                <i></i>
                <span>Cities</span>
              </p>
              <h2>{cities.heading}</h2>
            </div>
            <ul className="home-cities__grid">
              {/* nearby and cities.bullets are both CITIES.map(...) in composeHome, same order */}
              {model.nearby.map((n, i) => (
                <li key={n.path}>
                  <a href={n.path}>{n.anchor}</a>
                  {cities.bullets?.[i] && <span>{cities.bullets[i]}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {model.faqs.length > 0 && (
          <section id="faqs" className="home-faq">
            <div className="home-faq__head">
              <p className="home-kicker">
                <span>06</span>
                <i></i>
                <span>Answers</span>
              </p>
              <h2>Frequently asked questions</h2>
            </div>
            <div className="home-faq__list">
              {model.faqs.map((f) => (
                <details key={f.id} className="faq">
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </SeoPage>
    </div>
  );
}
