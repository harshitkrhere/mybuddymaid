// scripts/growth/data-check.ts — a read-only look at the shape of the bookings and profiles
// tables, for the questions the first weekly report raised: were the 186 sign-ups and 81
// booking requests in one week real activity or a database copy, and why did 61 booking
// cities not match the eight served cities?
//
// The first run (2026-09-15) answered the second: the `city` column mostly holds a STATE
// ("Uttar Pradesh", "Gujarat", …), written by the old booking flow, and more than half of all
// booking requests came from states outside the eight cities. It also showed sign-ups and
// bookings falling from ~65 and ~30 a day to a handful on 2026-09-07, the relaunch day — so
// the day tables now run to today and split bookings into inside / outside the footprint.
//
// Prints aggregates only — counts per day, per status, and the raw city strings that the
// report could not match — never a name, e-mail or phone number. Runs where the service
// key lives (GitHub Actions, growth-datacheck.yml) or locally with the two variables set:
//
//   $env:NEXT_PUBLIC_SUPABASE_URL = 'https://<ref>.supabase.co'
//   $env:SUPABASE_SERVICE_ROLE_KEY = '<sb_secret_...>'
//   npm run growth:datacheck
//
// --purge-test-leads deletes the rows a probe of the live form leaves behind (name "Test lead
// (delete me)", phone 9999999999) and prints how many went. Nothing else is ever deleted.
import { CITIES, ZONES } from '../../data/seo';
import { fetchAll, normaliseCityText, type PgClient } from '../../lib/growth/supabase';
import { fail, fetchImpl, hasFlag } from './_env';

const DAYS = 45;
const day = (ts: string) => ts.slice(0, 10);
const month = (ts: string) => ts.slice(0, 7);
const count = (m: Record<string, number>, k: string) => {
  m[k] = (m[k] ?? 0) + 1;
};
const table = (title: string, m: Record<string, number>, sortByKey = true, limit = 40) => {
  console.log(`\n### ${title}\n`);
  console.log('| Value | Rows |\n|---|---:|');
  const rows = Object.entries(m).sort((a, b) => (sortByKey ? a[0].localeCompare(b[0]) : b[1] - a[1])).slice(0, limit);
  for (const [k, v] of rows) console.log(`| ${k} | ${v} |`);
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ?? fail('Set NEXT_PUBLIC_SUPABASE_URL.');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? fail('Set SUPABASE_SERVICE_ROLE_KEY.');
  const client: PgClient = { url, key, fetchImpl };

  if (hasFlag('--purge-test-leads')) {
    const res = await fetchImpl(`${url}/rest/v1/leads?phone=eq.9999999999&name=eq.${encodeURIComponent('Test lead (delete me)')}&select=id`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
    });
    const body = await res.text();
    if (!res.ok) fail(`purge failed: ${res.status} ${body.slice(0, 200)}`);
    console.log(`purged ${(JSON.parse(body) as unknown[]).length} test lead row(s)`);
  }

  const profiles = await fetchAll<{ created_at: string }>(client, 'profiles', 'select=created_at&order=created_at.asc');
  const bookings = await fetchAll<{ created_at: string; status: string | null; city: string | null }>(client, 'bookings', 'select=created_at,status,city&order=created_at.asc');
  console.log(`## Data check ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(`profiles: ${profiles.length} rows, first ${profiles[0] ? day(profiles[0].created_at) : '-'}, last ${profiles.at(-1) ? day(profiles.at(-1)!.created_at) : '-'}`);
  console.log(`bookings: ${bookings.length} rows, first ${bookings[0] ? day(bookings[0].created_at) : '-'}, last ${bookings.at(-1) ? day(bookings.at(-1)!.created_at) : '-'}`);

  const since = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10);
  const matchOf = (b: { city: string | null }) => normaliseCityText(b.city, CITIES, ZONES);

  const pm: Record<string, number> = {};
  for (const p of profiles) count(pm, month(p.created_at));
  table('Profiles created, by month', pm);

  const bm: Record<string, number> = {};
  for (const b of bookings) count(bm, month(b.created_at));
  table('Bookings created, by month', bm);

  // One row per day, every day, so a cliff is visible as a cliff and not as a missing row.
  console.log(`\n### By day, last ${DAYS} days — sign-ups, and booking requests inside / outside the eight cities\n`);
  console.log('| Day | Sign-ups | Booking requests | In the eight cities | City not matched |\n|---|---:|---:|---:|---:|');
  const pd: Record<string, number> = {};
  for (const p of profiles) if (day(p.created_at) >= since) count(pd, day(p.created_at));
  const bd: Record<string, { all: number; inside: number; outside: number }> = {};
  for (const b of bookings) {
    const d = day(b.created_at);
    if (d < since) continue;
    const row = (bd[d] ??= { all: 0, inside: 0, outside: 0 });
    row.all++;
    if (matchOf(b)) row.inside++;
    else row.outside++;
  }
  for (let i = DAYS; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const r = bd[d] ?? { all: 0, inside: 0, outside: 0 };
    console.log(`| ${d} | ${pd[d] ?? 0} | ${r.all} | ${r.inside} | ${r.outside} |`);
  }

  const st: Record<string, number> = {};
  for (const b of bookings) count(st, b.status ?? '(null)');
  table('Bookings by status (all time)', st, false);

  const matched: Record<string, number> = {};
  const matchedRecent: Record<string, number> = {};
  const unmatched: Record<string, number> = {};
  const unmatchedRecent: Record<string, number> = {};
  for (const b of bookings) {
    const slug = matchOf(b);
    const recent = day(b.created_at) >= since;
    if (slug) {
      count(matched, slug);
      if (recent) count(matchedRecent, slug);
    } else {
      const k = (b.city ?? '(empty)').trim().slice(0, 40) || '(empty)';
      count(unmatched, k);
      if (recent) count(unmatchedRecent, k);
    }
  }
  table('Bookings by matched city (all time)', matched, false);
  table(`Bookings by matched city (last ${DAYS} days)`, matchedRecent, false);
  table('City strings the report could not match (all time, top 40)', unmatched, false);
  table(`City strings the report could not match (last ${DAYS} days, top 40)`, unmatchedRecent, false);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
