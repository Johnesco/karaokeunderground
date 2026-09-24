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
| 2026-09-23 | [The stack chosen: ADR-001](#2026-09-23--choosing-the-stack) ([#2]) |
| 2026-09-23 | [The content converted into core files, with a check to guard them](#2026-09-23--the-core-files) ([#10]) |
| 2026-09-23 | [The new site renders, phone-first, with a searchable songlist](#2026-09-23--the-new-site-renders) ([#13], [#11]) |
| Next | The shows, once we decide how events get updated ([#12]), and redirects for every old URL ([#14]) |
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

### 2026-09-23 · Choosing the stack

**Milestone · Decision** · [#2] · [ADR-001](adr/001-static-netlify-core-files.md) · [the research](research/stack-and-hosting.md)

The ticket's deciding question was who updates the shows and the songlist, how often, and from what device. It couldn't be answered yet, because the owner hears about the revamp only when it's ready to show. So the decision rests on stated assumptions: monthly updates, a songlist kept in a spreadsheet, maybe a show posted from a phone, and no developer on their side. The ADR writes them down, to be revisited after the owner interview ([#3]).

Two research agents checked this year's facts on hosting plans, redirects, forms, private previews, email forwarding, content editors and site generators. The [research doc](research/stack-and-hosting.md) has every source. What shaped the decision:

- **Netlify's free plan now runs on credits:** 300 a month, 15 for each published update, 20 per GB of traffic. When they run out, every site on the account is paused. We confirmed that on Netlify's own pages.
- **Cloudflare's redirects file can't match query strings**, which the old URLs are full of. Its zone-level rules can, once the domain's DNS points there.
- **GitHub Pages and Vercel were out.** GitHub Pages bars business sites and can't send real 301s or take a form. Vercel's free plan is for non-commercial use only.
- **A new requirement surfaced:** the preview has to stay private, because it shows the owner's content before they've agreed to anything.

Partway through, the editing plan changed. John asked whether a site kept on GitHub could later let the owner log in and edit. It can: several free editors sit on top of the files in a repo. So the plan became a handful of core files in one folder (the songlist and shows as CSVs, the pages as Markdown), updated by replacing a file on GitHub. A login gets added when the owner wants one.

Then came the decision itself. Claude recommended Cloudflare Pages, reading the core files when the site is built, and the Eleventy generator. John chose Netlify, reading the files in the visitor's browser, and a plain Node build script. That's the same pattern as his [Austin Karaoke Directory](https://github.com/Johnesco/karaokedirectory), which he already knows how to run. The ADR records the runners-up and the tradeoffs he took on:

- the credit cap
- pages that need JavaScript to appear
- no free private preview

One piece kept most of the safety of building from the files: a plain Node check runs before every deploy, so a bad upload stops the deploy instead of breaking the live site.

The takeaway for the process: a recommendation is an input, not the decision. The person who owns the decision makes it, and the ADR keeps both, so the reasoning survives.

Five build tickets came out of it:

- convert the working copy into the core files ([#10])
- the songlist page with search ([#11])
- upcoming shows ([#12])
- the pages and post archive ([#13])
- redirects for every old URL ([#14])

Netlify stays the plan, but for now everything is built and previewed on John's machine.

### 2026-09-23 · The core files

**Milestone · Decision · Finding** · [#10] · [ADR-002](adr/002-core-file-formats.md) · [the converter](../scripts/convert-working-copy.py) · [the check](../scripts/lib/check-content.js)

ADR-001 said that everything that changes would live in a few core files. This step decided what exactly those files look like, converted the working copy into them, and started the gate that checks them.

**The decisions.** Claude proposed the formats, and John decided four questions:

- **Themed lists become columns.** The audit had suggested a theme tag on each song, so that December's SAD SONGS ONLY list stops being copied by hand. John took the idea further. The songlist gets two new columns: Themes, for the themed lists a song is on, and Tags, for categories to browse by. Each can hold several values. One special theme, `unlisted`, takes a song off every list without deleting it. Claude added two refinements: semicolons between values, so a cell never needs CSV quotes, and a check that refuses an export without the new columns, so hidden songs can't silently come back.
- **Plain Markdown, with no HTML.** Pages and posts can't carry raw HTML, so the site can escape everything, and a third-party player appears only if the site adds it on purpose. The 9 YouTube players and one Instagram embed became links.
- **Images keep WordPress's year/month folders,** so one redirect rule will cover old links to them.
- **The shows wait.** How events get updated isn't decided yet. So the shows stay as the snapshot found them, and the homepage and calendar ticket ([#12]) waits with them.

**The conversion.** A small script, standard library only, converted everything in one pass: 1,853 songs, 6 pages, 46 posts and 57 images. It stops at anything it has no rule for. It removes the old files only after checking that every song, image and link came across, and that each page and post reads word for word as before.

A second, stricter check went further. It rendered all 52 Markdown files with a real Markdown parser and compared them with the original HTML, character by character. That covered every bold, italic and struck-through character, all 2,641 line breaks, every link and all 33 images. They matched.

That second check earned its keep. The script's first version dropped the backslash that marks a line break, and a word-by-word comparison can't see that. The check also caught a parser quirk: escaped characters vanish from image descriptions. So the script now leaves an underscore inside a word, as in `IMG_3103`, unescaped. It can't start italics there anyway.

The conversion changed the format and nothing else. The fixes to the content went into a separate commit, so each kind of change can be reviewed on its own.

**Findings along the way:**

- **The songlist loses accented letters.** On the live site, Björk appears as "Bjrk", Hüsker Dü as "Hsker D" and Susanne Sundfør as "Sundfr". The owner's own posts spell them right, so the letters go missing somewhere between the owner's spreadsheet and the page. We restored the names in our copy. The export still needs fixing where it happens, though, and a check can't catch this: a missing letter isn't garbled, just gone.
- **The themed lists match the master list almost perfectly.** 530 of the 542 songs on the 2025 sad list matched on their own. The other 12 were the lost accents, one typo on the master list, and four names written differently. All 542 are now tagged `sad`.
- **The song count on the songlist page was typed by hand, and it was already wrong:** it said 1,854 for 1,853 songs. The site will count them instead.

**The gate.** `npm test` now runs 54 unit tests, then a check of the content, with no dependencies and no network.

- **It fails** on anything that would break the site, lose something, or publish something it shouldn't: a missing or extra column, a duplicate song, garbled characters, HTML in a post, a broken image link, or a cut-off songlist.
- **It warns** about things worth a look. Right now that's 8 images with no description for screen readers, and the empty Photos page.

### 2026-09-23 · The new site renders

**Milestone · Decision · Challenge** · [#13] · [#11] · [ADR-003](adr/003-clean-paths-one-shell.md) · [ADR-004](adr/004-own-markdown-renderer.md)

John set three priorities:

1. Get the new site rendering.
2. Make it responsive.
3. Make the songlists work with themes and tags.

Until then, the local preview showed only a folder listing of the content.

**The decisions.** Claude proposed options, and John chose:

- **Re-scoped tickets.** The site shell and the pages come first ([#13]), then the songlist ([#11]).
- **Clean paths** like `/songlist/`, all served by one page shell ([ADR-003](adr/003-clean-paths-one-shell.md)). Locally, a small Node server does what Netlify's rewrite rule will do later.
- **A Markdown renderer of our own** instead of a library ([ADR-004](adr/004-own-markdown-renderer.md)).
- **Plain styling for now.** The design comes later, with the owner.

**Priority 1: every page renders.** One HTML shell reads the address and renders the matching core file:

- the home page, with the latest posts
- the six pages
- an archive of all 46 posts, by year
- each post
- a not-found page

Links in the Markdown point at files, so they also work in GitHub's preview, and the site turns them into paths.

**Testing the renderer against a reference.** A hand-written Markdown renderer is easy to get almost right, so its output was compared with markdown-it, a widely used implementation of the CommonMark standard.

- **The real content:** all 52 pages and posts came out identical.
- **Random input:** 36,000 random strings of Markdown syntax went through both, built from asterisks, brackets, backslashes, line breaks, and list and quote markers.

This differential testing found four real bugs, all in how a line that has lost its quote or list marker continues a paragraph. All four were fixed before anything shipped. The 22 differences left are corners where markdown-it itself departs from the standard, or where the two reasonably differ, and none of them appears in the content. The comparison also caught the markdown-it quirk from the conversion, where escaped characters vanish from image descriptions. Our renderer doesn't have it.

**Priority 2: responsive.** The styles start from a phone, and wider screens only add room. All 55 paths were loaded at 320, 375 and 768 pixels wide and measured. Nothing scrolls sideways, text stays at 16px, and touch targets are at least 44px. The old site, by contrast, shrank its fixed 960px layout to 38% on a phone.

**Priority 3: the songlist.** Search narrows the 1,853 songs as you type.

- **Every word counts, in any order.** Each word has to appear in the artist, title or album, and accents, case and punctuation don't count. "ryan adams" finds "Adams, Ryan", and "bjork" finds Björk. That only works because the conversion restored the accents the old export had dropped.
- **Themed lists.** Buttons switch between the whole list and the themed lists: Sad (542) and Scary (166). Each list has an address to share, like `/songlist/?theme=sad`, so the December show can link straight to its list.
- **Hidden and tagged songs.** Songs marked `unlisted` appear nowhere, and tag filters appear once songs have tags.
- **Screen readers.** A status line tells screen reader users how many songs match, once typing pauses.
- **Nothing typed by hand.** The count and the "updated" date are computed, the date from the content repo's history.

On a phone the page renders in about half a second.

**Challenges:**

- **A bug only a screenshot showed.** Opening a shared address showed "Showing all 1,853 songs" for 0.4 seconds before correcting itself. The status line waited for typing to pause even when the page first opened.
- **A stale server.** The dev server doesn't reload its own code. A change to how it builds the content index looked like a bug in the page, until the server was restarted.

**The Media and Photos pages.** Every press link on the Media page was checked by hand:

- **Dead or misdirected:** four links were dead, and three landed on a section front page or on someone else's site. Those now point to the Wayback Machine's copies.
- **Moved:** four articles had moved, and their links point to the new addresses.
- **Missing:** one entry that never had a link got one.

The empty Photos page now links to Instagram.

### 2026-09-23 · White on black

**Decision** · [#13]

The owner asked for white text on black, wherever possible. That's how the old site looked, so their photos and flyers were made to sit on black.

- **Everywhere:** the whole site switched, including the search box and the browser's own controls.
- **No inverted panels:** a picked songlist button shows a white border, bold text and its filled radio button, instead of turning white.
- **Accessible:** every text colour was measured on every page. White text on black is 21:1 and the gray for dates and counts is 9:1, where WCAG asks for at least 4.5:1.

### 2026-09-23 · A Photos page worth visiting

**Decision · Finding** · [#18] · [#13] · [ADR-005](adr/005-photos-gallery.md)

Two requests from John. First, the post archive gets a place in the menu. It was only reachable from the home page and from each post.

Second, the Photos page should be more than a link to Instagram. Could it frame the Instagram page? We checked, and it can't:

- **No framing.** Instagram sends `X-Frame-Options: DENY` on its profile pages, so browsers refuse to show them inside another site.
- **Embeds are post by post.** Instagram's official embeds work for single posts only.
- **A live feed needs the owner's account.** It means connecting the account to a widget service. A lapsed connection like that is exactly why the old Photos page went blank.

**Chose:** a gallery of the owner's own photos, plus a card linking to their Instagram. The photos were already in the content, unshown: the old homepage slideshow had shown 8 of them, from uploads that held 11 more. All 19 are the night itself, singers mid-song with the lyrics on the wall behind them.

- **Small copies.** At full size the 19 photos are 19.3 MB, too much for a phone at a bar. A small script makes copies that total 838 KB. It strips each photo's metadata, so no camera or location data goes with it, and rerunning it gives the same bytes.
- **Described.** Each photo has a written description for screen readers. The descriptions leave out the lyrics on the screens and any guess about who's singing.
- **Nothing from Instagram loads.** The card is a link, so there's no third-party script and no tracking.

**A bug John found, and why the checks missed it.** On a desktop, choosing the Sad or Scary list changed the count but not the list. The filter hid each row with HTML's `hidden` attribute. But on wide screens the stylesheet laid the rows out with `display: grid`, and a site's own CSS overrides the browser's rule that hides `hidden` elements. On phones it worked, and every automated check had read the `hidden` attribute rather than what was actually drawn, so they all passed. The fix is one line of CSS, and a test now guards it. The lesson: check what the reader sees, not what the code set.

**A plan that changed while building:** the idea was that the owner could add a photo just by dropping it into a folder. But every photo needs a description, and the description needs a place. So a photo gets one line in the Photos page's Markdown, with its description, next to where it's listed.

### 2026-09-24 · A historical post, and a link to the current list

**Decision · Process** · [#19], [#21]

The SAD SONGS ONLY 2025 post carries its own copy of that year's list, 542 songs pasted one per line, and the songlist now holds the same songs as its Sad list ([2026-09-23 · The core files](#2026-09-23--the-core-files)). John asked for the post to point at the songlist instead, if the two lists matched.

**Comparing first.** A script paired every song in the post with a song on the songlist's Sad list, one to one:

- **542 and 542,** with no duplicates and nothing left over on either side.
- **537 matched exactly.** Several of them only because the conversion had restored the accents the old export dropped.
- **5 were the same songs, spelled differently,** like "National" against "The National".

**Then a change of mind.** The first rewrite swapped the pasted list for a link to the songlist filtered to the Sad list. But a link shows the Sad list as it is when someone clicks it, so next year the 2025 post would have shown the 2026 list. John decided the post is historical:

- **The 2025 list stays,** word for word, as the record of that show.
- **A note at the top** links to the current Sad list at `/songlist/?theme=sad`, for anyone who wants this year's list.

Both versions are in the content repo's history. Trying the first version is what showed the problem.

**Then Scary-oke, the same way** ([#21]). The songlist's other themed list came from a post too: Scary-oke, from October 2022. Its 166 songs still match the Scary list one to one, every name identical, so this time no spellings needed matching. It got the same treatment: the 2022 list stays, and a note at the top links to the current list at `/songlist/?theme=scary`.

### 2026-09-24 · Sorting by moving a column

**Decision · Challenge** · [#22] · [ADR-006](adr/006-sort-by-moving-a-column.md)

John asked for a minimal way to sort the songlist by title or album, not only by artist, and sketched the design himself: the column names above the list are the control. Touch Title, and the Title column moves to the front with an animated shift, and it becomes the bold one, as Artist was.

**The details, settled in ADR-006 before any code:**

- **The column names show on phones too.** Phones had none: each song read "Artist – Title", with the album below. Now a row of three names sits above the songs, and whichever is first leads each song, in bold.
- **Words count, punctuation doesn't.** Sorting ignores case, accents and punctuation. We tried two rules against the owner's own order. Ignoring a leading "The" or "A" in titles would have moved 82 songs, mostly within one artist's songs. Counting every word moves 16, all because of punctuation or case, like a title that starts with a bracket. The owner already files "Zombies, The" under Z, so their list agreed with the second rule.
- **One direction.** A to Z only, so a second touch doesn't need a second meaning.
- **Screen readers hear each song in the order shown,** as "title, by artist, from album", from words hidden on screen, and the status line says how the list is sorted.
- **The address keeps it.** `/songlist/?theme=sad&sort=title` opens the Sad list sorted by title.

**A slow first version.** The first working version took 1.2 seconds to sort. The animation measured where the songs on screen had moved to, and it started each song's animation as soon as it had measured that song. Every measurement after an animation started made the browser lay out all 1,853 songs again, once for every song on screen. Measuring everything first and then starting the animations brought a sort under 200ms. Most of what was left was the browser laying out every song after each sort, the hundreds off screen included. A CSS setting, `content-visibility: auto`, lets it skip the songs nowhere near the screen. Timed side by side, alternating the two versions, a sort went from 697ms to 169ms, and with the page loaded normally it takes about 44ms. Single timings in a background tab varied fivefold from one run to the next, so only the alternating runs could be trusted.

**Then John refined it for phones.** The column names now pile up the way each song does: the first two on the top line with a dash between them, and the third below. So the header reads as a key to the songs under it. Touching a name brings it to the front of the top line, and it slides there, across and between the lines. Each name still has a 44px target: the spare room sits above the top line and below the bottom one, so the two lines of names sit as close together as a song's two lines.

**And a label, picked from mockups.** Nothing yet said the names sort. Claude mocked up three ways to show it: a "Sort by" label like the one over the List buttons, borders like the List buttons have, or both. John picked the label. It sits above the names in the same style as "List", so the page's three controls are named the same way: List, Search and Sort by. Screen readers hear it as the name of the group. To keep the label closer to the names than to the status line above it, the top line of names now splits its spare room above and below its words.

**Around it, the same page got smaller changes** ([#11]). The list buttons pack tighter, since more themed lists are coming. The search box has an X to clear it. "Search" now sits beside the box as a one-word label, where "Search the songlist" used to sit above it, and screen readers still hear the whole phrase.

**Then a prune.** John noticed the song count showing three times: in the line under the title, on the All songs button, and in the status line. Claude mocked up a rule, each fact shown once, where it's most useful, and John kept one exception: the Sad and Scary buttons keep their counts. The count lives in the status line above the songs, the one line that follows the lists and the search. The date sits alone under the title. The page's own text, a link to a Spotify playlist, now comes after the songs. On a 375px phone the first song moved up 114px, and the first screen shows four songs instead of two. Later that day John put the total back on All songs, so every list button shows its size, renamed the List label "Lists", and moved the date to the foot of the songs.

### 2026-09-24 · The old left menu, in the old site's other font

**Decision · Finding** · [#23] · [ADR-007](adr/007-left-menu-in-sprayme.md)

On wide screens the menu ran long across the top. The old site had stood its logo and menu in a column on the left, with the menu in a big, distressed punk face, and John asked about bringing both back. We're still prototyping, so the question was only what we're allowed to use.

**The fonts' own files answered it.** The old theme carries two fonts, and each file states its licence:

- **ALL AGES,** the menu's, is the demo version of a font by KC Fonts: "for personal use only", with commercial use arranged through the designer. A business's site isn't personal use.
- **SprayME,** the titles', is Creative Commons BY-SA 3.0: any use, with a credit.

So the left column came back in SprayME, with the credit in the footer and a note of the licence beside the font file. Reading the font's character map showed it covers only letters and digits, with no accents, dashes or curly quotes, so it sets the seven menu words and nothing else. Titles keep the system font. Phones keep the top menu and never download the font. If the owner ever licenses ALL AGES, it replaces SprayME in one line of CSS.

Later the same day, KU's mark went into the lower right corner of every page too ([#26]): a faded logo, cut off by the corner so its top-left two thirds show, made in CSS from the same image the header loads, behind the text and out of the way of taps. Over its brightest part, grey text keeps 7:1 contrast. It disappears for anyone whose system asks for more contrast.

### 2026-09-24 · Posts leave the menu

**Decision** · [#24] · [ADR-008](adr/008-posts-from-the-home-page.md)

To cut the menu down, John took Posts out of it. The home page already listed the five latest posts with a link to all of them, so it became the way in, and the logo leads there from every page. The menu is back to the old site's six links, and on the narrowest phones it now fits in two rows instead of three. Now that the logo is the way home, it got a full 44px touch target, and the home page marks it as the current page, as the menu does for the others.

### 2026-09-24 · The songlist becomes the home page

**Decision · Process** · [#25] · [ADR-009](adr/009-songlist-home-four-sections.md)

A few hours after the posts took over the home page, John looked again: the posts are either old or a lot of work to keep up, and the songlist should come first. Before suggesting anything, Claude sorted everything under each menu title:

- **The posts are mostly history.** 27 of the 46 are notices for past shows and tours, 9 are themed song lists the songlist now holds, 5 are song spotlights from 2014, 4 are year-in-review posts, and 1 is site news. The newest one that isn't a list is from March 2022.
- **Three pages were thin.** Contact was 30 words and Media a press list, and About and Calendar carried the same "shows monthly, book us" paragraph.

Claude mocked up a regrouping in three sections, and John kept Photos in the menu, which made four:

- **Songlist** is the home page.
- **Shows**, once Calendar, says the booking paragraph once and links to past shows.
- **Photos** stays as it was.
- **About** takes in Contact, as "Get in touch", and Media, as "In the press".

The posts all keep their addresses, as an archive linked from Shows and About. The old page paths land on their new homes, and the posts' links to the songlist now go straight to `/`. On a 375px phone the four links fit on one row, so the header dropped from 105px to 61px.

**A decision that lasted an afternoon.** ADR-008, which made the home page the way to the posts, was superseded by ADR-009 the same day. Prototyping fast means some decisions turn over fast, and the ADRs keep the trail of why.

[#1]: https://github.com/Johnesco/karaokeunderground/issues/1
[#2]: https://github.com/Johnesco/karaokeunderground/issues/2
[#3]: https://github.com/Johnesco/karaokeunderground/issues/3
[#4]: https://github.com/Johnesco/karaokeunderground/issues/4
[#5]: https://github.com/Johnesco/karaokeunderground/issues/5
[#6]: https://github.com/Johnesco/karaokeunderground/issues/6
[#7]: https://github.com/Johnesco/karaokeunderground/issues/7
[#8]: https://github.com/Johnesco/karaokeunderground/issues/8
[#9]: https://github.com/Johnesco/karaokeunderground/issues/9
[#10]: https://github.com/Johnesco/karaokeunderground/issues/10
[#11]: https://github.com/Johnesco/karaokeunderground/issues/11
[#12]: https://github.com/Johnesco/karaokeunderground/issues/12
[#13]: https://github.com/Johnesco/karaokeunderground/issues/13
[#14]: https://github.com/Johnesco/karaokeunderground/issues/14
[#18]: https://github.com/Johnesco/karaokeunderground/issues/18
[#19]: https://github.com/Johnesco/karaokeunderground/issues/19
[#21]: https://github.com/Johnesco/karaokeunderground/issues/21
[#22]: https://github.com/Johnesco/karaokeunderground/issues/22
[#23]: https://github.com/Johnesco/karaokeunderground/issues/23
[#24]: https://github.com/Johnesco/karaokeunderground/issues/24
[#25]: https://github.com/Johnesco/karaokeunderground/issues/25
[#26]: https://github.com/Johnesco/karaokeunderground/issues/26
