import { buildShards, shardXml } from '@/lib/seo-engine/sitemaps';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return buildShards().map((s) => ({ shard: `${s.name}.xml` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ shard: string }> }) {
  const { shard } = await params;
  const name = shard.replace(/\.xml$/, '');
  const found = buildShards().find((s) => s.name === name);
  if (!found) return new Response('Not found', { status: 404 });
  return new Response(shardXml(found), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
