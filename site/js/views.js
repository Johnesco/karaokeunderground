/**
 * The views: each turns core files into a page title and the HTML for <main>.
 * They're plain functions, with no browser APIs, so the tests can run them.
 */

import { renderMarkdown, escapeHtml } from './markdown.js';
import { sitePath } from './router.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 2025-12-27 -> "December 27, 2025". Fixed English, whatever the browser's language. */
export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Markdown from a page or post, with its links pointed at the site and its headings under the page title. */
export function markdownHtml(body, from) {
  const map = (href) => sitePath(href, from);
  return renderMarkdown(body, { headingOffset: 1, link: map, image: map });
}

const time = (iso) => `<time datetime="${escapeHtml(iso)}">${formatDate(iso)}</time>`;

export function pageView(doc) {
  const title = doc.data.title;
  return { title, html: `<h1>${escapeHtml(title)}</h1>\n${markdownHtml(doc.body, 'pages')}` };
}

export function postView(doc) {
  const { title, date, updated } = doc.data;
  const edited = updated && updated !== date ? `. Updated ${time(updated)}` : '';
  return {
    title,
    html: `<article class="post">\n<h1>${escapeHtml(title)}</h1>\n<p class="meta">Posted ${time(date)}${edited}</p>\n`
      + `${markdownHtml(doc.body, 'posts')}</article>\n<p class="back"><a href="/posts/">All posts</a></p>\n`,
  };
}

function postItem(post) {
  return `<li><a href="/posts/${post.name}/">${escapeHtml(post.title)}</a> ${time(post.date)}</li>\n`;
}

/** Every post, newest first, under a heading for each year. */
export function postsView(index) {
  let html = '<h1>Posts</h1>\n';
  let year = null;
  for (const post of index.posts) {
    const y = post.date.slice(0, 4);
    if (y !== year) {
      if (year) html += '</ul>\n';
      html += `<h2>${y}</h2>\n<ul class="post-list">\n`;
      year = y;
    }
    html += postItem(post);
  }
  if (year) html += '</ul>\n';
  return { title: 'Posts', html };
}

export function missingView() {
  return {
    title: 'Page not found',
    html: '<h1>Page not found</h1>\n<p>There\u{2019}s no page at this address. Try the <a href="/">songlist</a> or the <a href="/posts/">posts</a>.</p>\n',
  };
}

export function errorView() {
  return {
    title: 'Something went wrong',
    html: '<h1>Something went wrong</h1>\n<p>This page didn\u{2019}t load. Check your connection, then reload the page.</p>\n',
  };
}
