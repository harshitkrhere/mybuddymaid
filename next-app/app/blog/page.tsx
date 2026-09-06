import type { Metadata } from 'next';
import Link from 'next/link';
import { BLOG_POSTS } from '@/data/blog/posts';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbLd } from '@/lib/seo-engine/jsonld';

export const dynamic = 'force-static';

export const metadata: Metadata = staticMetadata({
  title: 'Blog – Hiring Guides for Domestic Help',
  description: 'Guides on hiring maids, cooks, nannies and elder-care helpers in India: salaries, verification, city guides and how to choose between services.',
  path: '/blog',
});

export default function BlogIndex() {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
  ];
  return (
    <>
      <JsonLd data={[breadcrumbLd(crumbs)]} />
      <main className="content">
        <h1>Guides for hiring domestic help</h1>
        <p className="hero__tagline">City guides, salary benchmarks, verification checklists and service comparisons.</p>
        <ul className="post-list">
          {BLOG_POSTS.map((p) => (
            <li key={p.slug}>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem' }}>
                <Link href={`/blog/${p.slug}`}>{p.title}</Link>
              </h2>
              <p className="muted">
                {p.category} · {p.datePublished} · {p.readingMinutes} min read
              </p>
              <p>{p.excerpt}</p>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
