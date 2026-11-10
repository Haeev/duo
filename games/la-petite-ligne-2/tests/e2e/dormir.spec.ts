// P12 dormir à deux après 15 h et passage au lendemain (CA-05). Données: lit double de la gare.
import { expect, test } from '@playwright/test';
import { startDuo } from '../aides-e2e/duo';

const BED = { x: 17.5, y: 14 };
const WEST = Math.PI;

test('dormir à deux: réveil le lendemain à l’aube', async ({ browser }) => {
  const duo = await startDuo(browser, 'p12-dormir');
  const { host, guest } = duo;
  const [hi, gi] = [await host.local(), await guest.local()];
  const day0 = (await host.world())?.common.day ?? 0;
  await duo.setMinutes(16 * 60);
  // Le lit (2 m sur 2) est adossé au bâtiment, l'armoire à l'ouest et le coffre au sud: les deux
  // joueurs l'abordent par l'est, face à l'ouest.
  await duo.teleport(hi, BED.x + 1.5, BED.y - 0.5, WEST);
  await duo.teleport(gi, BED.x + 1.5, BED.y + 0.5, WEST);
  await expect
    .poll(async () => (await host.aim(hi))?.verb ?? null, { timeout: 20_000 })
    .not.toBeNull();
  await host.shot('1-bulle-lit');
  await host.press('Space');
  await host.page.waitForTimeout(2500);
  const alone = await host.world();
  expect(alone?.common.day, 'un seul au lit: la nuit ne saute pas').toBe(day0);
  await host.shot('2-un-seul-couche');
  await expect
    .poll(async () => (await guest.aim(gi))?.verb ?? null, { timeout: 20_000 })
    .not.toBeNull();
  await guest.press('Space');
  const woke = await duo.until(host, 'lendemain', (w) => w.common.day === day0 + 1, 30_000);
  expect(woke.minutes, 'réveil à 6 h (CA-05)').toBeLessThan(6 * 60 + 15);
  await duo.until(guest, 'lendemain chez l’invité', (w) => w.common.day === day0 + 1, 10_000);
  await host.page.waitForTimeout(1500);
  await host.shot('3-lendemain');
  await guest.shot('3-lendemain');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
