// Deux instances de Duo sur la même machine (ADR 0013, prérequis 1), reliées par
// la liaison provisoire, avec le jeu d'essai du pont: le parcours complet d'une
// séance, puis un jeu qui plante et un jeu qui se fige.
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';
import {
  APP_DIR,
  FIXTURE_GAMES,
  SCREENSHOTS,
  closeDuo,
  gamePage,
  launchDuo,
  pressNativeKey,
  seedProfile,
  tempDataDir,
  type DuoInstance,
} from './duo';

interface EssaiState {
  role: string | null;
  seed: number | null;
  started: boolean;
  paused: boolean;
  stopped: string | null;
  count: number;
  peerCount: number;
  players: { id: string; name: string; local: boolean }[];
  pausedBy: string | null;
  saveResults: string[];
}

/** Captures versionnées du bloc « Dernières séances » (preuve pour la revue). */
const HISTORY_CAPTURES = path.join(APP_DIR, '..', '..', 'docs', 'plateforme', 'captures');

function essai(page: Page): Promise<EssaiState> {
  return page.evaluate(() => (window as unknown as { __essai: EssaiState }).__essai);
}

/** Capture de l'écran virtuel entier: la fenêtre au premier plan, vues composées. */
async function captureScreen(name: string): Promise<void> {
  await promisify(execFile)('import', ['-window', 'root', path.join(SCREENSHOTS, name)]).catch(
    () => undefined,
  );
}

async function startPair(port: number): Promise<[DuoInstance, DuoInstance]> {
  const camilleDir = await tempDataDir('Camille');
  const sachaDir = await tempDataDir('Sacha');
  await seedProfile(camilleDir, 'Camille', 'orb');
  await seedProfile(sachaDir, 'Sacha', 'crescent');
  // Ports de base distincts (TCP de base et deux replis, UDP de base): l'un appelle l'autre.
  const camille = await launchDuo({
    dataDir: camilleDir,
    port,
    peerPort: port + 5,
    gamesDir: FIXTURE_GAMES,
  });
  const sacha = await launchDuo({
    dataDir: sachaDir,
    port: port + 5,
    peerPort: port,
    gamesDir: FIXTURE_GAMES,
  });
  return [camille, sacha];
}

async function openSalonAndStart(camille: DuoInstance, sacha: DuoInstance): Promise<[Page, Page]> {
  await camille.platform.getByTestId('onglet-bibliotheque').click();
  await camille.platform.getByTestId('jeu-essai-pont').click();
  await expect(camille.platform.getByTestId('ecran-salon-hote')).toBeVisible();
  await sacha.platform.getByTestId('invitation-rejoindre').click();
  await expect(sacha.platform.getByTestId('ecran-salon-invite')).toBeVisible();
  await camille.platform.getByTestId('salon-pret').click();
  const games = await Promise.all([gamePage(camille), gamePage(sacha)]);
  for (const game of games) {
    await expect.poll(async () => (await essai(game)).started, { timeout: 15_000 }).toBe(true);
  }
  return games;
}

test('une séance à deux: invitation, salon, partie, pause, reprise, fin et sauvegarde', async () => {
  const [camille, sacha] = await startPair(41310);
  try {
    await expect(camille.platform.getByTestId('presence-barre')).toContainText('Sacha est là', {
      timeout: 10_000,
    });
    await expect(sacha.platform.getByTestId('presence-barre')).toContainText('Camille est là');
    await camille.platform.screenshot({ path: path.join(SCREENSHOTS, 'deux-accueil.png') });

    await camille.platform.getByTestId('accueil-heberger').click();
    await expect(camille.platform.getByTestId('ecran-bibliotheque')).toBeVisible();
    await camille.platform.screenshot({ path: path.join(SCREENSHOTS, 'deux-bibliotheque.png') });
    await camille.platform.getByTestId('jeu-essai-pont').click();
    await expect(camille.platform.getByTestId('ecran-salon-hote')).toBeVisible();
    await expect(camille.platform.getByTestId('salon-attente')).toContainText(
      'Invitation envoyée à Sacha.',
    );

    await expect(sacha.platform.getByTestId('invitation')).toBeVisible();
    await expect(sacha.platform.getByTestId('invitation-rejoindre')).toBeFocused();
    await sacha.platform.screenshot({ path: path.join(SCREENSHOTS, 'deux-invitation.png') });
    // Rejoindre d'une touche (UX 12), après la garde de 300 ms.
    await sacha.platform.waitForTimeout(350);
    await sacha.platform.keyboard.press('Enter');
    await expect(sacha.platform.getByTestId('ecran-salon-invite')).toBeVisible();
    await expect(camille.platform.getByTestId('notification')).toContainText(
      'Sacha a rejoint le salon.',
    );
    await expect(camille.platform.getByTestId('salon-carte-autre')).toContainText('C’est parti');
    await camille.platform.screenshot({ path: path.join(SCREENSHOTS, 'deux-salon-hote.png') });
    await sacha.platform.screenshot({ path: path.join(SCREENSHOTS, 'deux-salon-invite.png') });

    await camille.platform.getByTestId('salon-pret').click();
    await expect(camille.platform.getByTestId('decompte')).toBeVisible();
    await expect(sacha.platform.getByTestId('decompte')).toBeVisible();
    await camille.platform.screenshot({ path: path.join(SCREENSHOTS, 'deux-decompte.png') });

    const [gameCamille, gameSacha] = await Promise.all([gamePage(camille), gamePage(sacha)]);
    await expect
      .poll(async () => (await essai(gameCamille)).started, { timeout: 15_000 })
      .toBe(true);
    await expect.poll(async () => (await essai(gameSacha)).started, { timeout: 15_000 }).toBe(true);
    const [stateCamille, stateSacha] = await Promise.all([essai(gameCamille), essai(gameSacha)]);
    expect(stateCamille.role).toBe('host');
    expect(stateSacha.role).toBe('guest');
    expect(stateCamille.seed).toBe(stateSacha.seed);
    expect(stateCamille.players.map((player) => player.name)).toEqual(['Camille', 'Sacha']);
    expect(stateSacha.players.map((player) => player.name)).toEqual(['Camille', 'Sacha']);
    expect(stateSacha.players.find((player) => player.local)?.name).toBe('Sacha');
    expect(stateCamille.players[0]?.id).toBe(stateSacha.players[0]?.id);

    // Messages du jeu relayés d'une machine à l'autre.
    await gameSacha.keyboard.press('Space');
    await gameSacha.keyboard.press('Space');
    await expect.poll(async () => (await essai(gameCamille)).peerCount).toBe(2);
    await gameCamille.keyboard.press('Space');
    await expect.poll(async () => (await essai(gameSacha)).peerCount).toBe(1);
    await captureScreen('deux-partie-ecran.png');

    // Échap (vraie touche) est interceptée par la plateforme et met en pause les deux machines.
    await pressNativeKey(camille, 'Escape');
    await expect(camille.platform.getByTestId('superposition-pause')).toBeVisible();
    await expect(sacha.platform.getByTestId('superposition-pause')).toBeVisible();
    await expect(sacha.platform.getByTestId('superposition-pause')).toContainText(
      'Pause demandée par Camille.',
    );
    await expect.poll(async () => (await essai(gameSacha)).paused).toBe(true);
    expect((await essai(gameCamille)).paused).toBe(true);
    // Le jeu sait qui a demandé la pause: l'identifiant de joueur de Camille.
    expect((await essai(gameSacha)).pausedBy).toBe(stateCamille.players[0]?.id);
    await camille.platform.screenshot({
      path: path.join(SCREENSHOTS, 'deux-pause-vue-plateforme.png'),
    });
    await captureScreen('deux-pause-ecran.png');

    // Reprise quand les deux l'ont demandée, après « Reprise dans 3 ».
    await camille.platform.getByTestId('pause-reprendre').click();
    await expect(sacha.platform.getByTestId('superposition-pause')).toContainText('Veut reprendre');
    await sacha.platform.getByTestId('pause-reprendre').click();
    await expect(camille.platform.getByTestId('reprise-decompte')).toBeVisible();
    await expect.poll(async () => (await essai(gameCamille)).paused, { timeout: 8000 }).toBe(false);
    await expect.poll(async () => (await essai(gameSacha)).paused, { timeout: 8000 }).toBe(false);

    // Fin de séance: retour au salon depuis la pause, sauvegarde de sortie chez l'hôte.
    await pressNativeKey(sacha, 'Escape');
    await expect(camille.platform.getByTestId('superposition-pause')).toBeVisible();
    await camille.platform.getByTestId('pause-retour-salon').click();
    await expect(camille.platform.getByTestId('arret-retour')).toBeFocused();
    await camille.platform.getByTestId('arret-confirmer').click();
    await expect(camille.platform.getByTestId('ecran-fin')).toBeVisible({ timeout: 10_000 });
    await expect(sacha.platform.getByTestId('ecran-fin')).toBeVisible({ timeout: 10_000 });
    await expect(camille.platform.getByTestId('ecran-fin')).toContainText(
      'Progression enregistrée.',
    );
    // Résumé de séance envoyé par le jeu en réponse à l'arrêt: écran de fin des deux côtés.
    await expect(camille.platform.getByTestId('fin-statistiques')).toContainText('Appuis ici');
    await expect(sacha.platform.getByTestId('fin-statistiques')).toContainText('Appuis ici');
    await camille.platform.screenshot({ path: path.join(SCREENSHOTS, 'deux-fin-seance.png') });

    const head = JSON.parse(
      await readFile(
        path.join(camille.dataDir, 'sauvegardes-locales', 'essai-pont', '1', 'head.json'),
        'utf8',
      ),
    ) as { label: string };
    expect(head.label).toBe('Compteur 1');
    expect((await essai(gameCamille).catch(() => null))?.saveResults ?? ['ok']).toContain('ok');

    await camille.platform.getByTestId('fin-retour-salon').click();
    await sacha.platform.getByTestId('fin-retour-salon').click();
    await expect(camille.platform.getByTestId('ecran-salon-hote')).toBeVisible();
    expect(
      camille.app.windows().filter((page) => page.url().startsWith('duo-game://')),
    ).toHaveLength(0);

    // Le salon propose de continuer la sauvegarde écrite; l'invité voit le choix de l'hôte.
    await expect(camille.platform.getByTestId('sauvegarde-continue')).toBeChecked();
    await expect(sacha.platform.getByTestId('salon-sauvegarde-invite')).toContainText('Compteur 1');
    await camille.platform.screenshot({ path: path.join(SCREENSHOTS, 'deux-salon-continuer.png') });

    // Historique: la séance est inscrite sur les deux ordinateurs, avec avancement et nombres.
    for (const instance of [camille, sacha]) {
      const block = instance.platform.getByTestId('salon-historique');
      await expect(block.getByTestId('historique-entree')).toHaveCount(1, { timeout: 5000 });
      await expect(block).toContainText('Appuis ici');
      await expect(block).toContainText('Appuis là-bas');
      await expect(block).toContainText('Avancement');
      await block.scrollIntoViewIfNeeded();
    }
    await camille.platform.screenshot({
      path: path.join(HISTORY_CAPTURES, 'salon-historique-hote.png'),
    });
    await sacha.platform.screenshot({
      path: path.join(HISTORY_CAPTURES, 'salon-historique-invite.png'),
    });
    // Les deux ordinateurs ont leur copie de l'entrée, avec le résumé du jeu.
    for (const instance of [camille, sacha]) {
      const dir = path.join(instance.dataDir, 'historique-local', 'essai-pont');
      const [file] = await readdir(dir);
      const entry = JSON.parse(await readFile(path.join(dir, file ?? ''), 'utf8')) as unknown;
      expect(entry).toMatchObject({ reason: 'stopped', progress: 0.25, stats: { length: 2 } });
    }

    // Nouvelle séance: le jeu de l'hôte reçoit la sauvegarde dans init (sens principal vers jeu).
    await camille.platform.getByTestId('salon-pret').click();
    await sacha.platform.getByTestId('salon-pret').click();
    const [repriseCamille] = await Promise.all([gamePage(camille), gamePage(sacha)]);
    await expect
      .poll(async () => (await essai(repriseCamille)).started, { timeout: 15_000 })
      .toBe(true);
    expect((await essai(repriseCamille)).count).toBe(1);
  } finally {
    await closeDuo(sacha);
    await closeDuo(camille);
  }
});

test('un jeu qui plante ou se fige ramène les deux joueurs au salon (F05)', async () => {
  const [camille, sacha] = await startPair(41320);
  try {
    await expect(camille.platform.getByTestId('presence-barre')).toContainText('Sacha est là', {
      timeout: 10_000,
    });

    // Fin de démo voulue par le jeu de l'hôte (sessionEnd finished): fin de séance chez les deux, avec ses chiffres.
    let [gameCamille, gameSacha] = await openSalonAndStart(camille, sacha);
    await gameSacha.keyboard.press('Space');
    await expect.poll(async () => (await essai(gameCamille)).peerCount).toBe(1);
    await gameCamille.keyboard.press('KeyF').catch(() => undefined);
    await expect(sacha.platform.getByTestId('ecran-fin')).toBeVisible({ timeout: 10_000 });
    await expect(sacha.platform.getByTestId('fin-statistiques')).toContainText('Appuis là-bas');
    await expect(camille.platform.getByTestId('fin-statistiques')).toContainText('Appuis ici');
    await sacha.platform.screenshot({ path: path.join(SCREENSHOTS, 'fin-de-demo-invite.png') });
    await camille.platform.getByTestId('fin-retour-salon').click();
    await sacha.platform.getByTestId('fin-retour-salon').click();
    await expect(camille.platform.getByTestId('ecran-salon-hote')).toBeVisible();
    await expect(sacha.platform.getByTestId('ecran-salon-invite')).toBeVisible();

    // Erreur non rattrapée chez l'hôte: message fatal, retour au salon des deux côtés.
    await camille.platform.getByTestId('salon-pret').click();
    await sacha.platform.getByTestId('salon-pret').click();
    [gameCamille, gameSacha] = await Promise.all([gamePage(camille), gamePage(sacha)]);
    await expect
      .poll(async () => (await essai(gameCamille)).started, { timeout: 15_000 })
      .toBe(true);
    // La vue du jeu disparaît pendant l'appui: Playwright peut le signaler, c'est attendu.
    await gameCamille.keyboard.press('KeyL').catch(() => undefined);
    await expect(camille.platform.locator('[data-message="M-14"]')).toBeVisible({ timeout: 5000 });
    await expect(sacha.platform.locator('[data-message="M-14"]')).toBeVisible({ timeout: 5000 });
    await expect(sacha.platform.locator('[data-message="M-14"]')).toContainText(
      'Essai du pont a rencontré un problème',
    );
    await expect(camille.platform.getByTestId('ecran-salon-hote')).toBeVisible();
    await camille.platform.screenshot({ path: path.join(SCREENSHOTS, 'plantage-salon.png') });
    await camille.platform.getByTestId('arret-jeu-compris').click();
    await sacha.platform.getByTestId('arret-jeu-compris').click();

    // Jeu figé chez l'invité (boucle infinie): détecté par le battement de cœur en 5 s.
    await camille.platform.getByTestId('salon-pret').click();
    await expect(sacha.platform.getByTestId('salon-pret')).toBeVisible();
    await sacha.platform.getByTestId('salon-pret').click();
    [gameCamille, gameSacha] = await Promise.all([gamePage(camille), gamePage(sacha)]);
    await expect.poll(async () => (await essai(gameSacha)).started, { timeout: 15_000 }).toBe(true);
    const frozenAt = Date.now();
    await gameSacha.keyboard.press('KeyK').catch(() => undefined);
    await expect(sacha.platform.locator('[data-message="M-14"]')).toBeVisible({ timeout: 10_000 });
    await expect(camille.platform.locator('[data-message="M-14"]')).toBeVisible({ timeout: 5000 });
    expect(Date.now() - frozenAt).toBeLessThan(10_000);
    await camille.platform.screenshot({ path: path.join(SCREENSHOTS, 'jeu-fige-salon.png') });
    await expect
      .poll(
        () => camille.app.windows().filter((page) => page.url().startsWith('duo-game://')).length,
      )
      .toBe(0);
  } finally {
    await closeDuo(sacha);
    await closeDuo(camille);
  }
});
