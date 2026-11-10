// Vues du sol en relief dans le vrai jeu (banc à deux vues, hors de la suite rapide): quai de
// jour et de nuit, place du bourg, chemin de terre au zoom serré. Images dans `LPL2_CAPTURES`
// (préfixe `LPL2_PREFIXE`, « relief » par défaut), compteurs dans `mesures-relief.json` à côté.
//   pnpm exec vite build && pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts relief
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
  __lplSonde?: { stats(): Stats | null };
}

const PREFIX = process.env.LPL2_PREFIXE ?? 'relief';
const POSE = Number(process.env.LPL2_POSE ?? 9000);
const measures: Record<string, Stats> = {};

async function stats(side: Side): Promise<Stats> {
  const value = await side
    .game()
    .evaluate(() => (window as unknown as Probe).__lplSonde?.stats() ?? null);
  if (value === null) throw new Error('statistiques de rendu absentes');
  return value;
}

/** Attend que les tuiles autour du joueur soient construites, puis quelques images. */
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
}

async function both(duo: Duo, x: number, y: number, facing = Math.PI / 2): Promise<void> {
  await duo.teleport(0, x, y, facing);
  await duo.teleport(1, x + 1.2, y + 0.4, facing);
}

/** Molette vers l'avant: la vue se resserre d'un cran par coup. */
async function zoomIn(side: Side, notches: number): Promise<void> {
  await side.page.mouse.move(683, 384);
  for (let i = 0; i < notches; i += 1) {
    await side.page.mouse.wheel(0, -120);
    await side.page.waitForTimeout(200);
  }
}

test('sol en relief: quai, bourg, chemin', async ({ browser }) => {
  const duo = await startDuo(browser, 'relief', { save: 'aubrune-apres-scene' });
  const host = duo.host;
  // Quai, 17 h (jour dense de la fin d'après-midi), puis 22 h.
  await both(duo, 203, 103.2);
  await duo.setMinutes(17 * 60);
  await settle(host, 6000);
  await shot(host, 'quai-jour');
  await duo.setMinutes(22 * 60);
  await host.page.waitForTimeout(6000);
  await shot(host, 'quai-nuit');
  // Place du bourg: pompe, rue dallée, chemin de terre qui la quitte.
  await both(duo, Number(process.env.LPL2_BOURG_X ?? 204), Number(process.env.LPL2_BOURG_Y ?? 124));
  await duo.setMinutes(16 * 60 + 30);
  await settle(host, 6000);
  await shot(host, 'bourg-jour');
  // Chemin de terre, zoom serré: le creux, le talus d'herbe, les cailloux posés dessus.
  await both(
    duo,
    Number(process.env.LPL2_CHEMIN_X ?? 199),
    Number(process.env.LPL2_CHEMIN_Y ?? 91.2),
  );
  await duo.setMinutes(Number(process.env.LPL2_CHEMIN_MINUTES ?? 17 * 60 + 30));
  await settle(host, 4000);
  await zoomIn(host, Number(process.env.LPL2_ZOOM ?? 8));
  await shot(host, 'chemin-pres');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('l’ancien rendu (`?rendu=aplats`) marche toujours, sol plan', async ({ browser }) => {
  // L'invité seul passe en aplats (route posée après celle de la sonde: elle prend le pas).
  const duo = await startDuo(browser, 'relief-aplats', {
    save: 'aubrune-apres-scene',
    onGuestPage: (page) => {
      void page.route(
        (url) => url.pathname === '/jeu/' && url.search === '',
        (route) =>
          route.fulfill({ status: 302, headers: { location: '/jeu/?sonde=1&rendu=aplats' } }),
      );
    },
  });
  await both(duo, 203, 103.2);
  await duo.setMinutes(17 * 60);
  await settle(duo.guest, 4000);
  await shot(duo.guest, 'aplats-quai');
  expect((measures['aplats-quai'] as Stats & { style?: string }).style).toBe('aplats');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
