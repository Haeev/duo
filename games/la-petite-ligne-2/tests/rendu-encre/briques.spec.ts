// Les briques de simulation d'Aubrune à l'écran, dans le vrai jeu à deux (banc de captures, hors
// de la suite rapide et de la recette): cuisine de la maison du garde avant et après son achat,
// habitante couchée dans son lit, commerçante derrière son comptoir avec ses répliques, décision à
// deux vue par chacun. Rien n'est mis en scène à la main: l'état de l'hôte change (sonde) et
// arrive chez l'invité par le réseau. Images dans `LPL2_CAPTURES`, préfixe `briques`.
//   pnpm exec vite build && pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts briques
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { CAPTURES, type Duo, type ProbeWorld, type Side, startDuo } from '../aides-e2e/duo';

interface Probe {
  __lplSonde?: {
    stats(): { readonly place: string | null } | null;
    setCamera(yawDeg: number, width: number): boolean;
    setMoney(player: number, cents: number): boolean;
    remember(key: string): boolean;
  };
}

/** Ce que le banc lit de la vie d'un habitant (posture, place tenue). */
interface Lives {
  readonly places: Readonly<
    Record<
      string,
      | {
          readonly villagers?: Readonly<
            Record<
              string,
              {
                readonly body: { readonly x: number; readonly y: number };
                readonly life?: {
                  readonly pose: string;
                  readonly seat: readonly [string, number] | null;
                };
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

async function big(duo: Duo): Promise<void> {
  for (const side of [duo.host, duo.guest]) await side.page.setViewportSize(SIZE);
}

async function small(duo: Duo): Promise<void> {
  for (const side of [duo.host, duo.guest])
    await side.page.setViewportSize({ width: 240, height: 135 });
}

/** Capture du jeu de cette machine (le cadre du jeu, sans le faux hôte autour). */
async function shot(side: Side, name: string): Promise<string> {
  mkdirSync(CAPTURES, { recursive: true });
  const path = join(CAPTURES, `briques-${name}.png`);
  const frame = await side.game().frameElement();
  await frame.screenshot({ path, timeout: 120_000 });
  return path;
}

/** Les deux écrans côte à côte (hôte à gauche, invité à droite), par ImageMagick. */
function join2(paths: readonly string[], name: string): void {
  execFileSync('convert', [...paths, '+append', join(CAPTURES, `briques-${name}.png`)]);
}

async function camera(side: Side, yaw: number, width: number): Promise<void> {
  await side
    .game()
    .evaluate((v) => (window as unknown as Probe).__lplSonde?.setCamera(v.yaw, v.width), {
      yaw,
      width,
    });
}

async function ready(duo: Duo): Promise<[number, number]> {
  for (const side of [duo.host, duo.guest])
    await expect
      .poll(
        async () =>
          await side
            .game()
            .evaluate(() => (window as unknown as Probe).__lplSonde?.stats()?.place ?? null),
        { timeout: 120_000, intervals: [1000] },
      )
      .toBe(PLACE);
  return [await duo.host.local(), await duo.guest.local()];
}

test('briques: cuisine avant et après achat, habitante au lit', async ({ browser }) => {
  const duo = await startDuo(browser, 'briques-maison', { save: 'aubrune-briques' });
  const { host, guest } = duo;
  const [hi, gi] = await ready(duo);
  // Rez-de-chaussée de la maison du garde (pièce en (14; 210)): la cuisine tient contre le mur
  // sud, à l'est. Vue du nord: les deux meubles de face, contre le mur entier.
  await duo.teleport(hi, 21.2, 214.6, Math.PI / 2);
  await duo.teleport(gi, 20.3, 213.2, Math.PI / 2);
  await Promise.all([camera(host, 180, 9), camera(guest, 180, 9)]);
  await big(duo);
  await host.page.waitForTimeout(POSE);
  await shot(host, 'cuisine-avant-achat');
  await shot(guest, 'cuisine-avant-achat-invite');
  // Le joueur traverse la place de la cuisinière absente: rien ne l'arrête, rien n'y est dessiné.
  await duo.teleport(hi, 23.5, 216.4, Math.PI / 2);
  await host.page.waitForTimeout(2000);
  await shot(host, 'cuisine-avant-achat-dessus');
  await duo.teleport(hi, 21.2, 214.6, Math.PI / 2);
  // L'achat: le fait de la pièce restaurée est retenu chez l'hôte, comme à la fin des travaux.
  const kept = await host
    .game()
    .evaluate(
      () =>
        (window as unknown as Probe).__lplSonde?.remember('aubrune.maison-du-garde.cuisine') ??
        false,
    );
  expect(kept, 'fait retenu').toBe(true);
  await host.page.waitForTimeout(POSE);
  await shot(host, 'cuisine-apres-achat');
  await shot(guest, 'cuisine-apres-achat-invite');

  // La nuit, l'épicière monte se coucher: on l'attend à l'étage, près de son lit.
  await small(duo);
  await duo.setMinutes(21 * 60 + 5);
  const asleep = (w: ProbeWorld): boolean =>
    Object.values((w as unknown as Lives).places[PLACE]?.villagers ?? {}).some(
      (v) => v.life?.pose === 'lie',
    );
  const night = (await duo.until(
    host,
    'une habitante couchée',
    asleep,
    180_000,
  )) as unknown as Lives;
  const sleeper = Object.values(night.places[PLACE]?.villagers ?? {}).find(
    (v) => v.life?.pose === 'lie',
  );
  if (sleeper === undefined) throw new Error('personne n’est couché');
  const { x, y } = sleeper.body;
  await duo.teleport(hi, x + 1.9, y + 0.6, Math.PI);
  await duo.teleport(gi, x + 2.4, y - 0.9, Math.PI);
  await Promise.all([camera(host, 315, 6), camera(guest, 315, 6)]);
  await big(duo);
  await host.page.waitForTimeout(POSE);
  await shot(host, 'odette-au-lit');
  await shot(guest, 'odette-au-lit-invite');
  await camera(host, 45, 4.5);
  await host.page.waitForTimeout(POSE);
  await shot(host, 'odette-au-lit-de-pres');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('briques: commerçante au comptoir, décision à deux', async ({ browser }) => {
  const duo = await startDuo(browser, 'briques-bourg', { save: 'aubrune-briques' });
  const { host, guest } = duo;
  const [hi, gi] = await ready(duo);
  // Épicerie (pièce en (48; 210)): comptoir en (50,5; 213), façade à l'est, l'épicière derrière.
  await duo.teleport(hi, 51.4, 213, Math.PI);
  await duo.teleport(gi, 52.7, 213.9, Math.PI);
  await Promise.all([camera(host, 290, 9), camera(guest, 290, 9)]);
  await expect
    .poll(async () => (await host.aim(hi))?.verb ?? null, { timeout: 30_000 })
    .toBe('Acheter');
  await big(duo);
  await host.page.waitForTimeout(POSE);
  await shot(host, 'commercant-avant');
  await host.press('Space');
  const shop = host.game().locator('.lpl-ui .shop');
  await expect(shop).toBeVisible();
  await host.page.waitForTimeout(1500);
  // Achat du premier article: la réplique `bought` de la fiche.
  await host.press('Enter');
  await host.page.waitForTimeout(1200);
  await shot(host, 'commercant-au-comptoir');
  // Vente (onglet « Vendre », premier objet racheté): la réplique `sold`.
  await host.page.waitForTimeout(4500);
  await host.press('KeyE');
  await host.page.waitForTimeout(800);
  await shot(host, 'boutique-vendre-refus');
  await host.press('Enter');
  await host.page.waitForTimeout(1200);
  await shot(host, 'boutique-vendu');
  // Un objet qu'elle ne rachète pas (dernière tuile): la réplique `refusal`.
  await host.page.waitForTimeout(4500);
  for (let i = 0; i < 6; i++) await host.press('ArrowRight', 60);
  await host.press('Enter');
  await host.page.waitForTimeout(1200);
  await shot(host, 'boutique-refus');
  // Bourse vide: la réplique `noMoney`.
  await host.page.waitForTimeout(4500);
  await host.game().evaluate((p) => (window as unknown as Probe).__lplSonde?.setMoney(p, 0), hi);
  await host.press('KeyQ');
  await host.page.waitForTimeout(800);
  await host.press('Enter');
  await host.page.waitForTimeout(1200);
  await shot(host, 'boutique-sans-argent');
  await host.press('Backspace');
  await expect(shop).toBeHidden();

  // Fournil (pièce en (68; 210)): le boulanger derrière son comptoir, les deux joueurs près de lui.
  await small(duo);
  const world = (await duo.until(host, 'monde lu', () => true)) as unknown as Lives;
  const baker = world.places[PLACE]?.villagers?.achille?.body;
  if (baker === undefined) throw new Error('boulanger absent');
  await duo.teleport(hi, baker.x - 1, baker.y + 0.1, 0);
  await duo.teleport(gi, baker.x - 0.6, baker.y - 0.8, Math.atan2(0.8, 0.6));
  await Promise.all([camera(host, 20, 8), camera(guest, 20, 8)]);
  for (const [side, index] of [
    [host, hi],
    [guest, gi],
  ] as const)
    await expect
      .poll(async () => (await side.aim(index))?.id ?? null, { timeout: 30_000 })
      .toBe('achille');
  await big(duo);
  const choices = (side: Side) => side.game().locator('.lpl-ui .choice');
  const reach = async (side: Side): Promise<void> => {
    await side.press('Space');
    await expect(side.game().locator('.lpl-ui .dialogue')).toBeVisible();
    for (let i = 0; i < 12 && !(await choices(side).first().isVisible()); i++) {
      await side.press('Space');
      await side.page.waitForTimeout(700);
    }
    await expect(choices(side).first()).toBeVisible();
  };
  // L'invité choisit seul (deuxième option, « On l'offre au café »): l'hôte n'a encore rien dit.
  await reach(guest);
  await shot(guest, 'decision-choix-invite');
  await guest.press('KeyS');
  await guest.press('Enter');
  // L'avis de l'hôte ne dure que quelques secondes: sa capture d'abord.
  await host.page.waitForTimeout(700);
  const waiting = [await shot(host, 'decision-attente-hote')];
  await guest.page.waitForTimeout(2500);
  waiting.push(await shot(guest, 'decision-attente-invite'));
  join2(waiting, 'decision-a-deux');
  // L'invité referme sa conversation, puis l'hôte choisit l'autre option: deux avis.
  const talking = guest.game().locator('.lpl-ui .dialogue');
  for (let i = 0; i < 8 && (await talking.isVisible()); i++) {
    await guest.press('Backspace');
    await guest.page.waitForTimeout(700);
  }
  await expect(talking).toBeHidden();
  await host.page.waitForTimeout(4500);
  await shot(host, 'decision-apres-avis-hote');
  await reach(host);
  await host.press('Enter');
  await guest.page.waitForTimeout(700);
  const split = [await shot(guest, 'decision-desaccord-invite')];
  await host.page.waitForTimeout(2500);
  split.unshift(await shot(host, 'decision-desaccord-hote'));
  join2(split, 'decision-a-deux-desaccord');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
