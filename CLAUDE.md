# Karaoke Underground - Claude Project Memory

> This file serves as persistent context for Claude Code sessions. It is automatically read at the start of every conversation. Keep this document **thin and project-specific** — link to canonical sdlc-baseline docs rather than restating them. See [sdlc-baseline consumption model](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/consumption.md).

## Project Identity

**Name:** Karaoke Underground (site revamp)
**Purpose:** Revamp karaokeunderground.com, the site for Karaoke Underground (punk and indie video karaoke in Austin, TX), and offer it to the owner as a replacement for the end-of-life WordPress install
**Also:** a portfolio piece for John, showing the process as well as the result. See [The diary](#the-diary)
**Owner:** the people who run Karaoke Underground. They hold the live site, the domain and the hosting, and they decide whether the revamp replaces the current site. John builds the revamp for them
**Target Users:** Punk and indie fans checking where the next show is and what they can sing, mostly on phones and often at the show. Also the owner, who keeps shows and songlists current
**Live Site:** https://karaokeunderground.com, the owner's current WordPress site (`www.` 301s to the apex). It stays as it is unless the owner adopts the revamp
**Repo:** https://github.com/Johnesco/karaokeunderground (public)

## Approach

1. **Copy.** Pull our own copy of the current site's public content (pages, posts, the songlist, shows, media). The copy from 2026-09-23 is frozen in `snapshot/` as the record of the site before the revamp. [`docs/legacy-site/`](docs/legacy-site/audit.md) maps what there is
2. **Improve.** Edit the content in `work/`, a private repo. Rebuild the site from it on the stack [ADR-001](docs/adr/001-static-netlify-core-files.md) chose, fixing what the audit found
3. **Present.** Show it to the owner privately as a replacement: from John's machine, or in person. Netlify's free plan can't password-protect a preview, and it's never shown at karaokeunderground.com
4. **Owner's call.** It replaces the current site only if the owner accepts. The owner, or someone they authorize, makes the switch: domain, DNS, email and hosting. [`urls.csv`](docs/legacy-site/urls.csv) becomes the redirect map, so old links keep working

The owner has to be able to take it over: the stack runs in accounts they control, at a cost they accept, and it's easy for them to update.

## Architecture

**Stack: decided in [ADR-001](docs/adr/001-static-netlify-core-files.md)** (spike [#2](https://github.com/Johnesco/karaokeunderground/issues/2)). It's a static site on Netlify's free plan, with the same pattern as the Austin Karaoke Directory:

- **Core files:** everything that changes lives in one `content/` folder: `songlist.csv`, page text and posts as Markdown, and images, in the formats [ADR-002](docs/adr/002-core-file-formats.md) sets. The shows join them once we decide how events get updated. Updating the site means replacing or editing a file there on GitHub
- **The browser reads them.** The site's JavaScript fetches the core files and renders the songlist with its search, the shows and the pages
- **Checked before every deploy.** A dependency-free Node script validates the core files and writes derived files such as `_redirects`. A failed check stops the deploy, so the live site keeps its last good version
- **Netlify also provides the contact form and the 301s.** Netlify Forms handles the form, and `_redirects` sends old query-string URLs to their new pages
- **Code and content live apart until the owner agrees.** Code is in this public repo, the core files in the private content repo, and the Netlify build combines them
- **An owner login comes later.** A git-based editor, such as TinaCMS or Decap, edits the same files
- **Watch the credits.** The free plan gives 300 credits a month: 15 per production deploy, 20 per GB of traffic. When they run out, every site on the account is paused. Batch content updates, and develop on deploy previews, which are free
- **Local for now.** The site is built and previewed on John's machine, reading the core files from `work/content/`. Setting up Netlify comes later. Build tickets: [#10](https://github.com/Johnesco/karaokeunderground/issues/10)–[#14](https://github.com/Johnesco/karaokeunderground/issues/14)

### The current site

Audited 2026-09-23 in spike [#1](https://github.com/Johnesco/karaokeunderground/issues/1). Findings are in [`docs/legacy-site/audit.md`](docs/legacy-site/audit.md), and every known URL is in [`urls.csv`](docs/legacy-site/urls.csv).

- **Platform:** WordPress 5.8.17 on Apache with PHP 5.6.40, both years past end-of-life, on LinkSky shared hosting. Custom theme `KU`
- **Plugins:** Contact Form 7, MetaSlider, Simply Instagram, Instagram Feed (broken), plus admin-only ones the page source can't show
- **Menu:** Songlist · Calendar · Photos · Contact · Media · About
- **Changes often:** the upcoming shows and the 1,853-song master songlist, both every month or so. Themed songlists go up as blog posts about once a year (e.g. *SAD SONGS ONLY 2025*, 542 songs). Easy editing is a requirement, not a nice-to-have
- **URLs are query strings** (`/?page_id=16`, `/?p=835`), so the new host must redirect on query parameters. The pre-WordPress static site (2004–2013) is still live alongside it
- **Email runs on the web server** (MX points at the apex), so move it before changing DNS. The domain expires 2027-01-15
- **Off-site:** Facebook events, Spotify playlists, Instagram `@karaokeunderground`, X/Twitter `@KUAustin`

## File Structure Overview

```
karaokeunderground/
├── CLAUDE.md                      # THIS FILE
├── README.md                      # Public documentation
├── CHANGELOG.md                   # Keep a Changelog; entries accrue as issues close
├── package.json                   # npm test, the gate, and the version. No dependencies
├── .gitattributes                 # LF everywhere: vendored scripts break on CRLF
├── .github/                       # Vendored from sdlc-baseline. Never hand-edit;
│   ├── ISSUE_TEMPLATE/            #   refresh with scripts/sync-github-templates.sh
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── adr/
│   │   ├── README.md              # ADR index
│   │   ├── 001-static-netlify-core-files.md   # The stack: static on Netlify, core files read in the browser
│   │   └── 002-core-file-formats.md           # The formats of the core files (#10)
│   ├── diary.md                   # The revamp's story for the portfolio: findings, decisions, milestones (#8)
│   ├── legacy-site/
│   │   ├── audit.md               # What the old site has and does (spike #1)
│   │   └── urls.csv               # Every known legacy URL; becomes the redirect map
│   └── research/
│       └── stack-and-hosting.md   # The sourced findings behind ADR-001 (spike #2)
├── scripts/
│   ├── check-content.js           # Ours: the content check, which npm test runs (#10)
│   ├── lib/                       # Its parts. csv.js, front-matter.js and songlist.js use no Node APIs, so the site can share them
│   ├── convert-working-copy.py    # Ours, one-off: turned the working copy into the core files (#10)
│   ├── setup-labels.sh            # Vendored: creates the label taxonomy
│   ├── snapshot-content.py        # Ours: takes a snapshot of the live site (#6), never over an existing one (#7)
│   └── sync-github-templates.sh   # Vendored: pulls the latest vendored files
├── test/                          # Unit tests for node --test. fixtures/content/ is a made-up example of the core files
├── snapshot/                      # Gitignored: the 2026-09-23 snapshot, frozen read-only. Later ones go in snapshots/
└── work/                          # Gitignored: the content working copy, its own repo pushed to a private one. The core files are in work/content/
```

> Update this section as the project grows. Claude uses it to navigate the codebase.

## Key Technical Patterns

From [ADR-001](docs/adr/001-static-netlify-core-files.md) and [ADR-002](docs/adr/002-core-file-formats.md):

- **The core files are the only source.** Nothing that changes is typed into HTML or JavaScript. It comes from `content/`
- **Nothing reaches production unchecked.** The deploy-time Node check is the safety net for uploads made in GitHub's web editor, which bypass the local gate
- **Plain Node for tooling,** with no dependencies where possible, like the directory's build scripts. ES modules throughout (`"type": "module"`)
- **The check and the site share their parsers.** `scripts/lib/csv.js`, `front-matter.js` and `songlist.js` use no Node APIs, so the browser runs the same code the check tested. #11 can move them to where the site loads them
- **Errors and warnings.** The check fails on an error: something that would break the site, lose content or publish something it shouldn't. A warning is worth a look but doesn't stop anything
- **No HTML in the content.** The check rejects HTML in pages and posts, and the renderer still escapes it, because uploads can bypass the local gate

## Data Formats

**Decided in [ADR-002](docs/adr/002-core-file-formats.md).** The core files are in `work/content/`, in the private content repo, until the owner agrees. [`scripts/lib/check-content.js`](scripts/lib/check-content.js) enforces every rule here, and `test/fixtures/content/` is a small made-up example of each file.

- **All text is UTF-8.** The byte-order mark that Excel's "CSV UTF-8" adds is fine
- **`songlist.csv`:** the first row names the five columns, `Artist,Title,Album,Themes,Tags`, in any order
  - Artist and Title are required, and Album can be blank. Solo artists are filed "Last, First", and covers are "Title (by Original Artist)"
  - Themes and Tags can be blank, or hold several values separated by semicolons: `sad; scary`. Themes are the themed lists (`sad` and `scary` so far). Tags are categories for browsing, all empty so far
  - Every song is on the main list. The theme `unlisted` takes a song off every list, themed ones included, until the word is removed
  - No other columns, because everything in the file is public once deployed. At least 1,000 songs, so a cut-off or filtered export can't replace the list
- **`pages/<slug>.md`, `posts/<YYYY-MM-DD>-<slug>.md`:** plain Markdown (CommonMark, plus `~~strikethrough~~`) with no HTML. A line break inside a paragraph is a backslash at the end of the line
  - Front matter between two `---` lines: `title` (required), `date` (required for posts, and the same as the file name's), `updated`, and `old_url`, the legacy address without the domain, in the same form as `urls.csv` (`/?p=835`). A value with `: ` or ` #` in it goes in double quotes, and the converted files quote every title
  - Links to other pages and posts point at their `.md` files, and images use paths from the file: `![Alt text](../images/2014/04/poster.jpg)`. Links are checked exactly, upper and lower case included, because the web host is case-sensitive
- **`images/`:** WordPress's year/month folders, plus `site/` for the logo and icons. jpg, jpeg, png, gif or webp
- **The shows wait.** `work/shows.json` stays as the snapshot wrote it (`homepage` and `calendar` lists of `{date, weekday, venue, details, link, text}`, with each year inferred) until we decide how events get updated

## Testing

**Local gate:** `npm test` ([ADR-001](docs/adr/001-static-netlify-core-files.md)). It runs the unit tests in `test/` with `node --test`, then `scripts/check-content.js` on `work/content/`. It must pass before any release tag, and it's deterministic: local files only, with no network and no clock, so a show in the past is never an error. It needs the private content in `work/`, and says so when it's missing.

- `npm run check` runs the content check alone, and `node scripts/check-content.js <folder>` checks any other content folder

## Releases

**Version source of truth:** `package.json` `version` ([ADR-001](docs/adr/001-static-netlify-core-files.md))
**Build numbers:** none. It's a website, so each deploy is identified by its commit
**Release command:** none yet

<!-- ============================================================
     WORKING IN THIS PROJECT
     Universal process content lives canonically in sdlc-baseline.
     Link out — do NOT paste copies here. Drift kills.
     ============================================================ -->

## Working in this project

**SDLC profile:** core
<!-- ADR-001 keeps the revamp static: files served by Netlify, with no server anyone has to operate.
     If a CMS server, a backend or a database is ever added, switch to core+ops: change this
     line and restore the ops link block from CLAUDE-TEMPLATE.md.
     See https://github.com/Johnesco/sdlc-baseline/blob/main/docs/profiles.md -->

This project uses the [sdlc-baseline](https://github.com/Johnesco/sdlc-baseline) universal workflow. Claude must follow these canonical docs:

- [Workflow (7 steps)](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/workflow.md) — ticket-first, decide before you build, documentation-aware
- [Roles & hat-switch protocol](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/roles.md) — PO / BA / Dev / Documenter / QA
- [Definition of Done](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/definition-of-done.md) — exit criteria by issue type, verification-first
- [Severity & priority matrix](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/severity-matrix.md)
- [Commit, PR, and branch conventions](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/commit-conventions.md)
- [Release management](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/release-management.md) — versioning, build numbers, changelogs, hotfixes, milestones
- [Testing](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/testing.md) — testing strategy and the local gate
- [Backlog hygiene](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/backlog-hygiene.md) — review cadence, grooming, planning without sprints
- [ADR protocol](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/adrs.md) — the six-line stub, threshold rule, format
- [Security basics](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/security-basics.md) — secrets, dependencies, XSS; `(ops)` sections don't apply while the profile is core
- [Profiles](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/profiles.md) — what `core` requires and relaxes
- [Board setup](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/board-setup.md) and [labels](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/labels.md) — one-time setup; the board is optional in core

**Three non-negotiables:**

1. **No code without a ticket.** That means an Issue, or an ADR stub when the ticket is a decision. Add each issue to the board right after creating it, because `gh issue create` does NOT:
   ```bash
   gh project item-add 7 --owner Johnesco --url <ISSUE_URL>
   ```
2. **Decide before you build.** Anything above a tuning tweak — more than one file, or a behaviour change — gets a six-line ADR stub (Context + Decision) before code. If you can't write the paragraph, it isn't ready.
3. **Claude cannot QA its own work.** The Verify column is always human-owned.

When sdlc-baseline updates, glance at its [CHANGELOG](https://github.com/Johnesco/sdlc-baseline/blob/main/CHANGELOG.md) before adopting changes here.

### Project-specific deviations

None. The gate and the version source of truth waited on ADR-001, which named both on 2026-09-23.

### Project IDs

> GitHub Projects field IDs and option IDs for this project. Used by Claude when scripting `gh` commands.

- **Repo:** `Johnesco/karaokeunderground` (public)
- **Project board:** `PVT_kwHOAFNB8s4BkZrc`, number **7** ([board](https://github.com/users/Johnesco/projects/7))
- **Status field:** `PVTSSF_lAHOAFNB8s4BkZrczhjKXXo`
- **Status options:** Backlog=`f75ad846`, Ready=`be988bae`, In Progress=`47fc9ee4`, Verify=`09a57940`, Done=`98236657`

**Add a new issue to the board** (does not auto-fire on issue create):
```bash
gh project item-add 7 --owner Johnesco --url <ISSUE_URL>
```
**Move a card programmatically:**
```bash
gh project item-edit --project-id PVT_kwHOAFNB8s4BkZrc --id <ITEM_ID> \
  --field-id PVTSSF_lAHOAFNB8s4BkZrczhjKXXo --single-select-option-id <OPTION_ID>
```

### Labels

The [sdlc-baseline set](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/labels.md), plus one project area: `area:content` (site copy, songlist, show listings, photos and media).

### Milestones (optional)

None yet. Create the first once discovery (#1, #2) shows the shape of the build.

### Architecture Decisions

ADRs live in `docs/adr/` in this project (index: [`docs/adr/README.md`](docs/adr/README.md)). Format, stub and threshold rule: [sdlc-baseline `docs/adrs.md`](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/adrs.md).

- [ADR-001](docs/adr/001-static-netlify-core-files.md): a static site on Netlify that reads its core files in the browser. *Accepted* 2026-09-23 (spike [#2](https://github.com/Johnesco/karaokeunderground/issues/2)); revisit after the owner interview, [#3](https://github.com/Johnesco/karaokeunderground/issues/3)
- [ADR-002](docs/adr/002-core-file-formats.md): the formats of the core files, including the Themes and Tags columns and plain Markdown. *Accepted* 2026-09-23 ([#10](https://github.com/Johnesco/karaokeunderground/issues/10)); the shows wait for the decision on events

### The diary

This revamp is also a portfolio piece, and the process is half of it. [`docs/diary.md`](docs/diary.md) tells the story as it happens: milestones reached, findings, decisions and why, and challenges and mistakes.

- **When:** add or extend an entry in Step 6, before a ticket moves to Verify. Also add one when something worth telling happens between tickets
- **How:** dated entries, oldest first, each tagged Milestone, Finding, Decision, Challenge or Process and linked to its tickets, commits and docs. Write for someone outside the project, and put new milestones in the table at the top
- **Detail:** keep entries detailed. A shorter version for the final portfolio page gets written when the revamp is done ([#9](https://github.com/Johnesco/karaokeunderground/issues/9)), so don't condense this one along the way
- **It's public:** the rules under Security Considerations apply. No owner content, personal details or admin details

## Project History

### Recent Changes
- **2026-09-23**: Converted the working copy into the core files (#10). [ADR-002](docs/adr/002-core-file-formats.md) sets their formats, and `npm test` checks them
- **2026-09-23**: Chose the stack (#2): [ADR-001](docs/adr/001-static-netlify-core-files.md), a static site on Netlify that reads its core files in the browser
- **2026-09-23**: Started the revamp diary for the portfolio (#8): [`docs/diary.md`](docs/diary.md)
- **2026-09-23**: Froze the snapshot and started the content working copy in `work/`, a private repo (#7)
- **2026-09-23**: Pulled a local copy of the live site (#6): `scripts/snapshot-content.py` writes a gitignored `snapshot/` with clean content and a reference copy
- **2026-09-23**: Recorded that this is a revamp for the owner, offered as a replacement for the current site (#5)
- **2026-09-23**: Audited the legacy site (#1): [`docs/legacy-site/`](docs/legacy-site/audit.md)
- **2026-09-23**: Kickoff. Adopted sdlc-baseline (`core`) and created the repo, labels and board #7. Opened discovery spikes #1 (site audit) and #2 (stack → ADR-001)

## Security Considerations

- **This repo is public.** Never commit secrets. Hosting, DNS, form-service and CMS credentials live in the platform's environment config; `.env*` is gitignored
- **The live site is the owner's.** Read its public pages only: no logins, no form submissions, no changes. Keep the owner's accounts and personal details out of this repo
- **The owner's content stays private.** It lives only in `snapshot/` on John's machine and in `work/`, whose remote is the private `Johnesco/karaokeunderground-content` repo. Never commit it here, paste it into issues, or quote it in commit messages
- **The legacy install is end-of-life** (PHP 5.6, WordPress 5.8). Copy its content, but don't port its code or plugins
- **Contact form:** validate input at the boundary, add spam protection, and keep the destination address out of page source
- **Third-party embeds** (Instagram, Facebook, Spotify) run other people's scripts on our pages. Add each one on purpose, never by default

## Related Documentation

- [Austin Karaoke Directory](https://github.com/Johnesco/karaokedirectory): sibling project that lists KU's shows (company id `karaoke-underground`)
- [sdlc-baseline](https://github.com/Johnesco/sdlc-baseline): the process this project follows

---

> **Maintenance note:** This template is intentionally short. Resist the urge to paste sdlc-baseline content into the consuming project. If you find yourself wanting to, add a link instead. See [`docs/consumption.md`](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/consumption.md).
