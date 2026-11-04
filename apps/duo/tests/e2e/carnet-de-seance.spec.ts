// Carnet de séance (pont 1.1): dans La Petite Ligne, Ctrl+N ouvre une note, Entrée l'enregistre,
// et le principal écrit la note, l'état et les images des 10 s d'avant et d'après dans un dossier
// au nom difficile (espaces, accents). Échap, vraie touche du système, annule la note sans ouvrir
// la pause. Le carnet n'existe que sous macOS: ici, la version de test l'active chez Camille
// seulement par `DUO_TEST_CARNET_DIR`; chez Sacha (Linux), il reste inerte.
// Le jeu doit être construit (`pnpm --filter @duo/la-petite-ligne build`).
import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises';
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

/** Le principal sait que la note est ouverte (journal): Échap lui échappe désormais. */
async function typingKnown(dataDir: string, count: number): Promise<boolean> {
  const dir = path.join(dataDir, 'logs');
  let seen = 0;
  for (const file of await readdir(dir)) {
    const text = await readFile(path.join(dir, file), 'utf8');
    seen += text.split('"event":"notebook-typing","details":{"active":true}').length - 1;
  }
  return seen >= count;
}

test("carnet de séance: note, état et images des 10 s d'avant et d'après", async () => {
  test.setTimeout(240_000);
  const base = process.env.CARNET_E2E_DIR ?? (await mkdtemp(path.join(tmpdir(), 'duo-carnet-')));
  const carnet = path.join(base, 'Documents de Hélène', 'Duo', 'carnet-de-seance');
  const camilleDir = await tempDataDir('Camille');
  const sachaDir = await tempDataDir('Sacha');
  await seedProfile(camilleDir, 'Camille', 'orb');
  await seedProfile(sachaDir, 'Sacha', 'crescent');
  const gameQuery = 'rendu=leger';
  const camille = await launchDuo({
    dataDir: camilleDir,
    port: 41420,
    peerPort: 41425,
    gameQuery,
    env: { DUO_TEST_CARNET_DIR: carnet },
  });
  const sacha = await launchDuo({ dataDir: sachaDir, port: 41425, peerPort: 41420, gameQuery });
  // Deux rendus 3D en logiciel sur les quatre cœurs du cloud finissent par figer une page plus de
  // 8 s (chien de garde): petites fenêtres, surtout celle de Sacha, qui ne sert qu'à jouer à deux.
  for (const [instance, width, height] of [
    [camille, 480, 300],
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
    await camille.platform.getByTestId('jeu-la-petite-ligne').click();
    await sacha.platform.getByTestId('invitation-rejoindre').click();
    await camille.platform.getByTestId('salon-pret').click();
    const [game, gameSacha] = await Promise.all([gamePage(camille), gamePage(sacha)]);
    // Fenêtre de Sacha cachée: sa page ne dessine plus (simulation au minuteur du SDK).
    await sacha.app.evaluate(({ BaseWindow }) => {
      BaseWindow.getAllWindows()[0]?.hide();
    });

    // Le carnet s'annonce chez Camille dès que le rendu est prêt; jamais chez Sacha.
    await expect(game.getByTestId('carnet-avis')).toContainText('Ctrl+N', { timeout: 60_000 });
    await expect(game.locator('#jeu canvas')).toBeVisible();
    // Le tampon se remplit: quelques secondes d'images avant la note (le carnet en garde 10).
    await game.waitForTimeout(4_000);
    expect(await gameSacha.getByTestId('carnet-avis').count()).toBe(0);

    // Une vraie note, ouverte par une vraie touche (le principal prend alors l'écran avant que
    // la zone de saisie ne s'affiche); le jeu continue pendant la saisie.
    await pressNativeKey(camille, 'ctrl+n');
    await expect(game.getByTestId('carnet-texte')).toBeFocused();
    await game.screenshot({ path: path.join(SCREENSHOTS, 'carnet-saisie.png') });
    // Texte inséré d'un coup: dans le cloud, une longue frappe touche par touche fige la page du
    // jeu en rendu logiciel, carnet ou non (constaté sur une zone de saisie ordinaire).
    await game.keyboard.type('Le ');
    await game.keyboard.insertText("personnage traverse la clôture près de l'étal, à vérifier.");
    await game.keyboard.press('Enter');
    await expect(game.getByTestId('carnet-note')).toHaveCount(0);
    await expect(game.getByTestId('carnet-avis')).toContainText('Note enregistrée');

    // Échap, vraie touche: annule la note, sans pause de la plateforme.
    await game.keyboard.press('Control+KeyN');
    await expect(game.getByTestId('carnet-note')).toBeVisible();
    // En rendu logiciel, le message du jeu peut mettre une demi-seconde à atteindre le principal.
    await expect.poll(() => typingKnown(camilleDir, 2), { timeout: 10_000 }).toBe(true);
    await pressNativeKey(camille, 'Escape');
    await expect(game.getByTestId('carnet-note')).toHaveCount(0);
    await expect(game.getByTestId('carnet-avis')).toContainText('Note annulée');
    await expect(camille.platform.getByTestId('superposition-pause')).toHaveCount(0);

    // Les images d'après arrivent 10 s plus tard, avec la planche.
    await expect
      .poll(
        async () => {
          const [note] = await listNotes(carnet);
          if (note === undefined) return false;
          return stat(path.join(note, 'planche.jpg')).then(
            () => true,
            () => false,
          );
        },
        { timeout: 30_000, intervals: [500] },
      )
      .toBe(true);
    await expect(game.getByTestId('carnet-avis')).toContainText('Note complète');

    const notes = await listNotes(carnet);
    expect(notes).toHaveLength(1);
    const [folder] = notes;
    if (folder === undefined) throw new Error('aucune note');
    expect(path.basename(folder)).toMatch(/^\d{2}h\d{2}m\d{2}s-la-petite-ligne$/);
    // Écrans entiers (interface du jeu comprise) pris par la plateforme.
    await stat(path.join(folder, 'ecran-ouverture.jpg'));
    await stat(path.join(folder, 'ecran-fin.jpg'));
    const text = await readFile(path.join(folder, 'note.txt'), 'utf8');
    expect(text).toContain("Le personnage traverse la clôture près de l'étal, à vérifier.");
    expect(text).toMatch(/Dans le jeu à l'ouverture: Jour \d+, \d+ h \d{2}/);
    const state = JSON.parse(await readFile(path.join(folder, 'etat.json'), 'utf8')) as {
      jeu: string;
      etatOuverture: { personnages: unknown[]; horloge: { day: number } };
    };
    expect(state.jeu).toMatch(/^La Petite Ligne \d+\.\d+\.\d+$/);
    expect(state.etatOuverture.personnages).toHaveLength(2);
    const platformInfo = JSON.parse(
      await readFile(path.join(folder, 'plateforme.json'), 'utf8'),
    ) as { duo: string; jeu: { id: string } };
    expect(platformInfo.jeu.id).toBe('la-petite-ligne');
    const index = JSON.parse(await readFile(path.join(folder, 'images.json'), 'utf8')) as {
      fichier: string;
      phase: string;
    }[];
    const images = await readdir(path.join(folder, 'images'));
    expect(images.length).toBe(index.length);
    for (const entry of index) expect(images).toContain(path.basename(entry.fichier));
    const phases = new Set(index.map((entry) => entry.phase));
    expect(phases.has('avant')).toBe(true);
    expect(phases.has('apres')).toBe(true);
    expect(await readFile(path.join(carnet, 'LISEZMOI.txt'), 'utf8')).toContain('Carnet de séance');
    test.info().annotations.push({
      type: 'carnet',
      description: `${folder}: ${String(images.length)} images (${[...phases].join(', ')})`,
    });
  } finally {
    await closeDuo(sacha);
    await closeDuo(camille);
  }
});
