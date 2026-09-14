// /og?t=Title&s=Subtitle&sig=… — brand-styled Open Graph image, rendered on demand and
// cached at the edge (one route instead of 2,500 build-time renders).
//
// When OG_SIGNING_SECRET is set, only requests whose parameters were signed by the site's
// own metadata (lib/seo-engine/og-sign.ts) are rendered; anything else is a 400, so the
// endpoint cannot be used to render arbitrary text under the brand (FIN-S05). Unset, it
// accepts everything, which keeps local development and unconfigured previews working.
import { ImageResponse } from 'next/og';
import { verifyOg } from '@/lib/seo-engine/og-verify';

export const runtime = 'edge';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawTitle = searchParams.get('t') ?? '';
  const rawSubtitle = searchParams.get('s') ?? '';
  const secret = process.env.OG_SIGNING_SECRET;
  if (secret && !(await verifyOg(rawTitle, rawSubtitle, searchParams.get('sig') ?? '', secret))) {
    return new Response('unsigned og request', { status: 400, headers: { 'cache-control': 'no-store' } });
  }
  const title = (rawTitle || 'MyBuddyMaid').slice(0, 80);
  const subtitle = (rawSubtitle || 'Verified maids, cooks & nannies').slice(0, 100);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: 'linear-gradient(135deg, #0d1117 0%, #111827 60%, #064e3b 100%)',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 32, fontWeight: 700 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#34d399' }} />
          MyBuddyMaid
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>{title}</div>
          <div style={{ fontSize: 30, color: '#a7f3d0' }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 24, color: '#d1fae5' }}>
          <span>Verified helpers</span>
          <span>·</span>
          <span>Replacement policy</span>
          <span>·</span>
          <span>Book on WhatsApp</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  );
}
