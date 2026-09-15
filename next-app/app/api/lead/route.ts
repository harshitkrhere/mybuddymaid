// app/api/lead/route.ts — unauthenticated call-back requests from the location pages.
//
// Off unless LEADS_ENABLED=true and the Supabase service credentials are set: the `leads`
// table arrives with supabase/migrations/20260915120000_leads_and_placement_locality.sql,
// which the owner applies (ASSUMPTIONS.md #12). The rules live in lib/leads/validate.ts and
// are tested there; this file is the order of the checks and the two side effects:
//   1. the row, through PostgREST with the service-role key (lib/leads/store.ts);
//   2. once the response is sent, a conversation in the team's Chatwoot inbox with the
//      request as its first message (lib/support/chatwoot.ts), so a call-back is answered
//      where every other customer conversation is and its reply time is measured there.
// Rejections, cheapest first: the flag, a foreign Origin, the per-address limit, bad JSON,
// the field rules. Two requests are accepted without a row: a filled honeypot field, and a
// second request for the same number within ten minutes. The limits are per instance
// (lib/leads/rate-limit.ts) — a stated limitation, not a guarantee.
import { NextResponse, after } from 'next/server';
import { CITY_BY_SLUG, LOCALITY_BY_PATH, SERVICE_BY_SLUG, isServiceable } from '@/data/seo';
import { ENTITY_BY_PATH } from '@/data/seo/entities';
import { validateLead, originAllowed, clientIp, type LeadInput, type LeadRules } from '@/lib/leads/validate';
import { SlidingWindow } from '@/lib/leads/rate-limit';
import { insertLead, linkLeadConversation } from '@/lib/leads/store';
import { recordClientFromEnv } from '@/lib/support/record';
import { chatwootFromEnv, openLeadConversation } from '@/lib/support/chatwoot';
import { refFor } from '@/lib/assistant/ref';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEN_MINUTES = 10 * 60_000;
const perAddress = new SlidingWindow(5, TEN_MINUTES);
const perPhone = new SlidingWindow(1, TEN_MINUTES);

const RULES: LeadRules = {
  cityExists: (city) => CITY_BY_SLUG.has(city as never),
  localityExists: (city, locality) => LOCALITY_BY_PATH.has(`${city}/${locality}`),
  serviceExists: (service) => SERVICE_BY_SLUG.has(service as never),
  pincodeServiceable: (pincode) => isServiceable(pincode),
  entityExists: (city, locality, entity) => ENTITY_BY_PATH.has(`${city}/${locality}/${entity}`),
};

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

export async function POST(request: Request) {
  if (process.env.LEADS_ENABLED !== 'true') return json({ error: 'Lead capture is not enabled' }, 503);

  const h = request.headers;
  if (!originAllowed(h.get('origin'), [h.get('x-forwarded-host'), h.get('host')])) return json({ error: 'Forbidden' }, 403);
  if (!perAddress.allow(clientIp(h))) {
    return json({ error: 'Too many requests from this connection. Please try again in a few minutes, or message us on WhatsApp.' }, 429);
  }

  let body: LeadInput;
  try {
    body = ((await request.json()) ?? {}) as LeadInput;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const v = validateLead(body, RULES);
  if (!v.ok) return json({ error: v.error, field: v.field }, 400);
  if (v.honeypot) return json({ ok: true });
  const row = v.row;
  if (!perPhone.allow(row.phone)) return json({ ok: true });

  const store = recordClientFromEnv();
  if (!store) return json({ error: 'Lead storage is not configured' }, 503);
  const inserted = await insertLead(store, row);
  if (!inserted) {
    // nothing was saved, so the number must not count as seen: a retry has to reach the database again
    perPhone.forget(row.phone);
    return json({ error: 'Could not save your request' }, 502);
  }

  const chatwoot = chatwootFromEnv();
  if (chatwoot) {
    after(async () => {
      try {
        const chatwootId = await openLeadConversation(chatwoot, {
          leadId: inserted.id,
          ref: refFor(inserted.id),
          name: row.name,
          phone: row.phone,
          city: row.city_slug,
          cityName: CITY_BY_SLUG.get(row.city_slug as never)?.name ?? row.city_slug,
          locality: row.locality_slug,
          localityName: LOCALITY_BY_PATH.get(`${row.city_slug}/${row.locality_slug}`)?.name ?? row.locality_slug,
          service: row.service_slug,
          serviceName: row.service_slug ? (SERVICE_BY_SLUG.get(row.service_slug as never)?.name ?? row.service_slug) : null,
          pincode: row.pincode,
          society: row.society,
          page: row.source_page,
        });
        if (chatwootId !== null) await linkLeadConversation(store, inserted.id, chatwootId);
      } catch (e) {
        console.error('[lead] after() threw', e instanceof Error ? e.message : e);
      }
    });
  }
  return json({ ok: true });
}
