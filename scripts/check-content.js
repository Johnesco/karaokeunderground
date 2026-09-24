#!/usr/bin/env node
/**
 * Checks the core files (ADR-002) and exits non-zero if the site shouldn't be
 * built from them. `npm test` runs it after the unit tests.
 *
 *   node scripts/check-content.js                   # work/content, the private working copy
 *   node scripts/check-content.js path/to/content   # any other content folder
 *
 * Exit 0: no errors (warnings are fine). 1: errors, or nothing to check.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkContent } from './lib/check-content.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(process.argv[2] ?? path.join(REPO, 'work', 'content'));
const shown = path.relative(REPO, dir).split(path.sep).join('/') || '.';
const n = (x) => x.toLocaleString('en-US');

console.log(`Checking the core files in ${shown}\n`);
const report = checkContent(dir);
const { songlist, pages, posts, images, thumbs } = report.summary;

if (songlist) {
  const themes = Object.entries(songlist.themes).map(([t, c]) => `${t} (${n(c)})`).join(', ');
  console.log(`  songlist.csv  ${n(songlist.songs)} songs${songlist.unlisted ? `, ${n(songlist.unlisted)} unlisted` : ''}`);
  console.log(`                themes: ${themes || 'none'}. Tags: ${songlist.tags ? n(songlist.tags) : 'none yet'}`);
}
if (pages !== undefined) console.log(`  pages/        ${n(pages)}`);
if (posts !== undefined) console.log(`  posts/        ${n(posts)}`);
if (images !== undefined) console.log(`  images/       ${n(images)}${thumbs ? `, plus ${n(thumbs)} small copies for the Photos page` : ''}`);

const where = (p) => [p.file, p.line ? `line ${p.line}` : ''].filter(Boolean).join(' ');
const print = (title, problems) => {
  if (!problems.length) return;
  console.log(`\n${title}`);
  for (const p of problems) console.log(`  ${where(p)}${where(p) ? ': ' : ''}${p.message}`);
};
print(`${n(report.warnings.length)} warning${report.warnings.length === 1 ? '' : 's'}: worth a look, but they don't stop the site`, report.warnings);
print(`${n(report.errors.length)} error${report.errors.length === 1 ? '' : 's'}`, report.errors);

if (report.errors.length) {
  if (!report.summary.songlist && pages === undefined) {
    console.log('\nThe core files live in the private content repo. Clone it into work/, or pass the folder to check.');
  }
  console.log('\nFailed: fix the errors above, then run the check again.');
  process.exit(1);
}
console.log('\nPassed: no errors.');
