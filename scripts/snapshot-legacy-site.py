#!/usr/bin/env python3
"""Keep a private, frozen copy of the site from before WordPress, 2004 to 2013 (#29, ADR-011).

karaokeunderground.com was a static site from 2004 until WordPress arrived on
2013-09-15, and the old files are still on the owner's host. The first snapshot
(#6) took only the WordPress site, so this script copies the old one, byte for
byte, before the domain moves:

  site/        every page and file of the old site that still answers, at its
               path on the old site, exactly as the server sent it. The old
               homepage is gone from the server, so site/index.html is the
               Wayback Machine's last copy from before WordPress, and so is any
               other linked file the server has lost but the Wayback Machine kept.
  index.json   where each file came from, its size and date, and every link that
               led nowhere
  README.md    what's here, how it compares with the audit, and what's missing

It starts from the old pages in docs/legacy-site/urls.csv and follows their
links, staying on the old site: WordPress's own paths, and addresses with a
query string, are left alone. Then it copies anything the Wayback Machine saw
the site serve that no page links to any more. It reads one address at a time,
like snapshot-content.py, and waits longer between requests to the Wayback
Machine.

The copy is the owner's content, and the old contact page shows the hosts'
personal details, so it stays private: snapshots/ is gitignored, and the build
never includes it. `npm run dev` shows it at http://127.0.0.1:8001/old/.

    python scripts/snapshot-legacy-site.py      # writes snapshots/<today>-pre-wordpress/

A copy is a record of the day it was taken. The script builds into a .partial
folder, renames it into place only when the whole run succeeds, never writes
over an existing copy, and leaves every file read-only. Standard library only.
Exit 0 = written, and it matches the audit. 1 = written, but something needs a
look (see its README). 2 = nothing written.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import html
import json
import os
import re
import shutil
import stat
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
URLS = REPO / "docs" / "legacy-site" / "urls.csv"
MARKER = "scripts/snapshot-legacy-site.py"  # recorded in index.json, to show which script made a copy
BEFORE_WORDPRESS = "20130914"  # WordPress's first post is from 2013-09-15, so the Wayback Machine's copies up to here are the old site
CDX = "https://web.archive.org/cdx/search/cdx"
WAYBACK = "https://web.archive.org/web"
HOME = {"/", "/index.html", "/index.htm"}  # the old homepage, which the server has lost
WORDPRESS = ("/wp-", "/index.php", "/xmlrpc.php", "/feed", "/comments/")
PICTURES = {".jpg", ".jpeg", ".png", ".gif", ".bmp"}
# What the audit (#1) counted on 2026-09-23: 30 old pages still answering, plus /forum/,
# and 413 photos under /images/ and the site root, 71.8 MB between them.
AUDIT = {"pages": 31, "photos": 413, "photo_mb": 71.8}
SAFE_PATH = "/:@!$&'()*+,;=-._~"  # the characters a URL path may carry as they are (RFC 3986)


class FetchError(Exception):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


class Fetcher:
    """Reads one address at a time, pausing between requests: longer for the Wayback Machine, which asks for it."""

    def __init__(self, delay: float, archive_delay: float):
        self.delays = {"site": delay, "archive": archive_delay}
        self.last = 0.0
        self.count = 0

    def get(self, url: str) -> tuple[bytes, dict[str, str], str]:
        """The body, the headers and the final address, after any redirects."""
        delay = self.delays["archive" if "archive.org" in url else "site"]
        error = "no response"
        for attempt in range(4):
            pause = delay - (time.monotonic() - self.last)
            if pause > 0:
                time.sleep(pause)
            try:
                request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(request, timeout=90) as response:
                    result = (response.read(), {k.lower(): v for k, v in response.headers.items()}, response.geturl())
                self.last = time.monotonic()
                self.count += 1
                return result
            except urllib.error.HTTPError as e:
                self.last = time.monotonic()
                self.count += 1
                if e.code == 429 or e.code >= 500:
                    error = f"HTTP {e.code}"
                else:
                    raise FetchError(f"{url}: HTTP {e.code}", e.code) from None
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                self.last = time.monotonic()
                error = str(e)
            time.sleep(5 * (attempt + 1))
        raise FetchError(f"{url}: {error}")


# --- Addresses -------------------------------------------------------------------------

def local_path(url_path: str) -> str:
    """Where a page or file of the old site goes in site/: its path, decoded, with a folder's page as index.html."""
    path = urllib.parse.unquote(url_path)
    if path.endswith("/"):
        path += "index.html"
    parts = [re.sub(r'[<>:"|?*\\]', "_", p) for p in path.split("/") if p not in ("", ".", "..")]
    return "/".join(parts)


def canonical(url_path: str) -> str:
    """One spelling per address, so "a b.jpg" and "a%20b.jpg" are fetched once."""
    return urllib.parse.quote(urllib.parse.unquote(url_path), safe=SAFE_PATH)


def site_url(url_path: str) -> str:
    return SITE + canonical(url_path)


def classify(link: str, base: str) -> tuple[str, str]:
    """('old', path) for a page or file of the old site; otherwise why it's left alone, and the address."""
    link = html.unescape(link).strip().replace("\\", "/")
    if not link or link.startswith("#"):
        return "none", link
    scheme = urllib.parse.urlsplit(link).scheme.lower()
    if scheme and scheme not in ("http", "https"):
        return "none", link  # mailto:, javascript: and the like
    parts = urllib.parse.urlsplit(urllib.parse.urljoin(base, link))
    if (parts.hostname or "").lower() not in HOSTS:
        return "external", f"{parts.scheme}://{parts.netloc}"
    if parts.query:
        return "wordpress", parts.path + "?" + parts.query
    path = canonical(parts.path or "/")
    if path.startswith(WORDPRESS):
        return "wordpress", path
    return "old", "/" if path in HOME else path


ATTRIBUTE = re.compile(r"""\b(?:href|src|background|lowsrc)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""", re.I)
PARAM = re.compile(r"""<param\b[^>]*\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""", re.I)
CSS_URL = re.compile(r"""url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)""", re.I)
# A file name in quotes, as old rollover scripts keep their images: MM_swapImage('b','','images/b_on.gif',1).
# A quote right after a letter is an apostrophe in a name, like trophy's6-16.html, so it can't open one.
QUOTED_FILE = re.compile(r"""(?<!\w)["']([^"'\s<>]+\.(?:html?|css|js|jpe?g|gif|png|bmp|swf|mp3|wav|mov|wmv|avi|mpe?g|mp4|pdf|txt))["']""", re.I)


def links_in(body: bytes, kind: str) -> list[str]:
    """Every address a page, stylesheet or script refers to."""
    text = body.decode("latin-1")  # byte for byte, whatever the file's encoding
    found = [m.group(1) for m in QUOTED_FILE.finditer(text)] if kind in ("html", "js") else []
    if kind == "html":
        found += ["".join(m.groups(default="")) for m in ATTRIBUTE.finditer(text)]
        found += [v for v in ("".join(m.groups(default="")) for m in PARAM.finditer(text)) if "." in v.rsplit("/", 1)[-1]]
    if kind in ("html", "css"):
        found += ["".join(m.groups(default="")) for m in CSS_URL.finditer(text)]
    return found


# --- The copy --------------------------------------------------------------------------

def old_pages() -> list[str]:
    """The old site's pages from the audit's URL list (#1)."""
    with URLS.open(encoding="utf-8") as f:
        return [row["path"] for row in csv.DictReader(f) if row["kind"] == "legacy-page"]


LISTED = "the Wayback Machine's list of the site's addresses"


def wayback_list(fetch: Fetcher) -> list[str]:
    """Every old-site address the Wayback Machine saw served, so files no page links to any more still get copied."""
    query = urllib.parse.urlencode({"url": "karaokeunderground.com/*", "filter": "statuscode:200", "fl": "original",
                                    "collapse": "urlkey", "output": "json"})
    body, _, _ = fetch.get(f"{CDX}?{query}")
    paths = []
    for row in json.loads(body or b"[]")[1:]:
        kind, path = classify(row[0], SITE)
        if kind == "old" and path != "/":
            paths.append(path)
    return paths


def wayback(fetch: Fetcher, url_path: str) -> tuple[bytes, dict[str, str], str, str] | None:
    """The Wayback Machine's last copy of an address from before WordPress, as the server sent it then."""
    query = urllib.parse.urlencode({"url": "karaokeunderground.com" + url_path, "to": BEFORE_WORDPRESS,
                                    "filter": "statuscode:200", "fl": "timestamp,original", "output": "json", "limit": "-1"})
    body, _, _ = fetch.get(f"{CDX}?{query}")
    rows = json.loads(body or b"[]")
    if len(rows) < 2:  # the first row is the header
        return None
    timestamp, original = rows[-1]
    data, headers, final = fetch.get(f"{WAYBACK}/{timestamp}id_/{original}")  # id_ asks for the original bytes, unchanged
    return data, headers, final, timestamp


def build(fetch: Fetcher, out: Path) -> dict:
    taken = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    queue = ["/"] + [canonical(p) for p in old_pages() if p not in HOME]
    seen = set(queue)
    referrers: dict[str, list[str]] = {p: ["docs/legacy-site/urls.csv"] for p in queue}
    files, missing = [], []
    by_folded: dict[str, str] = {}  # Windows can't keep two names that differ only in case
    left_alone: dict[str, Counter] = {"external": Counter(), "wordpress": Counter()}
    problems = []

    listed = False
    while queue or not listed:
        if not queue:  # every link followed: now anything the Wayback Machine saw that no page links to
            listed = True
            for path in wayback_list(fetch):
                if path not in seen and local_path(path).lower() not in by_folded:
                    seen.add(path)
                    referrers[path] = [LISTED]
                    queue.append(path)
            continue
        requested = queue.pop(0)
        url_path, sources, body = requested, referrers.get(requested, []), None
        live = "the WordPress homepage now"  # the server answers / with WordPress, so the old homepage comes from the Wayback Machine
        if requested != "/":
            try:
                body, headers, final = fetch.get(site_url(requested))
                source = "live"
            except FetchError as e:
                if e.status is None:
                    raise  # the site couldn't be read at all
                live = f"HTTP {e.status}"
            if body is not None:
                kind, url_path = classify(final, SITE)
                if kind != "old" or url_path == "/":
                    missing.append({"path": requested, "live": f"redirects to {final}", "wayback": None, "linked_from": sources[:5]})
                    continue
                seen.add(url_path)  # /forum becomes /forum/
        if body is None:
            try:
                restored, why = wayback(fetch, requested), "no copy from before WordPress"
            except FetchError as e:
                restored, why = None, str(e)
            if restored is None:
                missing.append({"path": requested, "live": live, "wayback": why, "linked_from": sources[:5]})
                continue
            body, headers, final, timestamp = restored
            source = f"wayback {timestamp}"

        rel = local_path(url_path)
        folded = rel.lower()
        if folded in by_folded and by_folded[folded] != rel:
            problems.append(f"{rel} differs only in case from {by_folded[folded]}, so it's left out")
            continue
        if folded in by_folded:
            continue  # the same file, reached by two addresses
        by_folded[folded] = rel
        target = out / "site" / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        content_type = headers.get("content-type", "")
        files.append({"path": rel, "source": source, "url": final, "bytes": len(body), "type": content_type,
                      "last_modified": headers.get("last-modified") or headers.get("x-archive-orig-last-modified"),
                      "sha256": hashlib.sha256(body).hexdigest(), "linked_from": sources[:3]})
        if len(files) % 50 == 0:
            print(f"  {len(files)} files, {fetch.count} requests", flush=True)

        suffix = Path(rel).suffix.lower()
        kind = "html" if content_type.startswith("text/html") or suffix in (".html", ".htm") else suffix.lstrip(".")
        if kind not in ("html", "css", "js"):
            continue
        page_url = SITE + url_path  # links resolve against the old site, wherever the copy came from
        for link in links_in(body, kind):
            kind, target_path = classify(link, page_url)
            if kind in left_alone:
                left_alone[kind][target_path] += 1
            elif kind == "old":
                referrers.setdefault(target_path, []).append(url_path)
                if target_path not in seen:
                    seen.add(target_path)
                    queue.append(target_path)

    return {"taken": taken, "files": files, "missing": missing, "left_alone": left_alone, "problems": problems,
            "requests": fetch.count}


# --- The record ------------------------------------------------------------------------

def is_page(f: dict) -> bool:
    return f["type"].startswith("text/html") or f["path"].endswith((".html", ".htm"))


def summary(r: dict) -> dict:
    files = r["files"]
    live_pages = [f for f in files if is_page(f) and f["source"] == "live"]
    restored = [f for f in files if f["source"] != "live"]
    photos = [f for f in files if Path(f["path"]).suffix.lower() in PICTURES and f["source"] == "live"]
    audit_pages = set(old_pages()) - HOME
    answered = {("/" + f["path"]).removesuffix("index.html") if f["path"].endswith("/index.html") else "/" + f["path"]
                for f in live_pages}
    counts = {
        "files": len(files),
        "bytes": sum(f["bytes"] for f in files),
        "pages_live": len(live_pages),
        "pages_from_the_audit_answering": len(audit_pages & answered),
        "pages_found_by_following_links": len(answered - audit_pages),
        "unlinked_files_from_the_wayback_list": sum(LISTED in f["linked_from"] for f in files),
        "photos_live": len(photos),
        "photo_mb": round(sum(f["bytes"] for f in photos) / 1e6, 1),
        "from_the_wayback_machine": len(restored),
        "missing": len(r["missing"]),
    }
    differences = []
    if counts["pages_from_the_audit_answering"] != AUDIT["pages"]:
        differences.append(f"{counts['pages_from_the_audit_answering']} of the audit's pages answered, not {AUDIT['pages']}")
    if counts["photos_live"] != AUDIT["photos"]:
        differences.append(f"{counts['photos_live']} photos, not the audit's {AUDIT['photos']}")
    if abs(counts["photo_mb"] - AUDIT["photo_mb"]) > 1:
        differences.append(f"{counts['photo_mb']} MB of photos, not the audit's {AUDIT['photo_mb']}")
    return {"counts": counts, "differences_from_audit": differences}


def readme(r: dict, s: dict, folder: str) -> str:
    c = s["counts"]
    restored = [f for f in r["files"] if f["source"] != "live"]
    lines = [
        "# The site from before WordPress, 2004 to 2013",
        "",
        f"Copied {r['taken']:%Y-%m-%dT%H:%M:%SZ} by `{MARKER}` ([#29](https://github.com/Johnesco/karaokeunderground/issues/29), "
        f"ADR-011), in {r['requests']} requests.",
        "",
        "**Private.** This is the owner's content, and `site/contact.html` shows the hosts' personal details. "
        "The folder is gitignored: never commit it, and never copy it anywhere public. Whether the old site "
        "becomes a public archive is the owner's call (the audit's question 13).",
        "",
        "## What's here",
        "",
        "| Path | What it is |",
        "|---|---|",
        "| `site/` | Every page and file of the old site that still answers, at its path on the old site, exactly as the server sent it |",
        "| `index.json` | Where each file came from, its size, date and SHA-256, and every link that led nowhere |",
        "",
        f"{c['files']} files, {c['bytes'] / 1e6:.1f} MB: {c['pages_live']} pages and {c['photos_live']} photos "
        f"({c['photo_mb']} MB) from the live server, and {c['from_the_wayback_machine']} from the Wayback Machine. "
        f"{c['pages_found_by_following_links']} of the pages weren't in the audit's list, and turned up by following links. "
        f"{c['unlinked_files_from_the_wayback_list']} files that no page links to any more came from {LISTED}.",
        "",
        "## Against the audit",
        "",
    ]
    lines += [f"- {d}" for d in s["differences_from_audit"]] or ["- Everything matches: the audit's 31 pages, 413 photos and 71.8 MB of photos."]
    lines += ["", "## From the Wayback Machine", "",
              "The server has lost these, so they're the Wayback Machine's last copies from before WordPress arrived on 2013-09-15:", ""]
    lines += [f"- `{f['path']}`, from {f['source'].split()[1][:8]}" for f in restored] or ["- None"]
    lines += ["", "## Missing", "",
              "Linked from the old pages or listed in the audit, but gone from the server, with no copy in the Wayback Machine from before WordPress:", ""]
    lines += [f"- `{m['path']}` ({m['live']}), linked from {', '.join(m['linked_from'][:2])}" for m in r["missing"]] or ["- Nothing"]
    if r["problems"]:
        lines += ["", "## Problems", ""] + [f"- {p}" for p in r["problems"]]
    lines += [
        "", "## Looking at it", "",
        "Run `npm run dev` and open http://127.0.0.1:8001/old/. The dev server shows the newest copy in "
        "`snapshots/` at `/old/`, and nothing on the site links there. It sends the pages without a charset, "
        "so their own `iso-8859-1` declaration applies, and points their few links to the old domain back into `/old/`.",
        "",
        "The files are read-only, and the script never writes over a copy. To take another, run it on another day, "
        f"or give it a folder of its own: `python {MARKER} --out snapshots/{folder}-2`",
        "",
    ]
    return "\n".join(lines)


def freeze(folder: Path) -> None:
    """Read-only, like the first snapshot (#7), so nothing edits the record by accident."""
    for p in folder.rglob("*"):
        if p.is_file():
            os.chmod(p, stat.S_IREAD | stat.S_IRGRP | stat.S_IROTH)


def remove(folder: Path) -> None:
    """Deletes a failed run's partial copy, read-only files included."""
    def writable(func, path, _):
        os.chmod(path, stat.S_IWRITE)
        func(path)
    if sys.version_info >= (3, 12):
        shutil.rmtree(folder, onexc=writable)
    else:
        shutil.rmtree(folder, onerror=writable)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Keep a private, frozen copy of the pre-WordPress site (#29).")
    parser.add_argument("--out", type=Path, default=REPO / "snapshots" / f"{dt.date.today()}-pre-wordpress",
                        help="where to write it (default: snapshots/<today>-pre-wordpress/)")
    parser.add_argument("--delay", type=float, default=0.4, help="seconds between requests to the site (default: 0.4)")
    parser.add_argument("--archive-delay", type=float, default=1.5,
                        help="seconds between requests to the Wayback Machine (default: 1.5)")
    args = parser.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):  # Windows defaults piped output to cp1252, which can't show every character
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    out = args.out.resolve()
    if not out.name or out == REPO or out in REPO.parents:
        parser.error(f"--out can't be {out}")
    if out.exists():
        print(f"{out} already exists. A copy stays as it was taken, so this one is left alone.", file=sys.stderr)
        return 2
    partial = out.with_name(out.name + ".partial")
    if partial.exists():  # left over from a run that failed
        remove(partial)
    partial.mkdir(parents=True)
    try:
        report = build(Fetcher(args.delay, args.archive_delay), partial)
    except (FetchError, ValueError, OSError) as e:
        print(f"The copy failed: {e}", file=sys.stderr)
        print(f"Nothing written to {out}; the partial copy is in {partial}.", file=sys.stderr)
        return 2
    s = summary(report)
    index = {"script": MARKER, "source": SITE, "taken": f"{report['taken']:%Y-%m-%dT%H:%M:%SZ}", "requests": report["requests"],
             **s, "files": report["files"], "missing": report["missing"],
             "left_alone": {k: dict(v.most_common()) for k, v in report["left_alone"].items()}, "problems": report["problems"]}
    (partial / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (partial / "README.md").write_text(readme(report, s, out.name), encoding="utf-8")
    if out.exists():  # something else wrote it during the run
        print(f"{out} appeared during the run and is left alone. The new copy is in {partial}.", file=sys.stderr)
        return 2
    partial.rename(out)
    freeze(out)
    c = s["counts"]
    print(f"Wrote {out}: {c['files']} files, {c['bytes'] / 1e6:.1f} MB, in {report['requests']} requests.")
    for line in s["differences_from_audit"]:
        print(f"  differs from the audit: {line}")
    for m in report["missing"]:
        print(f"  missing: {m['path']} ({m['live']})")
    for line in report["problems"]:
        print(f"  problem: {line}")
    return 1 if s["differences_from_audit"] or report["problems"] else 0


if __name__ == "__main__":
    sys.exit(main())
