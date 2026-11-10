// Retours du client sur les intérieurs et la scène d'accueil: passage par la porte de la maison du
// garde-barrière (fondu, pièce seule à l'écran, porte de sortie visible et visée, sortie devant la
// porte, vue de l'autre joueur resté dehors) et marche de Firmin pendant la scène d'accueil.
import { expect, test } from '@playwright/test';
import { startDuo, type Duo, type ProbeWorld, type Side } from '../aides-e2e/duo';

/** Porte de la maison côté rue (`carte.json`): sa case, devant le mur est du bâtiment (x = 179). */
const STREET_DOOR = { x: 179.5, y: 115.5 };
/** L'annexe des intérieurs commence sous le dehors (y = 208). */
const ANNEX_Y = 208;

function indoors(w: ProbeWorld, player: number): boolean {
  return (w.players[player]?.body.y ?? 0) > ANNEX_Y;
}

/** Donne le clavier au jeu de cette machine, puis tient des touches (codes QWERTY de Playwright). */
async function hold(side: Side, keys: readonly string[]): Promise<() => Promise<void>> {
  await side.game().evaluate(() => {
    window.focus();
    document.body.focus();
  });
  for (const key of keys) await side.page.keyboard.down(key);
  return async () => {
    for (const key of keys) await side.page.keyboard.up(key);
  };
}

/**
 * Cadre la vue d'une machine. La porte de la maison est sur son mur est: au lacet de départ
 * (45 degrés) la maison la cache; à 225 degrés on la voit de face, et l'ouest est en haut à droite.
 */
async function frameView(side: Side, yawDeg: number, width: number): Promise<void> {
  await side.game().evaluate(
    ([yaw, w]) => {
      const probe = (
        window as unknown as { __lplSonde?: { setCamera(yaw: number, width: number): boolean } }
      ).__lplSonde;
      probe?.setCamera(yaw, w);
    },
    [yawDeg, width] as const,
  );
}

/** Rafale de captures pendant qu'une condition du monde n'est pas remplie (le fondu dure 0,4 s). */
async function burst(
  duo: Duo,
  side: Side,
  name: string,
  done: (w: ProbeWorld) => boolean,
  after = 3,
): Promise<void> {
  let left = after;
  for (let n = 1; n <= 24 && left > 0; n++) {
    const world = await side.world();
    if (world !== null && done(world)) left -= 1;
    await side.shot(`${name}-${String(n).padStart(2, '0')}`);
  }
  await duo.until(side, name, done, 20_000);
}

test('I1 entrer dans la maison du garde-barrière et en ressortir', async ({ browser }) => {
  test.setTimeout(240_000);
  const duo = await startDuo(browser, 'interieurs', { save: 'aubrune-apres-scene' });
  const { host, guest } = duo;
  const [hi, gi] = [await host.local(), await guest.local()];
  await duo.until(host, 'scène finie', (w) => (w.common.story?.scene ?? null) === null);
  await Promise.all([frameView(host, 225, 14), frameView(guest, 225, 16)]);
  // Les deux devant la maison, l'invité un peu en retrait: il regarde son partenaire entrer.
  await duo.teleport(hi, STREET_DOOR.x + 1, STREET_DOOR.y, Math.PI);
  await duo.teleport(gi, STREET_DOOR.x + 3.2, STREET_DOOR.y + 1.4, Math.PI);
  await host.page.waitForTimeout(4000);
  // À 1,5 m du mur, dans l'axe de la porte: elle est la cible, son verbe est montré avant d'agir.
  await expect
    .poll(async () => (await host.aim(hi))?.verb ?? null, { timeout: 20_000 })
    .toBe('Entrer');
  await Promise.all([host.shot('1-avant-hote'), guest.shot('1-avant-invite')]);
  // On n'est pas téléporté avant la porte: à un mètre du mur, toujours dehors.
  await duo.teleport(hi, STREET_DOOR.x + 0.5, STREET_DOOR.y, Math.PI);
  await host.page.waitForTimeout(600);
  const near = await duo.until(host, 'monde lu', () => true);
  expect(indoors(near, hi), 'encore dehors à 1 m du mur').toBe(false);

  // Vers l'ouest: à 225 degrés, droite et haut de l'écran ensemble (D et Z).
  let release = await hold(host, ['d', 'w']);
  await burst(duo, host, '2-entree-hote', (w) => indoors(w, hi));
  await release();
  await host.page.waitForTimeout(1500);
  const inside = await duo.until(host, 'monde lu', () => true);
  const me = inside.players[hi]?.body ?? { x: 0, y: 0, facing: 0 };
  // Arrivé par la porte de la pièce (mur est, x = 24), il a continué vers l'ouest sans ressortir
  // (les touches sont restées tenues pendant la rafale): il est dans la maison.
  expect(me.x, 'dans la maison').toBeGreaterThan(14);
  expect(me.x).toBeLessThan(24);
  expect(me.y).toBeGreaterThan(210);
  expect(me.y).toBeLessThan(217);
  await Promise.all([host.shot('3-dedans-hote'), guest.shot('3-dehors-vu-par-invite')]);

  // La porte de sortie se vise: à un mètre d'elle, tourné vers elle, la bulle dit « Sortir ».
  await duo.teleport(hi, 23, 211.5, 0);
  await expect
    .poll(async () => (await host.aim(hi))?.verb ?? null, { timeout: 20_000 })
    .toBe('Sortir');
  await host.page.waitForTimeout(800);
  await host.shot('4-porte-de-sortie-visee');

  // Sortie par la touche d'action: devant la porte de la rue, tourné vers le dehors (est).
  await host.press('Space');
  await burst(duo, host, '5-sortie-hote', (w) => !indoors(w, hi));
  await host.page.waitForTimeout(1500);
  const after = await duo.until(host, 'monde lu', () => true);
  const out = after.players[hi]?.body ?? { x: 0, y: 0, facing: 0 };
  expect(Math.hypot(out.x - (STREET_DOOR.x + 0.1), out.y - STREET_DOOR.y)).toBeLessThan(0.2);
  expect(Math.abs(Math.cos(out.facing) - 1), 'tourné vers le dehors').toBeLessThan(0.01);
  await Promise.all([host.shot('6-sorti-hote'), guest.shot('6-sorti-vu-par-invite')]);

  // L'invité entre à son tour: même fondu chez lui, et l'hôte le voit disparaître par la porte.
  await duo.teleport(gi, STREET_DOOR.x + 0.6, STREET_DOOR.y, Math.PI);
  await duo.teleport(hi, STREET_DOOR.x + 2.6, STREET_DOOR.y + 1.2, Math.PI);
  await guest.page.waitForTimeout(1500);
  release = await hold(guest, ['d', 'w']);
  await burst(duo, guest, '7-entree-invite', (w) => indoors(w, gi));
  await release();
  await guest.page.waitForTimeout(1500);
  await Promise.all([guest.shot('8-dedans-invite'), host.shot('8-dehors-vu-par-hote')]);
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('I2 Firmin marche pendant la scène d’accueil', async ({ browser }) => {
  test.setTimeout(240_000);
  // Le vrai enchaînement: fin du prologue, trajet, descente sur le quai à 8 h, puis la scène.
  const duo = await startDuo(browser, 'interieurs-firmin', { save: 'train-de-nuit-porte' });
  const { host, guest } = duo;
  await duo.until(host, 'dans le train', (w) => w.common.place === 'train-de-nuit');
  await duo.teleport(0, 8.05, 5.35, Math.PI / 2);
  await duo.teleport(1, 8.65, 5.35, Math.PI / 2);
  await duo.until(host, 'en route', (w) => w.common.phase === 'travel');
  // Les deux passent le trajet (« Passer le trajet »): la scène d'accueil suit la descente.
  await host.page.waitForTimeout(3000);
  await host.press('Space');
  await guest.press('Space');
  await duo.until(
    host,
    'scène d’accueil',
    (w) => w.common.place === 'aubrune' && w.common.story?.scene?.id !== undefined,
    120_000,
  );
  // Vu du sud-est, de près: Firmin vient du nord et contourne les joueurs par l'est, devant eux.
  await Promise.all([frameView(host, 315, 8), frameView(guest, 315, 8)]);
  for (const n of [1, 2, 3, 4, 5]) await host.shot(`firmin-${String(n)}-hote`);
  await guest.shot('firmin-6-invite');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
