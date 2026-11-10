// Captures et mesures du rendu encré dans le vrai jeu, à deux (hôte et invité), hors de la suite
// rapide et hors de `pnpm test:e2e`:
//   pnpm exec vite build && pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts
// `LPL2_CAPTURES` choisit le dossier des images; `-g <nom>` ne joue qu'une vue.
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

const preinstalled = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.DUO_CHROMIUM ?? (existsSync(preinstalled) ? preinstalled : undefined);

export default defineConfig({
  testDir: '.',
  globalSetup: '../aides-e2e/preparation.ts',
  // Rendu logiciel: une image prend jusqu'à plusieurs secondes à 1366 x 768.
  timeout: 600_000,
  expect: { timeout: 30_000 },
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: join(tmpdir(), 'lpl2-encre-resultats'),
  use: {
    // Petit au démarrage (deux rendus logiciels en parallèle): la vue capturée est agrandie ensuite.
    viewport: { width: 240, height: 135 },
    launchOptions: executablePath === undefined ? {} : { executablePath },
    actionTimeout: 30_000,
  },
});
