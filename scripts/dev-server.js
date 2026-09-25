#!/usr/bin/env node
/**
 * Previews the site locally (ADR-003): the code from site/ with the core files
 * from work/content/, the private working copy.
 *
 *   npm run dev                                   # http://127.0.0.1:8001/
 *   node scripts/dev-server.js --port 8002 --content path/to/content
 *
 * It listens on 127.0.0.1 only, because the core files are the owner's content
 * and stay off the network until they agree.
 *
 * The newest private copy of the site from before WordPress, in
 * snapshots/<date>-pre-wordpress/ (ADR-011), shows at /old/. Nothing links
 * there, and --old points it at another copy.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createServer } from './lib/dev-server.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The newest copy of the old site in snapshots/, or null. */
function newestOldSite() {
  const dir = path.join(REPO, 'snapshots');
  const copies = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('-pre-wordpress')).sort() : [];
  return copies.length ? path.join(dir, copies.at(-1), 'site') : null;
}

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '8001' },
    content: { type: 'string', default: path.join(REPO, 'work', 'content') },
    old: { type: 'string' },
  },
});
const contentDir = path.resolve(values.content);
const oldDir = values.old ? path.resolve(values.old) : newestOldSite();
const shown = (dir) => path.relative(REPO, dir).split(path.sep).join('/') || '.';

createServer({ siteDir: path.join(REPO, 'site'), contentDir, oldDir }).listen(Number(values.port), '127.0.0.1', () => {
  console.log(`Previewing the site at http://127.0.0.1:${values.port}/ (code from site/, content from ${shown(contentDir)})`);
  if (oldDir) console.log(`The site from before WordPress is at http://127.0.0.1:${values.port}/old/ (from ${shown(oldDir)})`);
});
