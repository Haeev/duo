// C1 commerce au comptoir de l'épicerie d'Aubrune (cahier 4.6, `simulation/commerces/README.md`):
// les deux joueurs entrent par la porte de la place, au clavier; Espace face au comptoir tenu
// fait parler l'épicière si elle a une réplique en attente, sinon ouvre la boutique. Achat (bourse
// décomptée chez l'hôte et chez l'invité), « Parler » (P), vente d'un œuf, puis commerce fermé la
// nuit. Sauvegarde de départ « aubrune-recette » (10 h, 20 € chacun, trois œufs chacun).
import { expect, test } from '@playwright/test';
import { startDuo } from '../aides-e2e/duo';
import {
  ANNEX_Y,
  STRICT,
  aimAt,
  aimOf,
  countOf,
  holdUntil,
  loadMapWithInteriors,
  newUiContext,
  player,
  settle,
  shot,
  uiText,
  walk,
} from '../aides-e2e/contenu';
import { Journal, seats, waitDialoguesClosed } from '../aides-e2e/prologue';

const MAP = loadMapWithInteriors('aubrune');
/** Porte de l'épicerie sur la place (`carte.json`, `porte-epicerie-epicerie-rdc`), mur est. */
const STREET_DOOR = { x: 194.5, y: 116.5 };
/** Comptoir (`interieurs/epicerie-rdc.json`: pièce en (48; 210), comptoir en (2,5; 3)). */
const COUNTER_ID = 'epicerie-comptoir';
const COUNTER = { x: 50.5, y: 213 };
/** Côté client du comptoir, à moins d'un mètre de son emprise. */
const CUSTOMER = [
  { x: 51.6, y: 212.7 },
  { x: 52.8, y: 214.2 },
] as const;

// Chargement d'Aubrune en petite fenêtre: en rendu logiciel sur une machine chargée, le
// construire à 960 x 540 dans deux pages à la fois réveillait le chien de garde du faux hôte.
test.use({ viewport: { width: 320, height: 180 } });

test('C1 commerce: entrer, acheter, parler, vendre, puis fermé la nuit', async ({ browser }) => {
  test.setTimeout(480_000);
  const journal = new Journal('c1-releves.txt');
  const ctx = newUiContext(journal, 'c1');
  const duo = await startDuo(browser, 'c1-commerce', { save: 'aubrune-recette' });
  const { host, guest } = duo;
  const [h, g] = await seats(duo);
  await settle(duo, 'aubrune');
  await waitDialoguesClosed(duo, ctx);

  // Entrer par la porte de la place: devant elle, puis vers l'ouest (Q d'un AZERTY, `KeyA`).
  await walk(
    duo,
    journal,
    MAP,
    [
      { x: STREET_DOOR.x + 1.1, y: STREET_DOOR.y },
      { x: STREET_DOOR.x + 2.6, y: STREET_DOOR.y + 0.6 },
    ],
    'devant l’épicerie',
  );
  await shot(host, '1-devant-la-porte-hote');
  const inH = await holdUntil(duo, host, ['a'], (w) => player(w, h).body.y > ANNEX_Y, 20_000);
  expect(inH, 'l’hôte est entré par la porte').toBe(true);
  // L'invité suit, par la même porte (la case de la porte fait un mètre de large).
  await walk(
    duo,
    journal,
    MAP,
    [null, { x: STREET_DOOR.x + 1.1, y: STREET_DOOR.y }],
    'invité à la porte',
  );
  const inG = await holdUntil(duo, guest, ['a'], (w) => player(w, g).body.y > ANNEX_Y, 30_000);
  const wIn = await duo.until(host, 'monde lu', () => true);
  journal.log(
    `après la porte: hôte ${JSON.stringify(player(wIn, h).body)}, invité ${JSON.stringify(player(wIn, g).body)}`,
  );
  expect(inG, 'l’invité est entré par la porte').toBe(true);
  await walk(duo, journal, MAP, [CUSTOMER[0], CUSTOMER[1]], 'devant le comptoir', {
    tolerance: 0.35,
  });
  // Face au comptoir: la touche d'action le vise (et pas l'étal voisin).
  expect(await aimAt(duo, h, COUNTER, COUNTER_ID, journal), 'comptoir visé').toBe(true);

  // La commerçante parle d'abord si elle a une réplique en attente, sinon la boutique s'ouvre.
  const shop = host.game().locator('.lpl-ui .shop');
  const talking = host.game().locator('.lpl-ui .dialogue');
  const first = await aimOf(h);
  journal.log(`premier appui au comptoir: ${first?.verb ?? '?'}`);
  if (first?.verb === 'Parler') {
    await host.press('Space', 400);
    await expect(talking, 'l’épicière parle par-dessus le comptoir').toBeVisible({
      timeout: 15_000,
    });
    await shot(host, '2-replique-en-attente');
    await waitDialoguesClosed(duo, ctx);
    await expect.poll(async () => (await aimOf(h))?.verb, { timeout: 20_000 }).toBe('Acheter');
  } else expect(first?.verb, 'sans réplique en attente, le comptoir vend').toBe('Acheter');
  for (let i = 0; i < 4 && !(await shop.isVisible()); i++) {
    await host.press('Space', 400);
    await host.page.waitForTimeout(2500);
  }
  await expect(shop, 'la boutique s’ouvre chez l’hôte').toBeVisible();
  await expect(guest.game().locator('.lpl-ui .shop'), 'pas chez l’invité').toBeHidden();

  // Achat du premier article de l'étal (Entrée): la bourse baisse chez l'hôte, et l'invité le voit.
  const before = await duo.until(host, 'monde lu', () => true);
  const money0 = player(before, h).money;
  const purse0 = await uiText(host, '.lpl-ui .purse__n');
  await host.page.waitForTimeout(800);
  const article = await uiText(host, '.lpl-ui .shop-nametag');
  await host.press('Enter');
  const bought = await duo.until(host, 'achat payé', (w) => player(w, h).money < money0, 20_000);
  const money1 = player(bought, h).money;
  journal.log(`achat de « ${article} »: ${String(money0)} -> ${String(money1)} centimes`);
  await duo.until(guest, 'achat vu par l’invité', (w) => player(w, h).money === money1, 20_000);
  await expect
    .poll(async () => await uiText(host, '.lpl-ui .purse__n'), { timeout: 15_000 })
    .not.toBe(purse0);
  await shot(host, '3-achat-hote');
  await shot(guest, '3-achat-vu-par-invite');

  // « Parler » (P) depuis la boutique: la conversation s'ouvre, la boutique s'efface.
  await host.press('KeyP');
  await expect(talking, 'P ouvre la conversation').toBeVisible({ timeout: 15_000 });
  await expect(shop).toBeHidden();
  await shot(host, '4-parler');
  for (let i = 0; i < 12 && (await talking.isVisible()); i++) {
    await host.press('Backspace');
    await host.page.waitForTimeout(800);
  }
  await waitDialoguesClosed(duo, ctx);

  // Vente d'un œuf: onglet « Vendre » (E), l'œuf choisi, Entrée.
  for (let i = 0; i < 4 && !(await shop.isVisible()); i++) {
    if ((await aimOf(h))?.id !== COUNTER_ID) await aimAt(duo, h, COUNTER, COUNTER_ID, journal);
    await host.press('Space', 400);
    await host.page.waitForTimeout(2500);
  }
  await expect(shop, 'la boutique se rouvre').toBeVisible();
  await host.page.waitForTimeout(800);
  await host.press('KeyE');
  await host.page.waitForTimeout(800);
  for (let i = 0; i < 16 && (await uiText(host, '.lpl-ui .shop-nametag')) !== 'Œuf'; i++) {
    await host.press('ArrowRight');
    await host.page.waitForTimeout(500);
  }
  expect(await uiText(host, '.lpl-ui .shop-nametag'), 'l’œuf est choisi').toBe('Œuf');
  const w2 = await duo.until(host, 'monde lu', () => true);
  const eggs = countOf(w2, h, 'oeuf');
  const money2 = player(w2, h).money;
  await host.press('Enter');
  const sold = await duo.until(
    host,
    'œuf vendu',
    (w) => countOf(w, h, 'oeuf') < eggs && player(w, h).money > money2,
    20_000,
  );
  const money3 = player(sold, h).money;
  journal.log(`vente d’un œuf: ${String(money2)} -> ${String(money3)} centimes`);
  await duo.until(guest, 'vente vue par l’invité', (w) => player(w, h).money === money3, 20_000);
  await shot(host, '5-vente-hote');
  await shot(guest, '5-vente-vue-par-invite');
  for (let i = 0; i < 4 && (await shop.isVisible()); i++) {
    await host.press('Backspace');
    await host.page.waitForTimeout(800);
  }

  // La nuit (mise en place de l'heure: 21 h 30, après la fermeture de 21 h): plus de boutique.
  await duo.setMinutes(21 * 60 + 30);
  await expect
    .poll(async () => (await aimOf(h))?.refusal ?? null, { timeout: 60_000 })
    .toBe('shop-closed');
  await host.press('Space', 400);
  await host.page.waitForTimeout(2500);
  await expect(shop, 'pas de boutique la nuit').toBeHidden();
  expect(await uiText(host, '.lpl-ui .prompt')).toContain('fermé');
  await shot(host, '6-ferme-la-nuit-hote');
  await shot(guest, '6-nuit-invite');

  journal.log(`défauts: ${String(journal.findings.length)}`);
  // Les relevés d'affichage de `waitDialoguesClosed` (« hors de l'écran ») sont faits en petite
  // fenêtre (320 x 180) et ne valent pas défaut; seuls les contournements comptent ici.
  if (STRICT)
    expect(
      journal.findings.filter((f) => f.title === 'contournement'),
      'aucun contournement en mode strict',
    ).toEqual([]);
  expect(duo.errors).toEqual([]);
  await duo.close();
});
