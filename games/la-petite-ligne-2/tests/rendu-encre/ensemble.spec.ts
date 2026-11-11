// Contrôle visuel d'ensemble du dehors d'Aubrune dans le vrai jeu (banc à deux vues, hors de la
// suite rapide): quai de jour et de nuit, rue du bourg, lisière, potager, berge, entrée de la
// maison (dehors, puis dedans à midi et le soir), objets au sol, bois dense (compteurs), wagon.
// Les états des récoltes sont ceux de `recoltes.spec.ts` (retouchés chez l'hôte par la sonde).
// Images dans `LPL2_CAPTURES` (préfixe `ensemble`), compteurs dans `mesures-ensemble.json`;
// `LPL2_VUES=lisiere,bois` ne joue que ces vues; `LPL2_PASSES=1` ouvre l'outil de mesure et relève
// en plus les compteurs de chaque passe (ombre du soleil, ombre de la lampe, scène, contour).
//   pnpm exec vite build && pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts ensemble
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { CAPTURES, type Duo, type Side, startDuo } from '../aides-e2e/duo';

interface Stats {
  readonly place: string | null;
  readonly calls: number;
  readonly triangles: number;
  readonly programs: number;
  readonly tiles: { readonly pending: number; readonly triangles: number } | null;
  /** Appels et triangles par passe (`LPL2_PASSES=1`): ombre du soleil, de la lampe, scène, contour. */
  passes?: readonly { readonly calls: number; readonly triangles: number }[];
}

interface Probe {
  __lplSonde?: {
    stats(): Stats | null;
    patchPlace(patch: unknown): boolean;
    setCamera(yawDeg: number, width: number): boolean;
  };
  __lplMesure?: {
    passes(): readonly { readonly calls: number; readonly triangles: number }[];
  };
}

/** Une vue: où se tiennent les deux joueurs, l'heure, et le cadrage s'il n'est pas celui du jeu. */
interface View {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly minutes: number;
  readonly yaw?: number;
  readonly width?: number;
}

const PREFIX = process.env.LPL2_PREFIXE ?? 'ensemble';
const POSE = Number(process.env.LPL2_POSE ?? 8000);
const ONLY = process.env.LPL2_VUES?.split(',') ?? null;
const PASSES = process.env.LPL2_PASSES === '1';
const FILE = join(CAPTURES, `mesures-${PREFIX}.json`);
const measures: Record<string, Stats> = existsSync(FILE)
  ? (JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, Stats>)
  : {};

/** Cadrage du jeu (lacet et largeur de départ), remis après une vue cadrée. */
const DEFAULT_VIEW = { yaw: 45, width: 18 };

const VIEWS: readonly View[] = [
  { name: 'quai-jour', x: 203, y: 103.2, minutes: 17 * 60 },
  { name: 'quai-nuit', x: 203, y: 103.2, minutes: 22 * 60 },
  { name: 'rue-du-bourg', x: 204, y: 124, minutes: 16 * 60 + 30 },
  // Foyers de lumière de la nuit: rue et café, place, tombée du jour, comptoir du café.
  { name: 'nuit-rue-du-bourg', x: 227, y: 109.5, minutes: 21 * 60, yaw: 0, width: 24 },
  { name: 'nuit-place', x: 205.5, y: 122, minutes: 23 * 60 + 30 },
  { name: 'crepuscule-rue', x: 227, y: 109.5, minutes: 19 * 60 + 30, yaw: 0, width: 24 },
  // Cadrage du jeu (lacet 45, 18 m): plus de vue de face rapprochée, prise à tort pour une vue de dessus.
  { name: 'comptoir-non-estompe', x: 109.6, y: 210.6, minutes: 10 * 60 },
  { name: 'lisiere', x: 192.5, y: 89, minutes: 16 * 60, yaw: 0, width: 22 },
  { name: 'potager', x: 176.5, y: 125.8, minutes: 16 * 60, width: 16 },
  { name: 'berge', x: 195.5, y: 127.2, minutes: 16 * 60, yaw: 0, width: 18 },
  { name: 'objets-au-sol', x: 202.4, y: 124.2, minutes: 16 * 60, width: 10 },
  { name: 'maison-dehors', x: 181.2, y: 116.2, minutes: 16 * 60 },
  // La pièce du rez-de-chaussée de la maison du garde (`interieurs/maison-rdc.json`, en 14, 210).
  { name: 'maison-midi', x: 17.5, y: 213.5, minutes: 12 * 60 },
  { name: 'maison-soir', x: 17.5, y: 213.5, minutes: 20 * 60 + 30 },
  // Le dortoir de la pension (`interieurs/epicerie-etage.json`): ses cloisons coupées.
  { name: 'pension-midi', x: 61.5, y: 214.5, minutes: 12 * 60 },
  // Contrôles des volumes remplacés: la clôture de la voie (modèle livré), l'église (son clocher
  // est dans le modèle: plus de tour provisoire par-dessus).
  { name: 'cloture', x: 151, y: 101.5, minutes: 16 * 60, yaw: 0, width: 16 },
  { name: 'eglise', x: 252, y: 82, minutes: 16 * 60, yaw: 0, width: 28 },
  // L'orée du bois hors jeu, vue du couloir: arbres semés entiers au bord, allégés au fond.
  { name: 'oree', x: 104, y: 90, minutes: 16 * 60, yaw: 0, width: 22 },
  // Repères livrés: le château d'eau de la halte (vidange côté voie) et la roue dans son bief.
  { name: 'chateau-d-eau', x: 193, y: 85.5, minutes: 16 * 60, yaw: 0, width: 24 },
  { name: 'moulin', x: 138.5, y: 131.5, minutes: 16 * 60, yaw: 0, width: 22 },
  // La berge en talus au nord du bourg (relief du sol), le labour et ses rangs près du
  // pigeonnier (cadré sur le champ: le carré de potager en haut, le chemin, les sillons).
  { name: 'talus', x: 196, y: 141.5, minutes: 16 * 60, yaw: 0, width: 18 },
  { name: 'ferme', x: 220, y: 162, minutes: 16 * 60, yaw: 0, width: 26 },
  { name: 'tunnel', x: 361, y: 59, minutes: 16 * 60, yaw: 0, width: 30 },
  // Le bois le plus dense du lieu (végétation semée): la vue du budget.
  { name: 'bois', x: 48, y: 16, minutes: 16 * 60, width: 18 },
];

async function stats(side: Side): Promise<Stats> {
  const value = await side
    .game()
    .evaluate(() => (window as unknown as Probe).__lplSonde?.stats() ?? null);
  if (value === null) throw new Error('statistiques de rendu absentes');
  return value;
}

async function settle(side: Side, place: string, ms: number): Promise<void> {
  await expect
    .poll(async () => (await stats(side)).place, { timeout: 120_000, intervals: [1000] })
    .toBe(place);
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
  const measure = await stats(side);
  measures[name] = measure;
  const panel = side.game().locator('[data-lpl-mesure]');
  // Le panneau de mesure n'est ouvert que dans le parcours du dehors.
  const metered = PASSES && (await panel.count()) > 0;
  if (metered) {
    measure.passes = await side.game().evaluate(() =>
      ((window as unknown as Probe).__lplMesure?.passes() ?? []).map((p) => ({
        calls: p.calls,
        triangles: p.triangles,
      })),
    );
    // Le panneau reste ouvert et mesure, mais ne paraît pas sur l'image.
    await panel.evaluate((node) => {
      (node as HTMLElement).style.visibility = 'hidden';
    });
  }
  const frame = await side.game().frameElement();
  await frame.screenshot({ path: join(CAPTURES, `${PREFIX}-${name}.png`), timeout: 120_000 });
  if (metered)
    await panel.evaluate((node) => {
      (node as HTMLElement).style.visibility = '';
    });
  writeFileSync(FILE, JSON.stringify(measures, null, 1));
  await side.page.setViewportSize({ width: 240, height: 135 });
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

/** Avertissements et erreurs de console des deux machines (les erreurs sont déjà dans `duo.errors`). */
function listenWarnings(duo: Duo, into: string[]): void {
  for (const side of [duo.host, duo.guest])
    side.page.on('console', (m) => {
      if (m.type() === 'warning') into.push(`${side.who}: ${m.text()}`);
    });
}

test('ensemble: le dehors d’Aubrune et la maison du garde', async ({ browser }) => {
  const duo = await startDuo(browser, 'ensemble', { save: 'aubrune-apres-scene' });
  const warnings: string[] = [];
  listenWarnings(duo, warnings);
  const host = duo.host;
  const world = await host.world();
  const day = world?.common.day ?? 1;
  const minute = (day - 1) * 1440 + 16 * 60;
  const later = { harvest: { work: 0, back: day + 3 } };
  const soon = { harvest: { work: 0, back: day + 1 } };
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
  const ok = await host
    .game()
    .evaluate((p) => (window as unknown as Probe).__lplSonde?.patchPlace(p) ?? false, {
      objects: {
        'chene-lisiere-3': later,
        'branches-lisiere': later,
        'ronces-maison-1': soon,
        'ronces-maison-2': soon,
        'bois-maison': { gather: { left: 0, refillAt: minute + 600 } },
        'caillou-greve-2': { harvest: { work: 1, back: null } },
        potager: { field: { cells, work: null } },
      },
      // Le dernier (pommes) est demandé au pied du banc du ponton: il ne doit pas finir dessous.
      ground: [
        { id: 0, stack: { item: 'pierre', count: 1 }, x: 200.6, y: 125.6 },
        { id: 1, stack: { item: 'buche', count: 2 }, x: 202.2, y: 126.4 },
        { id: 2, stack: { item: 'coquelicot', count: 1 }, x: 203.4, y: 125.2 },
        { id: 3, stack: { item: 'vieille-piece', count: 1 }, x: 203.2, y: 127.6 },
        { id: 4, stack: { item: 'pomme', count: 3 }, x: 201.4, y: 128.2 },
      ],
    });
  expect(ok).toBe(true);
  if (PASSES) {
    await host.press('F9');
    await expect(host.game().locator('[data-lpl-mesure]')).toBeVisible({ timeout: 60_000 });
  }

  for (const view of VIEWS) {
    if (ONLY !== null && !ONLY.includes(view.name)) continue;
    await both(duo, view.x, view.y);
    await duo.setMinutes(view.minutes);
    await settle(host, 'aubrune', 4000);
    await camera(host, view.yaw ?? DEFAULT_VIEW.yaw, view.width ?? DEFAULT_VIEW.width);
    await shot(host, view.name);
  }

  writeFileSync(join(CAPTURES, `console-${PREFIX}.json`), JSON.stringify(warnings, null, 1));
  expect(duo.errors).toEqual([]);
  await duo.close();
});

/** Appelle une méthode de réglage de la sonde chez l'hôte (jour, faits): `false` si refusée. */
async function probe(
  side: Side,
  method: 'setDay' | 'remember',
  args: readonly unknown[],
): Promise<void> {
  const ok = await side.game().evaluate(
    ([m, a]) => {
      const sonde = (
        window as unknown as { __lplSonde?: Record<string, (...x: unknown[]) => boolean> }
      ).__lplSonde;
      return sonde?.[m]?.(...a) ?? false;
    },
    [method, args] as const,
  );
  if (!ok) throw new Error(`sonde: ${method} refusé`);
}

// Les trains des événements (`rendu/lieu/trains.ts`): le train du samedi à quai à midi et à
// l'arrivée, l'autorail de 5 h 12 la nuit, vitres allumées, le Contrôleur sur le quai.
/**
 * Cadrage des trains: `LPL2_LARGEUR_TRAINS=9` pour regarder roues et marchepieds de près,
 * `LPL2_LACET_TRAINS=200` pour voir du nord l'ombre portée, `LPL2_HEURE_TRAIN` (minutes) pour la vue à quai.
 */
const TRAIN_WIDTH = Number(process.env.LPL2_LARGEUR_TRAINS ?? 24);
const TRAIN_YAW = Number(process.env.LPL2_LACET_TRAINS ?? 20);

test('ensemble: les trains', async ({ browser }) => {
  test.skip(ONLY !== null && !ONLY.some((v) => v.startsWith('train')), 'vue non demandée');
  const duo = await startDuo(browser, 'ensemble-trains', { save: 'aubrune-apres-scene' });
  const host = duo.host;
  const day = (await host.world())?.common.day ?? 1;
  // Le premier samedi à partir du jour de la sauvegarde (la semaine commence un lundi, jour 1).
  const saturday = day + ((5 - ((day - 1) % 7) + 7) % 7);
  await probe(host, 'setDay', [saturday]);
  await probe(host, 'remember', ['aubrune.acte2.fini']);
  await probe(host, 'remember', ['aubrune.depart.fait']);

  // Midi: la voiture au droit du quai, les deux joueurs au bord du quai devant elle.
  await both(duo, 201, 100.4);
  await duo.setMinutes(Number(process.env.LPL2_HEURE_TRAIN ?? 12 * 60));
  await settle(host, 'aubrune', 4000);
  await camera(host, TRAIN_YAW, TRAIN_WIDTH);
  await shot(host, 'train-samedi-a-quai');

  // L'arrivée: la rame ralentit et entre (arrêt à 10 h 04), l'heure posée juste avant l'image.
  await duo.setMinutes(10 * 60 + 4 - 3);
  await host.page.setViewportSize({ width: 1366, height: 768 });
  await host.page.waitForTimeout(1500);
  measures['train-samedi-arrivee'] = await stats(host);
  const frame = await host.game().frameElement();
  await frame.screenshot({
    path: join(CAPTURES, `${PREFIX}-train-samedi-arrivee.png`),
    timeout: 120_000,
  });
  writeFileSync(FILE, JSON.stringify(measures, null, 1));
  await host.page.setViewportSize({ width: 240, height: 135 });

  // L'autorail de 5 h 12, à quai la nuit: vitres et lampes allumées, le Contrôleur sur le quai.
  await duo.setMinutes(5 * 60 + 25);
  await settle(host, 'aubrune', 4000);
  await camera(host, TRAIN_YAW, TRAIN_WIDTH);
  await shot(host, 'autorail-5h12');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('ensemble: le wagon du train de nuit', async ({ browser }) => {
  test.skip(ONLY !== null && !ONLY.includes('wagon'), 'vue non demandée');
  const duo = await startDuo(browser, 'ensemble-wagon', { save: 'train-de-nuit-porte' });
  await duo.teleport(0, 4.1, 4.2, Math.atan2(-0.7, 0.6));
  await duo.teleport(1, 4.1, 4.8, Math.atan2(0.7, 0.6));
  await duo.setMinutes(21 * 60 + 30);
  await settle(duo.host, 'train-de-nuit', 3000);
  await shot(duo.host, 'wagon');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
