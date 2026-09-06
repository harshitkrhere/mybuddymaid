// scripts/seo/draft-copy.ts — drafts the curated prose layer for localities that lack it.
//
// RUN MANUALLY, NEVER AT BUILD OR REQUEST TIME. The output is written to
// data/seo/localities/enrichment/fragments/ and committed; the site itself never calls
// an LLM. Drafts are saved with reviewed:false and anything the model is not sure of must
// carry a literal [VERIFY] marker, which the composer strips at render time so an
// unconfirmed claim is withheld rather than published.
//
//   ANTHROPIC_API_KEY=... npx tsx scripts/seo/draft-copy.ts --city gurgaon
//   ANTHROPIC_API_KEY=... npx tsx scripts/seo/draft-copy.ts --city noida --force
//   ANTHROPIC_API_KEY=... npx tsx scripts/seo/draft-copy.ts --city delhi --limit 5
//
// Then: npm run seo:merge && npm run seo:neighbours && npm run seo:validate && npm run seo:gate
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ALL_LOCALITIES, CITY_BY_SLUG, ZONES } from '../../data/seo';
import type { Locality } from '../../data/seo/types';

const MODEL = 'claude-opus-5';
const ROOT = process.cwd();
const FRAG = path.join(ROOT, 'data', 'seo', 'localities', 'enrichment', 'fragments');

const args = process.argv.slice(2);
const argValue = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const city = argValue('--city');
const force = args.includes('--force');
const limit = Number(argValue('--limit') ?? 0);

if (!city) {
  console.error('Usage: --city <city-slug> [--force] [--limit N]');
  process.exit(1);
}

const ENRICHMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['localIntro', 'commuteNotes', 'housingNotes', 'landmarks', 'helperSourceAreas', 'localFaqs'],
  properties: {
    localIntro: { type: 'string', description: '120-200 words about this locality for its maid-service page' },
    commuteNotes: { type: 'string', description: '1-2 sentences on how helpers reach this area' },
    housingNotes: { type: 'string', description: '1-2 sentences on the housing stock and what it means for domestic help' },
    landmarks: { type: 'array', items: { type: 'string' }, description: '3-6 genuinely well-known real landmarks' },
    helperSourceAreas: { type: 'array', items: { type: 'string' }, description: 'Areas helpers commonly commute from; empty if not confidently known' },
    localFaqs: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['q', 'a'],
        properties: { q: { type: 'string' }, a: { type: 'string' } },
      },
    },
  },
} as const;

const SYSTEM = `You draft factual location copy for MyBuddyMaid, a verified domestic-help marketplace in India (maids, cooks, nannies, elder care).

HARD RULES — a violation makes the draft unusable:
- NEVER invent a fact. Landmarks must be genuinely well-known real places. If you are not confident a specific claim is true, either omit it or append the literal marker [VERIFY] to the sentence containing it.
- Use ONLY the locality data supplied in the user message. Do not introduce societies, distances, timings, prices or availability that are not derivable from it or from well-established general knowledge of that area.
- No superlatives or marketing claims ("best", "#1", "top-rated", "trusted by N families"). No competitor names. No invented reviews or testimonials.
- Never state or imply that MyBuddyMaid has an office, branch or physical presence in the locality.
- Never mention prices; pricing is rendered from structured data elsewhere.
- Write plain, clear Indian English. No headings, no bullet lists, no brand slogans.
- helperSourceAreas: fill only with areas you are genuinely confident domestic helpers commute from for this specific locality; otherwise return an empty array.

Each of the three FAQs must reference this locality's OWN facts (its name, a pincode, a neighbour, a landmark, or its housing profile) and answer in 2-3 factual sentences.`;

function userPrompt(l: Locality): string {
  const c = CITY_BY_SLUG.get(l.city)!;
  const z = ZONES.find((x) => x.city === l.city && x.slug === l.zone)!;
  const neighbours = l.neighbours
    .map((n) => ALL_LOCALITIES.find((x) => x.city === l.city && x.slug === n)?.name)
    .filter(Boolean);
  return `Draft the copy for this locality.

Locality: ${l.name}${l.altNames.length ? ` (also known as ${l.altNames.join(', ')})` : ''}
City: ${c.name}${c.altNames.length ? ` (also ${c.altNames.join(', ')})` : ''}, ${c.state}
Zone / belt: ${z.name}
Pincode(s): ${l.pincodes.join(', ')}
Kind: ${l.kind}
Dominant housing: ${l.housingProfile.replace(/-/g, ' ')}
Household types: ${l.demandProfile.join(', ')}
Neighbouring areas we also serve: ${neighbours.join(', ') || '(none recorded yet)'}
${l.landmarks.length ? `Landmarks already recorded: ${l.landmarks.join(', ')}` : ''}

Write localIntro (120-200 words) naming at least three locality-specific facts, weaving in the pincode(s) naturally, referencing 2-3 landmarks and 2-3 neighbouring areas by name. Then commuteNotes, housingNotes, 3-6 landmarks, helperSourceAreas, and exactly 3 locality FAQs.`;
}

async function main() {
  const client = new Anthropic();
  const targets = ALL_LOCALITIES.filter((l) => l.city === city).filter(
    (l) => force || l.localIntro.split(/\s+/).filter(Boolean).length < 120 || l.localFaqs.length < 3,
  );
  const todo = limit > 0 ? targets.slice(0, limit) : targets;
  if (!todo.length) {
    console.log(`Nothing to draft for ${city} (pass --force to redraft).`);
    return;
  }
  console.log(`Drafting ${todo.length} localities in ${city} with ${MODEL}`);

  const out: Record<string, unknown> = {};
  let flagged = 0;
  for (const [i, l] of todo.entries()) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: ENRICHMENT_SCHEMA },
      },
      messages: [{ role: 'user', content: userPrompt(l) }],
    } as Parameters<typeof client.messages.stream>[0]);

    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') {
      console.warn(`  ${l.slug}: model declined (${message.stop_details?.category ?? 'unknown'}) — skipped`);
      continue;
    }
    const text = message.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') {
      console.warn(`  ${l.slug}: no text block returned — skipped`);
      continue;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text.text);
    } catch {
      console.warn(`  ${l.slug}: response was not valid JSON — skipped`);
      continue;
    }
    const hasVerify = JSON.stringify(parsed).includes('[VERIFY]');
    if (hasVerify) flagged++;
    out[l.slug] = {
      ...parsed,
      localFaqs: (parsed.localFaqs as { q: string; a: string }[]).map((f, n) => ({
        id: `faq-${l.city}-${l.slug}-${n + 1}`,
        q: f.q,
        a: f.a,
        scope: 'locality',
        tags: [l.city, l.slug],
      })),
      // neighbours and profiles come from the data layer, not from the model
      housingProfile: l.housingProfile,
      demandProfile: l.demandProfile,
      neighbours: l.neighbours,
      sourceRefs: [`drafted by ${MODEL}`],
      reviewed: false,
    };
    console.log(`  [${i + 1}/${todo.length}] ${l.slug}${hasVerify ? '  (contains [VERIFY])' : ''}`);
  }

  fs.mkdirSync(FRAG, { recursive: true });
  const file = path.join(FRAG, `${city}-redraft.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  console.log(`\ndraft-copy: wrote ${Object.keys(out).length} localities -> ${file}`);
  console.log(`  ${flagged} contain a [VERIFY] marker and need review`);
  console.log(`  add "${city}-redraft": "${city}" to BATCH_CITY in scripts/seo/merge-enrichment.ts, then run npm run seo:merge`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
