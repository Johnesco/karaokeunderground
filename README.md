# Karaoke Underground

A revamp of [karaokeunderground.com](https://karaokeunderground.com), the site for Karaoke Underground: punk and indie video karaoke in Austin, Texas. It's being built for the site's owner, to offer as a replacement for the current site.

> **Status: the stack is chosen, and building is next.** The live site is the owner's WordPress install, and it stays as it is unless the owner adopts this revamp. Nothing in this repo is deployed yet.

## Where things are

- **The diary:** [`docs/diary.md`](docs/diary.md). How the revamp is being made: what we found, what we chose and why
- **Work:** [open issues](https://github.com/Johnesco/karaokeunderground/issues). Every change starts as one
- **Decisions:** [`docs/adr/`](docs/adr/README.md). [ADR-001](docs/adr/001-static-netlify-core-files.md) chose the stack: a static site on Netlify that reads a few core files in the browser
- **The old site:** [`docs/legacy-site/`](docs/legacy-site/audit.md). What it has and does, and every URL the revamp must redirect
- **Changes:** [`CHANGELOG.md`](CHANGELOG.md)

## Process

This project runs on [sdlc-baseline](https://github.com/Johnesco/sdlc-baseline) (profile `core`): every change starts as a ticket, gets decided before it's built, and is verified by a person before it counts as done.
