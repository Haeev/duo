// La Petite Ligne dans Duo, à deux instances (tour 8, T8-01, T8-02, G3): l'hôte continue la vraie
// sauvegarde du jour 15 finie (format 4, celle du client), l'écran d'étape « Deux semaines »
// s'ouvre chez les deux, chacun choisit « Rester à la Halte » sur sa machine, et la journée
// reprend chez les deux. Le jeu doit être construit (`pnpm --filter @duo/la-petite-ligne build`).
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { APP_DIR, SCREENSHOTS, closeDuo, gamePage, launchDuo, seedProfile, tempDataDir } from './duo';

const GAME = path.resolve(APP_DIR, '..', '..', 'games', 'la-petite-ligne');
const REFERENCE = path.join(GAME, 'tests', 'donnees', 'sauvegardes', 'format-4-fin-de-la-demo.json');

/** Écrit la sauvegarde de référence dans l'emplacement 1 de l'hôte, comme la plateforme l'écrit. */
async function seedSave(dataDir: string): Promise<void> {
  const ref = JSON.parse(await readFile(REFERENCE, 'utf8')) as {
    label: string;
    progress: number | null;
    dataSchema: number;
    data: unknown;
  };
  const manifest = JSON.parse(await readFile(path.join(GAME, 'duo-game.json'), 'utf8')) as {
    version: string;
  };
  const bytes = Buffer.from(JSON.stringify(ref.data), 'utf8');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const slot = path.join(dataDir, 'sauvegardes-locales', 'la-petite-ligne', '1');
  await mkdir(slot, { recursive: true });
  await writeFile(path.join(slot, `${sha256}.json`), bytes);
  await writeFile(
    path.join(slot, 'head.json'),
    JSON.stringify({
      schema: 1,
      revision: 1,
      sha256,
      label: ref.label.slice(0, 40),
      progress: ref.progress === null ? null : Math.min(1, ref.progress),
      dataSchema: ref.dataSchema,
      gameVersion: manifest.version,
      size: bytes.byteLength,
      writtenAt: new Date().toISOString(),
      previous: [],
    }),
  );
}

/** Clic dans la page du jeu sans attendre de navigation (rendu logiciel: une image par seconde). */
async function clickIn(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().evaluate((node) => {
    (node as HTMLElement).click();
  });
}

test('jour 15 fini: écran d’étape chez les deux, « Rester » des deux côtés, la journée reprend', async () => {
  test.setTimeout(300_000);
  const camilleDir = await tempDataDir('Camille');
  const sachaDir = await tempDataDir('Sacha');
  await seedProfile(camilleDir, 'Camille', 'orb');
  await seedProfile(sachaDir, 'Sacha', 'crescent');
  await seedSave(camilleDir);
  const gameQuery = 'rendu=leger';
  const camille = await launchDuo({ dataDir: camilleDir, port: 41430, peerPort: 41435, gameQuery });
  const sacha = await launchDuo({ dataDir: sachaDir, port: 41435, peerPort: 41430, gameQuery });
  try {
    await expect(camille.platform.getByTestId('presence-barre')).toContainText('Sacha est là', {
      timeout: 15_000,
    });
    await camille.platform.getByTestId('onglet-bibliotheque').click();
    await camille.platform.getByTestId('jeu-la-petite-ligne').click();
    await expect(camille.platform.getByTestId('ecran-salon-hote')).toBeVisible();
    // Le salon propose de continuer la sauvegarde de l'hôte (libellé de la sauvegarde du jour 15).
    await expect(camille.platform.getByTestId('sauvegarde-continue')).toBeChecked();
    await sacha.platform.getByTestId('invitation-rejoindre').click();
    await expect(sacha.platform.getByTestId('ecran-salon-invite')).toBeVisible();
    await expect(sacha.platform.getByTestId('salon-sauvegarde-invite')).toBeVisible();
    await camille.platform.screenshot({ path: path.join(SCREENSHOTS, 'lpl-etape-salon-hote.png') });
    await camille.platform.getByTestId('salon-pret').click();
    await expect(sacha.platform.getByTestId('decompte')).toBeVisible();

    const [gameCamille, gameSacha] = await Promise.all([gamePage(camille), gamePage(sacha)]);
    const stage = '.lpl-screen--stage';
    for (const page of [gameCamille, gameSacha]) {
      await expect(page.locator(stage)).toBeVisible({ timeout: 120_000 });
      await expect(page.locator(stage)).toContainText('Deux semaines à la Halte d’Aubrune');
      await expect(page.locator(`${stage} [data-choice="stay"]`)).toBeVisible();
      await expect(page.locator(`${stage} [data-choice="finish"]`)).toBeVisible();
    }
    await gameCamille.screenshot({ path: path.join(SCREENSHOTS, 'lpl-etape-hote.png') });
    await gameSacha.screenshot({ path: path.join(SCREENSHOTS, 'lpl-etape-invitee.png') });

    // Un seul choix: rien ne se passe, l'autre voit « Veut rester ».
    await clickIn(gameCamille, `${stage} [data-choice="stay"]`);
    await expect(gameCamille.locator(`${stage} [data-choice="stay"]`)).toHaveAttribute('aria-pressed', 'true', {
      timeout: 20_000,
    });
    await expect(gameSacha.locator(stage)).toContainText('Veut rester', { timeout: 20_000 });
    await expect(gameSacha.locator(stage)).toBeVisible();
    await gameSacha.screenshot({ path: path.join(SCREENSHOTS, 'lpl-etape-invitee-un-choix.png') });

    // Les deux « Rester »: l'écran se ferme chez les deux, la notification arrive, l'horloge repart.
    await clickIn(gameSacha, `${stage} [data-choice="stay"]`);
    for (const page of [gameCamille, gameSacha]) {
      await expect(page.locator(stage)).toBeHidden({ timeout: 30_000 });
      await expect(page.locator('body')).toContainText('La Halte continue', { timeout: 30_000 });
    }
    const clock = gameCamille.locator('.lpl-clock__time');
    const first = (await clock.textContent()) ?? '';
    await expect.poll(async () => (await clock.textContent()) ?? '', { timeout: 60_000 }).not.toBe(first);
    await expect(gameSacha.locator('.lpl-clock__time')).not.toHaveText('', { timeout: 10_000 });
    await gameCamille.screenshot({ path: path.join(SCREENSHOTS, 'lpl-etape-reprise-hote.png') });
    await gameSacha.screenshot({ path: path.join(SCREENSHOTS, 'lpl-etape-reprise-invitee.png') });
    test.info().annotations.push({
      type: 'horloge',
      description: `hôte ${first} puis ${(await clock.textContent()) ?? ''}; invitée ${(await gameSacha.locator('.lpl-clock__time').textContent()) ?? ''}`,
    });
  } finally {
    await closeDuo(sacha);
    await closeDuo(camille);
  }
});
