// Run: npx tsx --test lib/growth/ga4.test.ts
//
// GA4 answers in positional arrays keyed by separate header arrays, and its geo dimension
// spells Indian cities its own way. The report must not lose CTA clicks to a mis-keyed
// column, and a session from "Gurugram" belongs to Gurgaon while one from "Thane" belongs
// to nobody — it is listed as unmapped, never guessed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, ZONES } from '../../data/seo';
import { CUSTOM_DIMENSIONS, ctaBreakdown, ctaReportBody, mapGeoCity, missingDimensions, organicGeo, organicGeoBody, parseRunReport, registeredDimensionNames } from './ga4';

test('parseRunReport keys every row by the header names', () => {
  const rows = parseRunReport({
    dimensionHeaders: [{ name: 'eventName' }, { name: 'customEvent:city' }],
    metricHeaders: [{ name: 'eventCount' }],
    rows: [{ dimensionValues: [{ value: 'whatsapp_click' }, { value: 'gurgaon' }], metricValues: [{ value: '12' }] }],
  });
  assert.deepEqual(rows, [{ dims: { eventName: 'whatsapp_click', 'customEvent:city': 'gurgaon' }, metrics: { eventCount: 12 } }]);
  assert.deepEqual(parseRunReport({}), []);
});

test('ctaBreakdown totals per event, per city, per service and ranks localities', () => {
  const r = (eventName: string, city: string, locality: string, service: string, eventCount: number) => ({
    dims: { eventName, 'customEvent:city': city, 'customEvent:locality': locality, 'customEvent:service': service },
    metrics: { eventCount },
  });
  const b = ctaBreakdown([
    r('whatsapp_click', 'gurgaon', 'dlf-phase-1', 'cook', 5),
    r('call_click', 'gurgaon', 'dlf-phase-1', '(none)', 2),
    r('whatsapp_click', '(not set)', '(not set)', '(not set)', 3),
    r('app_click', 'noida', 'sector-50', 'cook', 1),
    r('page_view', 'noida', 'sector-50', 'cook', 99),
  ]);
  assert.deepEqual(b.total, { whatsapp_click: 8, call_click: 2, app_click: 1 });
  assert.equal(b.byCity.gurgaon.whatsapp_click, 5);
  assert.equal(b.byCity['(none)'].whatsapp_click, 3);
  assert.equal(b.byService.cook.app_click, 1);
  assert.deepEqual(b.topLocalities[0], { city: 'gurgaon', locality: 'dlf-phase-1', events: { whatsapp_click: 5, call_click: 2, app_click: 0 } });
});

test('mapGeoCity maps GA4 spellings through the data layer and leaves unknown cities unmapped', () => {
  assert.equal(mapGeoCity('Gurugram', CITIES, ZONES), 'gurgaon');
  assert.equal(mapGeoCity('Bengaluru', CITIES, ZONES), 'bangalore');
  assert.equal(mapGeoCity('New Delhi', CITIES, ZONES), 'delhi');
  assert.equal(mapGeoCity('Navi Mumbai', CITIES, ZONES), 'mumbai');
  assert.equal(mapGeoCity('Noida Extension', CITIES, ZONES), 'greater-noida');
  assert.equal(mapGeoCity('(not set)', CITIES, ZONES), null);
  assert.equal(mapGeoCity('Thane', CITIES, ZONES), null);
});

test('organicGeo sums sessions per mapped city and lists the unmapped ones by size', () => {
  const g = organicGeo(
    [
      { dims: { city: 'Gurugram', region: 'Haryana' }, metrics: { sessions: 40, activeUsers: 30 } },
      { dims: { city: 'Gurgaon', region: 'Haryana' }, metrics: { sessions: 10, activeUsers: 9 } },
      { dims: { city: 'Thane', region: 'Maharashtra' }, metrics: { sessions: 6, activeUsers: 6 } },
      { dims: { city: 'Hyderabad', region: 'Telangana' }, metrics: { sessions: 9, activeUsers: 8 } },
    ],
    CITIES,
    ZONES,
  );
  assert.equal(g.totalSessions, 65);
  assert.deepEqual(g.byCity.gurgaon, { sessions: 50, users: 39 });
  assert.deepEqual(g.unmapped.map((u) => u.city), ['Hyderabad', 'Thane']);
});

test('the report bodies ask for the registered custom dimensions and the organic channel', () => {
  const w = { start: '2026-09-05', end: '2026-09-11' };
  const cta = ctaReportBody(w);
  assert.deepEqual(
    cta.dimensions.map((d) => d.name),
    ['eventName', 'customEvent:city', 'customEvent:locality', 'customEvent:service'],
  );
  assert.deepEqual((cta.dimensionFilter as { filter: { inListFilter: { values: string[] } } }).filter.inListFilter.values, ['whatsapp_click', 'call_click', 'app_click']);
  const geo = organicGeoBody(w);
  assert.deepEqual(geo.dateRanges, [{ startDate: '2026-09-05', endDate: '2026-09-11' }]);
  assert.equal((geo.dimensionFilter as { filter: { stringFilter: { value: string } } }).filter.stringFilter.value, 'Organic Search');
});

test('missing dimensions are the specs not yet registered, event scope only', () => {
  const registered = registeredDimensionNames({ customDimensions: [{ parameterName: 'city', scope: 'EVENT' }, { parameterName: 'plan', scope: 'USER' }] });
  assert.deepEqual(registered, ['city']);
  assert.deepEqual(
    missingDimensions(registered).map((d) => d.parameterName),
    CUSTOM_DIMENSIONS.map((d) => d.parameterName).filter((n) => n !== 'city'),
  );
});
