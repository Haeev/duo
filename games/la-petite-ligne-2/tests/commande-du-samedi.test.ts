// Commande de la semaine et courrier du train du samedi (cahier 4.1; audit d'Aubrune, B.6):
// tirage identique chez l'hôte et l'invité, trois semaines (livraison entière, partielle, report
// sans pénalité), paiement, courrier remis une fois, sauvegarde et reprise, partie d'avant la
// commande, gabarits (un guichet, une table et une lettre factices ajoutés par les données seules),
// et aucune boucle d'argent dans les tables d'Aubrune.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadContent, type Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import type { WorldState } from '../src/etat/monde';
import { createProgressAssembler, progressParts } from '../src/reseau/progression';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import {
  deliveredKey,
  lettersIn,
  linesOf,
  obtainedKey,
  orderView,
  type OrderView,
} from '../src/simulation/commandes/lecture';
import { ORDERS } from '../src/simulation/commandes/reglages';
import { basePrice } from '../src/simulation/commerces/prix';
import { startTalk, talkView } from '../src/simulation/dialogues/conversation';
import { DIALOGUES } from '../src/simulation/dialogues/reglages';
import { calendarOf } from '../src/simulation/monde/calendrier';
import type { Sim } from '../src/simulation/noyau/pas';
import { remember } from '../src/simulation/regles/memoire';
import { addItem, countItem } from '../src/simulation/sac/inventaire';
import { plan } from '../outils/nouveau';
import {
  orderReminder,
  orderScreenModel,
  RECEIVER_EXPRESSION,
} from '../src/interface/commande/modele';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { dataFiles, MEMBERS, newSim } from './aides';

type Json = Record<string, unknown>;

const AUBRUNE = 'aubrune';
const TEMPLATE_DIR = fileURLToPath(new URL('../donnees/_gabarits/', import.meta.url));
/** Ce que le duo sait produire au milieu de l'histoire (faits `objets.obtenu`). */
const KNOWN = ['radis', 'carotte', 'oeuf', 'buche', 'pierre', 'goujon', 'perche', 'omelette'];

function aubrune(files: Record<string, Json>): void {
  const settings = files['commun/reglages.json'] as { start: Json };
  settings.start = { ...settings.start, place: AUBRUNE, minute: 600 };
}

const content = contentWith(aubrune);

/** Premier samedi à partir de ce jour (le jour 1 est un lundi). */
function saturdayFrom(c: Content, day: number): number {
  let d = day;
  while (calendarOf(c, d).weekday !== 'saturday') d++;
  return d;
}

/** Une partie à Aubrune après l'acte 2, le duo sachant produire `KNOWN`, au jour et à l'heure dits. */
function lateSim(c: Content = content, seed = 7, day = 2, minutes = 600): Sim {
  const sim = newSim(c, seed);
  wait(sim, 0.2);
  const story = sim.world.common.story;
  if (story !== undefined) story.scene = null;
  const ctx = contextOf(sim);
  remember(ctx, 'aubrune.acte2.train', true, 'duo');
  remember(ctx, 'aubrune.acte2.fini', true, 'duo');
  for (const item of KNOWN) remember(ctx, obtainedKey(item), true, 'duo');
  goTo(sim, day, minutes);
  return sim;
}

/** Change de jour et d'heure, puis laisse passer un contrôle du système (une seconde). */
function goTo(sim: Sim, day: number, minutes: number): void {
  sim.world.common.day = day;
  sim.world.minutes = minutes;
  wait(sim, 1.1);
}

function order(sim: Sim): OrderView {
  const view = orderView(sim.content, sim.world, AUBRUNE);
  if (view === null) throw new Error('pas de commande');
  return view;
}

/** Le joueur se tient à côté de Rosalie (elle est au quai tant que le train est là). */
function besideRosalie(sim: Sim, player: PlayerIndex): void {
  const body = sim.world.places[AUBRUNE]?.villagers.rosalie?.body;
  if (body === undefined) throw new Error('Rosalie absente');
  sim.world.players[player].body.x = body.x + 0.8;
  sim.world.players[player].body.y = body.y;
}

function emptyPockets(sim: Sim, player: PlayerIndex): void {
  const state = sim.world.players[player];
  state.toolbar = state.toolbar.map(() => null);
  if (state.bag !== null) state.bag.slots = state.bag.slots.map(() => null);
  state.selected = null;
}

/** Range des objets dans la consigne de la halte (une case libre par appel). */
function stash(sim: Sim, item: string, count: number): void {
  const slots = sim.world.places[AUBRUNE]?.objects['halte-consigne']?.store;
  const free = slots?.findIndex((s) => s === null) ?? -1;
  if (slots === undefined || free < 0) throw new Error('consigne pleine');
  slots[free] = { item, count };
}

function refusals(events: Sim['events']): string[] {
  return events.flatMap((e) => (e.type === 'refused' ? [e.reason] : []));
}

describe('commande du samedi', () => {
  it('le tirage est le même chez l’hôte et chez l’invité, qui n’a pas la graine', () => {
    const host = lateSim();
    const view = order(host);
    expect(view.due).toBe(saturdayFrom(content, 2));
    expect(view.lines.length).toBeGreaterThanOrEqual(3);
    expect(view.lines.length).toBeLessThanOrEqual(5);
    // Rien que ce que le duo sait produire, et jamais deux fois le même objet.
    for (const line of view.lines) expect(KNOWN).toContain(line.item);
    expect(new Set(view.lines.map((l) => l.item)).size).toBe(view.lines.length);
    // Même graine, même commande; la commande voyage en faits jusqu'à l'invité.
    expect(order(lateSim()).lines).toEqual(view.lines);
    const guest = createProgressAssembler();
    let received = null;
    for (const part of progressParts(null, host.world.progress, 1, -1, host.world.tick, 4096))
      received = guest.receive(part) ?? received;
    if (received === null) throw new Error('progression non reçue');
    const guestWorld: WorldState = { ...host.world, seed: 0, progress: received };
    expect(orderView(content, guestWorld, AUBRUNE)).toEqual(view);
    // Une autre graine tire une autre commande (au moins une des trois essayées).
    const others = [8, 9, 10].map((seed) => JSON.stringify(order(lateSim(content, seed)).lines));
    expect(others.some((o) => o !== JSON.stringify(view.lines))).toBe(true);
  });

  it('trois semaines: livraison entière, partielle, puis report sans pénalité', () => {
    const sim = lateSim();
    const first = saturdayFrom(content, 2);
    const week1 = order(sim);
    const [full, half, none] = week1.lines;
    if (full === undefined || half === undefined || none === undefined) throw new Error('3 lignes');

    // Samedi, train à quai: la livraison est possible à côté de Rosalie, pas avant.
    goTo(sim, first, 620);
    emptyPockets(sim, 0);
    besideRosalie(sim, 0);
    const me = sim.world.players[0];
    stash(sim, full.item, full.asked);
    const halfCount = Math.max(1, Math.floor(half.asked / 2));
    addItem(sim.content, me, half.item, halfCount);
    const chest = sim.world.common.chest;
    expect(refusals(act(sim, 0, { type: 'order_deliver', line: full.id }))).toEqual([]);
    expect(refusals(act(sim, 0, { type: 'order_deliver', line: half.id }))).toEqual([]);
    expect(refusals(act(sim, 0, { type: 'order_deliver', line: none.id }))).toEqual([
      'order-nothing',
    ]);
    // Payé ligne par ligne, au coffre commun (la Compagnie paie la halte).
    expect(sim.world.common.chest - chest).toBe(full.asked * full.price + halfCount * half.price);
    expect(sim.world.places[AUBRUNE]?.objects['halte-consigne']?.store?.[0]).toBeNull();
    expect(order(sim).lines.find((l) => l.id === half.id)?.delivered).toBe(halfCount);
    expect(sim.world.progress.memory['commande.aubrune.lignes-livrees']?.v).toBe(1);

    // Le train repart: la commande suivante reporte le reste, sans pénalité.
    const chestAfter = sim.world.common.chest;
    const purse = me.money;
    goTo(sim, first, 900);
    const week2 = order(sim);
    expect(week2.due).toBe(first + 7);
    expect(sim.world.common.chest).toBe(chestAfter);
    expect(me.money).toBe(purse);
    expect(week2.lines.find((l) => l.id === full.id)).toBeUndefined();
    expect(week2.lines.find((l) => l.id === half.id)).toMatchObject({
      asked: half.asked - halfCount,
      delivered: 0,
    });
    expect(week2.lines.find((l) => l.id === none.id)).toMatchObject({
      asked: none.asked,
      delivered: 0,
    });
    expect(week2.lines.length).toBeLessThanOrEqual(5);

    // Semaine 2: rien de livré. Semaine 3: tout reste demandé, rien n'est perdu.
    goTo(sim, first + 7, 900);
    const week3 = order(sim);
    expect(week3.due).toBe(first + 14);
    for (const line of week2.lines)
      expect(week3.lines.find((l) => l.id === line.id)?.asked).toBe(line.asked);

    // Semaine 3: tout livré, du sac et de la consigne de la halte.
    goTo(sim, first + 14, 700);
    besideRosalie(sim, 0);
    emptyPockets(sim, 0);
    const consigne = sim.world.places[AUBRUNE]?.objects['halte-consigne']?.store;
    if (consigne === undefined) throw new Error('consigne absente');
    const [split, ...rest] = week3.lines;
    if (split === undefined) throw new Error('commande vide');
    addItem(sim.content, me, split.item, 1);
    consigne[0] = { item: split.item, count: split.asked - 1 };
    for (const line of rest) stash(sim, line.item, line.asked);
    for (const line of week3.lines)
      expect(refusals(act(sim, 0, { type: 'order_deliver', line: line.id }))).toEqual([]);
    expect(consigne[0]).toBeNull();
    expect(order(sim).lines.every((l) => l.delivered === l.asked)).toBe(true);
    goTo(sim, first + 14, 900);
    expect(order(sim).lines.every((l) => l.delivered === 0)).toBe(true);
  });

  it('hors des heures du train, ou loin de Rosalie, rien ne se livre', () => {
    const sim = lateSim();
    const line = order(sim).lines[0];
    if (line === undefined) throw new Error('commande vide');
    addItem(sim.content, sim.world.players[0], line.item, line.asked);
    expect(refusals(act(sim, 0, { type: 'order_deliver', line: line.id }))).toEqual([
      'order-closed',
    ]);
    goTo(sim, saturdayFrom(content, 2), 620);
    sim.world.players[0].body.x = 5;
    sim.world.players[0].body.y = 5;
    expect(refusals(act(sim, 0, { type: 'order_deliver', line: line.id }))).toEqual(['too-far']);
  });

  it('l’argent va à la bourse de qui livre quand le guichet le dit', () => {
    const c = contentWith((files) => {
      aubrune(files);
      (files['lieux/aubrune/commande.json'] as Json).pay = 'deliverer';
    });
    const sim = lateSim(c);
    const line = order(sim).lines[0];
    if (line === undefined) throw new Error('commande vide');
    goTo(sim, saturdayFrom(c, 2), 620);
    besideRosalie(sim, 1);
    emptyPockets(sim, 1);
    stash(sim, line.item, line.asked);
    const purse = sim.world.players[1].money;
    const chest = sim.world.common.chest;
    act(sim, 1, { type: 'order_deliver', line: line.id });
    expect(sim.world.players[1].money - purse).toBe(line.asked * line.price);
    expect(sim.world.common.chest).toBe(chest);
  });

  it('Rosalie propose la livraison à la fin de la conversation, et l’écran s’ouvre', () => {
    const sim = lateSim();
    goTo(sim, saturdayFrom(content, 2), 620);
    besideRosalie(sim, 0);
    expect(startTalk(contextOf(sim), 0, 'rosalie')).toBe(true);
    for (let i = 0; i < 12; i++) {
      const talk = sim.world.players[0].talk;
      if (talk === null || talk.node === DIALOGUES.orderOffer.node) break;
      const first = talkView(sim.content, sim.world, 0)?.options[0];
      act(
        sim,
        0,
        first === undefined ? { type: 'talk_next' } : { type: 'talk_choose', option: first.id },
      );
    }
    expect(sim.world.players[0].talk?.node).toBe(DIALOGUES.orderOffer.node);
    expect(talkView(sim.content, sim.world, 0)?.options.map((o) => o.text)).toEqual([
      'Livrer la commande',
      'Pas maintenant',
    ]);
    expect(act(sim, 0, { type: 'talk_choose', option: DIALOGUES.orderOffer.open })).toContainEqual({
      type: 'order_opened',
      player: 0,
      place: AUBRUNE,
    });
    expect(sim.world.players[0].talk).toBeNull();
  });

  it('le courrier arrive avec le train et n’est remis qu’une fois, pièce jointe comprise', () => {
    const sim = lateSim();
    const first = saturdayFrom(content, 2);
    expect(lettersIn(content, sim.world, AUBRUNE, ORDERS.mailWaiting)).toEqual([]);
    goTo(sim, first, 620);
    const waiting = lettersIn(content, sim.world, AUBRUNE, ORDERS.mailWaiting).map((l) => l.id);
    expect(waiting).toEqual(['compagnie-la-halte-rouvre', 'margot-on-arrive']);
    besideRosalie(sim, 1);
    emptyPockets(sim, 1);
    const events = act(sim, 1, { type: 'mail_take' });
    expect(events).toContainEqual({
      type: 'mail_taken',
      player: 1,
      place: AUBRUNE,
      letters: waiting,
    });
    expect(countItem(sim.world.players[1], 'graines-carotte')).toBe(6);
    expect(refusals(act(sim, 1, { type: 'mail_take' }))).toEqual(['mail-none']);
    besideRosalie(sim, 0);
    expect(refusals(act(sim, 0, { type: 'mail_take' }))).toEqual(['mail-none']);
    // Le samedi suivant: la lettre de Berthe, jamais deux fois les mêmes.
    goTo(sim, first + 7, 620);
    expect(lettersIn(content, sim.world, AUBRUNE, ORDERS.mailWaiting).map((l) => l.id)).toEqual([
      'berthe-ma-meule',
    ]);
    expect(lettersIn(content, sim.world, AUBRUNE, ORDERS.mailTaken).map((l) => l.id)).toEqual(
      waiting,
    );
    expect(countItem(sim.world.players[1], 'graines-carotte')).toBe(6);
  });

  it('sauvegarde et reprise: la commande, ses livraisons et le courrier reviennent tels quels', () => {
    const sim = lateSim();
    const first = saturdayFrom(content, 2);
    goTo(sim, first, 620);
    besideRosalie(sim, 0);
    const line = order(sim).lines[0];
    if (line === undefined) throw new Error('commande vide');
    addItem(sim.content, sim.world.players[0], line.item, 1);
    act(sim, 0, { type: 'order_deliver', line: line.id });
    act(sim, 0, { type: 'mail_take' });
    const snapshot = snapshotOf(sim.world, content);
    const loaded = JSON.parse(
      JSON.stringify({ dataSchema: snapshot.dataSchema, data: snapshot.data }),
    ) as {
      dataSchema: number;
      data: unknown;
    };
    const restored = restoreWorld(content, loaded, MEMBERS);
    if (!restored.ok) throw new Error(restored.reason);
    expect(orderView(content, restored.world, AUBRUNE)).toEqual(order(sim));
    expect(restored.world.progress.memory[deliveredKey(AUBRUNE, line.id)]?.v).toBe(1);
    expect(lettersIn(content, restored.world, AUBRUNE, ORDERS.mailTaken)).toHaveLength(2);
  });

  it('une partie d’avant la commande: ce qui a été vendu ou se tient en main compte comme su', () => {
    const sim = newSim(content);
    wait(sim, 0.2);
    const story = sim.world.common.story;
    if (story !== undefined) story.scene = null;
    const ctx = contextOf(sim);
    remember(ctx, 'aubrune.acte2.fini', true, 'duo');
    // Aucun fait `objets.obtenu`: des œufs vendus au fournil, des bûches dans le sac.
    remember(ctx, 'ventes.fournil-pradel.oeuf', 12, 'duo');
    emptyPockets(sim, 0);
    emptyPockets(sim, 1);
    addItem(sim.content, sim.world.players[0], 'buche', 3);
    goTo(sim, 2, 600);
    const items = order(sim)
      .lines.map((l) => l.item)
      .sort();
    expect(items).toEqual(['buche', 'oeuf']);
  });
});

describe('écran de livraison et carnet', () => {
  it('le carnet annonce la commande à l’avance; l’écran dit ce que le sac et la consigne contiennent', () => {
    const sim = lateSim();
    const view = order(sim);
    const reminder = orderReminder(content, sim.world, AUBRUNE);
    expect(reminder?.head).toBe(`Commande du samedi, jour ${String(view.due)}`);
    for (const line of view.lines)
      expect(reminder?.body).toContain(
        `${content.items[line.item]?.name ?? ''} × ${String(line.asked)}`,
      );
    goTo(sim, view.due, 620);
    besideRosalie(sim, 0);
    emptyPockets(sim, 0);
    const [first] = view.lines;
    if (first === undefined) throw new Error('commande vide');
    addItem(sim.content, sim.world.players[0], first.item, 1);
    stash(sim, first.item, 2);
    const model = orderScreenModel(content, sim.world, 0, AUBRUNE);
    expect(model?.here).toBe(true);
    expect(model?.receiverName).toBe('Rosalie Vasseur');
    expect(model?.rows[0]).toMatchObject({
      bag: 1,
      store: 2,
      deliverable: Math.min(3, first.asked),
    });
    expect(model?.waiting.map((l) => l.id)).toEqual([
      'compagnie-la-halte-rouvre',
      'margot-on-arrive',
    ]);
    expect(model?.mood).toBe('mail');
    // Prix à l'unité et « à recevoir » séparés: le reste rapporte prix x reste, rien n'est reçu.
    const row = model?.rows[0];
    expect(row?.due).toBe(first.price * first.asked);
    expect(row?.received).toBe(0);
    expect(model?.toReceive).toBe(view.lines.reduce((s, l) => s + l.price * l.asked, 0));
    expect(model?.received).toBe(0);
  });

  it('l’expression de Rosalie suit sa réplique: soucieuse quand le reste attendra samedi prochain', () => {
    expect(RECEIVER_EXPRESSION.partial).toBe('soucieux');
    expect(RECEIVER_EXPRESSION.open).toBe('content');
    expect(RECEIVER_EXPRESSION.thanks).toBe('content');
    expect(RECEIVER_EXPRESSION.nothing).not.toBe('content');
  });
});

describe('gabarits de la commande', () => {
  it('un guichet, une table et une lettre factices, ajoutés par les seules données, paraissent en jeu', () => {
    const files = dataFiles() as Record<string, Json>;
    for (const [type, id] of [
      ['guichet-de-commande', 'commande'],
      ['commande', 'verger'],
      ['lettre', 'cousine'],
    ] as const)
      for (const file of plan(TEMPLATE_DIR, type, id, 'essai-gare')) {
        expect(files[file.path], file.path).toBeUndefined();
        files[file.path] = file.value;
      }
    const c = loadContent(files);
    expect(c.places['essai-gare']?.orders?.tables.map((t) => t.id)).toEqual(['verger']);
    const sim = newSim(c);
    wait(sim, 0.2);
    const ctx = contextOf(sim);
    remember(ctx, 'essai-gare.fete.vue', true, 'duo');
    remember(ctx, obtainedKey('pomme'), true, 'duo');
    const saturday = saturdayFrom(c, sim.world.common.day);
    sim.world.common.day = saturday;
    sim.world.minutes = 600;
    wait(sim, 1.1);
    const view = orderView(c, sim.world, 'essai-gare');
    expect(view?.lines.map((l) => l.id)).toEqual(['pomme-du-verger']);
    const keeper = sim.world.places['essai-gare']?.villagers['cheffe-de-gare']?.body;
    if (keeper === undefined || view === null) throw new Error('cheffe absente');
    sim.world.players[0].body.x = keeper.x + 0.8;
    sim.world.players[0].body.y = keeper.y;
    emptyPockets(sim, 0);
    const line = view.lines[0];
    if (line === undefined) throw new Error('ligne absente');
    addItem(c, sim.world.players[0], 'pomme', line.asked);
    const chest = sim.world.common.chest;
    expect(refusals(act(sim, 0, { type: 'order_deliver', line: line.id }))).toEqual([]);
    expect(sim.world.common.chest - chest).toBe(line.asked * 80);
    act(sim, 0, { type: 'mail_take' });
    expect(lettersIn(c, sim.world, 'essai-gare', ORDERS.mailTaken).map((l) => l.id)).toEqual([
      'cousine',
    ]);
  });
});

describe('tables d’Aubrune', () => {
  const place = content.places[AUBRUNE];
  const orders = place?.orders;
  if (place === undefined || orders === null || orders === undefined)
    throw new Error('guichet d’Aubrune absent');
  const shops = Object.values(place.shops);
  const best = (item: string): number | null =>
    shops.reduce<number | null>((m, shop) => {
      const p = basePrice(content, shop, item);
      return p === null ? m : Math.max(m ?? 0, p);
    }, null);
  const cheapest = (item: string): number | null =>
    shops.reduce<number | null>(
      (m, shop) =>
        shop.sells.reduce<number | null>(
          (n, line) => (line.item === item ? Math.min(n ?? line.price, line.price) : n),
          m,
        ),
      null,
    );

  it('une trentaine de lignes, sur les six métiers', () => {
    expect(linesOf(orders).size).toBeGreaterThanOrEqual(30);
    expect(orders.tables.map((t) => t.id).sort()).toEqual(
      ['artisanat', 'cueillette', 'cuisine', 'elevage', 'peche', 'potager'].sort(),
    );
  });

  it('un peu mieux que le comptoir, sans jamais ouvrir de boucle d’argent', () => {
    for (const { line } of linesOf(orders).values()) {
      const counter = best(line.item);
      // Mieux que le meilleur rachat, sans dépasser 1,3 fois (le besoin du jour paie 1,5).
      if (counter !== null) {
        expect(line.price, line.id).toBeGreaterThan(counter);
        expect(line.price, line.id).toBeLessThanOrEqual(Math.round((counter * 1.3) / 10) * 10);
      }
      // Sous le prix de tout commerce qui le vend: acheter pour livrer ne rapporte rien.
      const shelf = cheapest(line.item);
      if (shelf !== null) expect(line.price, line.id).toBeLessThan(shelf);
      // Un plat dont tous les ingrédients s'achètent: payé moins que ses ingrédients, réussi parfait.
      for (const recipe of Object.values(content.recipes)) {
        if (recipe.output.item !== line.item) continue;
        let cost = 0;
        for (const input of recipe.inputs) {
          const unit = cheapest(input.item);
          cost = unit === null || cost < 0 ? -1 : cost + unit * input.count;
        }
        if (cost < 0) continue;
        const most = Math.max(recipe.output.count, recipe.quality?.perfect?.count ?? 0);
        expect(line.price * most, `${line.id} (${recipe.id})`).toBeLessThanOrEqual(cost);
      }
    }
  });
});
