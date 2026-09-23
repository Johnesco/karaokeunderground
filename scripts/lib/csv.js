/**
 * The CSV parser for the core files (ADR-002).
 *
 * RFC 4180, as spreadsheet apps write it: commas between fields, and a field in
 * double quotes can hold commas, line breaks and doubled quotes (""). Lines end
 * in LF or CRLF. A byte-order mark at the start is dropped, because Excel's
 * "CSV UTF-8" export adds one.
 *
 * It uses no Node APIs, so the site's browser code can share it with the check
 * and the two can never disagree about a file.
 */

export class CsvError extends Error {
  constructor(message, line) {
    super(message);
    this.name = 'CsvError';
    this.line = line;
  }
}

/**
 * Parses CSV text into records. Throws a CsvError, with the line it's on, when
 * a quote is left open or a quoted field has text after its closing quote.
 *
 * @param {string} text
 * @returns {{ line: number, fields: string[] }[]} one entry per record, with the
 *   line the record starts on (the header is line 1)
 */
export function parseCsv(text) {
  if (text.startsWith('\u{FEFF}')) text = text.slice(1);

  const records = [];
  let fields = [];
  let field = '';
  let line = 1; // the line being read
  let recordLine = 1; // the line the current record started on
  let quoteLine = 0; // the line the open quote started on
  let inQuotes = false;
  let fieldStart = true; // a quote here opens a quoted field
  let afterQuote = false; // a quoted field just closed: only a comma or a line end may follow
  let pending = false; // the current record has something in it

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else if (c === '\r' || c === '\n') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        field += '\n';
        line++;
      } else {
        field += c;
      }
      continue;
    }

    if (c === ',') {
      fields.push(field);
      field = '';
      fieldStart = true;
      afterQuote = false;
      pending = true;
      continue;
    }

    if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (pending || field !== '' || afterQuote) {
        fields.push(field);
        records.push({ line: recordLine, fields });
      } else {
        // A blank line is a record with one empty field, as RFC 4180 reads it.
        records.push({ line: recordLine, fields: [''] });
      }
      fields = [];
      field = '';
      fieldStart = true;
      afterQuote = false;
      pending = false;
      line++;
      recordLine = line;
      continue;
    }

    if (afterQuote) {
      throw new CsvError(
        'there is text after a closing quote. A quoted field has to end at a comma or at the end of the line',
        line,
      );
    }

    if (c === '"' && fieldStart) {
      inQuotes = true;
      quoteLine = line;
      fieldStart = false;
      pending = true;
      continue;
    }

    // A quote in the middle of an unquoted field is kept as it is, as spreadsheet apps read it.
    field += c;
    fieldStart = false;
    pending = true;
  }

  if (inQuotes) {
    throw new CsvError('a quote is opened here and never closed', quoteLine);
  }
  if (pending || field !== '' || afterQuote) {
    fields.push(field);
    records.push({ line: recordLine, fields });
  }
  return records;
}

/** True for a record with nothing in any field, like the ",,,," rows some exports end with. */
export function isEmptyRecord(record) {
  return record.fields.every((f) => f.trim() === '');
}
