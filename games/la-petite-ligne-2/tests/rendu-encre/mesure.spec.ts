// Banc de mesure du rendu encré (ADR 0023, points 11 et 12), hors de la suite rapide:
//   pnpm exec vite build && pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts mesure
// Il ouvre l'outil de mesure par sa touche (F9), relève les compteurs de chaque passe au quai
// d'Aubrune (jour, nuit) et dans le wagon, capture la même vue à chaque échelle interne et écrit
// le relevé en texte. Images et `mesure.json` dans `LPL2_CAPTURES`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { CAPTURES, type Duo, type Side, startDuo } from '../aides-e2e/duo';

interface Pass {
  readonly calls: number;
  readonly triangles: number;
  readonly pixels: number;
}

interface Snapshot {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly scale: number;
  readonly programs: number;
  readonly textures: number;
  readonly textureMegabytes: number;
  readonly chart: { readonly expected: readonly number[]; readonly read: readonly number[] } | null;
}

interface Probe {
  __lplMesure?: {
    snapshot(): Snapshot;
    programs(): string[];
    summary(): { frames: number; averageFps: number; lowFps: number; cpuMs: number };
    passes(): readonly Pass[];
    report(): string | null;
    setScale(scale: number | null): void;
  };
}

interface Measure {
  readonly passes: readonly Pass[];
  readonly snapshot: Snapshot;
  readonly programs: readonly string[];
}

const measures: Record<string, Measure> = {};
const POSE = Number(process.env.LPL2_POSE ?? 9000);

function save(): void {
  mkdirSync(CAPTURES, { recursive: true });
  writeFileSync(join(CAPTURES, 'mesure.json'), JSON.stringify(measures, null, 1));
}

async function openMeter(side: Side): Promise<void> {
  await side.press('F9');
  await expect
    .poll(
      () => side.game().evaluate(() => (window as unknown as Probe).__lplMesure !== undefined),
      { timeout: 60_000, intervals: [500] },
    )
    .toBe(true);
  await expect(side.game().locator('[data-lpl-mesure]')).toBeVisible();
}

async function read(side: Side): Promise<Measure> {
  return side.game().evaluate(() => {
    const probe = (window as unknown as Probe).__lplMesure;
    if (probe === undefined) throw new Error('outil de mesure fermé');
    return {
      passes: probe
        .passes()
        .map((p) => ({ calls: p.calls, triangles: p.triangles, pixels: p.pixels })),
      snapshot: probe.snapshot(),
      programs: probe.programs(),
    };
  });
}

async function setScale(side: Side, scale: number | null): Promise<void> {
  await side.game().evaluate((value) => {
    (window as unknown as Probe).__lplMesure?.setScale(value);
  }, scale);
}

/** Capture à 1366 x 768 avec le panneau caché (il reste ouvert et mesure), puis relevé. */
async function shot(side: Side, name: string, width = 1366, height = 768): Promise<void> {
  mkdirSync(CAPTURES, { recursive: true });
  await side.page.setViewportSize({ width, height });
  await side.page.waitForTimeout(POSE);
  measures[name] = await read(side);
  const panel = side.game().locator('[data-lpl-mesure]');
  await panel.evaluate((node) => {
    (node as HTMLElement).style.visibility = 'hidden';
  });
  const frame = await side.game().frameElement();
  await frame.screenshot({ path: join(CAPTURES, `${name}.png`), timeout: 120_000 });
  await panel.evaluate((node) => {
    (node as HTMLElement).style.visibility = '';
  });
  await side.page.setViewportSize({ width: 240, height: 135 });
  save();
}

async function settle(duo: Duo, place: string): Promise<void> {
  await duo.until(duo.host, `lieu ${place}`, (w) => w.common.place === place, 120_000);
  await duo.host.page.waitForTimeout(9000);
}

const QUAY = { x: 203, y: 103.2 };

test('mesure: quai d’Aubrune, jour et nuit, échelles, relevé', async ({ browser }) => {
  const duo = await startDuo(browser, 'mesure-quai', { save: 'aubrune-apres-scene' });
  await duo.teleport(0, QUAY.x, QUAY.y, Math.PI / 2);
  await duo.teleport(1, QUAY.x + 1.2, QUAY.y + 0.4, Math.PI / 2);
  await duo.setMinutes(17 * 60);
  await settle(duo, 'aubrune');
  await openMeter(duo.host);
  await openMeter(duo.guest);
  // Petite fenêtre: le rendu logiciel y tient un rythme mesurable, le journal des images se remplit.
  await duo.host.page.waitForTimeout(8000);
  const rhythm = await duo.host
    .game()
    .evaluate(() => (window as unknown as Probe).__lplMesure?.summary() ?? null);
  mkdirSync(CAPTURES, { recursive: true });
  writeFileSync(join(CAPTURES, 'rythme.json'), JSON.stringify(rhythm, null, 1));
  expect(rhythm?.frames ?? 0).toBeGreaterThan(5);
  expect(rhythm?.averageFps ?? 0).toBeGreaterThan(0);
  expect(rhythm?.lowFps ?? 0).toBeLessThanOrEqual(rhythm?.averageFps ?? 0);
  await shot(duo.host, 'mesure-quai-jour-hote');
  await shot(duo.guest, 'mesure-quai-jour-invite');
  for (const scale of [0.9, 0.8, 0.7]) {
    await setScale(duo.host, scale);
    await shot(duo.host, `mesure-quai-jour-echelle-${String(scale * 100)}`);
  }
  await setScale(duo.host, null);
  // Le relevé en texte, avec le panneau visible (ce que le joueur verra).
  await duo.host.page.setViewportSize({ width: 1366, height: 768 });
  await duo.host.page.waitForTimeout(POSE);
  await duo.host.game().getByRole('button', { name: 'Copier le relevé' }).click();
  const report = await duo.host
    .game()
    .evaluate(() => (window as unknown as Probe).__lplMesure?.report() ?? null);
  expect(report).not.toBeNull();
  writeFileSync(join(CAPTURES, 'releve.txt'), report ?? '');
  await duo.host.page.screenshot({ path: join(CAPTURES, 'mesure-panneau.png'), timeout: 120_000 });
  await duo.host.page.setViewportSize({ width: 240, height: 135 });
  const chart = (await read(duo.host)).snapshot.chart;
  expect(chart).not.toBeNull();
  chart?.expected.forEach((value, i) => {
    expect(Math.abs(value - (chart.read[i] ?? 0))).toBeLessThanOrEqual(1);
  });
  await duo.setMinutes(22 * 60);
  await duo.host.page.waitForTimeout(6000);
  await shot(duo.host, 'mesure-quai-nuit-hote');
  await shot(duo.guest, 'mesure-quai-nuit-invite');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('mesure: wagon du train de nuit', async ({ browser }) => {
  const duo = await startDuo(browser, 'mesure-wagon', { save: 'train-de-nuit-porte' });
  await duo.teleport(0, 4.1, 4.2, Math.atan2(-0.7, 0.6));
  await duo.teleport(1, 4.1, 4.8, Math.atan2(0.7, 0.6));
  await duo.setMinutes(21 * 60 + 30);
  await settle(duo, 'train-de-nuit');
  await duo.host.press('Space');
  await duo.guest.press('Space');
  await duo.host.page.waitForTimeout(3000);
  await openMeter(duo.host);
  await shot(duo.host, 'mesure-wagon');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('mesure: écran dense (rapport de pixels 2), même composition', async ({ browser }) => {
  const duo = await startDuo(browser, 'mesure-dense', { save: 'aubrune-apres-scene' });
  await duo.teleport(0, QUAY.x, QUAY.y, Math.PI / 2);
  await duo.teleport(1, QUAY.x + 1.2, QUAY.y + 0.4, Math.PI / 2);
  await duo.setMinutes(17 * 60);
  await settle(duo, 'aubrune');
  await openMeter(duo.host);
  // Écran à forte densité (comme un Retina): même fenêtre en points, deux fois plus de pixels.
  const session = await duo.host.page.context().newCDPSession(duo.host.page);
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await duo.host.page.waitForTimeout(POSE * 2);
  measures['mesure-quai-jour-dense'] = await read(duo.host);
  const panel = duo.host.game().locator('[data-lpl-mesure]');
  await panel.evaluate((node) => {
    (node as HTMLElement).style.visibility = 'hidden';
  });
  // Capture par le protocole du navigateur: celle de Playwright remettrait l'écran à sa densité
  // d'origine. L'image sort en pixels physiques (2 880 x 1 800).
  const shot = await session.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(CAPTURES, 'mesure-quai-jour-dense.png'), Buffer.from(shot.data, 'base64'));
  save();
  expect(duo.errors).toEqual([]);
  await duo.close();
});
