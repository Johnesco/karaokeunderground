/**
 * The local preview server (ADR-003): the site from site/, the core files at
 * /content/, and /content/index.json built from them. Any other path with no
 * file gets the page shell, as Netlify's rewrite rule will do, and a missing
 * file with an extension (a script, an image) gets a 404.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { buildIndex } from './content-index.js';

export const TYPES = {
  '.html': 'text/html; charset=utf-8',
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

/** A path under root, or null if the request tries to leave it. */
function inside(root, rel) {
  const full = path.resolve(root, rel);
  return full === root || full.startsWith(root + path.sep) ? full : null;
}

/**
 * What a request serves.
 *
 * @returns {{ status: number, file?: string, index?: boolean }}
 */
export function resolve(url, { siteDir, contentDir }) {
  let p;
  try {
    p = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return { status: 400 };
  }
  if (p.includes('\0')) return { status: 400 };
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

export function createServer({ siteDir, contentDir }) {
  return http.createServer((req, res) => {
    const headers = { 'Cache-Control': 'no-store' };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, headers).end();
      return;
    }
    const r = resolve(req.url, { siteDir, contentDir });
    if (r.status !== 200) {
      res.writeHead(r.status, { ...headers, 'Content-Type': TYPES['.txt'] }).end(r.status === 404 ? 'Not found\n' : 'Bad request\n');
      return;
    }
    if (r.index) {
      res.writeHead(200, { ...headers, 'Content-Type': TYPES['.json'] });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(buildIndex(contentDir)));
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Type': TYPES[path.extname(r.file).toLowerCase()] ?? 'application/octet-stream' });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(r.file).pipe(res);
  });
}
