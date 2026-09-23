#!/usr/bin/env python3
"""Pull a local copy of karaokeunderground.com for the revamp to start from (#6).

Writes two things to a gitignored snapshot/ folder:

  1. A clean copy of the content, to build the revamp from:
       songlist.csv           the master songlist: artist, title, album
       themed-songlists.csv   the 8 themed songlists from blog posts, in one format
       shows.json             upcoming shows from the homepage and the Calendar page
       pages/, posts/         one cleaned HTML file per page and post
       media/                 the uploaded images, plus the theme's logo and icons
       index.json             metadata for all of it, and the checks below
  2. reference/: an offline copy of the site as it looks today. That's the homepage
     and its older-posts pages, the pages and the posts, each with the CSS, scripts
     and images it loads. It's a before-picture, not a base: don't build from it.

snapshot/README.md says what's in it and lists anything that needs a human look,
starting with the upcoming shows.

The snapshot is the owner's content, and this repo is public, so it never gets
committed. The script reads public pages and WordPress's public API only, one
request at a time. A snapshot is a record of the site on the day it was taken,
so the script never replaces one (#7): it builds into <folder>.partial/ and
renames that into place only when the whole run succeeds.

    python scripts/snapshot-content.py                              # writes snapshot/, if it isn't there yet
    python scripts/snapshot-content.py --out snapshots/2026-10-01   # takes another

Standard library only, so there's nothing to install. Exit 0 = snapshot written
and every check passed. 1 = snapshot written, but something needs a look (see
its README). 2 = nothing written: the folder already exists, or the site couldn't
be read.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import html
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

SITE = "https://karaokeunderground.com"
HOSTS = {"karaokeunderground.com", "www.karaokeunderground.com"}
USER_AGENT = "KU-revamp-snapshot/1.0 (+https://github.com/Johnesco/karaokeunderground)"
REPO = Path(__file__).resolve().parent.parent
MARKER = "scripts/snapshot-content.py"  # recorded in index.json, to show which script made a snapshot
UPLOADS = "/wp-content/uploads/"
THEME = "/wp-content/themes/KU/layout/"
THEME_IMAGES = ["logo.png", "fb.png", "twitter.png", "instagram.png"]

# What the #1 audit counted on 2026-09-23. A difference gets reported, not treated
# as an error: the owner keeps adding songs.
AUDIT = {"songs": 1853, "pages": 6, "posts": 46, "images": 53}

SONGLIST_PAGE, CALENDAR_PAGE, CONTACT_PAGE, PHOTOS_PAGE = 16, 8, 10, 14

# The themed songlists posted as blog posts, and how each one writes a song.
THEMED = {
    390: "album-title",        # Spoon : Hot Songs. Every song on it is Spoon's
    499: "rank-title-artist",  # 2018 Top Tens. Its second list ranks artists, not songs
    501: "artist-title",       # Sing The Unsung. A sung song is struck through, then who sang it and when
    576: "artist-title",
    646: "artist-title",       # a table, one song per cell
    679: "artist-title",
    692: "artist-title",
    835: "artist-title",
}
DASH = " \u2013 "  # the site's separator: an en dash with a space either side
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SHOW_LINE = re.compile(
    r"(?P<weekday>(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day),?\s+(?P<month>\d{1,2})/(?P<day>\d{1,2})"
    r"\s*[-\u2013\u2014]\s*(?P<rest>.+)"
)


class FetchError(Exception):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


class Fetcher:
    """Reads the site one request at a time, pausing between requests, and fetches each URL once."""

    def __init__(self, delay: float):
        self.delay = delay
        self.last = 0.0
        self.count = 0
        self.cache: dict[str, tuple[bytes, dict[str, str]]] = {}

    def get(self, url: str) -> tuple[bytes, dict[str, str]]:
        if url in self.cache:
            return self.cache[url]
        error = "no response"
        for attempt in range(3):
            pause = self.delay - (time.monotonic() - self.last)
            if pause > 0:
                time.sleep(pause)
            try:
                request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(request, timeout=60) as response:
                    result = (response.read(), {k.lower(): v for k, v in response.headers.items()})
                self.last = time.monotonic()
                self.count += 1
                self.cache[url] = result
                return result
            except urllib.error.HTTPError as e:
                self.last = time.monotonic()
                if e.code < 500:
                    raise FetchError(f"{url}: HTTP {e.code}", e.code) from None
                error = f"HTTP {e.code}"
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                self.last = time.monotonic()
                error = str(e)
            time.sleep(2 * (attempt + 1))
        raise FetchError(f"{url}: {error}")

    def api(self, route: str) -> list[dict]:
        """Every item in a WordPress REST collection, across all its pages."""
        items, page = [], 1
        while True:
            body, headers = self.get(f"{SITE}/index.php?rest_route={route}&per_page=100&page={page}")
            items.extend(json.loads(body))
            if page >= int(headers.get("x-wp-totalpages", "1")):
                return items
            page += 1


# --- Small helpers -----------------------------------------------------------------------

def text_of(fragment: str) -> str:
    """The visible text of an HTML fragment, on one line."""
    text = html.unescape(re.sub(r"<[^>]+>", "", fragment)).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def split_lines(fragment: str) -> list[str]:
    """The HTML of each visible line: split at line breaks, paragraph ends and table cells."""
    return re.split(r"<br\s*/?>|</p>|</td>|</li>|</h[1-6]>", fragment, flags=re.I)


def write(path: Path, data: bytes | str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        data = data.encode("utf-8")
    path.write_bytes(data)


def write_json(path: Path, data) -> None:
    write(path, json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)


def local_path(url_path: str) -> str:
    """A URL path as a safe relative file path (no drive letters, no '..', no characters Windows rejects)."""
    parts = [re.sub(r'[<>:"|?*\\]', "_", p) for p in url_path.split("/") if p not in ("", ".", "..")]
    return "/".join(parts)


def live_url(parts: urllib.parse.SplitResult) -> str:
    """The canonical https address of a page on the live site."""
    return urllib.parse.urlunsplit(("https", "karaokeunderground.com", parts.path or "/", parts.query, parts.fragment))


def infer_date(weekday: str, month: int, day: int, today: dt.date) -> tuple[dt.date, bool]:
    """The site gives a weekday and a month/day but no year: pick the nearest year where the weekday fits."""
    options = []
    for year in (today.year - 1, today.year, today.year + 1):
        try:
            options.append(dt.date(year, month, day))
        except ValueError:
            pass
    fits = [d for d in options if WEEKDAYS[d.weekday()] == weekday]
    return min(fits or options, key=lambda d: abs((d - today).days)), bool(fits)


# --- The songlists ---------------------------------------------------------------------

def parse_songlist(content: str) -> tuple[list[list[str]], str]:
    """The master songlist's rows, and the 'Updated … songs' line typed above them."""
    table = re.search(r"<table\b.*?</table>", content, re.S | re.I)
    if not table:
        raise ValueError("the Songlist page has no table")
    rows = []
    for row in re.findall(r"<tr\b[^>]*>(.*?)</tr>", table[0], re.S | re.I):
        cells = [text_of(c) for c in re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", row, re.S | re.I)]
        if cells:
            rows.append(cells)
    if not rows or [c.lower() for c in rows[0]] != ["artist", "title", "album"]:
        raise ValueError("the Songlist table no longer starts with Artist, Title, Album")
    songs = rows[1:]
    odd = [r for r in songs if len(r) != 3]
    if odd:
        raise ValueError(f"{len(odd)} Songlist rows don't have three cells")
    stated = re.search(r"Updated.*?songs", text_of(content[: table.start()]))
    return songs, stated[0] if stated else ""


def songlist_table(songs: list[list[str]]) -> str:
    """The songlist as a plain table: a real header row, and none of the spreadsheet styling."""
    rows = "\n".join("<tr>" + "".join(f"<td>{html.escape(c)}</td>" for c in song) + "</tr>" for song in songs)
    header = "".join(f'<th scope="col">{h}</th>' for h in ("Artist", "Title", "Album"))
    return f"<table>\n<thead><tr>{header}</tr></thead>\n<tbody>\n{rows}\n</tbody>\n</table>"


def parse_song_line(raw: str, style: str) -> dict | None:
    note = ""
    struck = re.search(r"<del\b[^>]*>(.*?)</del>(.*)", raw, re.S | re.I)
    if struck:  # Sing The Unsung: the song, struck through once sung, then who sang it and when
        text, note = text_of(struck[1]), text_of(struck[2])
    else:
        text = text_of(raw)
    if text.startswith("\u201c") and text.endswith("\u201d"):  # one 2022 entry is wrapped in quotes
        text = text[1:-1]
    if not text or text == f"Artist{DASH}Title" or SHOW_LINE.match(text):
        return None
    if style == "rank-title-artist":
        m = re.fullmatch(rf"(\d+)\.\s+(.+?){DASH}(.+)", text)
        return {"rank": m[1], "artist": m[3], "title": m[2], "album": "", "note": note} if m else None
    m = re.fullmatch(rf"(.+?){DASH}(.+)", text)
    if not m:
        return None
    if style == "album-title":
        return {"rank": "", "artist": "Spoon", "title": m[2], "album": m[1], "note": note}
    return {"rank": "", "artist": m[1], "title": m[2], "album": "", "note": note}


def parse_themed(content: str, style: str) -> list[dict]:
    """The songs in a themed post: runs of at least 5 song lines in a row, so a dash in the intro isn't a song."""
    cells = re.findall(r"<td\b[^>]*>(.*?)</td>", content, re.S | re.I)
    if cells:  # a table: one song per cell, even where a line break splits a long title
        lines = [re.sub(r"<br\s*/?>", " ", cell, flags=re.I) for cell in cells]
    else:
        lines = split_lines(content)
    merged: list[str] = []
    for raw in (raw for raw in lines if text_of(raw)):
        text = text_of(raw)
        if merged and text.startswith("(") and DASH not in text:
            merged[-1] += " " + raw  # the end of a long title that wrapped onto its own line
        else:
            merged.append(raw)
    lines = merged
    songs, run = [], []
    for song in [parse_song_line(raw, style) for raw in lines] + [None]:
        if song:
            run.append(song)
            continue
        if len(run) >= 5:
            songs.extend(run)
        run = []
    return songs


# --- Shows -----------------------------------------------------------------------------

def parse_shows(fragment: str, today: dt.date) -> list[dict]:
    shows = []
    for raw in split_lines(fragment):
        text = text_of(raw)
        m = SHOW_LINE.fullmatch(text)
        if not m:
            continue
        when, weekday_fits = infer_date(m["weekday"], int(m["month"]), int(m["day"]), today)
        parts = re.split(r"\s+[-\u2013\u2014]\s+", m["rest"])
        link = re.search(r"""<a\b[^>]*\shref=(["'])(.*?)\1""", raw, re.I)
        show = {
            "date": when.isoformat(),
            "weekday": m["weekday"],
            "venue": parts[0],
            "details": DASH.join(parts[1:]) or None,
            "link": html.unescape(link[2]) if link else None,
            "text": text,
        }
        if not weekday_fits:
            show["check"] = f"{m['weekday']} doesn't fall on {m['month']}/{m['day']} in any nearby year"
        shows.append(show)
    return shows


def homepage_shows_fragment(page: str) -> str:
    """The upcoming-shows list is HTML in the theme: after the intro, before the posts."""
    start = page.find('<div id="content">')
    intro_end = page.find("</center>", start)
    end = page.find('<nav id="nav-above"', intro_end)
    if min(start, intro_end, end) < 0:
        raise ValueError("the homepage layout changed; can't find the show list")
    return page[intro_end + len("</center>"):end]


def show_checks(homepage: list[dict], calendar: list[dict], today: dt.date) -> list[str]:
    checks = []
    by_link: dict[str, list[str]] = {}
    for show in homepage:
        if show["link"]:
            by_link.setdefault(show["link"], []).append(show["date"])
        else:
            checks.append(f"The homepage's {show['date']} show ({show['venue']}) has no link")
    for link, dates in by_link.items():
        if len(dates) > 1:
            checks.append(f"{len(dates)} homepage shows link to the same event, {link}: {', '.join(dates)}")
    past = [s["date"] for s in calendar if s["date"] < today.isoformat()]
    if past:
        checks.append(f"The Calendar page still lists {len(past)} past show(s): {', '.join(past)}")
    homepage_dates = {s["date"] for s in homepage}
    missing = [s["date"] for s in calendar if s["date"] >= today.isoformat() and s["date"] not in homepage_dates]
    if missing:
        checks.append(f"Upcoming on the Calendar page but not the homepage: {', '.join(missing)}")
    calendar_dates = {s["date"] for s in calendar}
    only_home = [s["date"] for s in homepage if s["date"] not in calendar_dates]
    if only_home:
        checks.append(f"On the homepage but not the Calendar page: {', '.join(only_home)}")
    checks += [f"{s['date']}: {s['check']}" for s in homepage + calendar if "check" in s]
    return checks


# --- Cleaning pages and posts ---------------------------------------------------------------

def clean_link(url: str, media_paths: dict[str, str], fixes: Counter) -> str:
    """Point images at media/, and links to the site at its https address."""
    raw = html.unescape(url)
    parts = urllib.parse.urlsplit(raw)
    if parts.netloc.lower() not in HOSTS:
        return url
    path = urllib.parse.unquote(parts.path)
    if path.startswith(UPLOADS):
        original = re.sub(r"-\d+x\d+(?=\.\w+$)", "", path)  # a resized copy -> the uploaded original
        if original in media_paths:
            fixes["image links pointed at media/"] += 1
            return "../" + urllib.parse.quote(media_paths[original])
    fixed = live_url(parts)
    if fixed != raw:
        fixes["site links changed to https"] += 1
    return html.escape(fixed)


def clean_body(page_id: int | None, body: str, songs: list[list[str]], media_paths: dict[str, str],
               fixes: Counter) -> str:
    body, n = re.subn(r"</?center>\s*", "", body)
    fixes["center tags removed"] += n
    if page_id == SONGLIST_PAGE:
        body = re.sub(r"<table\b.*?</table>", lambda m: songlist_table(songs), body, count=1, flags=re.S | re.I)
        fixes["songlist table rebuilt without the spreadsheet styling"] += 1
    if page_id == CONTACT_PAGE:
        form = re.search(r'<div role="form" class="wpcf7".*?</form>\s*</div>', body, re.S)
        if form:
            labels = re.findall(r"<p>\s*([^<]+?)\s*<br\s*/?>\s*<span class=\"wpcf7-form-control-wrap", form[0])
            note = "<!-- Contact form (Contact Form 7) was here. Fields: " + "; ".join(labels) + " -->"
            body = body[: form.start()] + note + body[form.end():]
            body = re.sub(r"(?:\s*<br\s*/?>)*\s*(<!-- Contact form.*?-->)(?:\s*<br\s*/?>)*", r"\n\1\n", body, flags=re.S)
            fixes["contact form replaced with a note"] += 1
    if page_id == PHOTOS_PAGE:
        body, n = re.subn(r'<div id="sbi_mod_error"\s*>.*?</div>',
                          "<!-- Instagram Feed was here. It had no connected account, so visitors saw an empty page. -->",
                          body, flags=re.S)
        fixes["broken Instagram feed replaced with a note"] += n
    body, n = re.subn(r"\s(?:srcset|sizes)=\"[^\"]*\"", "", body)
    fixes["srcset and sizes attributes removed"] += n
    body = re.sub(r"""(\s(?:href|src)=)(["'])(.*?)\2""",
                  lambda m: m[1] + m[2] + clean_link(m[3], media_paths, fixes) + m[2], body)
    body = re.sub(r"<p>\s*(<!--.*?-->)\s*</p>", r"\1", body, flags=re.S)
    body, n = re.subn(r"<p>\s*</p>\s*", "", body)
    fixes["empty paragraphs removed"] += n
    return body.strip()


def page_document(title: str, url: str, kind: str, item: dict, body: str) -> str:
    return (
        "<!doctype html>\n<meta charset=\"utf-8\">\n"
        f"<title>{html.escape(title)}</title>\n"
        f"<!-- Copied from {url} ({kind} {item['id']}, published {item['date'][:10]}, "
        f"last edited {item['modified'][:10]}) -->\n"
        f"<article>\n{body}\n</article>\n"
    )


# --- The reference copy ----------------------------------------------------------------

class Reference:
    """An offline copy of pages as they look today, with the CSS, scripts, fonts and images they load."""

    ATTRS = re.compile(r"""(\s([\w-]+)\s*=\s*)(["'])(.*?)\3""", re.S)
    URL_ATTRS = {"href", "src", "srcset", "data-src", "poster", "style"}

    def __init__(self, fetch: Fetcher, root: Path, page_files: dict[str, str], taken: str, problems: list[str]):
        self.fetch, self.root, self.taken, self.problems = fetch, root, taken, problems
        self.page_files = page_files  # page key ("", "p=835", "page_id=16", "paged=2") -> file name
        self.assets: dict[str, Path | None] = {}
        self.missing_on_site: list[str] = []  # files the live pages ask for that the server doesn't have either

    @staticmethod
    def page_key(parts: urllib.parse.SplitResult) -> str | None:
        if parts.path not in ("", "/", "/index.php"):
            return None
        query = urllib.parse.parse_qs(parts.query)
        if not query:
            return ""
        if len(query) == 1 and next(iter(query)) in ("page_id", "p", "paged"):
            name, values = next(iter(query.items()))
            return f"{name}={values[0]}"
        return None

    def relative(self, target: Path, from_dir: Path, fragment: str) -> str:
        rel = urllib.parse.quote(os.path.relpath(target, from_dir).replace(os.sep, "/"))
        return rel + ("#" + fragment if fragment else "")

    def resolve(self, value: str, base: str, from_dir: Path, resource: bool) -> str:
        """Where one URL should point in the copy: a local file if we have it, else the live site."""
        raw = value.strip()
        if not raw or raw.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
            return value
        parts = urllib.parse.urlsplit(urllib.parse.urljoin(base, raw))
        if parts.scheme not in ("http", "https"):
            return value
        if parts.netloc.lower() not in HOSTS:
            # Someone else's site. A protocol-relative URL needs a scheme to work from a file.
            return "https:" + raw if raw.startswith("//") else value
        key = None if resource else self.page_key(parts)
        if key is not None and key in self.page_files:
            return self.relative(self.root / self.page_files[key], from_dir, parts.fragment)
        if resource or parts.path.startswith(("/wp-content/", "/wp-includes/")):
            local = self.asset(parts)
            if local:
                return self.relative(local, from_dir, parts.fragment)
        return live_url(parts)

    def asset(self, parts: urllib.parse.SplitResult) -> Path | None:
        """Download a file from the site once, and return where it's saved."""
        path = urllib.parse.unquote(parts.path)
        if not path or path.endswith("/"):
            return None
        if path in self.assets:
            return self.assets[path]
        self.assets[path] = None  # so a stylesheet that imports itself doesn't loop
        try:
            body, headers = self.fetch.get(SITE + urllib.parse.quote(path))
        except FetchError as e:
            if e.status == 404:  # broken on the live site too, so the copy is faithful without it
                self.missing_on_site.append(path)
            else:
                self.problems.append(f"Reference copy: couldn't fetch {path} ({e})")
            return None
        local = self.root / local_path(path)
        if path.lower().endswith(".css") or "text/css" in headers.get("content-type", ""):
            body = self.rewrite_css(body.decode("utf-8", "replace"), SITE + path, local.parent).encode("utf-8")
        write(local, body)
        self.assets[path] = local
        return local

    def rewrite_css(self, css: str, css_url: str, css_dir: Path) -> str:
        def url_ref(m: re.Match) -> str:
            return f"url({m[1]}{self.resolve(m[2], css_url, css_dir, True)}{m[1]})"

        def import_ref(m: re.Match) -> str:
            return f"@import {m[1]}{self.resolve(m[2], css_url, css_dir, True)}{m[1]}"

        css = re.sub(r"""url\(\s*(['"]?)(.*?)\1\s*\)""", url_ref, css)
        return re.sub(r"""@import\s+(['"])(.*?)\1""", import_ref, css)

    def rewrite_html(self, page: str, page_url: str) -> str:
        def rewrite_tag(tag_match: re.Match) -> str:
            tag = tag_match[0]
            name = re.match(r"<\s*([\w-]+)", tag)[1].lower()
            rel = re.search(r"""\srel\s*=\s*["']([^"']*)""", tag, re.I)
            resource_tag = name in ("img", "script", "source", "iframe", "video", "audio", "embed") or (
                name == "link" and bool(rel) and bool(re.search(r"stylesheet|icon", rel[1], re.I)))

            def rewrite_attr(m: re.Match) -> str:
                attr = m[2].lower()
                if attr not in self.URL_ATTRS:
                    return m[0]
                value = html.unescape(m[4])
                if attr == "style":
                    if "url(" not in value:
                        return m[0]
                    new = self.rewrite_css(value, page_url, self.root)
                elif attr == "srcset":
                    items = []
                    for item in value.split(","):
                        bits = item.strip().split(None, 1)
                        if bits:
                            bits[0] = self.resolve(bits[0], page_url, self.root, True)
                            items.append(" ".join(bits))
                    new = ", ".join(items)
                else:
                    new = self.resolve(value, page_url, self.root, resource_tag or attr != "href")
                return m[0] if new == value else m[1] + m[3] + html.escape(new, quote=True) + m[3]

            return self.ATTRS.sub(rewrite_attr, tag)

        page = re.sub(r"<[a-zA-Z][^>]*>", rewrite_tag, page)
        page = re.sub(r"(<style\b[^>]*>)(.*?)(</style>)",
                      lambda m: m[1] + self.rewrite_css(m[2], page_url, self.root) + m[3], page, flags=re.S | re.I)
        # The contact form would send a real message to the owner. Switch it off in the copy.
        page = re.sub(r"<script\b[^>]*contact-form-7[^>]*>.*?</script>\s*", "", page, flags=re.S | re.I)
        page = re.sub(r"""(<form\b[^>]*?)\saction=(["'])[^"']*\2""", r'\1 action="#" onsubmit="return false"', page, flags=re.I)
        note = (f"<!-- Reference copy of {page_url}, saved {self.taken} by {MARKER} (#6). "
                "A before-picture of the live site, not a base to build from. -->\n")
        doctype = re.match(r"\s*<!DOCTYPE[^>]*>\s*", page, re.I)
        return page[: doctype.end()] + note + page[doctype.end():] if doctype else note + page

    def save_page(self, url: str, file_name: str) -> None:
        body, _ = self.fetch.get(url)
        write(self.root / file_name, self.rewrite_html(body.decode("utf-8", "replace"), url))

    def missing_links(self) -> tuple[int, list[str]]:
        """Every local link in the copy's pages and stylesheets, and the ones that point at nothing."""
        checked, missing = 0, []
        for file in sorted(self.root.rglob("*")):
            if file.suffix.lower() not in (".html", ".css"):
                continue
            text = file.read_text(encoding="utf-8", errors="replace")
            refs = [html.unescape(m[1]) for m in re.finditer(r"""\s(?:href|src)=["']([^"']*)""", text)]
            refs += [m[1] for m in re.finditer(r"""url\(\s*['"]?([^'")]*)""", text)]
            for srcset in re.finditer(r"""\ssrcset=["']([^"']*)""", text):
                refs += [item.strip().split(" ")[0] for item in html.unescape(srcset[1]).split(",") if item.strip()]
            for ref in refs:
                if not ref or re.match(r"[a-z][\w+.-]*:|//|#", ref, re.I):
                    continue
                checked += 1
                target = (file.parent / urllib.parse.unquote(ref.split("#")[0].split("?")[0])).resolve()
                if not target.exists():
                    missing.append(f"{file.relative_to(self.root).as_posix()} -> {ref}")
        return checked, missing


# --- The run ---------------------------------------------------------------------------

def build(fetch: Fetcher, out: Path) -> dict:
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    taken = now.isoformat().replace("+00:00", "Z")
    today = now.date()
    fixes: Counter = Counter()
    problems: list[str] = []  # anything that makes the snapshot incomplete: exit 1

    pages = sorted(fetch.api("/wp/v2/pages"), key=lambda p: p["id"])
    posts = sorted(fetch.api("/wp/v2/posts"), key=lambda p: (p["date"], p["id"]))
    media = sorted(fetch.api("/wp/v2/media"), key=lambda m: m["id"])
    categories = {c["id"]: c["name"] for c in fetch.api("/wp/v2/categories")}
    tags = {t["id"]: t["name"] for t in fetch.api("/wp/v2/tags")}
    by_id = {p["id"]: p for p in pages}
    print(f"WordPress: {len(pages)} pages, {len(posts)} posts, {len(media)} images")

    # Media: the uploaded originals, and the theme's logo and icons.
    media_paths, media_index, media_bytes = {}, [], 0
    for m in media:
        path = urllib.parse.unquote(urllib.parse.urlsplit(m["source_url"]).path)
        rel = "media/" + local_path(path[len(UPLOADS):]) if path.startswith(UPLOADS) else "media/" + local_path(path)
        try:
            body, _ = fetch.get(SITE + urllib.parse.quote(path))
        except FetchError as e:
            problems.append(f"Couldn't fetch image {m['id']} ({e})")
            continue
        write(out / rel, body)
        media_paths[path] = rel
        media_bytes += len(body)
        media_index.append({"id": m["id"], "title": html.unescape(m["title"]["rendered"]), "alt": m.get("alt_text", ""),
                            "date": m["date"], "attached_to": m.get("post") or None, "url": SITE + path,
                            "file": rel, "bytes": len(body)})
    for name in THEME_IMAGES:
        try:
            body, _ = fetch.get(SITE + THEME + name)
            write(out / "media/theme" / name, body)
        except FetchError as e:
            problems.append(f"Couldn't fetch theme image {name} ({e})")
    print(f"Media: {len(media_index)} images, {media_bytes / 1e6:.1f} MB, plus {len(THEME_IMAGES)} theme images")

    # The master songlist.
    songs, stated = parse_songlist(by_id[SONGLIST_PAGE]["content"]["rendered"])
    write_csv(out / "songlist.csv", ["Artist", "Title", "Album"], songs)
    print(f"Songlist: {len(songs)} songs (the page says: {stated})")

    # The themed songlists, in one format.
    master = {(a.casefold(), t.casefold()) for a, t, _ in songs}
    themed_rows, themed_index = [], []
    for post in posts:
        if post["id"] not in THEMED:
            continue
        title = html.unescape(post["title"]["rendered"])
        found = parse_themed(post["content"]["rendered"], THEMED[post["id"]])
        if not found:
            problems.append(f"Found no songs in themed post {post['id']} ({title})")
        themed_rows += [[post["id"], title, s["rank"], s["artist"], s["title"], s["album"], s["note"]] for s in found]
        themed_index.append({"post": post["id"], "title": title, "songs": len(found),
                             "on_master_list": sum((s["artist"].casefold(), s["title"].casefold()) in master for s in found)})
    write_csv(out / "themed-songlists.csv", ["post_id", "post_title", "rank", "artist", "title", "album", "note"], themed_rows)
    print(f"Themed songlists: {len(themed_index)} posts, {len(themed_rows)} songs")

    # Upcoming shows: the homepage's list lives in the theme, so read the page itself.
    home_html = fetch.get(SITE + "/")[0].decode("utf-8", "replace")
    homepage = parse_shows(homepage_shows_fragment(home_html), today)
    calendar = parse_shows(by_id[CALENDAR_PAGE]["content"]["rendered"], today)
    for show in calendar:
        show["past"] = show["date"] < today.isoformat()
    checks = show_checks(homepage, calendar, today)
    write_json(out / "shows.json", {
        "taken": taken,
        "note": "The site gives no years. Each date uses the nearest year where the weekday fits.",
        "homepage": homepage, "calendar": calendar, "checks": checks,
    })
    if not homepage:
        problems.append("Found no shows on the homepage")
    print(f"Shows: {len(homepage)} on the homepage, {len(calendar)} on the Calendar page")

    # One cleaned HTML file per page and post.
    page_index, post_index = [], []
    for p in pages:
        rel = f"pages/{p['slug']}.html"
        title, url = html.unescape(p["title"]["rendered"]), f"{SITE}/?page_id={p['id']}"
        write(out / rel, page_document(title, url, "page", p,
                                       clean_body(p["id"], p["content"]["rendered"], songs, media_paths, fixes)))
        page_index.append({"id": p["id"], "slug": p["slug"], "title": title, "published": p["date"],
                           "last_edited": p["modified"], "url": url, "file": rel})
    for p in posts:
        rel = f"posts/{p['date'][:10]}-{p['slug']}.html"
        title, url = html.unescape(p["title"]["rendered"]), f"{SITE}/?p={p['id']}"
        write(out / rel, page_document(title, url, "post", p,
                                       clean_body(None, p["content"]["rendered"], songs, media_paths, fixes)))
        post_index.append({"id": p["id"], "slug": p["slug"], "title": title, "published": p["date"],
                           "last_edited": p["modified"], "url": url, "file": rel,
                           "categories": [categories.get(c, str(c)) for c in p["categories"]],
                           "tags": [tags.get(t, str(t)) for t in p["tags"]],
                           "themed_songlist": p["id"] in THEMED})
    print(f"Pages and posts: {len(page_index)} + {len(post_index)} cleaned files")

    # The reference copy of the site as it looks today.
    page_files = {"": "index.html"}
    home_pages = max(1, -(-len(posts) // 10))  # ten posts to a page
    page_files.update({f"paged={n}": f"paged-{n}.html" for n in range(2, home_pages + 1)})
    page_files.update({f"page_id={p['id']}": f"page_id-{p['id']}.html" for p in pages})
    page_files.update({f"p={p['id']}": f"page_id-{p['id']}.html" for p in pages})  # ?p= works for pages too
    page_files.update({f"p={p['id']}": f"p-{p['id']}.html" for p in posts})
    reference = Reference(fetch, out / "reference", page_files, taken, problems)
    reference_pages = []
    for key, file_name in page_files.items():
        if key.startswith("p=") and file_name.startswith("page_id-"):
            continue  # the same file as its page_id= key
        url = f"{SITE}/" + (f"?{key}" if key else "")
        try:
            reference.save_page(url, file_name)
            reference_pages.append({"url": url, "file": f"reference/{file_name}"})
        except FetchError as e:
            problems.append(f"Reference copy: couldn't fetch {url} ({e})")
    checked, missing = reference.missing_links()
    problems += [f"Reference copy: broken local link {m}" for m in missing]
    saved_assets = [p for p in reference.assets.values() if p]
    reference_bytes = sum(f.stat().st_size for f in (out / "reference").rglob("*") if f.is_file())
    print(f"Reference copy: {len(reference_pages)} pages, {len(saved_assets)} files, "
          f"{reference_bytes / 1e6:.1f} MB, {checked} local links checked, {len(missing)} broken")

    counts = {"songs": len(songs), "pages": len(pages), "posts": len(posts), "images": len(media_index)}
    differences = [f"{k}: {counts[k]} now, {AUDIT[k]} in the audit" for k in AUDIT if counts[k] != AUDIT[k]]
    report = {
        "script": MARKER,
        "source": SITE,
        "taken": taken,
        "requests": fetch.count,
        "counts": counts,
        "differences_from_audit": differences,
        "songlist": {"file": "songlist.csv", "songs": len(songs), "page_says": stated},
        "themed_songlists": {"file": "themed-songlists.csv", "posts": themed_index},
        "shows": {"file": "shows.json", "homepage": len(homepage), "calendar": len(calendar), "checks": checks},
        "pages": page_index,
        "posts": post_index,
        "media": {"images": media_index, "bytes": media_bytes, "theme": [f"media/theme/{n}" for n in THEME_IMAGES]},
        "reference": {"start": "reference/index.html", "pages": reference_pages, "files": len(saved_assets),
                      "bytes": reference_bytes, "local_links_checked": checked, "broken_local_links": len(missing),
                      "missing_on_live_site": sorted(reference.missing_on_site)},
        "fixes": dict(sorted(fixes.items())),
        "problems": problems,
    }
    write_json(out / "index.json", report)
    write(out / "README.md", readme(report, homepage, calendar))
    return report


def readme(r: dict, homepage: list[dict], calendar: list[dict]) -> str:
    c = r["counts"]
    lines = [
        "# Snapshot of karaokeunderground.com", "",
        f"Taken {r['taken']} by `{MARKER}` ([#6](https://github.com/Johnesco/karaokeunderground/issues/6)),"
        f" in {r['requests']} requests.", "",
        "**Local only.** This is the owner's content, and the repo is public. The folder is gitignored:"
        " never commit it or copy it anywhere public.", "",
        "## What's here", "",
        "| Path | What it is |", "|---|---|",
        f"| `songlist.csv` | The master songlist: {c['songs']:,} songs, with artist, title and album."
        f" The page itself says \"{r['songlist']['page_says']}\" |",
        f"| `themed-songlists.csv` | The {len(r['themed_songlists']['posts'])} themed songlists from blog posts,"
        " in one format: post, rank, artist, title, album, note |",
        f"| `shows.json` | Upcoming shows: {len(homepage)} from the homepage, {len(calendar)} from the Calendar page |",
        f"| `pages/`, `posts/` | One cleaned HTML file per page ({c['pages']}) and post ({c['posts']}) |",
        f"| `media/` | The {c['images']} uploaded images ({r['media']['bytes'] / 1e6:.1f} MB), and the theme's logo and icons in `media/theme/` |",
        f"| `reference/` | The site as it looks today: {len(r['reference']['pages'])} pages with their CSS, scripts,"
        " fonts and images. Start at `reference/index.html` |",
        "| `index.json` | Metadata for all of it: old URLs, dates, files, and the checks below |", "",
        "Open the CSVs as UTF-8. Double-clicking them in Excel can garble characters like … and –;"
        " use Data → From Text/CSV instead.", "",
        "## Counts against the #1 audit", "",
    ]
    lines += [f"- {d}" for d in r["differences_from_audit"]] or ["- All match: " + ", ".join(f"{v:,} {k}" for k, v in c.items())]
    lines += ["", "## Shows: check these by hand", "",
              "The site gives no years, so each date uses the nearest year where the weekday fits.", "",
              "| Source | Date | Venue | Details | Link |", "|---|---|---|---|---|"]
    for source, shows in (("homepage", homepage), ("calendar", calendar)):
        for s in shows:
            lines.append(f"| {source} | {s['date']} ({s['weekday'][:3]}) | {s['venue']} | {s['details'] or ''} |"
                         f" {s['link'] or 'none'} |")
    lines += [""] + [f"- {check}" for check in r["shows"]["checks"]]
    lines += ["", "## Themed songlists", "",
              "| Post | Songs | Also on the master list (exact artist and title) |", "|---|---|---|"]
    lines += [f"| {t['post']} {t['title']} | {t['songs']} | {t['on_master_list']} |" for t in r["themed_songlists"]["posts"]]
    lines += ["", "## Cleanup in `pages/` and `posts/`", ""]
    lines += [f"- {name}: {n}" for name, n in r["fixes"].items() if n]
    lines += ["", "Links to other sites are unchanged. The themed songlists keep their original layout in the post"
              " files; `themed-songlists.csv` has them in one format.", "",
              "## The reference copy", "",
              "Open `reference/index.html` in a browser. Pages link to each other, and links to pages it doesn't"
              " copy (archives, attachments, feeds) go to the live site. YouTube players load from the web.", "",
              "The contact form is switched off in the copy, so it can't send the owner a real message.", "",
              "If the fonts or anything else look wrong when opened straight from disk, serve the folder instead:"
              " run `python -m http.server 8000 --bind 127.0.0.1 --directory snapshot/reference` and open"
              " http://localhost:8000/. `--bind 127.0.0.1` keeps it on this machine, off the local network.", "",
              f"{r['reference']['local_links_checked']} local links checked, {r['reference']['broken_local_links']} broken.", ""]
    gaps = r["reference"]["missing_on_live_site"]
    if gaps:
        lines += ["The live pages ask for these files, but the live server doesn't have them either (HTTP 404),"
                  " so the copy leaves them out:", ""] + [f"- `{g}`" for g in gaps] + [""]
    lines += ["## Problems", ""]
    lines += [f"- {p}" for p in r["problems"]] or ["None."]
    lines += ["", "## Taking another snapshot", "",
              "This one stays as it was taken. To take another, give it a folder of its own:", "",
              "```", "python scripts/snapshot-content.py --out snapshots/YYYY-MM-DD", "```", ""]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Pull a local copy of karaokeunderground.com (#6).")
    parser.add_argument("--out", type=Path, default=REPO / "snapshot",
                        help="where to write the snapshot (default: snapshot/ in the repo)")
    parser.add_argument("--delay", type=float, default=0.4, help="seconds between requests (default: 0.4)")
    args = parser.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):  # Windows defaults piped output to cp1252, which can't show every character
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    out = args.out.resolve()
    if not out.name or out == REPO or out in REPO.parents:
        parser.error(f"--out can't be {out}")
    if out.exists():
        print(f"{out} already exists. A snapshot stays as it was taken, so this one is left alone.\n"
              f"To take another, give it a folder of its own: --out snapshots/{dt.date.today()}", file=sys.stderr)
        return 2
    partial = out.with_name(out.name + ".partial")
    if partial.exists():  # left over from a run that failed
        shutil.rmtree(partial)
    try:
        report = build(Fetcher(args.delay), partial)
    except (FetchError, ValueError) as e:
        print(f"Snapshot failed: {e}", file=sys.stderr)
        print(f"Nothing written to {out}; the partial copy is in {partial}.", file=sys.stderr)
        return 2
    if out.exists():  # something else wrote it during the run
        print(f"{out} appeared during the run and is left alone. The new snapshot is in {partial}.", file=sys.stderr)
        return 2
    partial.rename(out)
    print(f"Wrote {out} ({report['requests']} requests).")
    for line in report["differences_from_audit"]:
        print(f"  differs from the audit: {line}")
    for path in report["reference"]["missing_on_live_site"]:
        print(f"  missing on the live site too (left out): {path}")
    for line in report["problems"]:
        print(f"  problem: {line}")
    return 1 if report["problems"] else 0


if __name__ == "__main__":
    sys.exit(main())
