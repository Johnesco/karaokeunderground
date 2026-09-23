#!/usr/bin/env python3
"""Convert the content working copy into the core files that ADR-002 describes (#10).

A one-off: it ran once, on 2026-09-23, and is kept as the record of how the
core files were made. It reads the working copy that the snapshot started
(#6, #7) and writes work/content/:

  songlist.csv   the master songlist, with two new columns, Themes and Tags.
                 Themes starts with "sad" and "scary", each taken from the most
                 recent themed list of that name. Tags starts empty
  pages/*.md     each page as Markdown, with front matter: title, date,
                 updated (when it differs from date) and old_url
  posts/*.md     each post the same way, named for its date as before
  images/        the images, keeping their year/month folders. The old
                 theme's logo and icons go in images/site/

The conversion changes the format, not the content. Fixes to the content are
committed separately, so each kind of change can be reviewed on its own. In
the Markdown:

  - the songlist page's table is left out, because songlist.csv is the list
  - YouTube players become links to the video, and the Instagram embed its
    text and link, because ADR-002 allows no HTML (the site can add players
    back on purpose)
  - an image that linked to itself is shown without the link
  - comments are left out, like the notes where the contact form and the
    Instagram feed were
  - non-breaking spaces left by the WordPress editor become plain spaces

Then it checks that every song, page, post, image and link came across, and
that each page and post reads word for word as before. Only then does it
remove what it replaced: songlist.csv, pages/*.html, posts/*.html, media/,
themed-songlists.csv and index.json. All of them stay in the private repo's
first commit and in the frozen snapshot. shows.json stays as it is, because
the shows wait for the decision on how events get updated.

    python scripts/convert-working-copy.py              # converts work/
    python scripts/convert-working-copy.py --work DIR

Standard library only. Exit 0 = converted and verified. 1 = written, but the
verification found a difference: nothing was removed, see the output.
2 = nothing written.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import sys
import unicodedata
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

REPO = Path(__file__).resolve().parent.parent
SITE_HOSTS = {"karaokeunderground.com", "www.karaokeunderground.com"}
SONGLIST_PAGE = 16  # its table is the songlist itself
SONGLIST_HEADER = ["Artist", "Title", "Album", "Themes", "Tags"]
# Each theme comes from the most recent post of that list (post ID -> theme),
# which already includes the songs of the earlier ones.
THEMES = {835: "sad", 679: "scary"}

BACKSLASH = "\\"
ESCAPED = set("\\`*_[]<~")  # characters that would be read as Markdown
ENTITY = re.compile(r"&(?:#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);")
WHITESPACE = re.compile(r"[ \t\n\r\f]+")  # what HTML collapses: ASCII whitespace only
NBSP = "\xa0"
FORMAT_TAGS = {"b": "strong", "strong": "strong", "i": "em", "em": "em", "del": "del", "s": "del", "strike": "del"}
MARKS = {"strong": "**", "em": "*", "del": "~~"}
ORDER = {"strong": 0, "em": 1, "del": 2, "link": 3}  # which to open first when several start together
VIDEO_TEXT = "Watch the video on YouTube"


class ConversionError(Exception):
    pass


# ---- Markdown output ----


class Run:
    """A piece of a line: text, or a ready-made Markdown atom (an image), with its formatting and link."""

    __slots__ = ("text", "atom", "decos")

    def __init__(self, text=None, atom=None, decos=frozenset()):
        self.text, self.atom, self.decos = text, atom, decos

    def blank(self):
        return self.atom is None and not self.text.strip()


def escape_text(s: str) -> str:
    out = []
    for i, ch in enumerate(s):
        if ch == "_" and 0 < i < len(s) - 1 and s[i - 1].isalnum() and s[i + 1].isalnum():
            pass  # inside a word, like IMG_3103, an underscore can't start or end emphasis
        elif ch in ESCAPED or (ch == "&" and ENTITY.match(s, i)):
            out.append(BACKSLASH)
        out.append(ch)
    return "".join(out)


def escape_destination(url: str) -> str:
    return "".join("%%%02X" % ord(ch) if ch in " ()<>" else ch for ch in url)


def escape_line_start(line: str) -> str:
    """Escapes what would start a list, heading, quote or rule at the start of a line."""
    number = re.match(r"\d{1,9}(?=[.)](?:[ \t]|$))", line)
    if number:
        return line[: number.end()] + BACKSLASH + line[number.end() :]
    if re.match(r"(?:[-+]|#{1,6})(?:[ \t]|$)", line) or line.startswith(">") or re.fullmatch(r"(?:=+|-+)[ \t]*", line):
        return BACKSLASH + line
    return line


def is_link(deco) -> bool:
    return isinstance(deco, tuple)


def opener(deco) -> str:
    return "[" if is_link(deco) else MARKS[deco]


def closer(deco) -> str:
    return "](" + escape_destination(deco[1]) + ")" if is_link(deco) else MARKS[deco]


def render_paragraph(lines: list[list[Run]]) -> str:
    """One paragraph of Markdown, its lines joined by hard breaks (a backslash at the end of a line).

    A break counts as whitespace, so formatting and links carry across it,
    formatting nests properly, and markers hug the text so that they parse.
    """
    runs = []
    for line in lines:
        if runs:
            runs.append(Run(text="\n"))
        runs.extend(line)

    def span(i, deco):
        n = 0
        for run in runs[i:]:
            if run.blank():
                continue
            if deco not in run.decos:
                break
            n += 1
        return n

    out, stack, gap = [], [], ""
    for i, run in enumerate(runs):
        if run.atom is None:
            if run.blank():  # spaces, or the "\n" of a break
                gap += run.text
                continue
            core = run.text.strip(" ")
            lead = run.text[: len(run.text) - len(run.text.lstrip(" "))]
            trail = run.text[len(run.text.rstrip(" ")) :]
            content = escape_text(core)
        else:
            lead = trail = ""
            content = run.atom
        keep = 0
        while keep < len(stack) and stack[keep] in run.decos:
            keep += 1
        out.extend(closer(d) for d in reversed(stack[keep:]))
        del stack[keep:]
        if out and "\n" in gap:
            out.append(BACKSLASH + "\n")
        elif out and (gap or lead):
            out.append(" ")
        starting = sorted(
            (d for d in run.decos if d not in stack),
            key=lambda d: (-span(i, d), ORDER["link" if is_link(d) else d]),
        )
        for d in starting:
            out.append(opener(d))
            stack.append(d)
        out.append(content)
        gap = trail
    out.extend(closer(d) for d in reversed(stack))
    return "\n".join(escape_line_start(row) for row in "".join(out).split("\n"))


def render_blocks(blocks) -> str:
    parts = []
    for i, (depth, lines) in enumerate(blocks):
        if i:
            shared = min(depth, blocks[i - 1][0])
            parts.append("\n" + " ".join([">"] * shared) + "\n")
        text = render_paragraph(lines)
        if depth:
            text = "\n".join("> " * depth + row for row in text.split("\n"))
        parts.append(text)
    return "".join(parts)


# ---- HTML input ----


def youtube_watch_url(src: str) -> str:
    parts = urlsplit(src if src.startswith("http") else "https:" + src)
    video = re.fullmatch(r"/embed/([A-Za-z0-9_-]{11})", parts.path)
    if parts.hostname not in ("www.youtube.com", "youtube.com") or not video or set(parse_qs(parts.query)) - {"feature"}:
        raise ConversionError(f"no rule for the embed {src}")
    return f"https://www.youtube.com/watch?v={video.group(1)}"


class PageConverter(HTMLParser):
    """Reads one cleaned page or post into Markdown blocks. It stops at anything it has no rule for."""

    def __init__(self, map_url, skip_tables=False):
        super().__init__(convert_charrefs=True)
        self.map_url, self.skip_tables = map_url, skip_tables
        self.blocks = []  # (quote depth, lines); a line is a list of Runs
        self.lines = [[]]
        self.formats = Counter()
        self.link = None
        self.in_article = False
        self.skipping, self.skip_depth = None, 0
        self.quotes = []  # True for a quote, False for an embed shown as plain text
        self.caption = False
        self.in_table, self.rows, self.cells = False, 0, 0
        self.skipped_rows = []
        self.notes = Counter()

    def decos(self):
        found = {f for f, n in self.formats.items() if n > 0}
        if self.link:
            found.add(("link", self.link))
        return frozenset(found)

    def flush(self):
        lines = [line for line in self.lines if not all(run.blank() for run in line)]
        self.lines = [[]]
        if lines:
            self.blocks.append((sum(self.quotes), lines))

    def handle_starttag(self, tag, attrs):
        if tag == "article":
            self.in_article = True
            return
        if not self.in_article:
            return
        if self.skipping:
            if tag == self.skipping:
                self.skip_depth += 1
            elif self.skipping == "table" and tag == "tr":
                self.skipped_rows.append([])
            elif self.skipping == "table" and tag in ("td", "th"):
                self.skipped_rows[-1].append("")
            return
        a = dict(attrs)
        classes = (a.get("class") or "").split()
        if tag in FORMAT_TAGS:
            self.formats[FORMAT_TAGS[tag]] += 1
        elif tag == "a":
            self.link = self.map_url(a["href"]) if a.get("href") else None
        elif tag == "br":
            self.lines.append([])
        elif tag == "img":
            self.add_image(a)
        elif tag == "iframe":
            if self.link:
                raise ConversionError("a video inside a link")
            text = WHITESPACE.sub(" ", a.get("title") or "").strip() or VIDEO_TEXT
            self.lines[-1].append(Run(text=text, decos=self.decos() | {("link", youtube_watch_url(a["src"]))}))
            self.notes["YouTube players turned into links"] += 1
        elif tag == "p":
            self.flush()
            if "wp-caption-text" in classes:
                self.caption = True
                self.formats["em"] += 1
        elif tag in ("div", "figure"):
            self.flush()
        elif tag == "blockquote":
            self.flush()
            embed = "instagram-media" in classes
            self.quotes.append(not embed)
            if embed:
                self.notes["Instagram embeds turned into text and a link"] += 1
        elif tag == "table":
            self.flush()
            if self.skip_tables:
                self.skipping, self.skip_depth = "table", 1
            else:
                self.in_table, self.rows = True, 0
        elif tag == "tr":
            if not self.in_table:
                raise ConversionError("a table row outside a table")
            if self.rows:
                self.lines.append([])
            self.rows, self.cells = self.rows + 1, 0
        elif tag in ("td", "th"):
            self.cells += 1
            if self.cells > 1:
                raise ConversionError("a table with more than one column")
        elif tag in ("tbody", "thead", "time"):
            pass
        elif tag in ("script", "style"):
            self.skipping, self.skip_depth = tag, 1
            self.notes[f"<{tag}> elements left out"] += 1
        else:
            raise ConversionError(f"no rule for <{tag}>")

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in ("br", "img"):
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if not self.in_article:
            return
        if self.skipping:
            if tag == self.skipping:
                self.skip_depth -= 1
                if not self.skip_depth:
                    self.skipping = None
            return
        if tag == "article":
            self.flush()
            self.in_article = False
        elif tag in FORMAT_TAGS:
            name = FORMAT_TAGS[tag]
            self.formats[name] = max(0, self.formats[name] - 1)
        elif tag == "a":
            self.link = None
        elif tag == "p":
            if self.caption:
                self.caption = False
                self.formats["em"] = max(0, self.formats["em"] - 1)
            self.flush()
        elif tag in ("div", "figure"):
            self.flush()
        elif tag == "blockquote":
            self.flush()
            if self.quotes:
                self.quotes.pop()
        elif tag == "table":
            self.flush()
            self.in_table = False
        elif tag in ("tr", "td", "th", "tbody", "thead", "time", "iframe"):
            pass
        else:
            raise ConversionError(f"no rule for </{tag}>")

    def handle_data(self, data):
        if not self.in_article:
            return
        if self.skipping:
            if self.skipping == "table" and self.skipped_rows and self.skipped_rows[-1]:
                self.skipped_rows[-1][-1] += data
            return
        if NBSP in data:
            self.notes["non-breaking spaces made plain"] += data.count(NBSP)
        text = WHITESPACE.sub(" ", data.replace(NBSP, " "))
        if text:
            self.lines[-1].append(Run(text=text, decos=self.decos()))

    def handle_comment(self, data):
        if self.in_article:
            self.notes["comments left out"] += 1

    def add_image(self, a):
        src = self.map_url(a["src"])
        decos = self.decos()
        link = next((d for d in decos if is_link(d)), None)
        if link and link[1] == src:
            decos = decos - {link}
            self.notes["links from an image to itself left out"] += 1
        alt = WHITESPACE.sub(" ", (a.get("alt") or "").replace(NBSP, " ")).strip()
        atom = "![" + escape_text(alt) + "](" + escape_destination(src) + ")"
        self.lines[-1].append(Run(atom=atom, decos=decos))


def url_mapper(kind: str, pages_by_id: dict, posts_by_id: dict):
    """Points links at the core files: images at images/, and site links at the page or post's .md file."""

    def map_url(href: str) -> str:
        if href.startswith("../media/"):
            rest = href[len("../media/") :]
            return "../images/" + ("site/" + rest[len("theme/") :] if rest.startswith("theme/") else rest)
        parts = urlsplit(href)
        if parts.hostname not in SITE_HOSTS:
            return href
        query = parse_qs(parts.query)
        target = None
        if parts.path in ("", "/") and len(query) == 1:
            ((key, values),) = query.items()
            number = int(values[0])
            if key == "page_id":
                target = pages_by_id.get(number)
            elif key == "p":
                target = posts_by_id.get(number) or pages_by_id.get(number)
        if target is None:
            raise ConversionError(f"no core file for the link {href}")
        folder, name = target.split("/")
        return name if folder == kind else f"../{folder}/{name}"

    return map_url


def front_matter(entry: dict) -> str:
    date, updated = entry["published"][:10], entry["last_edited"][:10]
    old = urlsplit(entry["url"])
    title = entry["title"].replace(BACKSLASH, BACKSLASH * 2).replace('"', BACKSLASH + '"')
    lines = ["---", f'title: "{title}"', f"date: {date}"]
    if updated != date:
        lines.append(f"updated: {updated}")
    lines.append(f"old_url: {old.path or '/'}{'?' + old.query if old.query else ''}")
    lines.append("---")
    return "\n".join(lines) + "\n"


# ---- the songlist ----


def song_key(artist: str, title: str) -> tuple[str, str]:
    """How a themed list's song is matched to the master list: case, curly quotes and spacing don't count."""

    def norm(s):
        s = unicodedata.normalize("NFKC", s).casefold()
        for curly, straight in (
            ("\N{LEFT SINGLE QUOTATION MARK}", "'"),
            ("\N{RIGHT SINGLE QUOTATION MARK}", "'"),
            ("\N{LEFT DOUBLE QUOTATION MARK}", '"'),
            ("\N{RIGHT DOUBLE QUOTATION MARK}", '"'),
        ):
            s = s.replace(curly, straight)
        return re.sub(r"\s+", " ", s).strip()

    return norm(artist), norm(title)


def convert_songlist(work: Path):
    with open(work / "songlist.csv", encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    if rows[0] != ["Artist", "Title", "Album"]:
        raise ConversionError(f"songlist.csv has the header {rows[0]}")
    songs = rows[1:]
    with open(work / "themed-songlists.csv", encoding="utf-8", newline="") as f:
        themed = list(csv.DictReader(f))

    index = {}
    for i, (artist, title, _album) in enumerate(songs):
        index.setdefault(song_key(artist, title), i)
    themes = [set() for _ in songs]
    report = {}
    for post, theme in THEMES.items():
        listed = [t for t in themed if int(t["post_id"]) == post]
        missed = []
        for t in listed:
            i = index.get(song_key(t["artist"], t["title"]))
            if i is None:
                missed.append(f"{t['artist']} \N{EN DASH} {t['title']}")
            else:
                themes[i].add(theme)
        report[theme] = (post, len(listed), missed)

    out = [SONGLIST_HEADER] + [[*song, "; ".join(sorted(themes[i])), ""] for i, song in enumerate(songs)]
    return songs, out, report


# ---- checking the result ----


class VisibleText(HTMLParser):
    """What a reader gets from a page's HTML, read independently of the converter: its words, links and images."""

    def __init__(self, map_url, skip_tables=False):
        super().__init__(convert_charrefs=True)
        self.map_url, self.skip_tables = map_url, skip_tables
        self.text, self.links, self.images = [], [], []
        self.in_article, self.skip = False, 0
        self.link, self.link_used = None, False

    def handle_starttag(self, tag, attrs):
        if tag == "article":
            self.in_article = True
        if not self.in_article:
            return
        if tag in ("script", "style") or (tag == "table" and self.skip_tables):
            self.skip += 1
        if self.skip:
            return
        a = dict(attrs)
        if tag == "a" and a.get("href"):
            self.link, self.link_used = self.map_url(a["href"]), False
        elif tag == "img":
            src = self.map_url(a["src"])
            self.images.append((" ".join((a.get("alt") or "").split()), escape_destination(src)))
            if self.link and self.link != src:
                self.link_used = True
        elif tag == "iframe":
            self.text.append(" " + (" ".join((a.get("title") or "").split()) or VIDEO_TEXT) + " ")
            self.links.append(escape_destination(youtube_watch_url(a["src"])))
        elif tag in ("p", "div", "figure", "blockquote", "table", "tr", "td", "th", "br"):
            self.text.append(" ")

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if not self.in_article:
            return
        if tag in ("script", "style") or (tag == "table" and self.skip_tables):
            self.skip -= 1
            return
        if self.skip:
            return
        if tag == "a":
            if self.link and self.link_used:
                self.links.append(escape_destination(self.link))
            self.link = None
        elif tag in ("p", "div", "figure", "blockquote", "td", "th"):
            self.text.append(" ")
        if tag == "article":
            self.in_article = False

    def handle_data(self, data):
        if self.in_article and not self.skip:
            self.text.append(data)
            if self.link and data.strip():
                self.link_used = True

    def words(self):
        return "".join(self.text).split()


def closing_bracket(s: str, start: int) -> int:
    depth, i = 0, start + 1
    while i < len(s):
        if s[i] == BACKSLASH:
            i += 2
            continue
        if s[i] == "[":
            depth += 1
        elif s[i] == "]":
            if not depth:
                return i
            depth -= 1
        i += 1
    raise ConversionError(f"an unclosed bracket in {s!r}")


def md_inline(s: str):
    """Reads back a line of the Markdown this script writes: its text, links and images."""
    text, links, images = [], [], []
    i = 0
    while i < len(s):
        if s[i] == BACKSLASH and i + 1 < len(s):
            text.append(s[i + 1])
            i += 2
        elif s.startswith("![", i):
            j = closing_bracket(s, i + 1)
            end = s.index(")", j)
            images.append((md_inline(s[i + 2 : j])[0], s[j + 2 : end]))
            i = end + 1
        elif s[i] == "[":
            j = closing_bracket(s, i)
            end = s.index(")", j)
            inner, inner_links, inner_images = md_inline(s[i + 1 : j])
            text.append(inner)
            links.extend(inner_links)
            images.extend(inner_images)
            links.append(s[j + 2 : end])
            i = end + 1
        elif s.startswith("**", i) or s.startswith("~~", i):
            i += 2
        elif s[i] == "*":
            i += 1
        else:
            text.append(s[i])
            i += 1
    return "".join(text), links, images


def read_back(markdown: str):
    body = markdown.split("\n---\n", 1)[1]
    words, links, images, paragraph = [], [], [], []

    def finish():
        if paragraph:
            text, found_links, found_images = md_inline(" ".join(paragraph))
            words.extend(text.split())
            links.extend(found_links)
            images.extend(found_images)
            paragraph.clear()

    for row in body.split("\n"):
        row = re.sub(r"^(?:> ?)+", "", row)
        if not row.strip():
            finish()
            continue
        if (len(row) - len(row.rstrip(BACKSLASH))) % 2:  # an odd number of backslashes ends in a hard break
            row = row[:-1]
        paragraph.append(row)
    finish()
    return words, links, images


def first_difference(a: list, b: list) -> str:
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            return f"word {i + 1}: {' '.join(a[max(0, i - 4):i + 4])!r} became {' '.join(b[max(0, i - 4):i + 4])!r}"
    return f"{len(a)} words became {len(b)}"


# ---- main ----


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--work", default=str(REPO / "work"), help="the working copy (default: work/)")
    work = Path(parser.parse_args().work)
    content = work / "content"

    if content.exists():
        print(f"{content} already exists. This conversion runs once; nothing was written.")
        return 2
    needed = ["songlist.csv", "themed-songlists.csv", "index.json", "pages", "posts", "media"]
    missing = [name for name in needed if not (work / name).exists()]
    if missing:
        print(f"{work} has no {', '.join(missing)}. Nothing was written.")
        return 2

    index = json.loads((work / "index.json").read_text(encoding="utf-8"))
    entries = [("pages", e) for e in index["pages"]] + [("posts", e) for e in index["posts"]]
    target = {}
    for kind, e in entries:
        target[(kind, e["id"])] = f"{kind}/{Path(e['file']).stem}.md"
    pages_by_id = {i: t for (k, i), t in target.items() if k == "pages"}
    posts_by_id = {i: t for (k, i), t in target.items() if k == "posts"}

    # Convert everything in memory first, so a missing rule stops it before anything is written.
    try:
        songs, songlist_rows, theme_report = convert_songlist(work)
        documents, notes = [], Counter()
        for kind, e in entries:
            source = (work / e["file"]).read_text(encoding="utf-8")
            map_url = url_mapper(kind, pages_by_id, posts_by_id)
            converter = PageConverter(map_url, skip_tables=(kind == "pages" and e["id"] == SONGLIST_PAGE))
            converter.feed(source)
            converter.close()
            body = render_blocks(converter.blocks)
            markdown = front_matter(e) + ("\n" + body + "\n" if body else "")
            documents.append((kind, e, source, markdown, map_url, converter))
            notes.update(converter.notes)
    except ConversionError as problem:
        print(f"Stopped: {problem}. Nothing was written.")
        return 2

    # Write.
    for kind in ("pages", "posts"):
        (content / kind).mkdir(parents=True)
    with open(content / "songlist.csv", "w", encoding="utf-8", newline="") as f:
        csv.writer(f, lineterminator="\n").writerows(songlist_rows)
    for kind, e, _source, markdown, _map_url, _converter in documents:
        (content / target[(kind, e["id"])]).write_text(markdown, encoding="utf-8", newline="\n")
    media = sorted(p for p in (work / "media").rglob("*") if p.is_file())
    copies = {}
    for p in media:
        rel = p.relative_to(work / "media").as_posix()
        dest = content / "images" / ("site/" + rel[len("theme/") :] if rel.startswith("theme/") else rel)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dest)
        copies[p] = dest

    # Check.
    problems = []
    with open(content / "songlist.csv", encoding="utf-8", newline="") as f:
        written = list(csv.reader(f))
    if written[0] != SONGLIST_HEADER or [row[:3] for row in written[1:]] != songs:
        problems.append("songlist.csv: the songs don't match the working copy's")
    for kind, e, source, markdown, map_url, converter in documents:
        name = target[(kind, e["id"])]
        visible = VisibleText(map_url, skip_tables=converter.skip_tables)
        visible.feed(source)
        visible.close()
        words, links, images = read_back((content / name).read_text(encoding="utf-8"))
        if visible.words() != words:
            problems.append(f"{name}: the text changed at {first_difference(visible.words(), words)}")
        if Counter(visible.links) != Counter(links):
            problems.append(f"{name}: links {sorted((Counter(visible.links) - Counter(links)).elements())} became {sorted((Counter(links) - Counter(visible.links)).elements())}")
        if visible.images != images:
            problems.append(f"{name}: the images changed")
        if converter.skip_tables and [[c.strip() for c in row] for row in converter.skipped_rows[1:]] != songs:
            problems.append(f"{name}: the table left out isn't the songlist")
    for src, dest in copies.items():
        if not dest.is_file() or dest.stat().st_size != src.stat().st_size:
            problems.append(f"{dest}: not copied whole")
    counts = {kind: sum(1 for d in documents if d[0] == kind) for kind in ("pages", "posts")}
    if counts != {"pages": len(index["pages"]), "posts": len(index["posts"])}:
        problems.append(f"converted {counts}, but index.json lists {len(index['pages'])} pages and {len(index['posts'])} posts")

    print(f"Wrote {content}:")
    print(f"  songlist.csv  {len(songs):,} songs")
    for theme, (post, listed, missed) in theme_report.items():
        tagged = sum(1 for row in songlist_rows[1:] if theme in row[3].split("; "))
        print(f"                {theme}: {tagged} songs, from post {post}'s {listed}. Not matched on the master list: {len(missed)}")
        for song in missed:
            print(f"                  {song}")
    print(f"  pages/        {counts['pages']}")
    print(f"  posts/        {counts['posts']}")
    print(f"  images/       {len(copies)}")
    print("Changes of format:")
    for note, n in sorted(notes.items()):
        print(f"  {note}: {n}")

    if problems:
        print(f"\nThe check found {len(problems)} difference(s), so nothing was removed:")
        for p in problems:
            print(f"  {p}")
        return 1

    # Remove what the core files replaced.
    for kind, e, *_ in documents:
        (work / e["file"]).unlink()
    for folder in ("pages", "posts"):
        (work / folder).rmdir()
    shutil.rmtree(work / "media")
    for name in ("songlist.csv", "themed-songlists.csv", "index.json"):
        (work / name).unlink()
    print("\nChecked: every song, page, post and image came across, and each page and post reads word for word as before.")
    print("Removed songlist.csv, pages/*.html, posts/*.html, media/, themed-songlists.csv and index.json. shows.json stays.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
