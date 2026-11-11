// P19c la photo du prologue. Partie neuve: deux silhouettes dans le wagon, pas d'éditeur; l'hôte
// montre ses papiers, l'éditeur s'ouvre chez lui seul, il valide: son personnage paraît chez les
// deux joueurs pendant que l'invité reste une silhouette; puis l'invité fait de même. L'état de
// l'invité est comparé à celui de l'hôte (autorité) à chaque étape. Captures en 1366 x 768
// (`photo-*.png` dans `LPL2_CAPTURES`): avant, carnet avant, éditeur, après l'un, après les deux.
import { expect, test } from '@playwright/test';
import { startDuo, type ProbeWorld, type Side } from '../aides-e2e/duo';
import {
  actOn,
  calibrateYaw,
  Journal,
  loadMap,
  playUi,
  seats,
  shareSpots,
  snapshot,
  standSpots,
  walkBoth,
  windowSize,
  type Seat,
  type UiContext,
} from '../aides-e2e/prologue';

const PLACE = 'train-de-nuit';
/** Écran de portable de la machine de référence (CLAUDE.md). */
const LAPTOP = { width: 1366, height: 768 } as const;

/** Qui a un visage (fait « apparence révélée ») et qui a composé son personnage. */
const faces = (w: ProbeWorld): { revealed: boolean[]; composed: boolean[] } => ({
  revealed: w.players.map(
    (_, i) => w.progress?.memory?.[`joueurs.apparence.j${String(i)}`]?.v === true,
  ),
  composed: w.players.map((p) => (p.look ?? null) !== null),
});

test('P19c la photo: silhouettes, éditeur chez l’un puis chez l’autre, personnages révélés', async ({
  browser,
}) => {
  test.setTimeout(600_000);
  const journal = new Journal('p19c-releves.txt');
  const duo = await startDuo(browser, 'photo', { save: null });
  const { host, guest } = duo;
  const [seatH, seatG] = await seats(duo);
  const ctx: UiContext = {
    journal,
    slug: 'photo',
    gender: { hôte: 'Femme', invité: 'Homme' },
    shown: new Map(),
    lines: [],
    current: new Map(),
  };
  /** Capture en taille de portable: les deux fenêtres agrandies, le temps que l'image se pose. */
  const laptopShots = async (name: string, sides: readonly Side[]): Promise<void> => {
    await Promise.all(sides.map((s) => s.page.setViewportSize(LAPTOP)));
    await host.page.waitForTimeout(6000);
    for (const s of sides) await s.shot(sides.length === 1 ? name : `${name}-${s.who}`);
    await windowSize(duo, false);
  };
  /** Les deux lisent ce qui se présente (sauf l'éditeur de `keep`) jusqu'à la condition. */
  const readUntil = async (
    label: string,
    done: () => Promise<boolean>,
    keep: Side | null = null,
    timeoutMs = 90_000,
  ): Promise<void> => {
    const t0 = Date.now();
    while (!(await done())) {
      if (Date.now() - t0 > timeoutMs) throw new Error(`Délai dépassé: ${label}`);
      const did: boolean[] = [];
      for (const side of [host, guest]) {
        if (side === keep && (await snapshot(side)).editor) continue;
        did.push(await playUi(side, ctx));
      }
      if (!did.some(Boolean)) await host.page.waitForTimeout(250);
    }
  };
  const same = async (label: string): Promise<ReturnType<typeof faces>> => {
    const h = await host.world();
    if (h === null) throw new Error('monde absent');
    const wanted = faces(h);
    // L'invité reçoit la tranche « progression » un instant après: il doit rejoindre l'hôte.
    await expect
      .poll(async () => faces((await guest.world()) ?? h), { message: `invité: ${label}` })
      .toEqual(wanted);
    journal.log(`${label}: ${JSON.stringify(wanted)}`);
    return wanted;
  };

  // 1. Partie neuve: pas d'éditeur, deux silhouettes, la scène du compartiment.
  await duo.until(host, 'prologue', (w) => w.common.place === PLACE);
  const start = await snapshot(host);
  expect(start.editor, 'pas d’éditeur au démarrage').toBe(false);
  expect(await same('départ')).toEqual({ revealed: [false, false], composed: [false, false] });
  await readUntil('scène du compartiment', async () => {
    const w = await host.world();
    return (w?.common.story?.scene ?? null) === null;
  });
  await host.page.waitForTimeout(1500);
  await laptopShots('avant-wagon', [host]);

  // 2. Le carnet avant la photo: page de gauche et onglet Tenues, rien à changer encore.
  await host.press('KeyC');
  const book = host.game().locator('.lpl-ui .carnet');
  await expect(book).toBeVisible();
  for (let i = 0; i < 6; i++) {
    if ((await book.locator('.signet[aria-selected="true"]').textContent())?.includes('Tenues'))
      break;
    await host.press('KeyE');
    await host.page.waitForTimeout(300);
  }
  await expect(book.locator('.detail--tenues')).toContainText('pas encore de visage');
  await host.press('Enter');
  await host.page.waitForTimeout(500);
  expect((await snapshot(host)).editor, 'l’onglet Tenues n’ouvre pas l’éditeur').toBe(false);
  await laptopShots('carnet-avant', [host]);
  await host.press('KeyC');
  await expect(book).toBeHidden();

  // 3. Les deux marchent jusqu'au Contrôleur; l'hôte lui parle seul.
  const w0 = await host.world();
  const ctrl = w0?.places[PLACE]?.villagers?.controleur;
  if (ctrl === undefined) throw new Error('Contrôleur absent');
  const map = loadMap(PLACE);
  await windowSize(duo, true);
  await calibrateYaw(duo, journal);
  const spots = await shareSpots(duo, map, standSpots(map, ctrl.body, 2, [ctrl.body]), [ctrl.body]);
  const walk = await walkBoth(duo, spots, {
    map,
    journal,
    label: 'photo: aller au Contrôleur',
    avoid: [ctrl.body],
  });
  await windowSize(duo, false);
  expect(walk.state, 'les deux arrivent à pied près du Contrôleur').toEqual(['arrivé', 'arrivé']);
  const talk = async (seat: Seat): Promise<void> => {
    const aimed = async (): Promise<boolean> => {
      const aim = await seat.side.aim(seat.index);
      return (aim?.id ?? '').includes('controleur') && (aim?.refusal ?? null) === null;
    };
    const talking = async (): Promise<boolean> => (await snapshot(seat.side)).dialogue !== null;
    expect(
      await actOn(duo, seat, ctrl.body, aimed, talking, journal),
      `${seat.side.who}: le dialogue du Contrôleur s’ouvre`,
    ).toBe(true);
  };
  const closed = async (seat: Seat): Promise<boolean> => {
    const w = await host.world();
    return w?.players[seat.index]?.talk === null && (await snapshot(seat.side)).dialogue === null;
  };

  // 4. L'éditeur s'ouvre chez l'hôte à la réplique de la photo, pas chez l'invité.
  await talk(seatH);
  await readUntil('éditeur chez l’hôte', async () => (await snapshot(host)).editor, host);
  expect((await snapshot(guest)).editor, 'pas d’éditeur chez l’invité').toBe(false);
  expect((await host.world())?.players[seatH.index]?.talk?.node, 'réplique de la photo').toBe(
    'photo',
  );
  expect((await same('éditeur ouvert chez l’hôte')).revealed).toEqual([false, false]);
  await laptopShots('editeur', [host]);

  // 5. Il valide: son personnage paraît chez les deux, l'invité reste une silhouette.
  await readUntil('papiers de l’hôte', () => closed(seatH));
  const one = await same('après la photo de l’hôte');
  expect(one.revealed[seatH.index], 'hôte révélé').toBe(true);
  expect(one.composed[seatH.index], 'hôte composé').toBe(true);
  expect(one.revealed[seatG.index], 'invité encore caché').toBe(false);
  await laptopShots('apres-un', [host, guest]);

  // 6. L'invité à son tour.
  await talk(seatG);
  await readUntil('éditeur chez l’invité', async () => (await snapshot(guest)).editor, guest);
  expect((await snapshot(host)).editor, 'pas d’éditeur chez l’hôte cette fois').toBe(false);
  await readUntil('papiers de l’invité', () => closed(seatG));
  expect(await same('après la photo des deux')).toEqual({
    revealed: [true, true],
    composed: [true, true],
  });
  await laptopShots('apres-deux', [host, guest]);

  expect(duo.errors, 'aucune erreur en console').toEqual([]);
  journal.log('P19c fini');
  await duo.close();
});
