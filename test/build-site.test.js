import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite, pageShell } from '../scripts/lib/build-site.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'test', 'fixtures', 'content');

describe('pageShell', () => {
  const html = '<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="x">\n  <link rel="stylesheet" href="/css/site.css">\n</head>\n<body>\n  <header>\n'
    + '    <a href="/"><img src="/content/images/site/logo.png"></a>\n    <a href="https://karaokeunderground.com/">x</a> <a href="//cdn.example/x">y</a>\n  </header>';

  it('moves the root links under the base, and leaves other sites alone', () => {
    const out = pageShell(html, { base: '/ku/' });
    assert.match(out, /href="\/ku\/css\/site\.css"/);
    assert.match(out, /<a href="\/ku\/"><img src="\/ku\/content\/images\/site\/logo\.png">/);
    assert.match(out, /href="https:\/\/karaokeunderground\.com\/"/);
    assert.match(out, /href="\/\/cdn\.example\/x"/);
    assert.doesNotMatch(out, /noindex|preview-note/);
  });

  it('keeps a preview out of search engines, and says on every page what it is', () => {
    const out = pageShell(html, { base: '/ku/', preview: true });
    assert.match(out, /<meta name="robots" content="noindex, nofollow">\n {2}<meta name="viewport"/);
    assert.match(out, /<p class="preview-note">A prototype preview, not the official site.*karaokeunderground\.com<\/a>\.<\/p>\n {2}<\/header>/);
  });

  it('changes nothing at the root without a preview', () => {
    assert.equal(pageShell(html), html);
  });
});

describe('buildSite', () => {
  let out;
  before(() => {
    out = fs.mkdtempSync(path.join(os.tmpdir(), 'ku-build-'));
    buildSite({ siteDir: path.join(ROOT, 'site'), contentDir: FIXTURE, outDir: out, base: '/ku/', preview: true, git: false });
  });
  after(() => fs.rmSync(out, { recursive: true, force: true }));

  it('gives every page and post address its own page shell, the old paths too, and has a 404 page', () => {
    for (const file of ['index.html', 'about/index.html', 'posts/index.html', 'posts/2026-01-02-first-post/index.html', 'songlist/index.html', 'calendar/index.html', '404.html', '.nojekyll']) {
      assert.ok(fs.existsSync(path.join(out, file)), file);
    }
    const shell = fs.readFileSync(path.join(out, 'about', 'index.html'), 'utf8');
    assert.match(shell, /href="\/ku\/css\/site\.css"/);
    assert.match(shell, /noindex/);
  });

  it('copies the site and the content, and writes the content index', () => {
    for (const file of ['css/site.css', 'js/app.js', 'fonts/sprayme.woff', 'content/songlist.csv', 'content/pages/about.md']) {
      assert.ok(fs.existsSync(path.join(out, file)), file);
    }
    const index = JSON.parse(fs.readFileSync(path.join(out, 'content', 'index.json'), 'utf8'));
    assert.equal(index.posts[0].name, '2026-01-02-first-post');
  });

  it('refuses a base path that doesn\u{2019}t start and end with a slash, or a folder with no content', () => {
    assert.throws(() => buildSite({ siteDir: path.join(ROOT, 'site'), contentDir: FIXTURE, outDir: path.join(out, 'x'), base: 'ku' }), /base path/);
    assert.throws(() => buildSite({ siteDir: path.join(ROOT, 'site'), contentDir: path.join(out, 'nothing'), outDir: path.join(out, 'x') }), /no content/);
  });
});
