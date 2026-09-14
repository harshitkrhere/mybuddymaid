// scripts/growth/_env.ts — the plumbing every growth script shares: arguments, environment,
// paths and JSON I/O. Scripts run from next-app/ (`npm run growth:*`), on Windows PowerShell
// as much as on the Linux runner: no shell substitution, path.join everywhere, LF output.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseServiceAccount, type ServiceAccountKey } from '../../lib/growth/google-auth';
import { defaultEnd, isIsoDate, weeklyWindows, type Window, type WindowKey } from '../../lib/growth/windows';

export const args = process.argv.slice(2);
export const argValue = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
export const hasFlag = (flag: string): boolean => args.includes(flag);

export const REPO = path.resolve(process.cwd(), '..');
export const GROWTH_DIR = process.env.GROWTH_DIR ? path.resolve(process.env.GROWTH_DIR) : path.join(REPO, 'docs', 'growth');
export const dataDir = (kind: string): string => path.join(GROWTH_DIR, 'data', kind);
export const LEDGER_FILE = path.join(dataDir('inspection'), 'ledger.json');
export const nowIso = (): string => new Date().toISOString();
export const SITE = process.env.GSC_SITE ?? 'sc-domain:mybuddymaid.in';

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** The window end: --end, then GROWTH_END, then three days before today (Search Console lag). */
export function endDate(): string {
  const e = argValue('--end') ?? process.env.GROWTH_END;
  if (e) {
    if (!isIsoDate(e)) fail(`--end must be YYYY-MM-DD, got ${e}`);
    return e;
  }
  return defaultEnd();
}

export function windowsFor(end: string): Record<WindowKey, Window> {
  return weeklyWindows(end);
}

export function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function writeText(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`);
}

export function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function readText(file: string): string | null {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/** The snapshot written for `end` if there is one, else the newest dated snapshot of that kind. */
export function latestSnapshot<T>(kind: string, end: string): { file: string; data: T } | null {
  const dir = dataDir(kind);
  if (!fs.existsSync(dir)) return null;
  const exact = path.join(dir, `${end}.json`);
  if (fs.existsSync(exact)) return { file: exact, data: readJson<T>(exact) as T };
  const dated = fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (!dated.length) return null;
  const file = path.join(dir, dated[dated.length - 1]);
  return { file, data: readJson<T>(file) as T };
}

/** GSC_SERVICE_ACCOUNT_JSON is a file path locally and the key's JSON itself in CI. */
export function readServiceAccount(): ServiceAccountKey {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) return fail('Set GSC_SERVICE_ACCOUNT_JSON to the service-account key file path (or the JSON itself).');
  if (raw.trim().startsWith('{')) return parseServiceAccount(raw);
  if (!fs.existsSync(raw)) return fail(`GSC_SERVICE_ACCOUNT_JSON: no file at ${raw}`);
  return parseServiceAccount(fs.readFileSync(raw, 'utf8'));
}

/** Dumps a raw API response when GROWTH_RAW_DIR is set (kept as a workflow artifact), never into the repo. */
export function rawDump(name: string, data: unknown): void {
  const dir = process.env.GROWTH_RAW_DIR;
  if (!dir) return;
  writeJson(path.join(dir, `${name}.json`), data);
}

export const fetchImpl = (input: string, init?: RequestInit) => fetch(input, init);
