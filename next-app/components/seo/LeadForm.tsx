'use client';
// components/seo/LeadForm.tsx — the call-back form on every location page, below the pricing
// table. Options come from the data layer (passed by the server page) so nothing outside the
// footprint can be submitted; the API checks everything again (lib/leads/validate.ts).
// Rendered only when NEXT_PUBLIC_LEADS_ENABLED=true (ASSUMPTIONS.md #12).
//
// FIN-B06: an invalid number used to `return` silently, so the visitor saw a button that did
// nothing. Every rejection now has a message, announced (role="alert") and tied to the field
// it concerns (aria-invalid / aria-describedby), and the API's own wording is shown when it is
// the one refusing. The "website" field is a honeypot: off-screen for people, filled by
// scripts, and the API drops anything that carries it.
import { useId, useState } from 'react';
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

/** The same normalisation as lib/leads/validate.ts, so the form and the API agree before a request is made. */
export function normalisePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9][0-9]{9}$/.test(d) ? d : null;
}

type Field = 'name' | 'phone' | 'city' | 'locality' | 'service' | 'form';
const FIELDS: Field[] = ['name', 'phone', 'city', 'locality', 'service'];
const COULD_NOT_SEND = 'Could not send — please use WhatsApp or call instead.';

export function LeadForm({ ctx, options, hoursLabel }: { ctx: CtaContext; options: LeadFormOptions; hoursLabel: string }) {
  const errorId = useId();
  const [city, setCity] = useState(ctx.city || options.cities[0]?.slug || '');
  const [locality, setLocality] = useState(ctx.locality || '');
  const [service, setService] = useState(ctx.service || options.services[0]?.slug || '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [society, setSociety] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<{ field: Field; message: string } | null>(null);

  const localities = options.localities.filter((l) => l.city === city);
  const describe = (field: Field) => (error?.field === field ? { 'aria-invalid': true, 'aria-describedby': errorId } : {});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = normalisePhone(phone);
    const problem: { field: Field; message: string } | null =
      name.trim().length < 2
        ? { field: 'name', message: 'Please enter your name.' }
        : !digits
          ? { field: 'phone', message: 'Enter a valid 10-digit Indian mobile number.' }
          : !locality
            ? { field: 'locality', message: 'Please select your area.' }
            : null;
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setState('sending');
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: digits,
          city,
          locality,
          service,
          pincode: ctx.pincode,
          entity: ctx.entity,
          society: society.trim() || undefined,
          page: window.location.pathname,
          attribution: readAttribution(),
          website,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; field?: string } | null;
        const field = FIELDS.find((f) => f === body?.field) ?? 'form';
        const message = (res.status === 400 || res.status === 429) && body?.error ? body.error : COULD_NOT_SEND;
        setError({ field, message });
        setState('idle');
        return;
      }
      window.gtag?.('event', 'lead_submit', { city, locality, service, pincode: ctx.pincode ?? '(none)', source: 'site', page_path: window.location.pathname });
      setState('done');
    } catch {
      setError({ field: 'form', message: COULD_NOT_SEND });
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <p className="lead-form__done" role="status">
        Thanks — we will call you back during working hours ({hoursLabel}).
      </p>
    );
  }

  return (
    <form className="lead-form" onSubmit={submit} noValidate>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" {...describe('name')} />
      </label>
      <label>
        Mobile
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required autoComplete="tel" {...describe('phone')} />
      </label>
      <label>
        City
        <select
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setLocality('');
          }}
          {...describe('city')}
        >
          {options.cities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Area
        <select value={locality} onChange={(e) => setLocality(e.target.value)} required {...describe('locality')}>
          <option value="">Select area</option>
          {localities.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Service
        <select value={service} onChange={(e) => setService(e.target.value)} {...describe('service')}>
          {options.services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Society / building (optional)
        <input value={society} onChange={(e) => setSociety(e.target.value)} maxLength={120} autoComplete="off" />
      </label>
      <label className="lead-form__hp" aria-hidden="true">
        Website
        <input name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" />
      </label>
      <button className="btn btn-primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Request a call back'}
      </button>
      {error && (
        <p id={errorId} className="lead-form__error" role="alert">
          {error.message}
        </p>
      )}
    </form>
  );
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
