# Legacy site audit

Spike [#1](https://github.com/Johnesco/karaokeunderground/issues/1), 2026-09-23. It covers what karaokeunderground.com contains and does today, so the rebuild keeps what matters and redirects every URL that moves.

Everything here was gathered from outside the site: the public pages, the WordPress REST API, DNS and RDAP lookups, the Wayback Machine, one search-engine query, and a check in a phone-sized browser. Nothing needed a login. Answers that need the KU hosts, wp-admin or the hosting account are listed under [Open questions](#open-questions).

Every known URL is in [`urls.csv`](urls.csv) (212 rows). It becomes the redirect map.

> This repo is public. The audit leaves out plugin versions and admin details on purpose.

## Summary

1. **The songlist is the site's main job, and it's close to unusable on a phone.** It's 1,853 songs in one 448 KB table, in a fixed 960px layout that phones shrink to 38%, with no search. It's updated every month or two from what looks like a spreadsheet export, and the date and count are typed by hand.
2. **Upcoming shows live in at least four places that disagree:** the homepage (HTML hardcoded in the theme template), the Calendar page (stale), Facebook events, and the [Austin Karaoke Directory](https://github.com/Johnesco/karaokedirectory). Updating the homepage list means editing a theme PHP file.
3. **Every URL is a query string** (`/?page_id=16`, `/?p=835`). `http://` isn't redirected to `https://`, and search engines mostly index the `http://` URLs. The new host must redirect on query parameters.
4. **The pre-WordPress site from 2004–2013 is still live:** 30 pages, including a 2013 songlist with 688 songs, and 413 photos (72 MB).
5. **The domain's email runs on the web server.** The MX record points at the domain itself, so pointing the domain at a new host without moving mail first breaks email. The domain has no SPF, DKIM or DMARC.
6. **The domain expires 2027-01-15.** It's registered through a GoDaddy reseller (Wild West Domains) and carries a renew lock. Someone has to confirm who can renew it.
7. **The Photos page is empty.** Its Instagram feed has no connected account, and both Instagram plugins are dead. There are no analytics.

## 1. Pages, posts and URLs

### URL scheme

- **Plain permalinks.** Pages are `/?page_id=N` and posts are `/?p=N`. Archives use `?cat=`, `?tag=`, `?m=YYYYMM`, `?author=1` and `?paged=N`. `/songlist/` returns 404 (the Wayback Machine caught someone trying it in 2021).
- **`?p=` also works for page IDs:** `/?p=16` 301s to `/?page_id=16`. The redirect rule for `p` must cover the six page IDs too.
- **HTTP isn't redirected.** Both `http://` and `https://` serve every page. WordPress's site address is `http://`, so internal links and most search results use it. `www.` 301s to the apex and keeps the path and query.
- **The site's fonts only work over `http://`.** The theme uses two web fonts: All Ages for the menu, and Spray Me for post titles, dates and headings. Its stylesheet loads them from `http://` addresses, and browsers block those on the `https://` site as mixed content. So over `https://` the menu falls back to Futura on Apple devices and Arial elsewhere, and the headings to Futura or Verdana. The designed look shows only over `http://`, and in the reference copy from #6, which serves the fonts itself. The All Ages files are named as a demo version, so check its licence before the revamp reuses it.
- **No `robots.txt` and no sitemap.** Both return 404, because plain permalinks mean no rewrite rules. The server's 404 page is itself broken: Apache reports a second 404 while looking for its error document.
- **For [#2](https://github.com/Johnesco/karaokeunderground/issues/2):** the new host has to match query parameters in its 301 rules, for example `/?page_id=16` to the new songlist URL. Static hosts differ on this.

### WordPress pages

| Page | URL | Last edited | State | Notes |
|---|---|---|---|---|
| Songlist | `/?page_id=16` | 2026-09-05 | current | 1,853 songs in one table ([§3](#3-the-songlist)) |
| Calendar | `/?page_id=8` | 2026-08-01 | stale | Lists 8/1, 9/5 and 10/3; two of them are past. Doesn't match the homepage list |
| About | `/?page_id=6` | 2021-11-13 | current | The hosts, KU since 2004, band links. Its intro differs from the homepage's |
| Contact | `/?page_id=10` | 2014-11-20 | current | Contact Form 7 ([§4](#4-the-contact-form)) |
| Media | `/?page_id=12` | 2021-11-13 | stale | 15 press entries from 2010–2016: 3 links are dead, 3 land on a section front page, and 1 has no link. 4 YouTube embeds |
| Photos | `/?page_id=14` | 2018-01-29 | broken | Instagram Feed has no connected account. The error is hidden by CSS, so visitors see an empty page |

### Posts, media and archives

- **46 posts**, from 2013-09-15 to 2025-12-27. One account published all of them, and there are no comments. 45 posts are Uncategorized; 6 tags are used once each.
- **Posting has slowed:** 16 posts in 2014 and 9 in 2015, then 0 to 5 a year. There were none in 2020, 2023 or 2024; the 2024 list reused a 2022 post. The one regular post now is the December *SAD SONGS ONLY* list.
- **8 posts are themed or ranked songlists:**

  | Post | Year | Contents |
  |---|---|---|
  | `/?p=390` Spoon : Hot Songs | 2017 | 54 Spoon songs |
  | `/?p=499` 2018 Top Tens | 2019 | Most-sung lists, written Title – Artist |
  | `/?p=501` Sing The Unsung | 2019 | 89 songs nobody had sung |
  | `/?p=576` 6th Annual SAD SONGS ONLY | 2019 | About 250 songs |
  | `/?p=646` SAD SONGS ONLY 2022 | 2022 | 261 songs, in a table rather than lines (one long title wraps onto a second row) |
  | `/?p=679` Scary-oke on 10.27 | 2022 | About 165 songs |
  | `/?p=692` SAD SONGS ONLY – DEC 26 2024 | 2024 | 515 songs. Created 2022-12-28 and rewritten for 2024, so this URL's content changed |
  | `/?p=835` SAD SONGS ONLY 2025 | 2025 | 542 songs |

- **The other 38 posts** are dated news and event posts. They're history, not errors.
- **Media library:** 53 images (41 MB) from 2013–2022, all self-hosted, 17 not attached to any post. 25 of the 33 images in page and post content have alt text.
- **Archives:** 31 monthly, 10 yearly, 4 category, 6 tag, 1 author and 4 "older posts" pages. There's also an RSS feed linked from every page, and one attachment page per image (`/?attachment_id=N`).

### The pre-WordPress site is still live

The domain dates from 2004 and WordPress arrived in 2013 (post `/?p=1`, "New Site"). The static site's files were never removed:

- **30 of the 33 old pages the Wayback Machine knows about still return 200:**
  - `/songlist.html` ("Updated 6.15.13 :: 688 songs") and `/calendar.html` (shows from May–June 2013)
  - `/contact.html` and `/links.html`
  - three photo pages, and 22 photo recaps of shows from 2004–2005 such as `/trophy's6-16.html`
  - one unrelated page, `/craigslist.html`

  `/forum/` is live too. It's a static news page, not forum software.
- **413 photos (72 MB) from 2004–2007** sit under `/images/` and the site root, and all are still live.
- **Nothing on the current site links to them,** but old inbound links and search engines still reach them. The risky one is the old songlist, with about a third of today's songs.

### Where the URL list comes from

The REST API gave every public page, post and image. The Wayback Machine has captured 754 distinct URLs on the domain since 2004. A crawl of the old static pages found the files they link to. A search-engine query showed what's indexed: the homepage, About, Calendar, Media, `/?m=202206`, `/?author=1` and two posts, mostly as `http://`. The `evidence` column in [`urls.csv`](urls.csv) records the source of each row.

## 2. Content types: how often they change, and who changes them

| Content | Where it lives | How it's edited | How often | Evidence |
|---|---|---|---|---|
| Upcoming shows, homepage | HTML in the KU theme template | The theme file editor, or file access to the server | Kept current by hand: it starts at the next show and runs to 1/2 | It isn't in the REST API and has no widget markup. 5 of its 7 links go to the same Facebook event, including a show at a different venue |
| Upcoming shows, Calendar page | A WordPress page | Page editor | Irregular; last 2026-08-01 | Stops at 10/3 |
| Shows elsewhere | Facebook events, the Austin Karaoke Directory, Do512, venue sites | Each on its own | Per show | The directory has Knomad's first Saturdays and two February one-offs, and none of the one-offs on the homepage now |
| Homepage intro | HTML in the KU theme template | Theme file | Rarely | Its artist list has drifted from the About page's |
| Master songlist | A WordPress page holding one pasted table | Paste a regenerated table, then type the date and count | Every month or two; since 2023, usually on the day of the first-Saturday show | 34 versions in the Wayback Machine, 2015–2026 |
| Themed songlists | Blog posts | Hand-copied subsets of the master list | Once a year (December), plus one-offs | 8 posts |
| News posts | Blog posts | Post editor | About once a year since 2017 | Post dates |
| Photos | The homepage slider (8 photos, 2015–2018) and Instagram | Slider admin; the Instagram app | Nothing new on the site since 2018 | Media dates |
| About, Media, Contact | Pages | Page editor | Rarely (2014, 2021) | Last-edited dates |

**Who:** one WordPress account publishes everything, so the site can't show who does what. The About page names the hosts, Hannah and Kaleb, who have run KU since 2004, and the posts are written in the first person. Who edits what, and from which device, is the first question for the hosts.

**How the songlist has grown** (the "Updated" line on archived copies of the page):

| Date on the page | Songs |
|---|---|
| 2.7.15 | 894 |
| 1.6.16 | 1,054 |
| 7.21.18 | 1,213 |
| 12.1.19 | 1,279 |
| 11.13.21 | 1,309 |
| 9.2.23 | 1,545 |
| 10.26.24 | 1,719 |
| 5.2.26 | 1,844 |
| 9.5.26 | 1,854 (the table has 1,853) |

That's roughly 100 to 150 songs a year. The Wayback Machine caught at least seven updates in each of 2019 and 2024. Since 2023, 9 of the 12 dated updates fell on a first Saturday, the day of the standing Knomad show. The hand-typed metadata drifts: in 7 of the 10 versions since March 2024 the stated count was off by 1 to 5, and one date reads "4.426".

## 3. The songlist

- **Size:** 1,853 songs by 752 artists. The biggest are Magnetic Fields (75), Spoon (54) and Sleater-Kinney (27). There are no blank cells and no duplicate artist-and-title pairs.
- **Columns:** Artist, Title, Album.
- **Conventions:** solo artists are filed "Last, First" (73 of them, like *Adams, Ryan*). Six bands are filed "Band, The". Covers carry the original artist in the title, like *99 Red Balloons (by Nena)* (53 of them). The list is sorted by artist, with 3 rows out of order.
- **Accented letters are lost** (found later, in [#10](https://github.com/Johnesco/karaokeunderground/issues/10)). Nine rows name Björk, Hüsker Dü and Susanne Sundfør as "Bjrk", "Hsker D" and "Sundfr, Susanne". The owner's own posts spell them right, so the letters go missing between the spreadsheet and the page, probably in the export.
- **Where it's maintained:** almost certainly a spreadsheet. The table carries `class="excel"`, inline Futura styling and fractional row heights (`22.666666666667px`), the fingerprints of a spreadsheet-to-HTML export pasted into the page. Which app and whose copy is an open question.
- **What reading it is like:** 448 KB of HTML and 7,499 DOM elements, 48,574px tall at phone width. There's no search, so finding a song means scrolling or find-in-page. The header row uses `td`, not `th`. The inline styles name Futura with no fallback, and Futura ships only on Apple devices, so Android phones render the table in a default serif.
- **The same data as CSV is about 90 KB.**
- **Related:** a Spotify playlist of most of the songs, linked from the page. The themed lists are Artist – Title subsets, copied at different times, so names drift between them: 2022 has *Andrew Jackson Jihad* and *Boygenius*, and 2025 has *AJJ* and *boygenius*.
- **Data kept offline:** the 2019 *Sing The Unsung* post says the hosts have tracked which songs get sung since 2014, and *2018 Top Tens* ranks the most-sung. That's worth knowing about, not a requirement.

## 4. The contact form

- **Contact Form 7, one form:** Name (required), Email (required), Subject and Message.
- **Where submissions go:** the address isn't in the page source, which is good. It's set in wp-admin; see the open questions.
- **Spam:** there's no CAPTCHA, honeypot or quiz in the markup, and no reCAPTCHA or Akismet script on the page. Server-side filtering can't be seen from outside.
- **Delivery:** the domain publishes no SPF or DMARC record, and there's no DKIM key at the common selectors (`default`, `google`). Mail sent as `@karaokeunderground.com` risks being junked or rejected by Gmail and other large providers. Nobody outside can tell whether the form's notifications arrive today. One test message answers it.
- **Accessibility:** the fields have no `label` elements, so screen readers announce unnamed text boxes. "(required)" is plain text.
- **Copy:** the page says "Subscribe to our email list for monthly updates", but there's no sign-up. Whether an email list exists is an open question.

## 5. Integrations and embeds

| Integration | What it does | State | Recommendation |
|---|---|---|---|
| Contact Form 7 | The contact form | Works; delivery unverified | Replace with the new stack's form handling and spam protection |
| MetaSlider | The homepage slider: 8 photos from 2015–2018 | Works; all 8 have empty alt text. It also bundles the Extendify SDK and a MetaGallery API, neither visibly used | Drop it, or use one or two static photos |
| Instagram Feed | The Photos page feed | Broken: no connected account | Drop. Link to Instagram, or build a small static gallery |
| Simply Instagram | Loads its CSS and JS on every page | No visible output; built on Instagram APIs that were retired | Drop |
| Admin-only plugins | At least one; the page source can't show them | Unknown | Get the full list from wp-admin |
| YouTube | 4 embeds on Media, 5 in 2014 posts, a channel link | Works | Keep as links, or as embeds that load on click |
| Facebook | The page link and a link for each show | Links only; no Facebook scripts on the site | Keep the links. Facebook events are where shows are announced |
| Spotify | The master playlist and themed playlists | Links; they work | Keep |
| Instagram, X/Twitter | Icon links in the header | Links; the icons have no alt text | Keep the ones still in use (open question) |
| Analytics | None | No analytics or tracking scripts at all | Decide whether the new site needs any |

Apart from YouTube's embedded players, every script and stylesheet is served from the site itself.

## 6. Hosting, domain, DNS, email and analytics

| Item | Finding | What it means for the cutover |
|---|---|---|
| Hosting | LinkSky shared hosting, server `ls-sv131e.linksky.com` (208.69.220.131). Apache and PHP 5.6.40. `cpanel.`, `webmail.` and `ftp.` point at the same server | Keep the account until mail and files have moved |
| DNS | Run by LinkSky. The registry delegates to `ns1`/`ns2.linksky78.com`, while the zone lists `ns1`–`ns3.linksky.com`. The first two are the same servers under both names; `ns3` appears only in the zone. No DNSSEC | Moving DNS means recreating every record, and the new host should get one consistent nameserver set. There's no DNSSEC to unwind |
| Records | Apex `A` 208.69.220.131. `www` and `mail` are CNAMEs to the apex. `MX 0` points at the apex. No TXT records (so no SPF), no DMARC, no CAA | Copy them all, then fix the email ones |
| Email | The MX record points at the domain itself, so mail lands on the web server | **Pointing the domain at a new host moves mail with it, and mail breaks.** First confirm whether any `@karaokeunderground.com` addresses are in use. If so, before cutover either move mail to a mail provider, or point MX at a separate host record that keeps the LinkSky IP. `mail` is a CNAME to the apex today, so it would move too |
| Registrar | Wild West Domains, a GoDaddy reseller platform. Registered 2004-01-15, **expires 2027-01-15**. The registry shows all four client locks, including the unusual `clientRenewProhibited` | Renew before it lapses. Find out whose account holds it (possibly the host's reseller account) and who can change its nameservers |
| TLS | A Let's Encrypt wildcard certificate that the host renews; the current one runs to 2026-11-04 | The new host issues its own |
| HTTPS | Served but not enforced: `http://` returns 200 | The new site should 301 `http://` to `https://` |
| Analytics | None on the pages. Hosts like this often keep server-log statistics in the control panel | Possibly the only traffic data. Export it before closing the account |

## 7. The hosts' pain points and wishes

**Unanswerable from outside.** This needs the hosts themselves; see [Open questions](#open-questions). The audit suggests what to ask about. These are hypotheses, not findings:

- Updating shows in two places on the site, plus Facebook and the directory
- Editing a theme file to change the homepage list
- The monthly export, paste, and hand-typed date and count for the songlist
- Copying themed lists by hand
- The empty Photos page
- Reading the songlist on a phone at a show

## Phones and accessibility today

This is the baseline the rebuild has to beat:

- **Not responsive.** The layout is a fixed 960px wide, so a 375px phone shrinks it to 38%. The 15px body text renders at about 6px and the songlist's 12px at about 4.6px, and everything needs pinch-zoom.
- **The homepage is 42,725px tall on a phone,** because the latest post renders in full: all 542 songs.
- **Images and links:** 19 of the homepage's 33 images have no alt attribute. The logo and three social icons are links with no accessible name.
- **Forms:** the contact fields have no labels.
- **Structure:** the show list is links separated by line breaks, not a list, and one show has no link. The homepage has one `h1` and an empty `h3`, and post titles aren't headings.
- **What works:** white-on-black text has strong contrast, and the page declares its language.

## Security notes

- WordPress 5.8 and PHP 5.6 are years past end-of-life, and current WordPress and plugin releases need a newer PHP, so the site can't be brought up to date where it stands. The rebuild is also the security fix, and a long overlap only prolongs the exposure.
- Nothing on the current site should be ported. Export the content, not the code (as CLAUDE.md already says).
- The pre-WordPress files are plain HTML and images, so they add staleness, not much risk.

## Recommendation

**Rebuild these. They are what the site is for:**

1. **The songlist:** phone-first and searchable, generated from data so the date and count are computed, not typed. Keep its columns and filing conventions, which fans already know.
2. **One list of shows** that feeds both the homepage and a calendar, drops past shows on its own, and links each show to its own event (or to nothing).
3. **Themed songlists as views of the master list,** with a theme tag on each song instead of a hand-copied post. The tradeoff: the songlist data needs a theme column. The old posts stay as they are for the record.
4. **About, Media and Contact,** with dead press links swapped for Wayback Machine copies and a form that has labels and spam protection.
5. **The 46 posts, as a plain archive.** They're small and static, 8 of them are songlists, and migrating them keeps every indexed URL landing on real content. The alternative is redirecting all of them to the homepage: less work once, but it throws away history that people search for.

**Retire these:** the Photos page (link to Instagram, or build a small static gallery), the slider, and both Instagram plugins.

**The hosts' call: the pre-WordPress site.** They can keep it as a read-only archive (72 MB of 2004–2007 photos that fans may treasure) or retire it. Either way, `/songlist.html` and `/calendar.html` should redirect to the new songlist and calendar, because they're stale pages people can still land on.

**Carry into #2, the stack decision:**

- The hosts change shows and the songlist every month or so. The stack has to let them do that without touching code or HTML. Whether it has to work from a phone is the first question for them.
- The host must support 301s matched on query parameters.
- The songlist has 1,853 rows (about 90 KB as CSV) and grows by 100 to 150 a year. That's small enough to ship whole and search in the browser.
- Nothing on the site needs a database except the contact form, which needs a form handler with spam protection.
- The Austin Karaoke Directory also lists KU's shows. One source feeding both is worth weighing.
- **The songlist's source of truth is a real tradeoff.** Keeping the hosts' spreadsheet means no new tool for them, but it needs an export and import step that someone runs. Moving it into a CMS allows direct edits, but editing nearly 2,000 rows in most CMS screens is clumsy, and it's a new tool to learn.

**Do now, whatever the stack:** confirm who controls the domain and that it renews before 2027-01-15, and send one test message through the contact form.

## Open questions

For the hosts, or for whoever has wp-admin and hosting access.

**Editing and pain points**

1. Who updates what today: shows, the songlist, themed lists, posts and photos? From which device? (This is the deciding question for [#2](https://github.com/Johnesco/karaokeunderground/issues/2).)
2. How does the homepage show list get edited today?
3. Where does the master songlist live (which app, whose account or computer), and how does it become the page? Does that export keep accented letters? The live list has lost them ([§3](#3-the-songlist)).
4. What's painful about the current site? What do they want from the new one? What do fans ask for?

**Contact and email**

5. Where do contact form messages go, and do they arrive?
6. Is there spam filtering (Akismet, for example)? How much spam gets through?
7. Is there an email list, as the Contact page promises? On which service?
8. Are any `@karaokeunderground.com` addresses or forwarders in use?

**Accounts**

9. Who holds the LinkSky hosting account? What does it cost, and when does it renew?
10. Whose registrar account holds the domain? Does it auto-renew before 2027-01-15?
11. What's the full plugin list in wp-admin, including inactive plugins?
12. Is there any traffic data, such as server statistics in the control panel?

**Content decisions**

13. Keep the 2004–2013 static site as an archive, or retire it? Either way, a private, frozen copy has been kept since 2026-09-25, and the local preview shows it at `/old/` ([#29](https://github.com/Johnesco/karaokeunderground/issues/29), [ADR-011](../adr/011-old-site-at-old.md)).
14. Keep all 46 posts? Which themed lists matter most?
15. Which accounts are still active: X/Twitter, the Facebook page, Instagram? Which should the site link to? Today the Shows page lists all three, under "How to find out more" ([#20](https://github.com/Johnesco/karaokeunderground/issues/20)).
16. Would they want to publish the play-tracking data they've kept since 2014, like most-sung and never-sung lists?
17. Would they want the Photos page to show their latest Instagram posts by itself? Today it shows their photos from the site and a link to Instagram ([#18](https://github.com/Johnesco/karaokeunderground/issues/18), [ADR-005](../adr/005-photos-gallery.md)). A feed that updates itself needs the account to be a professional one (Business or Creator, a free switch in the app), and a one-time connection they make with their own login.

## About `urls.csv`

| Column | Meaning |
|---|---|
| `path` | Path and query on `karaokeunderground.com`. Every row works on both `http://` and `https://`, and `www.` 301s to the apex. Rows containing `<…>` are patterns |
| `kind` | `home`, `page`, `page-alias`, `post`, `archive`, `feed`, `search`, `attachment`, `uploads`, `theme-assets`, `legacy-page` or `legacy-assets` |
| `title` | Page title, or a description for patterns |
| `status` | HTTP status on 2026-09-23 (a HEAD request, not following redirects) |
| `last_modified` | WordPress's last-edited date, or the server's `Last-Modified` for old static files |
| `content_state` | `current`, `stale` (out of date and misleading), `archival` (dated history, fine as it is), `broken` or `n/a` |
| `evidence` | Where the URL came from: `rest-api`, `wayback`, `crawl`, `derived` or `search-index` |
| `notes` | What matters about it |
| `new_path` | Empty. The redirect ticket fills it in |

## Method

Requests to the site went one at a time, with pauses, under a user agent naming this repo, and read only public pages.

- **Content:** the WordPress REST API at `/index.php?rest_route=/wp/v2/…` (pages, posts, media, categories, tags, types, comments), plus the rendered pages.
- **History and inbound URLs:** the Wayback Machine's CDX API for the whole domain, then HEAD requests to each distinct URL, plus a crawl of the old static pages for the files they link to.
- **Domain and DNS:** DNS over HTTPS (Cloudflare and Google), RDAP from Verisign for the domain and ARIN for the IP, and the TLS certificate.
- **Phones:** the homepage and the songlist at 375×812 in a browser, measuring layout width, scale, page height, request weight and alt text.
- **Not done:** no logins, no form submissions, and no vulnerability scanning.
