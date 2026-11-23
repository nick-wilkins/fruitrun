import { defineConfig } from 'vite';

// The one race a day on the website. It is built into site/play, which is committed: the website is served as it
// stands, with no build of its own. The pictures and sounds are not copied; server.mjs serves them from public/.
export default defineConfig({
  root: 'web',
  base: '/play/',
  publicDir: false,
  server: { port: 5184, host: true, fs: { allow: ['..'] } },
  build: { target: 'es2022', outDir: '../site/play', emptyOutDir: true, assetsDir: 'code', chunkSizeWarningLimit: 900 },
});
