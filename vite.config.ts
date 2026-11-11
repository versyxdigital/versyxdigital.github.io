// @ts-expect-error This project does not install Node's type definitions; the config still runs in Node.
import { existsSync } from 'node:fs';
// @ts-expect-error As above.
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Starts the downloads the first screen needs straight from the HTML, instead
 * of waiting for the main script to ask for them: the two text fonts (so type
 * does not swap after it appears) and the 3D background's code.
 */
function preloadFirstScreen(): Plugin {
  return {
    name: 'preload-first-screen',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {});
        const fonts = files.filter((f) => /geist(-mono)?-latin-wght-normal-[^/]+\.woff2$/.test(f));
        return [
          ...fonts.map((f) => ({
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `./${f}`, crossorigin: '' },
            injectTo: 'head' as const,
          })),
        ];
      },
    },
  };
}

/**
 * Dev server only: serve the ready-made sites that live in public/ (such as
 * public/mkeditor/) at their folder address, the way GitHub Pages does.
 * Without this, /mkeditor/ falls through to the portfolio's own page, because
 * the dev server only serves public files by their exact name.
 */
function publicFolderIndexes(): Plugin {
  return {
    name: 'public-folder-indexes',
    configureServer(server) {
      server.middlewares.use((incoming, outgoing, next) => {
        // Typed by hand for the same reason: no Node type definitions here.
        const req = incoming as unknown as { url?: string };
        const res = outgoing as unknown as { statusCode: number; setHeader(name: string, value: string): void; end(): void };
        const [path = '', query = ''] = (req.url ?? '').split('?');
        if (path === '/' || path.includes('.') || path.startsWith('/@') || path.startsWith('/src')) return next();
        const folder = path.replace(/\/+$/, '');
        if (!existsSync(join(server.config.publicDir, folder, 'index.html'))) return next();
        if (!path.endsWith('/')) {
          // Same as the live site: add the slash so the page's relative links resolve.
          res.statusCode = 302;
          res.setHeader('Location', `${folder}/${query ? `?${query}` : ''}`);
          res.end();
          return;
        }
        req.url = `${folder}/index.html${query ? `?${query}` : ''}`;
        next();
      });
    },
  };
}

// Relative base so the build works from any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react(), preloadFirstScreen(), publicFolderIndexes()],
  build: {
    target: 'es2022',
    // three.js is a single lazy chunk (~250 kB gzipped) loaded after first paint.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
