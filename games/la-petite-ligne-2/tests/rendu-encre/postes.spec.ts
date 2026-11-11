// Habitants à leur poste dans les pièces, à la caméra de jeu (banc de captures, hors de la suite
// rapide et de la recette): Achille derrière le comptoir du fournil, Odette derrière celui de
// l'épicerie, le contrôleur dans le couloir du wagon, la cuisine de la maison du garde. Cadrage du
// jeu: plongée de 50 degrés au zoom de départ (18 m), lacet sur l'une des quatre diagonales, celle
// qui montre le comptoir côté clients. Images dans `LPL2_CAPTURES`, préfixe `postes`.
//   pnpm exec vite build && pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts postes
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { CAPTURES, type Duo, type Side, startDuo } from '../aides-e2e/duo';

interface Probe {
  __lplSonde?: {
    stats(): { readonly place: string | null } | null;
    setCamera(yawDeg: number, width: number): boolean;
  };
}

const SIZE = { width: 1366, height: 768 } as const;
const POSE = Number(process.env.LPL2_POSE ?? 6000);
/** Largeur de vue au départ du jeu (`INK_SETTINGS.camera.defaultWidth`): plongée entière. */
const GAME_WIDTH = 18;

async function shot(side: Side, name: string): Promise<void> {
  mkdirSync(CAPTURES, { recursive: true });
  const frame = await side.game().frameElement();
  await frame.screenshot({ path: join(CAPTURES, `postes-${name}.png`), timeout: 120_000 });
}

async function camera(side: Side, yaw: number): Promise<void> {
  await side
    .game()
    .evaluate((v) => (window as unknown as Probe).__lplSonde?.setCamera(v.yaw, v.width), {
      yaw,
      width: GAME_WIDTH,
    });
}

async function ready(duo: Duo, place: string): Promise<[number, number]> {
  for (const side of [duo.host, duo.guest])
    await expect
      .poll(
        async () =>
          await side
            .game()
            .evaluate(() => (window as unknown as Probe).__lplSonde?.stats()?.place ?? null),
        { timeout: 120_000, intervals: [1000] },
      )
      .toBe(place);
  return [await duo.host.local(), await duo.guest.local()];
}

/** Une vue: les deux joueurs côté clients, l'heure d'ouverture, le lacet de jeu, la capture. */
async function view(
  duo: Duo,
  players: readonly [number, number],
  spots: readonly [readonly [number, number, number], readonly [number, number, number]],
  yaw: number,
  name: string,
): Promise<void> {
  const [a, b] = spots;
  await duo.teleport(players[0], a[0], a[1], a[2]);
  await duo.teleport(players[1], b[0], b[1], b[2]);
  await camera(duo.host, yaw);
  await duo.host.page.setViewportSize(SIZE);
  await duo.host.page.waitForTimeout(POSE);
  await shot(duo.host, name);
  await duo.host.page.setViewportSize({ width: 240, height: 135 });
}

test('postes: comptoirs du fournil et de l’épicerie, cuisine de la maison', async ({ browser }) => {
  const duo = await startDuo(browser, 'postes-aubrune', { save: 'aubrune-briques' });
  const players = await ready(duo, 'aubrune');
  await duo.setMinutes(10 * 60);
  // Fournil (pièce en 68, 210): comptoir façade au sud, Achille au nord. Vue du sud-ouest.
  await view(
    duo,
    players,
    [
      [72.4, 213.9, -Math.PI / 2],
      [73.9, 214.0, -Math.PI / 2],
    ],
    45,
    'fournil',
  );
  // Épicerie (48, 210): comptoir façade à l'est, Odette à l'ouest. Vue du sud-est.
  await view(
    duo,
    players,
    [
      [51.9, 212.6, Math.PI],
      [52.1, 213.9, Math.PI],
    ],
    315,
    'epicerie',
  );
  // Maison du garde (14, 210): la cuisine contre le mur sud. Vue du nord-est, vers le sud-ouest.
  await view(
    duo,
    players,
    [
      [21.2, 214.6, Math.PI / 2],
      [20.3, 213.2, Math.PI / 2],
    ],
    225,
    'cuisine',
  );
  await duo.close();
});

test('postes: le contrôleur dans le couloir du wagon', async ({ browser }) => {
  const duo = await startDuo(browser, 'postes-wagon', { save: 'train-de-nuit-porte' });
  const players = await ready(duo, 'train-de-nuit');
  await view(
    duo,
    players,
    [
      [6.2, 4.6, 0],
      [5.4, 4.4, 0],
    ],
    45,
    'wagon',
  );
  await duo.close();
});
