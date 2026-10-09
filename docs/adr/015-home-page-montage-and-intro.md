# ADR-015: A home page with the old site's photo slideshow and intro, and the songlist at /songlist/
**Status:** Accepted · **Date:** 2026-10-09 · **Issue(s):** [#36](https://github.com/Johnesco/karaokeunderground/issues/36), [#17](https://github.com/Johnesco/karaokeunderground/issues/17) · **Supersedes:** the home-page half of [ADR-009](009-songlist-home-four-sections.md)
## Context
ADR-009 made the songlist the home page, so the site opens on a search box and a table. The WordPress site opened differently. A slideshow of 8 photos from the shows, cropped to 680×300 by MetaSlider, came first. Then came the heading "You've found us" and two paragraphs about who KU is for and what it sings. Below those it listed the upcoming shows and the latest post. The intro is written into the theme's template, not WordPress's content, so the core files don't have it yet (#17). The 8 photos are the first 8 on the Photos page, which already has small copies of them and their alt text. John's call, 2026-10-09: bring back the old site's landing page, its photos and intro, and not the pre-2013 site's. The logo leads to it, and the songlist moves to the menu's first link.
## Decision
`/` is a home page, rendered from a new core file, `pages/home.md`, with `old_url: /`. It follows the Photos page's rule: each image alone on its line is a photo in the slideshow, with its description as the alt text. The rest is the intro, word for word as the old home page has it, under its title, "You've found us", as the `h1`. Then comes a big link to the songlist: the first link alone on its line in `home.md` is drawn large, and what follows it is small print. There the old intro's last line, "Don't see your favorite? Request a song!", now sits, under the songlist link and smaller, at John's request on 2026-10-09. The browser tab says just "Karaoke Underground". The slideshow shows the photos' small copies from `images/thumbs/`, cropped to the old 680×300 shape and at most 680px wide. It fades to the next photo every 5 seconds. A Pause button stops it, as WCAG 2.2.2 asks of anything that moves for more than 5 seconds, and the same button plays it again. When the browser asks for reduced motion, it starts paused. Only the photo on show is heard by screen readers.

The songlist moves to `/songlist/`, with its searches and lists in the address there. The logo leads home, and the menu keeps its four links, with Songlist first, leading to `/songlist/`. An address at `/` that carries a songlist search, like `/?theme=sad` from before this change, lands on the songlist with it. Content links to `songlist.md` follow the songlist to its new path. The upcoming shows that followed the intro wait for #12.

The router ([`site/js/router.js`](../../site/js/router.js)) maps the two paths. [`site/js/home-page.js`](../../site/js/home-page.js) renders the home page and runs the slideshow.

## Consequences

**Positive**

- **The site opens as the old one did:** photos of people singing, then who KU is for. A newcomer learns what it is before facing a search box.
- **The intro is a core file now** (#17), so the owner can edit it like any other page, and nothing in the code holds words that change.
- **Nothing to keep current on the home page.** The photos and intro are years old on the old site too. The shows, the part that changes, wait for #12.
- **Old songlist links still work.** `/?theme=sad` and the like, from the preview since ADR-009, land on the songlist with their list or search. Content links to `songlist.md` move with it.
- **The slideshow costs little:** 8 small copies, about 340 KB in all, and no library. MetaSlider and Nivo loaded jQuery.

**Negative / accepted tradeoffs**

- **The songlist is a tap further away,** though Songlist is the menu's first link, and fans often come for it. ADR-009 gave it the home page for that reason.
- **The small copies are 480px on their shorter side,** so on a wide screen the photos are a little soft at 680px, and a cropped portrait copy is softer still. Copies made for the slideshow's shape would be sharper, and #16 resizes the images.
- **The intro's artists differ from About's,** as on the old site (#17). Whether they should share one text is a question for the owner (#3).
- **The Pause button sits on the photo.** On a 320px phone it covers about a tenth of the photo, in its lower right corner, which is the cost of not adding a row under the slideshow.

**Future revisit triggers**

- The shows (#12): the old home page listed them under the intro, so the next show may belong here.
- The redirects (#14): `/` is the home page again, and the old `/?page_id=16` should go to `/songlist/`.
- The button rule (ADR-013): Pause should look like the site's other buttons, once there is a rule.
