import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontMatter } from '../site/js/front-matter.js';

describe('parseFrontMatter', () => {
  it('reads the fields, the body and the line the body starts on', () => {
    const doc = parseFrontMatter('---\ntitle: About\ndate: 2013-09-15\nold_url: /?page_id=6\n---\nHello\n');
    assert.deepEqual(doc.data, { title: 'About', date: '2013-09-15', old_url: '/?page_id=6' });
    assert.equal(doc.body, 'Hello\n');
    assert.equal(doc.bodyLine, 6);
  });

  it('reads double-quoted values, with \\" and \\\\ inside', () => {
    const doc = parseFrontMatter('---\ntitle: "KU in June: \\"four\\" shows \\\\ more"\n---\n');
    assert.equal(doc.data.title, 'KU in June: "four" shows \\ more');
  });

  it("reads single-quoted values, with '' for a quote", () => {
    assert.equal(parseFrontMatter("---\ntitle: 'It''s: here'\n---\n").data.title, "It's: here");
  });

  it('skips blank lines and comments, and reads CRLF files', () => {
    const doc = parseFrontMatter('---\r\n\r\n# a comment\r\ntitle: About\r\n---\r\nBody\r\n');
    assert.deepEqual(doc.data, { title: 'About' });
    assert.equal(doc.body, 'Body\n');
  });

  it('reads an empty value as an empty string', () => {
    assert.equal(parseFrontMatter('---\nupdated:\n---\n').data.updated, '');
  });

  it('asks for quotes around a value that YAML would read as something else', () => {
    for (const value of ['KU in June: four shows', 'Tonight #1', '[draft]', '*starred*']) {
      assert.throws(() => parseFrontMatter(`---\ntitle: ${value}\n---\n`), { name: 'FrontMatterError', line: 2 });
    }
  });

  it('reports a file with no front matter', () => {
    assert.throws(() => parseFrontMatter('# About\n'), { name: 'FrontMatterError', line: 1 });
  });

  it('reports front matter that never ends', () => {
    assert.throws(() => parseFrontMatter('---\ntitle: About\n'), { name: 'FrontMatterError', line: 1 });
  });

  it('reports a line that is not a field, a repeated field and an unclosed quote, each on its line', () => {
    assert.throws(() => parseFrontMatter('---\ntitle About\n---\n'), { line: 2 });
    assert.throws(() => parseFrontMatter('---\ntitle: A\ntitle: B\n---\n'), { line: 3 });
    assert.throws(() => parseFrontMatter('---\ndate: 2026-01-01\ntitle: "open\n---\n'), { line: 3 });
  });

  it('reports an escape it does not know, and text after a closing quote', () => {
    assert.throws(() => parseFrontMatter('---\ntitle: "a\\nb"\n---\n'), { line: 2 });
    assert.throws(() => parseFrontMatter('---\ntitle: "a" b\n---\n'), { line: 2 });
  });
});
