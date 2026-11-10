// Recette automatisée à deux joueurs (`pnpm test:e2e`, hors de la suite rapide): deux contextes
// Chromium reliés par le serveur du faux hôte (`servir`), comme le Mac et le PC sur le réseau local.
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.LPL2_E2E_PORT ?? 8794);
// Environnement cloud: Chromium préinstallé d'une autre révision que celle de @playwright/test.
const preinstalled = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.DUO_CHROMIUM ?? (existsSync(preinstalled) ? preinstalled : undefined);
const server = join(import.meta.dirname, '../../packages/sdk-dev/src/serveur/servir.ts');

export default defineConfig({
  testDir: 'tests/e2e',
  // Chaque parcours vise moins de 60 s de jeu; le démarrage à deux en rendu logiciel en ajoute.
  timeout: 150_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: join(tmpdir(), 'lpl2-e2e-resultats'),
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 960, height: 540 },
    launchOptions: executablePath === undefined ? {} : { executablePath },
    actionTimeout: 10_000,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node --experimental-strip-types "${server}" la-petite-ligne-2 --port ${PORT} --donnees "${join(tmpdir(), `lpl2-e2e-${Date.now()}`)}"`,
    url: `http://localhost:${PORT}/api/serveur`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
