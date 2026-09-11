// scripts/assistant/ask.ts — ask the support assistant from the terminal.
//
//   npx tsx scripts/assistant/ask.ts "do you serve 110016?"
//   npx tsx scripts/assistant/ask.ts                          # runs a built-in sample set
//   ASSISTANT_BASE_URL=… ASSISTANT_API_KEY=… ASSISTANT_MODELS=… npx tsx scripts/assistant/ask.ts "…"
//
// Without the ASSISTANT_* variables this shows exactly what a customer sees when no model is
// available (rung 3). With them it shows the phrased answer, which model produced it, and
// whether the number gate accepted it. Nothing here writes to any database.

import { answer } from '../../lib/assistant/answer';
import { providerFromEnv } from '../../lib/assistant/provider';
import { KNOWLEDGE_STATS } from '../../lib/assistant/knowledge';

const SAMPLE = [
  'hi',
  'do you serve 110016?',
  'is dlf phase 3 covered',
  'do you have maids in gurgaon',
  'sector 50',
  'how much does the gold plan cost',
  'what are your plans',
  'cook chahiye kitna lagega',
  'what is your refund policy',
  'i want a refund now',
  'my maid left, can i get a replacement',
  'are helpers police verified',
  'how do i book',
  'contact number',
  'i want to talk to a person',
  'maid did not come today',
  'payment deducted but no confirmation',
  'what is the weather',
  'do you provide drivers',
  'full time maid salary in mumbai',
  'nanny for newborn in pune',
  'kya aap noida me service dete ho',
];

async function main() {
  const provider = providerFromEnv();
  const questions = process.argv.slice(2).length ? [process.argv.slice(2).join(' ')] : SAMPLE;
  console.log(`corpus: ${KNOWLEDGE_STATS.entries} entries (${KNOWLEDGE_STATS.faqs} FAQs), model: ${provider ? provider.models.join(' → ') : 'none (rung 3 only)'}\n`);

  for (const q of questions) {
    const a = await answer({ message: q }, { provider });
    const ents = Object.entries(a.entities)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${typeof v === 'object' && v && 'slug' in v ? (v as { slug: string }).slug : typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' ');
    console.log(`> ${q}`);
    console.log(`  intent=${a.intent}  conf=${a.confidence.toFixed(2)}  lang=${a.language}  rung=${a.rung}${a.modelId ? `  model=${a.modelId}` : ''}${a.escalate ? `  ESCALATE=${a.escalate}` : ''}${a.gateRejected ? '  GATE-REJECTED' : ''}${a.redacted.length ? `  redacted=${a.redacted.join(',')}` : ''}`);
    if (ents) console.log(`  entities: ${ents}`);
    console.log(`  ${a.text.replace(/\n/g, '\n  ')}`);
    if (a.sources.length) console.log(`  sources: ${a.sources.map((s) => s.url).join(', ')}`);
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
