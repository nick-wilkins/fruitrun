import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGoes, GOES } from './goes.mjs';

// The website: pages about the game, its privacy policy, terms and help, and one race a day to play at /play/.
const root = join(fileURLToPath(new URL('.', import.meta.url)), 'site');
const gameAssets = join(fileURLToPath(new URL('.', import.meta.url)), 'public', 'assets');
const playCode = join(root, 'play', 'code');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

// The pages, and the two files that clear away the playable version this address once served, are checked on
// every visit. Pictures and styles are kept for an hour, so a changed stylesheet is linked under a new ?v= number.
const entry = /^(sw\.js|registerSW\.js|.*\.html)$/;

function cacheControl(path) {
  if (entry.test(basename(path))) return 'no-cache';
  // The race of the day is played again and again. Its code is built under a new name whenever it changes, so a
  // browser may keep it for good; the game's pictures and sounds are kept for a day.
  if (path.startsWith(playCode + sep)) return 'public, max-age=31536000, immutable';
  if (path.startsWith(gameAssets + sep)) return 'public, max-age=86400';
  return 'public, max-age=3600';
}

// The race of the day at /play/ uses the game's own pictures and sounds, which are served from where the app
// takes them rather than kept twice.
const GAME_ASSETS = '/play/assets/';

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  if (decoded.startsWith(GAME_ASSETS)) {
    const path = normalize(join(gameAssets, decoded.slice(GAME_ASSETS.length)));
    if (!path.startsWith(gameAssets + sep)) return null;
    const info = await stat(path).catch(() => null);
    return info?.isFile() ? { path, info } : null;
  }
  const path = normalize(join(root, decoded));
  if (path !== root && !path.startsWith(root + sep)) return null;
  const info = await stat(path).catch(() => null);
  // Each page has one address, its folder with a closing slash, so that a search engine does not find it twice.
  // The way there is made from the folder found, never from what was asked for.
  if (info?.isFile()) return basename(path) === 'index.html' ? { redirect: folderAddress(join(path, '..')) } : { path, info };
  if (info?.isDirectory()) {
    const index = join(path, 'index.html');
    const indexInfo = await stat(index).catch(() => null);
    if (!indexInfo?.isFile()) return null;
    return urlPath === folderAddress(path) ? { path: index, info: indexInfo } : { redirect: folderAddress(path) };
  }
  return null;
}

function folderAddress(folder) {
  const inside = relative(root, folder).split(sep).filter(Boolean).map(encodeURIComponent).join('/');
  return inside ? `/${inside}/` : '/';
}

const goes = createGoes();
const GO = '/play/go';

// A day's counts go when the day is over everywhere, whether or not anyone is playing.
setInterval(() => goes.tidy(), 60 * 60 * 1000).unref();

/**
 * Where a request really came from. The network in front of the site sets the first of these itself, whatever the
 * visitor sent. Failing that, the last address in the forwarded list is the one the nearest proxy saw: the earlier
 * ones are whatever the visitor claimed.
 */
function addressOf(req) {
  const passed = req.headers['cf-connecting-ip'] ?? String(req.headers['x-forwarded-for'] ?? '').split(',').pop().trim();
  return passed || req.socket.remoteAddress || 'unknown';
}

/** The race of the day: GET asks how many goes this address has left on the visitor's date, POST uses one. */
function answerGo(req, res, day) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.writeHead(405, { Allow: 'GET, POST' }).end();
  // Only the race's own page may use a go: another website cannot spend a visitor's for them.
  const from = req.headers['sec-fetch-site'];
  if (req.method === 'POST' && from && from !== 'same-origin') return res.writeHead(403).end();
  const address = addressOf(req);
  const taken = req.method === 'POST' ? goes.take(address, day) : null;
  const left = taken ? taken.left : goes.left(address, day);
  if (left === null) return res.writeHead(400).end();
  const status = taken && !taken.ok ? 429 : 200;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ left, of: GOES }));
}

const server = createServer(async (req, res) => {
  let asked = null;
  try {
    asked = new URL(req.url, 'http://localhost');
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (asked.pathname === GO) return answerGo(req, res, asked.searchParams.get('day') ?? '');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let file = null;
  try {
    file = await resolveFile(asked.pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }

  if (file?.redirect) {
    res.writeHead(301, { Location: file.redirect + asked.search, 'Cache-Control': 'public, max-age=3600' }).end();
    return;
  }

  if (!file) {
    // A visitor who asked for a page is shown the ways back. Anything else gets two words.
    const page = (req.headers.accept ?? '').includes('text/html') ? await readFile(join(root, '404.html')).catch(() => null) : null;
    if (page) res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }).end(req.method === 'HEAD' ? undefined : page);
    else res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }

  const headers = {
    'Content-Type': types[extname(file.path).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': cacheControl(file.path),
    'Last-Modified': file.info.mtime.toUTCString(),
    'Accept-Ranges': 'bytes',
  };

  const since = req.headers['if-modified-since'];
  if (since && Math.floor(file.info.mtimeMs / 1000) <= Math.floor(Date.parse(since) / 1000)) {
    res.writeHead(304, headers).end();
    return;
  }

  // Safari needs range support to play audio.
  let start = 0;
  let end = file.info.size - 1;
  let status = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), end);
    } else {
      start = Math.max(file.info.size - Number(range[2]), 0);
    }
    if (start > end || start >= file.info.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${file.info.size}` }).end();
      return;
    }
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${file.info.size}`;
  }
  headers['Content-Length'] = end - start + 1;

  res.writeHead(status, headers);
  if (req.method === 'HEAD' || file.info.size === 0) {
    res.end();
    return;
  }
  createReadStream(file.path, { start, end }).on('error', () => res.destroy()).pipe(res);
});

server.listen(Number(process.env.PORT) || 3000, () => {
  console.log(`Fruit Run listening on ${server.address().port}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
