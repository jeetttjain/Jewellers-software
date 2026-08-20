import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    maxConcurrency: 1,
    include: ['**/*.test.ts', '**/*.test.tsx'],
    server: {
      deps: {
        inline: ['@fastify/helmet', '@fastify/cors', '@fastify/cookie']
      }
    }
  },
  resolve: {
    alias: {
      '@jewellery-pos/shared': path.resolve(__dirname, './packages/shared/src'),
      '@jewellery-pos/validation': path.resolve(__dirname, './packages/validation/src')
    }
  }
});
