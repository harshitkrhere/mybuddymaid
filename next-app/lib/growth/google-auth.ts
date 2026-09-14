// lib/growth/google-auth.ts — a Google access token from a service-account key, with no
// googleapis dependency: the JWT bearer flow signed with node:crypto, as
// scripts/seo/gsc-report.ts did before this was extracted. One key serves Search Console
// (webmasters.readonly), the GA4 Data API (analytics.readonly) and, for the one-time custom
// dimension registration, the GA4 Admin API (analytics.edit); the scope is minted per call.
import { createSign } from 'node:crypto';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

export const SCOPES = {
  gsc: 'https://www.googleapis.com/auth/webmasters.readonly',
  ga4Read: 'https://www.googleapis.com/auth/analytics.readonly',
  ga4Edit: 'https://www.googleapis.com/auth/analytics.edit',
} as const;

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Accepts the key file's JSON text; rejects anything without the two fields the flow needs. */
export function parseServiceAccount(text: string): ServiceAccountKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('service account key is not valid JSON');
  }
  const o = parsed as Partial<ServiceAccountKey> | null;
  if (!o || typeof o.client_email !== 'string' || typeof o.private_key !== 'string') {
    throw new Error('service account JSON needs client_email and private_key');
  }
  return { client_email: o.client_email, private_key: o.private_key };
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function buildClaims(key: ServiceAccountKey, scopes: readonly string[], nowSec: number) {
  return {
    iss: key.client_email,
    scope: scopes.join(' '),
    aud: TOKEN_URL,
    exp: nowSec + 3600,
    iat: nowSec,
  };
}

export function signAssertion(key: ServiceAccountKey, scopes: readonly string[], nowSec = Math.floor(Date.now() / 1000)): string {
  const header = b64({ alg: 'RS256', typ: 'JWT' });
  const claims = b64(buildClaims(key, scopes, nowSec));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(key.private_key, 'base64url');
  return `${header}.${claims}.${signature}`;
}

export async function accessToken(key: ServiceAccountKey, scopes: readonly string[], fetchImpl: FetchLike = globalThis.fetch): Promise<string> {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signAssertion(key, scopes),
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('token exchange returned no access_token');
  return body.access_token;
}

export function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}
