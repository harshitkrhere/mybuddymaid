// scripts/growth/data-check.ts — a read-only look at the shape of the bookings and profiles
// tables, for the questions the first weekly report raised: were the 186 sign-ups and 81
// booking requests in one week real activity or a database copy, and why did 61 booking
// cities not match the eight served cities?
//
// Prints aggregates only — counts per day, per status, and the raw city strings that the
// report could not match — never a name, e-mail or phone number. Runs where the service
// key lives (GitHub Actions, growth-datacheck.yml) or locally with the two variables set:
//
//   $env:NEXT_PUBLIC_SUPABASE_URL = 'https://<ref>.supabase.co'
//   $env:SUPABASE_SERVICE_ROLE_KEY = '<sb_secret_...>'
//   npm run growth:datacheck
import { CITIES, ZONES } from '../../data/seo';
import { fetchAll, normaliseCityText, type PgClient } from '../../lib/growth/supabase';
import { fail, fetchImpl } from './_env';

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

  const profiles = await fetchAll<{ created_at: string }>(client, 'profiles', 'select=created_at&order=created_at.asc');
  const bookings = await fetchAll<{ created_at: string; status: string | null; city: string | null }>(client, 'bookings', 'select=created_at,status,city&order=created_at.asc');
  console.log(`## Data check ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(`profiles: ${profiles.length} rows, first ${profiles[0] ? day(profiles[0].created_at) : '-'}, last ${profiles.at(-1) ? day(profiles.at(-1)!.created_at) : '-'}`);
  console.log(`bookings: ${bookings.length} rows, first ${bookings[0] ? day(bookings[0].created_at) : '-'}, last ${bookings.at(-1) ? day(bookings.at(-1)!.created_at) : '-'}`);

  const pm: Record<string, number> = {};
  for (const p of profiles) count(pm, month(p.created_at));
  table('Profiles created, by month', pm);
  const pd: Record<string, number> = {};
  const since = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
  for (const p of profiles) if (day(p.created_at) >= since) count(pd, day(p.created_at));
  table('Profiles created, by day (last 45 days)', pd);

  const bm: Record<string, number> = {};
  for (const b of bookings) count(bm, month(b.created_at));
  table('Bookings created, by month', bm);
  const bd: Record<string, number> = {};
  for (const b of bookings) if (day(b.created_at) >= since) count(bd, day(b.created_at));
  table('Bookings created, by day (last 45 days)', bd);

  const st: Record<string, number> = {};
  for (const b of bookings) count(st, b.status ?? '(null)');
  table('Bookings by status (all time)', st, false);

  const matched: Record<string, number> = {};
  const unmatched: Record<string, number> = {};
  for (const b of bookings) {
    const slug = normaliseCityText(b.city, CITIES, ZONES);
    if (slug) count(matched, slug);
    else count(unmatched, (b.city ?? '(empty)').trim().slice(0, 40) || '(empty)');
  }
  table('Bookings by matched city (all time)', matched, false);
  table('City strings the report could not match (all time, top 40)', unmatched, false);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
