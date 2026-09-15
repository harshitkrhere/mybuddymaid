# The society worksheet — how the society pages get built

One page per society we serve (`/gurgaon/dlf-phase-3/park-place` and the like) is the next
layer of the SEO estate. A society page is published only when it carries **at least five
facts about that society** that are true and specific to it. Nothing is invented: the facts
come from you, the operations team, or from what customers type into the booking sheet and
the call-back form. This file explains the sheet you fill and what happens after.

## Where the candidates come from

- **OpenStreetMap** gives the list of society names and positions inside our 342 localities
  (a few thousand candidates across the eight cities). It knows nothing about who lives
  there or whether we place helpers there.
- **Customers** now tell us: every booking from the app and every call-back request carries
  the locality and, if they typed it, the society or building. Those societies rise to the
  top of the sheet with a `signal` such as `2 bookings · 1 request · last 2026-09-15`, and
  `serve?` is already `y` where a booking exists.

The sheet is refreshed from real demand on the first of every month by the GitHub job
*SEO — society worksheet from placements* (and whenever we run it by hand).

## How to fill it

The file is `docs/seo/entity-worksheet.csv` (a first batch of about 120 rows is cut from
the top of it when you ask). Open it in Google Sheets or Excel.

| Column | What to put |
|---|---|
| `serve?` | `y` only for a society we have actually placed a helper in, or can place in tomorrow without hesitation. Leave the rest empty. Nothing else counts. |
| `signal` | Read-only: what customers said. |
| `name`, `locality`, `city`, `kind`, `pincode` | Leave as they are. If the society sits in the wrong locality, tell us instead of editing. |
| `fact:Towers or blocks` | e.g. `12 towers` or `4 blocks` |
| `fact:Approximate homes` | e.g. `about 900 flats` |
| `fact:Builder` | e.g. `DLF` |
| `fact:Possession year` | e.g. `2014` |
| `fact:Typical flat sizes` | e.g. `2 and 3 BHK, 1,200–1,800 sq ft` |
| `fact:Helper entry process` | e.g. `Gate pass from the RWA office; owner's written approval` |
| `fact:Helper ID card issued by` | e.g. `RWA, after police verification copy` |
| `fact:Service lift for helpers` | e.g. `Yes, one per tower` or `No` |

Rules:

1. **Five facts minimum per `y` row**, and every fact true. A row with fewer stays a
   draft and gets no page. "Not sure" means leave the cell empty.
2. Facts about the society only. "In Gurgaon", "near the metro" and the pincode are already
   known and do not count.
3. Do not add societies from memory outside the eight cities. The lock applies here too.
4. Send the sheet back (or say where it is) and stop there. The rest is ours.

## What happens after you send it

1. `npm run seo:entities -- --csv <your sheet> --keep-untriaged --promote` imports the `y`
   rows, keeps the untouched candidates, and promotes every row with five or more facts.
2. `npm run seo:gate` checks the new pages for thinness and near-duplicates, exactly like
   every other page. A page that fails renders as `noindex` until it passes.
3. The batch is released with `npm run release:batch`: its own sitemap shard, its own
   IndexNow submission, a line in `docs/seo/rollout-log.md`. At most 2,000 URLs per city
   per week.
4. The daily census watches it. The next batch goes out only when at least 60 % of the
   previous one is indexed after three weeks.
