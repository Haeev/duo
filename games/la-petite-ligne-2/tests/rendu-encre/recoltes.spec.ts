// Récoltables d'Aubrune dans le vrai jeu (banc à deux vues, hors de la suite rapide): lisière
// (arbres, une souche, ronces cueillies), potager à tous ses états, coin de pêche, objets au sol.
// L'état est retouché chez l'hôte par la sonde (`patchPlace`) et arrive chez l'invité par le
// réseau, comme après de vrais gestes. Images dans `LPL2_CAPTURES` (préfixe `recoltes`),
// compteurs dans `mesures-recoltes.json`; `LPL2_INVITE=1` capture aussi la lisière chez l'invité.
//   pnpm exec vite build && pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts recoltes
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { CAPTURES, type Duo, type Side, startDuo } from '../aides-e2e/duo';

interface Stats {
  readonly place: string | null;
  readonly calls: number;
  readonly triangles: number;
  readonly programs: number;
  readonly tiles: { readonly pending: number; readonly triangles: number } | null;
}

interface Probe {
  __lplSonde?: {
    stats(): Stats | null;
    patchPlace(patch: unknown): boolean;
    setCamera(yawDeg: number, width: number): boolean;
  };
}

const PREFIX = process.env.LPL2_PREFIXE ?? 'recoltes';
const POSE = Number(process.env.LPL2_POSE ?? 8000);
const measures: Record<string, Stats> = {};

async function stats(side: Side): Promise<Stats> {
  const value = await side
    .game()
    .evaluate(() => (window as unknown as Probe).__lplSonde?.stats() ?? null);
  if (value === null) throw new Error('statistiques de rendu absentes');
  return value;
}

async function settle(side: Side, ms: number): Promise<void> {
  await expect
    .poll(async () => (await stats(side)).place, { timeout: 120_000, intervals: [1000] })
    .toBe('aubrune');
  await side.page.waitForTimeout(1500);
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
  await side.page.setViewportSize({ width: 1366, height: 768 });
  await side.page.waitForTimeout(POSE);
  measures[name] = await stats(side);
  const frame = await side.game().frameElement();
  await frame.screenshot({ path: join(CAPTURES, `${PREFIX}-${name}.png`), timeout: 120_000 });
  writeFileSync(join(CAPTURES, `mesures-${PREFIX}.json`), JSON.stringify(measures, null, 1));
  await side.page.setViewportSize({ width: 240, height: 135 });
}

async function patch(side: Side, value: unknown): Promise<void> {
  const ok = await side
    .game()
    .evaluate((p) => (window as unknown as Probe).__lplSonde?.patchPlace(p) ?? false, value);
  if (!ok) throw new Error('sonde: patchPlace refusé');
}

async function camera(side: Side, yaw: number, width: number): Promise<void> {
  await side
    .game()
    .evaluate((view) => (window as unknown as Probe).__lplSonde?.setCamera(view.yaw, view.width), {
      yaw,
      width,
    });
}

async function both(duo: Duo, x: number, y: number, facing = Math.PI / 2): Promise<void> {
  await duo.teleport(0, x, y, facing);
  await duo.teleport(1, x + 1.2, y + 0.4, facing);
}

const env = (name: string, fallback: number): number => Number(process.env[name] ?? fallback);

test('récoltables: lisière, potager, pêche, objets au sol', async ({ browser }) => {
  const duo = await startDuo(browser, 'recoltes', { save: 'aubrune-apres-scene' });
  const host = duo.host;
  const world = await host.world();
  const day = world?.common.day ?? 1;
  const minute = (day - 1) * 1440 + 16 * 60;
  const later = { harvest: { work: 0, back: day + 3 } };
  const plot = { growth: 0, watered: false, days: 1, wet: 0, day };
  // Potager de 6 x 4: une rangée par culture, les états de gauche à droite.
  const cells = [
    { ...plot, crop: null },
    { ...plot, crop: null, watered: true },
    null,
    { ...plot, crop: null },
    null,
    { ...plot, crop: null, watered: true },
    { ...plot, crop: 'radis' },
    { ...plot, crop: 'radis', watered: true },
    { ...plot, crop: 'radis', growth: 2 },
    { ...plot, crop: 'radis', growth: 2, watered: true },
    { ...plot, crop: 'radis', growth: 4 },
    { ...plot, crop: 'radis', growth: 4 },
    { ...plot, crop: 'tomate' },
    { ...plot, crop: 'tomate', watered: true },
    { ...plot, crop: 'tomate', growth: 2 },
    { ...plot, crop: 'tomate', growth: 2, watered: true },
    { ...plot, crop: 'tomate', growth: 5 },
    { ...plot, crop: 'tomate', growth: 8 },
    { ...plot, crop: 'tomate', growth: 5, watered: true },
    { ...plot, crop: 'radis', growth: 2 },
    null,
    { ...plot, crop: null },
    { ...plot, crop: 'radis', watered: true },
    { ...plot, crop: 'tomate', growth: 8 },
  ];
  await patch(host, {
    objects: {
      'chene-lisiere-3': later,
      'pose-900': { harvest: { work: 0, back: day + 1 } },
      'branches-lisiere': later,
      'ronces-maison-1': { harvest: { work: 0, back: day + 1 } },
      'ronces-maison-2': { harvest: { work: 0, back: day + 1 } },
      'ronces-tranchee-1': { harvest: { work: 0, back: day + 1 } },
      'bois-maison': { gather: { left: 0, refillAt: minute + 600 } },
      'caillou-greve-2': { harvest: { work: 1, back: null } },
      potager: { field: { cells, work: null } },
    },
    ground: [
      { id: 0, stack: { item: 'pierre', count: 1 }, x: 200.6, y: 125.6 },
      { id: 1, stack: { item: 'buche', count: 2 }, x: 202.2, y: 126.4 },
      { id: 2, stack: { item: 'coquelicot', count: 1 }, x: 203.4, y: 125.2 },
      { id: 3, stack: { item: 'pomme', count: 3 }, x: 201.4, y: 127.4 },
      { id: 4, stack: { item: 'vieille-piece', count: 1 }, x: 203.2, y: 127.6 },
    ],
    // Des ronces au pied de la lisière (posées pour la vue: la carte n'en a pas là), cueillies.
    placed: [{ id: 'pose-900', type: 'ronces', x: 195, y: 87.6, rotation: 0 }],
  });

  // Lisière: chênes (l'un abattu), branches ramassées, bois semé derrière.
  await both(duo, env('LPL2_LISIERE_X', 192.5), env('LPL2_LISIERE_Y', 89));
  await duo.setMinutes(16 * 60);
  await settle(host, 4000);
  await camera(host, env('LPL2_LISIERE_LACET', 0), env('LPL2_LISIERE_LARGEUR', 22));
  await shot(host, 'lisiere');
  if (process.env.LPL2_INVITE === '1') {
    await settle(duo.guest, 4000);
    await camera(duo.guest, env('LPL2_LISIERE_LACET', 0), env('LPL2_LISIERE_LARGEUR', 22));
    await shot(duo.guest, 'lisiere-invite');
  }

  // Potager, ronces de la maison cueillies, tas de bois vide.
  await both(duo, env('LPL2_POTAGER_X', 176.5), env('LPL2_POTAGER_Y', 125.8));
  await settle(host, 4000);
  await camera(host, env('LPL2_POTAGER_LACET', 45), 16);
  await shot(host, 'potager');

  // Coin de pêche du ponton, galets de la grève (l'un entamé).
  await both(duo, env('LPL2_PECHE_X', 195.5), env('LPL2_PECHE_Y', 127.2));
  await settle(host, 4000);
  await camera(host, env('LPL2_PECHE_LACET', 0), 18);
  await shot(host, 'peche');

  if (process.env.LPL2_FORET === '1') {
    // Mesure seulement: le bois le plus dense du lieu (végétation semée, pire cas du budget).
    await both(duo, env('LPL2_FORET_X', 48), env('LPL2_FORET_Y', 16));
    await settle(host, 4000);
    await camera(host, 45, 18);
    await shot(host, 'foret');
  }

  // Objets au sol: pierre, bûches, coquelicot (modèles de leur ressource), pommes et pièce (ballots).
  await both(duo, 202.4, 124.2);
  await settle(host, 3000);
  await camera(host, env('LPL2_SOL_LACET', 45), 10);
  await shot(host, 'objets-au-sol');

  expect(duo.errors).toEqual([]);
  await duo.close();
});
