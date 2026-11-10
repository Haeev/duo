// Vues imposées du rendu encré dans le vrai jeu (ADR 0023): une capture par vue chez l'hôte et,
// pour le quai, chez l'invité; compteurs relevés au passage (appels, triangles, programmes,
// textures). Les images vont dans `LPL2_CAPTURES`, les mesures dans `mesures.json` à côté.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { BOARDING, CAPTURES, type Duo, type Side, startDuo } from '../aides-e2e/duo';

interface Stats {
  readonly place: string | null;
  readonly style: string;
  readonly calls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
  readonly inkTextureBytes: number;
  readonly width: number;
  readonly height: number;
  readonly tiles: { readonly pending: number } | null;
}

interface Probe {
  __lplSonde?: { stats(): Stats | null };
}

const measures: Record<string, Stats> = {};

/** Ajoute les mesures de ce parcours à celles déjà relevées (un fichier pour toutes les vues). */
function writeMeasures(): void {
  mkdirSync(CAPTURES, { recursive: true });
  const file = join(CAPTURES, 'mesures.json');
  const known = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, Stats>)
    : {};
  writeFileSync(file, JSON.stringify({ ...known, ...measures }, null, 1));
}

async function stats(side: Side): Promise<Stats> {
  const value = await side
    .game()
    .evaluate(() => (window as unknown as Probe).__lplSonde?.stats() ?? null);
  if (value === null) throw new Error('statistiques de rendu absentes');
  return value;
}

/** Attend que le lieu soit construit et que quelques images soient passées (rendu logiciel). */
async function settle(side: Side, place: string, ms = 9000): Promise<void> {
  await expect
    .poll(async () => (await stats(side)).place, { timeout: 120_000, intervals: [1000] })
    .toBe(place);
  await expect
    .poll(async () => (await stats(side)).tiles?.pending ?? 0, {
      timeout: 120_000,
      intervals: [1000],
    })
    .toBe(0);
  await side.page.waitForTimeout(ms);
}

async function shot(side: Side, name: string): Promise<void> {
  mkdirSync(CAPTURES, { recursive: true });
  // La machine capturée passe à la taille de référence (1366 x 768), puis redevient petite.
  await side.page.setViewportSize({ width: 1366, height: 768 });
  await side.page.waitForTimeout(Number(process.env.LPL2_POSE ?? 9000));
  measures[name] = await stats(side);
  const frame = await side.game().frameElement();
  await frame.screenshot({ path: join(CAPTURES, `${name}.png`), timeout: 120_000 });
  await side.page.setViewportSize({ width: 240, height: 135 });
  writeMeasures();
}

async function both(duo: Duo, x: number, y: number, facing = Math.PI / 2): Promise<void> {
  await duo.teleport(0, x, y, facing);
  await duo.teleport(1, x + 1.2, y + 0.4, facing);
}

const QUAY = { x: 203, y: 103.2 };

test('quai d’Aubrune, jour et nuit, hôte et invité, carnet ouvert', async ({ browser }) => {
  const duo = await startDuo(browser, 'encre-quai', { save: 'aubrune-apres-scene' });
  await both(duo, QUAY.x, QUAY.y);
  // 17 h: le jour dense de la fin d'après-midi (la référence de l'essai); 22 h: la nuit.
  await duo.setMinutes(17 * 60);
  await settle(duo.host, 'aubrune');
  await settle(duo.guest, 'aubrune', 3000);
  await shot(duo.host, 'jeu-encre-quai-jour-hote');
  await shot(duo.guest, 'jeu-encre-quai-jour-invite');
  await duo.setMinutes(22 * 60);
  await duo.host.page.waitForTimeout(6000);
  await shot(duo.host, 'jeu-encre-quai-nuit-hote');
  await shot(duo.guest, 'jeu-encre-quai-nuit-invite');
  await duo.host.press('KeyC');
  await expect(duo.host.game().locator('.lpl-ui .carnet')).toBeVisible();
  await shot(duo.host, 'jeu-encre-carnet');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

/** Monte dans le train à deux et attend l'arrivée à `to`. */
async function ride(duo: Duo, from: string, to: string): Promise<void> {
  const { stand, facing } = BOARDING[from] ?? { stand: [], facing: 0 };
  await duo.teleport(0, stand[0]?.x ?? 0, stand[0]?.y ?? 0, facing);
  await duo.teleport(1, stand[1]?.x ?? 0, stand[1]?.y ?? 0, facing);
  await duo.host.page.waitForTimeout(1500);
  await duo.host.press('Space');
  await duo.guest.press('Space');
  await duo.until(duo.host, `départ de ${from}`, (w) => w.common.phase === 'travel', 30_000);
  await duo.until(
    duo.host,
    `arrivée à ${to}`,
    (w) => w.common.place === to && w.common.phase !== 'travel',
    120_000,
  );
  await settle(duo.host, to, 5000);
}

test('aucune fuite: les compteurs reviennent après deux allers et retours', async ({ browser }) => {
  const duo = await startDuo(browser, 'encre-fuite');
  await settle(duo.host, 'essai-gare', 6000);
  const before = await stats(duo.host);
  await ride(duo, 'essai-gare', 'essai-halte');
  const away = await stats(duo.host);
  await ride(duo, 'essai-halte', 'essai-gare');
  const back = await stats(duo.host);
  await ride(duo, 'essai-gare', 'essai-halte');
  await ride(duo, 'essai-halte', 'essai-gare');
  const again = await stats(duo.host);
  measures['fuite-depart'] = before;
  measures['fuite-ailleurs'] = away;
  measures['fuite-retour-1'] = back;
  measures['fuite-retour-2'] = again;
  writeMeasures();
  // Textures et programmes reviennent à l'identique. Les géométries comptent aussi celles des
  // personnages présents (une par apparence d'habitant, selon l'heure): elles ne doivent pas
  // dépasser le compte du départ.
  expect(again.textures).toBe(back.textures);
  expect(back.textures).toBe(before.textures);
  expect(again.programs).toBe(back.programs);
  expect(back.geometries).toBeLessThanOrEqual(before.geometries);
  expect(again.geometries).toBeLessThanOrEqual(before.geometries);
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('place du bourg', async ({ browser }) => {
  const duo = await startDuo(browser, 'encre-place', { save: 'aubrune-apres-scene' });
  await both(duo, Number(process.env.LPL2_X ?? 204), Number(process.env.LPL2_Y ?? 124));
  await duo.setMinutes(Number(process.env.LPL2_MINUTES ?? 16 * 60 + 30));
  await settle(duo.host, 'aubrune');
  await shot(duo.host, process.env.LPL2_NOM ?? 'jeu-encre-place-bourg');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('gare d’essai', async ({ browser }) => {
  const duo = await startDuo(browser, 'encre-gare');
  await duo.setMinutes(16 * 60);
  await settle(duo.host, 'essai-gare');
  await shot(duo.host, 'jeu-encre-gare-essai');
  await duo.setMinutes(21 * 60 + 30);
  await duo.host.page.waitForTimeout(8000);
  await shot(duo.host, 'jeu-encre-gare-essai-nuit');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

/** Glisser au bouton droit: tourne la caméra de `pixels` points (0,35 degré par point). */
async function turn(side: Side, pixels: number): Promise<void> {
  await side.page.setViewportSize({ width: 1366, height: 768 });
  await side.page.mouse.move(400, 384);
  await side.page.mouse.down({ button: 'right' });
  await side.page.mouse.move(400 + pixels, 384, { steps: 12 });
  await side.page.mouse.up({ button: 'right' });
}

test('assis sur le banc du quai', async ({ browser }) => {
  const duo = await startDuo(browser, 'encre-assis', { save: 'aubrune-apres-scene' });
  // Le banc du quai regarde la voie (au nord): on s'y présente par le nord, tourné vers lui.
  await duo.teleport(0, 199.5, 99.7, Math.PI / 2);
  await duo.teleport(1, 200.5, 99.7, Math.PI / 2);
  await duo.setMinutes(Number(process.env.LPL2_MINUTES ?? 15 * 60));
  await settle(duo.host, 'aubrune');
  await settle(duo.guest, 'aubrune', 2000);
  await duo.host.press('Space');
  await duo.guest.press('Space');
  await duo.host.page.waitForTimeout(4000);
  await duo.host.page.setViewportSize({ width: 1366, height: 768 });
  await duo.host.page.mouse.move(683, 384);
  for (let i = 0; i < 12; i += 1) {
    await duo.host.page.mouse.wheel(0, -120);
    await duo.host.page.waitForTimeout(200);
  }
  await turn(duo.host, Number(process.env.LPL2_TOUR_1 ?? 386));
  await shot(duo.host, 'jeu-encre-assis-profil');
  await turn(duo.host, Number(process.env.LPL2_TOUR_2 ?? -130));
  await shot(duo.host, 'jeu-encre-assis-trois-quarts');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('trajet en train', async ({ browser }) => {
  const duo = await startDuo(browser, 'encre-trajet');
  const { stand, facing } = BOARDING['essai-gare'] ?? { stand: [], facing: 0 };
  await duo.teleport(0, stand[0]?.x ?? 0, stand[0]?.y ?? 0, facing);
  await duo.teleport(1, stand[1]?.x ?? 0, stand[1]?.y ?? 0, facing);
  await duo.setMinutes(16 * 60);
  await settle(duo.host, 'essai-gare', 3000);
  // La vue est déjà à la taille de référence au départ: le trajet ne dure qu'une dizaine de secondes.
  await duo.host.page.setViewportSize({ width: 1366, height: 768 });
  await duo.host.page.waitForTimeout(6000);
  await duo.host.press('Space');
  await duo.guest.press('Space');
  await duo.until(duo.host, 'départ', (w) => w.common.phase === 'travel', 30_000);
  await duo.host.page.waitForTimeout(Number(process.env.LPL2_TRAJET ?? 5500));
  mkdirSync(CAPTURES, { recursive: true });
  measures['jeu-encre-trajet'] = await stats(duo.host);
  const frame = await duo.host.game().frameElement();
  await frame.screenshot({ path: join(CAPTURES, 'jeu-encre-trajet.png'), timeout: 120_000 });
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('wagon du train de nuit, deux joueurs assis', async ({ browser }) => {
  const duo = await startDuo(browser, 'encre-wagon', { save: 'train-de-nuit-porte' });
  // Les banquettes du milieu de la travée: chacun se présente depuis le couloir, tourné vers la sienne.
  await duo.teleport(0, 4.1, 4.2, Math.atan2(-0.7, 0.6));
  await duo.teleport(1, 4.1, 4.8, Math.atan2(0.7, 0.6));
  await duo.setMinutes(21 * 60 + 30);
  await settle(duo.host, 'train-de-nuit', 3000);
  await settle(duo.guest, 'train-de-nuit', 1000);
  await duo.host.press('Space');
  await duo.guest.press('Space');
  await duo.host.page.waitForTimeout(3000);
  await shot(duo.host, 'jeu-encre-wagon');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test.afterAll(() => {
  if (Object.keys(measures).length > 0) writeMeasures();
});
