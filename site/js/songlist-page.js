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

/** The songs the page lists: all but the unlisted ones, each with the text search looks through. */
export function listSongs(csvText) {
  return readSonglist(csvText).songs.filter(isListed).map((song) => ({
    ...song,
    key: fold(`${song.artist} ${song.title} ${song.album}`),
  }));
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

/** What the status line says about what's showing. */
export function describe(shown, { words = [], theme = '', tags = [] }, themes) {
  const list = theme ? ` on the ${label(themes.find((t) => t.key === theme)?.name ?? theme)} list` : '';
  if (!words.length && !tags.length) return `Showing all ${count(shown)} song${shown === 1 ? '' : 's'}${list}`;
  if (shown === 0) return `No songs match${list}. Try fewer words, or check the spelling`;
  return `${count(shown)} song${shown === 1 ? ' matches' : 's match'}${list}`;
}

function choice(type, name, value, text, checked) {
  return `<label class="choice"><input type="${type}" name="${name}" value="${escapeHtml(value)}"${checked ? ' checked' : ''}> <span>${escapeHtml(text)}</span></label>\n`;
}

function songItem(song) {
  const album = song.album ? ` <span class="song-album"><span class="visually-hidden">from </span>${escapeHtml(song.album)}</span>` : '';
  return `<li><span class="song-artist">${escapeHtml(song.artist)}</span><span class="song-sep" aria-hidden="true"> \u{2013} </span>`
    + `<span class="visually-hidden">, </span><span class="song-title">${escapeHtml(song.title)}</span>${album}</li>\n`;
}

/**
 * The page: its title and intro from pages/songlist.md, the song count and the
 * date the list last changed, the search and filters, and every song.
 */
export function songlistView(doc, songs, updated) {
  const themes = valuesOf(songs, 'themes');
  const tags = valuesOf(songs, 'tags');
  const when = updated ? ` Updated <time datetime="${escapeHtml(updated)}">${formatDate(updated)}</time>.` : '';
  const html = `<h1>${escapeHtml(doc.data.title)}</h1>\n${markdownHtml(doc.body, 'pages')}`
    + `<p class="song-summary">${count(songs.length)} songs.${when}</p>\n`
    + '<form class="song-search" role="search" action="/songlist/">\n'
    + '<label class="song-query-label" for="song-query">Search the songlist</label>\n'
    + '<input id="song-query" name="q" type="search" autocomplete="off" spellcheck="false" placeholder="Artist, title or album">\n'
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
    + '</form>\n'
    + `<p class="song-count" role="status">${describe(songs.length, {}, themes)}</p>\n`
    + '<div class="songs-head" aria-hidden="true"><span>Artist</span><span>Title</span><span>Album</span></div>\n'
    + `<ul class="songs" aria-label="Songs">\n${songs.map(songItem).join('')}</ul>\n`;
  return { title: doc.data.title, html, wide: true, enhance: (main) => enhanceSonglist(main, songs, themes) };
}

/**
 * Makes the page's search and filters work: rows show and hide as you type,
 * and the address keeps the search, so /songlist/?theme=sad can be shared.
 */
export function enhanceSonglist(main, songs, themes) {
  const form = main.querySelector('.song-search');
  const input = form.querySelector('#song-query');
  const status = main.querySelector('.song-count');
  const items = [...main.querySelectorAll('.songs > li')];

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
    };
    let shown = 0;
    songs.forEach((song, i) => {
      const show = matches(song, state);
      items[i].hidden = !show;
      if (show) shown++;
    });
    const query = new URLSearchParams();
    if (input.value.trim()) query.set('q', input.value.trim());
    if (state.theme) query.set('theme', state.theme);
    for (const tag of state.tags) query.append('tag', tag);
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
  update();
}
