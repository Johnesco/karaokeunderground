import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fold, queryWords, listSongs, valuesOf, matches, describe as status, songlistView, columnsFor, sortSongs, songItem } from '../site/js/songlist-page.js';
import { parseFrontMatter } from '../site/js/front-matter.js';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'content');
const example = fs.readFileSync(path.join(FIXTURE, 'songlist.csv'), 'utf8');
const csv = (rows) => `Artist,Title,Album,Themes,Tags\n${rows.join('\n')}\n`;
const find = (songs, query, filters = {}) => songs.filter((s) => matches(s, { words: queryWords(query), ...filters })).map((s) => s.title);

describe('fold', () => {
  it('drops case, accents, apostrophes and punctuation, and reads & as "and"', () => {
    assert.equal(fold('Bj\u{F6}rk'), 'bjork');
    assert.equal(fold('H\u{FC}sker D\u{FC}'), 'husker du');
    assert.equal(fold('Sundf\u{F8}r, Susanne'), 'sundfor susanne');
    assert.equal(fold("Guns N' Roses"), 'guns n roses');
    assert.equal(fold('Don\u{2019}t Stop'), 'dont stop');
    assert.equal(fold('Belle & Sebastian'), 'belle and sebastian');
    assert.equal(fold('Sleater-Kinney'), 'sleater kinney');
  });
});

describe('search', () => {
  const songs = listSongs(csv([
    '"Adams, Ryan",Come Pick Me Up,Heartbreaker,sad,',
    'Bj\u{F6}rk,Human Behavior,Debut,sad,',
    '"Zombies, The",I Got My Mojo Working (by Muddy Waters),The Zombies,,',
    'Belle & Sebastian,Get Me Away From Here I\u{2019}m Dying,If You\u{2019}re Feeling Sinister,sad,duet',
  ]));

  it('finds "Last, First" names in either order', () => {
    assert.deepEqual(find(songs, 'ryan adams'), ['Come Pick Me Up']);
    assert.deepEqual(find(songs, 'the zombies'), ['I Got My Mojo Working (by Muddy Waters)']);
  });

  it('finds names without their accents, and titles by any of their words', () => {
    assert.deepEqual(find(songs, 'bjork'), ['Human Behavior']);
    assert.deepEqual(find(songs, 'im dying'), ['Get Me Away From Here I\u{2019}m Dying']);
    assert.deepEqual(find(songs, 'belle and'), ['Get Me Away From Here I\u{2019}m Dying']);
  });

  it('searches the album and the covered artist too, and needs every word', () => {
    assert.deepEqual(find(songs, 'muddy'), ['I Got My Mojo Working (by Muddy Waters)']);
    assert.deepEqual(find(songs, 'debut'), ['Human Behavior']);
    assert.deepEqual(find(songs, 'bjork zombies'), []);
  });

  it('filters by themed list and by tag', () => {
    assert.deepEqual(find(songs, '', { theme: 'sad' }).length, 3);
    assert.deepEqual(find(songs, 'bjork', { theme: 'sad' }), ['Human Behavior']);
    assert.deepEqual(find(songs, '', { tags: ['duet'] }), ['Get Me Away From Here I\u{2019}m Dying']);
    assert.deepEqual(find(songs, '', { theme: 'sad', tags: ['duet', 'riot grrrl'] }), []);
  });
});

describe('the example songlist', () => {
  const songs = listSongs(example);

  it('leaves unlisted songs off every list and out of every count', () => {
    assert.deepEqual(songs.map((s) => s.title), ['First Song', 'Second Song (by Other Band)', 'Third Song']);
    assert.deepEqual(valuesOf(songs, 'themes'), [{ key: 'sad', name: 'sad', count: 2 }, { key: 'scary', name: 'scary', count: 1 }]);
    assert.deepEqual(valuesOf(songs, 'tags'), [{ key: 'duet', name: 'duet', count: 1 }]);
  });

  it('renders the page: lists, tags, count, every song, the date, then the page\u{2019}s text', () => {
    const doc = parseFrontMatter('---\ntitle: Songlist\n---\nMost of these are on [a playlist](https://e.com).\n');
    const view = songlistView(doc, songs, '2026-09-05');
    assert.equal(view.title, 'Songlist');
    assert.equal(view.wide, true);
    assert.match(view.html, /<legend>Lists<\/legend>\n.*<span>All songs \(3\)<\/span>.*<span>Sad \(2\)<\/span>.*<span>Scary \(1\)<\/span>/s, 'every list shows its size');
    assert.match(view.html, /<p class="song-count" role="status">3 songs<\/p>/);
    assert.match(view.html, /<\/ul>\n<\/div>\n<p class="song-summary">Updated <time datetime="2026-09-05">September 5, 2026<\/time><\/p>\n<p>Most of these are on/, 'the date sits at the foot of the songs, before the page\u{2019}s text');
    assert.match(view.html, /<legend>Tags<\/legend>/);
    assert.equal(view.html.match(/<li>/g).length, 3);
    assert.match(view.html, /<li><span class="song-artist song-first">Sample, Solo<\/span><span class="song-sep" aria-hidden="true"> \u{2013} <\/span><span class="song-title song-second"><span class="visually-hidden">, <\/span>Third Song<\/span> <span class="song-album song-third"><span class="visually-hidden">, from <\/span>Tape, Vol. 1<\/span><\/li>/u);
  });

  it('heads the songs with the sort buttons, named "Sort by", sorted by artist to start, with the songs\u{2019} dash after the first', () => {
    const { html } = songlistView(parseFrontMatter('---\ntitle: Songlist\n---\n'), songs, null);
    assert.match(html, /<div class="song-table" data-sort="artist">\n<fieldset class="song-sort-set"><legend>Sort by<\/legend>\n<div class="songs-head">\n<button class="song-sort" type="button" data-sort="artist" aria-pressed="true">Artist<\/button>\n<span class="song-sep" aria-hidden="true"> \u{2013} <\/span>\n<button class="song-sort" type="button" data-sort="title" aria-pressed="false">Title<\/button>\n<button class="song-sort" type="button" data-sort="album" aria-pressed="false">Album<\/button>\n<\/div>\n<\/fieldset>\n<ul class="songs"/u);
    assert.ok(html.indexOf('class="songs-head"') < html.indexOf('<ul class="songs"'), 'the buttons come before the songs');
  });

  it('puts the search box under the list and tag buttons, in the page order too', () => {
    const { html } = songlistView(parseFrontMatter('---\ntitle: Songlist\n---\n'), songs, null);
    const at = (s) => html.indexOf(s);
    assert.ok(at('<legend>Lists</legend>') < at('<legend>Tags</legend>'));
    assert.ok(at('<legend>Tags</legend>') < at('<input id="song-query"'));
    assert.ok(at('<input id="song-query"') < at('</form>'));
  });

  it('labels the search box "Search", beside it, and screen readers hear "Search the songlist"', () => {
    const { html } = songlistView(parseFrontMatter('---\ntitle: Songlist\n---\n'), songs, null);
    assert.match(html, /<div class="song-query-row">\n<label class="song-query-label" for="song-query">Search<span class="visually-hidden"> the songlist<\/span><\/label>\n<div class="song-query">\n<input id="song-query"/);
  });

  it('puts a named clear button in the search box, hidden until there is text', () => {
    const { html } = songlistView(parseFrontMatter('---\ntitle: Songlist\n---\n'), songs, null);
    const button = html.match(/<button class="song-clear"[^>]*>.*?<\/button>/s)?.[0];
    assert.ok(button, 'the search box has a clear button');
    assert.match(button, / type="button"/, 'it never sends the form');
    assert.match(button, / hidden>/, 'it shows once there is text to clear');
    assert.match(button, /<span class="visually-hidden">Clear the search<\/span>/);
    assert.match(button, /<svg[^>]* aria-hidden="true"/, 'screen readers hear its name, not the drawing');
    assert.ok(html.indexOf('<input id="song-query"') < html.indexOf('<button class="song-clear"'), 'Tab reaches it after the box');
  });

  it('leaves the date line out when the list has no date', () => {
    assert.doesNotMatch(songlistView(parseFrontMatter('---\ntitle: S\n---\n'), songs, null).html, /song-summary/);
  });

  it('shows no tag filter until a song has a tag', () => {
    const untagged = listSongs(csv(['A,B,C,sad,', 'D,E,F,,']));
    assert.doesNotMatch(songlistView(parseFrontMatter('---\ntitle: S\n---\n'), untagged, null).html, /Tags/);
  });
});

describe('sorting', () => {
  const songs = listSongs(csv([
    '"Zombies, The",(I Got A) Mojo,Begin Here,,',
    '\u{C9}lan Vital,Waiting For The Sun,Solar,,',
    'Bj\u{F6}rk,Human Behavior,Debut,sad,',
    'Cover Band,Human Behavior,,,',
    'bjork tribute,The Book Of Love,Army,,',
    '"Adams, Ryan",Come Pick Me Up,Heartbreaker,sad,',
  ]));
  const order = (sort) => sortSongs(songs, sort).map((s) => `${s.artist} / ${s.title}`);

  it('puts the picked column first, and keeps the other two in their usual order', () => {
    assert.deepEqual(columnsFor('artist'), ['artist', 'title', 'album']);
    assert.deepEqual(columnsFor('title'), ['title', 'artist', 'album']);
    assert.deepEqual(columnsFor('album'), ['album', 'artist', 'title']);
  });

  it('sorts A to Z, ignoring case, accents and punctuation but not words', () => {
    assert.deepEqual(order('artist'), [
      'Adams, Ryan / Come Pick Me Up',
      'Bj\u{F6}rk / Human Behavior',
      'bjork tribute / The Book Of Love', // before Cover Band: case doesn't count
      'Cover Band / Human Behavior',
      '\u{C9}lan Vital / Waiting For The Sun', // under E, not after Z: accents don't count
      'Zombies, The / (I Got A) Mojo', // under Z: words count
    ]);
    assert.deepEqual(order('title'), [
      'Adams, Ryan / Come Pick Me Up',
      'Bj\u{F6}rk / Human Behavior', // a tie goes by the next column shown, the artist
      'Cover Band / Human Behavior',
      'Zombies, The / (I Got A) Mojo', // under I: the brackets don't count
      'bjork tribute / The Book Of Love', // under T: "The" counts
      '\u{C9}lan Vital / Waiting For The Sun',
    ]);
  });

  it('puts songs with no album last when sorting by album', () => {
    assert.deepEqual(order('album').slice(-2), ['\u{C9}lan Vital / Waiting For The Sun', 'Cover Band / Human Behavior']);
  });

  it('shows each song in the columns\u{2019} order, and reads it that way too', () => {
    const song = songs.find((s) => s.title === 'Come Pick Me Up');
    const seen = (html) => html.replace(/<span class="visually-hidden">.*?<\/span>/g, '').replace(/<[^>]+>/g, '').trim();
    const heard = (html) => html.replace(/<span[^>]*aria-hidden="true">.*?<\/span>/g, '').replace(/<[^>]+>/g, '').replace(/\s+,/g, ',').trim();
    assert.equal(seen(songItem(song, columnsFor('artist'))), 'Adams, Ryan \u{2013} Come Pick Me Up Heartbreaker');
    assert.equal(heard(songItem(song, columnsFor('artist'))), 'Adams, Ryan, Come Pick Me Up, from Heartbreaker');
    assert.equal(heard(songItem(song, columnsFor('title'))), 'Come Pick Me Up, by Adams, Ryan, from Heartbreaker');
    assert.equal(heard(songItem(song, columnsFor('album'))), 'Heartbreaker, by Adams, Ryan, Come Pick Me Up');
    assert.match(songItem(song, columnsFor('title')), /^<li><span class="song-title song-first">Come Pick Me Up<\/span>/);
  });

  it('keeps a cell for a blank column, so wide screens keep each column in its place', () => {
    const song = songs.find((s) => s.artist === 'Cover Band');
    const html = songItem(song, columnsFor('album'));
    assert.match(html, /^<li><span class="song-album song-first"><\/span><span class="song-artist song-second">Cover Band<\/span>/, 'no dash, and nothing read before the artist');
    assert.equal(html.match(/class="song-/g).length, 3);
  });
});

describe('the status line', () => {
  const themes = [{ key: 'sad', name: 'sad', count: 542 }];

  it('says what is showing, in plain words', () => {
    assert.equal(status(1853, {}, themes), '1,853 songs');
    assert.equal(status(1, {}, themes), '1 song');
    assert.equal(status(542, { theme: 'sad' }, themes), '542 songs on the Sad list');
    assert.equal(status(1, { words: ['bjork'] }, themes), '1 song matches');
    assert.equal(status(12, { words: ['love'], theme: 'sad' }, themes), '12 songs match on the Sad list');
    assert.equal(status(0, { words: ['zzz'] }, themes), 'No songs match. Try fewer words, or check the spelling');
  });

  it('says how the list is sorted, unless it is by artist', () => {
    assert.equal(status(1853, { sort: 'artist' }, themes), '1,853 songs');
    assert.equal(status(1853, { sort: 'title' }, themes), '1,853 songs, sorted by title');
    assert.equal(status(12, { words: ['love'], theme: 'sad', sort: 'album' }, themes), '12 songs match on the Sad list, sorted by album');
    assert.equal(status(0, { words: ['zzz'], sort: 'title' }, themes), 'No songs match. Try fewer words, or check the spelling');
  });
});
