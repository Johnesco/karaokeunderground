# ADR-005: The Photos page: a gallery from the content, and an Instagram card
**Status:** Accepted · **Date:** 2026-09-23 · **Issue(s):** [#18](https://github.com/Johnesco/karaokeunderground/issues/18)
## Context
The old Photos page showed an Instagram feed until its account connection lapsed, then nothing. Instagram can't be framed whole (its profile pages send `X-Frame-Options: DENY`), the owner's show photos sit in the content unshown, and at full size they're about 20 MB, too much for a phone at a bar.
## Decision
`pages/photos.md` lists its photos, one Markdown image per line, with each description as its alt text. The site shows them as a grid of small copies, and each opens the full photo. The small copies live in `images/thumbs/`, at the same paths as their originals, made by a local script. Where a photo has no small copy, the grid shows the original. A new front matter field, `instagram`, names the account, and the page shows it as a card linking to Instagram. Nothing from Instagram loads.

The view is [`site/js/photos-page.js`](../../site/js/photos-page.js), and the script is [`scripts/make-thumbnails.py`](../../scripts/make-thumbnails.py). The script makes each copy 480 pixels on its shorter side, turns it the right way up, and strips its metadata, so no camera or location data goes with it. Rerunning it gives the same bytes. The content index lists the copies at `/content/index.json`, so the page knows which photos have one.

## Consequences

**Positive**

- **Nothing to break.** No account connection and no third-party script, so the page can't go blank the way the old one did, and Instagram can't track the visitors.
- **Light on phones and on credits.** The 19 photos come to 838 KB as small copies, against 19.3 MB at full size.
- **Every photo is described.** The description lives next to the photo in the Markdown, and the content check warns about one with no alt text.
- **The owner's own photos,** chosen by them for the old slideshow, rather than whatever Instagram shows that week.

**Negative / accepted tradeoffs**

- **Adding a photo takes two steps:** upload it, then add its line with a description. That's one more than dropping it into a folder, which was the plan until writing the description turned out to need a place.
- **Small copies need a script someone runs.** Until then, a new photo shows at full size in the grid. [#16](https://github.com/Johnesco/karaokeunderground/issues/16), resizing images for the web, may replace the script with something automatic.
- **The card shows no posts.** It's a link. Showing the latest posts would need the owner's account connected to a widget service.

**Future revisit triggers**

- The owner wants their latest Instagram posts on the page. That's a feed widget, with their account connected and a third-party script: a new ADR.
- #16 settles how images get resized.

## Options considered

- **Chosen Instagram posts as official embeds (rejected for now).** They'd show real posts, but someone would have to pick each one, and Instagram's script would run, even if only on a tap.
- **A live feed widget such as Behold or LightWidget (rejected).** Automatic, but it needs a Business or Creator account connected to a service and a script on every visit. A lapsed connection is how the old page broke.
- **An iframe of the profile (impossible).** Instagram refuses to be framed.

Claude recommended the gallery and card, and John chose it.
