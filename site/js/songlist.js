/**
 * The songlist's columns and rules (ADR-002), shared by the check and the site.
 *
 * songlist.csv has five columns, found by name in any order:
 *
 *   Artist, Title, Album   as the songlist has always had them
 *   Themes                 the themed lists a song is on, like "sad; scary"
 *   Tags                   categories for browsing, like "duet; riot grrrl"
 *
 * Themes and Tags can be blank, and hold any number of values separated by
 * semicolons. Every song is on the main list. The theme "unlisted" takes a song
 * off every list, themed lists included, without deleting its row; remove
 * "unlisted" and the song is back on all its lists.
 *
 * It uses no Node APIs, so the site's browser code can share it with the check.
 */

import { parseCsv, isEmptyRecord } from './csv.js';

export const COLUMNS = ['Artist', 'Title', 'Album', 'Themes', 'Tags'];
export const UNLISTED = 'unlisted';

/** "sad; scary" -> ["sad", "scary"]. Blank values between semicolons are dropped. */
export function splitValues(cell) {
  return cell
    .split(';')
    .map((v) => v.trim())
    .filter((v) => v !== '');
}

/** The form two values or two songs are compared in: case, curly quotes and spacing don't count. */
export function sameKey(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u{2018}\u{2019}]/gu, "'")
    .replace(/[\u{201C}\u{201D}]/gu, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** False for a song with the theme "unlisted", in any capitalisation. */
export function isListed(song) {
  return !song.themes.some((t) => sameKey(t) === UNLISTED);
}

/**
 * Reads songlist.csv into songs. Problems that stop a row or the whole file
 * from being read come back in `errors`, with the line they're on, and those
 * rows are left out. Empty rows are skipped and counted.
 *
 * @param {string} text
 * @returns {{
 *   songs: { line: number, fields: string[], artist: string, title: string,
 *            album: string, themes: string[], tags: string[] }[],
 *   errors: { line: number, message: string }[],
 *   emptyRows: number[],
 *   columns: Record<string, number> | null,
 * }} columns gives each column's position in `fields`, or null when the header is wrong
 */
export function readSonglist(text) {
  const result = { songs: [], errors: [], emptyRows: [], columns: null };

  let records;
  try {
    records = parseCsv(text);
  } catch (e) {
    if (e.name !== 'CsvError') throw e;
    result.errors.push({ line: e.line, message: e.message });
    return result;
  }
  if (records.length === 0) {
    result.errors.push({ line: 1, message: 'the file is empty' });
    return result;
  }

  const [header, ...rows] = records;
  const index = columnIndex(header, result.errors);
  if (!index) return result;
  result.columns = index;

  for (const record of rows) {
    if (isEmptyRecord(record)) {
      result.emptyRows.push(record.line);
      continue;
    }
    if (record.fields.length !== header.fields.length) {
      result.errors.push({
        line: record.line,
        message: `this row has ${record.fields.length} cells, but the header has ${header.fields.length}. A comma or quote may be out of place`,
      });
      continue;
    }
    const cell = (name) => record.fields[index[name]].trim();
    result.songs.push({
      line: record.line,
      fields: record.fields,
      artist: cell('Artist'),
      title: cell('Title'),
      album: cell('Album'),
      themes: splitValues(cell('Themes')),
      tags: splitValues(cell('Tags')),
    });
  }
  return result;
}

/** Maps each column name to its position, or reports what's wrong with the header row. */
function columnIndex(header, errors) {
  const index = {};
  const unknown = [];
  header.fields.forEach((raw, i) => {
    const name = COLUMNS.find((c) => c.toLowerCase() === raw.trim().toLowerCase());
    if (!name) {
      unknown.push(raw.trim() === '' ? '(a column with no name)' : `"${raw.trim()}"`);
    } else if (name in index) {
      errors.push({ line: header.line, message: `the header has the ${name} column twice` });
    } else {
      index[name] = i;
    }
  });

  const missing = COLUMNS.filter((c) => !(c in index));
  if (missing.length) {
    errors.push({
      line: header.line,
      message: `the header is missing ${list(missing)}. The first row has to name all five columns: ${COLUMNS.join(',')}`,
    });
  }
  if (unknown.length) {
    errors.push({
      line: header.line,
      message: `the site doesn't use the column${unknown.length > 1 ? 's' : ''} ${list(unknown)}. Remove ${unknown.length > 1 ? 'them' : 'it'}: everything in songlist.csv is public once the site is deployed`,
    });
  }
  return missing.length || unknown.length || errors.length ? null : index;
}

function list(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
