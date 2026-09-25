/**
 * The site's build (ADR-010): everything a static host needs, in one folder.
 *
 * It copies site/ and the core files, writes content/index.json, and gives
 * every page and post address its own copy of the page shell, so each one
 * answers as a page, with a 404 page for anything else. With a base path, the
 * shell's root links move under it; the scripts work the base out for
 * themselves (router.js). A preview build also tells search engines to leave
 * it out, and says on every page what it is.
 */

import fs from 'node:fs';
import path from 'node:path';
import { buildIndex } from './content-index.js';

// Old paths from before the site regrouped (ADR-009): each gets a shell too,
// so it answers as a page while the router sends it on.
const MOVED = ['songlist', 'calendar', 'contact', 'media'];

const PREVIEW_NOTE = '<p class="preview-note">A prototype preview, not the official site: that\u{2019}s <a href="https://karaokeunderground.com/">karaokeunderground.com</a>.</p>';

/**
 * The page shell for a host: its root links under the base, and in a preview
 * build, noindex and the preview note.
 *
 * @param {string} html site/index.html
 * @param {{ base?: string, preview?: boolean }} [options]
 */
export function pageShell(html, { base = '/', preview = false } = {}) {
  let out = html.replace(/\b(href|src|action)="\/(?!\/)/g, `$1="${base}`);
  if (preview) {
    out = out.replace(/(\n\s*)<meta name="viewport"/, '$1<meta name="robots" content="noindex, nofollow">$1<meta name="viewport"');
    out = out.replace(/(\n\s*)<\/header>/, `$1  ${PREVIEW_NOTE}$1</header>`);
  }
  return out;
}

/**
 * Builds the site into outDir, replacing whatever was there.
 *
 * @param {{ siteDir: string, contentDir: string, outDir: string, base?: string, preview?: boolean, git?: boolean }} options
 *   git: false leaves out the songlist's date, which comes from git history
 */
export function buildSite({ siteDir, contentDir, outDir, base = '/', preview = false, git = true }) {
  if (!/^\/(?:[^/]+\/)*$/.test(base)) throw new Error(`The base path has to start and end with "/", like /karaokeunderground/: ${base}`);
  if (!fs.existsSync(path.join(contentDir, 'songlist.csv'))) throw new Error(`There's no content at ${contentDir}`);
  const shellFile = path.join(siteDir, 'index.html');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.cpSync(siteDir, outDir, { recursive: true, filter: (src) => path.resolve(src) !== path.resolve(shellFile) });
  fs.cpSync(contentDir, path.join(outDir, 'content'), { recursive: true });

  const index = buildIndex(contentDir, { git });
  fs.writeFileSync(path.join(outDir, 'content', 'index.json'), `${JSON.stringify(index)}\n`);

  const shell = pageShell(fs.readFileSync(shellFile, 'utf8'), { base, preview });
  const addresses = [
    '',
    'posts/',
    ...index.pages.filter((p) => p.name !== 'songlist').map((p) => `${p.name}/`),
    ...index.posts.map((p) => `posts/${p.name}/`),
    ...MOVED.map((name) => `${name}/`),
  ];
  for (const address of addresses) {
    fs.mkdirSync(path.join(outDir, address), { recursive: true });
    fs.writeFileSync(path.join(outDir, address, 'index.html'), shell);
  }
  fs.writeFileSync(path.join(outDir, '404.html'), shell);
  fs.writeFileSync(path.join(outDir, '.nojekyll'), ''); // serve the files as they are
  return { addresses: addresses.length, posts: index.posts.length, pages: index.pages.length };
}
