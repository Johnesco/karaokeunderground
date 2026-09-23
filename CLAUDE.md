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
2. **Improve.** Edit the content in `work/`, a private repo. Rebuild the site from it on the stack ADR-001 picks, fixing what the audit found
3. **Present.** Publish it at a preview address of our own, never karaokeunderground.com, and show it to the owner as a replacement
4. **Owner's call.** It replaces the current site only if the owner accepts. The owner, or someone they authorize, makes the switch: domain, DNS, email and hosting. [`urls.csv`](docs/legacy-site/urls.csv) becomes the redirect map, so old links keep working

The owner has to be able to take it over, so ADR-001 must pick a stack they can run: in accounts they control, at a cost they accept, and easy for them to edit.

## Architecture

**Stack: not chosen yet.** Spike [#2](https://github.com/Johnesco/karaokeunderground/issues/2) decides it and records the decision as ADR-001. No site code lands until ADR-001 is Accepted.

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
├── .gitattributes                 # LF everywhere: vendored scripts break on CRLF
├── .github/                       # Vendored from sdlc-baseline. Never hand-edit;
│   ├── ISSUE_TEMPLATE/            #   refresh with scripts/sync-github-templates.sh
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── adr/
│   │   └── README.md              # ADR index
│   ├── diary.md                   # The revamp's story for the portfolio: findings, decisions, milestones (#8)
│   └── legacy-site/
│       ├── audit.md               # What the old site has and does (spike #1)
│       └── urls.csv               # Every known legacy URL; becomes the redirect map
├── scripts/
│   ├── setup-labels.sh            # Vendored: creates the label taxonomy
│   ├── snapshot-content.py        # Ours: takes a snapshot of the live site (#6), never over an existing one (#7)
│   └── sync-github-templates.sh   # Vendored: pulls the latest vendored files
├── snapshot/                      # Gitignored: the 2026-09-23 snapshot, frozen read-only. Later ones go in snapshots/
└── work/                          # Gitignored: the content working copy. Its own repo, pushed to a private one
```

> Update this section as the project grows. Claude uses it to navigate the codebase.

## Key Technical Patterns

None yet. They follow from ADR-001 and the first build tickets.

## Data Formats

None decided yet: ADR-001 settles where the songlist and the show calendar are kept. Until then the working copy in `work/` uses the snapshot's formats:

- `songlist.csv`: `Artist,Title,Album`. Solo artists are filed "Last, First", and covers are written as "Title (by Original Artist)"
- `themed-songlists.csv`: `post_id,post_title,rank,artist,title,album,note`, one row per song across the 8 themed lists
- `shows.json`: `homepage` and `calendar` lists of `{date, weekday, venue, details, link, text}`. The site gives no years, so each `date` is inferred

## Testing

**Local gate:** not named yet. ADR-001 names it along with the stack. It will be one command, and it must pass before any release tag.

## Releases

**Version source of truth:** not chosen yet. ADR-001 decides between `package.json` `version` (for an npm-based stack) and a root `VERSION` file
**Build numbers:** decided with ADR-001
**Release command:** none yet

<!-- ============================================================
     WORKING IN THIS PROJECT
     Universal process content lives canonically in sdlc-baseline.
     Link out — do NOT paste copies here. Drift kills.
     ============================================================ -->

## Working in this project

**SDLC profile:** core
<!-- Assumes the revamp is static: files served by a host, with no server anyone has to operate.
     If ADR-001 picks a CMS server, a backend or a database, switch to core+ops: change this
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

- **The gate and the version source of truth wait on ADR-001 ([#2](https://github.com/Johnesco/karaokeunderground/issues/2)).** The kickoff checklist names both on day one, but both depend on the stack, which isn't chosen yet. Delete this entry once ADR-001 is Accepted.

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

- ADR-001: stack and hosting. *Pending* on spike [#2](https://github.com/Johnesco/karaokeunderground/issues/2)

### The diary

This revamp is also a portfolio piece, and the process is half of it. [`docs/diary.md`](docs/diary.md) tells the story as it happens: milestones reached, findings, decisions and why, and challenges and mistakes.

- **When:** add or extend an entry in Step 6, before a ticket moves to Verify. Also add one when something worth telling happens between tickets
- **How:** dated entries, oldest first, each tagged Milestone, Finding, Decision, Challenge or Process and linked to its tickets, commits and docs. Write for someone outside the project, and put new milestones in the table at the top
- **Detail:** keep entries detailed. A shorter version for the portfolio gets written when the revamp is done, so don't condense this one along the way
- **It's public:** the rules under Security Considerations apply. No owner content, personal details or admin details

## Project History

### Recent Changes
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
