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
    remember(key: string, value?: string | boolean): boolean;
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
/** Lacet de la vue du fournil, depuis la rue: le comptoir de face, Achille derrière. */
const CAMERA_FOURNIL = Number(process.env.LPL2_LACET_FOURNIL ?? 20);

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

/** Capture sous un nom libre (preuves d'une mission), sans le préfixe du banc. */
async function shotAs(side: Side, name: string): Promise<string> {
  mkdirSync(CAPTURES, { recursive: true });
  const path = join(CAPTURES, `${name}.png`);
  const frame = await side.game().frameElement();
  await frame.screenshot({ path, timeout: 120_000 });
  return path;
}

/** Les deux écrans côte à côte (hôte à gauche, invité à droite), par ImageMagick. */
function join2(paths: readonly string[], name: string, prefix = 'briques-'): void {
  execFileSync('convert', [...paths, '+append', join(CAPTURES, `${prefix}${name}.png`)]);
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
  // sud, à l'est. Caméra de jeu (plongée de 50 degrés, 18 m), sur la diagonale du nord-est: les
  // deux meubles de trois quarts, les murs nord et est coupés. Le cadrage de face à 9 m d'avant
  // se lisait comme une vue de dessus (revue visuelle du 2026-11-11).
  await duo.teleport(hi, 21.2, 214.6, Math.PI / 2);
  await duo.teleport(gi, 20.3, 213.2, Math.PI / 2);
  await Promise.all([camera(host, 225, 18), camera(guest, 225, 18)]);
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

  // Deux plannings au même poste (`pl`, de 7 h à 12 h): Lucie et Jeanne côte à côte, jamais l'une
  // dans l'autre.
  const pair = (w: ProbeWorld): readonly { x: number; y: number }[] | null => {
    const all = (w as unknown as Lives).places[PLACE]?.villagers ?? {};
    const a = all.lucie;
    const b = all.jeanne;
    if (a === undefined || b === undefined) return null;
    if (Math.hypot(a.body.x - 204, a.body.y - 116) > 2.5) return null;
    if (Math.hypot(b.body.x - 204, b.body.y - 116) > 2.5) return null;
    return [a.body, b.body];
  };
  // Les joueurs près de la place: les habitants alentour vivent à pleine fréquence.
  await duo.teleport(hi, 205.5, 119.5, -Math.PI / 2);
  await duo.teleport(gi, 202.5, 119.5, -Math.PI / 2);
  const posted = pair(
    await duo.until(host, 'Lucie et Jeanne au poste', (w) => pair(w) !== null, 120_000),
  );
  const [lucie, jeanne] = posted ?? [];
  if (lucie === undefined || jeanne === undefined) throw new Error('Lucie et Jeanne absentes');
  const mid = { x: (lucie.x + jeanne.x) / 2, y: (lucie.y + jeanne.y) / 2 };
  await duo.teleport(hi, mid.x + 1.3, mid.y + 1.3, Math.PI);
  await duo.teleport(gi, mid.x - 1.8, mid.y + 2.6, -Math.PI / 2);
  await Promise.all([camera(host, 45, 7), camera(guest, 45, 7)]);
  await big(duo);
  await host.page.waitForTimeout(POSE);
  await shotAs(host, 'deux-au-meme-point');
  await small(duo);

  // Épicerie (pièce en (48; 210)): comptoir en (50,5; 213), façade à l'est, l'épicière derrière.
  // Une lettre pour elle (fait d'une suite): elle a quelque chose à dire, la touche lui parle
  // par-dessus le comptoir, depuis le côté client.
  await duo.teleport(hi, 51.4, 213, Math.PI);
  await duo.teleport(gi, 52.7, 213.9, Math.PI);
  await Promise.all([camera(host, 200, 8), camera(guest, 200, 8)]);
  const opened = await host
    .game()
    .evaluate(
      () =>
        (window as unknown as Probe).__lplSonde?.remember('aubrune.lettres.odette', 'ouvert') ??
        false,
    );
  expect(opened, 'fait retenu').toBe(true);
  await expect
    .poll(async () => (await host.aim(hi))?.verb ?? null, { timeout: 30_000 })
    .toBe('Parler');
  await big(duo);
  await host.page.waitForTimeout(POSE);
  await shot(host, 'comptoir-parler-bulle');
  await host.press('Space');
  const talking = (side: Side) => side.game().locator('.lpl-ui .dialogue');
  await expect(talking(host)).toBeVisible();
  await host.page.waitForTimeout(2500);
  await shotAs(host, 'comptoir-parler');
  const closeTalk = async (side: Side): Promise<void> => {
    for (let i = 0; i < 12 && (await talking(side).isVisible()); i++) {
      await side.press('Backspace');
      await side.page.waitForTimeout(700);
    }
    await expect(talking(side)).toBeHidden();
  };
  await closeTalk(host);
  // Entendue ce jour: le comptoir ouvre la boutique, qui garde « Parler ».
  await expect
    .poll(async () => (await host.aim(hi))?.verb ?? null, { timeout: 30_000 })
    .toBe('Acheter');
  await host.press('Space');
  const shop = host.game().locator('.lpl-ui .shop');
  await expect(shop).toBeVisible();
  await expect(host.game().locator('.lpl-ui .shop-talk')).toBeVisible();
  await host.page.waitForTimeout(1500);
  // Achat du premier article: la réplique `bought` de la fiche.
  await host.press('Enter');
  // La réplique paraît à l'image qui suit l'achat; en rendu logiciel, deux images peuvent être
  // séparées de 1,3 s (sonde du 2026-11-11): attendre la bulle plutôt qu'un délai fixe.
  const says = host.game().locator('.lpl-ui .shop-say');
  await expect(says).toBeVisible();
  await host.page.waitForTimeout(400);
  await shotAs(host, 'comptoir-boutique');
  // Vente (onglet « Vendre », premier objet racheté): la réplique `sold`.
  await host.page.waitForTimeout(4500);
  await host.press('KeyE');
  await host.page.waitForTimeout(800);
  await shot(host, 'boutique-vendre-refus');
  await expect(says).toBeHidden({ timeout: 60_000 });
  await host.press('Enter');
  await expect(says).toBeVisible();
  await host.page.waitForTimeout(400);
  await shot(host, 'boutique-vendu');
  // « Parler » (P) depuis la boutique: la conversation s'ouvre, la boutique s'efface.
  await host.page.waitForTimeout(1500);
  await host.press('KeyP');
  await expect(talking(host)).toBeVisible();
  await expect(shop).toBeHidden();
  await host.page.waitForTimeout(1500);
  await shot(host, 'boutique-parler');
  await closeTalk(host);

  // Fournil (pièce en (68; 210)): le boulanger derrière son comptoir (en (73; 212,5)), les deux
  // joueurs devant, côté rue: on lui dit la décision par-dessus le comptoir.
  await small(duo);
  await duo.teleport(hi, 72.6, 213.9, -Math.PI / 2);
  await duo.teleport(gi, 73.6, 213.9, -Math.PI / 2);
  await Promise.all([camera(host, CAMERA_FOURNIL, 8), camera(guest, CAMERA_FOURNIL, 8)]);
  for (const [side, index] of [
    [host, hi],
    [guest, gi],
  ] as const)
    await expect
      .poll(async () => (await side.aim(index))?.verb ?? null, { timeout: 30_000 })
      .toBe('Parler');
  await big(duo);
  const choices = (side: Side) => side.game().locator('.lpl-ui .choice');
  const reach = async (side: Side): Promise<void> => {
    await side.press('Space');
    await expect(talking(side)).toBeVisible();
    for (let i = 0; i < 12 && !(await choices(side).first().isVisible()); i++) {
      await side.press('Space');
      await side.page.waitForTimeout(700);
    }
    await expect(choices(side).first()).toBeVisible();
  };
  // L'invité choisit seul (deuxième option, « On l'offre au café »): l'hôte n'a encore rien dit.
  await reach(guest);
  await guest.press('KeyS');
  await guest.press('Enter');
  await guest.page.waitForTimeout(1500);
  await shot(guest, 'decision-une-voix-invite');
  await closeTalk(guest);
  // Pas de boutique derrière la réplique de quête.
  await expect(guest.game().locator('.lpl-ui .shop')).toBeHidden();
  // L'avis de 4 s est passé: le rappel reste, chez chacun de son point de vue.
  await host.page.waitForTimeout(5000);
  const waiting = [
    await shot(host, 'decision-rappel-hote'),
    await shot(guest, 'decision-rappel-invite'),
  ];
  join2(waiting, 'decision-rappel', '');
  // L'hôte choisit l'autre option: deux avis, et chacun peut changer d'avis.
  await reach(host);
  await host.press('Enter');
  await host.page.waitForTimeout(1500);
  await closeTalk(host);
  await host.page.waitForTimeout(5000);
  const split = [
    await shot(host, 'decision-desaccord-hote'),
    await shot(guest, 'decision-desaccord-invite'),
  ];
  join2(split, 'decision-desaccord', '');
  // L'onglet Quêtes du carnet garde la même ligne.
  await guest.press('KeyC');
  await guest.page.waitForTimeout(1500);
  await guest.press('KeyE');
  await guest.page.waitForTimeout(1500);
  await shot(guest, 'decision-carnet-invite');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
