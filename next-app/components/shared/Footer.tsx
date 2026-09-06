// components/shared/Footer.tsx — data-driven footer: cities, services, trust, legal.
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
                <a href={`/${c.slug}`}>Maid service in {c.name}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Services</h3>
          <ul>
            <li>
              <a href="/services/maid-service">Maid service</a>
            </li>
            {SERVICES.map((s) => (
              <li key={s.slug}>
                <a href={`/services/${s.slug}`}>{s.name}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Trust</h3>
          <ul>
            <li>
              <a href="/how-we-verify">How we verify</a>
            </li>
            <li>
              <a href="/replacement-policy">Replacement policy</a>
            </li>
            <li>
              <a href="/pricing">Pricing &amp; plans</a>
            </li>
            <li>
              <a href="/about">About MyBuddyMaid</a>
            </li>
            <li>
              <a href="/contact">Contact</a>
            </li>
            <li>
              <a href="/blog">Blog</a>
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
              <a href="/privacy-policy">Privacy policy</a>
            </li>
            <li>
              <a href="/terms-of-service">Terms of service</a>
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
