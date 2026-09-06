#!/usr/bin/env node
// scripts/build-spa.mjs — builds the Vite booking app with base=/_spa/ and embeds the
// output at next-app/public/_spa so the Next.js site can serve it under /app/*.
// Run from the repo root:  node scripts/build-spa.mjs
// Requires the app's VITE_* env vars (Supabase URL/anon key, Razorpay key) in the shell
// or in app/.env — they are inlined at build time.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app');
const DIST = path.join(APP, 'dist');
const TARGET = path.join(ROOT, 'next-app', 'public', '_spa');

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, SPA_BASE: '/_spa/' } });

if (!existsSync(path.join(APP, 'node_modules'))) run('npm install', APP);
run('npx vite build', APP);

rmSync(TARGET, { recursive: true, force: true });
cpSync(DIST, TARGET, { recursive: true });
console.log(`build-spa: embedded ${DIST} → ${TARGET}`);
