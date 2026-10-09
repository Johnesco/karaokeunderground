/**
 * The home page (ADR-015, #36): the old site's slideshow of photos from the
 * shows, then its intro, "You've found us". Both come from pages/home.md,
 * where each image alone on its line is a photo in the slideshow, as on the
 * Photos page, and the rest is the intro.
 *
 * The slideshow fades to the next photo every few seconds. A button pauses it
 * and plays it again (WCAG 2.2.2), it starts paused when the browser asks for
 * reduced motion, and screen readers hear only the photo on show.
 */

import { escapeHtml } from './markdown.js';
import { markdownHtml } from './views.js';
import { galleryOf, photoUrls } from './photos-page.js';

/** How long each photo shows, in milliseconds. */
export const INTERVAL = 5000;

/**
 * @param {{ data: object, body: string }} doc pages/home.md
 * @param {string[]} thumbs the small copies there are, as paths under images/thumbs/
 */
export function homeView(doc, thumbs = []) {
  const { photos, rest } = galleryOf(doc.body);
  const small = new Set(thumbs);
  const slides = photos.flatMap(({ alt, src }) => {
    const urls = photoUrls(src, small);
    return urls ? [{ alt, src: urls.shown }] : [];
  });
  const items = slides.map(({ alt, src }, i) => (i === 0
    ? `<li class="montage-slide is-shown"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="680" height="300"></li>\n`
    : `<li class="montage-slide" aria-hidden="true"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="680" height="300" loading="lazy" decoding="async"></li>\n`));
  const montage = items.length
    ? '<div class="montage" role="group" aria-roledescription="slideshow" aria-label="Photos from the shows">\n'
      + `<ul class="montage-slides">\n${items.join('')}</ul>\n`
      + '<button type="button" class="montage-toggle" hidden><span class="montage-toggle-label">Pause</span><span class="visually-hidden"> the slideshow</span></button>\n'
      + '</div>\n'
    : '';
  // The tab says just the site's name: the home page's heading is a greeting, not a name.
  return { title: null, enhance: enhanceHome, html: `${montage}<div class="intro">\n<h1>${escapeHtml(doc.data.title)}</h1>\n${markdownHtml(rest, 'pages')}</div>\n` };
}

/** Starts the slideshow, if there's more than one photo. */
export function enhanceHome(main) {
  const montage = main.querySelector('.montage');
  if (!montage) return;
  const slides = [...montage.querySelectorAll('.montage-slide')];
  if (slides.length < 2) return;
  const button = montage.querySelector('.montage-toggle');
  const label = button.querySelector('.montage-toggle-label');
  let at = 0;
  let timer = null;

  const next = () => {
    slides[at].classList.remove('is-shown');
    slides[at].setAttribute('aria-hidden', 'true');
    at = (at + 1) % slides.length;
    slides[at].classList.add('is-shown');
    slides[at].removeAttribute('aria-hidden');
  };
  const play = () => {
    timer = setInterval(next, INTERVAL);
    label.textContent = 'Pause';
  };
  const pause = () => {
    clearInterval(timer);
    timer = null;
    label.textContent = 'Play';
  };

  button.hidden = false;
  button.addEventListener('click', () => (timer ? pause() : play()));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) pause();
  else play();
}
