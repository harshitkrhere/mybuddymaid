// scripts/growth/ga4.ts — the weekly GA4 snapshot: CTA events (whatsapp_click, call_click,
// app_click) by city, locality and service, and organic sessions by geo city, for two
// adjacent weeks.
//
//   $env:GSC_SERVICE_ACCOUNT_JSON = 'C:\keys\mbm-growth.json'   # the same key, Viewer on the GA4 property
//   $env:GA4_PROPERTY_ID = '123456789'
//   npm run growth:ga4 -- --list-properties   # find the numeric property id
//   npm run growth:ga4 -- --metadata          # list the dimensions the property exposes
//   npm run growth:ga4
//
// The CTA breakdown needs the event parameters registered as custom dimensions first
// (`npm run growth:ga4:register`); until then that part is null and the snapshot says why.
import * as path from 'node:path';
import { CITIES, ZONES } from '../../data/seo';
import { accessToken, bearer, SCOPES } from '../../lib/growth/google-auth';
import { buildGa4Snapshot, ctaReportBody, GA4_ADMIN_API, GA4_DATA_API, missingDimensions, organicGeoBody, registeredDimensionNames, runReport, type ReportRow } from '../../lib/growth/ga4';
import type { WindowKey } from '../../lib/growth/windows';
import { dataDir, endDate, fail, fetchImpl, hasFlag, nowIso, rawDump, readServiceAccount, windowsFor, writeJson } from './_env';

async function getJson(token: string, url: string): Promise<unknown> {
  const res = await fetchImpl(url, { headers: bearer(token) });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function main() {
  const key = readServiceAccount();
  const token = await accessToken(key, [SCOPES.ga4Read]);

  if (hasFlag('--list-properties')) {
    const j = (await getJson(token, `${GA4_ADMIN_API}/accountSummaries`)) as { accountSummaries?: Array<{ displayName?: string; propertySummaries?: Array<{ property?: string; displayName?: string }> }> };
    for (const a of j.accountSummaries ?? []) for (const p of a.propertySummaries ?? []) console.log(`${p.property?.replace('properties/', '')}\t${a.displayName} / ${p.displayName}`);
    return;
  }

  const propertyId = process.env.GA4_PROPERTY_ID ?? fail('Set GA4_PROPERTY_ID (numeric; `npm run growth:ga4 -- --list-properties` prints it).');

  if (hasFlag('--metadata')) {
    const j = (await getJson(token, `${GA4_DATA_API}/properties/${propertyId}/metadata`)) as { dimensions?: Array<{ apiName: string; customDefinition?: boolean }> };
    for (const d of j.dimensions ?? []) if (d.customDefinition || /^(city|region|pagePath|landingPage|sessionDefaultChannelGroup|eventName)$/.test(d.apiName)) console.log(d.apiName);
    return;
  }

  const end = endDate();
  const windows = windowsFor(end);
  const errors: string[] = [];
  let registered: string[] = [];
  try {
    const list = await getJson(token, `${GA4_ADMIN_API}/properties/${propertyId}/customDimensions?pageSize=200`);
    rawDump('ga4-custom-dimensions', list);
    registered = registeredDimensionNames(list);
  } catch (e) {
    errors.push(`custom dimensions: ${(e as Error).message}`);
  }
  const canBreakDown = missingDimensions(registered).filter((d) => ['city', 'locality', 'service'].includes(d.parameterName)).length === 0;
  if (!canBreakDown) errors.push('CTA breakdown skipped: city/locality/service are not registered as custom dimensions (run npm run growth:ga4:register, then wait 24-48 h)');

  const cta = {} as Record<WindowKey, ReportRow[] | null>;
  const geo = {} as Record<WindowKey, ReportRow[] | null>;
  for (const k of ['current', 'previous'] as WindowKey[]) {
    const w = windows[k];
    cta[k] = null;
    geo[k] = null;
    if (canBreakDown) {
      try {
        cta[k] = await runReport(fetchImpl, token, propertyId, ctaReportBody(w));
        rawDump(`ga4-cta-${k}`, cta[k]);
      } catch (e) {
        errors.push(`cta ${k}: ${(e as Error).message}`);
      }
    }
    try {
      geo[k] = await runReport(fetchImpl, token, propertyId, organicGeoBody(w));
      rawDump(`ga4-geo-${k}`, geo[k]);
    } catch (e) {
      errors.push(`organic geo ${k}: ${(e as Error).message}`);
    }
  }

  const snapshot = buildGa4Snapshot({ propertyId, generatedAt: nowIso(), windows, registered, cta, geo, cities: CITIES, zones: ZONES, errors });
  const file = path.join(dataDir('ga4'), `${end}.json`);
  writeJson(file, snapshot);
  const c = snapshot.cta.current;
  const g = snapshot.organicGeo.current;
  console.log(`\nGA4 ${windows.current.start} to ${windows.current.end} -> ${file}`);
  console.log(c ? `CTA clicks: whatsapp ${c.total.whatsapp_click}, call ${c.total.call_click}, app ${c.total.app_click}` : 'CTA breakdown: unavailable');
  console.log(g ? `organic sessions: ${g.totalSessions} (${Object.keys(g.byCity).length} mapped cities, ${g.unmapped.length} unmapped)` : 'organic sessions: unavailable');
  if (g?.unmapped.length) console.log(`unmapped geo cities to reconcile: ${g.unmapped.map((u) => `${u.city} (${u.sessions})`).join(', ')}`);
  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
