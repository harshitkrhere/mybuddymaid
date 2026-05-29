/**
 * MyBuddyMaid SEO Page Generator
 * Reads JSON data + HTML templates → outputs 1000+ static HTML pages
 * 
 * Usage: node seo-generator/generate.js
 * Output: mybuddymaid/ directory
 */

const fs = require('fs');
const path = require('path');

// ═══════════════ PATHS ═══════════════
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const TMPL_DIR = path.join(__dirname, 'templates');
const OUT_DIR = path.join(ROOT, 'mybuddymaid');

// ═══════════════ LOAD DATA ═══════════════
function loadJSON(name) {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) { console.warn(`⚠ Missing: ${name}`); return null; }
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

const config = loadJSON('config.json');
const services = loadJSON('services.json') || [];
const cities = loadJSON('cities.json') || [];
const localities = loadJSON('localities.json'); // optional separate file
const comparisons = loadJSON('comparisons.json') || [];
const blogPosts = loadJSON('blogs.json') || [];

// ═══════════════ LOAD TEMPLATES ═══════════════
function loadTemplate(name) {
  const p = path.join(TMPL_DIR, name);
  if (!fs.existsSync(p)) { console.warn(`⚠ Missing template: ${name}`); return ''; }
  return fs.readFileSync(p, 'utf-8');
}

const templates = {
  service: loadTemplate('service.html'),
  cityService: loadTemplate('city-service.html'),
  localityService: loadTemplate('locality-service.html'),
  salaryGuide: loadTemplate('salary-guide.html'),
  comparison: loadTemplate('comparison.html'),
  blog: loadTemplate('blog.html'),
  hub: loadTemplate('hub.html'),
};

// Load partials
const partials = {};
const partialsDir = path.join(TMPL_DIR, 'partials');
if (fs.existsSync(partialsDir)) {
  fs.readdirSync(partialsDir).forEach(f => {
    if (f.endsWith('.html')) {
      partials[f.replace('.html', '')] = fs.readFileSync(path.join(partialsDir, f), 'utf-8');
    }
  });
}

// ═══════════════ TEMPLATE ENGINE ═══════════════
function render(template, data) {
  let html = template;

  // 1. Include partials: {{> partialName}}
  html = html.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, name) => {
    return partials[name] || `<!-- missing partial: ${name} -->`;
  });

  // 2. Process {{#each items}}...{{/each}} loops (supports dotted paths)
  html = html.replace(/\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, body) => {
    const arr = resolveValue(data, key);
    if (!Array.isArray(arr)) return '';
    return arr.map((item, i) => {
      const itemData = typeof item === 'object' ? { ...data, ...item, _index: i } : { ...data, _item: item, _index: i };
      return render(body, itemData);
    }).join('');
  });

  // 3. Process {{#if key}}...{{else}}...{{/if}} conditionals (supports dotted paths)
  html = html.replace(/\{\{#if\s+([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g, (_, key, ifBody, elseBody) => {
    const val = resolveValue(data, key);
    if (val && (!Array.isArray(val) || val.length > 0)) {
      return render(ifBody, data);
    }
    return elseBody ? render(elseBody, data) : '';
  });

  // 4. Replace {{variable}} and {{nested.variable}} placeholders
  html = html.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, key) => {
    const val = resolveValue(data, key);
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });

  return html;
}

function resolveValue(data, keyPath) {
  return keyPath.split('.').reduce((obj, key) => {
    if (obj === undefined || obj === null) return undefined;
    return obj[key];
  }, data);
}

// ═══════════════ SCHEMA GENERATORS ═══════════════
function serviceSchema(service, config) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Service",
    "name": service.name + " — MyBuddyMaid",
    "description": service.metaDescription,
    "provider": {
      "@type": "Organization",
      "name": "MyBuddyMaid",
      "url": config.brand.domain,
      "logo": config.brand.domain + "/logo.png",
      "telephone": config.brand.phone,
      "email": config.brand.email
    },
    "areaServed": { "@type": "Country", "name": "India" },
    "serviceType": service.name
  }, null, 2);
}

function faqSchema(faqs) {
  if (!faqs || !faqs.length) return '';
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a }
    }))
  }, null, 2);
}

function breadcrumbSchema(items, domain) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": item.name,
      "item": domain + item.url
    }))
  }, null, 2);
}

function localBusinessSchema(city, service, config) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "MyBuddyMaid — " + service.name + " in " + city.name,
    "description": `Professional ${service.name.toLowerCase()} in ${city.name}, ${city.state}. Verified and trusted home help.`,
    "url": `${config.brand.domain}/${service.slug}-in-${city.slug}`,
    "telephone": config.brand.phone,
    "email": config.brand.email,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": city.name,
      "addressRegion": city.state,
      "addressCountry": "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": city.lat,
      "longitude": city.lng
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": config.brand.rating,
      "reviewCount": config.brand.reviewCount
    },
    "areaServed": { "@type": "City", "name": city.name }
  }, null, 2);
}

// ═══════════════ INTERNAL LINK BUILDER ═══════════════
function buildCityLinks(service, allCities, currentCitySlug) {
  return allCities
    .filter(c => c.slug !== currentCitySlug && c.tier <= 2)
    .slice(0, 20)
    .map(c => `<a href="/${service.slug}-in-${c.slug}.html">${service.name} in ${c.name}</a>`)
    .join('\n          ');
}

function buildServiceLinks(currentServiceSlug, city) {
  return services
    .filter(s => s.slug !== currentServiceSlug)
    .map(s => {
      if (city) {
        return `<a href="/${s.slug}-in-${city.slug}.html">${s.name} in ${city.name}</a>`;
      }
      return `<a href="/${s.slug}.html">${s.name}</a>`;
    })
    .join('\n          ');
}

function buildLocalityLinks(service, city) {
  if (!city.localities || !city.localities.length) return '';
  return city.localities
    .map(l => `<a href="/${service.slug}-in-${l.slug}-${city.slug}.html">${service.name} in ${l.name}</a>`)
    .join('\n          ');
}

// ═══════════════ SALARY TABLE BUILDER ═══════════════
function buildSalaryTableRows(service, topCities) {
  return topCities
    .filter(c => c.tier <= 2)
    .slice(0, 15)
    .map(c => {
      const s = c.salaries && c.salaries[service.slug];
      if (!s) return '';
      return `<tr><td><a href="/${service.slug}-in-${c.slug}.html">${c.name}</a></td><td>${s.partTime}</td><td>${s.fullTime}</td><td>${s.liveIn}</td></tr>`;
    })
    .join('\n            ');
}

// ═══════════════ PAGE GENERATORS ═══════════════
const sitemapUrls = [];

function writePage(filename, html) {
  const outPath = path.join(OUT_DIR, filename);
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, html, 'utf-8');
}

function generateServicePages() {
  if (!templates.service) { console.log('⚠ No service template, skipping'); return; }
  console.log('\n📄 Generating service pages...');
  
  services.forEach(service => {
    // Flatten nested data for template {{#each}} loops
    const tasks = service.whatTheyDo ? service.whatTheyDo.tasks : [];
    const whyUsPoints = service.whyUs ? service.whyUs.points : [];
    const howToHireSteps = service.howToHire ? service.howToHire.steps : [];
    const redFlagItems = service.redFlags ? service.redFlags.items : [];

    const data = {
      ...config,
      ...service,
      // Flattened arrays for {{#each}}
      tasks,
      whyUsPoints,
      howToHireSteps,
      redFlagItems,
      domain: config.brand.domain,
      brandName: config.brand.name,
      brandPhone: config.brand.phone,
      brandEmail: config.brand.email,
      ga4Id: config.analytics.ga4,
      umamiId: config.analytics.umami,
      canonicalUrl: `${config.brand.domain}/${service.slug}`,
      pageUrl: `/${service.slug}.html`,
      serviceSchema: serviceSchema(service, config),
      faqSchema: faqSchema(service.faqs),
      breadcrumbSchema: breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Services', url: '/cities.html' },
        { name: service.name, url: `/${service.slug}.html` }
      ], config.brand.domain),
      salaryTableRows: buildSalaryTableRows(service, cities),
      relatedServiceLinks: buildServiceLinks(service.slug, null),
      cityLinks: cities.filter(c => c.tier <= 2).slice(0, 30)
        .map(c => `<a href="/${service.slug}-in-${c.slug}.html">${service.name} in ${c.name}</a>`)
        .join('\n          '),
      allServiceLinks: services
        .map(s => `<a href="/${s.slug}.html">${s.name}</a>`)
        .join(' · '),
    };

    const html = render(templates.service, data);
    const filename = `${service.slug}.html`;
    writePage(filename, html);
    sitemapUrls.push({ url: `/${service.slug}`, priority: '0.9', freq: 'weekly' });
    console.log(`  ✓ ${filename}`);
  });
}

function generateCityServicePages() {
  if (!templates.cityService) { console.log('⚠ No city-service template, skipping'); return; }
  console.log('\n🏙️  Generating city × service pages...');
  let count = 0;

  cities.forEach(city => {
    services.forEach(service => {
      const salaryData = city.salaries && city.salaries[service.slug];
      
      const data = {
        ...config,
        ...service,
        cityName: city.name,
        citySlug: city.slug,
        stateName: city.state,
        stateSlug: city.stateSlug,
        cityTier: city.tier,
        cityPopulation: city.population,
        cityContext: city.context,
        lifestyleNote: city.lifestyleNote,
        whyFamiliesNeedHelp: city.whyFamiliesNeedHelp,
        cityLat: city.lat,
        cityLng: city.lng,
        geoRegion: city.geoRegion,
        domain: config.brand.domain,
        brandName: config.brand.name,
        brandPhone: config.brand.phone,
        brandEmail: config.brand.email,
        ga4Id: config.analytics.ga4,
        umamiId: config.analytics.umami,
        serviceName: service.name,
        serviceSlug: service.slug,
        providerTitle: service.providerTitle || service.shortName,
        // Page-specific meta
        pageTitle: `${service.name} in ${city.name} — Verified & Trusted | MyBuddyMaid`,
        pageDescription: `Hire verified ${service.name.toLowerCase()} in ${city.name}, ${city.state}. Police-verified, background-checked professionals. 1-year replacement guarantee. Starting ${service.priceFrom}. Book in 2 minutes.`,
        pageKeywords: `${service.name.toLowerCase()} ${city.name}, ${service.name.toLowerCase()} in ${city.name}, hire ${service.shortName.toLowerCase()} ${city.name}, ${service.shortName.toLowerCase()} service ${city.name}, verified ${service.shortName.toLowerCase()} ${city.name}, ${city.name} ${service.shortName.toLowerCase()} cost`,
        canonicalUrl: `${config.brand.domain}/${service.slug}-in-${city.slug}`,
        h1: `${service.name} in ${city.name} — Verified & Trusted`,
        // Salary
        salaryPartTime: salaryData ? salaryData.partTime : 'Contact us',
        salaryFullTime: salaryData ? salaryData.fullTime : 'Contact us',
        salaryLiveIn: salaryData ? salaryData.liveIn : 'Contact us',
        // Links
        servicePageLink: `/${service.slug}.html`,
        relatedServiceLinks: buildServiceLinks(service.slug, city),
        localityLinks: buildLocalityLinks(service, city),
        hasLocalities: city.localities && city.localities.length > 0,
        nearbyLinks: (city.nearbyCities || [])
          .map(slug => {
            const nc = cities.find(c => c.slug === slug);
            return nc ? `<a href="/${service.slug}-in-${nc.slug}.html">${service.name} in ${nc.name}</a>` : '';
          })
          .filter(Boolean)
          .join('\n          '),
        // Schema
        localBusinessSchema: localBusinessSchema(city, service, config),
        faqSchema: faqSchema([
          ...(city.localFAQs || []),
          ...(service.faqs || []).slice(0, 3)
        ]),
        breadcrumbSchema: breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: service.name, url: `/${service.slug}.html` },
          { name: `${service.name} in ${city.name}`, url: `/${service.slug}-in-${city.slug}.html` }
        ], config.brand.domain),
        // City context with template
        demandContext: (service.cityContextTemplates && service.cityContextTemplates.demand || '')
          .replace(/\{\{city\}\}/g, city.name),
        lifestyleContext: (service.cityContextTemplates && service.cityContextTemplates.lifestyle || '')
          .replace(/\{\{city\}\}/g, city.name),
      };

      const html = render(templates.cityService, data);
      const filename = `${service.slug}-in-${city.slug}.html`;
      writePage(filename, html);
      sitemapUrls.push({ 
        url: `/${service.slug}-in-${city.slug}`, 
        priority: city.tier === 1 ? '0.8' : '0.7', 
        freq: 'monthly' 
      });
      count++;
    });
  });
  console.log(`  ✓ Generated ${count} city × service pages`);
}

function generateLocalityServicePages() {
  if (!templates.localityService) { console.log('⚠ No locality-service template, skipping'); return; }
  console.log('\n📍 Generating locality × service pages...');
  let count = 0;

  cities.forEach(city => {
    if (!city.localities || !city.localities.length) return;

    city.localities.forEach(locality => {
      services.forEach(service => {
        const salaryData = city.salaries && city.salaries[service.slug];

        const data = {
          ...config,
          ...service,
          cityName: city.name,
          citySlug: city.slug,
          stateName: city.state,
          localityName: locality.name,
          localitySlug: locality.slug,
          localityContext: locality.context || '',
          domain: config.brand.domain,
          brandName: config.brand.name,
          brandPhone: config.brand.phone,
          brandEmail: config.brand.email,
          ga4Id: config.analytics.ga4,
          umamiId: config.analytics.umami,
          serviceName: service.name,
          serviceSlug: service.slug,
          providerTitle: service.providerTitle || service.shortName,
          pageTitle: `${service.name} in ${locality.name}, ${city.name} — MyBuddyMaid`,
          pageDescription: `Hire verified ${service.name.toLowerCase()} in ${locality.name}, ${city.name}. Police-verified, trained professionals with replacement guarantee. Book now.`,
          pageKeywords: `${service.shortName.toLowerCase()} ${locality.name}, ${service.name.toLowerCase()} ${locality.name} ${city.name}, hire ${service.shortName.toLowerCase()} ${locality.name}`,
          canonicalUrl: `${config.brand.domain}/${service.slug}-in-${locality.slug}-${city.slug}`,
          h1: `${service.name} in ${locality.name}, ${city.name}`,
          salaryPartTime: salaryData ? salaryData.partTime : 'Contact us',
          salaryFullTime: salaryData ? salaryData.fullTime : 'Contact us',
          salaryLiveIn: salaryData ? salaryData.liveIn : 'Contact us',
          servicePageLink: `/${service.slug}.html`,
          cityPageLink: `/${service.slug}-in-${city.slug}.html`,
          nearbyLocalityLinks: (city.localities || [])
            .filter(l => l.slug !== locality.slug)
            .slice(0, 8)
            .map(l => `<a href="/${service.slug}-in-${l.slug}-${city.slug}.html">${service.name} in ${l.name}</a>`)
            .join('\n          '),
          relatedServiceLinks: buildServiceLinks(service.slug, city),
          breadcrumbSchema: breadcrumbSchema([
            { name: 'Home', url: '/' },
            { name: service.name, url: `/${service.slug}.html` },
            { name: `${city.name}`, url: `/${service.slug}-in-${city.slug}.html` },
            { name: locality.name, url: `/${service.slug}-in-${locality.slug}-${city.slug}.html` }
          ], config.brand.domain),
          faqSchema: faqSchema((service.faqs || []).slice(0, 3)),
        };

        const html = render(templates.localityService, data);
        const filename = `${service.slug}-in-${locality.slug}-${city.slug}.html`;
        writePage(filename, html);
        sitemapUrls.push({ 
          url: `/${service.slug}-in-${locality.slug}-${city.slug}`, 
          priority: '0.6', 
          freq: 'monthly' 
        });
        count++;
      });
    });
  });
  console.log(`  ✓ Generated ${count} locality × service pages`);
}

// ═══════════════ SITEMAP GENERATOR ═══════════════
function generateSitemap() {
  console.log('\n🗺️  Generating sitemap.xml...');
  
  const today = new Date().toISOString().split('T')[0];
  
  // Start with existing pages
  const existingUrls = [
    { url: '/', priority: '1.0', freq: 'weekly' },
    { url: '/blog-find-reliable-maid-delhi.html', priority: '0.8', freq: 'monthly' },
    { url: '/blog-elderly-care-at-home-guide.html', priority: '0.8', freq: 'monthly' },
    { url: '/blog-maid-vs-cook-vs-nanny.html', priority: '0.8', freq: 'monthly' },
  ];

  const allUrls = [...existingUrls, ...sitemapUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${config.brand.domain}${u.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  writePage('sitemap.xml', xml);
  console.log(`  ✓ sitemap.xml (${allUrls.length} URLs)`);
}

// ═══════════════ MAIN ═══════════════
function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  MyBuddyMaid SEO Page Generator');
  console.log('═══════════════════════════════════════════');
  console.log(`  Services: ${services.length}`);
  console.log(`  Cities: ${cities.length}`);
  const totalLocalities = cities.reduce((sum, c) => sum + (c.localities ? c.localities.length : 0), 0);
  console.log(`  Localities: ${totalLocalities}`);
  console.log('');

  // Phase 1: Core service pages
  generateServicePages();

  // Phase 2: City × service pages
  generateCityServicePages();

  // Phase 3: Locality × service pages
  generateLocalityServicePages();

  // Phase 4: Salary guides + comparison pages + best-of pages
  generateSalaryGuides();
  generateComparisonPages();
  generateBestOfPages();

  // Phase 5: Blog posts
  generateBlogPosts();

  // Phase 6: Hub pages + city index + state pages
  generateHubPages();
  generateCityIndexPages();
  generateStatePages();

  // Generate sitemap
  generateSitemap();

  // Summary
  console.log('\n═══════════════════════════════════════════');
  console.log(`  ✅ TOTAL PAGES GENERATED: ${sitemapUrls.length}`);
  console.log(`  ✅ SITEMAP URLS: ${sitemapUrls.length + 4} (+ existing pages)`);
  console.log('═══════════════════════════════════════════');
}

// ═══════════════ PHASE 4: SALARY GUIDES ═══════════════
function generateSalaryGuides() {
  if (!templates.salaryGuide) { console.log('⚠ No salary-guide template, skipping'); return; }
  console.log('\n💰 Generating salary guide pages...');

  cities.forEach(city => {
    const salaryRows = services.map(svc => {
      const s = city.salaries && city.salaries[svc.slug];
      if (!s) return '';
      return `<tr><td><a href="/${svc.slug}-in-${city.slug}.html">${svc.icon} ${svc.name}</a></td><td>${s.partTime}</td><td>${s.fullTime}</td><td>${s.liveIn}</td><td><a href="/home" style="color:var(--primary);font-weight:600">Book →</a></td></tr>`;
    }).join('\n');

    const comparisonCities = cities.filter(c => c.slug !== city.slug).slice(0, 8);
    const comparisonRows = comparisonCities.map(c => {
      const maidS = c.salaries && c.salaries['maid-service'];
      const cookS = c.salaries && c.salaries['cook-service'];
      const nannyS = c.salaries && c.salaries['nanny-service'];
      return `<tr><td><a href="/domestic-help-salary-in-${c.slug}-2026.html">${c.name}</a></td><td>${maidS ? maidS.partTime : '—'}</td><td>${cookS ? cookS.partTime : '—'}</td><td>${nannyS ? nannyS.fullTime : '—'}</td><td>Tier ${c.tier}</td></tr>`;
    }).join('\n');

    const premiumLocality = city.localities && city.localities.length > 0 ? city.localities[0].name : 'premium areas';
    const tierLabel = city.tier === 1 ? 'metro' : 'tier-2';

    const salaryFaqs = [
      { q: `How much does a maid cost in ${city.name} in 2026?`, a: `Part-time maid salaries in ${city.name} range from ${city.salaries['maid-service'] ? city.salaries['maid-service'].partTime : '₹5,000-₹12,000'} per month for 2-4 hours daily. Full-time maids cost ${city.salaries['maid-service'] ? city.salaries['maid-service'].fullTime : '₹10,000-₹18,000'}/month. Rates vary by area and experience.` },
      { q: `What is a cook's salary in ${city.name}?`, a: `Part-time cooks in ${city.name} earn ${city.salaries['cook-service'] ? city.salaries['cook-service'].partTime : '₹7,000-₹12,000'}/month. Full-time cooks who prepare all three meals earn ${city.salaries['cook-service'] ? city.salaries['cook-service'].fullTime : '₹12,000-₹20,000'}/month. Specialized cuisine cooks may charge more.` },
      { q: `How much should I pay a live-in maid in ${city.name}?`, a: `Live-in maid salaries in ${city.name} range from ${city.salaries['maid-service'] ? city.salaries['maid-service'].liveIn : '₹12,000-₹25,000'}/month (cash salary). Additionally, you provide accommodation, all meals, and basic toiletries. Festival bonuses are customary.` },
      { q: `Do domestic help salaries in ${city.name} include food and accommodation?`, a: `No. Salary figures are cash-in-hand amounts. For full-time and live-in staff, the employer provides lunch (full-time) or all meals + room (live-in) separately. This is standard practice across India.` },
      { q: `How much does elderly care cost in ${city.name}?`, a: `Elderly caregiver salaries in ${city.name} range from ${city.salaries['elderly-care-service'] ? city.salaries['elderly-care-service'].partTime : '₹10,000-₹18,000'}/month (part-time) to ${city.salaries['elderly-care-service'] ? city.salaries['elderly-care-service'].liveIn : '₹18,000-₹35,000'}/month (live-in). Trained nurses with medical skills command higher rates.` }
    ];

    const data = {
      ...config,
      domain: config.brand.domain,
      ga4Id: config.analytics.ga4,
      umamiId: config.analytics.umami,
      cityName: city.name,
      citySlug: city.slug,
      stateName: city.state,
      geoRegion: city.geoRegion,
      canonicalUrl: `${config.brand.domain}/domestic-help-salary-in-${city.slug}-2026`,
      pageTitle: `Domestic Help Salary in ${city.name} (2026) — Maid, Cook, Nanny Rates | MyBuddyMaid`,
      pageDescription: `Complete 2026 salary guide for maids, cooks, nannies, and caregivers in ${city.name}. Updated monthly rates for part-time, full-time, and live-in domestic help.`,
      pageKeywords: `maid salary ${city.name}, cook salary ${city.name}, domestic help salary ${city.name} 2026, nanny cost ${city.name}, home help rates ${city.name}`,
      h1: `Domestic Help Salary in ${city.name} — Complete 2026 Guide`,
      metaTitle: `Domestic Help Salary in ${city.name} (2026) | MyBuddyMaid`,
      metaDescription: `Complete salary guide for domestic help in ${city.name}. Updated 2026 rates for maids, cooks, nannies, and caregivers.`,
      introText: `Planning to hire domestic help in ${city.name}? Understanding the current salary landscape is essential for setting fair compensation and attracting quality professionals. As a ${tierLabel} city, ${city.name} has its own salary dynamics influenced by cost of living, demand-supply balance, and the specific area you live in. ${city.lifestyleNote} This comprehensive guide covers 2026 salary ranges for all types of home help professionals in ${city.name} — from part-time maids to live-in elderly caregivers.`,
      salaryRows,
      premiumLocality,
      comparisonText: `Domestic help salaries vary significantly across Indian cities based on cost of living, demand, and local market conditions. Here's how ${city.name} compares to other major cities:`,
      comparisonRows,
      serviceLinks: services.map(s => `<a href="/${s.slug}-in-${city.slug}.html">${s.icon} ${s.name} in ${city.name}</a>`).join('\n          '),
      otherCityLinks: cities.filter(c => c.slug !== city.slug).slice(0, 15).map(c => `<a href="/domestic-help-salary-in-${c.slug}-2026.html">Salary Guide — ${c.name}</a>`).join('\n          '),
      faqs: salaryFaqs,
      faqSchema: faqSchema(salaryFaqs),
      breadcrumbSchema: breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Salary Guides', url: '/salary-guides.html' },
        { name: city.name, url: `/domestic-help-salary-in-${city.slug}-2026.html` }
      ], config.brand.domain),
    };

    const html = render(templates.salaryGuide, data);
    writePage(`domestic-help-salary-in-${city.slug}-2026.html`, html);
    sitemapUrls.push({ url: `/domestic-help-salary-in-${city.slug}-2026`, priority: '0.8', freq: 'monthly' });
  });
  console.log(`  ✓ Generated ${cities.length} salary guide pages`);
}

// ═══════════════ PHASE 4: COMPARISON PAGES ═══════════════
function generateComparisonPages() {
  if (!templates.comparison) { console.log('⚠ No comparison template, skipping'); return; }
  console.log('\n⚖️  Generating comparison pages...');

  comparisons.forEach(comp => {
    const data = {
      ...config,
      ...comp,
      domain: config.brand.domain,
      ga4Id: config.analytics.ga4,
      umamiId: config.analytics.umami,
      canonicalUrl: `${config.brand.domain}/${comp.slug}`,
      metaTitle: comp.pageTitle,
      metaDescription: comp.pageDescription,
      faqSchema: faqSchema(comp.faqs || []),
      breadcrumbSchema: breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Guides', url: '/index.html#blog' },
        { name: comp.breadcrumbTitle, url: `/${comp.slug}.html` }
      ], config.brand.domain),
    };

    const html = render(templates.comparison, data);
    writePage(`${comp.slug}.html`, html);
    sitemapUrls.push({ url: `/${comp.slug}`, priority: '0.8', freq: 'monthly' });
  });
  console.log(`  ✓ Generated ${comparisons.length} comparison/guide pages`);
}

// ═══════════════ PHASE 4: BEST-OF PAGES ═══════════════
function generateBestOfPages() {
  if (!templates.comparison) { console.log('⚠ No comparison template for best-of, skipping'); return; }
  console.log('\n🏆 Generating best-of pages...');
  let count = 0;

  const topCities = cities;

  topCities.forEach(city => {
    services.forEach(svc => {
      const salaryData = city.salaries && city.salaries[svc.slug];
      const otherServices = services.filter(s => s.slug !== svc.slug);
      const nearbyLinks = (city.nearbyCities || []).map(slug => {
        const nc = cities.find(c => c.slug === slug);
        return nc ? `<a href="/best-${svc.slug}-in-${nc.slug}.html">Best ${svc.name} in ${nc.name}</a>` : '';
      }).filter(Boolean).join('\n          ');

      const body = `
        <p>Looking for the <strong>best ${svc.name.toLowerCase()} in ${city.name}</strong>? With hundreds of options available — from local agencies to online platforms to word-of-mouth referrals — finding a reliable, verified ${svc.providerTitle.toLowerCase()} can be overwhelming. This guide explains what to look for and why MyBuddyMaid is ${city.name}'s top-rated choice for ${svc.name.toLowerCase()}.</p>

        <h2>What Makes the "Best" ${svc.name} in ${city.name}?</h2>
        <p>The best ${svc.name.toLowerCase()} provider in ${city.name} should offer:</p>
        <ul>
          <li><strong>100% Police Verification</strong> — Every professional background-checked through Aadhaar + police records</li>
          <li><strong>Replacement Guarantee</strong> — Free replacement if the professional doesn't work out</li>
          <li><strong>Transparent Pricing</strong> — Clear salary ranges with no hidden fees or commissions</li>
          <li><strong>Fast Deployment</strong> — Professional at your door within 24-48 hours</li>
          <li><strong>Ongoing Support</strong> — Dedicated account manager for any issues</li>
          <li><strong>Trained Professionals</strong> — Not just anyone off the street, but skilled, experienced workers</li>
        </ul>

        <h2>${svc.name} Cost in ${city.name} (2026)</h2>
        <table class="vs-table">
          <thead><tr><th>Type</th><th>Monthly Salary</th></tr></thead>
          <tbody>
            <tr><td><strong>Part-Time (4-6 hrs)</strong></td><td>${salaryData ? salaryData.partTime : 'Contact us'}</td></tr>
            <tr><td><strong>Full-Time (8-12 hrs)</strong></td><td>${salaryData ? salaryData.fullTime : 'Contact us'}</td></tr>
            <tr><td><strong>Live-In (24/7)</strong></td><td>${salaryData ? salaryData.liveIn : 'Contact us'}</td></tr>
          </tbody>
        </table>

        <h2>Why MyBuddyMaid is #1 for ${svc.name} in ${city.name}</h2>
        <ul>
          <li>✅ <strong>100% Police-Verified</strong> — Every ${svc.providerTitle.toLowerCase()} is Aadhaar-verified and police background-checked</li>
          <li>✅ <strong>1-Year Free Replacement</strong> — Not satisfied? Free replacement within 24 hours</li>
          <li>✅ <strong>24-Hour Deployment</strong> — Book today, get your ${svc.providerTitle.toLowerCase()} tomorrow</li>
          <li>✅ <strong>Trained Professionals</strong> — Skill-assessed and trained for ${city.name} household standards</li>
          <li>✅ <strong>Transparent Pricing</strong> — No hidden fees, no maid commissions</li>
          <li>✅ <strong>Serving ${config.brand.familiesServed}+ Families</strong> — Trusted across India</li>
        </ul>

        <div class="seo-cta">
          <h3>Book the Best ${svc.name} in ${city.name}</h3>
          <p>Verified, trained, and deployed within 24 hours. Starting ${svc.priceFrom}.</p>
          <a href="/home" class="btn btn-primary">Book Now</a>
        </div>

        <h2>Best ${svc.name} in Nearby Cities</h2>
        <div class="seo-link-grid">
          ${nearbyLinks}
        </div>

        <h2>Other Services in ${city.name}</h2>
        <div class="seo-link-grid">
          ${otherServices.map(s => `<a href="/best-${s.slug}-in-${city.slug}.html">Best ${s.name} in ${city.name}</a>`).join('\n          ')}
        </div>

        <h2>More Resources</h2>
        <div class="seo-link-grid">
          <a href="/${svc.slug}-in-${city.slug}.html">${svc.name} in ${city.name}</a>
          <a href="/domestic-help-salary-in-${city.slug}-2026.html">Salary Guide — ${city.name}</a>
          <a href="/${svc.slug}.html">${svc.name} — All India</a>
        </div>

        <h2>FAQs</h2>
        <div class="seo-faq">
          <details>
            <summary>Which is the best ${svc.name.toLowerCase()} provider in ${city.name}?</summary>
            <div class="faq-answer">MyBuddyMaid is ${city.name}'s top-rated ${svc.name.toLowerCase()} provider, trusted by ${config.brand.familiesServed}+ families across India. Every professional is 100% police-verified with a 1-year replacement guarantee. Book at mybuddymaid.in.</div>
          </details>
          <details>
            <summary>How much does ${svc.name.toLowerCase()} cost in ${city.name}?</summary>
            <div class="faq-answer">Part-time ${svc.providerTitle.toLowerCase()} services in ${city.name} start from ${salaryData ? salaryData.partTime.split('–')[0].trim() : svc.priceFrom}/month. Full-time costs ${salaryData ? salaryData.fullTime : 'vary'} and live-in costs ${salaryData ? salaryData.liveIn : 'vary'}. Rates depend on experience and specific area.</div>
          </details>
          <details>
            <summary>How quickly can I get a ${svc.providerTitle.toLowerCase()} in ${city.name}?</summary>
            <div class="faq-answer">MyBuddyMaid deploys verified ${svc.providerTitle.toLowerCase()} professionals within 24 hours in ${city.name}. We maintain a ready pool of pre-verified candidates in all major ${city.name} areas.</div>
          </details>
        </div>
      `;

      const data = {
        ...config,
        badge: `🏆 Best in ${city.name}`,
        h1: `Best ${svc.name} in ${city.name} (2026) — Top Rated & Verified`,
        heroSubtitle: `Find the most trusted, police-verified ${svc.name.toLowerCase()} provider in ${city.name}. Compared and ranked for 2026.`,
        breadcrumbTitle: `Best ${svc.name} — ${city.name}`,
        articleBody: body,
        domain: config.brand.domain,
        ga4Id: config.analytics.ga4,
        umamiId: config.analytics.umami,
        canonicalUrl: `${config.brand.domain}/best-${svc.slug}-in-${city.slug}`,
        pageTitle: `Best ${svc.name} in ${city.name} (2026) — Top Rated & Verified | MyBuddyMaid`,
        pageDescription: `Find the best ${svc.name.toLowerCase()} in ${city.name} for 2026. Compare providers, prices, and verification standards. MyBuddyMaid — rated #1 for verified home help.`,
        pageKeywords: `best ${svc.name.toLowerCase()} ${city.name}, top ${svc.name.toLowerCase()} ${city.name}, ${svc.name.toLowerCase()} ${city.name} reviews, ${city.name} ${svc.providerTitle.toLowerCase()} agency`,
        metaTitle: `Best ${svc.name} in ${city.name} (2026) | MyBuddyMaid`,
        metaDescription: `Find the best ${svc.name.toLowerCase()} in ${city.name}. Verified, trusted, top-rated.`,
        faqSchema: faqSchema([
          { q: `Which is the best ${svc.name.toLowerCase()} provider in ${city.name}?`, a: `MyBuddyMaid is the top-rated provider with 100% police verification and 1-year replacement guarantee.` },
          { q: `How much does ${svc.name.toLowerCase()} cost in ${city.name}?`, a: `Part-time starts from ${salaryData ? salaryData.partTime : svc.priceFrom}. Full-time and live-in options available.` }
        ]),
        breadcrumbSchema: breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: svc.name, url: `/${svc.slug}.html` },
          { name: `Best in ${city.name}`, url: `/best-${svc.slug}-in-${city.slug}.html` }
        ], config.brand.domain),
      };

      const html = render(templates.comparison, data);
      writePage(`best-${svc.slug}-in-${city.slug}.html`, html);
      sitemapUrls.push({ url: `/best-${svc.slug}-in-${city.slug}`, priority: '0.7', freq: 'monthly' });
      count++;
    });
  });
  console.log(`  ✓ Generated ${count} best-of pages`);
}

// ═══════════════ PHASE 5: BLOG POSTS ═══════════════
function generateBlogPosts() {
  if (!templates.blog) { console.log('⚠ No blog template, skipping'); return; }
  console.log('\n📝 Generating blog posts...');

  blogPosts.forEach(post => {
    const data = {
      ...config,
      ...post,
      domain: config.brand.domain,
      ga4Id: config.analytics.ga4,
      umamiId: config.analytics.umami,
      canonicalUrl: `${config.brand.domain}/blog/${post.slug}`,
      metaTitle: post.pageTitle,
      metaDescription: post.pageDescription,
      faqSchema: faqSchema(post.faqs || []),
      breadcrumbSchema: breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Blog', url: '/blog.html' },
        { name: post.breadcrumbTitle, url: `/blog/${post.slug}.html` }
      ], config.brand.domain),
    };

    // Blog posts go in a blog/ subdirectory
    const blogDir = path.join(OUT_DIR, 'blog');
    if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });
    const html = render(templates.blog, data);
    fs.writeFileSync(path.join(blogDir, `${post.slug}.html`), html, 'utf-8');
    sitemapUrls.push({ url: `/blog/${post.slug}`, priority: '0.7', freq: 'monthly' });
  });
  console.log(`  ✓ Generated ${blogPosts.length} blog posts`);
}

// ═══════════════ PHASE 6: HUB PAGES ═══════════════
function generateHubPages() {
  if (!templates.hub) { console.log('⚠ No hub template, skipping'); return; }
  console.log('\n🏠 Generating hub pages...');
  let count = 0;

  // Services Hub
  const serviceCards = services.map(s => `
    <a href="/${s.slug}.html" class="hub-card">
      <span class="icon">${s.icon}</span>
      <h4>${s.name}</h4>
      <p>${s.metaDescription ? s.metaDescription.substring(0, 120) + '...' : 'Verified professionals deployed within 24 hours.'}</p>
      <span class="arrow">Learn More →</span>
    </a>`).join('\n');

  const servicesBody = `
    <p>MyBuddyMaid offers 6 core home help services across 42+ Indian cities. Every professional is 100% police-verified with a 1-year replacement guarantee. Choose the service that fits your family's needs.</p>
    <div class="hub-grid">${serviceCards}</div>
    <div class="hub-cta"><h3>Not Sure Which Service You Need?</h3><p>Tell us about your household, and we'll recommend the perfect combination. Free consultation.</p><a href="/home" class="btn btn-primary">Get Free Consultation</a></div>
    <h2>Browse by City</h2>
    <div class="hub-link-grid">${cities.filter(c => c.tier <= 2).map(c => `<a href="/cities/${c.slug}.html">${c.name}</a>`).join('\n')}</div>
    <h2>Helpful Guides</h2>
    <div class="hub-link-grid">
      <a href="/maid-vs-cook-which-to-hire.html">Maid vs Cook</a>
      <a href="/part-time-vs-full-time-maid.html">Part-Time vs Full-Time</a>
      <a href="/nanny-vs-daycare-india.html">Nanny vs Daycare</a>
      <a href="/home-help-hiring-checklist-india.html">Hiring Checklist</a>
    </div>`;

  const servicesData = {
    ...config, domain: config.brand.domain, ga4Id: config.analytics.ga4, umamiId: config.analytics.umami,
    badge: '🏠 All Services', h1: 'Home Help Services by MyBuddyMaid', heroSubtitle: '6 verified home help services across 42+ cities. Police-verified professionals with 1-year replacement guarantee.',
    breadcrumbTrail: '<strong>Services</strong>', articleBody: servicesBody,
    canonicalUrl: `${config.brand.domain}/services`, pageTitle: 'All Home Help Services — Maid, Cook, Nanny, Elderly Care | MyBuddyMaid',
    pageDescription: 'Browse all MyBuddyMaid services: maid, cook, nanny, elderly care, postnatal care, full-time maid. 100% police-verified in 42+ Indian cities.',
    pageKeywords: 'home help services India, maid service, cook service, nanny service, domestic help, MyBuddyMaid services',
    metaTitle: 'All Home Help Services | MyBuddyMaid', metaDescription: 'Browse all MyBuddyMaid services across 42+ cities.',
    breadcrumbSchema: breadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Services', url: '/services.html' }], config.brand.domain),
  };
  writePage('services.html', render(templates.hub, servicesData));
  sitemapUrls.push({ url: '/services', priority: '0.9', freq: 'weekly' });
  count++;

  // Cities Hub
  const tierGroups = [
    { label: 'Metro Cities (Tier 1)', cities: cities.filter(c => c.tier === 1) },
    { label: 'Major Cities (Tier 2)', cities: cities.filter(c => c.tier === 2) },
  ];
  const cityGroupHtml = tierGroups.map(g => `
    <h3>${g.label}</h3>
    <div class="hub-grid">${g.cities.map(c => `
      <a href="/cities/${c.slug}.html" class="hub-card">
        <h4>${c.name}</h4>
        <p>${c.state} • ${c.localities ? c.localities.length : 0} areas served</p>
        <span class="arrow">View Services →</span>
      </a>`).join('')}
    </div>`).join('');

  const citiesBody = `
    <p>MyBuddyMaid serves families across ${cities.length}+ cities in India. Find verified maids, cooks, nannies, and caregivers in your city with 24-hour deployment and 1-year replacement guarantee.</p>
    <div class="city-stats">
      <div class="city-stat"><span class="num">${cities.length}+</span><span class="label">Cities</span></div>
      <div class="city-stat"><span class="num">${cities.reduce((s,c) => s + (c.localities ? c.localities.length : 0), 0)}+</span><span class="label">Areas</span></div>
      <div class="city-stat"><span class="num">6</span><span class="label">Services</span></div>
      <div class="city-stat"><span class="num">24hr</span><span class="label">Deployment</span></div>
    </div>
    ${cityGroupHtml}
    <div class="hub-cta"><h3>Don't See Your City?</h3><p>We're expanding rapidly. Contact us and we'll check if service is available in your area.</p><a href="/home" class="btn btn-primary">Check Availability</a></div>`;

  const citiesData = {
    ...config, domain: config.brand.domain, ga4Id: config.analytics.ga4, umamiId: config.analytics.umami,
    badge: '🇲🇨 Cities We Serve', h1: 'MyBuddyMaid — Cities We Serve Across India', heroSubtitle: `Verified domestic help in ${cities.length}+ cities. From Delhi to Chennai, Mumbai to Kolkata.`,
    breadcrumbTrail: '<strong>Cities</strong>', articleBody: citiesBody,
    canonicalUrl: `${config.brand.domain}/cities`, pageTitle: 'Cities We Serve — 42+ Indian Cities | MyBuddyMaid',
    pageDescription: `MyBuddyMaid provides verified maids, cooks, nannies across ${cities.length}+ Indian cities. Find home help in your city today.`,
    pageKeywords: 'MyBuddyMaid cities, domestic help India, maid service cities, home help near me',
    metaTitle: 'Cities We Serve | MyBuddyMaid', metaDescription: `Verified home help in ${cities.length}+ Indian cities.`,
    breadcrumbSchema: breadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Cities', url: '/cities.html' }], config.brand.domain),
  };
  writePage('cities.html', render(templates.hub, citiesData));
  sitemapUrls.push({ url: '/cities', priority: '0.9', freq: 'weekly' });
  count++;

  // Blog Hub
  const blogCards = blogPosts.slice(0, 18).map(b => `
    <a href="/blog/${b.slug}.html" class="hub-card">
      <span class="icon">${b.category.split(' ')[0]}</span>
      <h4>${b.h1.length > 60 ? b.h1.substring(0, 57) + '...' : b.h1}</h4>
      <p>${b.heroSubtitle ? b.heroSubtitle.substring(0, 100) + '...' : ''}</p>
      <span class="arrow">${b.readTime} min read →</span>
    </a>`).join('\n');

  const blogBody = `
    <p>Expert guides, tips, and insights on hiring and managing domestic help in India. Written by the MyBuddyMaid team based on real experience serving 12,000+ families.</p>
    <div class="hub-grid">${blogCards}</div>`;

  const blogData = {
    ...config, domain: config.brand.domain, ga4Id: config.analytics.ga4, umamiId: config.analytics.umami,
    badge: '📝 Blog & Guides', h1: 'MyBuddyMaid Blog — Home Help Guides & Tips', heroSubtitle: 'Expert advice on hiring, managing, and getting the best from domestic help in India.',
    breadcrumbTrail: '<strong>Blog</strong>', articleBody: blogBody,
    canonicalUrl: `${config.brand.domain}/blog`, pageTitle: 'Blog — Home Help Guides & Tips | MyBuddyMaid',
    pageDescription: 'Expert guides on hiring maids, cooks, nannies in India. Salary guides, safety tips, and management advice from MyBuddyMaid.',
    pageKeywords: 'domestic help blog, maid hiring tips, home help guide India, MyBuddyMaid blog',
    metaTitle: 'Blog & Guides | MyBuddyMaid', metaDescription: 'Expert home help guides for Indian families.',
    breadcrumbSchema: breadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Blog', url: '/blog.html' }], config.brand.domain),
  };
  writePage('blog.html', render(templates.hub, blogData));
  sitemapUrls.push({ url: '/blog', priority: '0.8', freq: 'weekly' });
  count++;

  // Salary Guides Hub
  const salaryCards = cities.filter(c => c.tier <= 2).slice(0, 15).map(c => `<a href="/domestic-help-salary-in-${c.slug}-2026.html">💰 ${c.name}</a>`).join('\n');
  const salaryBody = `
    <p>Complete, updated salary guides for domestic help across major Indian cities. Know exactly what to pay your maid, cook, nanny, or caregiver in 2026.</p>
    <h2>Salary Guides by City</h2>
    <div class="hub-link-grid">${cities.map(c => `<a href="/domestic-help-salary-in-${c.slug}-2026.html">${c.name}</a>`).join('\n')}</div>
    <h2>Salary Guides by Service</h2>
    <div class="hub-link-grid">${services.map(s => `<a href="/${s.slug}.html">${s.icon} ${s.name}</a>`).join('\n')}</div>`;

  const salaryHubData = {
    ...config, domain: config.brand.domain, ga4Id: config.analytics.ga4, umamiId: config.analytics.umami,
    badge: '💰 Salary Guides', h1: 'Domestic Help Salary Guides — All Indian Cities (2026)', heroSubtitle: 'Updated monthly salary ranges for maids, cooks, nannies, and caregivers across 42+ cities.',
    breadcrumbTrail: '<strong>Salary Guides</strong>', articleBody: salaryBody,
    canonicalUrl: `${config.brand.domain}/salary-guides`, pageTitle: 'Domestic Help Salary Guides 2026 — All Cities | MyBuddyMaid',
    pageDescription: 'Complete 2026 salary data for maids, cooks, nannies in 42+ Indian cities. Updated monthly.',
    pageKeywords: 'maid salary India, cook salary, domestic help salary guide, nanny cost India 2026',
    metaTitle: 'Salary Guides 2026 | MyBuddyMaid', metaDescription: 'Domestic help salary data for 42+ Indian cities.',
    breadcrumbSchema: breadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Salary Guides', url: '/salary-guides.html' }], config.brand.domain),
  };
  writePage('salary-guides.html', render(templates.hub, salaryHubData));
  sitemapUrls.push({ url: '/salary-guides', priority: '0.8', freq: 'monthly' });
  count++;

  console.log(`  ✓ Generated ${count} hub pages`);
}

// ═══════════════ PHASE 6: CITY INDEX PAGES ═══════════════
function generateCityIndexPages() {
  if (!templates.hub) return;
  console.log('\n🏙️  Generating city index pages...');

  const citiesDir = path.join(OUT_DIR, 'cities');
  if (!fs.existsSync(citiesDir)) fs.mkdirSync(citiesDir, { recursive: true });

  cities.forEach(city => {
    const serviceCards = services.map(s => {
      const sal = city.salaries && city.salaries[s.slug];
      return `<a href="/${s.slug}-in-${city.slug}.html" class="hub-card">
        <span class="icon">${s.icon}</span>
        <h4>${s.name} in ${city.name}</h4>
        <p>Starting from ${sal ? sal.partTime.split('–')[0].trim() : s.priceFrom}/month</p>
        <span class="arrow">View Details →</span>
      </a>`;
    }).join('\n');

    const localityLinks = (city.localities || []).map(l =>
      `<a href="/maid-service-in-${l.slug}-${city.slug}.html">${l.name}</a>`
    ).join('\n');

    const nearbyLinks = (city.nearbyCities || []).map(slug => {
      const nc = cities.find(c => c.slug === slug);
      return nc ? `<a href="/cities/${nc.slug}.html">${nc.name}</a>` : '';
    }).filter(Boolean).join('\n');

    const body = `
      <p>${city.context}</p>
      <div class="city-stats">
        <div class="city-stat"><span class="num">6</span><span class="label">Services</span></div>
        <div class="city-stat"><span class="num">${city.localities ? city.localities.length : 0}</span><span class="label">Areas</span></div>
        <div class="city-stat"><span class="num">Tier ${city.tier}</span><span class="label">City Tier</span></div>
        <div class="city-stat"><span class="num">24hr</span><span class="label">Deployment</span></div>
      </div>

      <h2>Home Help Services in ${city.name}</h2>
      <div class="hub-grid">${serviceCards}</div>

      <h2>Areas We Serve in ${city.name}</h2>
      <div class="hub-link-grid">${localityLinks}</div>

      <h2>Useful Resources for ${city.name}</h2>
      <div class="hub-link-grid">
        <a href="/domestic-help-salary-in-${city.slug}-2026.html">💰 Salary Guide — ${city.name}</a>
        <a href="/best-maid-service-in-${city.slug}.html">🏆 Best Maid Service</a>
        ${blogPosts.find(b => b.slug === 'domestic-help-guide-' + city.slug + '-2026') ? `<a href="/blog/domestic-help-guide-${city.slug}-2026.html">📝 City Guide</a>` : ''}
      </div>

      ${nearbyLinks ? `<h2>Nearby Cities</h2><div class="hub-link-grid">${nearbyLinks}</div>` : ''}

      <div class="hub-cta">
        <h3>Book Home Help in ${city.name}</h3>
        <p>Verified professionals deployed within 24 hours. 1-year replacement guarantee.</p>
        <a href="/home" class="btn btn-primary">Book Now in ${city.name}</a>
      </div>`;

    const data = {
      ...config, domain: config.brand.domain, ga4Id: config.analytics.ga4, umamiId: config.analytics.umami,
      badge: `🏙️ ${city.name}`, h1: `Home Help Services in ${city.name} — MyBuddyMaid`,
      heroSubtitle: `${city.context.substring(0, 150)}...`,
      breadcrumbTrail: `<a href="/cities.html">Cities</a> <span>›</span> <strong>${city.name}</strong>`,
      articleBody: body,
      canonicalUrl: `${config.brand.domain}/cities/${city.slug}`,
      pageTitle: `Home Help Services in ${city.name} — Maid, Cook, Nanny | MyBuddyMaid`,
      pageDescription: `Find verified maids, cooks, nannies, and caregivers in ${city.name}. All services with 24-hour deployment. ${city.localities ? city.localities.length : 0}+ areas served.`,
      pageKeywords: `home help ${city.name}, maid ${city.name}, cook ${city.name}, nanny ${city.name}, domestic help ${city.name}`,
      metaTitle: `Home Help in ${city.name} | MyBuddyMaid`,
      metaDescription: `Verified domestic help in ${city.name}. ${city.localities ? city.localities.length : 0}+ areas served.`,
      breadcrumbSchema: breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Cities', url: '/cities.html' },
        { name: city.name, url: `/cities/${city.slug}.html` }
      ], config.brand.domain),
    };

    const html = render(templates.hub, data);
    fs.writeFileSync(path.join(citiesDir, `${city.slug}.html`), html, 'utf-8');
    sitemapUrls.push({ url: `/cities/${city.slug}`, priority: '0.8', freq: 'monthly' });
  });
  console.log(`  ✓ Generated ${cities.length} city index pages`);
}

// ═══════════════ PHASE 6: STATE PAGES ═══════════════
function generateStatePages() {
  if (!templates.hub) return;
  console.log('\n🇲🇨 Generating state pages...');

  const stateDir = path.join(OUT_DIR, 'state');
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });

  // Group cities by state
  const stateMap = {};
  cities.forEach(c => {
    const key = c.stateSlug || c.state.toLowerCase().replace(/\s+/g, '-');
    if (!stateMap[key]) stateMap[key] = { name: c.state, slug: key, cities: [] };
    stateMap[key].cities.push(c);
  });

  Object.values(stateMap).forEach(state => {
    const cityCards = state.cities.map(c => `
      <a href="/cities/${c.slug}.html" class="hub-card">
        <h4>${c.name}</h4>
        <p>Tier ${c.tier} • ${c.localities ? c.localities.length : 0} areas • ${c.population}</p>
        <span class="arrow">View Services →</span>
      </a>`).join('\n');

    const totalLocalities = state.cities.reduce((s, c) => s + (c.localities ? c.localities.length : 0), 0);

    const serviceLinks = services.map(s =>
      state.cities.map(c => `<a href="/${s.slug}-in-${c.slug}.html">${s.name} in ${c.name}</a>`).join('\n')
    ).join('\n');

    const body = `
      <p>MyBuddyMaid provides verified domestic help services across ${state.cities.length} cities in ${state.name}. From maids and cooks to nannies and elderly caregivers — all professionals are police-verified with a 1-year replacement guarantee.</p>
      <div class="city-stats">
        <div class="city-stat"><span class="num">${state.cities.length}</span><span class="label">Cities</span></div>
        <div class="city-stat"><span class="num">${totalLocalities}</span><span class="label">Areas</span></div>
        <div class="city-stat"><span class="num">6</span><span class="label">Services</span></div>
        <div class="city-stat"><span class="num">24hr</span><span class="label">Deployment</span></div>
      </div>

      <h2>Cities in ${state.name}</h2>
      <div class="hub-grid">${cityCards}</div>

      <h2>All Services in ${state.name}</h2>
      <div class="hub-link-grid">${serviceLinks}</div>

      <div class="hub-cta">
        <h3>Book Home Help in ${state.name}</h3>
        <p>Verified professionals across ${state.cities.length} cities in ${state.name}. 24-hour deployment.</p>
        <a href="/home" class="btn btn-primary">Book Now</a>
      </div>`;

    const data = {
      ...config, domain: config.brand.domain, ga4Id: config.analytics.ga4, umamiId: config.analytics.umami,
      badge: `🇲🇨 ${state.name}`, h1: `Home Help Services in ${state.name} — MyBuddyMaid`,
      heroSubtitle: `Verified maids, cooks, nannies across ${state.cities.length} cities in ${state.name}.`,
      breadcrumbTrail: `<a href="/cities.html">Cities</a> <span>›</span> <strong>${state.name}</strong>`,
      articleBody: body,
      canonicalUrl: `${config.brand.domain}/state/${state.slug}`,
      pageTitle: `Home Help Services in ${state.name} — ${state.cities.length} Cities | MyBuddyMaid`,
      pageDescription: `Verified domestic help in ${state.name}. Maids, cooks, nannies across ${state.cities.map(c => c.name).slice(0, 5).join(', ')} and more.`,
      pageKeywords: `home help ${state.name}, maid service ${state.name}, domestic help ${state.name}, cook ${state.name}`,
      metaTitle: `Home Help in ${state.name} | MyBuddyMaid`,
      metaDescription: `Verified domestic help across ${state.cities.length} cities in ${state.name}.`,
      breadcrumbSchema: breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Cities', url: '/cities.html' },
        { name: state.name, url: `/state/${state.slug}.html` }
      ], config.brand.domain),
    };

    const html = render(templates.hub, data);
    fs.writeFileSync(path.join(stateDir, `${state.slug}.html`), html, 'utf-8');
    sitemapUrls.push({ url: `/state/${state.slug}`, priority: '0.7', freq: 'monthly' });
  });
  console.log(`  ✓ Generated ${Object.keys(stateMap).length} state pages`);
}

main();
