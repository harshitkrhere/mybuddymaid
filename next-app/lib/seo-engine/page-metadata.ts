// lib/seo-engine/page-metadata.ts — PageModel → Next.js Metadata (brief §6.4):
// title/description from Appendix D templates, absolute self-canonical (metadataBase
// in the root layout), robots from the quality gate, OG/Twitter with a per-page image.
import type { Metadata } from 'next';
import type { PageModel } from './compose';
import { robotsFor } from './gate';
import { BRAND } from './meta';

export function ogImagePath(title: string, subtitle: string): string {
  const p = new URLSearchParams({ t: title.slice(0, 80), s: subtitle.slice(0, 100) });
  return `/og?${p.toString()}`;
}

export function metadataFor(m: PageModel, opts?: { ogTitle?: string; ogSubtitle?: string }): Metadata {
  const robots = robotsFor(m.path);
  const ogTitle = opts?.ogTitle ?? m.hero.h1;
  const ogSubtitle = opts?.ogSubtitle ?? m.crumbs.slice(1, -1).map((c) => c.name).join(' › ');
  return {
    title: { absolute: m.meta.title },
    description: m.meta.description,
    alternates: { canonical: m.path },
    robots: {
      index: robots.index,
      follow: true,
      googleBot: { index: robots.index, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
    openGraph: {
      type: 'website',
      siteName: BRAND,
      locale: 'en_IN',
      url: m.path,
      title: m.meta.title,
      description: m.meta.description,
      images: [{ url: ogImagePath(ogTitle, ogSubtitle), width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: m.meta.title,
      description: m.meta.description,
      images: [ogImagePath(ogTitle, ogSubtitle)],
    },
  };
}

/** Metadata for hand-written (trust/blog) pages. */
export function staticMetadata(opts: { title: string; description: string; path: string; noindex?: boolean }): Metadata {
  return {
    title: { absolute: `${opts.title} | ${BRAND}` },
    description: opts.description,
    alternates: { canonical: opts.path },
    robots: { index: !opts.noindex, follow: true },
    openGraph: {
      type: 'website',
      siteName: BRAND,
      locale: 'en_IN',
      url: opts.path,
      title: opts.title,
      description: opts.description,
      images: [{ url: ogImagePath(opts.title, BRAND), width: 1200, height: 630, alt: opts.title }],
    },
    twitter: { card: 'summary_large_image', title: opts.title, description: opts.description },
  };
}
