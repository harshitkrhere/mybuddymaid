// scripts/seo/uniqueness.ts — the automated quality gate (brief §6.3.4).
// Runs on the composed main content of every indexable page and decides index/noindex:
//   1. near-duplicate check — 5-word shingles, MinHash + LSH banding (NOT O(n^2)),
//      Jaccard estimated then confirmed exactly for candidate pairs; fail > 0.60
//   2. local-token ratio — share of main-content sentences containing at least one
//      page-specific token; fail < 0.50 (locality / service×locality / entity / pincode),
//      < 0.35 (zone / city)
//   3. word-count floors per page type, required sections present, no [VERIFY] markers
// Failing pages are emitted as `noindex, follow` into data/seo/quality/gate.json and
// listed in docs/seo/quality-report.md. The build fails on DATA errors, never on content
// gaps — that is validate.ts's job.
// Run: npx tsx scripts/seo/uniqueness.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { allCorePages, type PageModel } from '../../lib/seo-engine/compose';
import { allEntityPages } from '../../lib/seo-engine/compose-entity';

const ROOT = process.cwd();
const REPO = path.resolve(ROOT, '..');
const GATE = path.join(ROOT, 'data', 'seo', 'quality', 'gate.json');
const REPORT = path.join(REPO, 'docs', 'seo', 'quality-report.md');

const SHINGLE = 5;
const HASHES = 96; // MinHash signature length
const BANDS = 24; // 24 bands x 4 rows -> catches pairs around ~0.55+ similarity
const ROWS = HASHES / BANDS;
const DUP_MAX = 0.6;

// ---------------------------------------------------------------------------
// text helpers
// ---------------------------------------------------------------------------
const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[₹–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function shingles(text: string): Set<number> {
  const words = normalise(text).split(' ').filter(Boolean);
  const out = new Set<number>();
  for (let i = 0; i + SHINGLE <= words.length; i++) {
    const gram = words.slice(i, i + SHINGLE).join(' ');
    out.add(hash32(gram));
  }
  return out;
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// MinHash with xor-shift permutations of the base hash — no per-hash string work.
const SEEDS = Array.from({ length: HASHES }, (_, i) => (i * 2654435761 + 40503) >>> 0);
function signature(set: Set<number>): Uint32Array {
  const sig = new Uint32Array(HASHES).fill(0xffffffff);
  for (const v of set) {
    for (let i = 0; i < HASHES; i++) {
      let x = (v ^ SEEDS[i]) >>> 0;
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;
      x >>>= 0;
      if (x < sig[i]) sig[i] = x;
    }
  }
  return sig;
}

function jaccard(a: Set<number>, b: Set<number>): number {
  if (!a.size || !b.size) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const v of small) if (large.has(v)) inter++;
  return inter / (a.size + b.size - inter);
}

function sentences(text: string): string[] {
  // Protect initials ("R.K. Puram", "J.P. Nagar") so the splitter does not cut a place
  // name in half — that would hide its own tokens from the local-ratio measurement.
  const protectedText = text.replace(/\b([A-Z])\./g, '$1\u0001');
  return protectedText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/\u0001/g, '.').trim())
    .filter((s) => s.split(/\s+/).length >= 4);
}

function localRatio(text: string, tokens: string[]): number {
  const toks = tokens.map((t) => normalise(t)).filter((t) => t.length >= 3);
  if (!toks.length) return 0;
  const sents = sentences(text);
  if (!sents.length) return 0;
  let hit = 0;
  for (const s of sents) {
    const n = normalise(s);
    if (toks.some((t) => n.includes(t))) hit++;
  }
  return hit / sents.length;
}

const wordCount = (s: string) => normalise(s).split(' ').filter(Boolean).length;

// ---------------------------------------------------------------------------
// pass 1 — compose, per-page checks, build signatures
// ---------------------------------------------------------------------------
interface Row {
  path: string;
  type: PageModel['type'];
  words: number;
  ratio: number;
  reasons: string[];
  sig: Uint32Array;
  set: Set<number>;
}

// Phase 5 entity pages are gated with the core pages: a path with no verdict in
// gate.json is treated as ungated, so an entity page that skipped this pass would ship
// indexable without ever being checked for near-duplication (rule 8).
function* pagesToGate(): Generator<PageModel> {
  yield* allCorePages();
  yield* allEntityPages();
}

const rows: Row[] = [];
let composed = 0;
for (const page of pagesToGate()) {
  composed++;
  const text = page.mainText;
  const words = wordCount(text);
  const ratio = page.localRatioFloor > 0 ? localRatio(text, page.localTokens) : 1;
  const reasons: string[] = [];
  if (words < page.wordFloor) reasons.push(`word count ${words} < floor ${page.wordFloor}`);
  if (ratio < page.localRatioFloor) reasons.push(`local-token ratio ${ratio.toFixed(2)} < floor ${page.localRatioFloor}`);
  for (const m of page.missingRequired) reasons.push(`missing required: ${m}`);
  if (text.includes('[VERIFY]')) reasons.push('contains a [VERIFY] marker');
  const set = shingles(text);
  rows.push({ path: page.path, type: page.type, words, ratio, reasons, sig: signature(set), set });
  if (composed % 500 === 0) process.stdout.write(`  composed ${composed}\r`);
}
console.log(`  composed ${composed} pages`);

// ---------------------------------------------------------------------------
// pass 2 — LSH candidate pairs within each page type, then exact Jaccard
// ---------------------------------------------------------------------------
// Entity pages are compared against locality pages, not only against each other: the
// failure mode worth catching is an entity page that is a re-skin of its parent locality.
const bucketOf = (t: PageModel['type']) => (t === 'entity' ? 'locality' : t);
const byType = new Map<string, Row[]>();
for (const r of rows) byType.set(bucketOf(r.type), [...(byType.get(bucketOf(r.type)) ?? []), r]);

interface Pair {
  a: string;
  b: string;
  sim: number;
  type: string;
}
const pairs: Pair[] = [];
const dupPaths = new Map<string, { other: string; sim: number }>();

for (const [type, list] of byType) {
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < list.length; i++) {
    for (let b = 0; b < BANDS; b++) {
      const band = Array.from(list[i].sig.slice(b * ROWS, (b + 1) * ROWS)).join(',');
      const key = `${b}:${createHash('md5').update(band).digest('hex').slice(0, 12)}`;
      buckets.set(key, [...(buckets.get(key) ?? []), i]);
    }
  }
  const checked = new Set<string>();
  for (const idxs of buckets.values()) {
    if (idxs.length < 2 || idxs.length > 400) continue; // huge buckets are noise
    for (let x = 0; x < idxs.length; x++) {
      for (let y = x + 1; y < idxs.length; y++) {
        const key = `${idxs[x]}|${idxs[y]}`;
        if (checked.has(key)) continue;
        checked.add(key);
        const A = list[idxs[x]];
        const B = list[idxs[y]];
        const sim = jaccard(A.set, B.set);
        if (sim > DUP_MAX) {
          pairs.push({ a: A.path, b: B.path, sim, type });
          // noindex the second page of the pair, keep the first
          const loser = A.path < B.path ? B : A;
          const winner = A.path < B.path ? A : B;
          const prev = dupPaths.get(loser.path);
          if (!prev || sim > prev.sim) dupPaths.set(loser.path, { other: winner.path, sim });
        }
      }
    }
  }
}
pairs.sort((p, q) => q.sim - p.sim);

for (const r of rows) {
  const d = dupPaths.get(r.path);
  if (d) r.reasons.push(`near-duplicate of ${d.other} (Jaccard ${d.sim.toFixed(2)} > ${DUP_MAX})`);
}

// ---------------------------------------------------------------------------
// emit gate + report
// ---------------------------------------------------------------------------
const gate = {
  generatedAt: process.env.GATE_STAMP ?? 'unstamped',
  thresholds: { dupMax: DUP_MAX, shingle: SHINGLE },
  pages: Object.fromEntries(
    rows.map((r) => [r.path, { index: r.reasons.length === 0, reasons: r.reasons, words: r.words, localRatio: Number(r.ratio.toFixed(3)) }]),
  ),
};
fs.mkdirSync(path.dirname(GATE), { recursive: true });
fs.writeFileSync(GATE, JSON.stringify(gate, null, 2) + '\n');

const failing = rows.filter((r) => r.reasons.length > 0);
const byTypeCount = (t: string) => rows.filter((r) => r.type === t).length;
const failByType = (t: string) => failing.filter((r) => r.type === t).length;
const types = [...byType.keys()].sort();

const lines: string[] = [
  '# Quality report',
  '',
  `Generated by \`scripts/seo/uniqueness.ts\`. ${rows.length} pages composed, **${rows.length - failing.length} indexable**, **${failing.length} noindexed**.`,
  '',
  '## Gates applied',
  '',
  `- Near-duplicate: 5-word shingles, MinHash (${HASHES} hashes) + LSH (${BANDS} bands), fail when Jaccard > ${DUP_MAX} against another page of the same type.`,
  '- Local-token ratio: share of main-content sentences containing the page\'s own name, alt names, pincodes, a neighbour, a landmark or its zone. Floor 0.50 for locality, service-x-locality and pincode pages; 0.35 for zone and city pages.',
  '- Word-count floors per page type (Appendix E), required sections present, and no `[VERIFY]` markers on an indexable page.',
  '',
  '## By page type',
  '',
  '| Page type | Total | Indexable | Noindexed |',
  '|---|---|---|---|',
  ...types.map((t) => `| ${t} | ${byTypeCount(t)} | ${byTypeCount(t) - failByType(t)} | ${failByType(t)} |`),
  '',
  '## Worst near-duplicate pairs',
  '',
];
if (pairs.length === 0) {
  lines.push('None: no pair of same-type pages exceeded the 0.60 Jaccard threshold.', '');
} else {
  lines.push('| Jaccard | Page A | Page B |', '|---|---|---|');
  for (const p of pairs.slice(0, 20)) lines.push(`| ${p.sim.toFixed(3)} | ${p.a} | ${p.b} |`);
  lines.push('');
}
lines.push('## Noindexed pages and why', '');
if (!failing.length) {
  lines.push('None — every composed page passed all gates.', '');
} else {
  lines.push('| Page | Words | Local ratio | Reasons |', '|---|---|---|---|');
  for (const r of failing.slice(0, 300)) lines.push(`| ${r.path} | ${r.words} | ${r.ratio.toFixed(2)} | ${r.reasons.join('; ')} |`);
  if (failing.length > 300) lines.push(`| … and ${failing.length - 300} more | | | |`);
  lines.push('');
}
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, lines.join('\n'));

console.log(`uniqueness: ${rows.length} pages, ${rows.length - failing.length} indexable, ${failing.length} noindexed, ${pairs.length} duplicate pairs over ${DUP_MAX}`);
console.log(`  -> data/seo/quality/gate.json`);
console.log(`  -> docs/seo/quality-report.md`);
