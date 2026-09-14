// .github/scripts/growth-alert.mjs — the alert step of the weekly growth workflow.
//
// One open issue labelled `growth-alert` is the alarm. If a collector failed, the site crawl
// failed, or the report evaluated a threshold breach, the issue is created or commented on
// with the details and the run link. When a later week is clean, the issue gets a "clear"
// comment and is closed. Plain Node and the preinstalled `gh` CLI; no dependencies.
//
// Inputs (environment): COLLECT_RESULT, HEALTH_RESULT (success|failure|cancelled|skipped),
// ALERTS (JSON array from docs/growth/alerts.json), REPORT_PATH, RUN_URL, GH_TOKEN, GH_REPO.
import { execFileSync } from 'node:child_process';

const LABEL = 'growth-alert';
const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'] }).trim();

const collect = process.env.COLLECT_RESULT ?? 'unknown';
const health = process.env.HEALTH_RESULT ?? 'unknown';
let alerts = [];
try {
  alerts = JSON.parse(process.env.ALERTS || '[]');
} catch {
  alerts = [{ severity: 'warn', message: 'alerts.json could not be parsed' }];
}
const problems = [];
if (collect !== 'success') problems.push(`- **collect job ${collect}** — one or more sources did not report; the report marks them n/a.`);
if (health !== 'success') problems.push(`- **site-health job ${health}** — the production crawl or the redirect sample failed.`);
for (const a of alerts) problems.push(`- **${a.severity}** ${a.message}`);

const date = new Date().toISOString().slice(0, 10);
const runUrl = process.env.RUN_URL ?? '';
const reportPath = process.env.REPORT_PATH ?? 'docs/growth/reports/latest.md';

gh(['label', 'create', LABEL, '--color', 'B60205', '--description', 'Weekly growth job failed or a threshold was breached', '--force']);
const open = JSON.parse(gh(['issue', 'list', '--label', LABEL, '--state', 'open', '--json', 'number', '--limit', '5']));
const existing = open[0]?.number;

if (problems.length) {
  const body = [`Weekly growth run on ${date}:`, '', ...problems, '', `Run: ${runUrl}`, `Report: \`${reportPath}\``].join('\n');
  if (existing) {
    gh(['issue', 'comment', String(existing), '--body-file', '-'], body);
    console.log(`commented on #${existing}`);
  } else {
    const url = gh(['issue', 'create', '--title', `Growth alert — ${date}`, '--label', LABEL, '--body-file', '-'], body);
    console.log(`opened ${url}`);
  }
  process.exitCode = 0;
} else if (existing) {
  gh(['issue', 'comment', String(existing), '--body', `All clear on ${date}: every source reported and no threshold was breached. Run: ${runUrl}`]);
  gh(['issue', 'close', String(existing)]);
  console.log(`closed #${existing}`);
} else {
  console.log('nothing to report');
}
