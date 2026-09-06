import Link from 'next/link';
import { CITIES } from '@/data/seo';

export default function NotFound() {
  return (
    <main className="content" style={{ paddingTop: '2rem' }}>
      <h1>Page not found</h1>
      <p>We don&apos;t have a page at this address. Pick your city to find your locality:</p>
      <ul className="link-list">
        {CITIES.map((c) => (
          <li key={c.slug}>
            <Link href={`/${c.slug}`}>maid service in {c.name}</Link>
          </li>
        ))}
      </ul>
      <p>
        Or <Link href="/">go to the home page</Link>.
      </p>
    </main>
  );
}
