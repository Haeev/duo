// Fêtes d'Aubrune (cahier 4.7 et 6.3, `ecriture-fetes.md`): les quatre fêtes de saison et la
// veillée du quai, jouées par la simulation (ouverture au calendrier, présence des habitants,
// scènes à deux rôles, répliques en tournante, décision à deux, récompense, retour l'an suivant).
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { startTalk, talkView } from '../src/simulation/dialogues/conversation';
import { calendarOf } from '../src/simulation/monde/calendrier';
import { idleInput, type StepInput } from '../src/simulation/noyau/entrees';
import type { Sim } from '../src/simulation/noyau/pas';
import { remember } from '../src/simulation/regles/memoire';
import { equipBag, giveItem } from '../src/simulation/sac/actions';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { visit } from './aides-visite';
import { newSim } from './aides';

type Json = Record<string, unknown>;

const AUBRUNE = 'aubrune';
const YEAR = 56;
const JOUR = 'aubrune.fete.jour';
const LONG_DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
/** Priorité des répliques de fête: au-dessus du quotidien et des souvenirs, sous toute étape (52 et plus). */
const FEAST_PRIORITY = 45;
const QUESTS = [
  'le-train-de-5h12',
  'la-minute-d-ecart',
  'ceux-qui-partent',
  'les-lettres-en-retard',
  'la-guerre-de-la-soupe',
  'la-baronne',
  'le-fantome-du-moulin',
  'la-fanfare-de-la-halte',
  'la-robe-et-la-cloche',
] as const;
const RESIDENTS = [
  'firmin',
  'odette',
  'basile',
  'achille',
  'solange',
  'mado',
  'ambroise',
  'honorine',
  'marthe',
  'jeanne',
  'lucie',
  'colette',
  'armand',
  'paulin',
  'margot',
  'leon',
  'berthe',
  'barnabe',
  'martial',
] as const;
const EVERYONE = [...RESIDENTS, 'rosalie', 'anatole'];

interface Feast {
  /** Valeur du fait du jour, et suffixe des dialogues `<habitant>-fete-<id>`. */
  readonly id: string;
  readonly event: string;
  readonly season: string;
  /** Jour de jeu de la première année (le 13 de la saison, un samedi). */
  readonly day: number;
  readonly quest: string;
  /** Où la fête se tient, et à combien de mètres de ce point tout le monde se range. */
  readonly point: string;
  readonly within: number;
  readonly opening: string;
  readonly closing: string;
  /** Point et minute de la clôture. */
  readonly closingAt: readonly [string, number];
  /** Objet à remettre (activité existante), à qui, et le dialogue de remerciement. */
  readonly bring: readonly [Record<string, number>, string, string];
  /** Ce qu'un habitant donne sur place pour l'activité (boutiques fermées): qui, dialogue, objet. */
  readonly supply: readonly [string, string, string] | null;
  /** Décision à deux: habitant, dialogue, option retenue, fait écrit. */
  readonly decide: readonly [string, string, string, string];
  /** Cadeau de chaque année (clôture) et objet de la première fois (fin de la suite), par joueur. */
  readonly yearly: string;
  readonly first: string | null;
}

const FEASTS: readonly Feast[] = [
  {
    id: 'barrieres',
    event: 'fete-des-barrieres-fleuries',
    season: 'spring',
    day: 13,
    quest: 'la-fete-des-barrieres-fleuries',
    point: 'pn-s',
    within: 16,
    opening: 'les-lisses-en-fleurs',
    closing: 'la-barriere-se-leve',
    closingAt: ['pn-s', 1025],
    bring: [{ coquelicot: 3 }, 'firmin', 'firmin-bouquet-fleurs#a1'],
    supply: null,
    decide: ['honorine', 'honorine-premier-passage', 'enfants', 'aubrune.barrieres.premier'],
    yearly: 'graines-tomate',
    first: 'omelette',
  },
  {
    id: 'lumignons',
    event: 'nuit-des-lumignons',
    season: 'summer',
    day: 27,
    quest: 'la-nuit-des-lumignons',
    point: 'pv',
    within: 20,
    opening: 'la-cire-et-la-meche',
    closing: 'le-lumignon-de-la-barriere',
    closingAt: ['pn-s', 1240],
    bring: [{ oeuf: 2 }, 'marthe', 'marthe-coquilles-merci#a1'],
    supply: null,
    decide: ['marthe', 'marthe-pour-qui', 'reviennent', 'aubrune.lumignons.pour'],
    yearly: 'pain',
    first: null,
  },
  {
    id: 'soupe',
    event: 'concours-de-la-soupe',
    season: 'autumn',
    day: 41,
    quest: 'le-concours-de-la-soupe',
    point: 'pl',
    within: 12,
    opening: 'les-marmites-de-la-place',
    closing: 'tous-premiers',
    closingAt: ['pl', 1025],
    bring: [{ 'soupe-de-legumes': 1 }, 'honorine', 'honorine-marmite-merci#a1'],
    supply: ['margot', 'margot-panier#a1', 'poireau'],
    decide: ['honorine', 'honorine-louche', 'moulin', 'aubrune.concours.laureate'],
    yearly: 'soupe-aux-herbes',
    first: 'soupe-aux-herbes',
  },
  {
    id: 'premier-train',
    event: 'veillee-du-premier-train',
    season: 'winter',
    day: 55,
    quest: 'la-veillee-d-hiver',
    point: 'quai',
    within: 20,
    opening: 'l-appel-du-registre',
    closing: 'la-lanterne-et-la-cloche',
    closingAt: ['quai', 1145],
    bring: [{ 'pomme-cuite': 2 }, 'colette', 'colette-pommes-merci#a1'],
    supply: ['odette', 'odette-pommes#a1', 'pomme'],
    decide: ['firmin', 'firmin-devise', 'de-la-place', 'aubrune.halte.devise'],
    yearly: 'billet-poinconne',
    first: 'tourte-du-quai',
  },
];

function aubruneContent(): Content {
  return contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Json };
    settings.start = { ...settings.start, place: AUBRUNE, minute: 600 };
  });
}

const content = aubruneContent();

function placeOf(c: Content): NonNullable<Content['places'][string]> {
  const place = c.places[AUBRUNE];
  if (place === undefined) throw new Error(AUBRUNE);
  return place;
}

function finish(sim: Sim, quest: string): void {
  const line = placeOf(sim.content).quests[quest];
  const last = line?.chapters[line.chapters.length - 1];
  sim.world.progress.quests[quest] = {
    chapter: last?.id ?? '',
    step: last?.steps[last.steps.length - 1]?.id ?? '',
    done: true,
    passed: line?.chapters.flatMap((c) => c.steps.map((s) => s.id)) ?? [],
  };
}

function moveTo(sim: Sim, player: PlayerIndex, name: string): void {
  const at = placeOf(sim.content).map.points[name];
  if (at === undefined) throw new Error(`point ${name}`);
  sim.world.players[player].body.x = at.x + (player === 0 ? -0.4 : 0.4);
  sim.world.players[player].body.y = at.y;
}

function both(sim: Sim, name: string): void {
  moveTo(sim, 0, name);
  moveTo(sim, 1, name);
}

function fact(sim: Sim, key: string): unknown {
  return sim.world.progress.memory[key]?.v;
}

/** Aubrune après l'histoire: les vingt sont là, tout est ouvert, les six suites sont finies. */
function aubrune(extra: readonly string[] = []): Sim {
  const sim = newSim(content);
  wait(sim, 0.5);
  for (const quest of QUESTS) finish(sim, quest);
  if (sim.world.common.story) sim.world.common.story.scene = null;
  const facts = ['acte1.fini', 'acte2.train', 'acte2.fini', 'acte3.train2', 'acte3.fini'];
  for (let n = 1; n <= 11; n++) facts.push(`verrou.v${String(n)}`);
  for (const key of [...facts, 'verrou.v2b', 'halte.pendule', 'soupe.fini', ...extra])
    remember(contextOf(sim), `aubrune.${key}`, true, 'duo');
  for (const p of [0, 1] as const) {
    expect(equipBag(contextOf(sim), p, 'besace')).toBe(true);
    sim.world.players[p].needs.hygiene = 100;
    sim.world.players[p].needs.sleep = 60;
  }
  both(sim, 'quai');
  sim.world.minutes = 420;
  wait(sim, 1);
  return sim;
}

/** Le matin d'un jour donné (le bourg range la fête de la veille), puis l'heure dite. */
function dayAt(sim: Sim, day: number, minute: number): void {
  sim.world.common.day = day;
  sim.world.minutes = 370;
  wait(sim, 1);
  sim.world.minutes = minute;
  wait(sim, 2);
}

/** Parle à un habitant et suit le dialogue, en prenant l'option donnée (sinon la première visible). */
function talk(sim: Sim, player: PlayerIndex, villager: string, option?: string): string[] {
  visit(sim, player, villager);
  expect(startTalk(contextOf(sim), player, villager), `parler à ${villager}`).toBe(true);
  const seen: string[] = [];
  for (let i = 0; i < 16; i++) {
    const talkState = sim.world.players[player].talk;
    if (talkState === null) break;
    seen.push(`${talkState.dialogue}#${talkState.node}`);
    wait(sim, 0.25);
    const view = talkView(sim.content, sim.world, player);
    const options = view?.options ?? [];
    if (options.length > 0) {
      const pick = options.find((o) => o.id === option) ?? options[0];
      act(sim, player, { type: 'talk_choose', option: pick?.id ?? '' });
    } else act(sim, player, { type: 'talk_next' });
  }
  if (sim.world.players[player].talk !== null) act(sim, player, { type: 'talk_close' });
  wait(sim, 0.3);
  return seen;
}

function holding(...players: PlayerIndex[]): [StepInput, StepInput] {
  return [
    { ...idleInput(0), act: players.includes(0) },
    { ...idleInput(0), act: players.includes(1) },
  ];
}

/** Joue la scène en cours: ceux qui tiennent d'abord, puis l'appui de l'autre; chacun lit ses répliques. */
function playScene(sim: Sim, id: string): void {
  expect(sim.world.common.story?.scene?.id, `scène ${id}`).toBe(id);
  const def = placeOf(sim.content).scenes[id];
  for (let i = 0; i < 400 && sim.world.common.story?.scene?.id === id; i++) {
    const run = sim.world.common.story.scene;
    const beat = def?.beats[run.beat];
    if (beat?.do === 'await') {
      const holders: PlayerIndex[] = [];
      const pressers: PlayerIndex[] = [];
      let seconds = 0;
      for (const part of beat.parts) {
        const who: PlayerIndex = part.role === 'b' ? (run.roleA === 0 ? 1 : 0) : run.roleA;
        if (part.gesture?.type === 'press') pressers.push(who);
        else if (part.gesture?.type === 'hold') {
          holders.push(who);
          seconds = Math.max(seconds, part.gesture.seconds);
        }
      }
      wait(sim, 0.2);
      if (holders.length > 0) wait(sim, seconds + 0.3, holding(...holders));
      wait(sim, 0.15, holding(...holders, ...pressers));
      wait(sim, 0.15, holding(...holders));
    }
    for (const p of [0, 1] as const) act(sim, p, { type: 'scene_next' });
    wait(sim, 0.25);
  }
  expect(sim.world.common.story?.scene?.id ?? null, `fin de ${id}`).not.toBe(id);
  wait(sim, 0.5);
}

/** Vide les poches d'un joueur, puis lui donne ces objets (ce qu'il aurait cueilli, pondu ou cuisiné). */
function carry(sim: Sim, player: PlayerIndex, items: Record<string, number>): void {
  const state = sim.world.players[player];
  state.toolbar.fill(null);
  state.bag?.slots.fill(null);
  for (const [item, count] of Object.entries(items))
    expect(giveItem(contextOf(sim), player, item, count), item).toBe(count);
}

function count(sim: Sim, player: PlayerIndex, item: string): number {
  const state = sim.world.players[player];
  let total = 0;
  for (const slot of [...state.toolbar, ...(state.bag?.slots ?? [])])
    if (slot?.item === item) total += slot.count;
  return total;
}

function present(sim: Sim, villager: string): boolean {
  return sim.world.places[AUBRUNE]?.villagers[villager]?.life?.presence !== 'away';
}

/** Distance d'un habitant à un point de la carte (m). */
function distance(sim: Sim, villager: string, point: string): number {
  const body = sim.world.places[AUBRUNE]?.villagers[villager]?.body;
  const at = placeOf(sim.content).map.points[point];
  if (body === undefined || at === undefined) throw new Error(`${villager}, ${point}`);
  return Math.hypot(body.x - at.x, body.y - at.y);
}

/**
 * Ce que ce dialogue fait entendre en `wanted` conversations, les deux joueurs à tour de rôle. Ce
 * qu'un habitant avait de plus pressé à dire une fois à chacun (première rencontre, cadeau) passe
 * d'abord, comme en jeu.
 */
function hears(sim: Sim, villager: string, dialogue: string, wanted: number): string[] {
  const heard: string[] = [];
  for (let i = 0; i < 12 && heard.length < wanted; i++) {
    const seen = talk(sim, i % 2 === 0 ? 0 : 1, villager);
    const node = seen.find((s) => s.startsWith(`${dialogue}#`));
    if (node !== undefined) heard.push(node);
  }
  return heard;
}

/** Les trois répliques de la tournante. */
function threeLines(sim: Sim, villager: string, dialogue: string): void {
  expect(new Set(hears(sim, villager, dialogue, 3)), villager).toEqual(
    new Set([`${dialogue}#l1`, `${dialogue}#l2`, `${dialogue}#l3`]),
  );
}

function linesOf(id: string): string[] {
  const dialogue = placeOf(content).dialogues.find((d) => d.id === id);
  if (dialogue === undefined) throw new Error(`dialogue ${id}`);
  return Object.values(dialogue.nodes).flatMap((n) => (n.kind === 'line' ? [n.text] : []));
}

describe('fêtes d’Aubrune', () => {
  it('quatre fêtes au calendrier, un samedi 13 par saison, annoncées la veille, ouvertes par l’histoire', () => {
    const events = content.time.events[AUBRUNE] ?? [];
    const seasons: string[] = [];
    for (const feast of FEASTS) {
      const event = events.find((e) => e.id === feast.event);
      expect(event?.when, feast.event).toEqual({ type: 'date', season: feast.season, day: 13 });
      expect(event?.hours.from, feast.event).toBe(600);
      expect(event?.announce, feast.event).toBe(true);
      expect(JSON.stringify(event?.conditions)).toContain('aubrune.acte3.fini');
      expect(event?.activates.facts).toEqual([{ key: JOUR, value: feast.id }]);
      for (const year of [0, 1]) {
        const date = calendarOf(content, feast.day + year * YEAR);
        expect([date.season, date.dayOfSeason, date.weekday], feast.event).toEqual([
          feast.season,
          13,
          'saturday',
        ]);
      }
      seasons.push(feast.season);
      // Lieu réel du plan, suite de fête ouverte par le seul fait du jour.
      expect(placeOf(content).map.points[feast.point], feast.point).toBeDefined();
      expect(placeOf(content).quests[feast.quest]?.requires).toEqual([
        { type: 'remembered', key: JOUR, equals: feast.id },
      ]);
    }
    expect(new Set(seasons).size).toBe(4);
    // La veillée du quai: l'autre samedi de chaque saison (le 6), jamais un jour de fête.
    const vigils = events.filter((e) => e.id.startsWith('veillee-du-quai-'));
    expect(vigils.map((e) => e.when)).toEqual(
      ['autumn', 'summer', 'winter', 'spring'].map((season) => ({ type: 'date', season, day: 6 })),
    );
    expect(calendarOf(content, 6).weekday).toBe('saturday');
    // Rien de l'histoire ni des six suites ne cite une fête: elles ne bloquent rien.
    for (const quest of QUESTS)
      expect(JSON.stringify(placeOf(content).quests[quest]).includes('aubrune.fete.'), quest).toBe(
        false,
      );
  });

  it('chacun des 21 habitants a trois répliques par fête et pour la veillée, dont une sur ta moitié', () => {
    const dialogues = placeOf(content).dialogues;
    const pages: string[] = [];
    let total = 0;
    for (const villager of EVERYONE)
      for (const suffix of [...FEASTS.map((f) => `fete-${f.id}`), 'veillee-du-quai']) {
        const id = `${villager}-${suffix}`;
        const dialogue = dialogues.find((d) => d.id === id);
        expect(dialogue?.villager, id).toBe(villager);
        expect(dialogue?.priority, id).toBe(FEAST_PRIORITY);
        expect(dialogue?.once, id).toBeNull();
        const lines = linesOf(id);
        expect(lines.length, id).toBeGreaterThanOrEqual(3);
        expect(new Set(lines).size, id).toBe(lines.length);
        expect(lines.filter((t) => /ta moitié/i.test(t)).length, id).toBeGreaterThanOrEqual(1);
        pages.push(...lines);
        total += lines.length;
      }
    expect(total).toBeGreaterThanOrEqual(21 * 5 * 3);
    // La nuit des lumignons: une réplique de plus, « pour qui », pour qui pose une lumière.
    for (const villager of [...RESIDENTS, 'rosalie'])
      expect(linesOf(`${villager}-fete-lumignons`), villager).toHaveLength(4);
    for (const scene of Object.values(placeOf(content).scenes))
      for (const beat of scene.beats) if (beat.do === 'say') pages.push(beat.text);
    expect(pages.filter((t) => t.length > 150)).toEqual([]);
    expect(pages.filter((t) => LONG_DASHES.test(t))).toEqual([]);
    // Sous l'histoire et les suites: leurs étapes commencent à 52, celles de l'histoire à 60.
    const feast = dialogues.filter((d) => JSON.stringify(d.when).includes(JOUR));
    expect(feast.length).toBeGreaterThanOrEqual(21 * 5);
    expect(feast.filter((d) => d.priority >= 60).map((d) => d.id)).toEqual([]);
  });

  for (const feast of FEASTS)
    it(`« ${feast.event} »: ouverture, habitants, scènes à deux, activité, décision, récompense`, () => {
      const sim = aubrune(['veillee.premiere']);
      const Q = feast.quest;
      dayAt(sim, feast.day, 595);
      expect(fact(sim, JOUR)).toBe('aucune');
      expect(sim.world.progress.quests[Q]).toBeUndefined();
      sim.world.minutes = 600;
      wait(sim, 2);
      expect(fact(sim, JOUR)).toBe(feast.id);
      expect(sim.world.progress.quests[Q]?.done).toBe(false);

      // Tout le bourg s'y rend à pied, et le train du samedi amène Rosalie, qui reste.
      wait(sim, 170);
      for (const villager of [...RESIDENTS, 'rosalie']) {
        expect(present(sim, villager), villager).toBe(true);
        expect(distance(sim, villager, feast.point), villager).toBeLessThan(feast.within);
      }

      // Ouverture à deux rôles, puis l'activité et la décision à deux, à mener en parallèle.
      both(sim, feast.point);
      wait(sim, 1);
      playScene(sim, feast.opening);
      expect(sim.world.progress.quests[Q]?.passed).toContain('ouverture');
      const [items, receiver, thanks] = feast.bring;
      if (feast.supply !== null) {
        // Boutiques fermées un jour de fête: ce qu'il faut cuisiner se donne sur place.
        const [giver, gift, item] = feast.supply;
        carry(sim, 0, {});
        expect(hears(sim, giver, gift.split('#')[0] ?? '', 1)).toEqual([gift]);
        expect(count(sim, 0, item) + count(sim, 1, item), item).toBeGreaterThanOrEqual(1);
      }
      carry(sim, 0, items);
      expect(talk(sim, 0, receiver)[0]).toBe(thanks);
      for (const item of Object.keys(items)) expect(count(sim, 0, item), item).toBe(0);
      const [judge, decision, option, key] = feast.decide;
      expect(talk(sim, 1, judge, 'attendre')).toContain(`${decision}#attendre-1`);
      expect(talk(sim, 1, judge, option)).toContain(`${decision}#une-voix`);
      expect(fact(sim, key)).toBeUndefined();
      expect(talk(sim, 0, judge, option)).toEqual(
        expect.arrayContaining([`${decision}#autre`, `${decision}#fin`]),
      );
      expect(fact(sim, key)).toBe(option);
      expect(sim.world.progress.quests[Q]?.passed).toHaveLength(3);

      // Les étapes passées, on entend les trois répliques de fête en tournante. Un quart du
      // bourg par fête (toutes les fiches sont contrôlées plus haut): chacun est entendu une fois.
      const guests = [...RESIDENTS, 'rosalie'].filter((_, i) => i % 4 === FEASTS.indexOf(feast));
      expect(guests).toHaveLength(5);
      for (const villager of guests) {
        sim.world.minutes = 720;
        threeLines(sim, villager, `${villager}-fete-${feast.id}`);
      }
      // Le train du samedi repart à 14 h 40; Rosalie, elle, reste jusqu'à la fin de la fête.
      sim.world.minutes = 882;
      wait(sim, 3);
      expect(fact(sim, 'aubrune.train.en-gare')).toBe(false);
      expect(present(sim, 'rosalie')).toBe(true);

      // Clôture à deux rôles: le cadeau de l'année, et la récompense de la première fois.
      const [closingPoint, closingMinute] = feast.closingAt;
      sim.world.minutes = closingMinute;
      for (const p of [0, 1] as const) carry(sim, p, {});
      wait(sim, feast.id === 'lumignons' ? 170 : 1);
      if (feast.id === 'lumignons') {
        // La nuit, une lumière par seuil: Firmin à la barrière, Martial au cimetière, Berthe au ponton.
        expect(distance(sim, 'firmin', 'firmin-barriere')).toBeLessThan(3);
        expect(distance(sim, 'martial', 'ci')).toBeLessThan(3);
        expect(distance(sim, 'berthe', 'ponton')).toBeLessThan(3);
        expect(talk(sim, 0, 'firmin')[0]).toBe('firmin-fete-lumignons#nuit');
      }
      both(sim, closingPoint);
      wait(sim, 1);
      playScene(sim, feast.closing);
      expect(sim.world.progress.quests[Q]?.done).toBe(true);
      for (const p of [0, 1] as const) {
        expect(count(sim, p, feast.yearly), feast.yearly).toBeGreaterThanOrEqual(1);
        if (feast.first !== null)
          expect(count(sim, p, feast.first), feast.first).toBeGreaterThanOrEqual(1);
      }
      if (feast.id === 'barrieres')
        expect(fact(sim, 'cuisine.recette.omelette-aux-herbes')).toBeDefined();

      // À 5 h 12, la même nuit de jeu, le Contrôleur passe après la fête.
      remember(contextOf(sim), 'aubrune.depart.fait', true, 'duo');
      sim.world.minutes = 314;
      both(sim, 'quai');
      wait(sim, 3);
      expect(present(sim, 'anatole')).toBe(true);
      expect(hears(sim, 'anatole', `anatole-fete-${feast.id}`, 1)).toHaveLength(1);

      // Le lendemain, le bourg a rangé; l'an suivant, la fête revient avec ses scènes et son cadeau.
      dayAt(sim, feast.day + 1, 660);
      expect(fact(sim, JOUR)).toBe('aucune');
      expect(talk(sim, 0, 'basile')[0]).not.toContain('-fete-');
      dayAt(sim, feast.day + YEAR, 660);
      expect(fact(sim, JOUR)).toBe(feast.id);
      both(sim, feast.point);
      wait(sim, 1);
      playScene(sim, feast.opening);
      for (const p of [0, 1] as const) carry(sim, p, {});
      sim.world.minutes = closingMinute;
      both(sim, closingPoint);
      wait(sim, 1);
      playScene(sim, feast.closing);
      expect(count(sim, 0, feast.yearly) + count(sim, 1, feast.yearly)).toBeGreaterThanOrEqual(2);
    });

  it('une fête manquée ne bloque rien: sa suite attend l’an suivant, le concours attend sa suite', () => {
    const sim = aubrune(['veillee.premiere']);
    const feast = FEASTS[0];
    if (feast === undefined) throw new Error('fête');
    dayAt(sim, feast.day, 640);
    both(sim, feast.point);
    wait(sim, 1);
    playScene(sim, feast.opening);
    // Les joueurs s'en vont: ni fleurs, ni décision, ni clôture.
    both(sim, 'fc');
    dayAt(sim, feast.day + 1, 660);
    expect(fact(sim, JOUR)).toBe('aucune');
    expect(fact(sim, 'aubrune.barrieres.lisses')).toBe('levees');
    expect(sim.world.progress.quests[feast.quest]?.done).toBe(false);
    carry(sim, 0, { coquelicot: 3 });
    expect(talk(sim, 0, 'firmin')[0]).not.toContain('bouquet');
    expect(count(sim, 0, 'coquelicot')).toBe(3);
    // L'an suivant, faute de fleurs, des radis: la suite reprend où elle en était.
    dayAt(sim, feast.day + YEAR, 640);
    carry(sim, 0, { radis: 3 });
    expect(talk(sim, 0, 'firmin')[0]).toBe('firmin-bouquet-radis#a1');
    expect(fact(sim, 'aubrune.barrieres.garniture')).toBe('radis');
    // Sans la guerre de la soupe finie, pas de concours: le fait du jour reste vide.
    const bare = aubrune(['veillee.premiere']);
    delete bare.world.progress.memory['aubrune.soupe.fini'];
    dayAt(bare, 41, 640);
    expect(fact(bare, JOUR)).toBe('aucune');
  });

  it('la veillée du quai: la première attend les gardes après l’acte 3, puis revient le samedi', () => {
    const sim = aubrune();
    // Un mercredi, le lendemain du dénouement: Firmin invite, le quai se remplit à 18 h 30.
    dayAt(sim, 17, 1000);
    expect(talk(sim, 0, 'firmin')[0]).toBe('firmin-ce-soir#a1');
    sim.world.minutes = 1111;
    wait(sim, 2);
    expect(fact(sim, JOUR)).toBe('premiere-veillee');
    wait(sim, 170);
    for (const villager of RESIDENTS)
      expect(distance(sim, villager, 'quai'), villager).toBeLessThan(20);
    // Les joueurs n'y vont pas: elle les attend le lendemain soir.
    dayAt(sim, 18, 1111);
    expect(fact(sim, JOUR)).toBe('premiere-veillee');
    both(sim, 'quai');
    wait(sim, 1);
    playScene(sim, 'la-veillee-du-quai');
    expect(fact(sim, 'aubrune.veillee.premiere')).toBe(true);
    for (const p of [0, 1] as const) {
      expect(count(sim, p, 'soupe-de-legumes')).toBe(1);
      expect(count(sim, p, 'tarte-aux-pommes')).toBe(1);
    }
    for (const villager of RESIDENTS.filter((_, i) => i % 3 === 0)) {
      sim.world.minutes = 1180;
      threeLines(sim, villager, `${villager}-veillee-du-quai`);
    }
    remember(contextOf(sim), 'aubrune.depart.fait', true, 'duo');
    sim.world.minutes = 314;
    wait(sim, 3);
    expect(hears(sim, 'anatole', 'anatole-veillee-du-quai', 1)).toHaveLength(1);
    // Le soir suivant, plus de première; le samedi (jour 20), la veillée régulière et son bol.
    dayAt(sim, 19, 1111);
    expect(fact(sim, JOUR)).toBe('aucune');
    dayAt(sim, 20, 700);
    expect(hears(sim, 'rosalie', 'rosalie-veillee-du-quai', 1)).toHaveLength(1);
    for (const p of [0, 1] as const) carry(sim, p, {});
    sim.world.minutes = 1111;
    both(sim, 'quai');
    wait(sim, 2);
    expect(fact(sim, JOUR)).toBe('veillee');
    playScene(sim, 'le-banc-du-samedi');
    expect(count(sim, 0, 'soupe-de-legumes') + count(sim, 1, 'soupe-de-legumes')).toBe(2);
    // Un samedi de fête (jour 27, la Nuit des lumignons), la veillée laisse la place.
    dayAt(sim, 27, 660);
    sim.world.minutes = 1111;
    wait(sim, 2);
    expect(fact(sim, JOUR)).toBe('lumignons');
  });
});
