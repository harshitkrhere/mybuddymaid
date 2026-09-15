import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BLOG_BY_SLUG, BLOG_POSTS } from '@/data/blog/posts';
import { areasForPost, ctaForPost } from '@/lib/blog/links';
import { CtaButtons, StickyCta } from '@/components/seo/CtaButtons';
import { stripLegacyHeader } from '@/lib/blog/legacy-header';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbLd, ORGANIZATION } from '@/lib/seo-engine/jsonld';
import { SITE_URL } from '@/lib/seo-engine/meta';

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
  // the places this guide applies to (lib/blog/links.ts): a city guide links its hub, hero
  // localities and service pages; a service guide its hub and Tier-1 city pages; the rest,
  // and every guide about a city we do not serve, list the eight cities we do
  const areas = areasForPost(slug);
  // the buttons (A7): WhatsApp prefilled with what this guide is about, call, the app
  const cta = ctaForPost(slug);
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
        <div dangerouslySetInnerHTML={{ __html: stripLegacyHeader(post.html) }} />
        <section className="final-cta">
          <h2>Ready to book?</h2>
          <p>Message us on WhatsApp with your requirement, or call — we reply during working hours.</p>
          <CtaButtons ctx={cta} />
        </section>
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
        {areas.length > 0 && (
          <>
            <h2>Where we serve</h2>
            <ul className="link-list">
              {areas.map((a) => (
                <li key={a.path}>
                  <Link href={a.path}>{a.name}</Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <StickyCta ctx={cta} />
    </>
  );
}
