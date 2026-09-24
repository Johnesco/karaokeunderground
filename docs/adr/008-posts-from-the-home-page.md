# ADR-008: Posts are reached from the home page, not the menu
**Status:** Accepted · **Date:** 2026-09-24 · **Issue(s):** [#24](https://github.com/Johnesco/karaokeunderground/issues/24)
## Context
The menu runs to seven links, and John wants less on screen. The old site's menu had six, with no Posts. The home page already lists the five latest posts and links to all of them, and the logo, on every page, leads home.
## Decision
Posts leaves the menu, and the home page is the way to the posts: its latest five, then a link to all of them. The logo is the link home on every page, so it's marked as the current page on the home page, and its touch target is at least 44px. Post pages keep their "All posts" link at the end, and every post address still works.

## Consequences

**Positive**

- **A shorter menu,** the old site's six links. On a 320px phone it fits in two rows instead of three, so the header there drops from 149px to 105px.
- **The news is on the front page,** a logo's touch from every page.

**Negative / accepted tradeoffs**

- **The archive is a step further away:** home first, then "All 46 posts". A reader already in a post still has the "All posts" link at its end.
- **Nothing in the menu marks a post page's section** any more.

**Future revisit triggers**

- The home page gets the owner's intro (#17) or the shows (#12), and the latest posts need a new place on it.
