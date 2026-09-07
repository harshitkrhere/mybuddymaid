// lib/blog/legacy-header.ts — strips the legacy static-site header fragment that some
// ported posts in data/blog/posts.ts still begin with:
//
//   <a href="/blog" class="blog-back">…</a>
//   <div class="badge">…</div>
//   <h1>…</h1>
//   <div class="blog-meta">…</div>
//
// The Next.js post template renders its own <h1>, category and date line, so leaving the
// fragment in place duplicated the title, badge and meta and gave the page two <h1>s.
// Only the *leading* fragment is removed: each piece is matched anchored at the start of
// the remaining string (after whitespace), in any order, at most once each, so an <h1> or
// a .badge that appears later in the body is never touched.

const LEADING_PIECES: RegExp[] = [
  /^\s*<a\b[^>]*\bclass="[^"]*\bblog-back\b[^"]*"[^>]*>[\s\S]*?<\/a>/,
  /^\s*<div\b[^>]*\bclass="[^"]*\bbadge\b[^"]*"[^>]*>[\s\S]*?<\/div>/,
  /^\s*<h1\b[^>]*>[\s\S]*?<\/h1>/,
  /^\s*<div\b[^>]*\bclass="[^"]*\bblog-meta\b[^"]*"[^>]*>[\s\S]*?<\/div>/,
];

export function stripLegacyHeader(html: string): string {
  let out = html;
  const used = new Set<number>();
  for (;;) {
    const i = LEADING_PIECES.findIndex((re, idx) => !used.has(idx) && re.test(out));
    if (i === -1) break;
    used.add(i);
    out = out.replace(LEADING_PIECES[i], '');
  }
  return used.size ? out.replace(/^\s+/, '') : html;
}
