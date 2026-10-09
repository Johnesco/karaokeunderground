import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontMatter } from '../site/js/front-matter.js';
import { homeView } from '../site/js/home-page.js';

const doc = parseFrontMatter(`---
title: "You've found us"
old_url: /
---

![A singer with the mic](../images/2018/01/a.jpg)

![A crowd singing along](../images/2016/05/b.jpg)

![Nothing](javascript:alert)

Punk and indie video karaoke. [Request a song!](about.md)
`);

describe('the home page (ADR-015)', () => {
  it('shows each image alone on its line in the slideshow, with only the first one heard', () => {
    const { html } = homeView(doc, ['2018/01/a.jpg']);
    const slides = [...html.matchAll(/<li class="montage-slide[^"]*"([^>]*)><img src="([^"]+)" alt="([^"]*)"/g)].map((m) => [m[2], m[3], m[1]]);
    assert.deepEqual(slides, [
      ['/content/images/thumbs/2018/01/a.jpg', 'A singer with the mic', ''],
      ['/content/images/2016/05/b.jpg', 'A crowd singing along', ' aria-hidden="true"'],
    ], 'the small copy where there is one, and no unsafe address');
    assert.match(html, /class="montage-slide is-shown"/);
  });

  it('has a pause button, hidden until the script starts the slideshow', () => {
    const { html } = homeView(doc);
    assert.match(html, /<button type="button" class="montage-toggle" hidden><span class="montage-toggle-label">Pause<\/span><span class="visually-hidden"> the slideshow<\/span><\/button>/);
  });

  it('puts the intro under its heading, and leaves the tab to the site name', () => {
    const view = homeView(doc);
    assert.equal(view.title, null);
    assert.match(view.html, /<div class="intro">\n<h1>You&#39;ve found us<\/h1>\n<p>Punk and indie video karaoke\. <a href="\/about\/">Request a song!<\/a><\/p>/);
    assert.doesNotMatch(view.html, /<p><img/, 'the photos stay out of the intro');
  });

  it('leaves the slideshow out when the page has no photos', () => {
    assert.doesNotMatch(homeView(parseFrontMatter('---\ntitle: Hi\n---\n\nHello.\n')).html, /montage/);
  });
});
