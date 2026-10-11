import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    pool: 'forks',
    setupFiles: ['tests/setup.env.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ['default', 'json'],
    outputFile: {
      json: 'artifacts/test-results/vitest.json',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});