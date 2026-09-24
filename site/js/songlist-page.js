/**
 * The songlist page (#11): every song, a search box, the themed lists, and
 * tags once songs have them. It all comes from content/songlist.csv, and a
 * song with the theme "unlisted" is on no list at all (ADR-002).
 *
 * The search and filter logic are plain functions, so the tests run them;
 * enhanceSonglist() wires them to the page in the browser.
 */

import { readSonglist, isListed, sameKey, UNLISTED } from './songlist.js';
import { escapeHtml } from './markdown.js';
import { formatDate, markdownHtml } from './views.js';

// Letters that Unicode doesn't split into a base letter and an accent.
const LETTERS = { '\u{F8}': 'o', '\u{E6}': 'ae', '\u{153}': 'oe', '\u{DF}': 'ss', '\u{111}': 'd', '\u{F0}': 'd', '\u{142}': 'l', '\u{FE}': 'th', '\u{131}': 'i' };

/**
 * Text the way search compares it: no case, accents, apostrophes or
 * punctuation, and & read as "and". So "bjork" finds Björk, and "guns n roses"
 * finds Guns N' Roses.
 */
export function fold(text) {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\u{F8}\u{E6}\u{153}\u{DF}\u{111}\u{F0}\u{142}\u{FE}\u{131}]/gu, (c) => LETTERS[c])
    .replace(/['\u{2018}\u{2019}]/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** A search box's words. Each one has to appear in the song's artist, title or album, in any order. */
export function queryWords(query) {
  return fold(query).split(' ').filter(Boolean);
}

/** The songs the page lists: all but the unlisted ones, each with the text search looks through and what each column sorts by. */
export function listSongs(csvText) {
  return readSonglist(csvText).songs.filter(isListed).map((song) => ({
    ...song,
    key: fold(`${song.artist} ${song.title} ${song.album}`),
    sortKeys: { artist: fold(song.artist), title: fold(song.title), album: fold(song.album) },
  }));
}

/** The columns, in their usual order. Any of them can sort the list (#22, ADR-006). */
export const SORTS = ['artist', 'title', 'album'];

/** The columns in the order shown: the one the list is sorted by first, then the other two in their usual order. */
export function columnsFor(sort) {
  return [sort, ...SORTS.filter((column) => column !== sort)];
}

/**
 * The songs sorted A to Z by one column, ignoring case, accents and
 * punctuation but not words, so "Zombies, The" stays under Z. Ties go by the
 * next column shown, then the file's order, and blanks go last.
 */
export function sortSongs(songs, sort) {
  const columns = columnsFor(sort);
  return songs
    .map((song, index) => ({ song, index }))
    .sort((a, b) => {
      for (const column of columns) {
        const x = a.song.sortKeys[column];
        const y = b.song.sortKeys[column];
        if (x === y) continue;
        if (!x || !y) return x ? -1 : 1;
        return x < y ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map(({ song }) => song);
}

/** The themes or tags the songs use, with how many songs have each, in alphabetical order. */
export function valuesOf(songs, field) {
  const found = new Map();
  for (const song of songs) {
    for (const value of song[field]) {
      const key = sameKey(value);
      if (key === UNLISTED) continue;
      if (!found.has(key)) found.set(key, { key, name: value, count: 0 });
      found.get(key).count++;
    }
  }
  return [...found.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** Whether a song shows for the search words, the themed list and the tags picked. */
export function matches(song, { words = [], theme = '', tags = [] } = {}) {
  if (theme && !song.themes.some((t) => sameKey(t) === theme)) return false;
  if (tags.some((tag) => !song.tags.some((t) => sameKey(t) === tag))) return false;
  return words.every((word) => song.key.includes(word));
}

/** "sad" -> "Sad": how a theme or tag is named on the page. */
export function label(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const count = (n) => n.toLocaleString('en-US');

/** What the status line says about what's showing, and how it's sorted when that isn't by artist. */
export function describe(shown, { words = [], theme = '', tags = [], sort = 'artist' }, themes) {
  const list = theme ? ` on the ${label(themes.find((t) => t.key === theme)?.name ?? theme)} list` : '';
  const order = sort === 'artist' ? '' : `, sorted by ${sort}`;
  if (!words.length && !tags.length) return `Showing all ${count(shown)} song${shown === 1 ? '' : 's'}${list}${order}`;
  if (shown === 0) return `No songs match${list}. Try fewer words, or check the spelling`;
  return `${count(shown)} song${shown === 1 ? ' matches' : 's match'}${list}${order}`;
}

// The clear button's X, drawn as two lines so it's crisp and centred in any font.
// Screen readers skip it and read the button's hidden text instead.
const CLEAR_ICON = '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M3 3 13 13M13 3 3 13" stroke="currentColor" stroke-width="2" fill="none"/></svg>';

function choice(type, name, value, text, checked) {
  return `<label class="choice"><input type="${type}" name="${name}" value="${escapeHtml(value)}"${checked ? ' checked' : ''}> <span>${escapeHtml(text)}</span></label>\n`;
}

// What a screen reader hears before a column that isn't first, so a song reads
// "Come Pick Me Up, by Adams, Ryan, from Heartbreaker" in any order.
const LEADS = { artist: ', by ', title: ', ', album: ', from ' };
const PLACES = ['song-first', 'song-second', 'song-third'];
const HEADINGS = { artist: 'Artist', title: 'Title', album: 'Album' };
const SEP = '<span class="song-sep" aria-hidden="true"> \u{2013} </span>';

/**
 * One song, its columns in the order given. Every column gets its cell, even
 * a blank one, so wide screens keep each in its place. On a phone the first
 * two share a line, with a dash between them, and the third sits below.
 */
export function songItem(song, columns = SORTS) {
  const cell = (column, i) => {
    const text = song[column];
    const lead = text && columns.slice(0, i).some((before) => song[before])
      ? `<span class="visually-hidden">${LEADS[column]}</span>`
      : '';
    return `<span class="song-${column} ${PLACES[i]}">${lead}${escapeHtml(text)}</span>`;
  };
  const [first, second, third] = columns;
  const sep = song[first] && song[second] ? SEP : '';
  return `<li>${cell(first, 0)}${sep}${cell(second, 1)} ${cell(third, 2)}</li>\n`;
}

function sortButton(column) {
  return `<button class="song-sort" type="button" data-sort="${column}" aria-pressed="${column === 'artist'}">${HEADINGS[column]}</button>\n`;
}

/**
 * The page: its title and intro from pages/songlist.md, the song count and the
 * date the list last changed, the search and filters, and every song.
 */
export function songlistView(doc, songs, updated) {
  const byArtist = sortSongs(songs, 'artist');
  const themes = valuesOf(songs, 'themes');
  const tags = valuesOf(songs, 'tags');
  const when = updated ? ` Updated <time datetime="${escapeHtml(updated)}">${formatDate(updated)}</time>.` : '';
  const html = `<h1>${escapeHtml(doc.data.title)}</h1>\n${markdownHtml(doc.body, 'pages')}`
    + `<p class="song-summary">${count(songs.length)} songs.${when}</p>\n`
    // The list buttons come first, then tags, then the search box, which narrows whatever list is picked.
    + '<form class="song-search" role="search" action="/songlist/">\n'
    + (themes.length
      ? '<fieldset class="choices"><legend>List</legend>\n'
        + choice('radio', 'theme', '', `All songs (${count(songs.length)})`, true)
        + themes.map((t) => choice('radio', 'theme', t.key, `${label(t.name)} (${count(t.count)})`, false)).join('')
        + '</fieldset>\n'
      : '')
    + (tags.length
      ? '<fieldset class="choices"><legend>Tags</legend>\n'
        + tags.map((t) => choice('checkbox', 'tag', t.key, `${label(t.name)} (${count(t.count)})`, false)).join('')
        + '</fieldset>\n'
      : '')
    // "Search" sits beside the box, and screen readers hear "Search the songlist".
    + '<div class="song-query-row">\n'
    + '<label class="song-query-label" for="song-query">Search<span class="visually-hidden"> the songlist</span></label>\n'
    + '<div class="song-query">\n'
    + '<input id="song-query" name="q" type="search" autocomplete="off" spellcheck="false" placeholder="Artist, title or album">\n'
    + `<button class="song-clear" type="button" hidden><span class="visually-hidden">Clear the search</span>${CLEAR_ICON}</button>\n`
    + '</div>\n'
    + '</div>\n'
    + '</form>\n'
    + `<p class="song-count" role="status">${describe(songs.length, {}, themes)}</p>\n`
    // The column names are the sort buttons, named "Sort by" as the list buttons are named "List",
    // and the list starts sorted by artist. On a phone they pile up as each song does,
    // with the same dash after the first.
    + '<div class="song-table" data-sort="artist">\n'
    + '<fieldset class="song-sort-set"><legend>Sort by</legend>\n'
    + `<div class="songs-head">\n${sortButton('artist')}${SEP}\n${sortButton('title')}${sortButton('album')}</div>\n`
    + '</fieldset>\n'
    + `<ul class="songs" aria-label="Songs">\n${byArtist.map((song) => songItem(song)).join('')}</ul>\n`
    + '</div>\n';
  return { title: doc.data.title, html, wide: true, enhance: (main) => enhanceSonglist(main, byArtist, themes) };
}

/**
 * Makes the page's search, filters and sorting work: rows show and hide as
 * you type, a column's name sorts the list by it, and the address keeps it
 * all, so /songlist/?theme=sad&sort=title can be shared.
 */
export function enhanceSonglist(main, songs, themes) {
  const form = main.querySelector('.song-search');
  const input = form.querySelector('#song-query');
  const clear = form.querySelector('.song-clear');
  const status = main.querySelector('.song-count');
  const table = main.querySelector('.song-table');
  const head = table.querySelector('.songs-head');
  const sep = head.querySelector('.song-sep');
  const list = table.querySelector('.songs');
  const buttons = new Map([...head.querySelectorAll('.song-sort')].map((button) => [button.dataset.sort, button]));
  let sort = 'artist';
  let rows = songs; // the songs in the order of their rows, which starts by artist
  let items = [...list.children];

  const params = new URLSearchParams(window.location.search);
  input.value = params.get('q') ?? '';
  const theme = form.querySelector(`input[name="theme"][value="${CSS.escape(sameKey(params.get('theme') ?? ''))}"]`);
  if (theme) theme.checked = true;
  for (const tag of params.getAll('tag')) {
    const box = form.querySelector(`input[name="tag"][value="${CSS.escape(sameKey(tag))}"]`);
    if (box) box.checked = true;
  }

  let announce;
  const update = (event) => {
    const state = {
      words: queryWords(input.value),
      theme: form.querySelector('input[name="theme"]:checked')?.value ?? '',
      tags: [...form.querySelectorAll('input[name="tag"]:checked')].map((box) => box.value),
      sort,
    };
    clear.hidden = !input.value;
    let shown = 0;
    rows.forEach((song, i) => {
      const show = matches(song, state);
      items[i].hidden = !show;
      if (show) shown++;
    });
    const query = new URLSearchParams();
    if (input.value.trim()) query.set('q', input.value.trim());
    if (state.theme) query.set('theme', state.theme);
    for (const tag of state.tags) query.append('tag', tag);
    if (sort !== 'artist') query.set('sort', sort);
    const search = query.toString();
    window.history.replaceState(null, '', `/songlist/${search ? `?${search}` : ''}`);
    // While someone types, screen readers hear the count once typing pauses, not on every key.
    // When the page opens, it's right straight away.
    clearTimeout(announce);
    const say = () => { status.textContent = describe(shown, state, themes); };
    if (event) announce = setTimeout(say, 400);
    else say();
  };

  form.addEventListener('input', update);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    update(event);
  });
  // The X empties the search box and puts the cursor back in it, and so does Escape.
  // The picked list and tags stay picked.
  const empty = () => {
    input.value = '';
    input.focus();
    update();
  };
  clear.addEventListener('click', empty);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && input.value) {
      event.preventDefault();
      empty();
    }
  });

  // Sorting (#22, ADR-006). Where the text of each thing in the header sits, to slide from.
  const places = () => new Map([...head.children].map((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return [element, { x: box.left + parseFloat(style.paddingLeft), y: box.top + parseFloat(style.paddingTop) }];
  }));

  // Each column name slides from where it was: along the line on wide screens,
  // and on a phone, where the names pile up like the songs, between the lines
  // too. On wide screens the songs on screen slide with their columns. On a
  // phone, where a song wraps as text, they fade in instead.
  const slide = (before) => {
    // Every position is read before any animation starts. Reading one between
    // animations would make the browser lay out all the songs again each time.
    const after = places();
    const inColumns = getComputedStyle(head).display === 'grid';
    const onScreen = [];
    for (const item of items) {
      if (item.hidden) continue;
      const box = item.getBoundingClientRect();
      if (box.bottom < 0) continue;
      if (box.top > window.innerHeight) break;
      onScreen.push(item);
    }
    const timing = { duration: 200, easing: 'ease-out' };
    const shift = (element, dx, dy) => {
      if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], timing);
    };
    for (const [element, was] of before) shift(element, was.x - after.get(element).x, was.y - after.get(element).y);
    for (const item of onScreen) {
      if (!inColumns) item.animate([{ opacity: 0 }, { opacity: 1 }], timing);
      else for (const [column, button] of buttons) shift(item.querySelector(`.song-${column}`), before.get(button).x - after.get(button).x, 0);
    }
  };

  // The picked column moves to the front of the header and of every row, and the list sorts by it.
  const sortBy = (column, animate) => {
    const before = animate ? places() : null;
    const focused = head.contains(document.activeElement) ? document.activeElement : null;
    sort = column;
    const columns = columnsFor(sort);
    for (const each of columns) head.append(buttons.get(each));
    buttons.get(sort).after(sep); // the dash stays between the first two names
    for (const [each, button] of buttons) button.setAttribute('aria-pressed', String(each === sort));
    table.dataset.sort = sort;
    rows = sortSongs(songs, sort);
    list.innerHTML = rows.map((song) => songItem(song, columns)).join('');
    items = [...list.children];
    focused?.focus({ preventScroll: true }); // moving a button drops its focus, so it goes back
    update();
    if (before) slide(before);
  };

  head.addEventListener('click', (event) => {
    const button = event.target.closest('.song-sort');
    if (!button || button.dataset.sort === sort) return;
    sortBy(button.dataset.sort, !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  });

  const wanted = params.get('sort');
  if (buttons.has(wanted) && wanted !== sort) sortBy(wanted, false);
  update();
}
