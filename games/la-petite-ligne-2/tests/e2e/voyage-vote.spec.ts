// P16 trajet en train à deux: un seul vote ne passe pas le trajet, les deux votes le passent, et
// les deux joueurs arrivent dans l'autre lieu (CA-01). Court: moins de 60 s de jeu.
import { expect, test } from '@playwright/test';
import { BOARDING, startDuo } from '../aides-e2e/duo';

test('trajet en train: vote des deux joueurs puis arrivée à la halte', async ({ browser }) => {
  const duo = await startDuo(browser, 'p16-voyage-vote');
  const { host, guest } = duo;
  const [hi, gi] = [await host.local(), await guest.local()];
  const { stand, facing } = BOARDING['essai-gare'] ?? { stand: [], facing: 0 };
  await duo.teleport(hi, stand[0]?.x ?? 0, stand[0]?.y ?? 0, facing);
  await duo.teleport(gi, stand[1]?.x ?? 0, stand[1]?.y ?? 0, facing);
  // Chacun voit sa cible (« Monter ») avant d'appuyer: les positions arrivent chez l'invité en 1 à 2 s.
  for (const [side, index] of [
    [host, hi],
    [guest, gi],
  ] as const)
    await expect
      .poll(async () => (await side.aim(index))?.verb ?? null, { timeout: 20_000 })
      .not.toBeNull();
  const departure = Date.now();
  await host.press('Space');
  await guest.press('Space');
  await duo.until(host, 'départ du train', (w) => w.common.phase === 'travel', 15_000);
  await duo.until(guest, 'départ vu par l’invité', (w) => w.common.phase === 'travel', 15_000);
  await host.page.waitForTimeout(500);
  await host.shot('1-en-route');

  // Un seul vote (touche d'action) ne passe pas le trajet: la bulle attend l'autre.
  await host.press('Space');
  const waiting = await duo.until(
    host,
    'vote de l’hôte compté',
    (w) => w.common.travel?.skip?.[hi] === true,
    10_000,
  );
  expect(waiting.common.travel?.skip?.[gi], 'l’invité n’a pas voté').toBe(false);
  await host.page.waitForTimeout(1500);
  expect((await host.world())?.common.phase, 'un seul vote: on reste en route').toBe('travel');
  await host.shot('2-un-seul-vote');

  // Le second vote passe le trajet; les deux arrivent à la halte.
  await guest.press('Space');
  await duo.until(
    host,
    'arrivée de l’hôte',
    (w) => w.common.place === 'essai-halte' && w.common.phase !== 'travel',
    60_000,
  );
  await duo.until(
    guest,
    'arrivée de l’invité',
    (w) => w.common.place === 'essai-halte' && w.common.phase !== 'travel',
    15_000,
  );
  const seconds = (Date.now() - departure) / 1000;
  expect(seconds, 'trajet voté plus court que le trajet entier (60 s au pire)').toBeLessThan(60);
  await host.page.waitForTimeout(1200);
  await host.shot('3-arrivee');
  await guest.shot('3-arrivee');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
