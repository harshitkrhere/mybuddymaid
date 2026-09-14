// Run: npx tsx --test lib/leads/schema.test.ts
//
// Cross-file: the lead route inserts columns that only exist once the owner applies the
// 2026-09-15 migration, and PostgREST rejects any column it does not know (FIN-B03 was exactly
// this — the old route wrote `city` and `locality` into a table defined with `city_slug` and
// `locality_slug`). So the row's keys are pinned to the CREATE TABLE in the migration, the
// migration to its place in supabase/migrations/, the route to its order of checks, and the
// form to the fields the route validates and to its place below the fold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLead, type LeadRules } from './validate';

const REPO = resolve(fileURLToPath(import.meta.url), '../../../..');
const read = (p: string) => readFileSync(resolve(REPO, p), 'utf8');
const MIGRATION = 'supabase/migrations/20260915120000_leads_and_placement_locality.sql';

const ALL: LeadRules = { cityExists: () => true, localityExists: () => true, serviceExists: () => true, pincodeServiceable: () => true, entityExists: () => true };

function columnsOf(sql: string, table: string): Set<string> {
  const m = sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\);`));
  assert.ok(m, `CREATE TABLE ${table} in the migration`);
  return new Set(
    m[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('--') && !/^(CHECK|REFERENCES)/.test(l))
      .map((l) => l.split(/\s+/)[0]),
  );
}

test('the leads migration lives in supabase/migrations, newest of all, and migrations-pending is gone', () => {
  const files = readdirSync(resolve(REPO, 'supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  assert.equal(files.at(-1), MIGRATION.split('/').pop());
  assert.throws(() => readdirSync(resolve(REPO, 'supabase/migrations-pending')), 'nothing may wait in migrations-pending once promoted');
});

test('every column the route inserts exists on the leads table', () => {
  const cols = columnsOf(read(MIGRATION), 'leads');
  const v = validateLead(
    { name: 'Priya', phone: '9876543210', city: 'gurgaon', locality: 'dlf-phase-3', service: 'cook', pincode: '122010', entity: 'park-place', society: 'Tower B', page: '/x', attribution: { last: { gclid: 'a' } } },
    ALL,
  );
  assert.ok(v.ok && !v.honeypot);
  for (const k of Object.keys(v.row)) assert.ok(cols.has(k), `leads.${k} is missing from the migration`);
  for (const k of ['attribution', 'chatwoot_conversation_id']) assert.ok(cols.has(k), `leads.${k}`);
});

test('bookings gains every column the booking app writes', () => {
  const sql = read(MIGRATION);
  const app = read('app/src/lib/booking.js');
  const m = app.match(/LOCATION_COLUMNS = \[([^\]]*)\]/);
  assert.ok(m, 'LOCATION_COLUMNS in app/src/lib/booking.js');
  const written = m[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter(Boolean);
  assert.ok(written.length >= 5);
  for (const c of written) assert.match(sql, new RegExp(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ${c}\\s`), `bookings.${c}`);
});

test('the route is the thin shell: flag, origin, address limit, rules, honeypot, phone limit, insert, after()', () => {
  const route = read('next-app/app/api/lead/route.ts');
  const order = ['LEADS_ENABLED', 'originAllowed(', 'perAddress.allow(', 'validateLead(', 'v.honeypot', 'perPhone.allow(', 'insertLead(', 'after(', 'openLeadConversation(', 'linkLeadConversation('];
  let last = -1;
  for (const needle of order) {
    const i = route.indexOf(needle);
    assert.ok(i > last, `${needle} in order`);
    last = i;
  }
  assert.doesNotMatch(route, /\bcity:\s*city\b|\blocality:\s*locality\b|\bservice:\s*service\b/, 'the old column names (FIN-B03)');
  assert.match(route, /import \{ NextResponse, after \} from 'next\/server'/);
});

test('the form posts every field the route validates, announces its errors, and sits below the pricing table', () => {
  const form = read('next-app/components/seo/LeadForm.tsx');
  for (const field of ['name', 'phone', 'city', 'locality', 'service', 'pincode: ctx.pincode', 'entity: ctx.entity', 'society', 'attribution: readAttribution()', 'website']) assert.ok(form.includes(field), `the form sends ${field}`);
  assert.match(form, /role="alert"/);
  assert.match(form, /aria-describedby/);
  assert.match(form, /aria-invalid/);
  assert.doesNotMatch(form, /\) return;/, 'no silent return on a bad field (FIN-B06)');
  const page = read('next-app/components/seo/SeoPage.tsx');
  const hero = page.slice(page.indexOf('<header className="hero">'), page.indexOf('</header>'));
  assert.doesNotMatch(hero, /LeadForm/, 'the hero already has three CTAs; the form goes below the fold');
  assert.ok(page.indexOf('<LeadForm') > page.indexOf('Indicative pricing'), 'the form follows the pricing table');
});
