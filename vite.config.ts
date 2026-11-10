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

// Relative base so the build works from any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react(), preloadFirstScreen()],
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
