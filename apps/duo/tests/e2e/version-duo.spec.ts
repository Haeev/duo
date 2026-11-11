// Avis de nouvelle version de Duo (M-35, CA-PF-127), sur l'application réelle
// (version de test): fichier de version servi en local à la place de la release
// « Latest ». L'avis paraît dans la bibliothèque, « Télécharger » demande le lien
// (noté par la version de test au lieu d'ouvrir le navigateur), « Plus tard » le
// met de côté jusqu'à une version plus récente. Sans réponse: rien, et rien de bloqué.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { SCREENSHOTS, closeDuo, launchDuo, seedProfile, tempDataDir } from './duo';

interface TestHooks {
  __duoTest: { checkAppVersion: () => Promise<void> | null; openedLinks: () => string[] };
}

function versionFile(version: string): Record<string, unknown> {
  const sha256 = 'b'.repeat(64);
  return {
    schema: 1,
    version,
    publishedAt: '2026-11-11',
    summary: 'Duo te prévient désormais quand une nouvelle version est prête.',
    page: `https://github.com/Haeev/duo/releases/tag/v${version}`,
    guide: 'https://github.com/Haeev/duo/blob/main/docs/guides/installer-duo.md',
    requires: { darwin: '13.0', win32: '10.0' },
    files: {
      'darwin-arm64': { name: 'Duo-macOS.dmg', size: 1000, sha256 },
      'win32-x64': { name: 'Duo-Windows.exe', size: 1000, sha256 },
      'linux-x64': { name: 'Duo-Linux.AppImage', size: 1000, sha256 },
    },
  };
}

test('Duo annonce une version plus récente dans la bibliothèque (M-35)', async () => {
  let served: string = JSON.stringify(versionFile('9.1.0'));
  const server = createServer((request, response) => {
    if (request.url !== '/duo-version.json') {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader('content-type', 'application/json');
    response.end(served);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/duo-version.json`;

  const dataDir = await tempDataDir('version');
  await seedProfile(dataDir, 'Hélène', 'sun');
  const duo = await launchDuo({ dataDir, port: 41450, env: { DUO_TEST_VERSION_URL: url } });
  try {
    const { platform, app } = duo;
    await platform.getByTestId('onglet-bibliotheque').click();
    const banner = platform.getByTestId('version-duo');
    // CA-PF-127: moins de 10 s après le démarrage.
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner).toContainText('Duo 9.1.0 est disponible');
    await expect(banner).toContainText('Duo te prévient désormais');
    await expect(banner).toContainText('sur les deux ordinateurs');
    await expect(banner).toContainText('Tes sauvegardes et tes jeux sont gardés.');
    await platform.screenshot({ path: path.join(SCREENSHOTS, 'version-duo-avis.png') });

    await platform.getByTestId('version-duo-telecharger').click();
    await expect
      .poll(() => app.evaluate(() => (globalThis as unknown as TestHooks).__duoTest.openedLinks()))
      .toEqual(['https://github.com/Haeev/duo/releases/download/v9.1.0/Duo-Linux.AppImage']);

    // « Plus tard »: plus d'avis pour cette version, même après une nouvelle lecture.
    await platform.getByTestId('version-duo-plus-tard').click();
    await expect(banner).toBeHidden();
    await app.evaluate(() => (globalThis as unknown as TestHooks).__duoTest.checkAppVersion());
    await expect(banner).toBeHidden();

    // Fichier invalide: rien ne change. Version plus récente encore: l'avis revient.
    served = '{ pas du JSON';
    await app.evaluate(() => (globalThis as unknown as TestHooks).__duoTest.checkAppVersion());
    await expect(banner).toBeHidden();
    served = JSON.stringify(versionFile('9.2.0'));
    await app.evaluate(() => (globalThis as unknown as TestHooks).__duoTest.checkAppVersion());
    await expect(banner).toContainText('Duo 9.2.0 est disponible');
  } finally {
    await closeDuo(duo);
    server.close();
  }
});

test('Sans réponse du serveur de versions, aucun avis et la bibliothèque reste utilisable', async () => {
  // Port fermé: la connexion est refusée tout de suite, comme hors ligne.
  const closed = createServer();
  await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
  const port = (closed.address() as AddressInfo).port;
  await new Promise<void>((resolve) => {
    closed.close(() => {
      resolve();
    });
  });

  const dataDir = await tempDataDir('version hors ligne');
  await seedProfile(dataDir, 'Hélène', 'sun');
  const duo = await launchDuo({
    dataDir,
    port: 41455,
    env: { DUO_TEST_VERSION_URL: `http://127.0.0.1:${port}/duo-version.json` },
  });
  try {
    const { platform, app } = duo;
    await platform.getByTestId('onglet-bibliotheque').click();
    await expect(platform.getByTestId('ecran-bibliotheque')).toBeVisible();
    await app.evaluate(() => (globalThis as unknown as TestHooks).__duoTest.checkAppVersion());
    await expect(platform.getByTestId('version-duo')).toHaveCount(0);
    expect(
      await app.evaluate(() => (globalThis as unknown as TestHooks).__duoTest.openedLinks()),
    ).toEqual([]);
  } finally {
    await closeDuo(duo);
  }
});
