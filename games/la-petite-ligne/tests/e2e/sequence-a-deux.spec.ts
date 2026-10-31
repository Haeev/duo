// Recette de la démo (qa-testeur, 2026-10-31): une séquence complète à deux navigateurs dans le faux
// hôte, comme le Mac (hôte) et le PC (invité) sur le réseau local. Création des deux personnages,
// scène d'arrivée, déplacement au clavier, bêchage d'une case du potager, pause par Échap et reprise.
import { expect, test, type Locator } from '@playwright/test';
import { characterOf, longTasks, positionOf, startDuo, walkAlong } from './sonde';

/** Clic DOM direct: le rendu logiciel occupe le fil principal, l'attente de navigation de Playwright expire. */
async function press(target: Locator): Promise<void> {
  await target.waitFor();
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
    await press(hostGame.getByRole('button', { name: 'C’est prêt' }));
    await expect(hostGame.getByText(`En attente de ${GUEST}…`)).toBeVisible();
    await press(guestGame.getByRole('button', { name: 'C’est prêt' }));
    let w = await probe.until('les deux personnages créés', (s) => s.characters.every((c) => c.created));
    expect(characterOf(w, HOST).appearance.hair).toBe(2);
    expect(characterOf(w, GUEST).appearance.outfit).toBe(2);
    expect(characterOf(w, GUEST).name).toBe(GUEST);

    // Arrivée: scène à deux avec Firmin, l'horloge arrêtée tant qu'elle dure.
    w = await probe.until('scène d’arrivée', (s) => s.scene?.dialogue === 'firmin_arrival');
    expect(w.clock.running).toBe(false);
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
    const before = positionOf(probe, guestId);
    expect(before).not.toBeNull();
    await walkAlong(guest, probe, guestId, [{ x: (before?.x ?? 0) - 3, y: before?.y ?? 0 }], 0.6);
    const after = positionOf(probe, guestId);
    expect((before?.x ?? 0) - (after?.x ?? 0)).toBeGreaterThan(2);

    // Potager, chez l'hôte: marcher jusqu'au nord de la case (9, 28), face au sud, houe en main, Espace.
    await press(hostGame.getByRole('region', { name: 'Prochain objectif' }));
    await walkAlong(host, probe, hostId, [
      { x: 30.5, y: 16.5 },
      { x: 13.5, y: 16.5 },
      { x: 13.5, y: 27.4 },
      { x: 9.5, y: 27.4 },
    ]);
    // Un pas vers le sud pour viser la case du potager.
    await host.keyboard.down('KeyS');
    await host.keyboard.down('KeyA');
    await host.waitForTimeout(120);
    await host.keyboard.up('KeyS');
    await host.keyboard.up('KeyA');
    await host.keyboard.press('Space');
    w = await probe.until('une case du potager bêchée', (s) => s.garden.some((g) => g.soil !== 'grass'), 30_000);
    expect(probe.events.some((e) => e.type === 'tilled')).toBe(true);
    await shot('2-potager');

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
