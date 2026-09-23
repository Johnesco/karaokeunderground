/**
 * The page shell's script (ADR-003): reads the path, fetches the core files it
 * needs, and renders the view into <main>. Links load pages normally; there's
 * no client-side routing.
 */

import { route } from './router.js';
import { parseFrontMatter } from './front-matter.js';
import { homeView, pageView, postView, postsView, missingView, errorView } from './views.js';

const SITE = 'Karaoke Underground';

class NotFound extends Error {}

async function fetchText(url) {
  const response = await fetch(url);
  if (response.status === 404) throw new NotFound(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.text();
}

const fetchIndex = async () => JSON.parse(await fetchText('/content/index.json'));

async function load(r) {
  switch (r.view) {
    case 'home': {
      const index = await fetchIndex();
      const hasIntro = index.pages.some((p) => p.name === 'home');
      return homeView(index, hasIntro ? parseFrontMatter(await fetchText('/content/pages/home.md')) : null);
    }
    case 'page':
      return pageView(parseFrontMatter(await fetchText(`/content/pages/${r.name}.md`)));
    case 'posts':
      return postsView(await fetchIndex());
    case 'post':
      return postView(parseFrontMatter(await fetchText(`/content/posts/${r.name}.md`)));
    default:
      return missingView();
  }
}

async function start() {
  const r = route(window.location.pathname);
  if (r.path && r.path !== window.location.pathname) {
    window.history.replaceState(null, '', r.path + window.location.search + window.location.hash);
  }
  for (const link of document.querySelectorAll('.menu a')) {
    if (link.getAttribute('href') === r.path) link.setAttribute('aria-current', 'page');
  }

  let view;
  try {
    view = await load(r);
  } catch (e) {
    if (!(e instanceof NotFound)) console.error(e);
    view = e instanceof NotFound ? missingView() : errorView();
  }
  document.title = view.title ? `${view.title} \u{00B7} ${SITE}` : SITE;
  document.getElementById('main').innerHTML = view.html;
}

start();
