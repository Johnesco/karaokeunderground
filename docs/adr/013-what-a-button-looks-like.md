# ADR-013: What a button looks like, starting with the songlist's lists and column names
**Status:** Proposed · **Date:** 2026-09-27 · **Issue(s):** none yet. This stub is the ticket for the decision
## Context
John, 2026-09-27: the column names Artist, Title and Album sort the songlist, but they don't look like they can be tapped, and the site has no written rule for what a button looks like. Most controls are already outlined boxes at least 44px tall and black inside: the list buttons, the search box, "↑ Top" and the Photos page's "Follow on Instagram". A picked one gets a white border and bold text. The column names are plain words. Whatever replaces them stays white on black, as the owner asked, reads on a phone with no hover, and has a punk spirit rather than a corporate one.
## Decision
Not made yet. John asked for mockups, and chooses from them: ten for the list buttons and ten for the column names, from minimal to maximal, after a first round of four, then ten more for the column names as pills, and four ways for pill 2 to show which part of a song is which. They're in [`013-button-mockups.html`](013-button-mockups.html), which is also published as a claude.ai artifact, and listed below. When John picks, this ADR records the choice as the site's button rule, which the Photos page's Instagram button and "↑ Top" then follow too.

## What any choice has to keep

- White on black, with no white panels. A near-black fill is fine.
- Touch targets at least 44px tall, and control borders at 3:1 or more on black.
- The pick shows by a shape, like a bar, an X, a circle or a stamp, so it never relies on brightness alone and needs no hover.
- The controls underneath stay the same: radio buttons for the lists, and pressed buttons for the sort ([ADR-006](006-sort-by-moving-a-column.md)). It's styling, so screen readers hear what they do now.
- A new font costs 15 to 40 KB on phones, which load none today, and needs a licence note, as SprayME has ([ADR-007](007-left-menu-in-sprayme.md)). Lists 1, 3, 7 and 9, sort 1, 4, 5, 6 and 8, and pills 1 to 9 need no new font.
- Outlined type (lists 8, sort 10) and heavy tilts (lists 4 and 10) get a check at arm's length on a phone in a dark bar before they're chosen.

## The options

**First round,** for the column names: as they are now, plain text, bold when picked. A: bordered, like the list buttons, in one row instead of two. B: sort arrows, as in a spreadsheet. C: underlined, like links.

**List buttons:** 1 slashes, with a thick bar under the pick. 2 typewriter ballot, an X marks the pick. 3 label-maker tape, with an edge and a star. 4 ransom note, cut out and boxed. 5 stencil, with a sprayed circle. 6 setlist, with an arrow at the pick. 7 ticket stubs, punched and tilted. 8 poster type, solid against outlined. 9 sewn-on patches, with a safety pin. 10 cut-and-paste flyer, tilted with a scrawled note.

**Column names:** 1 brackets, with a caret. 2 scribbled arrows. 3 label-maker tape. 4 stompboxes, the pick's light on. 5 tape-deck keys, the pick pressed in. 6 folder tabs, the pick open to the list. 7 circled in marker. 8 numbered, tap one to make it number 1. 9 rubber stamp. 10 poster type.

**Column names as pills:** 1 outlined, with an arrow on the pick. 2 sort signs, the up-and-down arrows apps use, pointing one way on the pick. 3 check chips, after a Sort label. 4 A to Z, a tag on the pick. 5 a switch, the pick in a pill of its own. 6 a pointer, the pick pointing down into the list. 7 capsules, split into the name and the sort sign. 8 patches, stitched, the pick safety-pinned. 9 stickers, tilted, the pick with a star. 10 marker-drawn, the pick gone over twice. If a pill wins, the list buttons and the site's other buttons round off to match.

**Pill 2 as a key to the songs.** On a phone each song takes two lines, the first two columns with a dash between them and the third below in grey, and today's column names pile up the same way, so they read as a key. Pills in one row lose that (2a). 2b keeps the pills in the shape of a song, two on the top line and the third below, about 100px tall against 90px today. 2c keeps one row, dressed like the parts: bold, a dash, plain, then the album's small grey. 2d keeps one row and shows the words "by" and "from", which screen readers already hear, in every song. On wide screens each pill heads its own column, so the question is only on phones.

**Pairs:** the label-maker tape (lists 3 with sort 3), poster type (lists 8 with sort 10), cut and paste (the ransom note, lists 4, with the rubber stamp, sort 9), patches (lists 9 with pill 8), and drawn by hand (the sprayed circle, lists 5, with pill 10).
