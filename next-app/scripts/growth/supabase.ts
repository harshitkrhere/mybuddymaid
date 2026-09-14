// scripts/growth/supabase.ts — the weekly funnel counts from the live database: signups
// (profiles), booking requests by status and city, support conversations and, once the
// table exists, leads. Counts only; no name, phone or message is ever read.
//
//   $env:NEXT_PUBLIC_SUPABASE_URL = 'https://<ref>.supabase.co'
//   $env:SUPABASE_SERVICE_ROLE_KEY = '<sb_secret_...>'
//   npm run growth:supabase
//   Remove-Item Env:\SUPABASE_SERVICE_ROLE_KEY
import * as path from 'node:path';
import { CITIES, ZONES } from '../../data/seo';
import { buildSupabaseSnapshot, fetchAll, TableMissingError, type BookingRow, type LeadRow, type PgClient, type SupportRow } from '../../lib/growth/supabase';
import { dataDir, endDate, fail, fetchImpl, nowIso, windowsFor, writeJson } from './_env';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ?? fail('Set NEXT_PUBLIC_SUPABASE_URL.');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? fail('Set SUPABASE_SERVICE_ROLE_KEY (server-only; never NEXT_PUBLIC_).');
  const client: PgClient = { url, key, fetchImpl };
  const end = endDate();
  const windows = windowsFor(end);
  const since = `${windows.previous.start}T00:00:00Z`;
  const until = `${end}T23:59:59.999Z`;
  const errors: string[] = [];

  const signups = await fetchAll<{ created_at: string }>(client, 'profiles', `select=created_at&created_at=gte.${since}&created_at=lte.${until}`);

  let bookings: BookingRow[];
  try {
    bookings = await fetchAll<BookingRow>(client, 'bookings', `select=created_at,status,service,city,city_slug&created_at=gte.${since}&created_at=lte.${until}`);
  } catch {
    // city_slug arrives with the leads migration; until then the free-text city is normalised
    bookings = await fetchAll<BookingRow>(client, 'bookings', `select=created_at,status,service,city&created_at=gte.${since}&created_at=lte.${until}`);
  }

  let support: SupportRow[] = [];
  try {
    support = await fetchAll<SupportRow>(client, 'support_conversations', `select=started_at,city_slug,escalated,outcome&started_at=gte.${since}&started_at=lte.${until}`);
  } catch (e) {
    errors.push(`support_conversations: ${(e as Error).message}`);
  }

  let leads: LeadRow[] | null = null;
  try {
    // every lead in the two windows, plus every lead still 'new' whatever its age (the stale count)
    leads = await fetchAll<LeadRow>(client, 'leads', `select=created_at,status,city_slug,service_slug&or=(created_at.gte.${since},status.eq.new)`);
  } catch (e) {
    if (e instanceof TableMissingError) errors.push('leads: table does not exist yet (Phase 1d); reported as null');
    else errors.push(`leads: ${(e as Error).message}`);
  }

  const snapshot = buildSupabaseSnapshot({ generatedAt: nowIso(), now: new Date(), windows, signups, bookings, support, leads, cities: CITIES, zones: ZONES, errors });
  const file = path.join(dataDir('supabase'), `${end}.json`);
  writeJson(file, snapshot);
  const c = snapshot.bookings.current;
  console.log(`\nSupabase ${windows.current.start} to ${windows.current.end} -> ${file}`);
  console.log(`signups ${snapshot.signups.current}, booking requests ${c.total} (confirmed ${c.confirmed}, unmapped city ${c.unmappedCity}), chats ${snapshot.support.current.conversations}, leads ${snapshot.leads ? snapshot.leads.current.total : 'n/a'}`);
  for (const e of errors) console.error(e);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
