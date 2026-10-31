// Deux instances de Duo reliées par `@duo/liaison` (découverte sur la boucle locale,
// liaison authentifiée), qui lancent La Petite Ligne et relaient ses messages: le jeu
// doit être construit (`pnpm --filter la-petite-ligne build`, jeux du dépôt en
// développement).
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  SCREENSHOTS,
  closeDuo,
  gamePage,
  launchDuo,
  seedProfile,
  tempDataDir,
  type DuoInstance,
} from './duo';

interface RelayStats {
  gameSent: number;
  gameReceived: number;
  appSent: number;
  appReceived: number;
  partner: string;
}

function relay(instance: DuoInstance): Promise<RelayStats> {
  return instance.app.evaluate(() =>
    (globalThis as unknown as { __duoTest: { liaison: () => RelayStats } }).__duoTest.liaison(),
  );
}

test('La Petite Ligne à deux: découverte, salon, départ et relais des messages du jeu', async () => {
  const camilleDir = await tempDataDir('Camille');
  const sachaDir = await tempDataDir('Sacha');
  await seedProfile(camilleDir, 'Camille', 'orb');
  await seedProfile(sachaDir, 'Sacha', 'crescent');
  // Rendu léger du jeu: deux rendus 3D en logiciel sur les quatre cœurs du cloud figent
  // sinon la page au premier affichage plus de 5 s (chien de garde de la plateforme).
  const gameQuery = 'rendu=leger';
  const camille = await launchDuo({ dataDir: camilleDir, port: 41410, peerPort: 41415, gameQuery });
  const sacha = await launchDuo({ dataDir: sachaDir, port: 41415, peerPort: 41410, gameQuery });
  try {
    await expect(camille.platform.getByTestId('presence-barre')).toContainText('Sacha est là', {
      timeout: 10_000,
    });
    await expect(sacha.platform.getByTestId('presence-barre')).toContainText('Camille est là');
    expect((await relay(camille)).partner).toBe('connected');

    await camille.platform.getByTestId('onglet-bibliotheque').click();
    await camille.platform.getByTestId('jeu-la-petite-ligne').click();
    await expect(camille.platform.getByTestId('ecran-salon-hote')).toBeVisible();
    await sacha.platform.getByTestId('invitation-rejoindre').click();
    await expect(sacha.platform.getByTestId('ecran-salon-invite')).toBeVisible();
    await camille.platform.getByTestId('salon-pret').click();
    await expect(sacha.platform.getByTestId('decompte')).toBeVisible();

    const [gameCamille, gameSacha] = await Promise.all([gamePage(camille), gamePage(sacha)]);
    expect(gameCamille.url()).toContain('duo-game://la-petite-ligne/');
    expect(gameSacha.url()).toContain('duo-game://la-petite-ligne/');

    // Le jeu de l'hôte envoie ses instantanés, celui de l'invitée ses entrées, à chaque pas:
    // les compteurs des deux principaux montent dans les deux sens. Dans l'environnement
    // cloud, le rendu logiciel de deux instances peut figer la page du jeu quelques secondes
    // (chien de garde de la plateforme): on mesure le relais dès le départ.
    const both = async (): Promise<[RelayStats, RelayStats]> =>
      Promise.all([relay(camille), relay(sacha)]);
    await expect
      .poll(
        async () => {
          const [a, b] = await both();
          return Math.min(a.gameSent, a.gameReceived, b.gameSent, b.gameReceived);
        },
        { timeout: 60_000, intervals: [250] },
      )
      .toBeGreaterThanOrEqual(5);
    const [statsCamille, statsSacha] = await both();
    expect(statsCamille.partner).toBe('connected');
    expect(statsSacha.partner).toBe('connected');
    // Messages fiables du salon de la plateforme portés par la liaison (état et intentions).
    expect(statsCamille.appSent).toBeGreaterThan(0);
    expect(statsSacha.appSent).toBeGreaterThan(0);
    test.info().annotations.push({
      type: 'relais',
      description: `Camille ${JSON.stringify(statsCamille)} / Sacha ${JSON.stringify(statsSacha)}`,
    });
    // Captures si les vues vivent encore (une vue figée est détruite par la plateforme).
    await gameCamille
      .screenshot({ path: path.join(SCREENSHOTS, 'lpl-hote.png') })
      .catch(() => undefined);
    await gameSacha
      .screenshot({ path: path.join(SCREENSHOTS, 'lpl-invitee.png') })
      .catch(() => undefined);
    await camille.platform.screenshot({ path: path.join(SCREENSHOTS, 'lpl-plateforme-hote.png') });
  } finally {
    await closeDuo(sacha);
    await closeDuo(camille);
  }
});
