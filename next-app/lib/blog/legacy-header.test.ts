// Run: npx tsx --test lib/blog/legacy-header.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripLegacyHeader } from './legacy-header';
import { BLOG_POSTS } from '../../data/blog/posts';

const FRAGMENT =
  '<a href="/blog" class="blog-back"><i class="ph-bold ph-arrow-left"></i> Back to Blog</a>\r\n' +
  '        <div class="badge">Hiring Guide</div>\r\n' +
  '        <h1>How to Find a Reliable Maid in Delhi NCR in 2026</h1>\r\n' +
  '        <div class="blog-meta">\r\n' +
  '          <span><i class="ph-bold ph-calendar"></i> April 20, 2026</span>\r\n' +
  '          <span><i class="ph-bold ph-clock"></i> 8 min read</span>\r\n' +
  '        </div>\r\n\r\n        ';
const BODY = '<p>Finding a trustworthy maid.</p>\r\n<h2>Step 1</h2>\r\n<p>Do this.</p>';

test('strips the full legacy header fragment and leading whitespace', () => {
  assert.equal(stripLegacyHeader(FRAGMENT + BODY), BODY);
});

test('returns html unchanged when there is no leading fragment', () => {
  assert.equal(stripLegacyHeader(BODY), BODY);
  assert.equal(stripLegacyHeader('  ' + BODY), '  ' + BODY);
});

test('strips a partial fragment (h1 only, or badge + h1) in any order', () => {
  assert.equal(stripLegacyHeader('<h1>Title</h1>\n' + BODY), BODY);
  assert.equal(stripLegacyHeader('<h1>Title</h1><div class="badge">Guide</div>' + BODY), BODY);
  assert.equal(stripLegacyHeader('<div class="badge extra">Guide</div>\n<h1 id="t">Title</h1>' + BODY), BODY);
});

test('does not touch an <h1>, .badge or .blog-meta that appears later in the body', () => {
  const mid = BODY + '<div class="badge">Late</div><h1>Late title</h1><div class="blog-meta">x</div>';
  assert.equal(stripLegacyHeader(mid), mid);
  assert.equal(stripLegacyHeader(FRAGMENT + mid), mid);
});

test('each piece is stripped at most once', () => {
  const twice = '<h1>A</h1><h1>B</h1>' + BODY;
  assert.equal(stripLegacyHeader(twice), '<h1>B</h1>' + BODY);
});

test('every ported post has no <h1> and no leading fragment after stripping', () => {
  for (const p of BLOG_POSTS) {
    const html = stripLegacyHeader(p.html);
    assert.doesNotMatch(html, /<h1\b/, `${p.slug}: still contains <h1>`);
    assert.doesNotMatch(html, /class="blog-back"|class="badge"|class="blog-meta"/, `${p.slug}: legacy chrome remains`);
    assert.match(html, /^<(p|h2|ul|ol|table|div|blockquote)\b/, `${p.slug}: body should start with a block element`);
  }
});

test('exactly three ported posts carried the fragment', () => {
  const changed = BLOG_POSTS.filter((p) => stripLegacyHeader(p.html) !== p.html).map((p) => p.slug).sort();
  assert.deepEqual(changed, ['elderly-care-at-home-guide', 'find-reliable-maid-delhi', 'maid-vs-cook-vs-nanny']);
});
