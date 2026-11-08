// Carnet de séance dans Deux Tabliers (pont 1.1): même parcours court que La Petite Ligne
// (`carnet-de-seance.spec.ts`), sur la note habillée par le jeu: Ctrl+N, vraie touche, ouvre la
// note, Entrée l'enregistre avec la légende et l'état du café; Échap l'annule sans pause.
// Le jeu doit être construit (`pnpm --filter deux-tabliers build`).
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  SCREENSHOTS,
  closeDuo,
  gamePage,
  launchDuo,
  pressNativeKey,
  seedProfile,
  tempDataDir,
} from './duo';

async function listNotes(root: string): Promise<string[]> {
  const days = await readdir(root).catch(() => [] as string[]);
  const notes: string[] = [];
  for (const day of days.filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))) {
    for (const note of await readdir(path.join(root, day))) notes.push(path.join(root, day, note));
  }
  return notes;
}

test('carnet de séance dans Deux Tabliers: note habillée, légende et état du café', async () => {
  test.setTimeout(240_000);
  const base = await mkdtemp(path.join(tmpdir(), 'duo-carnet-dt-'));
  const carnet = path.join(base, 'Documents de Hélène', 'Duo', 'carnet-de-seance');
  const camilleDir = await tempDataDir('Camille');
  const sachaDir = await tempDataDir('Sacha');
  await seedProfile(camilleDir, 'Camille', 'orb');
  await seedProfile(sachaDir, 'Sacha', 'crescent');
  const camille = await launchDuo({
    dataDir: camilleDir,
    port: 41440,
    peerPort: 41445,
    env: { DUO_TEST_CARNET_DIR: carnet },
  });
  const sacha = await launchDuo({ dataDir: sachaDir, port: 41445, peerPort: 41440 });
  for (const [instance, width, height] of [
    [camille, 800, 500],
    [sacha, 320, 200],
  ] as const) {
    await instance.app.evaluate(
      ({ BaseWindow }, size) => {
        const window = BaseWindow.getAllWindows()[0];
        window?.setMinimumSize(200, 150);
        window?.setSize(size.width, size.height);
      },
      { width, height },
    );
  }
  try {
    await expect(camille.platform.getByTestId('presence-barre')).toContainText('Sacha est là', {
      timeout: 10_000,
    });
    await camille.platform.getByTestId('onglet-bibliotheque').click();
    await camille.platform.getByTestId('jeu-deux-tabliers').click();
    await sacha.platform.getByTestId('invitation-rejoindre').click();
    await camille.platform.getByTestId('salon-pret').click();
    const [game] = await Promise.all([gamePage(camille), gamePage(sacha)]);
    await sacha.app.evaluate(({ BaseWindow }) => {
      BaseWindow.getAllWindows()[0]?.hide();
    });

    await expect(game.getByTestId('carnet-avis')).toContainText('Ctrl+N', { timeout: 90_000 });
    await game.waitForTimeout(3_000);

    await pressNativeKey(camille, 'ctrl+n');
    await expect(game.getByTestId('carnet-texte')).toBeFocused();
    // Habillage du café: fond expresso, texte crème, police du jeu.
    const look = await game.getByTestId('carnet-note').evaluate((node) => {
      const style = getComputedStyle(node);
      return { background: style.backgroundColor, color: style.color, font: style.fontFamily };
    });
    expect(look.background).toBe('rgb(43, 33, 28)');
    expect(look.color).toBe('rgb(246, 238, 223)');
    expect(look.font).toContain('DM Sans');
    await game.screenshot({ path: path.join(SCREENSHOTS, 'carnet-deux-tabliers.png') });
    // E et Entrée de la note ne vont pas au jeu: le texte les garde.
    await game.keyboard.type('Le ');
    await game.keyboard.insertText('client traverse la banquette, à revoir.');
    await game.keyboard.press('Enter');
    await expect(game.getByTestId('carnet-note')).toHaveCount(0);
    await expect(game.getByTestId('carnet-avis')).toContainText('Note enregistrée');

    await pressNativeKey(camille, 'ctrl+n');
    await expect(game.getByTestId('carnet-note')).toBeVisible();
    await game.waitForTimeout(1_000);
    await pressNativeKey(camille, 'Escape');
    await expect(game.getByTestId('carnet-note')).toHaveCount(0);
    await expect(game.getByTestId('carnet-avis')).toContainText('Note annulée');
    await expect(camille.platform.getByTestId('superposition-pause')).toHaveCount(0);

    await expect.poll(async () => (await listNotes(carnet)).length, { timeout: 30_000 }).toBe(1);
    const [folder] = await listNotes(carnet);
    if (folder === undefined) throw new Error('aucune note');
    expect(path.basename(folder)).toMatch(/-deux-tabliers$/);
    const text = await readFile(path.join(folder, 'note.txt'), 'utf8');
    expect(text).toContain('Le client traverse la banquette, à revoir.');
    expect(text).toMatch(
      /Dans le jeu à l'ouverture: (Jour \d+, \w+, \d+ h \d{2}|Avant le premier)/,
    );
    expect(text).toContain('téléphone');
    const state = JSON.parse(await readFile(path.join(folder, 'etat.json'), 'utf8')) as {
      jeu: string;
      etatOuverture: { jour: number; clients: unknown[]; tickets: unknown[]; caisse: string };
    };
    expect(state.jeu).toMatch(/^Deux Tabliers \d+\.\d+\.\d+$/);
    expect(state.etatOuverture.caisse).toMatch(/€$/);
    expect(Array.isArray(state.etatOuverture.clients)).toBe(true);
    test.info().annotations.push({ type: 'carnet', description: `${folder}: ${text}` });
  } finally {
    await closeDuo(sacha);
    await closeDuo(camille);
  }
});
