/**
 * Fix blog-to-blog cross-links in blogs.json
 * These links are inside JSON strings with escaped quotes
 */
const fs = require('fs');
const path = require('path');

const blogsPath = path.join(__dirname, 'data', 'blogs.json');
let data = fs.readFileSync(blogsPath, 'utf-8');

const blogSlugs = [
  'how-to-hire-maid-india-2026',
  'how-to-manage-domestic-help-india',
  'maid-theft-prevention-tips-india',
  'domestic-worker-rights-india-2026',
  'when-to-hire-nanny-for-baby',
  'cctv-for-monitoring-maid-india',
  'hiring-cook-for-indian-home-guide',
  'work-life-balance-with-domestic-help',
  'managing-live-in-maid-india-guide',
  'postnatal-care-traditions-india',
  'elderly-care-at-home-complete-guide',
  'swiggy-vs-home-cook-cost-comparison',
  'maid-salary-trends-india-2026',
  'festival-bonus-guide-domestic-help-india',
  '10-questions-to-ask-before-hiring-maid',
];

let fixes = 0;
blogSlugs.forEach(slug => {
  // In JSON, the hrefs look like: href=\\\"/{slug}.html\\\"
  // We need to match both escaped and unescaped variants
  
  // Pattern 1: escaped quotes in JSON (href=\\\"/slug.html\\\")
  const escaped = `href=\\\\\\"/${slug}.html\\\\\\"`;
  const escapedFix = `href=\\\\\\"/blog/${slug}.html\\\\\\"`;
  while (data.includes(escaped)) {
    data = data.replace(escaped, escapedFix);
    fixes++;
  }
  
  // Pattern 2: regular quotes (href="/slug.html")
  const regular = `href="/${slug}.html"`;
  const regularFix = `href="/blog/${slug}.html"`;
  while (data.includes(regular)) {
    data = data.replace(regular, regularFix);
    fixes++;
  }
});

fs.writeFileSync(blogsPath, data, 'utf-8');
console.log(`✅ Fixed ${fixes} blog cross-links in blogs.json`);
