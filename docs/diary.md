# Revamp diary

How the karaokeunderground.com revamp is being made, told as it happens: what we found, what we chose and why, and what went wrong along the way. This is the "show your work" half of a portfolio piece. The finished site will be the other half.

"We" means two collaborators:

- **John** decides and verifies.
- **Claude**, an AI assistant, researches, drafts and builds.

The split follows [sdlc-baseline](https://github.com/Johnesco/sdlc-baseline)'s roles. Every change starts as a ticket and gets decided before it's built, and a person checks it before it counts as done.

Every entry is tagged:

- **Milestone:** a step the project reached
- **Finding:** something we learned about the old site
- **Decision:** a choice, and the reason for it
- **Challenge:** something that went wrong, or turned out harder than it looked
- **Process:** how we work

## Milestones

| Date | Milestone |
|---|---|
| 2026-09-23 | [Kickoff: the repo, the process and the board](#2026-09-23--kickoff) |
| 2026-09-23 | [The old site audited](#2026-09-23--auditing-the-old-site) ([#1]) |
| 2026-09-23 | [Our own copy of the site](#2026-09-23--taking-our-own-copy) ([#6]) |
| 2026-09-23 | [The copy frozen, and a working copy started](#2026-09-23--frozen-copy-working-copy) ([#7]) |
| Next | The stack chosen: ADR-001 ([#2]) |
| Later | A preview ready to show |
| Later | Presented to the owner |

## Entries

### 2026-09-23 · Kickoff

**Milestone · Process** · [first commit](https://github.com/Johnesco/karaokeunderground/commit/bfd49c7)

Karaoke Underground is a punk and indie video karaoke night in Austin, run since 2004. Its website is a WordPress install that's years past end-of-life. The goal is a revamp to offer the owner as a replacement.

Before any design or code, we set up the process:

- a public repo
- a project board
- sdlc-baseline's labels and issue templates
- two discovery tickets: one audits the old site ([#1]), and the other picks the stack ([#2])

The rules from here on: no code without a ticket, and nothing gets built before its decision is written down.

### 2026-09-23 · Auditing the old site

**Milestone · Finding** · [#1] · [the audit](legacy-site/audit.md)

We audited the live site from the outside only: its public pages, WordPress's public API, its DNS and domain records, the Wayback Machine, and a phone-sized browser. No logins, no forms. What mattered most:

- **The songlist is the heart of the site, and it barely works on a phone.** It's 1,853 songs in a single 448 KB table, in a fixed 960px layout that phones shrink to 38%, and there's no search. Thirty-four archived versions show it growing from 894 songs in 2015.
- **Upcoming shows are listed in four places that disagree.** The homepage's list is hand-edited HTML inside the theme.
- **Every URL is a query string,** such as `/?page_id=16`. The new host will have to redirect on query parameters.
- **An older site is still online:** 30 pages and 413 photos from 2004–2013 that the current site no longer links to.
- **Email runs on the same server as the website.** Moving the site before moving mail would break email.

Every known URL went into [a CSV](legacy-site/urls.csv) that will become the redirect map. Two follow-ups came out of the audit: an interview with the owner ([#3]), and an accessibility target for the revamp ([#4]).

**Chose:** to publish the audit in this public repo, but without plugin versions, admin details or anything personal. A public vulnerability map of a live site that can't be patched would help no one.

### 2026-09-23 · WordPress or Wix?

**Process**

A fair question came up: is the site WordPress or Wix? We checked rather than answer from memory. The page names itself as WordPress, every file loads from WordPress's folders, the server runs Apache and PHP, and WordPress's own API answers. The Wix impression most likely came from a venue's Wix site that ranks in searches for Karaoke Underground. It was a small thing, but it set the tone: check before asserting.

### 2026-09-23 · A revamp for the owner

**Decision** · [#5] · [the approach](../CLAUDE.md#approach)

We wrote down what this project is: a revamp John is building for Karaoke Underground's owner, not a takeover. The approach has four steps:

1. Copy the content.
2. Improve it.
3. Present it at a preview address of our own.
4. Let the owner decide.

The live site stays read-only to us.

One consequence became a requirement for the stack decision ([#2]): whatever we build, the owner has to be able to take it over and run it, in accounts they control and at a cost they accept.

### 2026-09-23 · Taking our own copy

**Milestone · Decision** · [#6] · [the script](https://github.com/Johnesco/karaokeunderground/commit/ccd2ab7)

The first idea was a local HTML copy of the site to start from. We chose something different:

- **The content, pulled into clean files:** the songlist as a CSV, the shows as data, the pages and posts, and the images.
- **A separate reference copy** of the pages as they look today, as a before-picture.

Starting from the old HTML would have meant inheriting the theme and plugins the revamp replaces.

A small Python script makes both. It needs nothing installed, and it reads the site one polite request at a time: 275 of them in all. Every count matched the audit. The content is the owner's and this repo is public, so the copy stays on John's machine. Only the script is committed here.

### 2026-09-23 · Eight songlists, four formats

**Challenge** · [#6]

The site has eight themed songlists: sad songs, Halloween, a Spoon night and others. Each was typed a different way:

- artist then title
- album then title
- ranked, title then artist
- struck through as each song got sung
- in a table

A generic parser got them wrong, so each post got a rule of its own. Every count a post states about itself came out right.

Two edge cases needed extra care: a long title that wrapped onto a second table row, and a real title that starts with a parenthesis.

### 2026-09-23 · Correcting the audit

**Challenge · Process** · [the correction](https://github.com/Johnesco/karaokeunderground/commit/af41e04)

The audit reported broken curly quotes on the site's Media page. Building the copy proved that wrong. The quotes were fine: the broken characters came from our own tools printing to a Windows console. The audit had also counted one themed list as 262 songs, when it has 261.

We corrected both in the open, with a commit saying what was wrong and why. The lesson: check the raw bytes before calling data broken.

### 2026-09-23 · The fonts only work over http

**Finding · Decision** · [the audit note](https://github.com/Johnesco/karaokeunderground/commit/b61ac7b)

The reference copy's menu used a font we'd never seen on the live site. The cause: the theme loads its two web fonts from `http://` addresses, and browsers won't load those into an `https://` page. That's called mixed content, and it means visitors get fallback fonts. Over `http://`, the designed look appears. We confirmed it in the browser's console and its list of loaded fonts.

**Chose:** to keep the designed fonts in the reference copy, because that's the look the owner chose, and to note the problem in the audit. The files for one of the fonts are named as a demo version, so its licence needs checking before the revamp reuses it.

### 2026-09-23 · Frozen copy, working copy

**Milestone · Decision** · [#7] · [the change](https://github.com/Johnesco/karaokeunderground/commit/ad3c8f2)

To keep a true "before", the copy from 2026-09-23 is now frozen. Its files are read-only, and the script refuses to overwrite it.

Edits happen in a separate working copy of the content, in a repository of its own. That repository is private, so every change gets a history and a backup without the owner's content going public. Its first commit matches the frozen copy byte for byte, so every improvement from here shows as a difference from the original.

### 2026-09-23 · Starting this diary

**Process** · [#8]

This revamp is also a portfolio piece, and the process is half of it, so we started this diary. It gets an entry whenever something is found, chosen, reached or fixed, linked to the tickets and commits behind it. Keeping it up is part of finishing a ticket.

The plan is to keep this version detailed as we go, and condense it into a shorter one for a final portfolio page once the revamp is done ([#9]).

[#1]: https://github.com/Johnesco/karaokeunderground/issues/1
[#2]: https://github.com/Johnesco/karaokeunderground/issues/2
[#3]: https://github.com/Johnesco/karaokeunderground/issues/3
[#4]: https://github.com/Johnesco/karaokeunderground/issues/4
[#5]: https://github.com/Johnesco/karaokeunderground/issues/5
[#6]: https://github.com/Johnesco/karaokeunderground/issues/6
[#7]: https://github.com/Johnesco/karaokeunderground/issues/7
[#8]: https://github.com/Johnesco/karaokeunderground/issues/8
[#9]: https://github.com/Johnesco/karaokeunderground/issues/9
