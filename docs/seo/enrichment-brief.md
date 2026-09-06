# Enrichment brief for locality-content drafting agents

You are enriching the SEO data layer for MyBuddyMaid, a verified domestic-help (maid/cook/nanny/elder-care) marketplace serving Delhi NCR, Mumbai, Pune, Bangalore and Mangalore. Repo: `C:/Users/conta/dev/mybuddymaid/next-app`.

## HARD RULES (violations poison the whole system)

- NEVER invent facts. No made-up societies, landmarks, prices, availability, distances, or claims. Landmarks must be genuinely well-known real places (metro stations, major markets, malls, hospitals, parks, temples, offices). If you are not confident a specific fact is real, either omit it or append the literal marker `[VERIFY]` to the sentence containing it.
- No superlatives or marketing claims ("best", "#1", "top-rated", "trusted by X families"). No competitor mentions. No fabricated reviews or testimonials.
- Do not state or imply MyBuddyMaid has an office, branch, or physical presence in the locality.
- Write in clear Indian English. Prices are never mentioned in your text (pricing renders from data elsewhere).
- `helperSourceAreas`: fill ONLY if you genuinely know where domestic helpers commonly commute from for that specific area (e.g. an adjacent urban village or settlement well known for it); otherwise leave it an empty array. When filled, include only what you are confident of.
- `neighbours` MUST be chosen ONLY from the valid locality slugs of the same city (read the city data file); 6–10 entries, genuinely geographically adjacent or nearby (same zone usually, cross-zone allowed when truly adjacent). Order nearest-first.

First, Read the city data file named in your task (`data/seo/localities/<city>.ts`) to see every locality row (slug, name, altNames, zone, pincodes, priority, kind) — use it as ground truth for names/pincodes/zones.

## Per-locality JSON object

```
{
  "neighbours": [6-10 slugs from the valid list],
  "landmarks": [3-6 real well-known landmarks in/adjacent to the locality],
  "housingProfile": "gated-societies" | "independent-houses" | "mixed" | "builder-floors"  (the DOMINANT residential form),
  "demandProfile": 1-3 of "working-professionals" | "families" | "elderly" | "students",
  "helperSourceAreas": [] or confidently-known nearby areas helpers commute from,
  "localIntro": "120-200 words for the 'Maid Service in {Name}' page: what households here are like (reference the housing profile), the locality's character, its pincode(s) woven in naturally, 2-3 of your landmarks, and 2-3 neighbouring areas by NAME (not slug). Must reference at least 3 locality-specific facts. Plain paragraphs, no headings, no bullet lists, no brand claims.",
  "commuteNotes": "1-2 sentences on how helpers typically reach this area (metro line/station if one truly serves it, bus, walking from adjacent areas). Use [VERIFY] if unsure of specifics.",
  "housingNotes": "1-2 sentences on the housing stock and what that means for domestic help (gated towers with entry passes vs independent houses with flexible timings etc.).",
  "localFaqs": [exactly 3 of {"id":"faq-<city>-<slug>-<1|2|3>","q":"...","a":"...","scope":"locality","tags":["<city>","<slug>"]}],
  "sourceRefs": ["general-knowledge-2026"],
  "reviewed": false
}
```

Each FAQ must reference the locality's OWN facts (its name, pincode, a neighbour, a landmark, or its housing profile). Good patterns: "Which areas near {Name} do you also serve?", "Do helpers in {Name} need society gate passes?", "Which pincodes does {Name} service cover?". Answers 2–3 sentences, factual, no marketing.

## Output

Write ONE file at the exact path given in your task: a JSON object mapping each assigned slug to its enrichment object. Valid JSON, UTF-8, no trailing commas, no comments. Then reply with only: the count of slugs written, and a list of any slugs where you used `[VERIFY]`. Do not echo the JSON in your reply.
