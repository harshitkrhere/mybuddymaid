// lib/seo-engine/og-sign.ts — signs the /og image parameters at build time (Node), so the
// endpoint renders only the titles the site itself asked for. Verification happens at the
// edge in og-verify.ts with Web Crypto; the two must agree on the payload and the length.
//
// With OG_SIGNING_SECRET unset (local dev, a preview without the variable) URLs carry no
// signature and the endpoint accepts everything, so nothing breaks; set it in production
// and unsigned requests get a 400 instead of a free image-rendering service (FIN-S05).
import { createHmac } from 'node:crypto';

export const OG_SIGNING_SECRET_ENV = 'OG_SIGNING_SECRET';
export const OG_TITLE_MAX = 80;
export const OG_SUBTITLE_MAX = 100;
export const OG_SIG_LENGTH = 32; // hex characters of the HMAC-SHA256, 128 bits

export function ogPayload(title: string, subtitle: string): string {
  return `${title}\n${subtitle}`;
}

export function signOg(title: string, subtitle: string, secret: string): string {
  return createHmac('sha256', secret).update(ogPayload(title, subtitle)).digest('hex').slice(0, OG_SIG_LENGTH);
}

/** The /og path for a page: parameters trimmed to the lengths the endpoint uses, signed when a secret is configured. */
export function ogImagePath(title: string, subtitle: string, secret: string | undefined = process.env[OG_SIGNING_SECRET_ENV]): string {
  const t = title.slice(0, OG_TITLE_MAX);
  const s = subtitle.slice(0, OG_SUBTITLE_MAX);
  const p = new URLSearchParams({ t, s });
  if (secret) p.set('sig', signOg(t, s, secret));
  return `/og?${p.toString()}`;
}
