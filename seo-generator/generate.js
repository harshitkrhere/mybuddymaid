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

  // Generate sitemap
  generateSitemap();

  // Summary
  console.log('\n═══════════════════════════════════════════');
  console.log(`  ✅ TOTAL PAGES GENERATED: ${sitemapUrls.length}`);
  console.log(`  ✅ SITEMAP URLS: ${sitemapUrls.length + 4} (+ existing pages)`);
  console.log('═══════════════════════════════════════════');
}

main();
