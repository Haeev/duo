// E1 endurance (réponse du client du 2026-11-11, `simulation/besoins/endurance.ts`): l'hôte court
// (Maj tenue) dans la grand-rue d'Aubrune jusqu'à l'essoufflement: la jauge paraît sous l'horloge,
// la course s'arrête (on marche, Maj tenue ou non), elle reprend au seuil (`recoverAt`), et un
// plat (le pain, mangé depuis le carnet) recharge la jauge. Chaque joueur ne voit que la sienne:
// l'invité n'a pas de jauge tant que lui-même ne court pas. Sauvegarde « aubrune-recette ».
import { expect, test } from '@playwright/test';
import type { ProbeWorld } from '../aides-e2e/duo';
import { startDuo } from '../aides-e2e/duo';
import { countOf, holdUntil, placeAt, settle, shot } from '../aides-e2e/contenu';
import type { Side } from '../aides-e2e/duo';
import { Journal, seats, type Seat } from '../aides-e2e/prologue';
import { me } from '../aides-e2e/prologue';

test.use({ viewport: { width: 320, height: 180 } });

/** Grand-rue (points `gr0` à `gr9` de `carte.json`): une ligne droite de 130 m à y = 108. */
const STREET = { y: 108, west: 192, east: 300 } as const;
const GAUGE = '.lpl-ui .stamina';

interface Breath {
  readonly stamina: number;
  readonly winded: boolean;
  readonly speed: number;
  readonly x: number;
}

function breath(w: ProbeWorld, seat: Seat): Breath {
  const p = me(w, seat) as ReturnType<typeof me> & {
    readonly stamina?: number;
    readonly staminaMods?: { readonly winded: boolean };
    readonly body: { readonly speed?: number };
  };
  return {
    stamina: p.stamina ?? 1,
    winded: p.staminaMods?.winded ?? false,
    speed: p.body.speed ?? 0,
    x: p.body.x,
  };
}

async function gaugeVisible(side: Side): Promise<boolean> {
  return await side
    .game()
    .evaluate((s) => document.querySelector<HTMLElement>(s)?.checkVisibility() ?? false, GAUGE);
}

test('E1 endurance: essoufflement, reprise au seuil, plat qui recharge, jauge à soi', async ({
  browser,
}) => {
  test.setTimeout(900_000);
  const journal = new Journal('e1-releves.txt');
  const duo = await startDuo(browser, 'e1-endurance', { save: 'aubrune-recette' });
  const { host, guest } = duo;
  const [h, g] = await seats(duo);
  await settle(duo, 'aubrune', 18);
  // Mise en place: l'hôte au bout ouest de la grand-rue, l'invité reste sur la place.
  await placeAt(duo, journal, h.index, { x: STREET.west, y: STREET.y }, 'grand-rue', 0);

  // Courir (Maj et D, puis Maj et Q d'un AZERTY) d'un bout à l'autre jusqu'à l'essoufflement.
  let east = true;
  let runSpeed = 0;
  let checkedGuest = false;
  for (let leg = 0; leg < 8; leg++) {
    const sampled = holdUntil(
      duo,
      host,
      ['Shift', east ? 'd' : 'a'],
      (w) => {
        const b = breath(w, h);
        runSpeed = Math.max(runSpeed, b.speed);
        return b.winded || (east ? b.x > STREET.east : b.x < STREET.west);
      },
      240_000,
    );
    if (!checkedGuest) {
      // Pendant la course: la jauge de l'hôte paraît chez lui, rien chez l'invité (la sienne
      // est pleine).
      await expect.poll(async () => await gaugeVisible(host), { timeout: 30_000 }).toBe(true);
      expect(await gaugeVisible(guest), 'pas de jauge chez l’invité qui ne court pas').toBe(false);
      await shot(guest, '1-invite-sans-jauge');
      checkedGuest = true;
    }
    await sampled;
    const w = await duo.until(host, 'monde lu', () => true);
    const b = breath(w, h);
    journal.log(
      `tronçon ${String(leg)}: x ${b.x.toFixed(1)}, jauge ${b.stamina.toFixed(2)}, essoufflé ${String(b.winded)}`,
    );
    if (b.winded) break;
    east = !east;
  }
  const out = await duo.until(host, 'essoufflé', (w) => breath(w, h).winded, 10_000);
  journal.log(
    `course: vitesse max ${runSpeed.toFixed(2)} m/s, jauge ${breath(out, h).stamina.toFixed(2)}`,
  );
  expect(breath(out, h).stamina, 'jauge vide').toBeLessThan(0.05);
  await shot(host, '2-essouffle');

  // Essoufflé, Maj tenue: on marche seulement.
  let windedSpeed = 0;
  await holdUntil(
    duo,
    host,
    ['Shift', east ? 'a' : 'd'],
    (w) => {
      windedSpeed = Math.max(windedSpeed, breath(w, h).speed);
      return false;
    },
    6000,
  );
  journal.log(`essoufflé, Maj tenue: vitesse max ${windedSpeed.toFixed(2)} m/s`);
  expect(windedSpeed, 'la course s’arrête').toBeLessThan(runSpeed * 0.7);
  expect(windedSpeed, 'on marche encore').toBeGreaterThan(0.5);

  // Reprise: immobile, la jauge remonte jusqu'au seuil, puis la course revient.
  const back = await duo.until(host, 'souffle repris', (w) => !breath(w, h).winded, 240_000);
  journal.log(`reprise à ${breath(back, h).stamina.toFixed(2)}`);
  expect(breath(back, h).stamina).toBeGreaterThanOrEqual(0.29);
  let againSpeed = 0;
  await holdUntil(
    duo,
    host,
    ['Shift', east ? 'a' : 'd'],
    (w) => {
      againSpeed = Math.max(againSpeed, breath(w, h).speed);
      return false;
    },
    6000,
  );
  journal.log(`après la reprise: vitesse max ${againSpeed.toFixed(2)} m/s`);
  expect(againSpeed, 'on recourt').toBeGreaterThan(runSpeed * 0.9);

  // Un plat recharge: le pain (première case de la barre), mangé depuis le carnet (C, Entrée).
  await duo.setNeed(h.index, 'hunger', 40);
  const before = await duo.until(host, 'monde lu', () => true);
  const s0 = breath(before, h).stamina;
  const bread0 = countOf(before, h, 'pain');
  await host.press('KeyC');
  await host.page.waitForTimeout(2000);
  await host.press('Enter');
  const fed = await duo.until(host, 'pain mangé', (w) => countOf(w, h, 'pain') < bread0, 20_000);
  await host.press('KeyC');
  journal.log(`pain mangé: jauge ${s0.toFixed(2)} -> ${breath(fed, h).stamina.toFixed(2)}`);
  expect(breath(fed, h).stamina - s0, 'le pain recharge (0,25)').toBeGreaterThan(0.2);
  await shot(host, '3-apres-le-pain');

  // L'invité court à son tour: sa jauge paraît chez lui.
  await holdUntil(duo, guest, ['Shift', 'd'], (w) => breath(w, g).stamina < 0.98, 60_000);
  await expect.poll(async () => await gaugeVisible(guest), { timeout: 30_000 }).toBe(true);
  await shot(guest, '4-invite-sa-jauge');

  expect(duo.errors).toEqual([]);
  await duo.close();
});
