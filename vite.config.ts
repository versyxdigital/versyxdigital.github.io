import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Relative base so the build works from any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
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
