# ADR-002: The formats of the core files
**Status:** Accepted · **Date:** 2026-09-23 · **Issue(s):** [#10](https://github.com/Johnesco/karaokeunderground/issues/10)
## Context
[ADR-001](001-static-netlify-core-files.md) puts everything that changes in one `content/` folder, which the browser reads and a Node check validates, and leaves the exact formats to #10. The owner will edit these files from a spreadsheet or on GitHub, every page reads them, and the old site's songs, pages, posts and images all have to come across.
## Decision
`songlist.csv` gets five columns: Artist, Title, Album, Themes and Tags. Themes and Tags hold values separated by semicolons, and the theme `unlisted` hides a song from every list. Pages and posts are plain Markdown with no raw HTML, and front matter gives the title, date, last update and old URL. Images keep WordPress's year/month folders under `images/`. The shows stay in `shows.json` until we decide how events get updated. `npm test` runs a dependency-free Node check that enforces all of it.

The full formats are in [CLAUDE.md → Data Formats](../../CLAUDE.md#data-formats). [`scripts/lib/check-content.js`](../../scripts/lib/check-content.js) enforces them.

## Consequences

**Positive**

- **A themed list is a word in a cell.** December's sad list no longer gets copied by hand, and a song keeps its themes through every re-export.
- **Songs can be hidden without being deleted.** `unlisted` takes a song off every list, for example while its video is fixed. Removing the word puts it back on all its lists.
- **Nothing unsafe gets published by accident.** With no HTML in the Markdown, the site can escape everything, and third-party players appear only if the site adds them on purpose. The check rejects a column the site doesn't use, because everything in `songlist.csv` is public once deployed.
- **The files read well on GitHub.** Front matter is plain YAML, which GitHub shows as a table, and relative image paths display in GitHub's preview.
- **Old image links need one redirect rule,** because `images/` keeps the paths of `/wp-content/uploads/`.
- **The check and the site can't disagree.** The CSV, front matter and songlist parsers use no Node APIs, so the browser can run the same code.

**Negative / accepted tradeoffs**

- **The owner's spreadsheet gains two columns,** and every export has to keep them: the check refuses a file without them. That's on purpose. Silently losing `unlisted` would bring hidden songs back.
- **Embeds are links for now.** Nine YouTube players and an Instagram post became links until the site adds players on purpose.
- **Markdown has a few conventions to learn:** a backslash for a line break, quotes around a title that has a colon, and a post's file name starting with its date.
- **The owner's export drops accented letters,** and a missing letter isn't something the check can see. It has to be fixed where the export happens ([#3](https://github.com/Johnesco/karaokeunderground/issues/3)).
- **The shows have no core file yet,** so the homepage and calendar ([#12](https://github.com/Johnesco/karaokeunderground/issues/12)) wait for the decision on events.

**Future revisit triggers**

- The owner interview ([#3](https://github.com/Johnesco/karaokeunderground/issues/3)) shows the owner won't keep the extra columns.
- Tags are still empty when the site launches. Drop the column.
- We decide how events get updated. The shows get a format, in an amendment or a new ADR.

## Options considered

- **A separate `themes.csv` (rejected).** The master list would stay exactly as exported. But two files would have to be kept in step, and renaming a song would break its theme row.
- **Themed lists as posts only (rejected).** There'd be nothing new to maintain, but December's list would keep being copied by hand, the chore the [audit](../legacy-site/audit.md#recommendation) flagged.
- **A sixth column, Hidden, instead of `unlisted` (rejected).** Its meaning would be clearer, but it's one more column for the owner.
- **Commas between values (rejected).** They're easier to read, but a cell with two values would need CSV quotes, which trips up edits on GitHub.
- **Markdown that allows HTML (rejected).** It would keep the embeds as they were, but the site would have to sanitize HTML, and third-party players would load by default.
- **A folder of images per post (rejected).** It's easier to browse, but 57 files would be renamed, every reference rewritten, and old image URLs would need a lookup table.
- **Converting the shows now (deferred).** How events get updated isn't decided, and the shows that share one event link wait with that decision.

Claude recommended a Themes column. John added the Tags column and the `unlisted` theme, and chose to hold the shows back.
