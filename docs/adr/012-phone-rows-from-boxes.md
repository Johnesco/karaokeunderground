# ADR-012: Phone rows built from boxes, so sorting stays quick
**Status:** Rejected · **Date:** 2026-09-26 · **Issue(s):** [#31](https://github.com/Johnesco/karaokeunderground/issues/31)
## Context
A sort replaces all 1,853 rows of the songlist (ADR-006). In the first measurements, in the preview's phone mode, a tap on a column name took 320 to 730ms, nearly all of it removing the old rows and laying out the new ones: the sort itself takes under 7ms. On phones each row is text that flows inside the row, the first two columns on a line with a dash between them and the third below, and those measurements made rows like that look expensive.
## Decision
Proposed: on phones, build each row from boxes, with CSS flex. The first two columns would share a line when they fit, with the dash between them, and the third would sit on its own line below. When the first two didn't fit on one line, the second would start a line of its own instead of wrapping after the dash: 117 of the 1,853 rows at 375px. Wide screens would keep their grid.

## Why it was rejected

Built and measured again, with the old rows and the new ones taking turns, the two take the same time. In the phone mode a tap took a median 137ms with the old rows and 143ms with boxes, and removing and laying out the rows cost the same. The earlier gap came from always measuring the old rows first, at a moment when the machine happened to run slower. The change was taken back before it shipped, and the rows stay as they were.

The measurements that did alternate point elsewhere. Drawing only the first screenful of rows takes 5 to 10ms at 811px, against 22 to 57ms for the whole list, so drawing the rest after the first screen is where a quicker sort would come from.
