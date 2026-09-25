import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { route, sitePath, siteUrl } from '../site/js/router.js';
import { formatDate, pageView, postView, postsView, missingView } from '../site/js/views.js';
import { parseFrontMatter } from '../site/js/front-matter.js';
import { buildIndex } from '../scripts/lib/content-index.js';
import { resolve, createServer } from '../scripts/lib/dev-server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'test', 'fixtures', 'content');
const DIRS = { siteDir: path.join(ROOT, 'site'), contentDir: FIXTURE };

describe('route', () => {
  it('maps clean paths to views, with the trailing slash as the canonical form', () => {
    assert.deepEqual(route('/'), { view: 'page', name: 'songlist', path: '/' });
    assert.deepEqual(route('/about'), { view: 'page', name: 'about', path: '/about/' });
    assert.deepEqual(route('/posts/'), { view: 'posts', path: '/posts/' });
    assert.deepEqual(route('/posts/2025-12-27-sad-songs-only-2025/'), { view: 'post', name: '2025-12-27-sad-songs-only-2025', path: '/posts/2025-12-27-sad-songs-only-2025/' });
  });

  it('lands old paths on the page that took them in when the site regrouped (ADR-009)', () => {
    assert.deepEqual(route('/songlist/'), { view: 'page', name: 'songlist', path: '/' });
    assert.deepEqual(route('/calendar/'), { view: 'page', name: 'shows', path: '/shows/' });
    assert.deepEqual(route('/contact'), { view: 'page', name: 'about', path: '/about/' });
    assert.deepEqual(route('/media/'), { view: 'page', name: 'about', path: '/about/' });
  });

  it('works under a base path, as on GitHub Pages (ADR-010)', () => {
    const base = '/karaokeunderground/';
    assert.deepEqual(route('/karaokeunderground/', base), { view: 'page', name: 'songlist', path: base });
    assert.deepEqual(route('/karaokeunderground', base), { view: 'page', name: 'songlist', path: base });
    assert.deepEqual(route('/karaokeunderground/shows', base), { view: 'page', name: 'shows', path: '/karaokeunderground/shows/' });
    assert.deepEqual(route('/karaokeunderground/calendar/', base), { view: 'page', name: 'shows', path: '/karaokeunderground/shows/' });
    assert.equal(route('/shows/', base).view, 'missing', 'outside the base is no page of ours');
    assert.equal(sitePath('about.md', 'pages', base), '/karaokeunderground/about/');
    assert.equal(sitePath('../pages/songlist.md?theme=sad', 'posts', base), '/karaokeunderground/?theme=sad');
    assert.equal(sitePath('../images/2014/04/poster.jpg', 'posts', base), '/karaokeunderground/content/images/2014/04/poster.jpg');
    assert.equal(sitePath('../posts/', 'pages', base), '/karaokeunderground/posts/');
    assert.equal(siteUrl('/', base), base);
  });

  it('sends anything else to the not-found page', () => {
    for (const p of ['/About/', '/a b/', '/posts/a/b/', '/%E0%A4%A']) assert.equal(route(p).view, 'missing');
  });
});

describe('sitePath', () => {
  it('turns links to .md files into page and post paths', () => {
    assert.equal(sitePath('about.md', 'pages'), '/about/');
    assert.equal(sitePath('../pages/songlist.md', 'posts'), '/', 'the songlist is the home page');
    assert.equal(sitePath('../pages/songlist.md?theme=sad', 'posts'), '/?theme=sad');
    assert.equal(sitePath('../posts/2019-01-03-2018-top-tens.md#songs', 'pages'), '/posts/2019-01-03-2018-top-tens/#songs');
  });

  it('turns a link to the posts folder into the archive', () => {
    assert.equal(sitePath('../posts/', 'pages'), '/posts/');
    assert.equal(sitePath('../posts', 'pages'), '/posts/');
  });

  it('serves other files from /content/, and leaves web addresses alone', () => {
    assert.equal(sitePath('../images/2014/04/poster.jpg', 'posts'), '/content/images/2014/04/poster.jpg');
    for (const href of ['https://e.com/a.md', 'mailto:a@b.c', '#top', '/already/']) assert.equal(sitePath(href, 'pages'), href);
  });
});

describe('views', () => {
  it('writes dates out in English', () => {
    assert.equal(formatDate('2025-12-27'), 'December 27, 2025');
    assert.equal(formatDate('2014-03-01'), 'March 1, 2014');
  });

  it('renders a page under its title, with its links pointed at the site', () => {
    const doc = parseFrontMatter('---\ntitle: About\n---\nSee [the media page](media.md).\n\n# Press\n');
    const view = pageView(doc);
    assert.equal(view.title, 'About');
    assert.match(view.html, /^<h1>About<\/h1>\n<p>See <a href="\/media\/">the media page<\/a>.<\/p>\n<h2>Press<\/h2>/);
  });

  it('shows when a post was posted, and when it was updated', () => {
    const doc = parseFrontMatter('---\ntitle: "A: post"\ndate: 2019-01-03\nupdated: 2020-01-04\n---\nHi\n');
    assert.match(postView(doc).html, /Posted <time datetime="2019-01-03">January 3, 2019<\/time>. Updated <time datetime="2020-01-04">January 4, 2020<\/time>/);
  });

  it('lists the posts by year, newest first', () => {
    const view = postsView({ posts: [
      { name: '2025-12-27-b', title: 'B', date: '2025-12-27' },
      { name: '2025-01-02-a', title: 'A', date: '2025-01-02' },
      { name: '2019-01-03-c', title: 'C & D', date: '2019-01-03' },
    ] });
    assert.deepEqual([...view.html.matchAll(/<h2>(\d+)<\/h2>/g)].map((m) => m[1]), ['2025', '2019']);
    assert.match(view.html, /<a href="\/posts\/2019-01-03-c\/">C &amp; D<\/a>/);
  });

  it('points a lost visitor to the songlist, at home, and to the posts', () => {
    const { html } = missingView();
    assert.match(html, /<a href="\/">songlist<\/a>/);
    assert.match(html, /<a href="\/posts\/">posts<\/a>/);
  });
});

describe('site.css', () => {
  it('keeps the hidden attribute hiding, whatever display a rule sets (#11)', () => {
    const css = fs.readFileSync(path.join(ROOT, 'site', 'css', 'site.css'), 'utf8');
    assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
  });
});

describe('the page shell', () => {
  it('has four menu links, with the songlist at home (ADR-009)', () => {
    const shell = fs.readFileSync(path.join(ROOT, 'site', 'index.html'), 'utf8');
    const menu = [...shell.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g)].map((m) => `${m[2]} ${m[1]}`);
    assert.deepEqual(menu, ['Songlist /', 'Shows /shows/', 'Photos /photos/', 'About /about/']);
    assert.match(shell, /<a class="site-logo" href="\/">/, 'the logo leads home, to the songlist');
  });

  it('credits SprayME and its licence, as the licence asks (ADR-007)', () => {
    const shell = fs.readFileSync(path.join(ROOT, 'site', 'index.html'), 'utf8');
    assert.match(shell, /SprayME<\/a> font is by Micha\u{142} Nowak/u);
    assert.match(shell, /<a href="https:\/\/creativecommons\.org\/licenses\/by-sa\/3\.0\/">CC BY-SA 3\.0<\/a>/);
    assert.match(fs.readFileSync(path.join(ROOT, 'site', 'fonts', 'README.md'), 'utf8'), /Attribution-ShareAlike 3\.0/);
  });
});

describe('buildIndex', () => {
  it('lists every page and post with its front matter', () => {
    assert.deepEqual(buildIndex(FIXTURE, { git: false }), {
      pages: [{ name: 'about', title: 'About', date: '2013-09-15', updated: '2021-11-13' }],
      posts: [{ name: '2026-01-02-first-post', title: 'First post: an example', date: '2026-01-02', updated: null }],
      songlist: { updated: null },
      thumbs: ['2026/01/flyer.png'],
    });
  });
});

describe('the dev server', () => {
  it('serves the shell for page paths, and files as they are', () => {
    const shell = path.join(DIRS.siteDir, 'index.html');
    assert.deepEqual(resolve('/', DIRS), { status: 200, file: shell });
    assert.deepEqual(resolve('/posts/2026-01-02-first-post/?x=1', DIRS), { status: 200, file: shell });
    assert.deepEqual(resolve('/css/site.css', DIRS), { status: 200, file: path.join(DIRS.siteDir, 'css', 'site.css') });
    assert.deepEqual(resolve('/content/pages/about.md', DIRS), { status: 200, file: path.join(FIXTURE, 'pages', 'about.md') });
    assert.deepEqual(resolve('/content/index.json', DIRS), { status: 200, index: true });
  });

  it('answers 404 for missing files, and never leaves its folders', () => {
    for (const url of ['/content/pages/missing.md', '/js/missing.js', '/content/..%2f..%2fpackage.json', '/content/%2e%2e/%2e%2e/package.json']) {
      assert.equal(resolve(url, DIRS).status, 404, url);
    }
  });

  describe('over HTTP', () => {
    let server;
    let base;
    before(async () => {
      server = createServer(DIRS);
      await new Promise((done) => server.listen(0, '127.0.0.1', done));
      base = `http://127.0.0.1:${server.address().port}`;
    });
    after(() => server.close());

    it('serves pages, content and the index with their types', async () => {
      const page = await fetch(`${base}/about/`);
      assert.equal(page.status, 200);
      assert.match(page.headers.get('content-type'), /^text\/html/);
      assert.match(await page.text(), /<main id="main"/);
      const index = await (await fetch(`${base}/content/index.json`)).json();
      assert.equal(index.posts[0].name, '2026-01-02-first-post');
      assert.equal((await fetch(`${base}/content/nope.md`)).status, 404);
    });

    it('serves the font as a font', async () => {
      const font = await fetch(`${base}/fonts/sprayme.woff`);
      assert.equal(font.status, 200);
      assert.equal(font.headers.get('content-type'), 'font/woff');
      assert.equal((await font.arrayBuffer()).byteLength, 17356);
    });
  });

  describe('the copy of the old site at /old/ (ADR-011)', () => {
    let oldDir;
    let dirs;
    let server;
    let base;
    // A made-up old page in iso-8859-1, so its é is the single byte 0xE9.
    const page = Buffer.from('<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">'
      + '<a href="http://www.karaokeunderground.com/photos.html">Photos</a> <a href="photos.html">again</a> caf\u{E9}', 'latin1');

    before(async () => {
      oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ku-old-'));
      fs.writeFileSync(path.join(oldDir, 'index.html'), page);
      fs.mkdirSync(path.join(oldDir, 'forum'));
      fs.writeFileSync(path.join(oldDir, 'forum', 'index.html'), 'news');
      fs.writeFileSync(path.join(oldDir, "trophy's6-16.html"), 'recap');
      dirs = { ...DIRS, oldDir };
      server = createServer(dirs);
      await new Promise((done) => server.listen(0, '127.0.0.1', done));
      base = `http://127.0.0.1:${server.address().port}`;
    });
    after(() => {
      server.close();
      fs.rmSync(oldDir, { recursive: true, force: true });
    });

    it('serves its files and folders, and nothing outside it', () => {
      const trophy = { status: 200, file: path.join(oldDir, "trophy's6-16.html"), old: true };
      assert.deepEqual(resolve('/old/', dirs), { status: 200, file: path.join(oldDir, 'index.html'), old: true });
      assert.deepEqual(resolve('/old/forum/', dirs), { status: 200, file: path.join(oldDir, 'forum', 'index.html'), old: true });
      assert.deepEqual(resolve("/old/trophy's6-16.html", dirs), trophy);
      assert.deepEqual(resolve('/old/trophy%27s6-16.html', dirs), trophy);
      for (const url of ['/old/missing.html', '/old/..%2f..%2fpackage.json', '/old/%2e%2e/%2e%2e/package.json']) {
        assert.equal(resolve(url, dirs).status, 404, url);
      }
    });

    it('adds a folder\u{2019}s slash, so the old pages\u{2019} relative links stay inside it', () => {
      assert.deepEqual(resolve('/old', dirs), { status: 301, location: '/old/' });
      assert.deepEqual(resolve('/old/forum', dirs), { status: 301, location: '/old/forum/' });
    });

    it('is just a missing page when there\u{2019}s no copy', () => {
      assert.deepEqual(resolve('/old/', DIRS), { status: 200, file: path.join(DIRS.siteDir, 'index.html') });
    });

    it('sends old pages without a charset, and keeps their links to the old domain inside /old/', async () => {
      const res = await fetch(`${base}/old/`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'text/html');
      assert.equal(res.headers.get('content-security-policy'), "default-src 'self' 'unsafe-inline' data:", 'nothing loads from other sites');
      const body = Buffer.from(await res.arrayBuffer());
      assert.match(body.toString('latin1'), /href="\/old\/photos\.html">Photos<\/a> <a href="photos\.html">/);
      assert.ok(body.includes(0xe9), 'the page keeps its own encoding');
      const redirect = await fetch(`${base}/old`, { redirect: 'manual' });
      assert.equal(redirect.status, 301);
      assert.equal(redirect.headers.get('location'), '/old/');
    });
  });
});
