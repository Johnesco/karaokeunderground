/**
 * The content check (ADR-002): everything that makes the core files safe to
 * deploy, run by `npm test` and, later, before every Netlify deploy.
 *
 * An error means the site would break, lose something or publish something it
 * shouldn't, so the check fails. A warning is worth a look but doesn't stop
 * anything. The check reads local files only, and never the clock or the
 * network, so the same files always get the same answer (a show in the past is
 * not an error).
 *
 *   content/
 *     songlist.csv    the songs (see songlist.js for the columns)
 *     pages/*.md      one Markdown file per page: about.md
 *     posts/*.md      one per post, named for its date: 2025-12-27-sad-songs-only-2025.md
 *     images/         the images, in year/month folders, plus site/ for the logo and icons
 */

import fs from 'node:fs';
import path from 'node:path';
import { readSonglist, sameKey, isListed, UNLISTED } from '../../site/js/songlist.js';
import { parseFrontMatter } from '../../site/js/front-matter.js';

/** Fewer songs than this is a cut-off or filtered export, not the songlist. */
export const MIN_SONGS = 1000;
export const IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const TOP_LEVEL = ['songlist.csv', 'pages', 'posts', 'images'];
const FRONT_MATTER_KEYS = ['title', 'date', 'updated', 'old_url', 'instagram'];
const INSTAGRAM_NAME = /^[A-Za-z0-9._]{1,30}$/; // an Instagram account name, as in its address (ADR-005)
// The line under a table's header row, like |---|:---:|. The renderer (ADR-004) has no tables.
const TABLE_RULE = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]*$/;
const PAGE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const POST_NAME = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

/**
 * Checks a content folder.
 *
 * @param {string} dir the content folder
 * @param {{ minSongs?: number }} [options]
 * @returns {{ errors: Problem[], warnings: Problem[], summary: object }}
 *   where a Problem is { file, line?, message }
 */
export function checkContent(dir, { minSongs = MIN_SONGS } = {}) {
  const report = { errors: [], warnings: [], summary: {} };
  const error = (file, line, message) => report.errors.push({ file, line, message });
  const warn = (file, line, message) => report.warnings.push({ file, line, message });

  if (!isDirectory(dir)) {
    error('', null, "the content folder doesn't exist");
    return report;
  }
  const files = listFiles(dir);

  for (const name of fs.readdirSync(dir).sort()) {
    if (!TOP_LEVEL.includes(name)) warn(name, null, "the site doesn't use this. The core files are songlist.csv, pages/, posts/ and images/");
  }

  // songlist.csv
  if (files.has('songlist.csv')) {
    const text = readText(dir, 'songlist.csv', error);
    if (text !== null) report.summary.songlist = checkSonglist(text, { minSongs, error, warn });
  } else {
    error('songlist.csv', null, 'the songlist is missing');
  }

  // pages/ and posts/
  const oldUrls = new Map();
  for (const kind of ['pages', 'posts']) {
    if (!isDirectory(path.join(dir, kind))) {
      error(`${kind}/`, null, `the ${kind} folder is missing`);
      continue;
    }
    let count = 0;
    for (const rel of [...files].filter((f) => f.startsWith(`${kind}/`))) {
      const name = rel.slice(kind.length + 1);
      if (name.includes('/')) {
        warn(rel, null, `the site only reads files directly inside ${kind}/`);
      } else if (!name.endsWith('.md')) {
        warn(rel, null, `the site only reads Markdown (.md) files in ${kind}/`);
      } else {
        count++;
        checkMarkdown(dir, rel, kind, files, oldUrls, error, warn);
      }
    }
    report.summary[kind] = count;
  }

  // images/
  if (!isDirectory(path.join(dir, 'images'))) {
    error('images/', null, 'the images folder is missing');
  } else {
    let count = 0;
    let thumbs = 0;
    for (const rel of [...files].filter((f) => f.startsWith('images/'))) {
      if (!IMAGE_TYPES.includes(path.extname(rel).toLowerCase())) {
        warn(rel, null, `the site doesn't show this kind of file. Images can be ${IMAGE_TYPES.join(', ')}`);
        continue;
      }
      if (rel.startsWith('images/thumbs/')) thumbs++;
      else count++;
      if (fs.statSync(path.join(dir, rel)).size === 0) error(rel, null, 'the file is empty. The upload may have failed');
    }
    report.summary.images = count;
    report.summary.thumbs = thumbs;
  }

  return report;
}

// ---- songlist.csv ----

function checkSonglist(text, { minSongs, error, warn }) {
  const file = 'songlist.csv';
  const { songs, errors, emptyRows, columns } = readSonglist(text);
  for (const e of errors) error(file, e.line, e.message);

  if (emptyRows.length) {
    warn(file, null, `skipped ${plural(emptyRows.length, 'empty row')} (${lineList(emptyRows)})`);
  }

  const seen = new Map();
  const spellings = { Themes: new Map(), Tags: new Map() };
  for (const song of songs) {
    const at = (message) => error(file, song.line, message);

    song.fields.forEach((field) => {
      const problem = garbled(field);
      if (problem) at(problem);
    });
    if (!song.artist) at('the Artist is blank');
    if (!song.title) at('the Title is blank');
    for (const name of ['Artist', 'Title', 'Album']) {
      const raw = song.fields[columns[name]];
      if (raw !== raw.trim()) warn(file, song.line, `the ${name} has spaces at the start or end`);
    }

    for (const [name, values] of [['Themes', song.themes], ['Tags', song.tags]]) {
      if (song.fields[columns[name]].includes(',')) {
        at(`${name} has a comma. Separate ${name.toLowerCase()} with semicolons, like "sad; scary"`);
      }
      const inCell = new Set();
      for (const value of values) {
        const key = sameKey(value);
        if (inCell.has(key)) {
          warn(file, song.line, `${name} has "${value}" twice`);
          continue;
        }
        inCell.add(key);
        if (!spellings[name].has(key)) spellings[name].set(key, new Map());
        const forms = spellings[name].get(key);
        if (!forms.has(value)) forms.set(value, []);
        forms.get(value).push(song.line);
      }
    }
    if (song.tags.some((t) => sameKey(t) === UNLISTED)) {
      at('"unlisted" only works in the Themes column. Move it there to take the song off the lists');
    }

    if (song.artist && song.title) {
      const key = `${sameKey(song.artist)}\u{0}${sameKey(song.title)}`;
      if (seen.has(key)) at(`this song is already on line ${seen.get(key)}`);
      else seen.set(key, song.line);
    }
  }

  const themes = {};
  for (const [name, byKey] of Object.entries(spellings)) {
    for (const [key, forms] of byKey) {
      const lines = [...forms.values()].flat();
      if (forms.size > 1) {
        const all = [...forms].map(([form, formLines]) => `"${form}" (${lineList(formLines)})`).join(' and ');
        warn(file, null, `${name} spells one value ${forms.size} ways: ${all}. Pick one`);
      }
      if (name === 'Themes' && key !== UNLISTED) {
        if (lines.length === 1) warn(file, lines[0], `the theme "${[...forms.keys()][0]}" is on this song only. A typo?`);
        themes[[...forms.keys()][0]] = lines.length;
      }
    }
  }

  if (songs.length < minSongs && !errors.length) {
    error(file, null, `only ${plural(songs.length, 'song')}. The songlist has more than ${minSongs.toLocaleString('en-US')}, so this looks like a cut-off or filtered export`);
  }

  return {
    songs: songs.length,
    unlisted: songs.filter((s) => !isListed(s)).length,
    themes: Object.fromEntries(Object.entries(themes).sort(([a], [b]) => (a < b ? -1 : 1))),
    tags: spellings.Tags.size,
  };
}

// ---- pages and posts ----

function checkMarkdown(dir, rel, kind, files, oldUrls, error, warn) {
  const text = readText(dir, rel, error);
  if (text === null) return;

  const name = path.posix.basename(rel);
  const nameMatch = (kind === 'posts' ? POST_NAME : PAGE_NAME).exec(name);
  if (!nameMatch) {
    error(rel, null, kind === 'posts'
      ? 'a post file name is its date, then lowercase words joined by hyphens, like 2026-12-26-sad-songs-only.md'
      : 'a page file name is lowercase words joined by hyphens, like about.md');
  }

  let doc;
  try {
    doc = parseFrontMatter(text);
  } catch (e) {
    if (e.name !== 'FrontMatterError') throw e;
    error(rel, e.line, e.message);
    return;
  }
  const { data, body, bodyLine } = doc;

  for (const key of Object.keys(data)) {
    if (!FRONT_MATTER_KEYS.includes(key)) {
      error(rel, null, `"${key}" isn't a front matter field the site uses. The fields are ${FRONT_MATTER_KEYS.join(', ')}`);
    }
  }
  if (!data.title) error(rel, null, 'the title is missing');
  for (const key of ['date', 'updated']) {
    if (data[key] && !isRealDate(data[key])) {
      error(rel, null, `${key} "${data[key]}" isn't a date. Write dates as year-month-day, like 2026-10-03`);
    }
  }
  if (kind === 'posts') {
    if (!data.date) error(rel, null, 'a post needs a date');
    else if (nameMatch && nameMatch[1] !== data.date) {
      error(rel, null, `the file name says ${nameMatch[1]}, but the date says ${data.date}. Make them match`);
    }
  }
  if (isRealDate(data.date) && isRealDate(data.updated) && data.updated < data.date) {
    warn(rel, null, `updated (${data.updated}) is earlier than date (${data.date})`);
  }
  if (data.instagram !== undefined && !INSTAGRAM_NAME.test(data.instagram)) {
    error(rel, null, `instagram is the account's name as in its address, like karaokeunderground, not "${data.instagram}"`);
  }
  if (data.old_url) {
    if (!data.old_url.startsWith('/')) {
      error(rel, null, `old_url is the old address without the domain, like /?p=835`);
    } else if (oldUrls.has(data.old_url)) {
      error(rel, null, `old_url ${data.old_url} is already used by ${oldUrls.get(data.old_url)}`);
    } else {
      oldUrls.set(data.old_url, rel);
    }
  }

  const lines = body.split('\n');
  if (lines.every((l) => l.trim() === '')) warn(rel, null, 'this has no text yet');

  let fence = null;
  lines.forEach((line, i) => {
    const lineNo = bodyLine + i;
    const problem = garbled(line);
    if (problem) error(rel, lineNo, problem);

    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fenceMatch[1][0] === fence) fence = null;
      return;
    }
    if (fence) return;

    for (const tag of htmlIn(line)) {
      error(rel, lineNo, `${tag} is HTML. Pages and posts are plain Markdown, so write it without HTML`);
    }
    if (TABLE_RULE.test(line)) {
      error(rel, lineNo, 'this is a table, which the site can\u{2019}t show. Write it as a list, or as lines ending in a backslash');
    }
    for (const ref of referencesIn(line)) {
      if (ref.definition) {
        error(rel, lineNo, 'the site can\u{2019}t show reference-style links. Put the address in the link itself, like [text](address)');
      } else {
        checkReference(rel, lineNo, ref, files, error, warn);
      }
    }
  });
}

/** Tags and comments in a line of Markdown, ignoring code spans, autolinks and \< escapes. */
export function htmlIn(line) {
  const text = line
    .replace(/(`+)[^`]*?\1/g, '')
    .replace(/\\</g, '')
    .replace(/<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*>/g, '')
    .replace(/<[^\s<>@]+@[^\s<>]+>/g, '');
  return [...text.matchAll(/<\/?[A-Za-z][A-Za-z0-9-]*(?=[\s/>]|$)|<!--|<![A-Za-z]|<\?/g)].map((m) => {
    // Show the whole tag when it closes soon after on the same line, else how it starts.
    const rest = text.slice(m.index);
    const end = rest.indexOf('>');
    const whole = end !== -1 && end < 80 && !rest.slice(1, end).includes('<');
    return `"${whole ? rest.slice(0, end + 1) : `${m[0]}…`}"`;
  });
}

/**
 * The links and images in a line of Markdown: [text](target), ![alt](target)
 * and reference definitions ([name]: target).
 */
export function referencesIn(line) {
  const refs = [];
  const definition = /^ {0,3}\[(?:\\.|[^\]\\])+\]:[ \t]*(<[^>]*>|\S+)/.exec(line);
  if (definition) refs.push({ image: false, alt: null, target: unwrap(definition[1]), definition: true });

  for (let i = line.indexOf(']('); i !== -1; i = line.indexOf('](', i + 1)) {
    if (isEscaped(line, i)) continue;
    const open = openingBracket(line, i);
    if (open === -1) continue;
    const target = destination(line, i + 2);
    if (target === null) continue;
    const image = open > 0 && line[open - 1] === '!' && !isEscaped(line, open - 1);
    refs.push({ image, alt: image ? line.slice(open + 1, i) : null, target });
  }
  return refs;
}

function checkReference(rel, lineNo, ref, files, error, warn) {
  if (ref.image && ref.alt.trim() === '') {
    warn(rel, lineNo, "an image has no alt text. Describe it between the brackets, like ![Flyer for the show](...), for people who can't see it");
  }
  const target = ref.target;
  if (target === '' || target.startsWith('#')) return;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target) || target.startsWith('//')) {
    if (ref.image) warn(rel, lineNo, `an image from another site can change or disappear. Put a copy in images/ and link that: ${target}`);
    return;
  }

  let local;
  try {
    local = decodeURIComponent(target.replace(/[?#].*$/, ''));
  } catch {
    error(rel, lineNo, `${target} isn't a valid file path`);
    return;
  }
  if (local.startsWith('/')) {
    error(rel, lineNo, `${target} starts with /. Link to files with a path from this one, like ../images/2026/01/flyer.jpg`);
    return;
  }
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(rel), local));
  if (resolved.startsWith('../') || resolved === '..') {
    error(rel, lineNo, `${target} points outside the content folder`);
    return;
  }
  if (!ref.image && (resolved === 'posts' || resolved === 'posts/')) return; // ../posts/ links to the archive of posts (ADR-009)
  if (!files.has(resolved)) {
    error(rel, lineNo, `${target} doesn't exist. Check the path, and that upper and lower case match the file's name`);
    return;
  }
  if (ref.image && !IMAGE_TYPES.includes(path.posix.extname(resolved).toLowerCase())) {
    error(rel, lineNo, `${target} isn't an image the site can show. Images can be ${IMAGE_TYPES.join(', ')}`);
  }
}

function isEscaped(line, i) {
  let n = 0;
  while (i - n - 1 >= 0 && line[i - n - 1] === '\\') n++;
  return n % 2 === 1;
}

/** Finds the [ that the ] at `close` closes, allowing nested brackets. */
function openingBracket(line, close) {
  let depth = 0;
  for (let i = close - 1; i >= 0; i--) {
    if (isEscaped(line, i)) continue;
    if (line[i] === ']') depth++;
    else if (line[i] === '[') {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

/** Reads a link destination starting at `start`, just after the "(". */
function destination(line, start) {
  let i = start;
  while (line[i] === ' ' || line[i] === '\t') i++;
  if (line[i] === '<') {
    const end = line.indexOf('>', i);
    return end === -1 ? null : line.slice(i + 1, end);
  }
  let depth = 0;
  let target = '';
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && i + 1 < line.length) {
      target += line[i + 1];
      i++;
    } else if (c === '(') {
      depth++;
      target += c;
    } else if (c === ')') {
      if (depth === 0) return target;
      depth--;
      target += c;
    } else if (c === ' ' || c === '\t') {
      return target;
    } else {
      target += c;
    }
  }
  return null;
}

function unwrap(target) {
  return target.startsWith('<') && target.endsWith('>') ? target.slice(1, -1) : target;
}

// ---- shared ----

/**
 * What's wrong with a piece of text that lost or mangled characters on the way
 * in, or null. The usual cause is a file saved in one encoding and read in
 * another, like a CSV from Excel that wasn't saved as "CSV UTF-8".
 */
export function garbled(text) {
  if (/[\u{0}-\u{8}\u{B}\u{C}\u{E}-\u{1F}\u{7F}]/u.test(text)) {
    return 'there is an invisible control character here. Retype the text around it';
  }
  if (text.includes('\u{FFFD}')) {
    return "there is a \u{FFFD} here, which means characters were lost when the file was saved. Save it as UTF-8 and retype what's missing";
  }
  if (/\u{C3}[\u{80}-\u{BF}\u{152}\u{153}\u{160}\u{161}\u{178}\u{17D}\u{17E}\u{192}\u{2C6}\u{2DC}\u{2013}\u{2014}\u{2018}-\u{201E}\u{2020}-\u{2022}\u{2026}\u{2030}\u{2039}\u{203A}\u{20AC}\u{2122}]|\u{E2}\u{20AC}|\u{C2}[\u{A0}-\u{BF}]/u.test(text)) {
    return 'the text is garbled, like "\u{C3}\u{A9}" where "\u{E9}" should be. The file was saved in one encoding and read in another: save it as UTF-8 (in Excel, "CSV UTF-8")';
  }
  return null;
}

function readText(dir, rel, error) {
  const bytes = fs.readFileSync(path.join(dir, rel));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    const loose = new TextDecoder('utf-8').decode(bytes);
    const line = loose.slice(0, loose.indexOf('\u{FFFD}')).split('\n').length;
    error(rel, line, `the file isn't saved as UTF-8, so some characters can't be read. Save it as UTF-8 (in Excel, "CSV UTF-8")`);
    return null;
  }
}

/** Every file under dir, as paths relative to it with forward slashes, in a fixed order. */
function listFiles(dir) {
  const out = new Set();
  const walk = (sub) => {
    for (const entry of fs.readdirSync(path.join(dir, sub), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const rel = sub ? `${sub}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(rel);
      else if (entry.isFile()) out.add(rel);
    }
  };
  walk('');
  return out;
}

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** A real calendar date written YYYY-MM-DD: 2026-02-30 is not one. */
export function isRealDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function plural(n, word) {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
}

function lineList(lines) {
  const shown = lines.slice(0, 5).join(', ');
  return `line${lines.length === 1 ? '' : 's'} ${shown}${lines.length > 5 ? ` and ${lines.length - 5} more` : ''}`;
}
