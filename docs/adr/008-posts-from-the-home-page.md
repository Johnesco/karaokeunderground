# ADR-008: Posts are reached from the home page, not the menu
**Status:** Proposed · **Date:** 2026-09-24 · **Issue(s):** [#24](https://github.com/Johnesco/karaokeunderground/issues/24)
## Context
The menu runs to seven links, and John wants less on screen. The old site's menu had six, with no Posts. The home page already lists the five latest posts and links to all of them, and the logo, on every page, leads home.
## Decision
Posts leaves the menu, and the home page is the way to the posts: its latest five, then a link to all of them. The logo is the link home on every page, so it's marked as the current page on the home page, and its touch target is at least 44px. Post pages keep their "All posts" link at the end, and every post address still works.
