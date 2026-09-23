/**
 * Our Markdown renderer (ADR-004), for the Markdown that ADR-002 allows.
 *
 *   blocks   paragraphs, ATX and setext headings, block quotes, bullet and
 *            ordered lists, fenced and indented code, thematic breaks
 *   inline   backslash escapes, code spans, *emphasis*, **strong**,
 *            ~~strikethrough~~, [links](url), ![images](url), <autolinks>,
 *            entities, and hard breaks: a backslash, or two spaces, at the
 *            end of a line
 *
 * It follows CommonMark for all of these, including its rules for which
 * asterisks open and close emphasis. Everything else is escaped: raw HTML comes
 * out as text, and a link or image with an unsafe address (like javascript:)
 * comes out without one. Tables and reference-style links aren't supported, and
 * the content check rejects them.
 *
 * It uses no browser or Node APIs, so the site and the tests share it.
 */

/**
 * @param {string} markdown
 * @param {{ headingOffset?: number, link?: (href: string) => string, image?: (src: string) => string }} [options]
 *   headingOffset moves headings down, so a page's own # can sit under its title.
 *   link and image map each address, for example a .md file to the page's path.
 * @returns {string} HTML
 */
export function renderMarkdown(markdown, options = {}) {
  const opts = { headingOffset: 0, link: (href) => href, image: (src) => src, ...options };
  const lines = markdown.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  return renderBlocks(parseBlocks(lines), opts, false);
}

// ---- blocks ----

const BLANK = /^[ \t]*$/;
const ATX = /^ {0,3}(#{1,6})(?=[ \t]|$)(.*)$/;
const THEMATIC = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const QUOTE = /^ {0,3}>/;
const LIST_ITEM = /^( {0,3})(?:([-+*])|(\d{1,9})([.)]))(?:([ \t]+)(.*))?$/;

function parseBlocks(lines) {
  const blocks = [];
  let blankBefore = false;
  const push = (block) => {
    block.blankBefore = blankBefore && blocks.length > 0;
    blocks.push(block);
    blankBefore = false;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (BLANK.test(line)) {
      blankBefore = true;
      i++;
      continue;
    }

    const fence = openFence(line);
    if (fence) {
      const body = [];
      for (i++; i < lines.length && !closesFence(lines[i], fence); i++) {
        body.push(lines[i].replace(new RegExp(`^ {0,${fence.indent}}`), ''));
      }
      i++;
      push({ type: 'code', text: body.join('\n') });
      continue;
    }

    const atx = ATX.exec(line);
    if (atx) {
      push({ type: 'heading', level: atx[1].length, text: atx[2].replace(/(?:^|[ \t]+)#+[ \t]*$/, '').trim() });
      i++;
      continue;
    }

    if (THEMATIC.test(line)) {
      push({ type: 'hr' });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const inner = [];
      while (i < lines.length) {
        const l = lines[i];
        if (QUOTE.test(l)) {
          inner.push(l.replace(/^ {0,3}> ?/, ''));
        } else if (!BLANK.test(l) && !interruptsParagraph(l) && !listItem(l) && endsInParagraph(inner)) {
          inner.push(lazy(l)); // the quote's paragraph goes on without a >
        } else {
          break;
        }
        i++;
      }
      push({ type: 'quote', children: parseBlocks(inner) });
      continue;
    }

    if (listItem(line)) {
      const [list, next] = parseList(lines, i);
      push(list);
      i = next;
      continue;
    }

    if (/^ {4}/.test(line)) {
      const body = [];
      for (; i < lines.length && (/^ {4}/.test(lines[i]) || BLANK.test(lines[i])); i++) body.push(lines[i].slice(4));
      while (body.length && BLANK.test(body.at(-1))) body.pop();
      push({ type: 'code', text: body.join('\n') });
      continue;
    }

    const para = [line.replace(/^ +/, '')];
    let setext = 0;
    for (i++; i < lines.length; i++) {
      const l = lines[i];
      if (BLANK.test(l)) break;
      const underline = SETEXT.exec(l);
      if (underline) {
        setext = underline[1][0] === '=' ? 1 : 2;
        i++;
        break;
      }
      if (interruptsParagraph(l)) break;
      para.push(l); // the inline parser drops the leading spaces after a line break, except in code
    }
    const text = para.join('\n').replace(/[ \t]+$/, '');
    push(setext ? { type: 'heading', level: setext, text } : { type: 'paragraph', text });
  }
  return blocks;
}

function openFence(line) {
  const m = FENCE.exec(line);
  if (!m || (m[2][0] === '`' && m[3].includes('`'))) return null;
  return { indent: m[1].length, char: m[2][0], length: m[2].length };
}

function closesFence(line, fence) {
  const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
  return !!m && m[1][0] === fence.char && m[1].length >= fence.length;
}

/** A list item's marker and first line, or null. */
function listItem(line) {
  if (THEMATIC.test(line)) return null;
  const m = LIST_ITEM.exec(line);
  if (!m) return null;
  const marker = m[2] ?? m[3] + m[4];
  const spaces = m[5]?.length ?? 0;
  const rest = m[6] ?? '';
  const empty = rest.trim() === '';
  const gap = empty || spaces > 4 ? 1 : spaces; // 5+ spaces: the content is indented code
  return {
    bullet: m[2] ?? null,
    number: m[3] ?? null,
    delim: m[4] ?? null,
    contentIndent: m[1].length + marker.length + gap,
    rest: empty ? '' : spaces > 4 ? ' '.repeat(spaces - 1) + rest : rest,
  };
}

function sameList(a, b) {
  return a.bullet ? b.bullet === a.bullet : b.number !== null && b.delim === a.delim;
}

function interruptsParagraph(line) {
  if (ATX.test(line) || THEMATIC.test(line) || openFence(line) || QUOTE.test(line)) return true;
  const item = listItem(line);
  return !!item && item.rest.trim() !== '' && (item.bullet !== null || Number(item.number) === 1);
}

/**
 * Whether the lines so far end in an open paragraph, the only block a lazy line
 * (one missing its > or its list indent) can continue.
 */
function endsInParagraph(lines) {
  if (!lines.length || BLANK.test(lines.at(-1))) return false;
  let blocks = parseBlocks(lines);
  for (;;) {
    const last = blocks.at(-1);
    if (last?.type === 'paragraph') return true;
    if (last?.type === 'quote') blocks = last.children;
    else if (last?.type === 'list') blocks = last.items.at(-1);
    else return false;
  }
}

/** A lazy line is paragraph text, so a === on one can't underline a heading. */
function lazy(line) {
  return SETEXT.test(line) ? line.replace(/^( *)/, '$1\\') : line;
}

function parseList(lines, start) {
  const first = listItem(lines[start]);
  const list = { type: 'list', ordered: first.number !== null, start: Number(first.number ?? 1), tight: true, items: [] };
  let i = start;
  while (i < lines.length) {
    const item = listItem(lines[i]);
    if (!item || !sameList(first, item)) break;
    const body = [item.rest];
    let blanks = 0;
    for (i++; i < lines.length; i++) {
      const l = lines[i];
      if (BLANK.test(l) && body.length === 1 && body[0] === '') {
        // An item can start with at most one blank line, so an empty item ends here.
        for (; i < lines.length && BLANK.test(lines[i]); i++) body.push('');
        break;
      } else if (BLANK.test(l)) {
        body.push('');
        blanks++;
      } else if (l.length - l.trimStart().length >= item.contentIndent) {
        body.push(l.slice(item.contentIndent));
        blanks = 0;
      } else if (!blanks && !listItem(l) && !interruptsParagraph(l) && endsInParagraph(body)) {
        body.push(lazy(l));
      } else {
        break;
      }
    }
    let trailing = 0;
    while (body.length > 1 && BLANK.test(body.at(-1))) {
      body.pop();
      trailing++;
    }
    const children = parseBlocks(body);
    if (children.some((child, k) => k > 0 && child.blankBefore)) list.tight = false;
    list.items.push(children);
    const next = i < lines.length ? listItem(lines[i]) : null;
    if (!next || !sameList(first, next)) {
      i -= trailing; // the list ends: its blank lines belong to whatever comes next
      break;
    }
    if (trailing) list.tight = false;
  }
  return [list, i];
}

function renderBlocks(blocks, opts, tight) {
  return blocks.map((block) => renderBlock(block, opts, tight)).join('');
}

function renderBlock(block, opts, tight) {
  switch (block.type) {
    case 'paragraph':
      return tight ? renderInline(block.text, opts) : `<p>${renderInline(block.text, opts)}</p>\n`;
    case 'heading': {
      const level = Math.min(6, block.level + opts.headingOffset);
      return `<h${level}>${renderInline(block.text, opts)}</h${level}>\n`;
    }
    case 'hr':
      return '<hr>\n';
    case 'code':
      return `<pre><code>${escapeHtml(block.text)}${block.text ? '\n' : ''}</code></pre>\n`;
    case 'quote':
      return `<blockquote>\n${renderBlocks(block.children, opts, false)}</blockquote>\n`;
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      const start = block.ordered && block.start !== 1 ? ` start="${block.start}"` : '';
      const items = block.items.map((children) => `<li>${renderBlocks(children, opts, block.tight)}</li>\n`).join('');
      return `<${tag}${start}>\n${items}</${tag}>\n`;
    }
    default:
      return '';
  }
}

// ---- inline ----

const ASCII_PUNCT = /^[!-/:-@[-`{-~]$/;
const ENTITY = /^&(?:#[xX]([0-9a-fA-F]{1,6})|#([0-9]{1,7})|([A-Za-z][A-Za-z0-9]{1,31}));/;
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u{A0}', copy: '\u{A9}', reg: '\u{AE}',
  trade: '\u{2122}', hellip: '\u{2026}', mdash: '\u{2014}', ndash: '\u{2013}', lsquo: '\u{2018}',
  rsquo: '\u{2019}', ldquo: '\u{201C}', rdquo: '\u{201D}', laquo: '\u{AB}', raquo: '\u{BB}',
  bull: '\u{2022}', middot: '\u{B7}', deg: '\u{B0}', times: '\u{D7}', eacute: '\u{E9}', aacute: '\u{E1}',
  iacute: '\u{ED}', oacute: '\u{F3}', uacute: '\u{FA}', ntilde: '\u{F1}', ouml: '\u{F6}', uuml: '\u{FC}',
};

function isSpace(ch) {
  return ch === undefined || /\s/u.test(ch);
}

function isPunct(ch) {
  return ch !== undefined && /[\p{P}\p{S}]/u.test(ch);
}

function renderInline(text, opts) {
  return renderNodes(parseInline(text), opts);
}

/** Parses inline Markdown into nodes, following CommonMark's delimiter and bracket algorithm. */
function parseInline(src) {
  const nodes = [];
  const delims = []; // runs of * _ ~ that may open or close emphasis
  const brackets = []; // [ and ![ waiting for a ]
  let text = '';
  const flush = () => {
    if (text) nodes.push({ type: 'text', value: text });
    text = '';
  };

  let i = 0;
  while (i < src.length) {
    const c = src[i];

    if (c === '\\') {
      const next = src[i + 1];
      if (next === '\n') {
        flush();
        nodes.push({ type: 'br' });
        i += 2;
        while (src[i] === ' ') i++;
      } else if (next !== undefined && ASCII_PUNCT.test(next)) {
        text += next;
        i += 2;
      } else {
        text += c;
        i++;
      }
      continue;
    }

    if (c === '`') {
      let n = 1;
      while (src[i + n] === '`') n++;
      const close = findBacktickRun(src, i + n, n);
      if (close === -1) {
        text += '`'.repeat(n);
      } else {
        let code = src.slice(i + n, close).replace(/\n/g, ' ');
        if (/^ .*[^ ].* $/s.test(code)) code = code.slice(1, -1);
        flush();
        nodes.push({ type: 'code', value: code });
      }
      i = close === -1 ? i + n : close + n;
      continue;
    }

    if (c === '<') {
      const auto = /^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*)>/.exec(src.slice(i))
        ?? /^<([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)>/.exec(src.slice(i));
      if (auto) {
        flush();
        const href = auto[1].includes(':') ? auto[1] : `mailto:${auto[1]}`;
        nodes.push({ type: 'link', href, title: null, children: [{ type: 'text', value: auto[1] }] });
        i += auto[0].length;
      } else {
        text += c;
        i++;
      }
      continue;
    }

    if (c === '&') {
      const m = ENTITY.exec(src.slice(i));
      const decoded = m ? decodeEntity(m) : null;
      if (decoded !== null) {
        text += decoded;
        i += m[0].length;
      } else {
        text += c;
        i++;
      }
      continue;
    }

    if (c === '*' || c === '_' || c === '~') {
      let n = 1;
      while (src[i + n] === c) n++;
      if (c === '~' && n !== 2) {
        text += c.repeat(n); // only ~~ strikes through
        i += n;
        continue;
      }
      const before = i > 0 ? src[i - 1] : undefined;
      const after = src[i + n];
      const left = !isSpace(after) && (!isPunct(after) || isSpace(before) || isPunct(before));
      const right = !isSpace(before) && (!isPunct(before) || isSpace(after) || isPunct(after));
      const canOpen = c === '_' ? left && (!right || isPunct(before)) : left;
      const canClose = c === '_' ? right && (!left || isPunct(after)) : right;
      flush();
      const node = { type: 'text', value: c.repeat(n) };
      nodes.push(node);
      if (canOpen || canClose) delims.push({ node, char: c, count: n, original: n, canOpen, canClose });
      i += n;
      continue;
    }

    if (c === '[' || (c === '!' && src[i + 1] === '[')) {
      flush();
      const image = c === '!';
      const node = { type: 'text', value: image ? '![' : '[' };
      nodes.push(node);
      brackets.push({ node, image, active: true, delimBottom: delims.length });
      i += image ? 2 : 1;
      continue;
    }

    if (c === ']') {
      const opener = brackets.pop();
      const tail = opener?.active ? parseLinkTail(src, i + 1) : null;
      if (!tail) {
        text += c;
        i++;
        continue;
      }
      flush();
      const at = nodes.indexOf(opener.node);
      const children = nodes.splice(at + 1);
      nodes.pop();
      processEmphasis(delims, opener.delimBottom, children);
      nodes.push(opener.image
        ? { type: 'image', src: tail.dest, title: tail.title, children }
        : { type: 'link', href: tail.dest, title: tail.title, children });
      if (!opener.image) for (const b of brackets) if (!b.image) b.active = false; // no links inside links
      i = tail.end;
      continue;
    }

    if (c === '\n') {
      const spaces = /( *)$/.exec(text)[1].length;
      text = text.slice(0, text.length - spaces);
      flush();
      nodes.push({ type: spaces >= 2 ? 'br' : 'softbreak' });
      i++;
      while (src[i] === ' ') i++;
      continue;
    }

    text += c;
    i++;
  }
  flush();
  processEmphasis(delims, 0, nodes);
  return nodes;
}

function findBacktickRun(src, from, n) {
  for (let i = from; i < src.length; i++) {
    if (src[i] !== '`') continue;
    let run = 1;
    while (src[i + run] === '`') run++;
    if (run === n) return i;
    i += run - 1;
  }
  return -1;
}

function decodeEntity(m) {
  if (m[3] !== undefined) return Object.hasOwn(NAMED_ENTITIES, m[3]) ? NAMED_ENTITIES[m[3]] : null;
  const code = m[1] !== undefined ? parseInt(m[1], 16) : parseInt(m[2], 10);
  return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? '\u{FFFD}' : String.fromCodePoint(code);
}

function decodeEntities(s) {
  return s.replace(/&(?:#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[A-Za-z][A-Za-z0-9]{1,31});/g, (whole) => decodeEntity(ENTITY.exec(whole)) ?? whole);
}

/** Skips spaces and tabs, and at most one line break. */
function skipSpace(src, i) {
  let newline = false;
  while (i < src.length) {
    if (src[i] === ' ' || src[i] === '\t') i++;
    else if (src[i] === '\n' && !newline) {
      newline = true;
      i++;
    } else break;
  }
  return i;
}

/** Reads the (destination "title") after a ]. */
function parseLinkTail(src, pos) {
  if (src[pos] !== '(') return null;
  let i = skipSpace(src, pos + 1);
  let dest = '';
  if (src[i] === '<') {
    for (i++; i < src.length && src[i] !== '>'; i++) {
      if (src[i] === '\n' || src[i] === '<') return null;
      if (src[i] === '\\' && ASCII_PUNCT.test(src[i + 1] ?? '')) i++;
      dest += src[i];
    }
    if (src[i] !== '>') return null;
    i++;
  } else {
    let depth = 0;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '\\' && ASCII_PUNCT.test(src[i + 1] ?? '')) {
        dest += src[i + 1];
        i++;
        continue;
      }
      if (c === '(') depth++;
      else if (c === ')') {
        if (depth === 0) break;
        depth--;
      } else if (/\s/.test(c) || c < ' ') break;
      dest += c;
    }
    if (depth !== 0) return null;
  }

  const afterDest = i;
  i = skipSpace(src, i);
  let title = null;
  if (i > afterDest && (src[i] === '"' || src[i] === "'" || src[i] === '(')) {
    const close = src[i] === '(' ? ')' : src[i];
    let t = '';
    let j = i + 1;
    for (; j < src.length && src[j] !== close; j++) {
      if (close === ')' && src[j] === '(') return null;
      if (src[j] === '\\' && ASCII_PUNCT.test(src[j + 1] ?? '')) j++;
      t += src[j];
    }
    if (j >= src.length) return null;
    title = decodeEntities(t);
    i = skipSpace(src, j + 1);
  }
  if (src[i] !== ')') return null;
  return { dest: decodeEntities(dest), title, end: i + 1 };
}

/**
 * CommonMark's "process emphasis": pairs openers and closers from the top of
 * the delimiter stack down to `bottom`, and wraps what's between them. The
 * nodes of every delimiter above `bottom` are in `nodes`.
 */
function processEmphasis(delims, bottom, nodes) {
  let ci = bottom;
  while (ci < delims.length) {
    const closer = delims[ci];
    if (!closer.canClose) {
      ci++;
      continue;
    }
    let oi = ci - 1;
    for (; oi >= bottom; oi--) {
      const opener = delims[oi];
      if (opener.char !== closer.char || !opener.canOpen) continue;
      if (closer.char === '~') break;
      const multipleOfThree = (opener.canClose || closer.canOpen)
        && (opener.original + closer.original) % 3 === 0
        && !(opener.original % 3 === 0 && closer.original % 3 === 0);
      if (!multipleOfThree) break;
    }
    if (oi < bottom) {
      if (closer.canOpen) ci++;
      else delims.splice(ci, 1);
      continue;
    }

    const opener = delims[oi];
    const use = closer.char === '~' ? 2 : closer.count >= 2 && opener.count >= 2 ? 2 : 1;
    const type = closer.char === '~' ? 'del' : use === 2 ? 'strong' : 'em';
    opener.count -= use;
    closer.count -= use;
    opener.node.value = opener.node.value.slice(use);
    closer.node.value = closer.node.value.slice(use);

    const from = nodes.indexOf(opener.node);
    const to = nodes.indexOf(closer.node);
    const inner = nodes.splice(from + 1, to - from - 1);
    nodes.splice(from + 1, 0, { type, children: inner });

    delims.splice(oi + 1, ci - oi - 1);
    ci = oi + 1;
    if (opener.count === 0) {
      nodes.splice(nodes.indexOf(opener.node), 1);
      delims.splice(oi, 1);
      ci--;
    }
    if (closer.count === 0) {
      nodes.splice(nodes.indexOf(closer.node), 1);
      delims.splice(ci, 1);
    }
  }
  delims.length = bottom;
}

function renderNodes(nodes, opts) {
  let html = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        html += escapeHtml(node.value);
        break;
      case 'softbreak':
        html += '\n';
        break;
      case 'br':
        html += '<br>\n';
        break;
      case 'code':
        html += `<code>${escapeHtml(node.value)}</code>`;
        break;
      case 'em':
      case 'strong':
        html += `<${node.type}>${renderNodes(node.children, opts)}</${node.type}>`;
        break;
      case 'del':
        html += `<s>${renderNodes(node.children, opts)}</s>`;
        break;
      case 'link': {
        const href = safeUrl(opts.link(node.href));
        const inner = renderNodes(node.children, opts);
        html += href === null ? inner : `<a href="${escapeHtml(href)}"${titleAttr(node.title)}>${inner}</a>`;
        break;
      }
      case 'image': {
        const src = safeUrl(opts.image(node.src));
        const alt = plainText(node.children);
        html += src === null ? escapeHtml(alt) : `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr(node.title)} loading="lazy">`;
        break;
      }
      default:
        break;
    }
  }
  return html;
}

function titleAttr(title) {
  return title ? ` title="${escapeHtml(title)}"` : '';
}

/** An image's alt text: its description as plain text, escapes and all. */
function plainText(nodes) {
  return nodes.map((n) => {
    if (n.type === 'text' || n.type === 'code') return n.value;
    if (n.type === 'softbreak' || n.type === 'br') return ' ';
    return n.children ? plainText(n.children) : '';
  }).join('');
}

/** The address, or null if it uses a scheme the site doesn't link to, like javascript:. */
export function safeUrl(url) {
  const trimmed = url.trim();
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed) && !/^(?:https?|mailto|tel):/i.test(trimmed)) return null;
  return trimmed;
}

export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
