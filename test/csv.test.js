import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, isEmptyRecord } from '../scripts/lib/csv.js';

const fields = (text) => parseCsv(text).map((r) => r.fields);

describe('parseCsv', () => {
  it('reads records, with the line each one starts on', () => {
    assert.deepEqual(parseCsv('Artist,Title\nA,B\n'), [
      { line: 1, fields: ['Artist', 'Title'] },
      { line: 2, fields: ['A', 'B'] },
    ]);
  });

  it('reads quoted fields with commas, doubled quotes and line breaks', () => {
    assert.deepEqual(fields('"Adams, Ryan","Say ""Hi""","one\ntwo"\nnext,row,here\n'), [
      ['Adams, Ryan', 'Say "Hi"', 'one\ntwo'],
      ['next', 'row', 'here'],
    ]);
  });

  it('numbers records by the line they start on, past line breaks inside quotes', () => {
    assert.deepEqual(parseCsv('a,"x\ny"\nb,c\n').map((r) => r.line), [1, 3]);
  });

  it('reads CRLF line ends, and a CRLF inside quotes as one line break', () => {
    assert.deepEqual(fields('a,"x\r\ny"\r\nb,c\r\n'), [['a', 'x\ny'], ['b', 'c']]);
  });

  it('drops the byte-order mark that Excel adds', () => {
    assert.deepEqual(fields('\u{FEFF}Artist,Title\n'), [['Artist', 'Title']]);
  });

  it('keeps a quote in the middle of an unquoted field', () => {
    assert.deepEqual(fields('12" Single,B\n'), [['12" Single', 'B']]);
  });

  it('reads a last line with no line end, and empty last fields', () => {
    assert.deepEqual(fields('a,b\nc,'), [['a', 'b'], ['c', '']]);
    assert.deepEqual(fields('a,""'), [['a', '']]);
  });

  it('returns nothing for an empty file', () => {
    assert.deepEqual(parseCsv(''), []);
  });

  it('reports a quote that is never closed, on the line where it opens', () => {
    assert.throws(() => parseCsv('a,b\nc,"never\nclosed\n'), { name: 'CsvError', line: 2 });
  });

  it('reports text after a closing quote', () => {
    assert.throws(() => parseCsv('a,"b"c\n'), { name: 'CsvError', line: 1 });
  });
});

describe('isEmptyRecord', () => {
  it('is true for blank lines and rows of empty cells', () => {
    const [blank, commas, song] = parseCsv('\n , ,\na,b\n');
    assert.equal(isEmptyRecord(blank), true);
    assert.equal(isEmptyRecord(commas), true);
    assert.equal(isEmptyRecord(song), false);
  });
});
