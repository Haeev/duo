// Recette de la démo (qa-testeur, 2026-10-31): une séquence complète à deux navigateurs dans le faux
// hôte, comme le Mac (hôte) et le PC (invité) sur le réseau local. Création des deux personnages,
// scène d'arrivée, déplacement au clavier, bêchage d'une case du potager, pause par Échap et reprise.
import { expect, test, type Locator } from '@playwright/test';
import { characterOf, holdKeys, longTasks, newWalker, northKeys, positionOf, settledPosition, southKeys, START_YAW, startDuo, walkAlong, westKeys } from './sonde';

/** Clic DOM direct: le rendu logiciel occupe le fil principal, l'attente de navigation de Playwright expire. */
async function press(target: Locator): Promise<void> {
  await target.waitFor({ timeout: 90_000 });
  await target.evaluate((node) => {
    (node as HTMLElement).click();
  });
}

const HOST = 'Loïc';
/** Pseudo accentué, avec trait d'union, à la limite des 16 caractères. */
const GUEST = 'Zoé-Hélène Ærøy';

test('séquence à deux: création, arrivée, déplacement, potager, pause et reprise', async ({ browser }, testInfo) => {
  const duo = await startDuo(browser, { hostName: HOST, guestName: GUEST });
  const { host, guest, hostGame, guestGame, probe } = duo;
  const shot = async (name: string): Promise<void> => {
    await host.screenshot({ path: testInfo.outputPath(`${name}-hote.png`) });
    await guest.screenshot({ path: testInfo.outputPath(`${name}-invite.png`) });
  };

  try {
    // Écran titre: la semaine ne commence que quand les deux ont choisi.
    await press(hostGame.getByRole('button', { name: 'Commencer la semaine' }));
    await expect(guestGame.getByText('C’est parti')).toBeVisible();
    await press(guestGame.getByRole('button', { name: 'Commencer la semaine' }));

    // Création, chacun sur sa machine: coiffure « Nouée » chez l'hôte, tenue « Sauge » chez l'invité.
    await press(hostGame.getByText('Nouée', { exact: true }));
    await press(guestGame.getByText('Sauge', { exact: true }));
    await expect(guestGame.getByRole('textbox', { name: 'Prénom' })).toHaveValue(GUEST);
    await press(hostGame.getByRole('button', { name: /^C’est parti/ }));
    await expect(hostGame.getByText(`En attente de ${GUEST}…`)).toBeVisible();
    await press(guestGame.getByRole('button', { name: /^C’est parti/ }));
    let w = await probe.until('les deux personnages créés', (s) => s.characters.every((c) => c.created));
    expect(characterOf(w, HOST).appearance.hair).toBe(2);
    // 0.12: la tenue de départ 2 (la salopette), portée et seule dans la garde-robe.
    expect(characterOf(w, GUEST).wardrobe).toHaveLength(3);
    expect(characterOf(w, GUEST).name).toBe(GUEST);

    // Arrivée: scène à deux avec Firmin, l'horloge arrêtée tant qu'elle dure.
    // Le premier état de la scène peut précéder d'un pas l'arrêt de l'horloge: on attend l'arrêt.
    w = await probe.until('scène d’arrivée, horloge arrêtée', (s) => s.scene?.dialogue === 'firmin_arrival' && !s.clock.running, 30_000);
    await expect(hostGame.getByRole('region', { name: 'Firmin Lacombe' })).toBeVisible();
    await expect(guestGame.getByRole('region', { name: 'Firmin Lacombe' })).toBeVisible();
    await shot('1-arrivee');
    // Répliques: « Suite » tant qu'il y en a, puis chacun choisit sa réponse (la première proposée).
    for (let i = 0; i < 16 && probe.world()?.scene !== null; i++) {
      for (const game of [hostGame, guestGame]) {
        const button = game.getByRole('region', { name: 'Firmin Lacombe' }).getByRole('button').first();
        if (await button.isVisible()) await press(button);
      }
      await host.waitForTimeout(1000);
    }
    w = await probe.until('fin de la scène d’arrivée, horloge en marche', (s) => s.scene === null && s.clock.running, 90_000);
    expect(w.phase).toBe('day');

    // Déplacement au clavier chez l'invité (Z et Q d'un clavier AZERTY: codes KeyW et KeyA), vers l'ouest.
    const guestId = characterOf(w, GUEST).id;
    const hostId = characterOf(w, HOST).id;
    await press(guestGame.getByRole('region', { name: 'Prochain objectif' }));
    const before = await settledPosition(guest, probe, guestId);
    expect(before).not.toBeNull();
    await holdKeys(guest, westKeys(START_YAW), 1500);
    const after = await settledPosition(guest, probe, guestId);
    expect((before?.x ?? 0) - (after?.x ?? 0), 'l’invité avance vers l’ouest').toBeGreaterThan(1);

    // Pause par Échap chez l'invité: les deux en pause, l'horloge ne bouge plus; reprise à deux.
    await guestGame.locator('body').press('Escape');
    await expect(guest.locator('.vue')).toHaveAttribute('data-statut', 'paused');
    await expect(host.locator('.vue')).toHaveAttribute('data-statut', 'paused');
    const pausedTick = probe.fast()?.tick ?? -1;
    await host.waitForTimeout(3000);
    expect(probe.fast()?.tick).toBe(pausedTick);
    await shot('3-pause');
    await press(host.getByRole('button', { name: 'Reprendre' }));
    await expect(host.locator('.vue')).toHaveAttribute('data-statut', 'running');
    await expect(guest.locator('.vue')).toHaveAttribute('data-statut', 'running');
    await expect.poll(() => probe.fast()?.tick ?? -1, { timeout: 20_000 }).toBeGreaterThan(pausedTick);

    // Potager, chez l'hôte (cases x = 7 à 10, y = 28 à 30). Accès par l'ouest puis le sud: au nord,
    // la porte en chantier, à l'est, le poulailler en chantier, sont visés avant les cases (constaté).
    await press(hostGame.getByRole('region', { name: 'Prochain objectif' }));
    const walker = newWalker();
    await walkAlong(
      host,
      probe,
      hostId,
      [
        { x: 34.5, y: 17.0, tolerance: 1.5 },
        { x: 3.6, y: 17.0, tolerance: 1.0 },
        { x: 3.6, y: 31.6, tolerance: 1.0 },
        { x: 9.0, y: 31.6, tolerance: 0.9 },
      ],
      0.9,
      480_000,
      walker,
    );
    // Vrai clic sur le HUD (pas un clic DOM): le cadre du jeu reprend le focus clavier après la pause.
    await hostGame.getByRole('region', { name: 'Prochain objectif' }).click({ noWaitAfter: true, timeout: 60_000 });
    // Un pas vers le nord, puis Espace quand la case devant (au nord) est du potager.
    // En rendu logiciel, un appui bref fait déjà plusieurs mètres: on corrige pas à pas.
    let lastStep: 'north' | 'south' | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const at = await settledPosition(host, probe, hostId);
      const x = at?.x ?? 0;
      const y = at?.y ?? 0;
      if (lastStep === 'north' && x >= 7 && x < 11 && y >= 28.6 && y < 32) {
        // Appui long: une image peut durer plus d'une seconde, un appui plus bref passe inaperçu.
        await holdKeys(host, ['Space'], 2000);
        await settledPosition(host, probe, hostId);
        if (probe.world()?.garden.some((g) => g.soil !== 'grass') === true) break;
      }
      lastStep = y > 30 || lastStep === null ? 'north' : 'south';
      await holdKeys(host, lastStep === 'north' ? northKeys(walker.yaw) : southKeys(walker.yaw), 900);
    }
    if (probe.world()?.garden.every((g) => g.soil === 'grass') === true) {
      const at = positionOf(probe, hostId);
      const recent = probe.events.slice(-10).map((e) => e.type);
      throw new Error(`Aucune case bêchée: hôte en (${at?.x.toFixed(2)}, ${at?.y.toFixed(2)}), derniers événements ${recent.join(', ')}`);
    }
    w = await probe.until('une case du potager bêchée', (s) => s.garden.some((g) => g.soil !== 'grass'), 60_000);
    expect(probe.events.some((e) => e.type === 'tilled')).toBe(true);
    await shot('2-potager');

    // Ni erreur de page, ni ressource manquante, et l'état tient dans 64 Kio (ADR 0007).
    expect(probe.maxWorldBytes()).toBeLessThan(64 * 1024);
    expect(duo.errors).toEqual([]);
  } finally {
    const tasks = [...(await longTasks(host)), ...(await longTasks(guest))];
    testInfo.annotations.push({
      type: 'tâche longue la plus longue (ms)',
      description: String(Math.max(0, ...tasks.map(([, d]) => d))),
    });
    await duo.close();
  }
});
