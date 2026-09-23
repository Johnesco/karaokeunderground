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
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createServer } from './lib/dev-server.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '8001' },
    content: { type: 'string', default: path.join(REPO, 'work', 'content') },
  },
});
const contentDir = path.resolve(values.content);
const shown = path.relative(REPO, contentDir).split(path.sep).join('/') || '.';

createServer({ siteDir: path.join(REPO, 'site'), contentDir }).listen(Number(values.port), '127.0.0.1', () => {
  console.log(`Previewing the site at http://127.0.0.1:${values.port}/ (code from site/, content from ${shown})`);
});
