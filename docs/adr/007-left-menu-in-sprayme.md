# ADR-007: On wide screens, the menu stands in a left column, set in SprayME
**Status:** Accepted · **Date:** 2026-09-24 · **Issue(s):** [#23](https://github.com/Johnesco/karaokeunderground/issues/23)
## Context
On wide screens the menu runs long across the top. The old site stood its logo and menu in a 250px column on the left, with the menu in ALL AGES, a demo font whose licence allows personal use only. Its other font, SprayME, made the page titles: it's Creative Commons BY-SA 3.0, free for any use with a credit, and 17 KB, but it covers only letters and digits. The site is still a prototype.
## Decision
From 64rem (1024px) wide, the logo and menu stand in a column on the left that stays in view as the page scrolls, with the menu set in SprayME. Phones and tablets keep the top menu in the system font, and titles keep it too, since they use characters SprayME lacks. The font file lives in `site/fonts/` with a note of its licence, and the footer credits it.

## Consequences

**Positive**

- **The old site's look, where there's room for it.** From 1024px the logo and menu stand on the left as they used to, and the menu no longer runs across the top.
- **Always in reach.** The column stays in view all the way down the 1,853 songs.
- **Light.** The font is 17 KB, and phones never download it, since only wide screens use it.

**Negative / accepted tradeoffs**

- **Not the old menu font.** ALL AGES needs a commercial licence from its designer. If the owner gets one, it replaces SprayME in one line of CSS.
- **SprayME fits only plain words.** It has no accents, dashes or curly quotes, so titles stay in the system font.
- **A credit in every footer,** as the licence asks.

**Future revisit triggers**

- The owner licenses ALL AGES, or the design pass with the owner picks the fonts.
