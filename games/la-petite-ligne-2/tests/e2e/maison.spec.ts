// M1 maison du garde et économie (cahier 4.7, `simulation/logement/README.md`): l'hôte va voir
// Basile dans son atelier (porte de la scierie) et entend le devis de la cuisine; l'invité
// l'attend dans la maison. Puis la cuisine se monte au chantier, devant l'ardoise de devis posée
// contre le mur sud (brique `worksite`): la touche d'action ouvre l'écran de chantier chez chacun,
// l'hôte apporte (quatre planches et quatre pierres de la sauvegarde « aubrune-recette »), paie
// (150 € pris au coffre commun), et les deux travaillent. La cuisinière et le plan de travail
// paraissent chez les deux sans recharger le lieu. L'escalier de l'étage reste fermé avant son
// étape.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { startDuo, type Side } from '../aides-e2e/duo';
import {
  ANNEX_Y,
  aimAt,
  aimAtVillager,
  aimOf,
  countOf,
  holdUntil,
  loadMapWithInteriors,
  newUiContext,
  placeAt,
  player,
  settle,
  shot,
  STRICT,
  uiText,
  walk,
} from '../aides-e2e/contenu';
import { Journal, seats, standSpots, waitDialoguesClosed } from '../aides-e2e/prologue';

test.use({ viewport: { width: 320, height: 180 } });

const MAP = loadMapWithInteriors('aubrune');
/** Portes côté rue (`carte.json`): atelier de Basile (mur est) et maison du garde (mur est). */
const WORKSHOP_DOOR = { x: 176.5, y: 88.5 };
const HOUSE_DOOR = { x: 179.5, y: 115.5 };
/** Porte de l'atelier vue de l'intérieur (`interieurs/atelier-basile.json`, pièce en (94; 210)). */
const WORKSHOP_INSIDE_DOOR = { x: 102.5, y: 213.5 };
/**
 * Maison (`interieurs/maison-rdc.json`, pièce en (14; 210)): l'ardoise de chantier de la cuisine
 * contre le mur sud, l'invité en face d'elle, l'hôte à son côté; l'escalier fermé.
 */
const SLATE = { id: 'maison-chantier-cuisine', x: 21.5, y: 216.5 };
const SLATE_SPOT = { x: 21.5, y: 215.4 };
// À l'est: de là, le réchaud (20,5; 216,5) est hors de portée, on ne vise que l'ardoise.
const SLATE_SIDE_SPOT = { x: 22.5, y: 215.4 };
const PANEL = '.lpl-ui .site-panel';
const STOVE = { id: 'maison-cuisiniere', x: 23.5, y: 216.5 };
const STOVE_SPOT = { x: 23.5, y: 215.4 };
const STAIRS = { x: 19.5, y: 214.5 };
/** Identifiant visé de l'escalier (objet visible de la porte au sol). */
const STAIRS_ID = 's-maison-rdc-esc-maison-etage';
/** Ce que dit l'escalier fermé: la phrase `says` de sa porte, relue dans les données. */
const STAIRS_SAYS =
  (
    JSON.parse(
      readFileSync(
        join(import.meta.dirname, '../../donnees/lieux/aubrune/interieurs/maison-rdc.json'),
        'utf8',
      ),
    ) as { doors: Record<string, { says?: string } | undefined> }
  ).doors['maison-rdc-esc-maison-etage']?.says ?? '';
const COST = 15_000;
const KITCHEN_FACT = 'aubrune.maison-du-garde.cuisine';

/** L'écran de chantier de cette machine: son texte, et le geste qui a le focus (`''`: fermé). */
async function site(side: Side): Promise<{ text: string; focus: string }> {
  const text = await uiText(side, PANEL);
  const focus = await side.game().evaluate(() => {
    const node = document.querySelector<HTMLElement>('.lpl-ui .site-act.is-focus');
    return node?.dataset.gesture ?? '';
  });
  return { text, focus: text === '' ? '' : focus };
}

/**
 * Appuie une touche jusqu'à ce que l'écran de chantier le montre (une touche trop tôt après
 * l'ouverture est avalée, comme pour tout écran du jeu); vrai si c'est arrivé.
 */
async function pressUntil(
  side: Side,
  code: string,
  done: (panel: { text: string; focus: string }) => boolean,
  tries = 5,
  waits = 8,
): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (done(await site(side))) return true;
    await side.press(code, 200);
    for (let wait = 0; wait < waits; wait++) {
      await side.page.waitForTimeout(700);
      if (done(await site(side))) return true;
    }
  }
  return done(await site(side));
}

test('M1 maison: devis chez Basile, cuisine payée au coffre, escalier fermé', async ({
  browser,
}) => {
  test.setTimeout(900_000);
  const journal = new Journal('m1-releves.txt');
  const ctx = newUiContext(journal, 'm1');
  const duo = await startDuo(browser, 'm1-maison', { save: 'aubrune-recette' });
  const { host, guest } = duo;
  const [h, g] = await seats(duo);
  await settle(duo, 'aubrune');
  await waitDialoguesClosed(duo, ctx);
  const start = await duo.until(host, 'monde lu', () => true);
  expect(start.common.chest, 'coffre commun de départ').toBe(COST);

  // Mise en place: l'hôte devant l'atelier de Basile, l'invité devant la maison (traverser le
  // bourg au clavier dure ici plusieurs minutes, voir `placeAt`). Chacun entre par sa porte au
  // clavier (vers l'ouest, Q d'un AZERTY).
  await placeAt(duo, journal, h.index, { x: WORKSHOP_DOOR.x + 1.1, y: WORKSHOP_DOOR.y }, 'atelier');
  await placeAt(duo, journal, g.index, { x: HOUSE_DOOR.x + 1.1, y: HOUSE_DOOR.y }, 'maison');
  const [inH, inG] = await Promise.all([
    holdUntil(duo, host, ['a'], (w) => player(w, h).body.y > ANNEX_Y, 30_000),
    holdUntil(duo, guest, ['a'], (w) => player(w, g).body.y > ANNEX_Y, 30_000),
  ]);
  expect(inH, 'l’hôte entre dans l’atelier').toBe(true);
  expect(inG, 'l’invité entre dans la maison').toBe(true);

  // Basile à son établi: on lui parle, il dit le devis (dialogue `basile-devis-cuisine`).
  const w1 = await duo.until(host, 'Basile à l’atelier', (w) => {
    const b = w.places.aubrune?.villagers?.basile?.body;
    return b !== undefined && b.y > ANNEX_Y;
  });
  const basile = w1.places.aubrune?.villagers?.basile?.body ?? { x: 98, y: 211 };
  const spot = standSpots(MAP, { x: basile.x, y: basile.y + 1 }, 1)[0] ?? basile;
  await walk(duo, journal, MAP, [spot, null], 'devant Basile', { tolerance: 0.35 });
  // Il a d'abord son souvenir de la cuisine (priorité 30), puis le devis (25): un joueur lui
  // reparle jusqu'à entendre le prix.
  const heardText = (): string => ctx.lines.map((l) => l.text).join(' | ');
  for (let talk = 0; talk < 3 && !heardText().includes('Cent cinquante'); talk++) {
    expect(await aimAtVillager(duo, h, 'basile', MAP, journal), 'Basile visé').toBe(true);
    for (let i = 0; i < 4 && (await uiText(host, '.lpl-ui .dialogue')) === ''; i++) {
      await host.press('Space', 400);
      await host.page.waitForTimeout(2500);
    }
    if (talk > 0 || heardText() === '') await shot(host, `1-basile-${String(talk + 1)}`);
    await waitDialoguesClosed(duo, ctx);
  }
  journal.log(`répliques entendues: ${heardText()}`);
  expect(heardText(), 'le devis de la cuisine').toContain('Cent cinquante euros');

  // Ressortir de l'atelier (vers l'est), puis à la maison par sa porte.
  await walk(
    duo,
    journal,
    MAP,
    [{ x: WORKSHOP_INSIDE_DOOR.x - 1.1, y: WORKSHOP_INSIDE_DOOR.y }, null],
    'porte de l’atelier',
  );
  expect(
    await holdUntil(duo, host, ['d'], (w) => player(w, h).body.y < ANNEX_Y, 20_000),
    'sorti de l’atelier',
  ).toBe(true);
  await placeAt(duo, journal, h.index, { x: HOUSE_DOOR.x + 1.1, y: HOUSE_DOOR.y }, 'maison');
  expect(
    await holdUntil(duo, host, ['a'], (w) => player(w, h).body.y > ANNEX_Y, 30_000),
    'l’hôte entre dans la maison',
  ).toBe(true);
  // Les deux devant l'ardoise de chantier de la cuisine: la touche d'action propose le chantier.
  await walk(duo, journal, MAP, [SLATE_SIDE_SPOT, SLATE_SPOT], 'devant l’ardoise de la cuisine', {
    tolerance: 0.15,
  });
  // L'invité tient la touche vers l'ardoise jusqu'à ce que l'hôte connaisse son nouveau cap. Un
  // appui bref ne suffit pas toujours ici: sur la machine d'essai chargée, la bulle de l'invité
  // (prédite chez lui) a montré l'ardoise alors que la touche d'action, jouée par l'hôte, n'ouvrait
  // rien (constat du 2026-11-11, deux parcours de suite).
  expect(
    await holdUntil(
      duo,
      guest,
      ['s'],
      (w) => Math.abs(player(w, g).body.facing - Math.PI / 2) < 0.3,
      10_000,
    ),
    'invité tourné vers l’ardoise, vu de l’hôte',
  ).toBe(true);
  expect(await aimAt(duo, h, SLATE, SLATE.id, journal), 'ardoise visée par l’hôte').toBe(true);
  expect(await aimAt(duo, g, SLATE, SLATE.id, journal), 'ardoise visée par l’invité').toBe(true);
  const offer = await aimOf(h);
  journal.log(`devant l'ardoise, la touche propose: ${offer?.verb ?? '-'}`);
  expect(offer?.verb, 'verbe du chantier').toBe('Restaurer');
  await shot(host, '2-cuisine-en-ruine');

  // Espace: l'écran de chantier s'ouvre chez chacun et dit ce que la pièce demande.
  for (const side of [host, guest])
    expect(
      await pressUntil(side, 'Space', (panel) => panel.text !== '', 2),
      `écran de chantier ouvert (${side.who})`,
    ).toBe(true);
  const quote = (await site(host)).text;
  journal.log(`écran de chantier: « ${quote} »`);
  expect(quote).toContain('Cuisine');
  expect(quote).toContain('Planche0 / 4');
  expect(quote).toContain('Pierre0 / 4');
  expect(quote).toContain('Somme due150,00 €');
  expect(quote).toContain('Coffre commun: 150,00 €');
  await shot(host, '2-chantier-devis');

  // Travailler avant d'apporter: le refus de la simulation s'écrit en clair, rien n'est payé.
  expect(
    await pressUntil(host, 'KeyD', (panel) => panel.focus === 'work', 6, 4),
    'focus sur Travailler',
  ).toBe(true);
  expect(
    await pressUntil(host, 'Space', (panel) => panel.text.includes('Les matériaux d’abord')),
    'refus en clair',
  ).toBe(true);
  expect((await site(host)).text).toContain('Planche x 4, Pierre x 4');
  await shot(host, '2-chantier-refus');
  expect((await duo.until(host, 'monde lu', () => true)).common.chest).toBe(COST);

  // Apporter: les quatre planches et les quatre pierres quittent le sac de l'hôte; l'invité le
  // voit sur son écran, en direct.
  expect(
    await pressUntil(host, 'KeyA', (panel) => panel.focus === 'supply', 6, 4),
    'focus sur Apporter',
  ).toBe(true);
  const supplied = (panel: { text: string }): boolean =>
    panel.text.includes('Planche4 / 4') && panel.text.includes('Pierre4 / 4');
  expect(await pressUntil(host, 'Space', supplied), 'matériaux apportés').toBe(true);
  await expect.poll(async () => supplied(await site(guest)), { timeout: 20_000 }).toBe(true);
  const afterSupply = await duo.until(host, 'monde lu', () => true);
  expect(countOf(afterSupply, h, 'planche'), 'planches de l’hôte').toBe(0);
  expect(countOf(afterSupply, h, 'pierre'), 'pierres de l’hôte').toBe(0);

  // Payer: le focus est passé seul au geste suivant; les 150 € quittent le coffre commun, pas
  // la bourse de l'hôte.
  await expect.poll(async () => (await site(host)).focus, { timeout: 15_000 }).toBe('pay');
  const purse = player(afterSupply, h).money;
  expect(
    await pressUntil(host, 'Space', (panel) => panel.text.includes('Somme duePayé')),
    'devis payé',
  ).toBe(true);
  const paid = await duo.until(host, 'coffre vidé', (w) => w.common.chest === 0);
  expect(player(paid, h).money, 'bourse de l’hôte intacte').toBe(purse);
  await expect
    .poll(async () => (await site(guest)).text, { timeout: 20_000 })
    .toContain('Somme duePayé');
  await shot(guest, '2-chantier-paye-invite');

  // Travailler à deux: chacun se met au marteau, l'écran le dit, la pièce se finit.
  for (const side of [host, guest])
    expect(
      await pressUntil(
        side,
        'Space',
        (panel) => panel.text.includes('Arrêter') || panel.text.includes('c’est fini'),
        3,
        16,
      ),
      `au travail (${side.who})`,
    ).toBe(true);
  await shot(host, '2-chantier-travail');
  const restored = (w: Awaited<ReturnType<typeof host.world>>): boolean =>
    w?.progress?.memory?.[KITCHEN_FACT]?.v === 'restored';
  await duo.until(host, 'cuisine restaurée chez l’hôte', restored, 180_000);
  await duo.until(guest, 'cuisine restaurée chez l’invité', restored, 30_000);
  // L'écran annonce la fin et livre l'indice de la pièce; Espace le ferme.
  for (const side of [host, guest]) {
    await expect
      .poll(async () => (await site(side)).text, { timeout: 20_000 })
      .toContain('c’est fini');
    expect((await site(side)).text, `indice de la cuisine (${side.who})`).toContain(
      'carnet de menus',
    );
  }
  await shot(host, '2-chantier-fini');
  for (const side of [host, guest])
    expect(
      await pressUntil(side, 'Space', (panel) => panel.text === ''),
      `écran de chantier fermé (${side.who})`,
    ).toBe(true);
  expect((await duo.until(host, 'monde lu', () => true)).common.chest, 'coffre après travaux').toBe(
    0,
  );

  // La cuisinière paraît chez les deux: chacun, devant elle, la vise de la touche d'action.
  await walk(duo, journal, MAP, [STOVE_SPOT, null], 'devant la cuisinière', { tolerance: 0.3 });
  expect(await aimAt(duo, h, STOVE, STOVE.id, journal), 'cuisinière visée par l’hôte').toBe(true);
  await shot(host, '3-cuisine-montee-hote');

  // L'escalier de l'étage reste fermé avant son étape: on marche dessus, on reste en bas.
  // L'invité prend la place devant la cuisinière.
  await walk(
    duo,
    journal,
    MAP,
    [{ x: STAIRS.x + 1.1, y: STAIRS.y }, STOVE_SPOT],
    'escalier et cuisinière',
    { tolerance: 0.3 },
  );
  expect(await aimAt(duo, g, STOVE, STOVE.id, journal), 'cuisinière visée par l’invité').toBe(true);
  await shot(guest, '3-cuisine-montee-invite');
  const moved = await holdUntil(
    duo,
    host,
    ['a'],
    (w) => Math.abs(player(w, h).body.x - STAIRS.x) > 4,
    4000,
  );
  expect(moved, 'pas d’étage avant son étape').toBe(false);
  const after = await duo.until(host, 'monde lu', () => true);
  expect(player(after, h).body.x, 'toujours au rez-de-chaussée').toBeGreaterThan(14);
  expect(player(after, h).body.x).toBeLessThan(24);
  // Tourné vers l'escalier, la bulle le dit fermé.
  expect(await aimAt(duo, h, STAIRS, STAIRS_ID, journal), 'escalier visé').toBe(true);
  await expect
    .poll(async () => await uiText(host, '.lpl-ui .prompt'), { timeout: 15_000 })
    .toMatch(/ferm/i);
  journal.log(`escalier: « ${await uiText(host, '.lpl-ui .prompt')} »`);
  await shot(host, '4-escalier-ferme');
  // Espace devant l'escalier fermé: le refus dit la phrase de la porte (`says` de
  // `interieurs/maison-rdc.json`, relue dans les données), pas le texte générique.
  expect(STAIRS_SAYS, 'phrase de l’escalier dans les données').not.toBe('');
  let says = '';
  for (let i = 0; i < 3 && !says.includes(STAIRS_SAYS); i++) {
    await host.press('Space', 400);
    await host.page.waitForTimeout(700);
    says = await uiText(host, '.lpl-ui .prompt');
  }
  journal.log(`escalier, après Espace: « ${says} »`);
  await shot(host, '5-escalier-espace');
  expect(says, 'la phrase de la porte fermée').toContain(STAIRS_SAYS);

  if (STRICT)
    expect(
      journal.findings.filter((f) => f.title === 'contournement'),
      'aucun contournement en mode strict',
    ).toEqual([]);
  expect(duo.errors).toEqual([]);
  await duo.close();
});
