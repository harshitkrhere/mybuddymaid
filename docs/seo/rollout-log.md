# Rollout log

One row per publishing batch. The policy is in [README.md §6](README.md): batches of
≤ 2,000 URLs per city per week, each its own sitemap shard and IndexNow submission, and
**the next batch is released only if ≥ 60 % of the previous one is indexed after 3 weeks**.

## Core estate (Phases 2–4)

| Batch | Date | URLs | Sitemap shards | Status |
|---|---|---|---|---|
| core-launch | *pending cutover* | 2,489 indexable of 2,513 composed | `global-core-*`, `<city>-hubs-*`, `<city>-services-*`, `pincodes-*` | Built and verified locally; not yet deployed |

The core estate is published in one go because it replaces an existing 3,846-page indexed
site one-for-one through the redirect map. It is not new long-tail surface: every URL
either replaces a legacy URL that already ranked, or is a hub that consolidates several.

**Pre-cutover verification (completed):**

| Check | Result |
|---|---|
| `next build` | green |
| `tsc --noEmit` | clean |
| `seo:validate` | green — 0 errors, 0 warnings |
| `seo:gate` | 2,489 indexable, 24 noindexed, 0 duplicate pairs above 0.60 |
| `seo:jsonld` | green — 2,513 pages, 0 errors |
| `seo:check-redirects` | green — 1,970 single-hop 301s, 5,696 410s, 0 chains, 0 loops |
| `seo:crawl` | green — 2,557 pages, 0 broken links, 0 orphans, click depth ≤ 3 |

**After deploy, record here:** deploy date, GSC submission date, and indexed counts at
weeks 1, 3 and 8. The brief's target is ≥ 80 % of core pages indexed within 8 weeks.

## Phase 5 entity batches

No batch released. `data/seo/quality/rollout.json` has no batches and no entity has
reached `ready`, so **no entity URL exists yet**. `data/seo/entities.json` holds 22
candidates, all `draft`.

### Pilot run — 2026-09-06, DLF Phase 1 (Gurgaon) and Sector 76 (Noida)

The pilot was run to answer one question: can the OSM importer produce publishable
entity pages on its own? It cannot, and it surfaced four defects that would have shipped
false or duplicate content. All four are fixed; the numbers below are the measurements.

**1. OpenStreetMap has no facts about Indian societies.** A 1,200 m Overpass sweep of
Sector 76 returned 400 elements, of which **7 were named** and only **3 carried more than
four tags — all three metro stations** (`network`, `operator`, `platforms`, `wikidata`).
Not one residential way carried `building:levels`, `operator`, `start_date` or `units`.
So `--osm` can build the *candidate list* (name, position, parent locality) and nothing
more. Every fact that makes an entity page worth serving has to come from the operator.
That is what `--export-worksheet` is for.

**2. The radius search attributed 23 % of candidates to the wrong locality.** A sweep
centred on one locality also sweeps its neighbours. Before the fix, `DLF Phase 3-U Block`
(1,761 m from DLF Phase 1, 233 m from DLF Phase 3) was imported as a society *in DLF
Phase 1* — the page would have stated a false address, which rule 3 forbids. 5 of 22
candidates were misattributed. The importer now assigns each candidate to the **nearest**
Appendix-B locality and rejects anything more than 2,000 m from all of them.

**3. Three integrity rejections were missing.** OSM names include administrative areas
(`Sector 48`, `Noida Sector 101`), plot codes (`H3/2`) and names identical to the parent
locality. None of those are entities: a sector belongs in Appendix B or nowhere, a plot
code has no search demand, and an entity named after its parent restates the locality
page's intent (rule 2). The importer now rejects all three, with a per-reason tally in
its output.

**4. ALL-CAPS OSM names rendered straight into H1s and title tags** — `MAHAGUN MODERNE`,
`IITL NIMBUS THE HYDE PARK`. Names are now title-cased with an acronym allowlist, and the
raw OSM name is kept as an alt name.

### Two defects in the gate itself

**5. Entity pages were never gated.** `scripts/seo/uniqueness.ts` composed
`allCorePages()` only, so no entity path ever got a verdict in `quality/gate.json` — and
`gateFor()` treats an unknown path as a hand-written page and returns `index: true`. Every
`ready` entity would therefore have shipped **indexable without any duplicate check**,
against rule 8. Fixed twice over: the gate and the JSON-LD validator now compose entity
pages too, and `gateFor()` **fails closed** for the 4-segment entity route, so an entity
promoted after the last `seo:gate` run is `noindex` until the gate has actually seen it.

**6. The readiness gate counted borrowed facts.** `meetsReadinessGate` counted every key
in `facts`, including the four inherited from the parent locality (`Parent locality`,
`Pincode`, `Housing type`, `Nearest landmark`) which are identical for every entity under
the same parent. One operator fact plus four borrowed ones passed a "5 facts" check. The
gate now counts **entity-specific facts only** (`INHERITED_FACT_KEYS` in
`data/seo/entities.ts`), and `compose-entity.ts` uses the same definition for
`missingRequired`.

### Open question: the entity × service model produces near-duplicates

With one entity promoted to `ready` as a round-trip test, the gate composed its 6 service
pages and **noindexed 5 of them**:

| Pair | Jaccard |
|---|---|
| `.../mahagun-moderne/cook` vs `.../babysitter-nanny` | 0.763 |
| `.../mahagun-moderne/cook` vs `.../domestic-help` | 0.750 |
| `.../mahagun-moderne/full-time-maid` vs `.../part-time-maid` | 0.746 |
| *(10 more pairs, all 0.72–0.74)* | |

The six pages differ only in the service name and the pricing band; the facts block, the
access paragraph, the verification section and two of five FAQs are identical. At ~480
words per page there is not enough service-specific material to separate them.

**This means the effective ceiling is one indexable page per entity, not six.** The
~100,000-page projection behind the 200-leads/day model assumed six. The realistic
number is closer to 17,000 unless the entity × service pages gain genuinely
service-specific content. The gate is already enforcing this — the other five URLs would
exist only as noindexed pages.

The decision (entity-only pages at `/<city>/<area>/<entity>` versus keeping
entity × service and giving each service real content) is recorded as an open item in
[ASSUMPTIONS.md](ASSUMPTIONS.md) and is not settled here.

### How to release the first real batch

1. `npm run seo:entities -- --osm --city <city> --locality <locality>` for each pilot
   locality — candidates only, everything lands as `draft`.
2. `npm run seo:entities -- --export-worksheet ../docs/seo/entity-worksheet.csv` and give
   that file to the operator. The `fact:` columns are the ones a household actually asks
   about: towers or blocks, approximate homes, builder, possession year, typical flat
   sizes, helper entry process, who issues the helper ID card, service lift.
3. `npm run seo:entities -- --csv ../docs/seo/entity-worksheet.csv --promote` — only rows
   with ≥ 5 filled `fact:` columns become `ready`. Inherited facts do not count.
4. Add the batch to `data/seo/quality/rollout.json`:
   `{"batches": {"gurgaon-pilot-1": ["gurgaon/dlf-phase-1/<entity-slug>", "..."]}}`
5. `npm run seo:gate` — required, not optional: an ungated entity page is `noindex`.
6. Build, deploy, then `npm run seo:indexnow -- --batch entities-gurgaon-pilot-1`.
7. Record the batch below and check GSC after 3 weeks before releasing the next.

| Batch | City | Date | URLs | Indexed after 3 weeks | Next batch released? |
|---|---|---|---|---|---|
| *(none yet)* | | | | | |
