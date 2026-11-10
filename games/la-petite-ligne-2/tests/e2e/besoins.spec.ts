// P05 besoins qui changent de palier (CA-08) et P06 se laver à la pompe (manger: voir les parcours
// bloqués par les données).
import { expect, test } from '@playwright/test';
import { startDuo } from '../aides-e2e/duo';

const PUMP = { x: 28.5, y: 22.5 };
const NORTH = -Math.PI / 2;

test('palier de besoin chez l’invité puis toilette à la pompe', async ({ browser }) => {
  const duo = await startDuo(browser, 'p05-besoins');
  const { host, guest } = duo;
  const gi = await guest.local();
  // Palier « bas »: jauge sous 20, la pastille s'affiche chez l'invité.
  await duo.setNeed(gi, 'hygiene', 15);
  await duo
    .until(host, 'palier bas chez l’hôte', (w) => w.players[gi]?.tiers.hygiene === 'low', 5_000)
    .catch(async (e: unknown) => {
      const w = await host.world();
      throw new Error(
        `${String(e)}; joueur ${gi}: ${JSON.stringify({ needs: w?.players[gi]?.needs, tiers: w?.players[gi]?.tiers })}`,
      );
    });
  await duo.until(guest, 'palier bas reçu', (w) => w.players[gi]?.tiers.hygiene === 'low', 15_000);
  await expect(guest.game().locator('.lpl-ui .need--low')).toBeVisible();
  await guest.shot('1-hygiene-basse');

  // P06: se laver. L'invité se place devant la pompe et agit.
  await duo.teleport(gi, PUMP.x, PUMP.y + 1, NORTH);
  await expect
    .poll(async () => (await guest.aim(gi))?.verb ?? null, { timeout: 10_000 })
    .not.toBeNull();
  await guest.shot('2-bulle-pompe');
  await guest.press('Space');
  await duo.until(host, 'geste de toilette', (w) => w.players[gi]?.gesture !== null, 10_000);
  await guest.page.waitForTimeout(1200);
  await guest.shot('3-toilette');
  await host.shot('3-toilette-vue-par-hote');
  const after = await duo.until(
    host,
    'hygiène remontée',
    (w) => (w.players[gi]?.needs.hygiene ?? 0) > 40,
    15_000,
  );
  expect(after.players[gi]?.tiers.hygiene).not.toBe('low');
  await guest.page.waitForTimeout(800);
  await guest.shot('4-apres-toilette');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
