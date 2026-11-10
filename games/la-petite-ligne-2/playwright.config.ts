// Recette automatisée à deux joueurs (`pnpm test:e2e`, hors de la suite rapide): deux contextes
// Chromium reliés par le serveur du faux hôte (`servir`), comme le Mac et le PC sur le réseau local.
// Le faux hôte est lancé par chaque parcours (`tests/aides-e2e/serveur.ts`), pas ici.
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import { e2eTempName } from './tests/aides-e2e/dossiers';

// Environnement cloud: Chromium préinstallé d'une autre révision que celle de @playwright/test.
const preinstalled = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.DUO_CHROMIUM ?? (existsSync(preinstalled) ? preinstalled : undefined);

export default defineConfig({
  testDir: 'tests/e2e',
  // Sauvegardes de départ des parcours; chaque parcours démarre ensuite son propre faux hôte.
  globalSetup: './tests/aides-e2e/preparation.ts',
  // Chaque parcours vise moins de 60 s de jeu; le démarrage à deux en rendu logiciel en ajoute.
  timeout: 150_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: 'list',
  // Propre à cette copie du dépôt: deux recettes simultanées s'effaçaient leurs pièces jointes.
  outputDir: join(tmpdir(), e2eTempName('lpl2-e2e-resultats')),
  use: {
    viewport: { width: 960, height: 540 },
    launchOptions: executablePath === undefined ? {} : { executablePath },
    actionTimeout: 10_000,
    screenshot: 'only-on-failure',
  },
});
