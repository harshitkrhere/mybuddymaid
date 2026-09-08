// Run: npx tsx --test lib/__tests__/stylesheets.test.ts
//
// FIN-B01: /privacy-policy and /terms-of-service used class names that only
// styles/static-pages.css defined, and nothing imported that file, so both pages rendered
// unstyled in production for as long as they existed. Next.js bundles a stylesheet only when
// some module imports it, so a class that resolves in nothing but an orphan file resolves
// nowhere. This pins that rule for every page and component.
//
// The rule is deliberately "loaded by some route", not "loaded by the route that uses it":
// it is the exact shape of the defect that shipped, and the dry run that motivated it
// flagged the two legal pages and nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..'); // next-app/
const SOURCE_DIRS = ['app', 'components', 'lib'];
const STYLE_DIRS = ['app', 'styles', 'components'];

function walk(dir: string, match: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, match, out);
    else if (match.test(entry.name)) out.push(p);
  }
  return out;
}

const sources = SOURCE_DIRS.flatMap((d) => walk(join(ROOT, d), /\.tsx?$/));
const stylesheets = STYLE_DIRS.flatMap((d) => walk(join(ROOT, d), /\.css$/));

/** Stylesheets some module imports (`./globals.css`, `@/styles/x.css`), plus what those @import. */
function loadedStylesheets(): Set<string> {
  const loaded = new Set<string>();
  for (const file of sources) {
    for (const m of readFileSync(file, 'utf8').matchAll(/import\s+['"]([^'"]+\.css)['"]/g)) {
      loaded.add(m[1].startsWith('@/') ? join(ROOT, m[1].slice(2)) : resolve(dirname(file), m[1]));
    }
  }
  for (const css of [...loaded]) {
    for (const m of readFileSync(css, 'utf8').matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)) {
      loaded.add(resolve(dirname(css), m[1]));
    }
  }
  return loaded;
}

function classesDefinedIn(css: string): Set<string> {
  const text = readFileSync(css, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/url\([^)]*\)/g, '');
  return new Set([...text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
}

/** Literal class names; the `${...}` parts of a template literal are skipped, not resolved. */
function classesUsedIn(source: string): Set<string> {
  const used = new Set<string>();
  for (const m of readFileSync(source, 'utf8').matchAll(/className=\{?["'`]([^"'`]*)["'`]/g)) {
    for (const token of m[1].split(/\s+/)) if (/^-?[_a-zA-Z][\w-]*$/.test(token)) used.add(token);
  }
  return used;
}

test('the scan sees the root stylesheet, so an empty result below means something', () => {
  assert.ok(loadedStylesheets().has(join(ROOT, 'app', 'globals.css')));
  assert.ok(sources.length > 10 && stylesheets.length > 1);
});

test('no page or component uses a class that only an unimported stylesheet defines (FIN-B01)', () => {
  const loaded = loadedStylesheets();
  const resolvable = new Set<string>();
  for (const css of loaded) for (const cls of classesDefinedIn(css)) resolvable.add(cls);
  const orphans = stylesheets.filter((css) => !loaded.has(css)).map((css) => ({ css, classes: classesDefinedIn(css) }));

  const violations: string[] = [];
  for (const file of sources) {
    for (const cls of classesUsedIn(file)) {
      if (resolvable.has(cls)) continue;
      for (const o of orphans) {
        if (o.classes.has(cls)) {
          violations.push(`${relative(ROOT, file)} uses .${cls}, defined only in ${relative(ROOT, o.css)}, which nothing imports`);
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});
