// lib/legal/markdown.ts — the legal documents, from Markdown to a structure the page renders.
//
// The Privacy Policy and Terms of Service live as Markdown in content/legal/ so the text
// that counsel reviewed is the text that is published, byte for byte: no hand-conversion into
// JSX, no second copy to drift. This parser understands the small subset those documents use
// and nothing more, on purpose — anything outside it is a mistake in the document, and
// markdown.test.ts fails on it rather than rendering something odd:
//
//   # Title                              once, first line
//   Key: value                           meta lines before the first section
//   ## 3. Heading {#anchor}              sections; the anchor is fixed in the document
//   ### Heading                          subsections
//   > **Summary:** …                     one-paragraph asides
//   3.1 **Clause.** text                 clause paragraphs, numbered in the document
//   - (a) text                           lists
//   | a | b |  with a |---| row          tables
//   **bold**, [text](url)                the only inline marks
//
// No dependency: the site's build has no Markdown library, and adding one for two pages is
// more surface than eighty lines.

export type Inline = { kind: 'text'; text: string } | { kind: 'strong'; text: string } | { kind: 'link'; text: string; href: string };

export type Block =
  | { type: 'p'; clause: string | null; inline: Inline[] }
  | { type: 'h3'; id: string | null; text: string }
  | { type: 'list'; items: Inline[][] }
  | { type: 'table'; header: Inline[][]; rows: Inline[][][] }
  | { type: 'quote'; inline: Inline[] };

export interface Section {
  id: string;
  /** "3", "Annexure A", or null for an unnumbered section. */
  number: string | null;
  title: string;
  blocks: Block[];
}

export interface LegalDoc {
  title: string;
  meta: Record<string, string>;
  sections: Section[];
}

// ─── Inline ─────────────────────────────────────────────────────────────────────────────────

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: 'strong', text: m[1] });
    else out.push({ kind: 'link', text: m[2], href: m[3] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

/** The plain text of an inline run, for search indexes and tests. */
export function plain(inline: Inline[]): string {
  return inline.map((i) => i.text).join('');
}

// ─── Blocks ─────────────────────────────────────────────────────────────────────────────────

const HEADING = /^(##|###)\s+(.*?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/;
const NUMBERED = /^(\d+|Annexure [A-Z])[.:]\s+(.*)$/;
const CLAUSE = /^(\d+\.\d+(?:\.\d+)?|[A-Z]\.\d+)\s+(.*)$/;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function tableRow(line: string): Inline[][] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => parseInline(c.trim()));
}

export function parseLegal(markdown: string): LegalDoc {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  if (!lines[0]?.startsWith('# ')) throw new Error('a legal document starts with "# Title"');
  const doc: LegalDoc = { title: lines[0].slice(2).trim(), meta: {}, sections: [] };

  let section: Section | null = null;
  let i = 1;

  const push = (b: Block) => {
    if (!section) throw new Error(`content before the first section at line ${i + 1}`);
    section.blocks.push(b);
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const h = line.match(HEADING);
    if (h) {
      const [, marks, raw, anchor] = h;
      if (marks === '##') {
        const n = raw.match(NUMBERED);
        const title = n ? n[2].trim() : raw.trim();
        section = { id: anchor ?? slug(title), number: n ? n[1] : null, title, blocks: [] };
        doc.sections.push(section);
      } else {
        push({ type: 'h3', id: anchor ?? null, text: raw.trim() });
      }
      i += 1;
      continue;
    }

    if (!section) {
      const m = line.match(/^([A-Z][A-Za-z ]+):\s+(.+)$/);
      if (!m) throw new Error(`unexpected line before the first section: "${line.slice(0, 60)}"`);
      doc.meta[m[1].trim()] = m[2].trim();
      i += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        parts.push(lines[i].slice(2).trim());
        i += 1;
      }
      push({ type: 'quote', inline: parseInline(parts.join(' ')) });
      continue;
    }

    if (line.startsWith('- ')) {
      const items: Inline[][] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(parseInline(lines[i].slice(2).trim()));
        i += 1;
      }
      push({ type: 'list', items });
      continue;
    }

    if (line.startsWith('|')) {
      const header = tableRow(line);
      if (!/^\|\s*-+/.test(lines[i + 1] ?? '')) throw new Error(`table without a separator row at line ${i + 1}`);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(tableRow(lines[i]));
        i += 1;
      }
      push({ type: 'table', header, rows });
      continue;
    }

    if (line.startsWith('#')) throw new Error(`unsupported heading at line ${i + 1}: "${line.slice(0, 40)}"`);

    // A paragraph: consecutive non-blank lines that are not any of the above.
    const parts: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(> |- |\||#)/.test(lines[i])) {
      parts.push(lines[i].trim());
      i += 1;
    }
    const text = parts.join(' ');
    const c = text.match(CLAUSE);
    push({ type: 'p', clause: c ? c[1] : null, inline: parseInline(c ? c[2] : text) });
  }

  return doc;
}

/** Every piece of text in the document, for tests that check what it says. */
export function textOf(doc: LegalDoc): string {
  const parts: string[] = [doc.title, ...Object.values(doc.meta)];
  for (const s of doc.sections) {
    parts.push(s.title);
    for (const b of s.blocks) {
      if (b.type === 'p' || b.type === 'quote') parts.push(plain(b.inline));
      else if (b.type === 'h3') parts.push(b.text);
      else if (b.type === 'list') parts.push(...b.items.map(plain));
      else parts.push(...b.header.map(plain), ...b.rows.flatMap((r) => r.map(plain)));
    }
  }
  return parts.join('\n');
}
