// Tests Playwright de La Petite Ligne (niveau P2 de l'ADR 0013): deux contextes Chromium
// reliés par le serveur du faux hôte (`servir`), comme le Mac et le PC sur le réseau local.
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.LPL_E2E_PORT ?? 8792);
// Environnement cloud: Chromium préinstallé d'une autre révision que celle de @playwright/test.
const preinstalled = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.DUO_CHROMIUM ?? (existsSync(preinstalled) ? preinstalled : undefined);
// Jeu servi: le paquet construit par `test:e2e`, ou un autre dossier construit (LPL_E2E_JEU).
const game = process.env.LPL_E2E_JEU ?? 'la-petite-ligne';
const server = join(import.meta.dirname, '../../packages/sdk-dev/src/serveur/servir.ts');

export default defineConfig({
  testDir: 'tests/e2e',
  // Rendu logiciel dans le cloud: une séquence à deux prend plusieurs minutes.
  timeout: 600_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 960, height: 540 },
    launchOptions: executablePath === undefined ? {} : { executablePath },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node --experimental-strip-types "${server}" ${game} --port ${PORT} --donnees "${join(tmpdir(), `lpl-e2e-${Date.now()}`)}"`,
    url: `http://localhost:${PORT}/api/serveur`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
