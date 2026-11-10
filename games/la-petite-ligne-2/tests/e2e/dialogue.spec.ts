// P01 dialogue complet avec une habitante, P02 bulle d'action accrochée, P03 immobile pendant le
// dialogue (CA-15, CA-26, CA-14). Données: `essai-gare`, la cheffe de gare au guichet.
import { expect, test } from '@playwright/test';
import { distance, startDuo } from '../aides-e2e/duo';

const VILLAGER = { x: 20, y: 15 };
const NORTH = -Math.PI / 2;

test('dialogue complet, bulle accrochée, joueur immobile', async ({ browser }) => {
  const duo = await startDuo(browser, 'p01-dialogue');
  const { host, guest } = duo;
  const me = await host.local();
  await duo.teleport(me, VILLAGER.x, VILLAGER.y + 1, NORTH);

  // P02: la cible et son verbe avant l'appui, la bulle accrochée près de l'habitante.
  await expect.poll(async () => (await host.aim(me))?.verb ?? null).not.toBeNull();
  const prompt = host.game().locator('.lpl-ui .prompt');
  await expect(prompt).toBeVisible();
  await host.shot('1-bulle');
  const anchored = await prompt.evaluate((n) => n.classList.contains('prompt--anchored'));
  expect(anchored, 'bulle accrochée à l’objet (prompt--anchored)').toBe(true);

  // P01: ouvrir le dialogue.
  await host.press('Space');
  const box = host.game().locator('.lpl-ui .dialogue');
  await expect(box).toBeVisible();
  await duo.until(host, 'dialogue ouvert', (w) => w.players[me]?.talk !== null);
  await host.page.waitForTimeout(1500);
  await host.shot('2-dialogue');
  await guest.shot('2-dialogue-vu-par-invite');

  // P03: Z maintenu pendant le dialogue ne déplace pas le personnage.
  const before = (await host.world())?.players[me];
  await host.press('KeyW', 1500);
  const after = (await host.world())?.players[me];
  expect(before !== undefined && after !== undefined).toBe(true);
  if (before !== undefined && after !== undefined)
    expect(
      distance(after, before.body.x, before.body.y),
      'immobile pendant le dialogue',
    ).toBeLessThan(0.05);

  // Avancer jusqu'au choix (Espace finit la ligne puis passe à la suivante).
  const choices = host.game().locator('.lpl-ui .choice');
  for (let i = 0; i < 8 && !(await choices.first().isVisible()); i++) {
    await host.press('Space');
    await host.page.waitForTimeout(700);
  }
  await expect(choices.first()).toBeVisible();
  await host.shot('3-choix');
  await host.press('Enter');
  // Le premier choix donne la besace: l'invité le voit aussi (état de l'hôte).
  await duo.until(host, 'besace reçue', (w) => w.players[me]?.bag !== null);
  await duo.until(guest, 'besace vue chez l’invité', (w) => w.players[me]?.bag !== null);
  for (let i = 0; i < 8 && (await box.isVisible()); i++) {
    await host.press('Space');
    await host.page.waitForTimeout(700);
  }
  await expect(box).toBeHidden();
  await duo.until(host, 'dialogue fermé', (w) => w.players[me]?.talk === null);
  await host.shot('4-fin');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
