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

### Decided: one page per entity, not entity × service

With one entity promoted to `ready` as a round-trip test, the gate composed its 6 service
pages and **noindexed 5 of them**:

| Pair | Jaccard |
|---|---|
| `.../mahagun-moderne/cook` vs `.../babysitter-nanny` | 0.763 |
| `.../mahagun-moderne/cook` vs `.../domestic-help` | 0.750 |
| `.../mahagun-moderne/full-time-maid` vs `.../part-time-maid` | 0.746 |
| *(10 more pairs, all 0.72–0.74)* | |

The six pages differed only in the service name and the pricing band; the facts block, the
access paragraph, the verification section and two of five FAQs were identical, and ~480
words left no room to separate them. The five extra URLs would have existed only as
noindexed filler.

**The owner's decision (2026-09-06): one page per entity at `/<city>/<area>/<entity>`,
covering all six services.** Service cards and the pricing table link to the locality money
pages, so deeper service intent lands where the depth is; the parent locality page links
its entities, so no entity page is an orphan. Entity pages are prerendered alongside the
service × locality pages on the same route rather than ISR.

Re-measured after the change, on the same test entity:

| Check | Result |
|---|---|
| Words | 906 |
| Local-token ratio | 0.64 (floor 0.50) |
| Verdict | `index, follow` |
| Duplicate pairs in the whole estate | 0 |

This lowers the Phase 5 projection from ~100,000 pages to **~17,000**. The gap to 200
leads/day comes from more entities per locality, the Google Business Profile and local
pack, and paid search — not from more URLs per entity.

### First batch scope

The owner's decision: **the first batch covers only societies where we already have
placements.** The facts the worksheet asks for are already in the CRM and WhatsApp
history for those societies, so every published fact is verifiable, and those are the
societies that convert best. Candidates with no placement history stay `draft`.

### Wide candidate run — 2026-09-06, Greater Noida + Gurgaon + Noida (119 localities)

Owner's instruction: run `--osm` wide first, for recall, expecting zero promotable. The value
is turning "list every society you serve from memory" into "tick the ones you serve from
this list". Result: **614 draft candidates, 0 ready, 0 pages** — as intended.

| City | Localities | Drafts | Localities with ≥ 1 | Top localities |
|---|---|---|---|---|
| Greater Noida | 12 | 156 | 9 | Gaur City 45 · Jaypee Greens 40 · Techzone 40 |
| Gurgaon | 50 | 352 | 46 | Golf Course Road 20 · Sector 86 20 · DLF Phase 1 17 · Sector 44 17 |
| Noida | 57 | 106 | 33 | Sector 76 14 · Sector 62 13 · Sector 50 7 · Sector 51 7 |

By kind: 568 societies, 31 landmarks, 15 metro stations. Worksheet:
[`entity-worksheet.csv`](entity-worksheet.csv), `serve?` column first, sorted by locality.

**Tower-level guard, verified on the brief's own example.** The parent-locality rule is an
exact match on the whole normalised name (`slugify(name minus city) === slugify(locality)`
or one of its alt names); nothing prefix- or substring-based. Gaur City, run alone with
`--verbose`: 72 candidates, **8 rejected, every one of them named** —

| Reason | Names |
|---|---|
| generic tower/block label, no society name | Tower A · tower A · Tower B · Tower C · Tower H |
| private house | vipin's appartment · Manral's Home |
| sector name | Sector 122 |
| exactly the parent locality | *(none in this run)* |

`12th Avenue Gaur City 2` and `16th Avenue` both survived — they are the only two avenues
OSM has mapped; the other fourteen must come from the operator. The 16 parent-locality
rejections in the first Greater Noida pass predate name logging; by construction they can
only be a name equal to `Gaur City`, `Gaur City 1`, `Gaur City 2`, `Jaypee Greens`,
`Alpha`, `Beta`… — the `place=suburb` / `boundary=place` nodes and relations that *are*
the locality. Rejected names now print under every reason with `--verbose`, after every
locality in an `--all` run, and the parent-locality reason always prints its names.

**Rejection tallies** (the same rules everywhere; numbers per city):

| Reason | Greater Noida | Gurgaon (sectors 65+) | Noida |
|---|---|---|---|
| tower within a society that is itself a candidate | 86 (Kosmos 01–80, …) | – | – |
| generic tower/block label, no society name | 35 | 28 | 9 (Block K–O, Site, Pocket 7) |
| name is exactly the parent locality | 16 | – | – |
| name is a sector, not an entity | 11 | 2 | 83 |
| slug collides with a locality | – | – | 65 (a sector we already serve) |
| plot/house code | 9 | 3 | 10 (A1, A5, Pi) |
| private house | 3 | – | – |
| too far from any Appendix-B locality | 1 | – | – |

Noida's rejections are almost all sector names — the Overpass `place=neighbourhood`
layer in Noida is sectors, which are localities in this model, not entities. That is
correct behaviour, not lost recall.

**Three things the run exposed:**

1. **11 Noida localities are geocoded to the city centre.** Sectors 140, 141, 142, 145,
   146, 147, 148, 150, 151, 152 (and one more) all carry `28.57054, 77.32289`, the Noida
   centroid Nominatim returns when the sector query fails; sector-136 and sector-149 also
   look wrong. Their neighbour lists therefore point at central Noida, and the entity
   sweep found nothing near them (identical "10 rejected, 10 attributed" every time —
   the same query point). This is a core-estate data defect, not a Phase 5 one; queued
   as its own task. Until it is fixed those sectors will have no candidates.
2. **Overpass reliability.** The public API returned 429/504 and connect timeouts across
   all three mirrors for about an hour. The importer now rotates mirrors, backs off up to
   180 s, aborts a hung request at 120 s, prefers IPv4, and treats a `remark` (a partial
   result on HTTP 200) as a failed attempt rather than silently under-counting.
3. **A process-management failure, mine.** Stopping a background shell on Windows did
   not stop its `node` child, so for about an hour two importers ran in parallel — the
   one thing the owner said not to do — and overwrote each other's `entities.json`; a
   dozen Gurgaon sectors were logged as imported and then lost. Re-run from Sector 65
   recovered them. Guards now: a pid lockfile refuses a second instance, every write
   merges with what is on disk and lands by atomic rename, and `--from <slug>` resumes a
   city without re-fetching. Recorded so nobody repeats it.

**Next:** the owner marks `serve? = y` on societies with existing placements and fills
≥ 5 `fact:` columns for each; `--csv ... --promote` then `seo:gate`. Everything else in
the worksheet is dropped on that import.

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
   `{"batches": {"gurgaon-pilot-1": ["gurgaon/dlf-phase-1/<entity-slug>", "..."]}}` — one
   URL per entity, so a 2,000-URL weekly cap is 2,000 entities, not 333.
5. `npm run seo:gate` — required, not optional: an ungated entity page is `noindex`.
6. Build, deploy, then `npm run seo:indexnow -- --batch entities-gurgaon-pilot-1`.
7. Record the batch below and check GSC after 3 weeks before releasing the next.

| Batch | City | Date | URLs | Indexed after 3 weeks | Next batch released? |
|---|---|---|---|---|---|
| *(none yet)* | | | | | |
