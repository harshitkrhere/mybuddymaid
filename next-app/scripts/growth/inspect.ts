// scripts/growth/inspect.ts — the daily URL Inspection census. Inspects the slice of the
// indexable estate that is due (never-inspected first, then oldest, 400 a day by default,
// well inside the 2,000/day quota) and merges the verdicts into the ledger.
//
//   $env:GSC_SERVICE_ACCOUNT_JSON = 'C:\keys\mbm-growth.json'
//   npm run growth:inspect -- --cap 25        # smoke test
//   npm run growth:inspect                    # the daily slice
//
// Writes docs/growth/data/inspection/ledger.json — one entry per line, sorted by path, so a
// day's commit is a readable 400-line diff. The service account must be a Full user on the
// property; a Restricted user gets 403 from this API.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SITE_URL } from '../../lib/seo-engine/meta';
import { allIndexableUrls } from '../../lib/seo-engine/sitemaps';
import { accessToken, SCOPES } from '../../lib/growth/google-auth';
import { DEFAULT_DAILY_CAP, DEFAULT_MIN_AGE_DAYS, emptyLedger, inspectPaths, mergeLedger, planSlice, summarizeLedger } from '../../lib/growth/inspection';
import type { InspectionLedger } from '../../lib/growth/types';
import { argValue, fetchImpl, LEDGER_FILE, readJson, readServiceAccount, SITE } from './_env';

function writeLedger(file: string, ledger: InspectionLedger): void {
  const entries = Object.keys(ledger.entries)
    .sort()
    .map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(ledger.entries[k])}`)
    .join(',\n');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `{\n  "kind": "inspection-ledger",\n  "version": 1,\n  "site": ${JSON.stringify(ledger.site)},\n  "updatedAt": ${JSON.stringify(ledger.updatedAt)},\n  "entries": {\n${entries}\n  }\n}\n`,
  );
}

async function main() {
  const cap = Number(argValue('--cap') ?? DEFAULT_DAILY_CAP);
  const minAgeDays = Number(argValue('--min-age') ?? DEFAULT_MIN_AGE_DAYS);
  const now = new Date();
  const key = readServiceAccount();
  const token = await accessToken(key, [SCOPES.gsc]);
  const estate = allIndexableUrls();
  const ledger = readJson<InspectionLedger>(LEDGER_FILE) ?? emptyLedger(SITE);
  const slice = planSlice(estate, ledger, { cap, minAgeDays, now });
  console.log(`estate ${estate.length} URLs, ledger ${Object.keys(ledger.entries).length} entries, inspecting ${slice.length} (cap ${cap}, min age ${minAgeDays} d)`);
  if (!slice.length) {
    console.log('nothing is due today');
    return;
  }
  const outcome = await inspectPaths({ site: SITE, siteUrl: SITE_URL, token, fetchImpl }, slice, {
    onProgress: (done, total) => {
      if (done % 50 === 0 || done === total) console.log(`  ${done}/${total}`);
    },
  });
  const merged = mergeLedger(ledger, outcome.results, estate, now);
  writeLedger(LEDGER_FILE, merged);
  const s = summarizeLedger(merged, estate, now);
  console.log(`\ninspected ${outcome.results.length}, failed ${outcome.failures.length} -> ${LEDGER_FILE}`);
  console.log(`census: ${s.inspected} of ${s.estate} inspected, ${s.fresh} fresh; verdicts ${JSON.stringify(s.byVerdict)}`);
  for (const f of outcome.failures.slice(0, 10)) console.log(`  failed ${f.status}: ${f.path}`);
  if (outcome.stoppedEarly) {
    console.error(`\nstopped early: ${outcome.stoppedEarly}\n(partial results were kept; the rest is picked up tomorrow)`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
