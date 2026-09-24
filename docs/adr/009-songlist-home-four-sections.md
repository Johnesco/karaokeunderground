# ADR-009: The songlist is the home page, and the site has four sections
**Status:** Accepted · **Date:** 2026-09-24 · **Issue(s):** [#25](https://github.com/Johnesco/karaokeunderground/issues/25) · **Supersedes:** [ADR-008](008-posts-from-the-home-page.md)
## Context
The posts weigh on the site: 27 of the 46 are notices for past shows, 9 are song lists the songlist now holds, and the newest post that isn't a list is from March 2022. The songlist is what fans come for. Three pages are thin: Contact is 30 words, Media is a press list, and the "shows monthly, book us" paragraph appears on both About and Calendar. ADR-008 made the home page the way to the posts, hours earlier.
## Decision
The songlist is the home page, at `/`, and the menu has four links: Songlist, Shows, Photos and About. Calendar becomes Shows, which says the booking paragraph once and links to the posts for past shows. About takes in Contact, as "Get in touch", and Media, as "In the press", and the songlist page carries the "request a song" line. The posts stay as an archive at `/posts/`, linked from Shows and About, and every post keeps its address. The old paths `/songlist/`, `/calendar/`, `/contact/` and `/media/` lead to their new places. A content link to the archive is written `../posts/`, a path to the posts folder, like every other content link.

The router ([`site/js/router.js`](../../site/js/router.js)) sends `/` and `/songlist/` to the songlist page, keeps the search and lists in the address, and maps the merged pages' old paths. In the content, `calendar.md` became `shows.md`, and `contact.md` and `media.md` were folded into `about.md`. The one sentence dropped, About's pointer to the Media page, pointed at a press list that now follows on the same page.

## Consequences

**Positive**

- **The songlist is the first thing anyone sees,** and nothing on the home page goes stale.
- **A shorter menu:** four links fit on one row on a 375px phone, so the header there drops from 105px to 61px, and the first song moves up 44px.
- **Each fact once:** the booking pitch lives on Shows, and the press and contact details on About.
- **Nothing lost:** every post keeps its address, and the old page paths land on their new homes. Links in the posts to the songlist and its lists now go straight to `/`.

**Negative / accepted tradeoffs**

- **The posts are two clicks away,** through Shows or About, and the archive still mixes show notices with lists and news. Sorting them into kinds would need a new front matter field.
- **About is long,** since the press list runs to 21 links. "Get in touch" comes before it, so the contact details stay near the top.
- **ADR-008 lasted a few hours.** It moved the posts to the home page, and this moved the songlist there instead, once the posts' age was clear.

**Future revisit triggers**

- The shows (#12) arrive: the next show may belong on the songlist page too.
- The redirects (#14): the old site's Calendar, Contact and Media pages now point at Shows and About.
- #17, the old home page's intro, has no separate home page to go on any more.
