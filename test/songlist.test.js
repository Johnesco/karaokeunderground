import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readSonglist, splitValues, sameKey, isListed } from '../scripts/lib/songlist.js';

describe('splitValues', () => {
  it('splits on semicolons, trims, and drops blanks', () => {
    assert.deepEqual(splitValues(' sad ;scary;; '), ['sad', 'scary']);
    assert.deepEqual(splitValues(''), []);
  });
});

describe('sameKey', () => {
  it("ignores case, curly quotes and spacing, so near-copies compare equal", () => {
    assert.equal(sameKey('Don\u{2019}t  Stop'), sameKey("don't stop"));
    assert.notEqual(sameKey('Bjork'), sameKey('Bj\u{F6}rk'));
  });
});

describe('isListed', () => {
  it('is false for a song with the theme "unlisted", in any capitalisation', () => {
    assert.equal(isListed({ themes: ['sad'] }), true);
    assert.equal(isListed({ themes: ['sad', 'Unlisted'] }), false);
  });
});

describe('readSonglist', () => {
  it('finds the columns by name, in any order', () => {
    const { songs, errors, columns } = readSonglist('Tags,Themes,Album,Title,Artist\nduet,sad; scary,LP,Song,Band\n');
    assert.deepEqual(errors, []);
    assert.equal(columns.Artist, 4);
    assert.deepEqual(
      { artist: songs[0].artist, title: songs[0].title, album: songs[0].album, themes: songs[0].themes, tags: songs[0].tags },
      { artist: 'Band', title: 'Song', album: 'LP', themes: ['sad', 'scary'], tags: ['duet'] },
    );
  });

  it('reports missing columns and columns the site does not use', () => {
    const { songs, errors } = readSonglist('Artist,Title,Album,Notes\nA,B,C,private\n');
    assert.equal(songs.length, 0);
    assert.equal(errors.length, 2);
    assert.match(errors[0].message, /missing Themes and Tags/);
    assert.match(errors[1].message, /"Notes".*public/);
  });

  it('reports a column named twice', () => {
    const { errors } = readSonglist('Artist,Title,Album,Themes,Tags,title\n');
    assert.match(errors[0].message, /Title column twice/);
  });

  it('reports a row with the wrong number of cells, and keeps reading', () => {
    const { songs, errors } = readSonglist('Artist,Title,Album,Themes,Tags\nA,B,C\nD,E,F,,\n');
    assert.deepEqual(errors.map((e) => e.line), [2]);
    assert.deepEqual(songs.map((s) => s.artist), ['D']);
  });

  it('skips empty rows and says where they were', () => {
    const { songs, emptyRows } = readSonglist('Artist,Title,Album,Themes,Tags\nA,B,C,,\n,,,,\n\n');
    assert.equal(songs.length, 1);
    assert.deepEqual(emptyRows, [3, 4]);
  });

  it('reports a CSV problem with its line', () => {
    const { errors } = readSonglist('Artist,Title,Album,Themes,Tags\n"A,B,C,,\n');
    assert.deepEqual(errors.map((e) => e.line), [2]);
  });
});
