# ADR-003: Clean paths, served by one page shell
**Status:** Accepted · **Date:** 2026-09-23 · **Issue(s):** [#13](https://github.com/Johnesco/karaokeunderground/issues/13)
## Context
[ADR-001](001-static-netlify-core-files.md) renders every page in the browser from the core files, and the old site's query-string URLs need new homes that people can share, bookmark and be redirected to for years ([#14](https://github.com/Johnesco/karaokeunderground/issues/14)). The site is previewed on John's machine until Netlify is set up.
## Decision
Every page gets a clean path, like `/songlist/`, `/about/` or `/posts/2025-12-27-sad-songs-only-2025/`. One `index.html` reads the path and renders the matching core file. On Netlify, a single rewrite rule sends any path without a file to that shell. Locally, a small dependency-free Node server does the same on :8001. Links load pages normally, with no client-side routing.

The paths are `/`, `/<page>/` for each file in `pages/`, `/posts/` for the archive and `/posts/<file>/` for each post. A link in Markdown points at the file, like `media.md` or `../images/2014/04/poster.jpg`, so it also works in GitHub's preview, and the site turns it into the path. The dev server builds `/content/index.json` from the pages' and posts' front matter, because a web host can't list a folder. The Netlify build will write the same file.

## Consequences

**Positive**

- **Addresses are readable and permanent.** Old URLs can redirect to paths like `/songlist/` ([#14](https://github.com/Johnesco/karaokeunderground/issues/14)), and a themed list has an address of its own: `/songlist/?theme=sad`.
- **A page the owner adds appears without code.** Any `pages/<name>.md` is served at `/<name>/`.
- **Pre-rendering stays open.** If search engines need HTML (ADR-001's revisit trigger), a build can write `/<page>/index.html` for each path, with no URL changes.
- **No client-side routing to get wrong.** Every link is a normal page load, so focus, scrolling, the back button and screen readers work as they do on any site.

**Negative / accepted tradeoffs**

- **A missing page answers 200.** The shell shows "Page not found", but the HTTP status is 200 (a "soft 404"), both from the dev server and from Netlify's rewrite. Pre-rendering would fix it.
- **Each page load fetches its Markdown after the shell.** It's small and fast locally, but it's one more request than static HTML.
- **The dev server has to be restarted** after a change to its own code in `scripts/`. Changes in `site/` and `work/content/` show on reload.

## Options considered

- **One HTML file per page, like the Austin Karaoke Directory (rejected).** It works on any static server with no rewrites, but pages and posts would carry query strings, like WordPress's.
- **Hash routes, like `/#/songlist` (rejected).** They work anywhere, but search engines ignore everything after the `#`, and redirects would point at fragments.

John chose clean paths, the recommended option.
