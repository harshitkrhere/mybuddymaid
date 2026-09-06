import { serializeLd } from '@/lib/seo-engine/jsonld';

/** Server-rendered JSON-LD blocks; `<` is escaped inside the script body. */
export function JsonLd({ data }: { data: unknown[] }) {
  return (
    <>
      {data.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeLd(d) }} />
      ))}
    </>
  );
}
