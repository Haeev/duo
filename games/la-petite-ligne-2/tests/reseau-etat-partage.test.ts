// Ce que l'hôte possède, l'invité le voit (mission du 2026-11-11: l'album des collections ne
// partait jamais chez l'invité). Trois filets:
//
// 1. Égalité: après un scénario qui touche chaque sous-système, l'état connu de l'invité est égal
//    à celui de l'hôte, champ pour champ, hors de la liste `LOCAL` (chacun avec sa raison).
// 2. Couverture: tout champ déclaré dans `WorldSchema` (jusqu'à trois noms de profondeur) doit
//    être rempli par le scénario. Un champ ajouté demain fait donc échouer ce test tant qu'il
//    n'est pas dans `fillEverything` (une ligne); une fois rempli, l'égalité dit s'il est transmis.
// 3. Reconnexion et coût: l'invité qui revient retrouve tout; aucune révision complète en régime.
//
// Plus profond que trois noms, l'état part en JSON entier (rien n'y est trié champ par champ):
// l'égalité profonde reste vérifiée sur ce que le scénario contient.
import type { Net } from '@duo/sdk';
import * as v from 'valibot';
import { afterAll, describe, expect, it } from 'vitest';
import type { Find } from '../src/donnees/schemas/collections';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { SLOTS } from '../src/donnees/schemas/personnage';
import type { PlayerState } from '../src/etat/joueur';
import { DATA_SCHEMA, WorldSchema, type WorldState } from '../src/etat/monde';
import { bondKey } from '../src/etat/progression';
import { worldSources } from '../src/interface/carnet/lectures';
import { BUDGET_BYTES, CHANNEL } from '../src/reseau/canaux';
import { createGuest, type Guest } from '../src/reseau/invite';
import { createHost } from '../src/reseau/hote';
import { cloneProgress, progressParts } from '../src/reseau/progression';
import { NET_SETTINGS } from '../src/reseau/reglages';
import { byteLength, currentPlace } from '../src/reseau/tranches';
import { readSave } from '../src/sauvegarde/format';
import { assistLevelOf } from '../src/simulation/aide';
import { recordFind, revealHint } from '../src/simulation/collections/registre';
import { dueKey, mailKey } from '../src/simulation/commandes/lecture';
import { dailyNeed } from '../src/simulation/commerces/prix';
import { isKnown } from '../src/simulation/cuisine/recettes';
import { isPlanKnown } from '../src/simulation/fabrication/plans';
import { eventDayKey } from '../src/simulation/monde/calendrier';
import { bestKey, bestRating, knownAirs, playableAirs } from '../src/simulation/musique/lecture';
import { idleInput } from '../src/simulation/noyau/entrees';
import { createPlaceState } from '../src/simulation/noyau/monde';
import { step, type Sim } from '../src/simulation/noyau/pas';
import { remember } from '../src/simulation/regles/memoire';
import { giveRecipe, givePiece, givePlan, hasPiece } from '../src/simulation/regles/recompenses';
import { MEMBERS, gameContent, newSim } from './aides';
import { contextOf } from './aides-l3';
import { createVirtualLink, memoryLog } from './aides-reseau';

const content = gameContent();

/**
 * Champs que l'invité n'a volontairement pas. Deux autres écarts voulus sont dans `sharedView`:
 * les lieux autres que le lieu courant (ADR 0018: seul le lieu où sont les deux joueurs est
 * simulé, rendu et transmis; les autres vivent dans la sauvegarde de l'hôte et arrivent entiers
 * au voyage), et la position des habitants, arrondie au centième sur le canal rapide.
 */
const LOCAL: Readonly<Record<string, string>> = {
  'world.rng':
    'état du générateur aléatoire de la simulation: il change à chaque pas et ne sert qu’à l’hôte, seul à simuler',
};

// Envois de l'hôte, mesurés à la sortie.

interface Sent {
  readonly channel: number;
  readonly bytes: number;
  /** Révision complète de l'état du lieu ou de la progression (`base: -1`). */
  readonly full: boolean;
}

function metered(net: Net, sent: Sent[]): Net {
  return {
    role: net.role,
    sessionTimeMs: () => net.sessionTimeMs(),
    quality: () => net.quality(),
    channel(id, options) {
      const channel = net.channel(id, options);
      return {
        id,
        send(message) {
          const full =
            typeof message === 'object' && message !== null && 'base' in message
              ? message.base === -1
              : false;
          sent.push({ channel: id, bytes: byteLength(message), full });
          channel.send(message);
        },
        onMessage: (listener) => channel.onMessage(listener),
      };
    },
  };
}

function totals(sent: readonly Sent[]): Record<string, number> {
  const names = new Map<number, string>(Object.entries(CHANNEL).map(([name, id]) => [id, name]));
  const out: Record<string, number> = {};
  for (const message of sent) {
    const name = names.get(message.channel) ?? String(message.channel);
    out[name] = (out[name] ?? 0) + message.bytes;
  }
  return out;
}

function pair(sim: Sim) {
  const clock = { now: 0 };
  const link = createVirtualLink(
    { latencyMs: 20, jitterMs: 5, lossPercent: 0 },
    11,
    () => clock.now,
  );
  const log = memoryLog();
  const sent: Sent[] = [];
  const state = { frozen: false, seq: 0 };
  const host = createHost(sim, metered(link.host, sent), log, 0, {
    advance(s, inputs, intents) {
      // Monde figé: seul le pas avance, pour que les tranches partent à leur cadence et que la
      // comparaison se fasse sur un état qui ne bouge plus.
      if (!state.frozen) step(s, inputs, intents);
      else {
        s.world.tick += 1;
        s.events.length = 0;
      }
    },
  });
  const join = (): Guest =>
    createGuest(content, link.guest, MEMBERS[1].id, { now: () => clock.now });
  const duo = {
    host,
    guest: join(),
    log,
    link,
    sent,
    freeze(value: boolean): void {
      state.frozen = value;
    },
    run(steps: number): void {
      for (let i = 0; i < steps; i++) {
        clock.now += 1000 / 30;
        link.deliver(clock.now);
        host.step(idleInput(0));
        duo.guest.step(idleInput((state.seq += 1)));
        link.deliver(clock.now);
      }
    },
    /** Monde figé, le temps que chaque tranche parte (15 pas pour la progression), puis le fil se vide. */
    settle(steps = 20): void {
      state.frozen = true;
      duo.run(steps);
      clock.now += 2000;
      link.deliver(clock.now);
    },
    /** L'invité quitte le jeu et revient: une instance neuve, qui ne sait rien. */
    rejoin(): void {
      duo.guest.dispose();
      duo.guest = join();
    },
  };
  host.sendAll();
  return duo;
}

// Comparaison.

const centi = (value: number): number => Math.round(value * 100) / 100;

/** Ce que les deux machines doivent avoir en commun, sous une forme comparable. */
function sharedView(world: WorldState): unknown {
  const copy = v.parse(WorldSchema, JSON.parse(JSON.stringify(world)));
  const view: Record<string, unknown> = { ...copy };
  for (const path of Object.keys(LOCAL)) Reflect.deleteProperty(view, path.replace('world.', ''));
  const place = copy.places[copy.common.place];
  if (place === undefined) throw new Error('lieu courant sans état');
  for (const villager of Object.values(place.villagers)) {
    const { body } = villager;
    villager.body = {
      x: centi(body.x),
      y: centi(body.y),
      facing: centi(body.facing),
      speed: centi(body.speed),
    };
  }
  view.places = { [copy.common.place]: place };
  return view;
}

function expectSameState(guest: Guest, sim: Sim): WorldState {
  const seen = guest.world();
  if (seen === null) throw new Error('l’invité n’a pas encore d’état complet');
  expect(sharedView(seen)).toEqual(sharedView(sim.world));
  return seen;
}

// Couverture: les champs déclarés par le schéma, et ceux que le scénario remplit.

type Node = Record<string, unknown>;
const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null;

type Segment = { readonly key: string } | 'each';

function unwrap(schema: unknown): Node | null {
  let node = schema;
  while (isNode(node) && isNode(node.wrapped)) node = node.wrapped;
  return isNode(node) ? node : null;
}

const COVERAGE_DEPTH = 3;

/** Les champs des objets à champs fixes, à travers dictionnaires, listes et paires. */
function declaredFields(schema: unknown, path: Segment[], out: Segment[][]): void {
  const node = unwrap(schema);
  if (node === null) return;
  const named = path.filter((segment) => segment !== 'each').length;
  if ((node.type === 'strict_object' || node.type === 'object') && isNode(node.entries)) {
    if (named >= COVERAGE_DEPTH) return;
    for (const [key, sub] of Object.entries(node.entries)) {
      const next = [...path, { key }];
      out.push(next);
      declaredFields(sub, next, out);
    }
  } else if (node.type === 'record') declaredFields(node.value, [...path, 'each'], out);
  else if (node.type === 'array') declaredFields(node.item, [...path, 'each'], out);
  else if ((node.type === 'tuple' || node.type === 'strict_tuple') && Array.isArray(node.items))
    declaredFields(node.items[0], [...path, 'each'], out);
}

function reached(value: unknown, path: readonly Segment[]): unknown[] {
  let values: unknown[] = [value];
  for (const segment of path)
    values = values.flatMap((item) => {
      if (!isNode(item)) return [];
      return segment === 'each' ? Object.values(item) : [item[segment.key]];
    });
  return values;
}

const nameOf = (path: readonly Segment[]): string =>
  `world${path.map((segment) => (segment === 'each' ? '.*' : `.${segment.key}`)).join('')}`;

/** Les champs déclarés que cet état ne remplit nulle part. */
function unfilled(world: WorldState, schema: unknown = WorldSchema): string[] {
  const fields: Segment[][] = [];
  declaredFields(schema, [], fields);
  return fields
    .filter((path) => !(nameOf(path) in LOCAL))
    .filter((path) => reached(world, path).every((value) => value === undefined))
    .map(nameOf);
}

// Scénario.

function fillPlayer(player: PlayerState, index: PlayerIndex): void {
  player.name = index === 0 ? 'Ada la grande' : 'Bob le petit';
  player.look = {
    shape: 'adult-f-medium',
    skin: 2 + index,
    height: 165,
    pieces: [{ slot: SLOTS[0], id: 'corps-essai', colors: [1, 2] }],
  };
  player.gender = index === 0 ? 'f' : 'm';
  player.money = 4321 + index;
  player.toolbar[0] = { item: 'hache-forgee', count: 1, wear: 12 };
  player.bag = { id: 'malle-a-bretelles', slots: [{ item: 'planche', count: 4 }, null] };
  player.selected = 0;
  player.tiers = { hunger: 'low', sleep: 'bonus', hygiene: 'neutral' };
  player.staminaMods = {
    winded: true,
    capacity: { extra: 0.5, until: 99_999 },
    recovery: { factor: 2, until: 99_999 },
  };
  player.gesture = { clip: 'reach', target: 'banc', until: 99_999, long: false };
  player.talk = { villager: 'cheffe-de-gare', dialogue: 'accueil', node: 'question' };
  player.aim = 'banc';
}

/** Une valeur dans chaque champ de l'état (monde figé: seule la forme compte, pas les règles). */
function fillEverything(sim: Sim): void {
  const { world } = sim;
  world.common.day = 3;
  world.common.weather = 'mist';
  world.common.outlook = { weather: 'rain', events: ['marche'] };
  world.common.chest = 123_456;
  world.common.travel = {
    to: 'essai-halte',
    boarded: [true, false],
    loaded: [false, false],
    since: null,
    skip: [false, true],
    arrival: { kind: 'hours', hours: 2 },
  };
  world.common.story = {
    tracked: ['suite-essai', null],
    scene: null,
    queue: ['scene-essai'],
    departure: {
      to: 'essai-halte',
      since: 3,
      ending: null,
      arrival: { kind: 'at', minute: 480 },
    },
    ending: { place: 'essai-gare', id: 'fin-essai', closed: [true, false] },
  };
  fillPlayer(world.players[0], 0);
  fillPlayer(world.players[1], 1);

  const { progress } = world;
  progress.bonds[bondKey('cheffe-de-gare', 0)] = 12;
  progress.bonds[bondKey('cheffe-de-gare', 1)] = 7;
  progress.quests['suite-essai'] = {
    chapter: 'chapitre-1',
    step: 'etape-2',
    done: false,
    passed: ['etape-1'],
  };
  progress.collections.poissons = ['goujon'];
  progress.opened.push('essai-halte');
  progress.prices.pomme = { epicerie: 120 };

  const place = currentPlace(world);
  place.placed.push({ id: 'pose-0', type: 'banc', x: 5, y: 6, rotation: 2 });
  place.nextPlacedId = 1;
  place.objects['meuble-essai'] = {
    gather: { left: 2, refillAt: null },
    sit: [0, null],
    sleep: [null, 1],
    store: [{ item: 'planche', count: 3 }, null],
    open: true,
    harvest: { work: 1, back: null },
    field: { cells: [], work: null },
    shelter: { feed: 3, nest: [], animals: [], nextId: 0, day: 1 },
  };
  place.ground.push({ id: 900, stack: { item: 'planche', count: 2 }, x: 3, y: 4 });
  place.nextGroundId = 901;
  place.groundDay = 3;
  place.shops = { epicerie: { day: 3, spent: 250, sold: { pomme: [1, 2] } } };
  place.insects = { list: [{ id: 0, s: 'papillon', z: 'pre', x: 1, y: 2 }], next: 1, at: 4000 };
  // L'inventaire de la maison: pièces, meubles rangés, meuble tenu.
  place.housing = {
    maison: {
      rooms: {
        cuisine: { state: 'works', stage: 1, delivered: { planche: 2 }, paid: 100, work: 1.5 },
      },
      stock: { banc: 2, lit: 1 },
      held: [null, { prop: null, type: 'banc', x: 1, y: 2, rotation: 1 }],
      decorating: [false, true],
      working: [null, 'cuisine'],
      comfort: 3,
      level: 1,
      sleptDay: 2,
    },
  };
  place.fishing = {
    seed: 5,
    taken: ['12-1'],
    lines: [
      null,
      {
        spot: 'ponton',
        x: 1,
        y: 2,
        stanceX: 1,
        stanceY: 3,
        shadow: '12-0',
        catch: 'goujon',
        seed: 9,
        tick: 10,
        approach: 2,
        help: 1,
        hooked: false,
      },
    ],
  };
  // Véhicule de voie sorti, les deux à bord.
  place.vehicles = {
    draisine: {
      out: true,
      s: 12.5,
      speed: 1.2,
      dir: 1,
      riders: [0, 1],
      brake: false,
      lever: { seat: 0, tick: 5, gain: 1, rhythm: 0.5 },
      stop: null,
      warned: false,
    },
  };
  const villager = Object.values(place.villagers)[0];
  if (villager === undefined) throw new Error('lieu d’essai sans habitant');
  villager.met = [true, false];
  villager.talkingWith = 1;
  villager.life = {
    presence: 'here',
    entry: 0,
    activity: 'balayer',
    pose: 'stand',
    gesture: null,
    seat: null,
    emote: null,
    emoteUntil: 0,
    gaze: 1,
  };
  // Un autre lieu déjà visité: il reste chez l'hôte (voir `LOCAL`).
  const halte = content.places['essai-halte'];
  if (halte === undefined) throw new Error('lieu essai-halte absent');
  world.places['essai-halte'] = createPlaceState(content, halte);
  touchAll(sim);
}

function touchAll(sim: Sim): void {
  for (const slice of ['common', 'players', 'progress', 'place'] as const)
    sim.revisions[slice] += 1;
}

/** Ce que les systèmes écrivent par leurs propres fonctions (les clés de faits sont les leurs). */
function playSystems(sim: Sim): { piece: string; air: string; recipe: string; plan: string } {
  const ctx = contextOf(sim);
  const air = playableAirs(content)[0]?.id;
  const piece = Object.keys(content.pieces).find((id) => !hasPiece(sim.world, id, 1));
  const recipe = Object.values(content.recipes).find((r) => !isKnown(sim.world, r))?.id;
  const plan = Object.values(content.plans).find((p) => !isPlanKnown(sim.world, p))?.id;
  if (air === undefined || piece === undefined || recipe === undefined || plan === undefined)
    throw new Error('contenu d’essai incomplet: air, pièce, recette ou plan absent');
  // Album: une prise avec record, la même par l'autre joueur, un indice, un air appris.
  recordFind(ctx, 0, 'goujon', 9.5);
  recordFind(ctx, 1, 'goujon', 7);
  revealHint(ctx, 'ablette');
  recordFind(ctx, 1, air);
  // Garde-robe du joueur 1, recette, plan, meilleur mot d'un air.
  expect(givePiece(ctx, 1, piece)).toBe(true);
  giveRecipe(ctx, 0, recipe);
  givePlan(ctx, 1, plan);
  expect(remember(ctx, bestKey(air), 3, 'duo')).toBe(true);
  // Agenda des fêtes, commande de la semaine, lettre au guichet.
  expect(remember(ctx, eventDayKey('essai-gare', 'fete-essai'), 5, 'duo')).toBe(true);
  expect(remember(ctx, dueKey('essai-gare'), 6, 'duo')).toBe(true);
  expect(remember(ctx, mailKey('essai-gare', 'lettre-essai'), 1, 'duo')).toBe(true);
  // Coffre commun.
  sim.world.common.chest = 2500;
  ctx.touch('common');
  return { piece, air, recipe, plan };
}

/**
 * Une partie déjà avancée: assez de faits et de meubles posés pour que les changements du scénario
 * restent des différences (une différence plus lourde que la moitié de l'état part en complète).
 */
function advancedSim(): Sim {
  const sim = newSim(content);
  for (let i = 0; i < 300; i++)
    sim.world.progress.memory[`essai-gare.acquis.${String(i)}`] = { v: i, by: 'duo', day: 1 };
  const place = currentPlace(sim.world);
  for (let i = 100; i < 200; i++) {
    place.placed.push({ id: `pose-${String(i)}`, type: 'banc', x: 12.5, y: 23.5, rotation: 1 });
    place.objects[`pose-${String(i)}`] = { sit: [null, null] };
  }
  return sim;
}

const MEASURES: Record<string, unknown> = {};

afterAll(() => {
  process.stdout.write(`état partagé, octets envoyés par l’hôte: ${JSON.stringify(MEASURES)}\n`);
});

describe('album des collections chez l’invité', () => {
  it('une prise de l’hôte paraît au carnet de l’invité, record compris', () => {
    const sim = newSim(content);
    const duo = pair(sim);
    duo.run(20);
    recordFind(contextOf(sim), 0, 'goujon', 9.5);
    duo.run(30);
    const seen = duo.guest.world();
    if (seen === null) throw new Error('invité sans état');
    expect(seen.progress.album).toEqual(sim.world.progress.album);
    expect(seen.progress.album?.f.goujon).toEqual([0, 1, 600, 0, 0, 1, 0, 9.5, 0]);
    const fish = worldSources(content)
      .collections(seen, 1)
      .find((c) => c.family === 'fish');
    expect(fish?.entries.find((e) => e.id === 'goujon')).toMatchObject({ found: true, firstBy: 0 });
  });

  it('le record d’une prise survit à la relecture de la sauvegarde', () => {
    const sim = newSim(content);
    recordFind(contextOf(sim), 0, 'goujon', 9.5);
    const saved: unknown = JSON.parse(JSON.stringify(sim.world));
    const read = readSave({ dataSchema: DATA_SCHEMA, data: saved });
    if (!read.ok) throw new Error(read.reason);
    expect(read.world.progress.album?.f.goujon).toEqual([0, 1, 600, 0, 0, 1, 0, 9.5, 0]);
  });

  it('au pire (tout trouvé, tout indiqué), une prise de plus part en quelques octets', () => {
    const before = newSim(content).world.progress;
    const entries = Object.keys(content.book.entries);
    const find: Find = [1, 999, 1439, 5, 3, 9999, 9999, 123.45, 1];
    before.album = { f: Object.fromEntries(entries.map((id) => [id, find])), h: [...entries] };
    const full = progressParts(null, before, 0, -1, 0, NET_SETTINGS.progress.partBytes);
    for (const part of full)
      expect(byteLength(part)).toBeLessThanOrEqual(BUDGET_BYTES.progressPart);
    const after = cloneProgress(before);
    const first = entries[0];
    if (first === undefined || after.album === undefined) throw new Error('carnet vide');
    after.album.f[first] = [0, 1, 600, 0, 0, 1, 0];
    const delta = progressParts(before, after, 1, 0, 1, NET_SETTINGS.progress.partBytes);
    expect(delta).toHaveLength(1);
    expect(delta[0]?.base).toBe(0);
    expect(byteLength(delta)).toBeLessThan(300);
    MEASURES.albumAuPire = {
      entrees: entries.length,
      album: byteLength(before.album),
      complet: full.reduce((sum, part) => sum + byteLength(part), 0),
      unePrise: byteLength(delta),
    };
  });
});

describe('état partagé: l’invité voit ce que l’hôte possède', () => {
  it('scénario complet: égalité champ pour champ, mises à jour par différences, retraits', () => {
    const sim = advancedSim();
    const duo = pair(sim);
    duo.run(20);
    duo.settle();
    expectSameState(duo.guest, sim);

    // 1. Les systèmes, par leurs fonctions, et le cran d'aide par l'intention de chaque machine.
    duo.freeze(false);
    const sentBefore = duo.sent.length;
    const played = playSystems(sim);
    duo.host.queueLocal({ type: 'set_assist', level: 'nudge' });
    duo.guest.queueIntent({ type: 'set_assist', level: 'big' });
    duo.run(20);
    duo.settle();
    const seen = expectSameState(duo.guest, sim);
    expect(assistLevelOf(seen, 0)).toBe('nudge');
    expect(assistLevelOf(seen, 1)).toBe('big');
    expect(hasPiece(seen, played.piece, 1)).toBe(true);
    expect(hasPiece(seen, played.piece, 0)).toBe(false);
    expect(knownAirs(content, seen)).toContain(played.air);
    expect(bestRating(seen, played.air)).toBe(3);
    const recipe = content.recipes[played.recipe];
    const plan = content.plans[played.plan];
    expect(recipe !== undefined && isKnown(seen, recipe)).toBe(true);
    expect(plan !== undefined && isPlanKnown(seen, plan)).toBe(true);
    expect(seen.progress.album?.h).toEqual(['ablette']);
    expect(seen.common.chest).toBe(2500);
    // Le besoin du jour des boutiques se tire de la graine de la partie: l'invité doit l'avoir.
    expect(seen.seed).toBe(sim.world.seed);
    for (const place of Object.values(content.places))
      for (const shop of Object.values(place.shops))
        expect(dailyNeed({ content, world: seen }, shop), shop.id).toBe(
          dailyNeed({ content, world: sim.world }, shop),
        );
    // Rien de tout cela n'est parti en révision complète.
    const updates = duo.sent.slice(sentBefore);
    expect(updates.filter((m) => m.channel === CHANNEL.progressPart).length).toBeGreaterThan(0);
    expect(updates.filter((m) => m.full)).toEqual([]);
    MEASURES.misesAJourDesSystemes = totals(
      updates.filter((m) => m.channel !== CHANNEL.fast && m.channel !== CHANNEL.events),
    );

    // 2. Une valeur dans chaque champ déclaré.
    fillEverything(sim);
    const valid = v.safeParse(WorldSchema, sim.world);
    expect(valid.issues?.map((issue) => v.getDotPath(issue)) ?? []).toEqual([]);
    // Champ nouveau dans un schéma de `src/etat/`: lui donner une valeur dans `fillEverything`
    // (ou le déclarer dans `LOCAL`, avec la raison pour laquelle l'invité s'en passe).
    expect(unfilled(sim.world), 'champs déclarés que le scénario ne remplit pas').toEqual([]);
    // Le filet lui-même: un champ ajouté demain au monde ou à la progression est signalé.
    const tomorrow = v.strictObject({
      ...WorldSchema.entries,
      nouveau: v.exactOptional(v.number()),
      progress: v.strictObject({
        ...WorldSchema.entries.progress.entries,
        trophees: v.exactOptional(v.array(v.string())),
      }),
    });
    expect(unfilled(sim.world, tomorrow).sort()).toEqual([
      'world.nouveau',
      'world.progress.trophees',
    ]);
    duo.settle();
    expectSameState(duo.guest, sim);

    // 3. Retraits: clés, entrées de liste et champs entiers disparaissent aussi chez l'invité.
    const { world } = sim;
    const place = currentPlace(world);
    Reflect.deleteProperty(world.progress.memory, dueKey('essai-gare'));
    Reflect.deleteProperty(world.progress.bonds, bondKey('cheffe-de-gare', 1));
    Reflect.deleteProperty(world.progress.quests, 'suite-essai');
    if (world.progress.album !== undefined) world.progress.album.h = [];
    world.progress.opened.pop();
    world.common.travel = null;
    Reflect.deleteProperty(world.common, 'outlook');
    world.players[1].bag = null;
    world.players[0].talk = null;
    Reflect.deleteProperty(place, 'vehicles');
    Reflect.deleteProperty(place.objects, 'meuble-essai');
    place.ground.pop();
    place.placed.pop();
    if (place.housing?.maison !== undefined) place.housing.maison.stock = { lit: 1 };
    touchAll(sim);
    duo.settle();
    const after = expectSameState(duo.guest, sim);
    expect(after.places['essai-gare']?.vehicles).toBeUndefined();
    expect(after.progress.memory[dueKey('essai-gare')]).toBeUndefined();
    expect(duo.sent.slice(sentBefore).filter((m) => m.full)).toEqual([]);
    expect(duo.log.entries.filter((e) => e.level === 'error')).toEqual([]);
  });

  it('reconnexion: coupure, invité qui quitte et revient, invité revenu sans signal de reprise', () => {
    const sim = advancedSim();
    const duo = pair(sim);
    duo.run(20);
    playSystems(sim);
    fillEverything(sim);
    duo.settle();
    expectSameState(duo.guest, sim);

    // Coupure de la liaison: ce qui change pendant ce temps est perdu en route.
    const ctx = contextOf(sim);
    duo.link.cut(true);
    recordFind(ctx, 1, 'ablette', 12);
    sim.world.common.chest = 9999;
    sim.world.players[1].money = 5;
    touchAll(sim);
    duo.settle();
    duo.link.cut(false);
    expect(duo.guest.world()?.progress.album?.f.ablette).toBeUndefined();
    duo.host.resume();
    duo.guest.resume();
    duo.settle();
    expectSameState(duo.guest, sim);

    // L'invité quitte le jeu en pleine partie; l'hôte continue, puis l'invité revient à neuf.
    const sentBefore = duo.sent.length;
    duo.rejoin();
    expect(duo.guest.world()).toBeNull();
    revealHint(ctx, 'brochet');
    recordFind(ctx, 0, 'ablette', 14);
    duo.host.resume();
    duo.settle();
    const back = expectSameState(duo.guest, sim);
    expect(back.progress.album?.f.goujon).toEqual(sim.world.progress.album?.f.goujon);
    expect(back.progress.album?.f.ablette).toEqual([1, 3, 600, 3, 0, 1, 1, 14, 0]);
    const fish = worldSources(content)
      .collections(back, 1)
      .find((c) => c.family === 'fish');
    expect(fish?.entries.filter((e) => e.found).map((e) => e.id)).toEqual(
      expect.arrayContaining(['goujon', 'ablette']),
    );
    MEASURES.envoiCompletEtatRempli = totals(
      duo.sent.slice(sentBefore).filter((m) => m.channel !== CHANNEL.fast),
    );

    // Revenu sans que la plateforme ne signale la reprise à l'hôte: le filet de sécurité (30 s)
    // renvoie le lieu et la progression entiers.
    duo.rejoin();
    duo.settle(NET_SETTINGS.place.fullEveryTicks + 200);
    expectSameState(duo.guest, sim);
    expect(duo.log.entries.filter((e) => e.level === 'error')).toEqual([]);
  });
});

describe('coût des envois', () => {
  it('envoi initial mesuré; en régime, aucune révision complète et rien sur la progression sans changement', () => {
    const sim = newSim(content);
    const duo = pair(sim);
    MEASURES.envoiInitialPartieNeuve = totals(duo.sent);
    duo.run(20);
    const idleFrom = duo.sent.length;
    // Dix secondes de jeu réel sans rien faire.
    duo.run(300);
    const idle = duo.sent.slice(idleFrom);
    expect(idle.filter((m) => m.full)).toEqual([]);
    expect(idle.filter((m) => m.channel === CHANNEL.progressPart)).toEqual([]);
    MEASURES.dixSecondesAuRepos = totals(idle);

    // Une prise au carnet: un seul petit message, une différence.
    const findFrom = duo.sent.length;
    recordFind(contextOf(sim), 0, 'goujon', 9.5);
    duo.run(20);
    const find = duo.sent.slice(findFrom).filter((m) => m.channel === CHANNEL.progressPart);
    expect(find).toHaveLength(1);
    expect(find[0]?.full).toBe(false);
    expect(find[0]?.bytes).toBeLessThan(300);
    MEASURES.unePriseAuCarnet = find[0]?.bytes;

    // Partie avancée (300 faits retenus), puis la progression change à chaque pas pendant deux
    // secondes: jamais un envoi par pas, jamais une révision complète (15 pas entre deux envois).
    const ctx = contextOf(sim);
    for (let i = 0; i < 300; i++) remember(ctx, `essai-gare.acquis.${String(i)}`, i, 'duo');
    duo.run(20);
    const busyFrom = duo.sent.length;
    for (let i = 0; i < 60; i++) {
      remember(ctx, `essai-gare.compteur.${String(i)}`, i, 'duo');
      duo.run(1);
    }
    const busy = duo.sent.slice(busyFrom).filter((m) => m.channel === CHANNEL.progressPart);
    expect(busy.length).toBeLessThanOrEqual(5);
    expect(busy.filter((m) => m.full)).toEqual([]);
    MEASURES.soixanteFaitsEnDeuxSecondes = busy.reduce((sum, m) => sum + m.bytes, 0);
    duo.settle();
    expectSameState(duo.guest, sim);
  });
});
