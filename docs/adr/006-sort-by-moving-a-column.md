# ADR-006: Sort the songlist by moving a column to the front
**Status:** Accepted · **Date:** 2026-09-24 · **Issue(s):** [#22](https://github.com/Johnesco/karaokeunderground/issues/22)
## Context
The songlist shows the owner's order, by artist, but fans often remember a song's title and not who sang it, and some look for an album. John asked for a minimal way to sort by title or album, and designed it: touching a column's name moves that column to the front, with an animated shift, and the first column is bold, as Artist is now. Today the column names show only on desktops, and screen readers skip them.
## Decision
The column names, Artist, Title and Album, become the sort control, on phones too: three buttons in a group, with the pressed one bold. Picking one moves its column to the front of the header and of every song, and sorts the list A to Z by it. The other two keep their order, and ties go by the next column shown, then the file's order. There's no reverse order, so touching the first column again changes nothing. Sorting ignores case, accents and punctuation but not words, so "Zombies, The" stays under Z and a title starting with "The" stays under T, as in the owner's file. By artist, 16 of the 1,853 songs move from the file's order, all because of punctuation or case. The address keeps the sort (`?sort=title`), as it keeps the list and the search, and the status line says it. The shift slides for about a fifth of a second, and not at all for people who ask their system for reduced motion.

The view is [`site/js/songlist-page.js`](../../site/js/songlist-page.js). `sortSongs()` sorts, `columnsFor()` gives the columns' order, and `songItem()` writes a song in that order, all plain functions the tests run. On wide screens each column keeps its width wherever it goes, so the title always gets the most room, and the songs on screen slide with their columns. On a phone the first column shares the first line with the second, and the third sits below in grey. There the column names slide, and the songs on screen fade in, since a song that wraps as text has no column to slide along. A screen reader hears each song in the order shown, as "title, by artist, from album", from words hidden on screen.

## Consequences

**Positive**

- **No new controls.** The column names were already there on desktops. Now they're on phones too, and they sort.
- **Every order can be shared.** `/songlist/?theme=sad&sort=title` opens the Sad list sorted by title.
- **The owner's order stays.** Sorted by artist, the list keeps the file's order, except for 16 songs that move because of punctuation or case, like a title that starts with a bracket.
- **Quick.** Sorting all 1,853 songs takes about 44ms in the preview. The rows use `content-visibility: auto`, so the browser lays out only the songs near the screen, and the slide reads every position before it starts any animation.

**Negative / accepted tradeoffs**

- **No reverse order.** Z to A would need a second control, or a second meaning for a touch, and nobody asked for it.
- **Articles count.** A title starting with "The" sorts under T, as in the owner's file, where a library would file it under the next word. Ignoring articles would move 82 songs, mostly within one artist's songs.
- **The songs on screen change as the columns slide.** The list sorts in the same moment, so the slide shows which column moved, not where each song went.
- **A row the browser hasn't drawn yet counts as one row tall,** so the scroll bar can shift a little as long titles come into view.

**Future revisit triggers**

- People ask for Z to A, or for sorting by when a song was added.
- The owner wants articles ignored when sorting.
- The list grows far past its 1,853 songs, and sorting slows down on phones.

## Options considered

- **A "Sort by" menu (rejected).** A select box works, but it's one more control, and it doesn't show which column the order comes from.
- **Column heads that stay put, with an arrow on the sorted one (rejected).** That's the usual table pattern, but a phone shows no columns to touch, and John's design makes the sorted column lead each song.
- **Radio buttons for the three columns (rejected).** Radio buttons suit a choice of one, but these move when picked, and arrow keys would chase them around. Buttons with a pressed state keep the Tab order simple.

John designed the control. Claude worked out the details and the sorting rules, recorded above.
