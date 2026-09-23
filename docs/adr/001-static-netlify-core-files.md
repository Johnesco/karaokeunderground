# ADR-001: A static site on Netlify that reads its core files in the browser

- **Status:** Accepted
- **Date:** 2026-09-23
- **Issue:** [#2](https://github.com/Johnesco/karaokeunderground/issues/2). Research: [`docs/research/stack-and-hosting.md`](../research/stack-and-hosting.md)
- **Revisit with:** [#3](https://github.com/Johnesco/karaokeunderground/issues/3), the owner interview

## Context

**This is a revamp we'll offer to the owner, so they have to be able to take it over.** That means it runs in accounts they control, at a cost they accept, and is easy for them to update ([CLAUDE.md → Approach](../../CLAUDE.md#approach)).

**The [#1 audit](../legacy-site/audit.md) set the rest:**

- The current WordPress site went years without updates, until it could no longer be patched.
- What changes is the shows and the songlist, about monthly. The songlist is about 1,900 rows, kept in a spreadsheet.
- Most visitors are on phones.
- Old URLs are query strings that need 301 redirects.
- There's a contact form.

**We don't know yet how the owner works,** because the interview (#3) comes after the pitch. So this ADR assumes the owner:

- updates the shows and the songlist about monthly
- keeps the songlist in a spreadsheet app
- may post a show from a phone
- isn't a developer
- wants little or no running cost

**Two decisions are already made.** The owner's content stays private until they agree ([#6](https://github.com/Johnesco/karaokeunderground/issues/6), [#7](https://github.com/Johnesco/karaokeunderground/issues/7)). And during #2, John set how the site gets updated: by changing a few core files kept in one place on GitHub, with a login for the owner added later.

**John already runs this pattern** in the [Austin Karaoke Directory](https://github.com/Johnesco/karaokedirectory): a static site on Netlify, a data file the browser fetches, and a build script in plain Node.

## Decision

- **Core files in one spot:** a `content/` folder holds everything that changes.
  - `songlist.csv` and `shows.csv`, which any spreadsheet app can export
  - the page text and posts, as Markdown
  - the images

  Updating the site means replacing or editing a file there on GitHub.
- **The browser reads them:** the site is static HTML, CSS and JavaScript. When someone visits, the JavaScript fetches the core files and renders the songlist with its search, the shows and the pages.
- **A plain Node check runs first:** on every deploy, Netlify runs a dependency-free Node script that checks the core files and generates small derived files, such as the redirects. If the check fails, the deploy stops, so a bad upload never replaces the live site.
- **Hosting is Netlify's free plan:**
  - The contact form uses Netlify Forms, which filters spam. The address it notifies stays in Netlify's settings.
  - Old URLs get 301s through `_redirects`, which can match query parameters.
- **Private until the owner agrees:**
  - The code lives in this public repo, and the core files in the private content repo. Netlify's build brings them together.
  - The preview is shown from John's machine or in person, because the free plan can't password-protect a site.
- **Room for a login:** git-based editors such as TinaCMS and Decap edit Markdown and data files. So an owner login can be added later without changing the site.
- **Process:**
  - The profile stays `core`: nothing runs that we operate.
  - The gate is `npm test`.
  - The version lives in `package.json`, with no build numbers, because a deploy is identified by its commit.

## Consequences

**Positive**

- **One pattern across John's projects.** What's learned on the directory applies here, and the other way round.
- **Updating is replacing a file.** The owner can keep any spreadsheet app and upload its CSV export. There's no deploy tooling for them to learn.
- **Nothing to patch in production.** There's no server, database or CMS, so the current site's failure (years without updates) can't happen again.
- **It costs $0 to host,** with forms included. The domain and email are separate costs, as they would be with any host.

**Negative / accepted tradeoffs**

- **Netlify's free plan has a hard cap** of 300 credits a month ([source](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)):
  - each production deploy costs 15, each GB of traffic 20, and each 10,000 requests 2
  - when the credits run out, every site on the account shows "Site not available" until the month resets

  So content updates should be batched, and development should run on deploy previews, which are free. Usage needs watching.
- **The songlist, shows and pages need JavaScript to appear.** They need a fallback for visitors without it, and a check that search engines index them.
- **No shareable private preview** without paying for Netlify Pro.
- **No transfer of the free project.** Free projects are single-seat, so rather than transferring it, the owner creates their own Netlify project from the repo. The settings live in `netlify.toml`.
- **Redirects take two steps.** Netlify matches a query value to a placeholder, so each family of old URLs (`page_id`, `p`, `m` and so on) maps to a path first, then to its new page. A rule on `/` needs forcing.
- **The assumptions about the owner may be wrong.**

**Future revisit triggers**

- #3 shows the owner can't or won't update files on GitHub. Add the login sooner, or rethink the editing path.
- Credits run short, or traffic grows. Move to a paid plan, or to Cloudflare Pages, the runner-up.
- Visitors without JavaScript, or search engines, lose out. Pre-render the pages at build time from the same core files.
- Anything needs code running on a server. That's a new ADR, and the profile becomes `core+ops`.

## Options considered

### Hosts

- **Cloudflare Pages (runner-up, recommended during #2).** Free, with unlimited traffic, 500 builds a month and free private previews through Cloudflare Access. It has no built-in forms, and its redirects file can't match query strings, so old URLs would need its zone rules. Netlify won on John's familiarity, its built-in forms and its native query-string redirects.
- **GitHub Pages (rejected).** Its terms bar running an online business on it, it can't serve 301s or take a form, and it has no private previews.
- **Vercel (rejected).** The free Hobby plan is non-commercial only, and Pro costs $20 per month.

### How the owner edits

- **Google Sheets (rejected).** A familiar spreadsheet on any device, but the content would live outside the repo, with no history, and it doesn't cover page text. Files on GitHub keep everything in one versioned place, ready for a login.
- **A git-based editor now (deferred).** Each needs a GitHub account per editor, or a hosted service in beta or on a free tier. Editing 1,900 songs row by row in one would be clumsy. It's planned for later, on top of the same files.
- **WordPress on current PHP (rejected).** It's familiar, but it needs updating forever, which is exactly how the current site failed. It would also make the profile `core+ops`.
- **A hosted site builder (rejected).** A monthly fee, lock-in, weak search for a long list, and limited redirects.

### When the site reads the core files

- **At build time (runner-up, recommended during #2).** Pages would arrive as plain HTML, which is safer and works without JavaScript. The deploy check recovers most of the safety, and pre-rendering stays open as a revisit.

### What builds the site

- **Eleventy or Astro (not needed).** With the browser rendering pages, the build only checks files and writes a few derived ones. Plain Node does that without adding a dependency.

## Implementation notes

- **Local first.** Netlify is the plan, but the site is built and previewed on John's machine for now. The Netlify project, and pulling the private content in at deploy time, come later.
- **The build tickets that follow from this ADR:**
  - [#10](https://github.com/Johnesco/karaokeunderground/issues/10) converts the working copy into `content/`. It settles the exact formats (the columns in `songlist.csv` and `shows.csv`, and the Markdown front matter) and starts the `npm test` gate with the Node check
  - [#11](https://github.com/Johnesco/karaokeunderground/issues/11) builds the songlist page with search, plus the site shell and local preview
  - [#12](https://github.com/Johnesco/karaokeunderground/issues/12) puts upcoming shows on the homepage and a calendar page
  - [#13](https://github.com/Johnesco/karaokeunderground/issues/13) builds the pages and the post archive from Markdown
  - [#14](https://github.com/Johnesco/karaokeunderground/issues/14) redirects every legacy URL from `urls.csv`
