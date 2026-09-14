// lib/seo-engine/og-verify.ts — the edge-runtime half of og-sign.ts: Web Crypto only (the
// edge runtime has no node:crypto), the same payload and the same 32-hex-character prefix.
export const OG_SIG_LENGTH = 32;

function ogPayload(title: string, subtitle: string): string {
  return `${title}\n${subtitle}`;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of two short hex strings. */
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyOg(title: string, subtitle: string, sig: string, secret: string): Promise<boolean> {
  if (!/^[0-9a-f]{32}$/.test(sig)) return false;
  const expected = (await hmacHex(secret, ogPayload(title, subtitle))).slice(0, OG_SIG_LENGTH);
  return equal(expected, sig);
}
