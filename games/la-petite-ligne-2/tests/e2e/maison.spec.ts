// M1 maison du garde et économie (cahier 4.7, `simulation/logement/README.md`): l'hôte va voir
// Basile dans son atelier (porte de la scierie) et entend le devis de la cuisine; l'invité
// l'attend dans la maison. Puis la cuisine se paie au coffre commun (150 €, fournis par la
// sauvegarde « aubrune-recette » avec quatre planches et quatre pierres), et la cuisinière et le
// plan de travail paraissent chez les deux. L'escalier de l'étage reste fermé avant son étape.
//
// DÉFAUT CONSTATÉ (2026-11-11, version 0.21.0): aucune touche ni aucun écran n'envoie les
// intentions du chantier (`housing_supply`, `housing_pay`, `housing_work`): seul le mode déco
// (B) parle au logement. Dans la cuisine en ruine, la touche d'action ne propose que le réchaud
// (« Cuisiner ») ou le lit (« Se coucher »), le coffre ne bouge pas: la cuisine ne peut pas se
// payer en jeu. Le parcours le constate (vérification souple, il reste rouge) puis pose la
// pièce restaurée par la sonde (comme `briques.spec.ts`) pour vérifier la suite: meubles visés
// chez les deux, escalier fermé.
import { expect, test } from '@playwright/test';
import { startDuo } from '../aides-e2e/duo';
import {
  ANNEX_Y,
  aimAt,
  aimAtVillager,
  aimOf,
  holdUntil,
  loadMapWithInteriors,
  newUiContext,
  placeAt,
  player,
  probeCall,
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
/** Maison (`interieurs/maison-rdc.json`, pièce en (14; 210)): coin cuisine, escalier fermé. */
const KITCHEN_SPOT = { x: 21.5, y: 215.5 };
const STOVE = { id: 'maison-cuisiniere', x: 23.5, y: 216.5 };
const STOVE_SPOT = { x: 23.5, y: 215.4 };
const STAIRS = { x: 19.5, y: 214.5 };
/** Identifiant visé de l'escalier (objet visible de la porte au sol). */
const STAIRS_ID = 's-maison-rdc-esc-maison-etage';
const COST = 15_000;

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
  await walk(duo, journal, MAP, [KITCHEN_SPOT, { x: 22.5, y: 212.5 }], 'coin cuisine', {
    tolerance: 0.35,
  });

  // Payer la cuisine comme un joueur: au coin cuisine, se tourner vers chaque côté et lire ce
  // que propose la touche d'action. Attendu: une action de chantier (apporter, payer, travailler)
  // qui paie au coffre commun (150 €). Obtenu: seul le réchaud (« Cuisiner »). On n'appuie pas
  // sur le réchaud (il ouvrirait la cuisine). Voir DÉFAUT CONSTATÉ en tête du fichier.
  const offers: string[] = [];
  for (const key of ['s', 'd', 'a', 'w']) {
    await host.press(`Key${key.toUpperCase()}`, 150);
    await host.page.waitForTimeout(1800);
    const a = await aimOf(h);
    offers.push(`${a?.id ?? 'rien'} (${a?.verb ?? '-'})`);
  }
  journal.log(`au coin cuisine, la touche propose: ${offers.join(', ')}`);
  await shot(host, '2-cuisine-en-ruine');
  const site = offers.some((o) => /Apporter|Payer|Travailler|Restaurer|Chantier/i.test(o));
  expect.soft(site, 'DÉFAUT: aucune action de chantier proposée dans la cuisine').toBe(true);
  // Coffre inchangé: rien n'a été payé (150 € toujours là).
  expect((await duo.until(host, 'monde lu', () => true)).common.chest).toBe(COST);

  // Suite vérifiée par une mise en place explicite: la pièce restaurée, comme à la fin du
  // chantier (fait `aubrune.maison-du-garde.cuisine`, valeur `restored`).
  if (!site) {
    journal.find('majeur', 'cuisine impayable', 'aucune action de chantier dans la maison');
    expect(
      await probeCall(host, 'remember', 'aubrune.maison-du-garde.cuisine', 'restored'),
      'fait retenu par la sonde',
    ).toBe(true);
  }
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
  // `interieurs/maison-rdc.json`), pas le texte générique.
  let says = '';
  for (let i = 0; i < 3 && !/escalier/i.test(says); i++) {
    await host.press('Space', 400);
    await host.page.waitForTimeout(700);
    says = await uiText(host, '.lpl-ui .prompt');
  }
  journal.log(`escalier, après Espace: « ${says} »`);
  await shot(host, '5-escalier-espace');
  expect(says, 'la phrase de la porte fermée').toMatch(/Pas d.escalier/);

  if (STRICT)
    expect(
      journal.findings.filter((f) => f.title === 'contournement'),
      'aucun contournement en mode strict',
    ).toEqual([]);
  expect(duo.errors).toEqual([]);
  await duo.close();
});
