/**
 * Front matter for pages and posts (ADR-002): `key: value` lines between two
 * lines of three dashes at the top of a Markdown file.
 *
 *     ---
 *     title: "KU in June: four shows"
 *     date: 2015-05-31
 *     ---
 *
 * It's the plain subset of YAML that GitHub shows as a table above the file, so
 * a value with ": " or " #" in it, or one that starts with a quote or a symbol,
 * goes in double quotes. Every value is read as a string.
 *
 * It uses no Node APIs, so the site's browser code can share it with the check.
 */

export class FrontMatterError extends Error {
  constructor(message, line) {
    super(message);
    this.name = 'FrontMatterError';
    this.line = line;
  }
}

const DELIMITER = /^---[ \t]*$/;
const KEY_LINE = /^([a-z][a-z0-9_]*):(?:[ \t]+(.*?))?[ \t]*$/;
// Characters YAML reads as something other than text at the start of a plain value.
const INDICATOR_START = /^[\[\]{}&*!|>%@`#,?:'"-]/;

/**
 * @param {string} text the whole Markdown file
 * @returns {{ data: Record<string, string>, body: string, bodyLine: number }}
 *   bodyLine is the file's line number where the body starts
 */
export function parseFrontMatter(text) {
  if (text.startsWith('\u{FEFF}')) text = text.slice(1);
  const lines = text.split(/\r\n|\r|\n/);

  if (!DELIMITER.test(lines[0])) {
    throw new FrontMatterError(
      'the file has to start with front matter: a line of three dashes (---), then lines like "title: ...", then another line of three dashes',
      1,
    );
  }

  const data = {};
  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i];
    if (DELIMITER.test(line)) {
      return { data, body: lines.slice(i + 1).join('\n'), bodyLine: lineNo + 1 };
    }
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const m = KEY_LINE.exec(line);
    if (!m) {
      throw new FrontMatterError(
        `"${line.trim()}" isn't a front matter line. Each one is a lowercase name, a colon, a space and a value, like "title: About"`,
        lineNo,
      );
    }
    const [, key, raw = ''] = m;
    if (Object.hasOwn(data, key)) {
      throw new FrontMatterError(`"${key}" appears twice`, lineNo);
    }
    data[key] = parseValue(raw, key, lineNo);
  }

  throw new FrontMatterError(
    'the front matter never ends. Add a line of three dashes (---) after it',
    1,
  );
}

function parseValue(raw, key, lineNo) {
  if (raw === '') return '';
  if (raw.startsWith('"')) return parseDoubleQuoted(raw, key, lineNo);
  if (raw.startsWith("'")) return parseSingleQuoted(raw, key, lineNo);
  if (INDICATOR_START.test(raw) || raw.includes(': ') || raw.includes(' #')) {
    throw new FrontMatterError(
      `the value of "${key}" needs double quotes around it, like ${key}: "${raw.replace(/"/g, '\\"')}"`,
      lineNo,
    );
  }
  return raw;
}

function parseDoubleQuoted(raw, key, lineNo) {
  let value = '';
  for (let i = 1; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\\') {
      const next = raw[i + 1];
      if (next === '"' || next === '\\') {
        value += next;
        i++;
        continue;
      }
      throw new FrontMatterError(
        `the value of "${key}" has a backslash. Inside double quotes, write \\" for a quote and \\\\ for a backslash`,
        lineNo,
      );
    }
    if (c === '"') {
      if (raw.slice(i + 1).trim() !== '') {
        throw new FrontMatterError(`the value of "${key}" has text after its closing quote`, lineNo);
      }
      return value;
    }
    value += c;
  }
  throw new FrontMatterError(`the value of "${key}" opens a quote and never closes it`, lineNo);
}

function parseSingleQuoted(raw, key, lineNo) {
  let value = '';
  for (let i = 1; i < raw.length; i++) {
    const c = raw[i];
    if (c === "'") {
      if (raw[i + 1] === "'") {
        value += "'";
        i++;
        continue;
      }
      if (raw.slice(i + 1).trim() !== '') {
        throw new FrontMatterError(`the value of "${key}" has text after its closing quote`, lineNo);
      }
      return value;
    }
    value += c;
  }
  throw new FrontMatterError(`the value of "${key}" opens a quote and never closes it`, lineNo);
}
