// app/blog/page.tsx — the guides index, in the same obsidian + mint design language as the
// landing page. Presentation only: the posts, titles, excerpts, dates and categories come
// from data/blog/posts.ts unchanged; the 33 legacy category labels are grouped into six
// topics for navigation. Styling lives in styles/blog.css under .blog; Plus Jakarta Sans is
// loaded here through next/font so only this route pays for it.
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Plus_Jakarta_Sans } from 'next/font/google';
import '@/styles/blog.css';
import { BLOG_POSTS, type BlogPost } from '@/data/blog/posts';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbLd } from '@/lib/seo-engine/jsonld';
import { Icon, type IconName } from '@/components/home/HomeIcons';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '600', '700', '800'], display: 'swap', variable: '--font-jakarta' });

export const dynamic = 'force-static';

export const metadata: Metadata = staticMetadata({
  title: 'Blog – Hiring Guides for Domestic Help',
  description: 'Guides on hiring maids, cooks, nannies and elder-care helpers in India: salaries, verification, city guides and how to choose between services.',
  path: '/blog',
});

// Topics, in display order. A post joins the first topic whose pattern matches its
// (emoji-stripped) category; anything else lands in "More guides".
const TOPICS: { id: string; name: string; icon: IconName; match: RegExp }[] = [
  { id: 'city-guides', name: 'City guides', icon: 'map-pin', match: /delhi|mumbai|bangalore|chennai|hyderabad|jaipur|kolkata|gurugram|noida|pune/i },
  { id: 'hiring', name: 'Hiring & managing help', icon: 'search', match: /hiring|management|complete|employer|live-in|lifestyle/i },
  { id: 'safety', name: 'Safety & legal', icon: 'lock', match: /safety|legal/i },
  { id: 'salary', name: 'Salary & costs', icon: 'tag', match: /salary|cost/i },
  { id: 'care', name: 'Elder, child & postnatal care', icon: 'heart', match: /elder|senior|postnatal|parenting|child/i },
  { id: 'comparisons', name: 'Comparisons', icon: 'scale', match: /comparison/i },
];
const FALLBACK_TOPIC = { id: 'more', name: 'More guides', icon: 'users' as IconName };

const cleanCategory = (c: string) => c.replace(/^[^A-Za-z]+/, '').trim();
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${d}, ${y}`;
};
const byDate = (a: BlogPost, b: BlogPost) => b.datePublished.localeCompare(a.datePublished) || a.title.localeCompare(b.title);
// Excerpts were cut at 200 characters when the posts were ported; close them with an ellipsis.
const tidyExcerpt = (e: string) => {
  const t = e.trim().replace(/[,;:\s]+$/, '');
  return /[.!?]$/.test(t) ? t : `${t}…`;
};

function topicOf(p: BlogPost) {
  const c = cleanCategory(p.category);
  return TOPICS.find((t) => t.match.test(c)) ?? FALLBACK_TOPIC;
}

export default function BlogIndex() {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
  ];
  const posts = [...BLOG_POSTS].sort(byDate);
  const featured = posts[0];
  // the featured post is shown once, in the spotlight, not again in its topic group
  const rest = posts.filter((p) => p.slug !== featured?.slug);
  const groups = [...TOPICS, FALLBACK_TOPIC]
    .map((t) => ({ ...t, posts: rest.filter((p) => topicOf(p).id === t.id) }))
    .filter((g) => g.posts.length > 0);

  return (
    <div className={`blog ${jakarta.variable}`}>
      <JsonLd data={[breadcrumbLd(crumbs)]} />
      <nav aria-label="Breadcrumb" className="crumbs">
        <ol>
          {crumbs.map((c, i) => (
            <li key={c.path}>{i < crumbs.length - 1 ? <Link href={c.path}>{c.name}</Link> : <span aria-current="page">{c.name}</span>}</li>
          ))}
        </ol>
      </nav>

      <header className="blog-hero">
        <span className="blog-badge">Expert insights</span>
        <h1>Guides for hiring domestic help</h1>
        <p className="blog-hero__tagline">City guides, salary benchmarks, verification checklists and service comparisons.</p>
        <nav className="blog-topics" aria-label="Topics">
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="blog-topic">
              <Icon name={g.icon} size={15} />
              {g.name}
              <span className="blog-topic__count">{g.posts.length}</span>
            </a>
          ))}
        </nav>
      </header>

      <main className="content">
        {featured && (
          <Link href={`/blog/${featured.slug}`} className="blog-featured">
            <span className="blog-featured__media">
              <Image src="/blog-maid-guide.png" alt="" width={1024} height={1024} priority sizes="(min-width: 900px) 480px, 100vw" />
            </span>
            <span className="blog-featured__body">
              <span className="blog-card__meta">
                <span className="blog-card__badge">Latest</span>
                {fmtDate(featured.datePublished)} · {featured.readingMinutes} min read
              </span>
              <h2>{featured.title}</h2>
              <p>{tidyExcerpt(featured.excerpt)}</p>
              <span className="blog-card__link">
                Read article <Icon name="arrow-right" size={16} />
              </span>
            </span>
          </Link>
        )}

        {groups.map((g) => (
          <section key={g.id} id={g.id} className="blog-group">
            <header className="blog-group__head">
              <span className="blog-group__icon">
                <Icon name={g.icon} size={22} />
              </span>
              <h2>{g.name}</h2>
              <span className="blog-group__count">
                {g.posts.length} {g.posts.length === 1 ? 'guide' : 'guides'}
              </span>
            </header>
            <ul className="blog-grid">
              {g.posts.map((p) => (
                <li key={p.slug}>
                  <Link href={`/blog/${p.slug}`} className="blog-card">
                    <span className={`blog-card__band blog-card__band--${g.id}`} aria-hidden="true">
                      <Icon name={g.icon} size={34} />
                    </span>
                    <span className="blog-card__body">
                      <span className="blog-card__meta">
                        <span className="blog-card__badge">{cleanCategory(p.category)}</span>
                        {fmtDate(p.datePublished)} · {p.readingMinutes} min read
                      </span>
                      <h3>{p.title}</h3>
                      <p>{tidyExcerpt(p.excerpt)}</p>
                      <span className="blog-card__link">
                        Read article <Icon name="arrow-right" size={16} />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <aside className="blog-cta">
          <div>
            <h2>Ready to hire?</h2>
            <p>Verified maids, cooks, nannies and elder-care helpers with a replacement policy.</p>
          </div>
          <div className="blog-cta__links">
            <Link href="/" className="btn btn-primary">
              See services and pricing
            </Link>
            <Link href="/how-we-verify" className="btn btn-outline">
              How we verify
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}
