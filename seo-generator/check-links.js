/**
 * Check all internal links across all generated HTML pages
 * Run: node seo-generator/check-links.js
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'mybuddymaid');
const allFiles = new Set();
const brokenLinks = {};
let totalLinks = 0;
let brokenCount = 0;

// Recursively collect all HTML files
function collectFiles(dir, prefix = '') {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    const rel = prefix ? `${prefix}/${f}` : f;
    if (fs.statSync(full).isDirectory()) {
      collectFiles(full, rel);
    } else if (f.endsWith('.html')) {
      allFiles.add(rel);
      // Also add without .html (cleanUrls)
      allFiles.add(rel.replace('.html', ''));
    } else {
      allFiles.add(rel);
    }
  });
}

collectFiles(OUT_DIR);
console.log(`📁 Found ${allFiles.size} files in mybuddymaid/\n`);

// Known app routes (handled by SPA rewrites in vercel.json)
const appRoutes = new Set([
  '/auth', '/splash', '/onboarding', '/terms', '/home',
  '/services', '/bookings', '/pricing', '/profile',
  '/', '/index.html'
]);

// Check each HTML file for internal links
function checkFile(filePath, relPath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const linkRegex = /href="(\/[^"]*?)"/g;
  let match;
  const fileIssues = [];

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    totalLinks++;

    // Skip external links, anchors, and app routes
    if (href.startsWith('//') || href.startsWith('/#')) continue;
    if (appRoutes.has(href)) continue;
    if (appRoutes.has(href.replace('.html', ''))) continue;
    
    // Check if file exists
    const cleanHref = href.startsWith('/') ? href.substring(1) : href;
    const withHtml = cleanHref.endsWith('.html') ? cleanHref : `${cleanHref}.html`;
    const withoutHtml = cleanHref.replace('.html', '');
    
    if (!allFiles.has(cleanHref) && !allFiles.has(withHtml) && !allFiles.has(withoutHtml)) {
      // Check if it's a fragment link
      const noFragment = cleanHref.split('#')[0];
      if (noFragment && !allFiles.has(noFragment) && !allFiles.has(noFragment + '.html')) {
        fileIssues.push(href);
        brokenCount++;
      }
    }
  }

  if (fileIssues.length > 0) {
    brokenLinks[relPath] = [...new Set(fileIssues)];
  }
}

// Process all HTML files
function processDir(dir, prefix = '') {
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    const rel = prefix ? `${prefix}/${f}` : f;
    if (fs.statSync(full).isDirectory()) {
      processDir(full, rel);
    } else if (f.endsWith('.html')) {
      checkFile(full, rel);
    }
  });
}

processDir(OUT_DIR);

// Report
console.log(`🔗 Total internal links checked: ${totalLinks}`);
console.log(`❌ Broken links found: ${brokenCount}\n`);

if (Object.keys(brokenLinks).length > 0) {
  // Group broken links by target
  const targetCount = {};
  Object.values(brokenLinks).forEach(links => {
    links.forEach(l => {
      targetCount[l] = (targetCount[l] || 0) + 1;
    });
  });

  console.log('═══════════════════════════════════════════');
  console.log('  BROKEN LINK TARGETS (sorted by frequency)');
  console.log('═══════════════════════════════════════════');
  
  Object.entries(targetCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([link, count]) => {
      console.log(`  ${link}  (${count} pages)`);
    });

  console.log(`\n  Total unique broken targets: ${Object.keys(targetCount).length}`);
} else {
  console.log('✅ No broken links found!');
}
