import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

const PORT = 8765;
// Environnement cloud: Chromium préinstallé d'une autre révision que celle de @playwright/test.
const preinstalled = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.DUO_CHROMIUM ?? (existsSync(preinstalled) ? preinstalled : undefined);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: executablePath === undefined ? {} : { executablePath },
  },
  webServer: {
    // Jeu d'essai et pages du faux hôte construits par le script test:e2e.
    command: `node --experimental-strip-types src/serveur/servir.ts _essais/echo --port ${PORT} --donnees ${join(tmpdir(), `duo-sdk-dev-e2e-${Date.now()}`)}`,
    url: `http://localhost:${PORT}/api/serveur`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
