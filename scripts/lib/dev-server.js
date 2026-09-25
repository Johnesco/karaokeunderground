/**
 * The local preview server (ADR-003): the site from site/, the core files at
 * /content/, and /content/index.json built from them. Any other path with no
 * file gets the page shell, as Netlify's rewrite rule will do, and a missing
 * file with an extension (a script, an image) gets a 404.
 *
 * Given a private copy of the site from before WordPress (ADR-011), it shows
 * that at /old/, where nothing links. The build leaves it out.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { buildIndex } from './content-index.js';

export const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** A path under root, or null if the request tries to leave it. */
function inside(root, rel) {
  const full = path.resolve(root, rel);
  return full === root || full.startsWith(root + path.sep) ? full : null;
}

/**
 * A path in the copy of the old site (ADR-011): a file as it is, or a folder's
 * index.html. A folder asked for without its slash gets one, so the old pages'
 * relative links resolve inside it.
 */
function resolveOld(rel, oldDir) {
  const full = inside(path.resolve(oldDir), rel.replace(/^\/+/, ''));
  if (!full) return { status: 404 };
  if (isDir(full)) {
    if (!rel.endsWith('/')) return { status: 301, location: encodeURI(`/old${rel}/`) };
    const index = path.join(full, 'index.html');
    return isFile(index) ? { status: 200, file: index, old: true } : { status: 404 };
  }
  return isFile(full) ? { status: 200, file: full, old: true } : { status: 404 };
}

/** Old pages keep their own inline scripts and styles, and load nothing from other sites. */
export const OLD_POLICY = "default-src 'self' 'unsafe-inline' data:";

/**
 * An old page with its links to the old domain pointed back into /old/.
 * Bytes in, bytes out: latin1 maps every byte to itself, so the page's own
 * encoding survives.
 */
export function oldPage(bytes) {
  const links = /(\b(?:href|src|background|lowsrc|action)\s*=\s*["']?)(?:https?:)?\/\/(?:www\.)?karaokeunderground\.com(?![\w.-])\/?/gi;
  return Buffer.from(bytes.toString('latin1').replace(links, '$1/old/'), 'latin1');
}

/**
 * What a request serves.
 *
 * @returns {{ status: number, file?: string, index?: boolean, old?: boolean, location?: string }}
 */
export function resolve(url, { siteDir, contentDir, oldDir }) {
  let p;
  try {
    p = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return { status: 400 };
  }
  if (p.includes('\0')) return { status: 400 };
  if (oldDir && (p === '/old' || p.startsWith('/old/'))) return resolveOld(p.slice('/old'.length), oldDir);
  if (p === '/content/index.json') return { status: 200, index: true };
  if (p.startsWith('/content/')) {
    const file = inside(path.resolve(contentDir), p.slice('/content/'.length));
    return file && isFile(file) ? { status: 200, file } : { status: 404 };
  }
  const file = inside(path.resolve(siteDir), p.slice(1));
  if (file && isFile(file)) return { status: 200, file };
  if (path.posix.extname(p)) return { status: 404 };
  return { status: 200, file: path.join(siteDir, 'index.html') };
}

export function createServer({ siteDir, contentDir, oldDir }) {
  return http.createServer((req, res) => {
    const headers = { 'Cache-Control': 'no-store' };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, headers).end();
      return;
    }
    const r = resolve(req.url, { siteDir, contentDir, oldDir });
    if (r.status === 301) {
      res.writeHead(301, { ...headers, Location: r.location }).end();
      return;
    }
    if (r.status !== 200) {
      res.writeHead(r.status, { ...headers, 'Content-Type': TYPES['.txt'] }).end(r.status === 404 ? 'Not found\n' : 'Bad request\n');
      return;
    }
    if (r.index) {
      res.writeHead(200, { ...headers, 'Content-Type': TYPES['.json'] });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(buildIndex(contentDir)));
      return;
    }
    const type = TYPES[path.extname(r.file).toLowerCase()] ?? 'application/octet-stream';
    if (r.old) {
      // The old site's files as they are, with no charset, so each page's own
      // declaration (iso-8859-1 on the old site) applies. Its pages may load
      // nothing from other sites: they call on services long gone, like a
      // comments script whose domain someone else holds now.
      const html = type.startsWith('text/html');
      res.writeHead(200, { ...headers, 'Content-Type': type.split(';')[0], ...(html && { 'Content-Security-Policy': OLD_POLICY }) });
      if (req.method === 'HEAD') res.end();
      else if (html) res.end(oldPage(fs.readFileSync(r.file)));
      else fs.createReadStream(r.file).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Type': type });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(r.file).pipe(res);
  });
}
