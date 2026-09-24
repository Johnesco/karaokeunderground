import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fold, queryWords, listSongs, valuesOf, matches, describe as status, songlistView } from '../site/js/songlist-page.js';
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

  it('renders the page: intro, count, date, lists, tags and every song', () => {
    const doc = parseFrontMatter('---\ntitle: Songlist\n---\nMost of these are on [a playlist](https://e.com).\n');
    const view = songlistView(doc, songs, '2026-09-05');
    assert.equal(view.title, 'Songlist');
    assert.equal(view.wide, true);
    assert.match(view.html, /<p class="song-summary">3 songs. Updated <time datetime="2026-09-05">September 5, 2026<\/time>.<\/p>/);
    assert.match(view.html, /<span>All songs \(3\)<\/span>.*<span>Sad \(2\)<\/span>.*<span>Scary \(1\)<\/span>/s);
    assert.match(view.html, /<legend>Tags<\/legend>/);
    assert.equal(view.html.match(/<li>/g).length, 3);
    assert.match(view.html, /<span class="song-artist">Sample, Solo<\/span>.*<span class="song-title">Third Song<\/span> <span class="song-album"><span class="visually-hidden">from <\/span>Tape, Vol. 1<\/span>/);
  });

  it('puts the search box under the list and tag buttons, in the page order too', () => {
    const { html } = songlistView(parseFrontMatter('---\ntitle: Songlist\n---\n'), songs, null);
    const at = (s) => html.indexOf(s);
    assert.ok(at('<legend>List</legend>') < at('<legend>Tags</legend>'));
    assert.ok(at('<legend>Tags</legend>') < at('<input id="song-query"'));
    assert.ok(at('<input id="song-query"') < at('</form>'));
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

  it('shows no tag filter until a song has a tag', () => {
    const untagged = listSongs(csv(['A,B,C,sad,', 'D,E,F,,']));
    assert.doesNotMatch(songlistView(parseFrontMatter('---\ntitle: S\n---\n'), untagged, null).html, /Tags/);
  });
});

describe('the status line', () => {
  const themes = [{ key: 'sad', name: 'sad', count: 542 }];

  it('says what is showing, in plain words', () => {
    assert.equal(status(1853, {}, themes), 'Showing all 1,853 songs');
    assert.equal(status(542, { theme: 'sad' }, themes), 'Showing all 542 songs on the Sad list');
    assert.equal(status(1, { words: ['bjork'] }, themes), '1 song matches');
    assert.equal(status(12, { words: ['love'], theme: 'sad' }, themes), '12 songs match on the Sad list');
    assert.equal(status(0, { words: ['zzz'] }, themes), 'No songs match. Try fewer words, or check the spelling');
  });
});
