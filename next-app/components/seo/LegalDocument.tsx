// components/seo/LegalDocument.tsx — renders a parsed legal document inside TrustPage.
//
// The version block, a contents list, then every section under its fixed anchor: summary
// asides, numbered clauses with the number set in the margin, lists and tables. No script;
// the contents list is plain anchors, so the page reads and links with nothing loaded.
// (docs/legal/drafts/legal-pages-design.md describes the fuller rail-and-search layout this
// is the fallback for.)
import Link from 'next/link';
import type { Block, Inline, LegalDoc } from '@/lib/legal/markdown';

function InlineRun({ inline }: { inline: Inline[] }) {
  return (
    <>
      {inline.map((i, k) => {
        if (i.kind === 'strong') return <strong key={k}>{i.text}</strong>;
        if (i.kind === 'link') {
          const internal = i.href.startsWith('/') || i.href.startsWith('#');
          return internal ? (
            <Link key={k} href={i.href}>
              {i.text}
            </Link>
          ) : (
            <a key={k} href={i.href} rel="noopener">
              {i.text}
            </a>
          );
        }
        return <span key={k}>{i.text}</span>;
      })}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'quote':
      return (
        <aside className="legal__aside">
          <InlineRun inline={block.inline} />
        </aside>
      );
    case 'h3':
      return <h3 id={block.id ?? undefined}>{block.text}</h3>;
    case 'list':
      return (
        <ul className="legal__list">
          {block.items.map((item, k) => (
            <li key={k}>
              <InlineRun inline={item} />
            </li>
          ))}
        </ul>
      );
    case 'table':
      return (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {block.header.map((cell, k) => (
                  <th key={k}>
                    <InlineRun inline={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, k) => (
                    <td key={k}>
                      <InlineRun inline={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return (
        <p className={block.clause ? 'legal__clause' : undefined}>
          {block.clause ? <span className="legal__no">{block.clause}</span> : null}
          <InlineRun inline={block.inline} />
        </p>
      );
  }
}

export function LegalDocument({ doc, previous }: { doc: LegalDoc; previous?: { label: string; href: string } }) {
  const numbered = doc.sections.filter((s) => s.number);
  return (
    <article className="legal">
      <dl className="legal__meta">
        {Object.entries(doc.meta).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>
              {v}
              {k === 'Supersedes' && previous ? (
                <>
                  {' '}
                  — <Link href={previous.href}>{previous.label}</Link>
                </>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      <nav className="legal__toc" aria-label="Contents">
        <h2>Contents</h2>
        <ol>
          {numbered.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>
                <span className="legal__no">{s.number}</span> {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {doc.sections.map((s) => (
        <section key={s.id} id={s.id} className="legal__section">
          <h2>
            {s.number ? <span className="legal__no">{s.number}</span> : null}
            {s.title}
          </h2>
          {s.blocks.map((b, k) => (
            <BlockView key={k} block={b} />
          ))}
        </section>
      ))}
    </article>
  );
}
