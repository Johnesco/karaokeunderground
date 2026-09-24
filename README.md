# Karaoke Underground

A revamp of [karaokeunderground.com](https://karaokeunderground.com), the site for Karaoke Underground: punk and indie video karaoke in Austin, Texas. It's being built for the site's owner, to offer as a replacement for the current site.

> **Status: building.** The new site renders every page, post and song from its core files, phone-first, with a searchable, sortable songlist and its themed lists. It's previewed locally for now. The live site is the owner's WordPress install, and it stays as it is unless the owner adopts this revamp. Nothing in this repo is deployed yet.

## Where things are

- **The diary:** [`docs/diary.md`](docs/diary.md). How the revamp is being made: what we found, what we chose and why
- **Work:** [open issues](https://github.com/Johnesco/karaokeunderground/issues). Every change starts as one
- **Decisions:** [`docs/adr/`](docs/adr/README.md). [ADR-001](docs/adr/001-static-netlify-core-files.md) chose the stack: a static site on Netlify that reads a few core files in the browser. [ADR-002](docs/adr/002-core-file-formats.md) set the formats of those files, [ADR-003](docs/adr/003-clean-paths-one-shell.md) the site's paths, and [ADR-004](docs/adr/004-own-markdown-renderer.md) how Markdown becomes HTML
- **The site:** [`site/`](site/). One page shell renders every path, with no framework and no build step
- **The old site:** [`docs/legacy-site/`](docs/legacy-site/audit.md). What it has and does, and every URL the revamp must redirect
- **Changes:** [`CHANGELOG.md`](CHANGELOG.md)

## Previewing and checking

- `npm run dev` previews the site at http://127.0.0.1:8001/.
- `npm test` runs the unit tests, then checks the core files: the songlist, the pages and posts, and the images.

Both need Node 22 or later and nothing else, and neither uses the network.

The core files are the owner's content, so they live in a private repo that's cloned into `work/`. Without them, the unit tests still run, the check fails and says why, and the preview has nothing to show.

## Process

This project runs on [sdlc-baseline](https://github.com/Johnesco/sdlc-baseline) (profile `core`): every change starts as a ticket, gets decided before it's built, and is verified by a person before it counts as done.
