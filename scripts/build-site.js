#!/usr/bin/env node
/**
 * Builds the site into a folder a static host can serve (ADR-010):
 *
 *   node scripts/build-site.js [--base /karaokeunderground/] [--preview] [--content work/content] [--out dist]
 *
 * --base     where the site will live; "/" by default
 * --preview  tell search engines to leave it out, and mark every page as a preview
 * --content  the core files; work/content by default
 * --out      the folder to write; dist by default, emptied first
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from './lib/build-site.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

try {
  const outDir = path.resolve(ROOT, value('--out', 'dist'));
  const result = buildSite({
    siteDir: path.join(ROOT, 'site'),
    contentDir: path.resolve(ROOT, value('--content', path.join('work', 'content'))),
    outDir,
    base: value('--base', '/'),
    preview: args.includes('--preview'),
  });
  console.log(`Built ${outDir}: ${result.pages} pages, ${result.posts} posts, ${result.addresses} addresses.`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
