# ADR-011: A private, frozen copy of the pre-2013 site, shown locally at /old/
**Status:** Accepted · **Date:** 2026-09-25 · **Issue(s):** [#29](https://github.com/Johnesco/karaokeunderground/issues/29)
## Context
The site from before WordPress, 2004 to 2013, is still live on the owner's host: 30 pages, including photo write-ups of shows from 2004–05 and the 2013 songlist, and 413 photos (72 MB). Its homepage is gone from the server, but the Wayback Machine has it. The 2026-09-23 snapshot took only the WordPress site, and it stays frozen as it was taken (#7). The old site disappears when the domain moves. Whether it becomes a public archive is the owner's call, and its old contact page shows the hosts' personal details.
## Decision
A new script, `scripts/snapshot-legacy-site.py`, copies every page and file of the old site that still answers, byte for byte. It starts from the pages in `urls.csv` and follows their links, and restores the homepage from the Wayback Machine's last copy before WordPress. It writes to `snapshots/<date>-pre-wordpress/`, which is gitignored and frozen read-only like the first snapshot, and it never writes over an existing copy. The dev server shows the newest copy at `/old/`. It serves the files as they are, but sends the pages without a charset, so their own declaration applies, and points their absolute links to the old domain back into `/old/`. The pages may load nothing from other sites, because they call on services long gone, like a comments script whose domain someone else now holds. Nothing links there, and the build leaves it out, so it never reaches the public preview.

## Consequences

**Positive**

- **KU's first years survive the move.** The photo write-ups from 2004–05, the 2013 songlist and the old news page stay on John's machine after the domain moves, byte for byte, with a record of where each file came from.
- **Nothing goes public.** The copy sits in a gitignored folder, the build never sees it, and the dev server listens on 127.0.0.1 only, so the old contact page's personal details go nowhere.
- **The old site works as it did.** Its pages link to each other under `/old/` in their own encoding, and its lost homepage is back from the Wayback Machine.
- **Looking at it calls on nobody.** No request goes to YouTube or to the dead comments service, so nobody else's code runs beside the private copy. Their old Flash players, which no browser plays now, show as empty boxes.
- **The owner's call stays open.** If they want a public archive (the audit's question 13), the copy is ready to curate, without the contact page.

**Negative / accepted tradeoffs**

- **Only on John's machine.** The owner can't see `/old/` on the preview. Showing it to them means John's laptop now, or a curated public archive later.
- **A second 72 MB,** outside any repo. Backing it up is John's job, as with the first snapshot.
- **The dev server knows the old domain.** It points the old pages' absolute links back into `/old/`, a small rewrite that runs nowhere else.
- **A record, not a mirror.** If the owner changes the old files before the move, this copy won't show it. The script takes a new dated copy instead.

**Future revisit triggers**

- The owner answers question 13: publish a curated archive, or let the old site go.
- The domain moves and the old files go with the old host, so this becomes the only copy.
