import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@crm': fileURLToPath(new URL('../client/src', import.meta.url)) } },
  test: { include: ['src/**/*.spec.ts'] },
});
