# ADR-007: On wide screens, the menu stands in a left column, set in SprayME
**Status:** Proposed · **Date:** 2026-09-24 · **Issue(s):** [#23](https://github.com/Johnesco/karaokeunderground/issues/23)
## Context
On wide screens the menu runs long across the top. The old site stood its logo and menu in a 250px column on the left, with the menu in ALL AGES, a demo font whose licence allows personal use only. Its other font, SprayME, made the page titles: it's Creative Commons BY-SA 3.0, free for any use with a credit, and 17 KB, but it covers only letters and digits. The site is still a prototype.
## Decision
From 64rem (1024px) wide, the logo and menu stand in a column on the left that stays in view as the page scrolls, with the menu set in SprayME. Phones and tablets keep the top menu in the system font, and titles keep it too, since they use characters SprayME lacks. The font file lives in `site/fonts/` with a note of its licence, and the footer credits it.
