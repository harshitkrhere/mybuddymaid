// components/shared/Footer.tsx — data-driven footer: cities, services, trust, legal.
import Link from 'next/link';
import { CITIES, SERVICES } from '@/data/seo';
import { PHONE_DISPLAY, TEL_URL, whatsappUrl } from '@/lib/seo-engine/links';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div>
          <h3>Cities</h3>
          <ul>
            {CITIES.map((c) => (
              <li key={c.slug}>
                <Link href={`/${c.slug}`}>Maid service in {c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Services</h3>
          <ul>
            <li>
              <Link href="/services/maid-service">Maid service</Link>
            </li>
            {SERVICES.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`}>{s.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Trust</h3>
          <ul>
            <li>
              <Link href="/how-we-verify">How we verify</Link>
            </li>
            <li>
              <Link href="/replacement-policy">Replacement policy</Link>
            </li>
            <li>
              <Link href="/pricing">Pricing &amp; plans</Link>
            </li>
            <li>
              <Link href="/about">About MyBuddyMaid</Link>
            </li>
            <li>
              <Link href="/contact">Contact</Link>
            </li>
            <li>
              <Link href="/blog">Blog</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Contact</h3>
          <ul>
            <li>
              <a href={TEL_URL}>{PHONE_DISPLAY}</a>
            </li>
            <li>
              <a href={whatsappUrl('Hi MyBuddyMaid, I need help hiring a helper.')} rel="noopener" target="_blank">
                WhatsApp
              </a>
            </li>
            <li>
              <a href="mailto:info@mybuddymaid.in">info@mybuddymaid.in</a>
            </li>
            <li>175, 5th Floor, Main Road, Chandra Layout, Bengaluru 560040</li>
          </ul>
          <ul className="legal">
            <li>
              <Link href="/privacy-policy">Privacy policy</Link>
            </li>
            <li>
              <Link href="/terms-of-service">Terms of service</Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="site-footer__note">
        © {new Date().getFullYear()} MyBuddyMaid. Locality coordinates © OpenStreetMap contributors (ODbL).
      </p>
    </footer>
  );
}
