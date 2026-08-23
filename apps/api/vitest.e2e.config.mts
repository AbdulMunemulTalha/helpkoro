import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// End-to-end tests: boot the Nest+Fastify app and exercise it with app.inject().
// Requires a live PostgreSQL + Redis (provided by CI and `pnpm services:up`).
// Not part of the turbo `test` task, so `pnpm test` never needs a database.
export default defineConfig({
  test: {
    root: './',
    include: ['test/e2e/**/*.e2e-spec.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        keepClassNames: true,
      },
    }),
  ],
});
