#!/usr/bin/env python3
"""Make the small copies of the photos the Photos page shows (ADR-005, #18).

For each photo that pages/photos.md lists, it writes images/thumbs/<same
path>: 480 pixels on its shorter side, turned the right way up, and with no
metadata, so no camera or location data goes with it. It rewrites every copy
each time, and the same photo always gives the same bytes. It lists copies
whose photo the page no longer shows, but leaves them for a person to remove.

The grid falls back to the full photo where there's no small copy, so a
photo uploaded on GitHub shows up before anyone runs this.

    python scripts/make-thumbnails.py                     # work/content
    python scripts/make-thumbnails.py --content DIR

Needs Pillow (pip install Pillow). It isn't part of npm test or the deploy.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parent.parent
SHORT_SIDE = 480
# The same rule as site/js/photos-page.js: an image alone on its line.
IMAGE_LINE = re.compile(r"^ {0,3}!\[(?:\\.|[^\]\\])*\]\((?:<([^>]*)>|([^\s)]+))\)[ \t]*\\?[ \t]*$")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--content", default=str(REPO / "work" / "content"), help="the content folder (default: work/content)")
    content = Path(parser.parse_args().content).resolve()
    images = content / "images"
    thumbs = images / "thumbs"

    made, wanted = 0, set()
    for line in (content / "pages" / "photos.md").read_text(encoding="utf-8").splitlines():
        m = IMAGE_LINE.match(line)
        if not m:
            continue
        src = m.group(1) or m.group(2)
        if re.match(r"[A-Za-z][A-Za-z0-9+.-]*:|/", src):
            continue  # a web address, not a file in the content
        original = (content / "pages" / src).resolve()
        if not original.is_relative_to(images) or original.is_relative_to(thumbs) or not original.is_file():
            print(f"skipped {src}: not a photo in images/")
            continue
        rel = original.relative_to(images)
        wanted.add(rel.as_posix())
        thumb = thumbs / rel
        thumb.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(original) as opened:
            im = ImageOps.exif_transpose(opened)
            scale = SHORT_SIDE / min(im.size)
            if scale < 1:
                im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
            if thumb.suffix.lower() in (".jpg", ".jpeg"):
                im.convert("RGB").save(thumb, quality=78, optimize=True, progressive=True)
            else:
                im.save(thumb, optimize=True)
        made += 1

    before = sum(f.stat().st_size for f in images.rglob("*") if f.is_file() and not f.is_relative_to(thumbs) and f.relative_to(images).as_posix() in wanted)
    after = sum((thumbs / rel).stat().st_size for rel in wanted)
    print(f"Made {made} small copies in {thumbs.relative_to(content).as_posix()}/: {after / 1e6:.1f} MB, from {before / 1e6:.1f} MB of photos.")
    extra = sorted(f.relative_to(thumbs).as_posix() for f in thumbs.rglob("*") if f.is_file()) if thumbs.exists() else []
    for rel in extra:
        if rel not in wanted:
            print(f"  images/thumbs/{rel} is a copy of a photo the page no longer shows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
