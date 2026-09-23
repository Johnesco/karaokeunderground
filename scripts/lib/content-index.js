/**
 * The content index (ADR-003): what the site reads at /content/index.json,
 * because a web host can't list a folder. It has every page's and post's name
 * and front matter, with the posts newest first, for the archive and the home
 * page.
 *
 * The dev server builds it on each request. The Netlify build will write it,
 * like the other derived files ADR-001 describes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontMatter } from '../../site/js/front-matter.js';

export function buildIndex(dir) {
  const read = (kind) => {
    const folder = path.join(dir, kind);
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder).filter((f) => f.endsWith('.md')).sort().flatMap((file) => {
      try {
        const { data } = parseFrontMatter(fs.readFileSync(path.join(folder, file), 'utf8'));
        return [{ name: file.slice(0, -3), title: data.title || file, date: data.date || null, updated: data.updated || null }];
      } catch {
        return []; // the content check reports a file it can't read
      }
    });
  };
  const newestFirst = (a, b) => (a.date === b.date ? (a.name < b.name ? 1 : -1) : a.date < b.date ? 1 : -1);
  return { pages: read('pages'), posts: read('posts').sort(newestFirst) };
}
