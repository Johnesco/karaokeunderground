# ADR-004: Our own Markdown renderer
**Status:** Proposed · **Date:** 2026-09-23 · **Issue(s):** [#13](https://github.com/Johnesco/karaokeunderground/issues/13)
## Context
Pages and posts are plain Markdown with no HTML ([ADR-002](002-core-file-formats.md)), and the browser renders them ([ADR-001](001-static-netlify-core-files.md)). A library would be a dependency to keep updated, while the content uses a small, known part of Markdown.
## Decision
A small renderer in plain JS, with no dependencies, covers the Markdown ADR-002 allows: paragraphs, headings, lists, quotes, code, rules, emphasis, strikethrough, links, images and line breaks. It escapes everything else. The site and the tests share it, and it's checked against markdown-it on every page and post. The content check rejects what it can't render.
