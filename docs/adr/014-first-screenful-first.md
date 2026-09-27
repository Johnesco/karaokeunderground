# ADR-014: Draw the first screenful of songs first, and the rest after
**Status:** Accepted · **Date:** 2026-09-27 · **Issue(s):** [#31](https://github.com/Johnesco/karaokeunderground/issues/31)
## Context
A tap on a column name sorts the songlist in under 7ms, then replaces all 1,853 rows at once (ADR-006). In the preview a tap took 30 to 200ms at 811px and 110 to 180ms in the phone mode, depending on how busy the machine was, and a real phone's slower processor adds to that. But after a sort the list starts just under the controls, where only a screenful shows: 12 songs on a phone 812px tall, and 16 in the preview at 810 by 746. Drawing a screenful took 5 to 10ms at 811px, against 22 to 57ms for the whole list, timed taking turns (the lesson of ADR-012). The page draws the whole list the same way when it opens, and an address with a sort in it, like `/?sort=title`, draws it twice, by artist and then by title.
## Decision
One function draws the rows, when the page opens and after every sort. It writes the first screenful straight away, so it shows in the next frame, and the rest after it in pieces of 400 rows, one per frame: each piece is a task of its own, queued once the frame before it is painted, so the page can answer a tap between pieces. The first screenful is as many songs as the window could hold if each took one line, 2.25rem: 23 on a phone 812px tall, 21 at 810 by 746 and 30 at 1080px. That's more than show, so the foot of the page stays out of sight until the rest arrives. It counts only the songs the list, tags and search let through, and rows for the others are drawn hidden, following whatever is picked when their piece is drawn. Only a new sort cancels the pieces still to come, and starts again in its own order. A search, a list or a tag picked meanwhile shows and hides the rows already drawn, and the pieces to come follow it. The status line counts every song, drawn or not, so its count is right from the start. When the page opens, it draws the list once, in the order and with the filters its address asks for. The split is a plain function the tests run. The change stays only if it shows the new order sooner, timed against the current drawing taking turns in one run, repeated, and compared by medians.

The drawing is in [`site/js/songlist-page.js`](../../site/js/songlist-page.js): `pieceEnds()` splits the rows, and `draw()`, in `enhanceSonglist()`, puts them on the page. The view writes the list empty.

**Building it found one more cost.** On a phone screen, taking out the 1,853 old rows took 30 to 40ms, against 2 to 8ms on a wide one, where each row is a grid. Removing rows the browser has laid out costs far more than letting go of their layout first. So `draw()` hides the list, and has the browser work out its style, before the old rows go, which brings that to 4 to 10ms. Timed three ways taking turns on the phone screen, the new order showed in a median 106ms with the old drawing, 52ms with a screenful first, and 30ms with the list hidden as well. On a wide screen the hiding changed nothing.

## Consequences

Timed in the preview's browser pane, in frames 811 by 746 and 375 by 812, old and new taking turns in one run of 12 rounds: 36 taps and 12 openings each. A phone's slower processor stretches every number, old and new alike.

**Positive**

- **The new order shows 2 to 5 times sooner.** From a tap to the paint of the new order, the median went from 54ms to 22ms at 811 by 746, and from 102ms to 21ms at 375 by 812. From far down the list on the phone screen, from 98ms to 20ms.
- **Nothing freezes the page.** No piece took more than 10ms. A frame took 50ms or more in 1 of 36 taps at 811 by 746 and in none at 375 by 812, where the old drawing had one in 16 and in all 36.
- **The page opens sooner.** From the files being read to the first paint, 49ms became 21ms at 811 by 746, and 47ms became 22ms at 375 by 812. With a sort in the address the list is drawn once, not twice: 84ms became 14ms, and 123ms became 16ms.
- **The count is right from the start.** The status line counts every song, drawn or not.

**Negative / accepted tradeoffs**

- **The whole list takes longer to be complete on wide screens:** a median 100ms after the tap, against 68ms, since the pieces go one a frame. On the phone screen it's a little sooner, 98ms against 113ms. Until then, find-in-page and screen readers reach only the rows drawn so far.
- **In a tab that isn't showing, the rest waits.** Browsers hold back frames there, so a list opened in a background tab fills in once the tab shows.
- **The view's HTML no longer holds the songs.** The page's script draws them, so the tests check the rows through `songItem()` and the split through `pieceEnds()`, and the browser checks cover the drawing.
- **The first screenful leans on the stylesheet.** 2.25rem is a row's padding and one line of text. If rows got shorter, the first screenful could fall short of the window, and the foot of the page would show for a frame.

**Future revisit triggers**

- The songlist grows far past its 1,853 songs, or a piece takes long enough on a phone to be felt.
- The rows' padding or line height changes.

## Options considered

- **The whole list at once (rejected).** The old way, and the simplest, but 54 to 106ms passed before the new order showed.
- **The rest in one piece after the first paint (rejected).** It would be one task of 22 to 57ms at 811px, straight after the first screenful, holding up the next tap.
- **Pieces measured in time, not rows (rejected).** Drawing until 8ms have passed suits any device, but most of a piece's cost comes after its task, in styling and layout, where a timer can't see it. The tests couldn't run it as a plain function either.
- **A fixed first screenful (rejected).** Forty rows, say, is simpler, but too many on a phone and too few on a tall or zoomed-out screen. The window's height costs nothing to read.
- **Reusing the old rows (rejected).** Rewriting rows in place saves removing and making them, but leaves rows in the old order until each is rewritten, which the ticket rules out.
- **Rows built from boxes ([ADR-012](012-phone-rows-from-boxes.md), rejected).** Timed taking turns, they were no faster.
