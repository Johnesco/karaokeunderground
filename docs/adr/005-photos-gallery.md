# ADR-005: The Photos page: a gallery from the content, and an Instagram card
**Status:** Proposed · **Date:** 2026-09-23 · **Issue(s):** [#18](https://github.com/Johnesco/karaokeunderground/issues/18)
## Context
The old Photos page showed an Instagram feed until its account connection lapsed, then nothing. Instagram can't be framed whole (its profile pages send `X-Frame-Options: DENY`), the owner's show photos sit in the content unshown, and at full size they're about 20 MB, too much for a phone at a bar.
## Decision
`pages/photos.md` lists its photos, one Markdown image per line, with each description as its alt text. The site shows them as a grid of small copies, and each opens the full photo. The small copies live in `images/thumbs/`, at the same paths as their originals, made by a local script. Where a photo has no small copy, the grid shows the original. A new front matter field, `instagram`, names the account, and the page shows it as a card linking to Instagram. Nothing from Instagram loads.
