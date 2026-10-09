/**
 * The Photos page (ADR-005, #18): a grid of the photos pages/photos.md lists,
 * one Markdown image per line, and a card for the Instagram account its front
 * matter names. The grid shows the small copy of each photo from
 * images/thumbs/ where there is one, and a tap opens the full photo. Nothing
 * from Instagram loads: its pages can't be framed, and the card is a link.
 */

import { escapeHtml, safeUrl } from './markdown.js';
import { markdownHtml } from './views.js';
import { sitePath, siteUrl } from './router.js';

// An image alone on its line, ![description](path), with an optional line-break backslash.
const IMAGE_LINE = /^ {0,3}!\[((?:\\.|[^\]\\])*)\]\((?:<([^>]*)>|([^\s)]+))\)[ \t]*\\?[ \t]*$/;

/** A page's photos, one per line, and the rest of its Markdown. */
export function galleryOf(body) {
  const photos = [];
  const rest = [];
  for (const line of body.split('\n')) {
    const m = IMAGE_LINE.exec(line);
    if (m) photos.push({ alt: m[1].replace(/\\([!-/:-@[-`{-~])/g, '$1'), src: m[2] ?? m[3] });
    else rest.push(line);
  }
  return { photos, rest: rest.join('\n') };
}

/**
 * Where a photo in a page lives on the site, and the copy to show: its small
 * copy in images/thumbs/ where there is one, or else the photo itself.
 *
 * @param {string} src as written in the Markdown
 * @param {Set<string>} small the small copies there are, as paths under images/thumbs/
 * @returns {{ full: string, shown: string } | null} null for an address that isn't safe
 */
export function photoUrls(src, small) {
  const full = safeUrl(sitePath(src, 'pages'));
  if (full === null) return null;
  const images = siteUrl('/content/images/');
  const rel = full.startsWith(images) ? full.slice(images.length) : null;
  return { full, shown: rel && small.has(rel) ? `${images}thumbs/${rel}` : full };
}

export function instagramUrl(handle) {
  return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
}

/**
 * @param {{ data: object, body: string }} doc pages/photos.md
 * @param {string[]} thumbs the small copies there are, as paths under images/thumbs/
 */
export function photosView(doc, thumbs = []) {
  const { photos, rest } = galleryOf(doc.body);
  const small = new Set(thumbs);
  const handle = doc.data.instagram;
  const card = handle
    ? '<aside class="social-card" aria-labelledby="social-card-title">\n'
      + `<p class="social-card-title" id="social-card-title">@${escapeHtml(handle)} on Instagram</p>\n`
      + `<p><a class="button" href="${escapeHtml(instagramUrl(handle))}">Follow on Instagram</a></p>\n</aside>\n`
    : '';
  const items = photos.flatMap(({ alt, src }) => {
    const urls = photoUrls(src, small);
    if (urls === null) return [];
    return [`<li><a href="${escapeHtml(urls.full)}"><img src="${escapeHtml(urls.shown)}" alt="${escapeHtml(alt)}" loading="lazy"></a></li>\n`];
  });
  const html = `<h1>${escapeHtml(doc.data.title)}</h1>\n${card}${markdownHtml(rest, 'pages')}`
    + (items.length ? `<ul class="gallery" aria-label="Photos">\n${items.join('')}</ul>\n` : '');
  return { title: doc.data.title, html, wide: true };
}
