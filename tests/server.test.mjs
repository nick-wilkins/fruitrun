import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let port;
const at = (path) => `http://localhost:${port}${path}`;
const ask = (path) => fetch(at(path), { redirect: 'manual' });
let server;

beforeAll(async () => {
  port = await new Promise((resolve) => {
    const probe = createServer().listen(0, () => {
      const free = probe.address().port;
      probe.close(() => resolve(free));
    });
  });
  server = spawn('node', ['server.mjs'], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('exit', () => reject(new Error('the server stopped before it was listening')));
  });
});

afterAll(() => server?.kill());

describe('one address for each page of the website', () => {
  it('sends an address with no closing slash to the one with it', async () => {
    const res = await ask('/about?from=test');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/about/?from=test');
  });

  it('sends index.html to its folder', async () => {
    expect((await ask('/index.html')).headers.get('location')).toBe('/');
    expect((await ask('/about/index.html')).headers.get('location')).toBe('/about/');
  });

  it('sends any other spelling of a page to the one address', async () => {
    for (const spelling of ['/about//', '/about%2F', '/.%2Fabout/']) {
      const res = await ask(spelling);
      expect(res.status, spelling).toBe(301);
      expect(res.headers.get('location'), spelling).toBe('/about/');
    }
  });
});

describe('the sitemap', () => {
  it('lists pages that exist, each naming itself as the one true address', async () => {
    const res = await ask('/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/xml');
    const listed = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((found) => found[1]);
    expect(listed.length).toBeGreaterThanOrEqual(6);
    for (const address of listed) {
      const page = await ask(new URL(address).pathname);
      expect(page.status, address).toBe(200);
      expect(await page.text(), address).toContain(`<link rel="canonical" href="${address}" />`);
    }
  });

  it('is named in robots.txt', async () => {
    expect(await readFile('site/robots.txt', 'utf8')).toContain('Sitemap: https://smoothiescramble.com/sitemap.xml');
  });
});

describe('an address with nothing at it', () => {
  it('shows a visitor a page with the ways back, still as a 404', async () => {
    const res = await fetch(at('/wp-login.php'), { headers: { Accept: 'text/html,application/xhtml+xml' } });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('text/html');
    const page = await res.text();
    expect(page).toContain('<a href="/play/">');
    expect(page).toContain('noindex');
  });

  it('answers anything that did not ask for a page in two words', async () => {
    const res = await fetch(at('/assets/missing.png'), { headers: { Accept: 'image/*' } });
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not found');
  });
});
