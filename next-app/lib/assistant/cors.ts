// lib/assistant/cors.ts — CORS for the assistant's routes.
//
// The site and the booking app are same-origin, so in practice no header is ever needed. The
// native app (Initiative 1) will not be; its origins go in ASSISTANT_ALLOWED_ORIGINS when it
// exists. Localhost is allowed outside production so the dev server can be driven from any port.

const ALLOWED_ORIGINS = new Set(
  (process.env.ASSISTANT_ALLOWED_ORIGINS ?? 'https://mybuddymaid.in,https://www.mybuddymaid.in')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

export function corsHeaders(req: Request, methods: string): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) || (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin));
  return allowed
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': methods,
        Vary: 'Origin',
      }
    : {};
}
