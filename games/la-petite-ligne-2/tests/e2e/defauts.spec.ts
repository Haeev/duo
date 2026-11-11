// Défauts de la recette du jalon 1, retournés après correction: D2 (la buvette de la cheffe de gare
// reste ouvrable après son dialogue de quête, par le comptoir tenu, puis en face) et D3 (personne collé au joueur au point d'arrivée; relevé
// des distances dans mesures.txt).
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { actUntil, readToEnd, talkScreen } from '../aides-e2e/conversation';
import { CAPTURES, startDuo, type Duo } from '../aides-e2e/duo';

const GUICHET = { x: 20, y: 15 };
const COMPTOIR = { x: 23, y: 15 };
/** Fait de la quête « sonnerie » (`quetes/sonnerie-essai.json`): l'étape en cours. */
const SONNERIE = 'essai-gare.sonnerie';

/** Parle à la cheffe de gare, en face, et lit les pages jusqu'à la fin (choix: premier). */
async function talkToChief(duo: Duo, label: string): Promise<string[]> {
  const { host } = duo;
  const hi = await host.local();
  await duo.teleport(hi, GUICHET.x, GUICHET.y + 1, -Math.PI / 2);
  await actUntil(
    host,
    `${label}: la cheffe parle`,
    async () => (await host.aim(hi))?.id === 'cheffe-de-gare',
    async () => (await talkScreen(host)).state !== 'closed',
  );
  await host.shot(`${label}-1-premiere-page`);
  const pages = await readToEnd(host);
  await duo.until(host, `${label}: conversation finie`, (w) => w.players[hi]?.talk === null);
  return pages;
}

test('D2 la boutique de la gare s’ouvre au comptoir, après le dialogue de quête de la cheffe', async ({
  browser,
}) => {
  const duo = await startDuo(browser, 'd2-boutique');
  const { host } = duo;
  const hi = await host.local();
  const step = (value: string) => (w: Awaited<ReturnType<typeof host.world>>) =>
    w?.progress?.memory?.[SONNERIE]?.v === value;
  // 1re conversation: l'accueil donne la besace, ce qui démarre la quête « sonnerie ».
  const first = await talkToChief(duo, 'a');
  expect(first.join('|')).toContain('Bienvenue');
  await duo.until(host, 'besace', (w) => w.players[hi]?.bag !== null);
  await duo.until(host, 'quête de la sonnerie ouverte', step('parler'));
  // 2e conversation: le dialogue de quête (la sonnerie) passe, sans offre de boutique derrière lui
  // (une réplique d'histoire ou de quête ne débouche jamais sur la boutique). Une fois cette
  // réplique entendue, la touche d'action sur le comptoir tenu ouvre la buvette.
  const second = await talkToChief(duo, 'b');
  const text = second.join('|');
  expect(text, 'le dialogue de quête passe d’abord').toContain('sonner');
  expect(text, 'pas d’offre de boutique derrière une réplique de quête').not.toContain(
    'Je regarde ta buvette.',
  );
  await duo.until(host, 'étape « parler » franchie', step('buche'));
  await duo.teleport(hi, COMPTOIR.x - 1.3, COMPTOIR.y, 0);
  await expect
    .poll(async () => (await host.aim(hi))?.id ?? null, { timeout: 20_000 })
    .toBe('comptoir-buvette');
  const shop = host.game().locator('.lpl-ui .shop');
  // Le comptoir vend: l'appui n'est rejoué que si la bulle dit toujours « Acheter », rien d'ouvert.
  expect((await host.aim(hi))?.verb, 'le comptoir propose la buvette').toBe('Acheter');
  await actUntil(
    host,
    'la buvette s’ouvre au comptoir',
    async () =>
      (await host.aim(hi))?.verb === 'Acheter' && (await talkScreen(host)).state === 'closed',
    async () => await shop.isVisible(),
  );
  const atCounter = await duo.until(host, 'monde lu', () => true);
  expect(atCounter.players[hi]?.talk, 'la boutique, sans conversation devant').toBeNull();
  await host.shot('c-boutique-par-la-cheffe');
  await host.press('Backspace');
  await expect(shop).toBeHidden();
  // 3e conversation, en face: l'histoire a avancé (étape « bûche »), la cheffe dit la suite pour
  // la première fois ce jour: toujours pas d'offre de boutique derrière une réplique de quête.
  const third = (await talkToChief(duo, 'd')).join('|');
  expect(third, 'la suite de la quête').toContain('tas de bois');
  expect(third, 'première écoute du jour: pas d’offre').not.toContain('Je regarde ta buvette.');
  await expect(shop).toBeHidden();
  // 4e conversation, en face: la même réplique, déjà entendue ce jour, débouche sur l'offre de
  // la buvette comme une conversation ordinaire; le premier choix (Entrée) ouvre la boutique.
  const fourth = (await talkToChief(duo, 'e')).join('|');
  expect(fourth, 'la même réplique de quête').toContain('tas de bois');
  expect(fourth, 'en face, la buvette est proposée après une réplique réentendue').toContain(
    'CHOIX: Je regarde ta buvette.',
  );
  await expect(shop).toBeVisible();
  await host.shot('f-boutique-en-face');
  await duo.close();
});

test('D3 aucun habitant d’Aubrune collé aux joueurs sur le quai (relevé)', async ({ browser }) => {
  const duo = await startDuo(browser, 'd3-habitant-colle', { save: 'aubrune-apres-scene' });
  const { host } = duo;
  const hi = await host.local();
  await duo.until(host, 'scène finie', (w) => (w.common.story?.scene ?? null) === null);
  const lines: string[] = [];
  const near = async (label: string): Promise<void> => {
    const w = await host.world();
    const me = w?.players[hi];
    if (w === null || me === undefined) return;
    const villagers = Object.entries(w.places.aubrune?.villagers ?? {})
      .map(([id, v]) => ({ id, d: Math.hypot(v.body.x - me.body.x, v.body.y - me.body.y) }))
      .filter((v) => v.d < 3)
      .map((v) => `${v.id} ${v.d.toFixed(2)} m`);
    lines.push(
      `${label}: joueur (${me.body.x.toFixed(1)}; ${me.body.y.toFixed(1)}) ${villagers.join(', ') || 'personne à moins de 3 m'}`,
    );
  };
  await near('départ');
  await host.shot('1-depart');
  // Dix secondes immobile, puis quelques pas vers l'ouest, relevés chaque seconde.
  for (let i = 0; i < 6; i++) {
    await host.page.waitForTimeout(1500);
    await near(`immobile ${i}`);
  }
  await host.shot('2-immobile');
  // D3 corrigé: personne ne stationne contre le joueur au point d'arrivée.
  const still = await host.world();
  const me = still?.players[hi];
  const closest = Math.min(
    ...Object.values(still?.places.aubrune?.villagers ?? {}).map((v) =>
      me === undefined ? Infinity : Math.hypot(v.body.x - me.body.x, v.body.y - me.body.y),
    ),
  );
  expect(closest, 'D3: aucun habitant collé au joueur sur le quai').toBeGreaterThan(1.3);
  for (let i = 0; i < 6; i++) {
    await host.press('KeyA', 800);
    await host.page.waitForTimeout(700);
    await near(`marche ${i}`);
  }
  await host.shot('3-apres-marche');
  appendFileSync(join(CAPTURES, 'mesures.txt'), `D3 relevé:\n${lines.join('\n')}\n`);
  await duo.close();
});
