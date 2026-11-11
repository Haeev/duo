// La draisine d'Aubrune à l'écran, dans le vrai jeu à deux (banc de captures, hors de la suite
// rapide et de la recette): sortie de la remise par l'hôte, chacun monte de son côté par la
// touche d'action, puis les deux pompent en alternance. Rien n'est mis en scène à la main: les
// appuis partent du clavier de chaque machine, l'état arrive chez l'invité par le réseau.
// Images dans `LPL2_CAPTURES`: `draisine-depart.png`, `draisine-en-route.png` (les deux écrans
// côte à côte, hôte à gauche).
//   pnpm exec vite build && pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts draisine
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { CAPTURES, type Duo, type ProbeWorld, type Side, startDuo } from '../aides-e2e/duo';

interface Probe {
  __lplSonde?: {
    stats(): { readonly place: string | null } | null;
    setCamera(yawDeg: number, width: number): boolean;
    remember(key: string, value?: string | boolean): boolean;
  };
}

/** Ce que le banc lit de la draisine dans l'état du lieu. */
interface Vehicles {
  readonly places: Readonly<
    Record<
      string,
      | {
          readonly vehicles?: Readonly<
            Record<
              string,
              {
                readonly out: boolean;
                readonly s: number;
                readonly speed: number;
                readonly riders: readonly (number | null)[];
                readonly lever: { readonly tick: number };
              }
            >
          >;
        }
      | undefined
    >
  >;
}

const SIZE = { width: 1366, height: 768 } as const;
const POSE = Number(process.env.LPL2_POSE ?? 6000);
const PLACE = 'aubrune';
/** Lacet des vues (degrés) et largeur au sol (m): de trois quarts, depuis le chemin de la Lisière (nord-ouest). */
const YAW = Number(process.env.LPL2_LACET ?? 150);
/** Pas de jeu entre deux coups alternés (le battement de la fiche: 0,45 s). */
const BEAT_TICKS = 13;
const WIDTH = Number(process.env.LPL2_LARGEUR ?? 12);

function draisine(
  world: ProbeWorld,
): NonNullable<NonNullable<Vehicles['places'][string]>['vehicles']>[string] | null {
  return (world as unknown as Vehicles).places[PLACE]?.vehicles?.draisine ?? null;
}

async function shot(side: Side, name: string): Promise<string> {
  mkdirSync(CAPTURES, { recursive: true });
  const path = join(CAPTURES, `${name}.png`);
  const frame = await side.game().frameElement();
  await frame.screenshot({ path, timeout: 120_000 });
  return path;
}

/** Les deux écrans côte à côte (hôte à gauche, invité à droite), par ImageMagick. */
function side2(paths: readonly string[], name: string): void {
  execFileSync('convert', [...paths, '+append', join(CAPTURES, `${name}.png`)]);
}

async function camera(duo: Duo, yaw: number, width: number): Promise<void> {
  for (const side of [duo.host, duo.guest])
    await side
      .game()
      .evaluate((v) => (window as unknown as Probe).__lplSonde?.setCamera(v.yaw, v.width), {
        yaw,
        width,
      });
}

const SMALL = { width: 240, height: 135 } as const;

/**
 * Sur une machine chargée, une image en 1366 x 768 rendue par logiciel peut durer plus que les
 * 8 s que le faux hôte laisse au jeu (« Le jeu ne répond plus »). Le banc éteint les minuteries
 * de la coque (la page autour du jeu, pas le jeu): son chien de garde ne mord plus, le jeu et le
 * réseau continuent. Ce n'est qu'un banc de captures: les performances se mesurent chez le client.
 */
async function patient(duo: Duo): Promise<void> {
  for (const side of [duo.host, duo.guest])
    await side.page.evaluate(() => {
      for (let id = 1; id < 20_000; id++) window.clearInterval(id);
    });
}

/** Les deux écrans en 1366 x 768, pris au même instant, puis recollés; retour en petit. */
async function both(duo: Duo, name: string): Promise<void> {
  for (const side of [duo.host, duo.guest]) await side.page.setViewportSize(SIZE);
  await duo.host.page.waitForTimeout(POSE);
  const paths = await Promise.all([
    shot(duo.host, `${name}-hote`),
    shot(duo.guest, `${name}-invite`),
  ]);
  side2(paths, name);
  for (const side of [duo.host, duo.guest]) await side.page.setViewportSize(SMALL);
}

test('draisine: départ à deux, puis en route', async ({ browser }) => {
  const duo = await startDuo(browser, 'draisine', { save: 'aubrune-briques' });
  const { host, guest } = duo;
  for (const side of [host, guest])
    await expect
      .poll(
        async () =>
          await side
            .game()
            .evaluate(() => (window as unknown as Probe).__lplSonde?.stats()?.place ?? null),
        { timeout: 120_000, intervals: [1000] },
      )
      .toBe(PLACE);
  const [hi, gi] = [await host.local(), await guest.local()];
  // Une fois le lieu chargé seulement: la coque a besoin de ses minuteries pour démarrer la partie.
  await patient(duo);
  // La suite des lettres a donné la clé: le fait est retenu chez l'hôte, comme à la fin de la scène.
  const kept = await host
    .game()
    .evaluate(
      () => (window as unknown as Probe).__lplSonde?.remember('aubrune.draisine.sortie') ?? false,
    );
  expect(kept, 'fait retenu').toBe(true);

  // L'hôte à la porte de la remise: la bulle « Sortir la draisine », puis la touche d'action.
  await duo.teleport(hi, 219.3, 92.5, 0);
  await duo.teleport(gi, 214.6, 99.4, -Math.PI / 2);
  await duo.until(
    host,
    'la porte de la remise visée',
    (w) => w.players[hi]?.aim === 'remise-draisine',
  );
  await host.press('Space');
  await duo.until(host, 'la draisine sortie', (w) => draisine(w)?.out === true);
  await duo.until(guest, 'la draisine sortie chez l’invité', (w) => draisine(w)?.out === true);

  // Chacun monte de son côté du balancier, par sa propre touche d'action.
  await duo.teleport(hi, 214.9, 98.6, -Math.PI / 2);
  await duo.teleport(gi, 213.1, 98.6, -Math.PI / 2);
  await duo.until(
    host,
    'la draisine visée par l’hôte',
    (w) => w.players[hi]?.aim === 'vehicule-draisine',
  );
  await host.press('Space');
  await duo.until(
    guest,
    'la draisine visée par l’invité',
    (w) => w.players[gi]?.aim === 'vehicule-draisine',
  );
  await guest.press('Space');
  await duo.until(guest, 'les deux à bord', (w) => {
    const riders = draisine(w)?.riders ?? [];
    return riders.includes(hi) && riders.includes(gi);
  });
  await camera(duo, YAW, WIDTH);
  await both(duo, 'draisine-depart');

  // En route: un coup chacun, à tour de rôle. Le rendu logiciel ralentit le jeu: le battement
  // (13 pas de jeu) est converti en temps mural d'après la cadence mesurée du jeu, en petit.
  const from = await host.world();
  await host.page.waitForTimeout(2000);
  const to = await host.world();
  const rate = Math.max(5, ((to?.tick ?? 0) - (from?.tick ?? 0)) / 2);
  const gap = Math.round((BEAT_TICKS / rate) * 1000);
  const strokes = Number(process.env.LPL2_COUPS ?? 40);
  for (let i = 0; i < strokes; i++) {
    const started = Date.now();
    await (i % 2 === 0 ? host : guest).press('Space', 40);
    await host.page.waitForTimeout(Math.max(20, gap - (Date.now() - started)));
  }
  const fast = await host.world();
  expect(fast === null ? 0 : (draisine(fast)?.speed ?? 0), 'elle roule').toBeGreaterThan(1.5);
  // En grand, le jeu ralentit (une image vaut au plus 0,25 s de jeu): elle roule sur son élan le
  // temps que les deux grandes vues se dessinent.
  await both(duo, 'draisine-en-route');
  // L'invité voit la même draisine au même endroit, à un état près.
  const [mine, theirs] = [await host.world(), await guest.world()];
  if (mine !== null && theirs !== null)
    expect(Math.abs((draisine(mine)?.s ?? 0) - (draisine(theirs)?.s ?? 0))).toBeLessThan(6);
  expect(duo.errors).toEqual([]);
  await duo.close();
});
