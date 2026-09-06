// components/shared/Header.tsx — server-rendered header; CSS-only mobile menu.
import Link from 'next/link';
import Image from 'next/image';
import { CITIES } from '@/data/seo';

export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="brand" aria-label="MyBuddyMaid home">
          <Image src="/logo.png" alt="MyBuddyMaid" width={32} height={32} priority />
          <span>MyBuddyMaid</span>
        </Link>
        <details className="nav-toggle">
          <summary aria-label="Menu">Menu</summary>
          <nav className="nav" aria-label="Primary">
            <Link href="/services/maid-service">Maid service</Link>
            <Link href="/services">Services</Link>
            {CITIES.map((c) => (
              <Link key={c.slug} href={`/${c.slug}`}>
                {c.name}
              </Link>
            ))}
            <Link href="/pricing">Pricing</Link>
            <Link href="/how-we-verify">Verification</Link>
            <Link href="/blog">Blog</Link>
            <a href="/app" className="btn btn-primary btn-sm">
              Open app
            </a>
          </nav>
        </details>
      </div>
    </header>
  );
}
