import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@/lib/latch': path.resolve(__dirname, './src'),
      '@latch/core': path.resolve(__dirname, './src'),
    },
  },
});
