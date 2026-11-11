// D1 décision à deux (cahier 4.10, `interface/rappel-decision.ts`): la Baronne attend dans
// l'épuisette, Achille demande aux deux joueurs de décider. L'invité dit « au café », l'hôte « à
// l'eau »: désaccord, le bandeau le dit chez les deux, chacun y lit le choix de l'autre. Puis
// l'invité change d'avis: accord, le bandeau s'efface et l'étape « decision » de la suite « La
// Baronne » est franchie chez les deux. Sauvegarde « aubrune-recette » (décision ouverte, 10 h).
import { expect, test } from '@playwright/test';
import { startDuo, type ProbeWorld, type Side } from '../aides-e2e/duo';
import {
  ANNEX_Y,
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
/** Devant le comptoir du fournil (`interieurs/fournil.json`: pièce en (68; 210)), côté client. */
const COUNTER_SIDE = [
  { x: 72.6, y: 213.9 },
  { x: 73.6, y: 213.9 },
] as const;
const BANNER = '.lpl-ui .decision-rappel';

/** Parle à Achille, va jusqu'aux choix, prend l'option dont le texte contient `option`. */
async function say(seat: Seat, option: string, journal: Journal): Promise<void> {
  const side: Side = seat.side;
  const choices = side.game().locator('.lpl-ui .choice');
  const talking = side.game().locator('.lpl-ui .dialogue');
  for (let i = 0; i < 4 && !(await talking.isVisible()); i++) {
    await side.press('Space', 400);
    await side.page.waitForTimeout(2500);
  }
  await expect(talking, `${side.who}: Achille parle`).toBeVisible();
  const heard: string[] = [];
  for (let i = 0; i < 16 && !(await choices.first().isVisible()); i++) {
    const line = await uiText(side, '.lpl-ui .dialogue .dlg__text');
    if (line !== '' && heard.at(-1) !== line) heard.push(line);
    await side.press('Space', 400);
    await side.page.waitForTimeout(900);
  }
  journal.log(`${side.who} entend: ${heard.join(' | ')}`);
  await expect(choices.first(), `${side.who}: les choix paraissent`).toBeVisible();
  for (let i = 0; i < 6; i++) {
    const focused = await uiText(side, '.lpl-ui .choice.focus');
    if (focused.includes(option)) break;
    await side.press('KeyS');
    await side.page.waitForTimeout(600);
  }
  expect(await uiText(side, '.lpl-ui .choice.focus'), `${side.who}: choix « ${option} »`).toContain(
    option,
  );
  journal.log(`${side.who} choisit « ${option} »`);
  await side.press('Enter');
  await side.page.waitForTimeout(1500);
  // La réplique qui suit (« Une voix », « Deux voix, deux avis », ou l'accord) se lit puis se ferme.
  for (let i = 0; i < 12 && (await talking.isVisible()); i++) {
    await side.press('Space', 400);
    await side.page.waitForTimeout(1200);
  }
  await expect(talking, `${side.who}: conversation finie`).toBeHidden({ timeout: 20_000 });
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
  await say(g, 'au café', journal);
  await expect
    .poll(async () => await uiText(guest, BANNER), { timeout: 30_000 })
    .toContain('Tu as choisi');
  await expect
    .poll(async () => await uiText(host, BANNER), { timeout: 30_000 })
    .toContain('Zoé a choisi');
  await shot(host, '1-une-voix-hote');

  // L'hôte dit « à l'eau »: désaccord. Chacun voit son choix et celui de l'autre.
  expect(await aimAtVillager(duo, h, 'achille', MAP, journal), 'Achille visé (hôte)').toBe(true);
  await say(h, 'relâche', journal);
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
  await say(g, 'relâche', journal);
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
