// lib/legal/documents.ts — the two published legal documents, read once at build time.
//
// content/legal/*.md is the published text. Pages are force-static, so the file is read
// while the site builds and never at request time; nothing here runs on Vercel's runtime.

import fs from 'node:fs';
import path from 'node:path';
import { parseLegal, type LegalDoc } from './markdown';

export type LegalSlug = 'privacy-policy' | 'terms-of-service';

export const LEGAL_FILES: Record<LegalSlug, string> = {
  'privacy-policy': 'privacy-policy.md',
  'terms-of-service': 'terms-of-service.md',
};

export function legalSource(slug: LegalSlug): string {
  return fs.readFileSync(path.join(process.cwd(), 'content', 'legal', LEGAL_FILES[slug]), 'utf8');
}

export function legalDocument(slug: LegalSlug): LegalDoc {
  return parseLegal(legalSource(slug));
}
