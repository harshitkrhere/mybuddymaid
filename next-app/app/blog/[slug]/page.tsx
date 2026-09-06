import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BLOG_BY_SLUG, BLOG_POSTS } from '@/data/blog/posts';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbLd, ORGANIZATION } from '@/lib/seo-engine/jsonld';
import { SITE_URL } from '@/lib/seo-engine/meta';
import { AdSense } from '@/components/shared/Analytics';

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = BLOG_BY_SLUG.get(slug);
  if (!p) return {};
  return staticMetadata({ title: p.title, description: p.description, path: `/blog/${slug}` });
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = BLOG_BY_SLUG.get(slug);
  if (!post) notFound();
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
    { name: post.title, path: `/blog/${slug}` },
  ];
  const related = BLOG_POSTS.filter((p) => p.slug !== slug && p.category === post.category).slice(0, 4);
  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd(crumbs),
          {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.description,
            datePublished: post.datePublished,
            dateModified: post.dateModified,
            mainEntityOfPage: `${SITE_URL}/blog/${slug}`,
            author: { '@id': ORGANIZATION['@id'] },
            publisher: { '@id': ORGANIZATION['@id'] },
          },
        ]}
      />
      <nav aria-label="Breadcrumb" className="crumbs">
        <ol>
          {crumbs.map((c, i) => (
            <li key={c.path}>{i < crumbs.length - 1 ? <Link href={c.path}>{c.name}</Link> : <span aria-current="page">{c.name}</span>}</li>
          ))}
        </ol>
      </nav>
      <main className="content prose">
        <h1>{post.title}</h1>
        <p className="muted">
          {post.category} · Published {post.datePublished} · {post.readingMinutes} min read
        </p>
        <div dangerouslySetInnerHTML={{ __html: post.html }} />
        {related.length > 0 && (
          <>
            <h2>Related guides</h2>
            <ul className="link-list">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/blog/${r.slug}`}>{r.title}</Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <AdSense />
    </>
  );
}
