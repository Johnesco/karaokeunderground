# ADR-010: A public preview on GitHub Pages, kept out of search
**Status:** Accepted · **Date:** 2026-09-24 · **Issue(s):** [#27](https://github.com/Johnesco/karaokeunderground/issues/27)
## Context
The prototype runs only on John's machine, and he wants it online to show and check. ADR-001 chose Netlify for the real site, pending the owner's agreement, and neither Netlify's free plan nor GitHub Pages can password-protect a preview. The content is the owner's, and already public on their own site. A GitHub project page lives under a subfolder, `/karaokeunderground/`, but the site links from the root.
## Decision
Serve the prototype as a public preview on GitHub Pages, at `johnesco.github.io/karaokeunderground/`, from the public repo. A GitHub Actions workflow checks out the code and the content repo, which becomes public, runs `npm test`, builds with a dependency-free script and deploys: on a push, daily to pick up content changes, and by hand. The site learns a base path from where its scripts load, so it works under the subfolder and still at `/` locally. The build writes a page shell at every page and post address, a 404 page, `noindex` in every page so search engines leave it out, and a line marking it as a prototype preview, linking to the official site. The real site stays ADR-001's decision, and the owner's.

The workflow is [`.github/workflows/pages.yml`](../../.github/workflows/pages.yml), and the build is [`scripts/build-site.js`](../../scripts/build-site.js), `npm run build`. The base path lives in [`site/js/router.js`](../../site/js/router.js): every address on the site comes from `siteUrl()` or `sitePath()`, and the stylesheet's `url()`s are relative to it. The content repo went public after a scan of its whole history found no phone numbers, email addresses, logins or plugin versions.

## Consequences

**Positive**

- **Online without John's machine,** for the owner and anyone John shows it to.
- **The same gate as ever.** The workflow runs `npm test` before every deploy, so a failed check leaves the last good preview up.
- **Real pages at real addresses.** Every page and post answers 200 with its own shell, old paths like `/calendar/` answer and move on, and a missing page answers 404.
- **The site works under any base path,** which costs nothing locally and which a Netlify subfolder or any other host could use too.
- **Content changes reach the preview daily,** or at once when the workflow is run by hand.

**Negative / accepted tradeoffs**

- **It's public.** Anyone with the address can see it before the owner has agreed. `noindex` keeps it out of search, and the line on every page says what it is, but nothing stops a link being shared.
- **The content repo is public too,** history and all. The scan found nothing personal, and the content was already on the owner's site.
- **`robots.txt` can't help.** Search engines read it only at the root of johnesco.github.io, which this repo doesn't control, so the `noindex` tag does the job alone.
- **A content change waits up to a day,** unless someone runs the workflow by hand. The content repo can't start this repo's workflow without a token.

**Future revisit triggers**

- The owner agrees to the revamp: the real site moves to the host they choose (ADR-001), and the preview can go.
- The owner objects to a public preview: turn Pages off, and make the content repo private again.
