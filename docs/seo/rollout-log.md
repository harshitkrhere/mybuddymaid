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

None released. `data/seo/entities.json` is empty and
`data/seo/quality/rollout.json` has no batches, so no entity URL exists yet.

To release the first pilot batch:

1. `npm run seo:entities -- --csv <societies.csv>` (or `--osm --city gurgaon --locality dlf-phase-1`)
2. Review the drafts, add the entity-specific facts that only the operator has.
3. `npm run seo:entities -- --promote` — only entities with ≥ 5 facts become `ready`.
4. Add the batch to `data/seo/quality/rollout.json`:
   `{"batches": {"gurgaon-pilot-1": ["gurgaon/dlf-phase-1/<entity-slug>", "..."]}}`
5. `npm run seo:gate` — entity pages face the same uniqueness gate as core pages.
6. Build, deploy, then `npm run seo:indexnow -- --batch entities-gurgaon-pilot-1`.
7. Record the batch below and check GSC after 3 weeks before releasing the next.

| Batch | City | Date | URLs | Indexed after 3 weeks | Next batch released? |
|---|---|---|---|---|---|
| *(none yet)* | | | | | |
