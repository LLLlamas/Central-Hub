import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests cover pure logic (parsers, resolvers, factories) — a Node
// environment is enough; no DOM. The `@/` alias mirrors vite.config.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
