// P07 coup d'œil fermé après 3 s (CA-33), P08 immobile pendant le carnet, P09 coffre commun
// depuis la gare (CA-20), P10 poussée entre joueurs.
import { expect, test } from '@playwright/test';
import { distance, startDuo } from '../aides-e2e/duo';

test('coup d’œil, carnet immobile, coffre commun, poussée', async ({ browser }) => {
  const duo = await startDuo(browser, 'p07-interface');
  const { host, guest } = duo;
  const hi = await host.local();
  const gi = await guest.local();

  // P07: G affiche le coup d'œil, qui disparaît seul en 3 s (marge de 1,5 s en rendu logiciel).
  await guest.press('KeyG');
  const glance = guest.game().locator('.lpl-ui .glance');
  await expect(glance).toBeVisible({ timeout: 3_000 });
  // Durée mesurée dans la page (horloge du cadre), sans capture entre-temps.
  const measuring = guest.game().evaluate(async () => {
    const start = performance.now();
    for (;;) {
      const node = document.querySelector('.lpl-ui .glance');
      if (
        node === null ||
        (node as HTMLElement).hidden ||
        getComputedStyle(node).display === 'none'
      )
        return (performance.now() - start) / 1000;
      if (performance.now() - start > 10_000) return 99;
      await new Promise((r) => setTimeout(r, 50));
    }
  });
  await guest.shot('1-coup-d-oeil');
  const lasted = await measuring;
  expect(lasted, 'durée du coup d’œil (s)').toBeGreaterThan(2);
  expect(lasted).toBeLessThan(4.5);
  await guest.shot('2-apres-coup-d-oeil');

  // P08: carnet ouvert, Z maintenu ne déplace pas le personnage.
  await duo.teleport(gi, 22, 24, -Math.PI / 2);
  await guest.press('KeyC');
  await expect(guest.game().locator('.lpl-ui .carnet')).toBeVisible();
  await guest.page.waitForTimeout(800);
  await guest.shot('3-carnet');
  const before = (await guest.world())?.players[gi];
  await guest.press('KeyW', 1500);
  await guest.page.waitForTimeout(800);
  const after = (await host.world())?.players[gi];
  if (before === undefined || after === undefined) throw new Error('joueur absent');
  expect(distance(after, before.body.x, before.body.y), 'immobile pendant le carnet').toBeLessThan(
    0.05,
  );

  // P09: coffre commun depuis la gare: V verse au coffre depuis le carnet.
  const chest0 = (await host.world())?.common.chest ?? -1;
  const money0 = after.money;
  await guest.press('KeyV');
  const paid = await duo.until(host, 'versement au coffre', (w) => w.common.chest > chest0, 8_000);
  expect((paid.players[gi]?.money ?? 0) + paid.common.chest).toBe(money0 + chest0);
  await duo.until(guest, 'coffre vu par l’invité', (w) => w.common.chest > chest0, 5_000);
  await guest.shot('4-coffre');
  await guest.press('KeyR');
  await duo.until(host, 'retrait du coffre', (w) => w.common.chest === chest0, 8_000);
  await guest.press('KeyC');
  await expect(guest.game().locator('.lpl-ui .carnet')).toBeHidden();

  // P10: deux joueurs posés l'un dans l'autre se séparent (rayon 0,3 m chacun).
  await duo.teleport(hi, 24, 26);
  await duo.teleport(gi, 24.1, 26);
  await host.page.waitForTimeout(2000);
  const pushed = await host.world();
  const [a, b] = [pushed?.players[hi], pushed?.players[gi]];
  if (a === undefined || b === undefined) throw new Error('joueurs absents');
  await host.shot('5-poussee');
  expect(distance(a, b.body.x, b.body.y), 'écart après poussée (m)').toBeGreaterThanOrEqual(0.55);
  expect(duo.errors).toEqual([]);
  await duo.close();
});
