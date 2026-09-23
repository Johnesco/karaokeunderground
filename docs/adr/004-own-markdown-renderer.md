# ADR-004: Our own Markdown renderer
**Status:** Accepted · **Date:** 2026-09-23 · **Issue(s):** [#13](https://github.com/Johnesco/karaokeunderground/issues/13)
## Context
Pages and posts are plain Markdown with no HTML ([ADR-002](002-core-file-formats.md)), and the browser renders them ([ADR-001](001-static-netlify-core-files.md)). A library would be a dependency to keep updated, while the content uses a small, known part of Markdown.
## Decision
A small renderer in plain JS, with no dependencies, covers the Markdown ADR-002 allows: paragraphs, headings, lists, quotes, code, rules, emphasis, strikethrough, links, images and line breaks. It escapes everything else. The site and the tests share it, and it's checked against markdown-it on every page and post. The content check rejects what it can't render.

It lives in [`site/js/markdown.js`](../../site/js/markdown.js). For emphasis and links it follows CommonMark's delimiter and bracket algorithm, not a regex. Raw HTML comes out as text, and a link or image whose address uses any scheme but http, https, mailto or tel loses its address. The content check rejects tables and reference-style links.

## Consequences

**Positive**

- **No dependency.** Nothing to update, audit or vendor, in keeping with the rest of the tooling.
- **Safe by construction.** It escapes as it renders, so nothing an upload contains can run in a visitor's browser, even if an upload skips the local gate.
- **Proven against a reference.** All 52 pages and posts render the same as with markdown-it (CommonMark with strikethrough), character by character, formatting and links included. So do 35,978 of 36,000 random strings of Markdown syntax. The other 22 fall into four groups: runs of three or more tildes, which stay literal as in GFM; a code span after an unclosed `[`, where it follows CommonMark's precedence rule; a quote marker indented four spaces, which CommonMark reads as code; and empty list items separated by blank lines.
- **It fixes a markdown-it quirk.** markdown-it drops escaped characters from image descriptions, and this renderer keeps them, as CommonMark specifies.

**Negative / accepted tradeoffs**

- **We maintain it.** A Markdown feature the owner wants later (tables, footnotes) is our code to write, and until then the check rejects it.
- **Edge cases differ from other renderers,** in the corners listed above. None of them appears in the content, and the converter never writes them.

**Future revisit triggers**

- The owner needs tables or other Markdown the renderer doesn't cover: extend it with tests, or reconsider a library.
- A git-based editor (ADR-001) writes Markdown the check rejects.

## Options considered

- **Vendor markdown-it (rejected).** Full CommonMark with nothing to write, but a pinned third-party file to keep updated, with its alt-text quirk.

John chose our own renderer, the recommended option.
