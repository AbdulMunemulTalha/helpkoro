import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Unit tests only (no database). SWC transforms Nest decorators + emits the
// decorator metadata that DI relies on — esbuild (Vitest's default) would strip it.
export default defineConfig({
  test: {
    root: './',
    include: ['src/**/*.spec.ts'],
    environment: 'node',
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
