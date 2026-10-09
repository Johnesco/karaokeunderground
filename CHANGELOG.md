# Changelog

All notable changes to the Karaoke Underground site are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); see the sdlc-baseline
[release-management](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/release-management.md) guide.

## [Unreleased]

### Changed

- The home page is back, as on the old site: a slideshow of 8 photos from the shows, then the intro, "You've found us" ([#36](https://github.com/Johnesco/karaokeunderground/issues/36), [#17](https://github.com/Johnesco/karaokeunderground/issues/17), [ADR-015](docs/adr/015-home-page-montage-and-intro.md)). The slideshow can be paused, and starts paused for reduced motion. The logo leads there, and the songlist moved to `/songlist/`. Old songlist addresses at `/`, like `/?theme=sad`, land on it
