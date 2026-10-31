import { defineConfig } from '@playwright/test';

// Tests de l'application réelle (niveau E de l'ADR 0013): Electron non empaqueté,
// construit au préalable (`pnpm build:test`). Sous Linux sans écran: xvfb-run.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results',
});
