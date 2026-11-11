// R1 récolte à Aubrune (`simulation/outils/ressources.ts`, `briques/ramasser.ts`): l'hôte prend
// la hache (touche 4 de la barre) et abat un chêne de la lisière (`chene-lisiere-4`, six coups):
// la souche se voit chez les deux, les bûches vont dans son sac. Il cueille les ronces du jardin
// de la maison (`ronces-maison-2`). L'invité pose son pain par terre (carnet, P) et l'hôte le
// ramasse (Espace). Sauvegarde « aubrune-ete » (jour 15, été: les ronces ont des mûres); chaque
// étape commence par une mise en place.
import { expect, test } from '@playwright/test';
import { startDuo, type ProbeWorld } from '../aides-e2e/duo';
import {
  aimAt,
  aimOf,
  countOf,
  loadMapWithInteriors,
  placeAt,
  settle,
  shot,
  walk,
} from '../aides-e2e/contenu';
import { Journal, seats, standSpots, tapToward } from '../aides-e2e/prologue';

test.use({ viewport: { width: 320, height: 180 } });

const MAP = loadMapWithInteriors('aubrune');
const TREE = { id: 'chene-lisiere-4', x: 192.5, y: 84 };
const BRAMBLE = { id: 'ronces-maison-2', x: 176, y: 119.6 };

interface Harvested {
  readonly places: Readonly<
    Record<
      string,
      | {
          readonly objects?: Readonly<
            Record<string, { readonly harvest?: { readonly back: number | null } } | undefined>
          >;
          readonly ground?: readonly {
            readonly stack?: { readonly item: string };
            readonly x: number;
            readonly y: number;
          }[];
        }
      | undefined
    >
  >;
}

const back = (w: ProbeWorld, id: string): number | null =>
  (w as unknown as Harvested).places.aubrune?.objects?.[id]?.harvest?.back ?? null;
const ground = (w: ProbeWorld): string[] =>
  ((w as unknown as Harvested).places.aubrune?.ground ?? []).map((g) => g.stack?.item ?? '?');

test('R1 récolte: chêne abattu, ronces cueillies, objet au sol ramassé', async ({ browser }) => {
  test.setTimeout(900_000);
  const journal = new Journal('r1-releves.txt');
  const duo = await startDuo(browser, 'r1-recolte', { save: 'aubrune-ete' });
  const { host, guest } = duo;
  const [h, g] = await seats(duo);
  await settle(duo, 'aubrune', 16);
  const w0 = await duo.until(host, 'monde lu', () => true);
  const slot = w0.players[h.index]?.toolbar.findIndex((s) => s?.item === 'hache') ?? -1;
  expect(slot, 'la hache dans la barre (touches 1 à 5)').toBeGreaterThanOrEqual(0);
  expect(slot).toBeLessThan(5);
  expect(back(w0, TREE.id), 'le chêne est debout').toBeNull();

  // Le chêne: mise en place à la lisière, puis au pied de l'arbre au clavier, hache en main.
  await placeAt(duo, journal, h.index, { x: TREE.x, y: TREE.y + 3 }, 'lisière', -Math.PI / 2);
  await placeAt(duo, journal, g.index, { x: TREE.x + 2.5, y: TREE.y + 3 }, 'lisière', -Math.PI / 2);
  await walk(duo, journal, MAP, [{ x: TREE.x, y: TREE.y + 1.1 }, null], 'au pied du chêne', {
    tolerance: 0.3,
  });
  await host.press(`Digit${String(slot + 1)}`);
  await duo.until(
    host,
    'hache en main',
    (w) => (w.players[h.index] as { selected?: number | null } | undefined)?.selected === slot,
  );
  expect(await aimAt(duo, h, TREE, TREE.id, journal), 'chêne visé').toBe(true);
  expect((await aimOf(h))?.verb).toBe('Couper');
  const logs0 = countOf(w0, h, 'buche');
  for (let i = 0; i < 16; i++) {
    const w = await duo.until(host, 'monde lu', () => true);
    if (back(w, TREE.id) !== null) break;
    if ((await aimOf(h))?.id !== TREE.id) await aimAt(duo, h, TREE, TREE.id, journal);
    await host.press('Space', 300);
    await host.page.waitForTimeout(2500);
  }
  const felled = await duo.until(host, 'chêne abattu', (w) => back(w, TREE.id) !== null, 30_000);
  journal.log(`chêne abattu, repousse au jour ${String(back(felled, TREE.id))}`);
  expect(countOf(felled, h, 'buche'), 'des bûches dans le sac').toBeGreaterThan(logs0);
  await duo.until(guest, 'souche vue par l’invité', (w) => back(w, TREE.id) !== null, 30_000);
  await shot(host, '1-souche-hote');
  await shot(guest, '1-souche-invite');

  // Les ronces du jardin: mains libres (X range la hache), Espace face aux ronces.
  await host.press('KeyX');
  // Les ronces sont contre la clôture du jardin: les deux cases libres les plus proches.
  const [near, beside] = standSpots(MAP, BRAMBLE, 2);
  if (near === undefined || beside === undefined) throw new Error('pas de place près des ronces');
  await placeAt(duo, journal, h.index, near, 'jardin');
  await placeAt(duo, journal, g.index, beside, 'jardin');
  expect(await aimAt(duo, h, BRAMBLE, BRAMBLE.id, journal), 'ronces visées').toBe(true);
  journal.log(`ronces: ${JSON.stringify(await aimOf(h))}`);
  for (let i = 0; i < 4; i++) {
    const w = await duo.until(host, 'monde lu', () => true);
    if (back(w, BRAMBLE.id) !== null) break;
    await host.press('Space', 300);
    await host.page.waitForTimeout(2500);
  }
  const picked0 = await duo.until(
    host,
    'ronces cueillies',
    (w) => back(w, BRAMBLE.id) !== null,
    20_000,
  );
  expect(countOf(picked0, h, 'mures'), 'des mûres dans le sac').toBeGreaterThan(0);
  await duo.until(guest, 'ronces vues cueillies', (w) => back(w, BRAMBLE.id) !== null, 20_000);
  await shot(host, '2-ronces-cueillies');

  // L'invité pose son pain par terre (carnet, P), l'hôte le ramasse (Espace).
  const bread = countOf(await duo.until(host, 'monde lu', () => true), h, 'pain');
  await guest.press('KeyC');
  await guest.page.waitForTimeout(2000);
  await guest.press('KeyP');
  await guest.page.waitForTimeout(1500);
  await guest.press('KeyC');
  const dropped = await duo.until(host, 'pain au sol', (w) => ground(w).includes('pain'), 30_000);
  journal.log(`au sol: ${ground(dropped).join(', ')}`);
  await duo.until(guest, 'pain au sol chez l’invité', (w) => ground(w).includes('pain'), 20_000);
  await shot(guest, '3-pain-au-sol-invite');
  // L'invité s'écarte; l'hôte s'approche du pain et se tourne vers lui.
  const item = (dropped as unknown as Harvested).places.aubrune?.ground?.find(
    (x) => x.stack?.item === 'pain',
  ) ?? { x: BRAMBLE.x + 1.5, y: BRAMBLE.y };
  const [toHost, away] = standSpots(MAP, item, 6).filter(
    (p) => Math.hypot(p.x - item.x, p.y - item.y) > 0.6,
  );
  if (toHost === undefined) throw new Error('pas de place près du pain');
  await walk(duo, journal, MAP, [toHost, away ?? null], 'vers le pain', { tolerance: 0.3 });
  const isPickup = async (): Promise<boolean> => (await aimOf(h))?.verb === 'Ramasser';
  await tapToward(duo, h, item, isPickup, journal, 8);
  expect(await isPickup(), 'le pain se vise (« Ramasser »)').toBe(true);
  await host.press('Space', 300);
  const picked = await duo.until(
    host,
    'pain ramassé',
    (w) => !ground(w).includes('pain') && countOf(w, h, 'pain') > bread,
    30_000,
  );
  journal.log(`pain: ${String(bread)} -> ${String(countOf(picked, h, 'pain'))}`);
  await duo.until(guest, 'ramassage vu par l’invité', (w) => !ground(w).includes('pain'), 20_000);
  await shot(host, '4-pain-ramasse');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
