// scripts/seo/_fetch.ts — one fetch wrapper for every script that talks to a deployed
// site, so they all behave the same against a protected Vercel preview.
//
// Vercel's Deployment Protection intercepts preview requests and 302s them to
// vercel.com/sso-api, which makes every automated check meaningless (everything looks
// like a redirect). Vercel's "Protection Bypass for Automation" exists for exactly this:
// generate the secret in Project Settings -> Deployment Protection, then pass it here.
//
//   $env:VERCEL_AUTOMATION_BYPASS_SECRET = '<secret>'
//   $env:BASE_URL = 'https://<preview>.vercel.app'
//   npm run seo:check-redirects
//
// Production needs none of this — the wrapper is a no-op when the secret is unset.
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '';

export const hasBypass = Boolean(BYPASS);

export function siteFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!BYPASS) return fetch(url, init);
  const headers = new Headers(init.headers);
  headers.set('x-vercel-protection-bypass', BYPASS);
  // Ask Vercel to set the bypass cookie too, so redirect targets stay reachable.
  headers.set('x-vercel-set-bypass-cookie', 'true');
  return fetch(url, { ...init, headers });
}

/**
 * Fails fast when the target is behind Deployment Protection and no bypass secret is
 * set — otherwise every assertion in the calling script reports a phantom redirect.
 */
export async function assertReachable(base: string): Promise<void> {
  const res = await siteFetch(`${base}/robots.txt`, { redirect: 'manual' });
  const location = res.headers.get('location') ?? '';
  if (res.status >= 300 && res.status < 400 && /vercel\.com\/sso-api|\/\.well-known\/vercel-user-meta/.test(location)) {
    console.error(
      [
        '',
        `${base} is behind Vercel Deployment Protection: every request 302s to Vercel SSO,`,
        'so nothing this script measures would be real.',
        '',
        'Fix it one of two ways:',
        '  1. Project Settings -> Deployment Protection -> Protection Bypass for Automation,',
        '     copy the secret, then set VERCEL_AUTOMATION_BYPASS_SECRET before running.',
        '  2. Or turn Vercel Authentication off for preview deployments.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }
  if (res.status !== 200) {
    console.error(`${base}/robots.txt returned ${res.status} — is the deployment ready?`);
    process.exit(1);
  }
}
