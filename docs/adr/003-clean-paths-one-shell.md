# ADR-003: Clean paths, served by one page shell
**Status:** Proposed · **Date:** 2026-09-23 · **Issue(s):** [#13](https://github.com/Johnesco/karaokeunderground/issues/13)
## Context
[ADR-001](001-static-netlify-core-files.md) renders every page in the browser from the core files, and the old site's query-string URLs need new homes that people can share, bookmark and be redirected to for years ([#14](https://github.com/Johnesco/karaokeunderground/issues/14)). The site is previewed on John's machine until Netlify is set up.
## Decision
Every page gets a clean path, like `/songlist/`, `/about/` or `/posts/2025-12-27-sad-songs-only-2025/`. One `index.html` reads the path and renders the matching core file. On Netlify, a single rewrite rule sends any path without a file to that shell. Locally, a small dependency-free Node server does the same on :8001. Links load pages normally, with no client-side routing.
