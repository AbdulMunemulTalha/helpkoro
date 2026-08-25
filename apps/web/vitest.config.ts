import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The React plugin supplies the JSX/TSX transform. The app's tsconfig uses
  // `jsx: preserve` (Next transforms JSX at build time); under Vitest the plugin
  // handles the automatic JSX runtime so component specs run directly.
  plugins: [react()],
  resolve: {
    // Mirror the tsconfig `@/*` -> `src/*` path alias for component specs.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
