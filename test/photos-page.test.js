import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { galleryOf, photosView, instagramUrl } from '../site/js/photos-page.js';
import { parseFrontMatter } from '../site/js/front-matter.js';

const doc = (frontMatter, body) => parseFrontMatter(`---\ntitle: Photos\n${frontMatter}---\n${body}`);

describe('galleryOf', () => {
  it('takes the images that sit alone on their lines, and leaves the rest as Markdown', () => {
    const { photos, rest } = galleryOf('Intro text.\n\n![A \\*star\\* singer](../images/2018/01/a.jpg)\n![B](<../images/b c.jpg>)\\\nNot ![inline](x.jpg) here');
    assert.deepEqual(photos, [
      { alt: 'A *star* singer', src: '../images/2018/01/a.jpg' },
      { alt: 'B', src: '../images/b c.jpg' },
    ]);
    assert.equal(rest, 'Intro text.\n\nNot ![inline](x.jpg) here');
  });
});

describe('photosView', () => {
  it('shows the small copy of a photo where there is one, linked to the full photo', () => {
    const view = photosView(doc('', '![One](../images/2018/01/a.jpg)\n\n![Two](../images/2018/01/b.jpg)\n'), ['2018/01/a.jpg']);
    assert.equal(view.title, 'Photos');
    assert.equal(view.wide, true);
    assert.match(view.html, /<li><a href="\/content\/images\/2018\/01\/a.jpg"><img src="\/content\/images\/thumbs\/2018\/01\/a.jpg" alt="One" loading="lazy"><\/a><\/li>/);
    assert.match(view.html, /<li><a href="\/content\/images\/2018\/01\/b.jpg"><img src="\/content\/images\/2018\/01\/b.jpg" alt="Two" loading="lazy">/);
    assert.equal(view.html.match(/<li>/g).length, 2);
  });

  it('shows the Instagram card only when the front matter names an account', () => {
    const view = photosView(doc('instagram: karaokeunderground\n', ''));
    assert.match(view.html, /<p class="social-card-title" id="social-card-title">@karaokeunderground on Instagram<\/p>/);
    assert.match(view.html, /<a class="button" href="https:\/\/www.instagram.com\/karaokeunderground\/">Follow on Instagram<\/a>/);
    assert.doesNotMatch(photosView(doc('', '')).html, /Instagram/);
  });

  it('loads nothing from Instagram: no script, no frame', () => {
    assert.doesNotMatch(photosView(doc('instagram: karaokeunderground\n', '![x](../images/a.jpg)\n')).html, /<(script|iframe)/);
  });

  it('drops a photo whose address would run a script', () => {
    assert.doesNotMatch(photosView(doc('', '![x](javascript:alert)\n')).html, /javascript|<li>/);
  });
});

describe('instagramUrl', () => {
  it("is the account's address", () => {
    assert.equal(instagramUrl('karaokeunderground'), 'https://www.instagram.com/karaokeunderground/');
  });
});
