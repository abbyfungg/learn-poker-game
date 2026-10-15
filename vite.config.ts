import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the site from /learn-poker-game/; the dev server stays at /
  base: command === 'build' || isPreview ? '/learn-poker-game/' : '/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts'],
  },
}));
