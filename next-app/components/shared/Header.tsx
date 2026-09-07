// components/shared/Header.tsx — server-rendered header; CSS-only mobile menu.
// The nav is a plain sibling of a visually-hidden checkbox (not a <details>): a closed
// <details> never renders its non-summary children, so the desktop CSS that expected the
// links inline showed nothing. The checkbox keeps the toggle CSS-only and the nav links
// always in the server-rendered HTML (they carry the site-wide internal linking).
import Image from 'next/image';
import { CITIES } from '@/data/seo';

export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a href="/" className="brand" aria-label="MyBuddyMaid home">
          <Image src="/logo.png" alt="MyBuddyMaid" width={32} height={32} priority />
          <span>MyBuddyMaid</span>
        </a>
        <div className="nav-toggle">
          <input type="checkbox" id="nav-toggle" className="nav-toggle__input" aria-label="Menu" />
          <label htmlFor="nav-toggle" className="nav-toggle__btn">
            Menu
          </label>
          <nav className="nav" aria-label="Primary">
            <a href="/services/maid-service">Maid service</a>
            <a href="/services">Services</a>
            {CITIES.map((c) => (
              <a key={c.slug} href={`/${c.slug}`}>
                {c.name}
              </a>
            ))}
            <a href="/pricing">Pricing</a>
            <a href="/how-we-verify">Verification</a>
            <a href="/blog">Blog</a>
            <a href="/app" className="btn btn-primary btn-sm">
              Open app
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
