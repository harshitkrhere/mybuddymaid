import { buildShards, indexXml } from '@/lib/seo-engine/sitemaps';

export const dynamic = 'force-static';

export function GET() {
  return new Response(indexXml(buildShards()), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
