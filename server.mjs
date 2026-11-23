import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The website: a page about the game, its privacy policy, terms and help. The game itself is only in the app.
const root = join(fileURLToPath(new URL('.', import.meta.url)), 'site');

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
};

// The pages, and the two files that clear away the playable version this address once served, are checked on
// every visit. Pictures and styles are kept for an hour.
const entry = /^(sw\.js|registerSW\.js|.*\.html)$/;

function cacheControl(path) {
  return entry.test(basename(path)) ? 'no-cache' : 'public, max-age=3600';
}

async function resolveFile(urlPath) {
  const path = normalize(join(root, decodeURIComponent(urlPath)));
  if (path !== root && !path.startsWith(root + sep)) return null;
  const info = await stat(path).catch(() => null);
  if (info?.isFile()) return { path, info };
  if (info?.isDirectory()) {
    const index = join(path, 'index.html');
    const indexInfo = await stat(index).catch(() => null);
    if (indexInfo?.isFile()) return { path: index, info: indexInfo };
  }
  return null;
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let file = null;
  try {
    file = await resolveFile(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }

  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
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
