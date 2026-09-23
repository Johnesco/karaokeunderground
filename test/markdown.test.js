import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, safeUrl } from '../site/js/markdown.js';

// The renderer was also checked against markdown-it on every page and post, and
// on 36,000 random strings; these cases pin down what the content relies on.

const md = (text, options) => renderMarkdown(text, options);
const inline = (text) => md(text).replace(/^<p>|<\/p>\n$/g, '');

describe('renderMarkdown: blocks', () => {
  it('renders paragraphs, which blank lines separate', () => {
    assert.equal(md('a\nb\n\nc'), '<p>a\nb</p>\n<p>c</p>\n');
  });

  it('renders ATX and setext headings, moved down by headingOffset', () => {
    assert.equal(md('# A\n## B #', { headingOffset: 1 }), '<h2>A</h2>\n<h3>B</h3>\n');
    assert.equal(md('A\n===\nB\n---'), '<h1>A</h1>\n<h2>B</h2>\n');
  });

  it('renders tight and loose lists, and an ordered list start', () => {
    assert.equal(md('- a\n- b'), '<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n');
    assert.equal(md('3. a\n4. b'), '<ol start="3">\n<li>a</li>\n<li>b</li>\n</ol>\n');
    assert.equal(md('- a\n\n- b'), '<ul>\n<li><p>a</p>\n</li>\n<li><p>b</p>\n</li>\n</ul>\n');
    assert.equal(md('- a\n  - b\n- c'), '<ul>\n<li>a<ul>\n<li>b</li>\n</ul>\n</li>\n<li>c</li>\n</ul>\n');
  });

  it('continues a paragraph on a lazy line, but never makes it a heading', () => {
    assert.equal(md('> a\nb'), '<blockquote>\n<p>a\nb</p>\n</blockquote>\n');
    assert.equal(md('- a\n==='), '<ul>\n<li>a\n===</li>\n</ul>\n');
  });

  it('renders quotes, code and rules', () => {
    assert.equal(md('> a\n>\n> b'), '<blockquote>\n<p>a</p>\n<p>b</p>\n</blockquote>\n');
    assert.equal(md('```\n<b> & *\n```'), '<pre><code>&lt;b&gt; &amp; *\n</code></pre>\n');
    assert.equal(md('    code'), '<pre><code>code\n</code></pre>\n');
    assert.equal(md('***'), '<hr>\n');
  });

  it('keeps an escaped number as text, the way the converter writes a ranked list', () => {
    assert.equal(md('Songs\\\n1\\. Portions For Foxes\\\n5\\. Hybrid Moments'), '<p>Songs<br>\n1. Portions For Foxes<br>\n5. Hybrid Moments</p>\n');
  });
});

describe('renderMarkdown: inline', () => {
  it('follows CommonMark for emphasis', () => {
    assert.equal(inline('*a* **b** ***c***'), '<em>a</em> <strong>b</strong> <em><strong>c</strong></em>');
    assert.equal(inline('*a **b** c*'), '<em>a <strong>b</strong> c</em>');
    assert.equal(inline('snake_case_name and a * b'), 'snake_case_name and a * b');
    assert.equal(inline('*foo*bar and _foo_bar'), '<em>foo</em>bar and _foo_bar');
  });

  it('strikes through ~~text~~, and leaves other tildes alone', () => {
    assert.equal(inline('~~a~~ ~b~ ~~~c~~~'), '<s>a</s> ~b~ ~~~c~~~');
  });

  it('renders the Sing The Unsung lines: a struck song, then who sang it, all bold italic', () => {
    assert.equal(
      inline('***~~ALL \u{2013} Postage~~ Nick \u{2013} 1/5***'),
      '<em><strong><s>ALL \u{2013} Postage</s> Nick \u{2013} 1/5</strong></em>',
    );
  });

  it('makes a hard break from a backslash or two spaces at the end of a line', () => {
    assert.equal(inline('a\\\nb'), 'a<br>\nb');
    assert.equal(inline('a  \nb'), 'a<br>\nb');
    assert.equal(inline('a\n   b'), 'a\nb');
  });

  it('renders links and images, and maps their addresses', () => {
    const options = { link: (h) => `/mapped/${h}`, image: (s) => `/img/${s}` };
    assert.equal(
      md('[About](about.md "Info") ![A flyer](a.png)', options),
      '<p><a href="/mapped/about.md" title="Info">About</a> <img src="/img/a.png" alt="A flyer" loading="lazy"></p>\n',
    );
  });

  it('keeps escaped characters and entities in alt text', () => {
    assert.equal(inline('![IMG\\_3103 &amp; more](a.png)'), '<img src="a.png" alt="IMG_3103 &amp; more" loading="lazy">');
  });

  it('allows one link per link text, and brackets in addresses', () => {
    assert.equal(inline('[a [b](c) d](e)'), '[a <a href="c">b</a> d](e)');
    assert.equal(inline('[Wire](https://en.wikipedia.org/wiki/Wire_(band))'), '<a href="https://en.wikipedia.org/wiki/Wire_(band)">Wire</a>');
  });

  it('escapes HTML instead of rendering it', () => {
    assert.equal(inline('<b>hi</b> & <script>x</script>'), '&lt;b&gt;hi&lt;/b&gt; &amp; &lt;script&gt;x&lt;/script&gt;');
  });

  it('drops unsafe addresses, keeping the text', () => {
    assert.equal(inline('[x](javascript:alert(1)) [y](JaVaScRiPt:1)'), 'x y');
    assert.equal(inline('![a cat](data:image/png;base64,AA)'), 'a cat');
  });

  it('renders code spans, autolinks and entities', () => {
    assert.equal(inline('`*a*` <https://e.com> <me@e.com> &copy; &#8217; &nope;'),
      '<code>*a*</code> <a href="https://e.com">https://e.com</a> <a href="mailto:me@e.com">me@e.com</a> \u{A9} \u{2019} &amp;nope;');
  });
});

describe('safeUrl', () => {
  it('allows web, mail and phone links, and paths', () => {
    for (const url of ['https://e.com', 'http://e.com', 'mailto:a@b.c', 'tel:+15125551234', '/about/', '../images/a.jpg', '#top', '']) {
      assert.equal(safeUrl(url), url);
    }
  });

  it('refuses other schemes', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///c:/x']) {
      assert.equal(safeUrl(url), null);
    }
  });
});
