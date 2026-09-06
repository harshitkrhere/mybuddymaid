// app/api/lead/route.ts — unauthenticated lead capture from the location pages.
// Disabled unless LEADS_ENABLED=true AND the Supabase service credentials are present,
// because the `leads` table needs a migration that this repo cannot apply on its own
// (see docs/seo/ASSUMPTIONS.md #12). Every location value is validated against the data
// layer, so nothing outside the service footprint can be written.
import { NextResponse } from 'next/server';
import { ALL_LOCALITIES, CITY_BY_SLUG, SERVICE_BY_SLUG, isServiceable } from '@/data/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LeadBody {
  name?: string;
  phone?: string;
  city?: string;
  locality?: string;
  service?: string;
  pincode?: string;
  page?: string;
}

export async function POST(request: Request) {
  if (process.env.LEADS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Lead capture is not enabled' }, { status: 503 });
  }

  let body: LeadBody;
  try {
    body = (await request.json()) as LeadBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = (body.name ?? '').trim().slice(0, 80);
  const phone = (body.phone ?? '').replace(/\D/g, '').slice(-10);
  const city = (body.city ?? '').trim();
  const locality = (body.locality ?? '').trim();
  const service = (body.service ?? '').trim();

  if (name.length < 2) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  if (!/^\d{10}$/.test(phone)) return NextResponse.json({ error: 'Valid 10-digit mobile required' }, { status: 400 });
  if (!CITY_BY_SLUG.has(city as never)) return NextResponse.json({ error: 'Unknown city' }, { status: 400 });
  if (!ALL_LOCALITIES.some((l) => l.city === city && l.slug === locality)) {
    return NextResponse.json({ error: 'We do not serve that locality yet' }, { status: 400 });
  }
  if (service && !SERVICE_BY_SLUG.has(service as never)) return NextResponse.json({ error: 'Unknown service' }, { status: 400 });
  if (body.pincode && !isServiceable(body.pincode)) return NextResponse.json({ error: 'Pincode outside service area' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Lead storage is not configured' }, { status: 503 });
  }

  const res = await fetch(`${url}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      name,
      phone,
      city,
      locality,
      service: service || null,
      pincode: body.pincode ?? null,
      source_page: (body.page ?? '').slice(0, 300),
      status: 'new',
    }),
  });

  if (!res.ok) {
    console.error('lead insert failed', res.status, await res.text());
    return NextResponse.json({ error: 'Could not save lead' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
