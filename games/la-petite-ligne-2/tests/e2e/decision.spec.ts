// D1 décision à deux (cahier 4.10, `interface/rappel-decision.ts`): la Baronne attend dans
// l'épuisette, Achille demande aux deux joueurs de décider. L'invité dit « au café », l'hôte « à
// l'eau »: désaccord, le bandeau le dit chez les deux, chacun y lit le choix de l'autre. Puis
// l'invité change d'avis: accord, le bandeau s'efface et l'étape « decision » de la suite « La
// Baronne » est franchie chez les deux. Sauvegarde « aubrune-recette » (décision ouverte, 10 h).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { actUntil, pickChoice, readTalk, talkScreen } from '../aides-e2e/conversation';
import { startDuo, type Duo, type ProbeWorld, type Side } from '../aides-e2e/duo';
import {
  ANNEX_Y,
  agreedAim,
  aimAtVillager,
  passDoor,
  loadMapWithInteriors,
  placeAt,
  player,
  settle,
  shot,
  uiText,
  walk,
} from '../aides-e2e/contenu';
import { Journal, seats, type Seat } from '../aides-e2e/prologue';

test.use({ viewport: { width: 320, height: 180 } });

const MAP = loadMapWithInteriors('aubrune');
const QUEST = 'la-baronne';
/** Porte du fournil sur la grand-rue (`carte.json`, `porte-fournil`), mur sud. */
const BAKERY_DOOR = { x: 232.5, y: 106.5 };
/**
 * Devant le comptoir du fournil (`interieurs/fournil.json`: pièce en (68; 210), comptoir de
 * (72; 212) à (74; 213), porte en (71,5; 214,5)), côté client: l'hôte, entré le premier, va au
 * fond; l'invité s'arrête près de la porte. Dans l'autre sens, l'invité devait contourner l'hôte
 * par le sud, sur le rang de la porte, et ressortait dans la rue (relevé: bloqué au bord du ru).
 * À un demi-mètre de ce rang (y = 214) pour la même raison.
 */
const COUNTER_SIDE = [
  { x: 73.6, y: 213.5 },
  { x: 72.6, y: 213.5 },
] as const;
const BANNER = '.lpl-ui .decision-rappel';
const DATA = join(import.meta.dirname, '../../donnees');
/** Portée de la touche d'action (m): en deçà, on parle à Achille en face (`commun/reglages.json`). */
const REACH = (
  JSON.parse(readFileSync(join(DATA, 'commun/reglages.json'), 'utf8')) as {
    reach: { action: number };
  }
).reach.action;
/** « Partir » de l'offre de boutique d'Achille (`talk.leave` de sa fiche de commerce). */
const LEAVE = (
  JSON.parse(readFileSync(join(DATA, 'lieux/aubrune/commerces/fournil-pradel.json'), 'utf8')) as {
    talk: { leave: string };
  }
).talk.leave;

/**
 * Parle à Achille par-dessus son comptoir, lit jusqu'aux choix, prend l'option dont le texte
 * contient `option`, puis lit la réponse d'Achille jusqu'à la fin de la conversation. Chaque
 * touche attend l'écran (`aides-e2e/conversation.ts`): un Espace parti à l'aveugle validait le
 * premier choix à la place du joueur, ou achetait du pain une fois la boutique ouverte.
 */
async function say(duo: Duo, seat: Seat, option: string, journal: Journal): Promise<void> {
  const side: Side = seat.side;
  const shop = side.game().locator('.lpl-ui .shop');
  // Décision en attente de ce joueur: le comptoir s'adresse à Achille, pas à la boutique.
  await actUntil(
    side,
    `${side.who}: Achille parle`,
    async () => {
      if (await shop.isVisible()) return false;
      if ((await agreedAim(duo, seat))?.verb === 'Parler') return true;
      // L'hôte ne confirme pas la bulle (un petit pas s'est perdu en route): on revise Achille.
      await aimAtVillager(duo, seat, 'achille', MAP, journal);
      return false;
    },
    async () => (await talkScreen(side)).state !== 'closed',
    {
      describe: async () => {
        const w = await duo.host.world();
        const body = w === null ? null : player(w, seat).body;
        return `visée chez lui ${JSON.stringify(await side.aim(seat.index))}, chez l’hôte ${JSON.stringify(await duo.host.aim(seat.index))}, corps chez l’hôte ${JSON.stringify(body)}, conversation chez l’hôte ${JSON.stringify(w === null ? null : player(w, seat).talk)}`;
      },
    },
  );
  const { lines, end } = await readTalk(side);
  journal.log(`${side.who} entend: ${lines.join(' | ')}`);
  expect(end.state, `${side.who}: les choix paraissent`).toBe('choice');
  expect(end.choices.join(' / '), `${side.who}: choix « ${option} »`).toContain(option);
  const taken = await pickChoice(side, option);
  journal.log(`${side.who} choisit « ${taken} »`);
  // La réplique qui suit (« Une voix », « Deux voix, deux avis », ou l'accord) se lit puis se ferme.
  const answer = await readTalk(side);
  journal.log(`${side.who}, réponse d’Achille: ${answer.lines.join(' | ')}`);
  expect(answer.lines.length, `${side.who}: Achille répond au choix`).toBeGreaterThan(0);
  if (answer.end.state === 'choice') {
    // La règle (`commerces/README.md`): réentendue le même jour EN FACE d'Achille (le joueur a dû
    // contourner le comptoir pour le viser), la réplique débouche sur l'offre de la boutique;
    // par-dessus le comptoir, jamais. On décline l'offre.
    const w = await duo.until(duo.host, 'monde lu', () => true);
    const achille = w.places.aubrune?.villagers?.achille?.body;
    const me = player(w, seat).body;
    const gap = achille === undefined ? Infinity : Math.hypot(achille.x - me.x, achille.y - me.y);
    journal.log(`${side.who}: offre de la boutique à ${gap.toFixed(2)} m d’Achille`);
    expect(gap, `${side.who}: offre de boutique en face d’Achille seulement`).toBeLessThanOrEqual(
      REACH,
    );
    expect(answer.end.choices.join(' / '), `${side.who}: c’est l’offre de la boutique`).toContain(
      LEAVE,
    );
    await pickChoice(side, LEAVE);
    expect((await readTalk(side)).end.state, `${side.who}: conversation finie`).toBe('closed');
  } else expect(answer.end.state, `${side.who}: conversation finie`).toBe('closed');
  await duo.until(
    duo.host,
    `${side.who}: conversation finie chez l’hôte`,
    (w) => player(w, seat).talk === null,
  );
  await expect(shop, `${side.who}: pas de boutique derrière la décision`).toBeHidden();
}

test('D1 décision à deux: désaccord vu par les deux, puis accord', async ({ browser }) => {
  test.setTimeout(900_000);
  const journal = new Journal('d1-decision-releves.txt');
  const duo = await startDuo(browser, 'd1-decision', { save: 'aubrune-recette' });
  const { host, guest } = duo;
  const [h, g] = await seats(duo);
  await settle(duo, 'aubrune');
  const start = await duo.until(host, 'monde lu', () => true);
  expect(start.progress?.quests[QUEST]?.step, 'décision ouverte').toBe('decision');
  const achille = start.places.aubrune?.villagers?.achille?.body;
  journal.log(`Achille en ${JSON.stringify(achille)}`);

  // Mise en place devant le fournil, puis chacun entre par la porte au clavier (vers le nord,
  // Z d'un AZERTY).
  await placeAt(
    duo,
    journal,
    h.index,
    { x: BAKERY_DOOR.x, y: BAKERY_DOOR.y + 1.1 },
    'fournil',
    -Math.PI / 2,
  );
  await placeAt(
    duo,
    journal,
    g.index,
    { x: BAKERY_DOOR.x + 1.5, y: BAKERY_DOOR.y + 1.6 },
    'fournil',
    -Math.PI / 2,
  );
  const inside = (seat: Seat) => (w: ProbeWorld) => player(w, seat).body.y > ANNEX_Y;
  expect(
    await passDoor(duo, journal, MAP, h, BAKERY_DOOR, 'w', inside(h)),
    'l’hôte entre dans le fournil',
  ).toBe(true);
  await walk(duo, journal, MAP, [COUNTER_SIDE[0], null], 'comptoir', { tolerance: 0.35 });
  expect(
    await passDoor(duo, journal, MAP, g, BAKERY_DOOR, 'w', inside(g)),
    'l’invité entre dans le fournil',
  ).toBe(true);
  await walk(duo, journal, MAP, [null, COUNTER_SIDE[1]], 'comptoir', { tolerance: 0.35 });

  // L'invité choisit seul « au café »: une voix, le bandeau chez les deux.
  expect(await aimAtVillager(duo, g, 'achille', MAP, journal), 'Achille visé (invité)').toBe(true);
  await say(duo, g, 'au café', journal);
  await expect
    .poll(async () => await uiText(guest, BANNER), { timeout: 30_000 })
    .toContain('Tu as choisi');
  await expect
    .poll(async () => await uiText(host, BANNER), { timeout: 30_000 })
    .toContain('Zoé a choisi');
  await shot(host, '1-une-voix-hote');

  // L'hôte dit « à l'eau »: désaccord. Chacun voit son choix et celui de l'autre.
  expect(await aimAtVillager(duo, h, 'achille', MAP, journal), 'Achille visé (hôte)').toBe(true);
  await say(duo, h, 'relâche', journal);
  for (const [side, other] of [
    [host, 'Zoé'],
    [guest, 'Loïc'],
  ] as const) {
    await expect.poll(async () => await uiText(side, BANNER), { timeout: 30_000 }).toContain('Toi');
    const text = await uiText(side, BANNER);
    journal.log(`bandeau ${side.who}: ${text}`);
    expect(text, `${side.who} lit le choix de l’autre`).toContain(other);
  }
  await shot(host, '2-desaccord-hote');
  await shot(guest, '2-desaccord-invite');
  const split = await duo.until(guest, 'désaccord chez l’invité', () => true);
  expect(split.progress?.quests[QUEST]?.step, 'toujours à décider').toBe('decision');

  // L'invité change d'avis: accord, l'étape est franchie chez les deux, le bandeau s'efface.
  expect(await aimAtVillager(duo, g, 'achille', MAP, journal), 'Achille revisé (invité)').toBe(
    true,
  );
  await say(duo, g, 'relâche', journal);
  for (const side of [host, guest]) {
    await duo.until(
      side,
      `décision prise (${side.who})`,
      (w) => w.progress?.quests[QUEST]?.passed?.includes('decision') === true,
      60_000,
    );
    await expect.poll(async () => await uiText(side, BANNER), { timeout: 30_000 }).toBe('');
  }
  await shot(host, '3-accord-hote');
  await shot(guest, '3-accord-invite');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
