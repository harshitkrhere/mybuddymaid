'use client';
// components/seo/LeadForm.tsx — lead form pre-selected from page context. Options come
// from the data layer (passed by the server page) so nothing outside the footprint can
// be submitted. Rendered only when NEXT_PUBLIC_LEADS_ENABLED=true (ASSUMPTIONS.md #12).
import { useState } from 'react';
import type { CtaContext } from './CtaButtons';

export interface LeadFormOptions {
  cities: { slug: string; name: string }[];
  localities: { slug: string; name: string; city: string }[];
  services: { slug: string; name: string }[];
}

/** How the visitor arrived, as components/shared/Analytics.tsx recorded it; null when unknown or storage is unavailable. */
export function readAttribution(): { last: unknown; first: unknown } | null {
  try {
    const last = JSON.parse(sessionStorage.getItem('mbm_attr') || 'null');
    const first = JSON.parse(localStorage.getItem('mbm_first_attr') || 'null');
    return last || first ? { last, first } : null;
  } catch {
    return null;
  }
}

export function LeadForm({ ctx, options }: { ctx: CtaContext; options: LeadFormOptions }) {
  const [city, setCity] = useState(ctx.city || options.cities[0]?.slug || '');
  const [locality, setLocality] = useState(ctx.locality || '');
  const [service, setService] = useState(ctx.service || options.services[0]?.slug || '');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const localities = options.localities.filter((l) => l.city === city);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone.replace(/\D/g, '').slice(-10))) return;
    setState('sending');
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, phone, city, locality, service, pincode: ctx.pincode, page: window.location.pathname, attribution: readAttribution() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      window.gtag?.('event', 'lead_submit', { city, locality, service, pincode: ctx.pincode ?? '(none)', source: 'site', page_path: window.location.pathname });
      setState('done');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') return <p className="lead-form__done">Thanks — we will call you back shortly.</p>;

  return (
    <form className="lead-form" onSubmit={submit}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </label>
      <label>
        Mobile
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required pattern="[0-9+ ]{10,14}" />
      </label>
      <label>
        City
        <select value={city} onChange={(e) => { setCity(e.target.value); setLocality(''); }}>
          {options.cities.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </label>
      <label>
        Locality
        <select value={locality} onChange={(e) => setLocality(e.target.value)} required>
          <option value="">Select area</option>
          {localities.map((l) => (
            <option key={l.slug} value={l.slug}>{l.name}</option>
          ))}
        </select>
      </label>
      <label>
        Service
        <select value={service} onChange={(e) => setService(e.target.value)}>
          {options.services.map((s) => (
            <option key={s.slug} value={s.slug}>{s.name}</option>
          ))}
        </select>
      </label>
      <button className="btn btn-primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Request a call back'}
      </button>
      {state === 'error' && <p className="lead-form__error">Could not send — please use WhatsApp or call instead.</p>}
    </form>
  );
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
