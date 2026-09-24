/**
 * The site's paths (ADR-003, ADR-009). Every page has a clean path, and one
 * page shell, index.html, renders them all:
 *
 *   /                 the songlist, which is the home page (ADR-009)
 *   /<name>/          a page, from content/pages/<name>.md, like /about/
 *   /posts/           the post archive
 *   /posts/<name>/    a post, from content/posts/<name>.md
 *
 * Links in pages and posts point at files, so they read well on GitHub too:
 * about.md, ../posts/<name>.md, ../images/2014/04/poster.jpg, and ../posts/
 * for the archive. sitePath() turns them into the site's paths.
 */

const NAME = '[a-z0-9]+(?:-[a-z0-9]+)*';

// The songlist lives at / (ADR-009). Every other page lives at /<name>/.
const pagePath = (name) => (name === 'songlist' ? '/' : `/${name}/`);

// Pages folded into others when the site regrouped (ADR-009): their old paths land on the page that took them in.
const MERGED = { calendar: 'shows', contact: 'about', media: 'about' };

/**
 * Which view a path shows, and its canonical form (with the trailing slash).
 *
 * @param {string} pathname location.pathname
 * @returns {{ view: 'page' | 'posts' | 'post' | 'missing', name?: string, path?: string }}
 */
export function route(pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return { view: 'missing' };
  }
  if (path === '/' || path === '/index.html') return { view: 'page', name: 'songlist', path: '/' };
  if (/^\/posts\/?$/.test(path)) return { view: 'posts', path: '/posts/' };
  let m = new RegExp(`^/posts/(${NAME})/?$`).exec(path);
  if (m) return { view: 'post', name: m[1], path: `/posts/${m[1]}/` };
  m = new RegExp(`^/(${NAME})/?$`).exec(path);
  if (m) {
    const name = MERGED[m[1]] ?? m[1];
    return { view: 'page', name, path: pagePath(name) };
  }
  return { view: 'missing' };
}

/**
 * Where a link or image in a page or post points on the site.
 *
 * @param {string} href as written in the Markdown
 * @param {'pages' | 'posts'} from the folder of the file it's in
 */
export function sitePath(href, from) {
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(href) || href.startsWith('/') || href.startsWith('#') || href === '') return href;
  const cut = href.search(/[?#]/);
  const file = cut === -1 ? href : href.slice(0, cut);
  const suffix = cut === -1 ? '' : href.slice(cut);
  const resolved = normalize(`${from}/${file}`);
  let m = new RegExp(`^pages/(${NAME})\\.md$`).exec(resolved);
  if (m) return `${pagePath(m[1])}${suffix}`;
  m = new RegExp(`^posts/(${NAME})\\.md$`).exec(resolved);
  if (m) return `/posts/${m[1]}/${suffix}`;
  if (resolved === 'posts') return `/posts/${suffix}`; // ../posts/, the archive
  return `/content/${resolved}${suffix}`;
}

/** Resolves . and .. in a path relative to the content folder. */
function normalize(path) {
  const out = [];
  for (const part of path.split('/')) {
    if (part === '..') out.pop();
    else if (part !== '.' && part !== '') out.push(part);
  }
  return out.join('/');
}
