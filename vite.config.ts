import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  server: { port: 5183, host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,webp,mp3,m4a}'],
        // Only Vite's own bundles carry a hash in their name. Pictures and music share the assets folder but keep
        // their names, so they need a revision or a changed one would never be fetched again.
        dontCacheBustURLsMatching: /-[A-Za-z0-9_-]{8}\.(js|css)$/,
        // The longest music track is 4.6 MB; the default limit would quietly leave it out.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: 'Smoothie Adventure',
        short_name: 'Smoothie',
        description: 'Roll Pip down the course, win fruit and blend smoothies.',
        start_url: '.',
        scope: '.',
        display: 'fullscreen',
        orientation: 'landscape',
        theme_color: '#4cc0ff',
        background_color: '#4cc0ff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
