// P13 cueillir et manger (CA-09), P14 poser au sol puis ranger au coffre (CA-17), P15 donner un
// objet à l'autre joueur. Ils étaient bloqués tant qu'aucun objet ne s'obtenait: la brique
// `gather` est inscrite au registre et le pommier de la gare d'essai donne des pommes.
import { expect, test } from '@playwright/test';
import { startDuo, type Duo } from '../aides-e2e/duo';

const POMMIER = { x: 10.5, y: 22.5 };
const NORTH = -Math.PI / 2;

/** Place l'hôte devant le pommier et cueille une pomme (la barre d'objets la reçoit). */
async function pickApple(duo: Duo): Promise<number> {
  const { host } = duo;
  const hi = await host.local();
  await duo.teleport(hi, POMMIER.x, POMMIER.y + 1, NORTH);
  await expect
    .poll(async () => (await host.aim(hi))?.id ?? null, { timeout: 20_000 })
    .toBe('pommier');
  await host.press('Space');
  await duo.until(
    host,
    'pomme en poche',
    (w) => w.players[hi]?.toolbar.some((s) => s?.item === 'pomme') === true,
    15_000,
  );
  return hi;
}

/**
 * Met le focus du carnet sur la case de la pomme. Les chiffres n'y font rien (interface.md, 4):
 * le carnet ouvre sur la case 1 et D avance d'une case dans la barre.
 */
async function focusApple(duo: Duo, slot: number): Promise<void> {
  for (let i = 0; i < slot; i += 1) await duo.host.press('KeyD');
  await expect(duo.host.game().locator('.lpl-ui .carnet .tile.focus')).toHaveAttribute(
    'aria-label',
    /^Pomme/,
  );
}

test('P13 cueillir une pomme et la manger (CA-09)', async ({ browser }) => {
  const duo = await startDuo(browser, 'p13-manger');
  const { host, guest } = duo;
  const hi = await pickApple(duo);
  await host.shot('1-pomme-cueillie');
  await duo.setNeed(hi, 'hunger', 30);
  await duo.until(host, 'faim réglée', (w) => (w.players[hi]?.needs.hunger ?? 100) < 35, 5_000);
  const before = (await host.world())?.players[hi]?.needs.hunger ?? 0;
  await host.press('KeyC');
  await expect(host.game().locator('.lpl-ui .carnet')).toBeVisible();
  await host.page.waitForTimeout(600);
  await host.shot('2-carnet-pomme');
  const slot = (await host.world())?.players[hi]?.toolbar.findIndex((s) => s?.item === 'pomme');
  expect(slot, 'la pomme est sur la barre').toBeGreaterThanOrEqual(0);
  await focusApple(duo, slot ?? 0);
  await host.press('Enter');
  const ate = await duo.until(
    host,
    'faim remontée',
    (w) => (w.players[hi]?.needs.hunger ?? 0) > before + 5,
    15_000,
  );
  expect(ate.players[hi]?.toolbar.some((s) => s?.item === 'pomme')).toBe(false);
  await duo.until(
    guest,
    'faim vue par l’invité',
    (w) => (w.players[hi]?.needs.hunger ?? 0) > before + 5,
    15_000,
  );
  await host.shot('3-apres-repas');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('P15 donner une pomme à l’autre joueur', async ({ browser }) => {
  const duo = await startDuo(browser, 'p15-donner');
  const { host, guest } = duo;
  const hi = await pickApple(duo);
  const gi = await guest.local();
  // Le second joueur se tient près du premier pour recevoir (portée de don).
  await duo.teleport(gi, POMMIER.x + 1, POMMIER.y + 1, NORTH);
  await host.page.waitForTimeout(1500);
  await host.press('KeyC');
  await expect(host.game().locator('.lpl-ui .carnet')).toBeVisible();
  const slot = (await host.world())?.players[hi]?.toolbar.findIndex((s) => s?.item === 'pomme');
  await focusApple(duo, slot ?? 0);
  await host.press('KeyT');
  await duo.until(
    host,
    'pomme chez l’invité',
    (w) => w.players[gi]?.toolbar.some((s) => s?.item === 'pomme') === true,
    15_000,
  );
  const after = await duo.until(
    host,
    'pomme partie de chez l’hôte',
    (w) => w.players[hi]?.toolbar.some((s) => s?.item === 'pomme') !== true,
    5_000,
  );
  expect(after.players[hi]?.toolbar.some((s) => s?.item === 'pomme')).toBe(false);
  await duo.until(
    guest,
    'pomme vue chez l’invité',
    (w) => w.players[gi]?.toolbar.some((s) => s?.item === 'pomme') === true,
    15_000,
  );
  await guest.shot('1-pomme-recue');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('P14 poser une pomme au sol puis la ramasser (CA-17)', async ({ browser }) => {
  const duo = await startDuo(browser, 'p14-poser');
  const { host } = duo;
  const hi = await pickApple(duo);
  const apples = (w: {
    players: readonly { toolbar: readonly ({ item: string } | null)[] }[];
  }): number => w.players[hi]?.toolbar.filter((s) => s?.item === 'pomme').length ?? 0;
  await host.press('KeyC');
  await expect(host.game().locator('.lpl-ui .carnet')).toBeVisible();
  const slot = (await host.world())?.players[hi]?.toolbar.findIndex((s) => s?.item === 'pomme');
  await focusApple(duo, slot ?? 0);
  await host.press('KeyP');
  const dropped = await duo.until(
    host,
    'pomme posée au sol',
    (w) => (w.places['essai-gare']?.ground?.length ?? 0) > 0,
    10_000,
  );
  expect(apples(dropped), 'plus de pomme en poche').toBe(0);
  await host.press('KeyC');
  await host.page.waitForTimeout(800);
  await host.shot('1-pomme-au-sol');
  await expect
    .poll(async () => (await host.aim(hi))?.verb ?? null, { timeout: 20_000 })
    .not.toBeNull();
  await host.press('Space');
  const back = await duo.until(host, 'pomme ramassée', (w) => apples(w) === 1, 10_000);
  expect(back.places['essai-gare']?.ground?.length ?? 0).toBe(0);
  await host.shot('2-pomme-ramassee');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
