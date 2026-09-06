// components/shared/Header.tsx — server-rendered header; CSS-only mobile menu.
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
        <details className="nav-toggle">
          <summary aria-label="Menu">Menu</summary>
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
        </details>
      </div>
    </header>
  );
}
