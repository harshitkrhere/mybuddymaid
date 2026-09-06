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

const RETRIES = Number(process.env.FETCH_RETRIES ?? 3);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Transient transport failures — a reset connection says nothing about the site. */
function isTransient(e: unknown): boolean {
  const code = (e as { cause?: { code?: string } })?.cause?.code ?? (e as { code?: string })?.code ?? '';
  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'].includes(code);
}

/**
 * Fetch with the bypass header (when set) and a short retry on transport errors.
 * Thousands of TLS requests against a preview will drop a connection sooner or later;
 * without the retry a single reset aborts a run that says nothing about the site.
 */
export async function siteFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let options = init;
  if (BYPASS) {
    const headers = new Headers(init.headers);
    headers.set('x-vercel-protection-bypass', BYPASS);
    // Do NOT also send x-vercel-set-bypass-cookie: Vercel answers that with a 307 to set
    // the cookie, and with redirect: 'manual' every script then reads that 307 as the
    // site's own response (the first preview run on 2026-09-07 failed exactly so). The
    // header is sent on every request anyway, so no cookie is needed.
    options = { ...init, headers };
  }
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      return await fetch(url, options);
    } catch (e) {
      lastError = e;
      if (!isTransient(e) || attempt === RETRIES) break;
      await sleep(250 * 2 ** attempt);
    }
  }
  throw lastError;
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
