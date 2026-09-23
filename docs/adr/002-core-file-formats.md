# ADR-002: The formats of the core files
**Status:** Proposed · **Date:** 2026-09-23 · **Issue(s):** [#10](https://github.com/Johnesco/karaokeunderground/issues/10)
## Context
[ADR-001](001-static-netlify-core-files.md) puts everything that changes in one `content/` folder, which the browser reads and a Node check validates, and leaves the exact formats to #10. The owner will edit these files from a spreadsheet or on GitHub, every page reads them, and the old site's songs, pages, posts and images all have to come across.
## Decision
`songlist.csv` gets five columns: Artist, Title, Album, Themes and Tags. Themes and Tags hold values separated by semicolons, and the theme `unlisted` hides a song from every list. Pages and posts are plain Markdown with no raw HTML, and front matter gives the title, date, last update and old URL. Images keep WordPress's year/month folders under `images/`. The shows stay in `shows.json` until we decide how events get updated. `npm test` runs a dependency-free Node check that enforces all of it.
