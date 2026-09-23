import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkContent, htmlIn, referencesIn, garbled, isRealDate } from '../scripts/lib/check-content.js';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'content');
const messages = (problems) => problems.map((p) => `${p.file}${p.line ? `:${p.line}` : ''} ${p.message}`);

describe('checkContent on the example content folder', () => {
  it('passes with no errors or warnings, and counts everything', () => {
    const report = checkContent(FIXTURE, { minSongs: 1 });
    assert.deepEqual(messages(report.errors), []);
    assert.deepEqual(messages(report.warnings), []);
    assert.deepEqual(report.summary, {
      songlist: { songs: 4, unlisted: 1, themes: { sad: 2, scary: 2 }, tags: 1 },
      pages: 1,
      posts: 1,
      images: 2,
    });
  });

  it('fails a songlist that is shorter than a real one', () => {
    const report = checkContent(FIXTURE);
    assert.match(messages(report.errors).join('\n'), /songlist\.csv only 4 songs.*cut-off or filtered export/);
  });

  it('fails when there is no content folder', () => {
    assert.equal(checkContent(path.join(FIXTURE, 'missing')).errors.length, 1);
  });
});

describe('checkContent on broken copies of the example', () => {
  let dir;
  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ku-check-'));
  });
  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  /** Copies the example, applies the edits ({ file: text, or null to delete }), and checks it. */
  function check(edits) {
    const copy = fs.mkdtempSync(path.join(dir, 'case-'));
    fs.cpSync(FIXTURE, copy, { recursive: true });
    for (const [file, text] of Object.entries(edits)) {
      const p = path.join(copy, file);
      if (text === null) fs.rmSync(p);
      else fs.writeFileSync(p, text);
    }
    const report = checkContent(copy, { minSongs: 1 });
    return { errors: messages(report.errors).join('\n'), warnings: messages(report.warnings).join('\n') };
  }
  const songlist = (rows) => `Artist,Title,Album,Themes,Tags\n${rows.join('\n')}\n`;
  const post = (body, frontMatter = 'title: A post\ndate: 2026-01-02') => `---\n${frontMatter}\n---\n${body}\n`;

  it('fails a duplicate song, even with different case and quotes', () => {
    const { errors } = check({ 'songlist.csv': songlist(['Band,Don\u{2019}t Go,LP,,', 'band,don\'t go,LP,,']) });
    assert.match(errors, /songlist\.csv:3 this song is already on line 2/);
  });

  it('fails a blank Artist or Title', () => {
    const { errors } = check({ 'songlist.csv': songlist([',Song,LP,,', 'Band,,LP,,']) });
    assert.match(errors, /:2 the Artist is blank/);
    assert.match(errors, /:3 the Title is blank/);
  });

  it('fails themes separated by commas, and "unlisted" in Tags', () => {
    const { errors } = check({ 'songlist.csv': songlist(['Band,Song,LP,"sad, scary",', 'Band,Other,LP,,unlisted']) });
    assert.match(errors, /:2 Themes has a comma/);
    assert.match(errors, /:3 "unlisted" only works in the Themes column/);
  });

  it('fails text that was garbled by the wrong encoding', () => {
    const { errors } = check({ 'songlist.csv': songlist(['Bj\u{C3}\u{B6}rk,Song,LP,,']) });
    assert.match(errors, /:2 the text is garbled/);
  });

  it('fails a file that is not UTF-8', () => {
    const { errors } = check({ 'songlist.csv': Buffer.from('Artist,Title,Album,Themes,Tags\nBj\xF6rk,Song,LP,,\n', 'latin1') });
    assert.match(errors, /songlist\.csv:2 the file isn't saved as UTF-8/);
  });

  it('warns about a theme on one song only, and a value spelled two ways', () => {
    const { errors, warnings } = check({ 'songlist.csv': songlist(['Band,One,LP,sda,Duet', 'Band,Two,LP,,duet']) });
    assert.equal(errors, '');
    assert.match(warnings, /:2 the theme "sda" is on this song only/);
    assert.match(warnings, /Tags spells one value 2 ways: "Duet" \(line 2\) and "duet" \(line 3\)/);
  });

  it('fails raw HTML in a post, but allows code, autolinks and escapes', () => {
    const { errors } = check({
      'posts/2026-01-02-first-post.md': post('Line one<br>\n`<div>` and <https://example.com> and \\<b> and <3'),
    });
    assert.match(errors, /2026-01-02-first-post\.md:5 "<br>" is HTML/);
    assert.equal(errors.split('\n').length, 1);
  });

  it('fails a table and a reference-style link, which the renderer has no rules for', () => {
    const { errors } = check({ 'posts/2026-01-02-first-post.md': post('| a | b |\n|---|:-:|\n[text][ref]\n\n[ref]: https://e.com') });
    assert.match(errors, /:6 this is a table/);
    assert.match(errors, /:9 the site can\u{2019}t show reference-style links/u);
    assert.equal(errors.split('\n').length, 2);
  });

  it('fails a link or image to a file that does not exist, or has the wrong case', () => {
    const { errors } = check({
      'posts/2026-01-02-first-post.md': post('![Flyer](../images/2026/01/Flyer.png)\n[About](../pages/missing.md)'),
    });
    assert.match(errors, /:5 \.\.\/images\/2026\/01\/Flyer\.png doesn't exist/);
    assert.match(errors, /:6 \.\.\/pages\/missing\.md doesn't exist/);
  });

  it('fails paths from the site root or outside the content folder', () => {
    const { errors } = check({ 'pages/about.md': post('[a](/images/2026/01/flyer.png) [b](../../README.md)', 'title: About') });
    assert.match(errors, /starts with \//);
    assert.match(errors, /points outside the content folder/);
  });

  it('warns about an image with no alt text, and an image from another site', () => {
    const { errors, warnings } = check({
      'posts/2026-01-02-first-post.md': post('![](../images/2026/01/flyer.png)\n![A photo](https://example.com/a.jpg)'),
    });
    assert.equal(errors, '');
    assert.match(warnings, /:5 an image has no alt text/);
    assert.match(warnings, /:6 an image from another site/);
  });

  it('fails a post whose file name and date disagree, and an unknown field', () => {
    const { errors } = check({ 'posts/2026-01-02-first-post.md': post('Hi', 'title: A post\ndate: 2026-01-03\nauthor: Me') });
    assert.match(errors, /the file name says 2026-01-02, but the date says 2026-01-03/);
    assert.match(errors, /"author" isn't a front matter field/);
  });

  it('fails a date that is not on the calendar, and an old_url used twice', () => {
    const { errors } = check({ 'pages/about.md': post('Hi', 'title: About\ndate: 2026-02-30\nold_url: /?p=1') });
    assert.match(errors, /date "2026-02-30" isn't a date/);
    assert.match(errors, /old_url \/\?p=1 is already used by/);
  });

  it('fails a missing songlist and an empty image, and warns about files the site does not use', () => {
    const { errors, warnings } = check({ 'songlist.csv': null, 'images/site/logo.png': '', 'notes.txt': 'hi', 'images/site/logo.svg': '<svg/>' });
    assert.match(errors, /songlist\.csv the songlist is missing/);
    assert.match(errors, /images\/site\/logo\.png the file is empty/);
    assert.match(warnings, /notes\.txt the site doesn't use this/);
    assert.match(warnings, /logo\.svg the site doesn't show this kind of file/);
  });
});

describe('htmlIn', () => {
  it('finds tags and comments', () => {
    assert.deepEqual(htmlIn('a<br>b <div class="x"> </p> <!-- c -->'), ['"<br>"', '"<div class="x">"', '"</p>"', '"<!-- c -->"']);
    assert.deepEqual(htmlIn('text <iframe src="x"'), ['"<iframe…"']);
  });

  it('ignores code spans, escapes, autolinks, email links and "<3"', () => {
    assert.deepEqual(htmlIn('`<div>` \\<b> <https://example.com/a> <me@example.com> <3'), []);
  });
});

describe('referencesIn', () => {
  it('finds links, images with their alt text, and reference definitions', () => {
    assert.deepEqual(referencesIn('[a](x.md) ![Alt text](../images/a.png "Title")'), [
      { image: false, alt: null, target: 'x.md' },
      { image: true, alt: 'Alt text', target: '../images/a.png' },
    ]);
    assert.deepEqual(referencesIn('[name]: ../pages/about.md'), [{ image: false, alt: null, target: '../pages/about.md', definition: true }]);
  });

  it('reads parentheses and angle brackets in targets, and skips escaped brackets', () => {
    assert.deepEqual(referencesIn('[w](https://en.wikipedia.org/wiki/Wire_(band)) [s](<a b.md>) \\[not](a link\\]'), [
      { image: false, alt: null, target: 'https://en.wikipedia.org/wiki/Wire_(band)' },
      { image: false, alt: null, target: 'a b.md' },
    ]);
  });

  it('finds the image inside a linked image', () => {
    const refs = referencesIn('[![Flyer](../images/a.png)](https://example.com)');
    assert.deepEqual(refs.map((r) => [r.image, r.target]), [
      [true, '../images/a.png'],
      [false, 'https://example.com'],
    ]);
  });
});

describe('garbled', () => {
  it('passes real accented text and curly quotes', () => {
    assert.equal(garbled('Bj\u{F6}rk \u{2013} H\u{FC}sker D\u{FC} \u{2019}n\u{2019} \u{2026}'), null);
  });

  it('catches mis-decoded UTF-8, lost characters and control characters', () => {
    assert.match(garbled('Bj\u{C3}\u{B6}rk'), /garbled/);
    assert.match(garbled('Don\u{E2}\u{20AC}\u{2122}t'), /garbled/);
    assert.match(garbled('Bj\u{FFFD}rk'), /lost/);
    assert.match(garbled('a\u{7}b'), /control character/);
  });
});

describe('isRealDate', () => {
  it('accepts real YYYY-MM-DD dates only', () => {
    assert.equal(isRealDate('2024-02-29'), true);
    assert.equal(isRealDate('2026-02-29'), false);
    assert.equal(isRealDate('2026-02-30'), false);
    assert.equal(isRealDate('2026-2-3'), false);
    assert.equal(isRealDate(undefined), false);
  });
});
