// scripts/growth/weekly-report.ts — composes the Monday report from whatever snapshots the
// fetchers wrote for the window, plus the inspection ledger and the data layer. A source
// that did not report is named as such in the report; nothing is estimated.
//
//   npm run growth:report                      # window ends three days ago
//   npm run growth:report -- --end 2026-09-11
//   npm run growth:report -- --baseline        # also writes docs/growth/baseline.md (once)
//
// Writes docs/growth/reports/<end>.md and latest.md, docs/growth/data/weekly/<end>.json,
// docs/growth/alerts.json and appends to docs/growth/expansion-candidates.md.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CITIES } from '../../data/seo';
import { allIndexableUrls } from '../../lib/seo-engine/sitemaps';
import { cityBucket, classify } from '../../lib/growth/classify';
import { mergeExpansionLog } from '../../lib/growth/expansion';
import { summarizeLedger } from '../../lib/growth/inspection';
import { composeBaseline, composeWeeklyReport, type ReportInputs } from '../../lib/growth/report';
import type { BingSnapshot, Ga4Snapshot, GscSnapshot, InspectionLedger, SupabaseSnapshot, WeeklySummary } from '../../lib/growth/types';
import { dataDir, endDate, GROWTH_DIR, hasFlag, latestSnapshot, LEDGER_FILE, nowIso, readJson, readText, windowsFor, writeJson, writeText } from './_env';

function previousSummary(end: string): WeeklySummary | null {
  const dir = dataDir('weekly');
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < end)
    .sort();
  return files.length ? readJson<WeeklySummary>(path.join(dir, files[files.length - 1])) : null;
}

function main() {
  const end = endDate();
  const windows = windowsFor(end);
  const notes: string[] = [];
  const pick = <T extends { windows: { current: { end: string } }; errors: string[] }>(kind: string, label: string): T | null => {
    const s = latestSnapshot<T>(kind, end);
    if (!s) {
      notes.push(`${label}: no snapshot — source not connected.`);
      return null;
    }
    if (s.data.windows.current.end !== end) notes.push(`${label}: no snapshot for the week ending ${end}; using ${path.basename(s.file)}.`);
    for (const e of s.data.errors) notes.push(`${label}: ${e}`);
    return s.data;
  };
  const gsc = pick<GscSnapshot>('gsc', 'Search Console');
  const ga4 = pick<Ga4Snapshot>('ga4', 'GA4');
  const bing = pick<BingSnapshot>('bing', 'Bing');
  const supabase = pick<SupabaseSnapshot>('supabase', 'Supabase');
  if (ga4?.customDimensions.missing.length) notes.push(`GA4: custom dimensions not registered: ${ga4.customDimensions.missing.join(', ')} — CTA clicks by city are unavailable until 24-48 h after \`npm run growth:ga4:register\`.`);
  if (supabase && !supabase.leads) notes.push('Leads: the leads table does not exist yet (Phase 1d), so the lead-form column is n/a.');

  const estate = allIndexableUrls();
  const ledger = readJson<InspectionLedger>(LEDGER_FILE);
  const census = ledger ? summarizeLedger(ledger, estate, new Date()) : null;
  if (!census) notes.push('Index census: the daily URL-inspection job has not run yet; "Indexed (PASS)" is n/a.');
  const estateByCity: Record<string, number> = {};
  for (const u of estate) {
    const b = cityBucket(classify(u));
    estateByCity[b] = (estateByCity[b] ?? 0) + 1;
  }

  const inputs: ReportInputs = {
    asOf: end,
    generatedAt: nowIso(),
    windows,
    cities: CITIES,
    estateByCity,
    gsc,
    ga4,
    bing,
    supabase,
    census,
    previous: previousSummary(end),
    baseline: readJson<WeeklySummary>(path.join(dataDir('weekly'), 'baseline.json')),
    notes,
  };
  const report = composeWeeklyReport(inputs);

  const reportFile = path.join(GROWTH_DIR, 'reports', `${end}.md`);
  writeText(reportFile, report.markdown);
  writeText(path.join(GROWTH_DIR, 'reports', 'latest.md'), report.markdown);
  writeJson(path.join(dataDir('weekly'), `${end}.json`), report.summary);
  writeJson(path.join(GROWTH_DIR, 'alerts.json'), report.alerts);
  if (gsc) {
    const logFile = path.join(GROWTH_DIR, 'expansion-candidates.md');
    writeText(logFile, mergeExpansionLog(readText(logFile), gsc.expansion, end));
  }
  if (hasFlag('--baseline')) {
    const baselineFile = path.join(GROWTH_DIR, 'baseline.md');
    if (fs.existsSync(baselineFile) && !hasFlag('--force')) console.log(`baseline.md already exists; pass --force to overwrite it`);
    else {
      writeText(baselineFile, composeBaseline(inputs, report));
      writeJson(path.join(dataDir('weekly'), 'baseline.json'), report.summary);
      console.log(`wrote ${baselineFile}`);
    }
  }
  console.log(`wrote ${reportFile}`);
  console.log(`alerts: ${report.alerts.length ? report.alerts.map((a) => `${a.severity} ${a.id}`).join(', ') : 'none'}`);
  for (const n of notes) console.log(`note: ${n}`);
}

main();
