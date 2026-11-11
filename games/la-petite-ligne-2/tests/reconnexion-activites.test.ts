// Coupure de la liaison en pleine activité (mission du 2026-11-11): le joueur revient-il dans un
// état cohérent (activité reprise ou annulée proprement, rien de perdu dans son sac), et l'autre
// n'est-il pas bloqué ? Un test court par activité, sur le banc `aides-coupure.ts` (2 s sans
// l'autre, pause de 20 s, retour). Tableau: `docs/jeux/jeu-1/refonte/reconnexion-activites.md`.
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { GameAction } from '../src/actions';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { createSession } from '../src/session';
import { cookingOf } from '../src/simulation/cuisine/index';
import { botAct, createMinigame, type Minigame } from '../src/simulation/cuisine/minijeu';
import { partOf } from '../src/simulation/cuisine/recettes';
import { jobAt } from '../src/simulation/fabrication/index';
import { stationOf } from '../src/simulation/fabrication/plans';
import { recitalOf } from '../src/simulation/musique/index';
import { botPresses, type Press } from '../src/simulation/musique/local';
import { createDesk, type Desk, type StageSound } from '../src/simulation/musique/poste';
import { SIM_DT, SIM_HZ } from '../src/simulation/noyau/constantes';
import { idleInput, type Intent } from '../src/simulation/noyau/entrees';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { createSim, step, type Sim } from '../src/simulation/noyau/pas';
import { pairPhase } from '../src/simulation/peche/a-deux';
import { createAngler } from '../src/simulation/peche/combat';
import { createLocalFishing } from '../src/simulation/peche/local';
import { HOOKS } from '../src/simulation/quetes/crochets';
import { decisionState, decisionTaken } from '../src/simulation/quetes/decisions';
import { remember } from '../src/simulation/regles/memoire';
import { giveEntry } from '../src/simulation/regles/recompenses';
import { addItem, countItem } from '../src/simulation/sac/inventaire';
import { queueScene } from '../src/simulation/scenes/lecteur';
import { gameContent, MEMBERS, newSim } from './aides';
import { cutBench, type CutBench, type Turn } from './aides-coupure';
import { contentWith, contextOf } from './aides-l3';
import { contentWith as furnishedWith, NORTH, SOUTH } from './aides-noyau';
import { rodInHand } from './aides-peche-a-deux';

type Json = Record<string, unknown>;
const PLACE = 'essai-gare';

function put(sim: Sim, player: PlayerIndex, x: number, y: number, facing = 0): void {
  sim.world.players[player].body = { x, y, facing, speed: 0 };
}

function placeOf(sim: Sim) {
  const state = sim.world.places[sim.world.common.place];
  if (state === undefined) throw new Error('lieu absent');
  return state;
}

function count(events: readonly GameEvent[], type: GameEvent['type']): number {
  return events.filter((e) => e.type === type).length;
}

/** Durée d'une image pour l'interface: nulle en pause (`session.paused()`, `main.ts`). */
function uiDt(bench: CutBench, dt: number): number {
  return bench.paused() ? 0 : dt;
}

/** La page dessine encore pendant la pause (60 images par seconde), sans clavier. */
function pauseFrames(frame: (dt: number) => void, seconds = 20): void {
  for (let i = 0; i < seconds * 60; i++) frame(1 / 60);
}

// --- Pêche ---

const BANK = { x: 6.5, y: 28.2 };
const CAST = { x: BANK.x + 1, y: BANK.y + 3.5 };

/** Une vieille carpe unique de l'étang de la gare d'essai, à la pomme, à deux (canne et épuisette). */
function withOldCarp(files: Record<string, Json>): void {
  files['commun/prises/vieille-carpe.json'] = {
    schema: 1,
    id: 'vieille-carpe',
    kind: 'fish',
    item: 'carpe',
    places: [PLACE],
    hours: { from: 600, to: 720 },
    weathers: [],
    seasons: [],
    rarity: 'rare',
    difficulty: 4,
    fish: {
      force: 0.8,
      nervousness: 0.4,
      rhythm: { pull: 2, rest: 1.2 },
      stamina: 15,
      feints: 1,
      sizeCm: { min: 60, max: 70 },
      shadow: 'huge',
    },
    unique: {
      spot: 'etang',
      when: [{ type: 'remembered', key: 'essai-gare.carpe.affut' }],
      bait: 'pomme',
      crew: 'pair',
      fact: 'essai-gare.carpe.sortie',
      toBag: true,
    },
  };
}

const carpContent = contentWith(withOldCarp);

function pond(carp: boolean): Sim {
  const sim = newSim(carpContent);
  sim.world.common.day = 15;
  sim.world.minutes = 630;
  sim.world.common.weather = 'clear';
  rodInHand(sim, 0, { x: BANK.x, y: BANK.y, facing: SOUTH });
  rodInHand(sim, 1, { x: BANK.x + 2, y: BANK.y, facing: SOUTH });
  if (carp) remember(contextOf(sim), 'essai-gare.carpe.affut', true, 'duo');
  return sim;
}

function lineOf(sim: Sim, player: PlayerIndex) {
  return placeOf(sim).fishing?.lines[player] ?? null;
}

/** Deux joueurs qui se parlent bien: la canne tient pendant les élans, l'épuisette plonge à la remontée. */
function pairPlayer(sim: Sim, angler: PlayerIndex): () => Turn {
  const netter: PlayerIndex = angler === 0 ? 1 : 0;
  let down = false;
  let netAt: number | null = -1;
  return () => {
    const intents: [Intent[], Intent[]] = [[], []];
    const line = lineOf(sim, angler);
    const pair = line?.pair;
    if (line !== null && pair !== undefined) {
      const phase = pairPhase(line, pair, sim.world.tick * SIM_DT);
      const want = pair.tired !== null || phase.kind === 'pull';
      if (want !== down) {
        down = want;
        intents[angler].push({ type: 'fish_hold', down });
      }
      if (phase.kind === 'rise' && pair.down && phase.into > 0.3 && netAt !== pair.tired) {
        netAt = pair.tired;
        intents[netter].push({ type: 'fish_net', lane: phase.side });
      }
    }
    return { host: intents[0], guest: intents[1] };
  };
}

/** La pêche seule d'un joueur, jouée sur sa machine comme le fait l'interface, avec un robot. */
function soloAngler(bench: CutBench, player: PlayerIndex) {
  const game = createLocalFishing(bench.sim.content, player);
  const bot = createAngler(1, 99);
  game.setBait('pomme');
  return {
    game,
    /** Une image de l'interface; `playing`: le joueur a la main (pas en pause). */
    frame(dt: number, playing = true): void {
      const world = player === 0 ? bench.sim.world : bench.guest().world();
      if (world === null) return;
      const phase = game.phase();
      if (playing) {
        if (phase.kind === 'aim' && phase.reach > 0.5) game.press();
        if (phase.kind === 'bite' && phase.plunge) game.press();
        if (phase.kind === 'fight') game.hold(bot(phase.fight));
      }
      for (const intent of game.update(dt, world))
        if (player === 0) bench.host.queueLocal(intent);
        else bench.guest().queueIntent(intent);
    },
  };
}

describe('coupure en pleine pêche', () => {
  for (const angler of [1, 0] as const)
    it(`à deux, canne chez ${angler === 1 ? 'l’invité' : 'l’hôte'}: le combat reprend où il était, la prise vient`, () => {
      const sim = pond(true);
      sim.world.players[angler].toolbar[0] = { item: 'pomme', count: 2 };
      const bench = cutBench(sim);
      const play = pairPlayer(sim, angler);
      const cast: Intent = { type: 'fish_cast', ...CAST, bait: 'pomme' };
      bench.step(angler === 0 ? { host: [cast] } : { guest: [cast] });
      expect(bench.until(() => lineOf(sim, angler)?.pair !== undefined, play)).toBe(true);
      bench.run(45, play);
      const fight = { ...lineOf(sim, angler)?.pair };
      bench.cut();
      // Deux secondes sans l'autre: le poisson est toujours tenu par les deux mêmes joueurs.
      expect(lineOf(sim, angler)?.pair).toMatchObject({
        netter: fight.netter,
        since: fight.since,
        misses: 0,
      });
      bench.back();
      expect(bench.guest().world()?.places[PLACE]?.fishing?.lines[angler]?.pair).toEqual(
        lineOf(sim, angler)?.pair,
      );
      expect(bench.until(() => lineOf(sim, angler) === null, play)).toBe(true);
      for (const events of [bench.hostEvents, bench.guestEvents]) {
        expect(events.find((e) => e.type === 'fish_caught')).toMatchObject({
          player: angler,
          catch: 'vieille-carpe',
          together: true,
        });
        expect(count(events, 'fish_lost')).toBe(0);
      }
      // Un seul appât mangé, la prise au sac du pêcheur.
      expect(countItem(sim.world.players[angler], 'pomme')).toBe(1);
      expect(countItem(sim.world.players[angler], 'carpe')).toBe(1);
      bench.expectSameState();
      expect(bench.errors()).toEqual([]);
    });

  for (const player of [1, 0] as const)
    for (const moment of ['bite', 'fight'] as const)
      it(`seule (${player === 1 ? 'invité' : 'hôte'}), coupure pendant ${moment === 'bite' ? 'la touche' : 'le combat'}: la partie locale s’arrête avec les pas et la prise est validée`, () => {
        const sim = pond(false);
        sim.world.players[player].toolbar[0] = { item: 'pomme', count: 2 };
        const bench = cutBench(sim);
        const angler = soloAngler(bench, player);
        const turn = (): Turn => {
          angler.frame(SIM_DT);
          return {};
        };
        expect(bench.until(() => angler.game.phase().kind === moment, turn, 20)).toBe(true);
        bench.run(10, turn);
        bench.cut(turn);
        pauseFrames((dt) => {
          angler.frame(uiDt(bench, dt), false);
        });
        expect(angler.game.phase().kind).not.toBe('end');
        bench.back();
        expect(bench.until(() => angler.game.phase().kind === 'end', turn, 60)).toBe(true);
        bench.run(5);
        expect(angler.game.phase()).toMatchObject({ outcome: 'landed' });
        expect(bench.hostEvents.find((e) => e.type === 'fish_caught')).toMatchObject({ player });
        expect(count(bench.hostEvents, 'fish_lost')).toBe(0);
        expect(lineOf(sim, player)).toBeNull();
        expect(countItem(sim.world.players[player], 'pomme')).toBe(1);
        bench.expectSameState();
      });

  it('témoin du défaut d’avant: si l’interface court pendant la pause, le poisson est perdu', () => {
    const sim = pond(false);
    const bench = cutBench(sim);
    const angler = soloAngler(bench, 1);
    const turn = (): Turn => {
      angler.frame(SIM_DT);
      return {};
    };
    bench.until(() => angler.game.phase().kind === 'fight', turn, 20);
    bench.cut(turn);
    pauseFrames((dt) => {
      angler.frame(dt, false);
    });
    // Le combat s'est joué seul, sans clavier, sur une horloge que l'hôte n'a pas vue passer.
    expect(angler.game.phase().kind).toBe('end');
    bench.back();
    bench.run(10, turn);
    expect(count(bench.hostEvents, 'fish_lost')).toBe(1);
    expect(count(bench.hostEvents, 'fish_caught')).toBe(0);
  });
});

// --- Cuisine ---

describe('coupure en pleine cuisson', () => {
  it('le mini-jeu de l’invité reprend où il était: plat parfait, ingrédients comptés une fois', () => {
    const sim = newSim(
      contentWith((files) => {
        const objects = files[`lieux/${PLACE}/carte.json`]?.objects as Json[];
        objects.push({ id: 'cuisiniere-1', type: 'cuisiniere', x: 21.5, y: 21.5, rotation: 0 });
      }),
    );
    put(sim, 1, 21.5, 20);
    for (const item of ['carotte', 'poireau', 'pomme-de-terre'])
      addItem(sim.content, sim.world.players[1], item, 1);
    const bench = cutBench(sim);
    const kitchen: { game: Minigame | null } = { game: null };
    bench.onGuestEvent((event) => {
      if (event.type !== 'cook_started' || event.player !== 1) return;
      const recipe = sim.content.recipes[event.recipe];
      const def = recipe === undefined ? null : partOf(recipe, event.part);
      if (def !== null)
        kitchen.game = createMinigame({ steps: def.steps, seed: event.seed, windowScale: 1 });
    });
    const frame = (dt: number, playing = true): void => {
      const { game } = kitchen;
      if (game === null || game.view().finished) return;
      if (playing) botAct(game);
      const grade = game.update(dt);
      if (grade !== null) bench.guest().queueIntent({ type: 'cook_step', grade });
    };
    const turn = (): Turn => {
      frame(SIM_DT);
      return {};
    };
    bench.step({
      guest: [{ type: 'cook_start', target: 'cuisiniere-1', recipe: 'soupe-de-legumes' }],
    });
    bench.run(90, turn);
    expect(cookingOf(sim.world, 1)).not.toBeNull();
    bench.cut(turn);
    pauseFrames((dt) => {
      frame(uiDt(bench, dt), false);
    });
    bench.back();
    expect(bench.until(() => cookingOf(sim.world, 1) === null, turn)).toBe(true);
    expect(bench.guestEvents.find((e) => e.type === 'dish_cooked')).toMatchObject({
      player: 1,
      quality: 3,
      count: 2,
    });
    expect(countItem(sim.world.players[1], 'soupe-de-legumes')).toBe(2);
    expect(countItem(sim.world.players[1], 'carotte')).toBe(0);
    bench.expectSameState();
  });
});

// --- Musique ---

const CANON = 'air-canon-de-la-repetition';

function fakeSound(now: () => number): StageSound {
  let startAt: number | null = null;
  return {
    level: () => undefined,
    start(spec) {
      startAt = spec.startAtMs;
    },
    airNow: () => (startAt === null ? null : now() - startAt),
    note: () => 1,
    sour: () => undefined,
    stop() {
      startAt = null;
    },
  };
}

interface Seat {
  readonly desk: Desk;
  presses: Press[];
}

/** Les deux joueurs au pupitre, chacun avec son poste (`createDesk`) sur l'heure de session. */
function musicBench(): { bench: CutBench; seats: [Seat, Seat]; tick: () => Turn } {
  const content = contentWith((files) => {
    const objects = files[`lieux/${PLACE}/carte.json`]?.objects as Json[];
    objects.push({ id: 'pupitre-1', type: 'pupitre', x: 20, y: 20.9, rotation: 0 });
  });
  const sim = newSim(content);
  put(sim, 0, 18.5, 20);
  put(sim, 1, 21.5, 20);
  for (const player of sim.world.players) {
    player.toolbar[0] = { item: 'cornet', count: 1 };
    player.selected = 0;
  }
  giveEntry(contextOf(sim), 0, CANON);
  const bench = cutBench(sim);
  const seat = (player: PlayerIndex): Seat => ({
    desk: createDesk({
      content,
      world: () => (player === 0 ? sim.world : bench.guest().world()),
      local: () => player,
      send: (intent) => {
        if (player === 0) bench.host.queueLocal(intent);
        else bench.guest().queueIntent(intent);
      },
      sessionNow: () => bench.now(),
      sound: fakeSound(() => bench.now()),
    }),
    presses: [],
  });
  const seats: [Seat, Seat] = [seat(0), seat(1)];
  bench.onHostEvent((event) => {
    seats[0].desk.onEvent(event);
  });
  bench.onGuestEvent((event) => {
    seats[1].desk.onEvent(event);
  });
  const tick = (): Turn => {
    for (const s of seats) {
      s.desk.frame(SIM_DT * 1000);
      const view = s.desk.view();
      if (view.kind !== 'play') continue;
      while ((s.presses[0]?.atMs ?? Infinity) <= view.airMs) {
        const press = s.presses.shift();
        if (press !== undefined) s.desk.press(press.lane, press.atMs);
      }
    }
    return {};
  };
  return { bench, seats, tick };
}

/** Les deux s'installent, l'invité (qui tient le cahier) lance l'air, deux robots parfaits jouent. */
function startDuet(bench: CutBench, seats: [Seat, Seat], tick: () => Turn): void {
  const perform: Intent = { type: 'use_brick', target: 'pupitre-1', brick: 'perform' };
  bench.step({ guest: [perform] });
  bench.run(10, tick);
  bench.step({ host: [perform] });
  bench.run(10, tick);
  seats[1].desk.confirm();
  bench.run(15, tick);
  for (const s of seats) {
    const view = s.desk.view();
    if (view.kind !== 'play') throw new Error(`duo non lancé: ${view.kind}`);
    s.presses = botPresses(view.mine.notes, 'perfect');
  }
}

describe('coupure en plein air de musique', () => {
  for (const kind of ['cut', 'pause'] as const)
    it(`duo au pupitre, ${kind === 'cut' ? 'liaison perdue' : 'pause demandée (Échap)'}: l’air est abandonné sans rien coûter, puis rejoué`, () => {
      const { bench, seats, tick } = musicBench();
      const { sim } = bench;
      startDuet(bench, seats, tick);
      bench.run(8 * SIM_HZ, tick);
      const kept = (): string =>
        JSON.stringify([
          sim.world.players.map((p) => [p.money, p.toolbar, p.bag]),
          sim.world.progress,
        ]);
      const before = kept();
      if (kind === 'cut') bench.cut(tick);
      else bench.pause();
      // Dès la pause, sur chaque machine et sans nouvelles de l'autre: l'accompagnement se tait.
      expect(seats.map((s) => s.desk.view().kind)).toEqual(['closed', 'closed']);
      expect([recitalOf(sim.world, 0), recitalOf(sim.world, 1)]).toEqual([null, null]);
      bench.back();
      bench.run(30, tick);
      for (const events of [bench.hostEvents, bench.guestEvents]) {
        expect(count(events, 'music_closed')).toBe(2);
        expect(count(events, 'music_finished')).toBe(0);
        expect(count(events, 'session_paused')).toBe(1);
      }
      // Ni mot de la fin, ni chapeau, ni amitié, ni accord perdu: sacs, bourses et carnet intacts.
      expect(kept()).toBe(before);
      // On reprend le cahier et l'air va au bout, juste.
      startDuet(bench, seats, tick);
      expect(bench.until(() => count(bench.hostEvents, 'music_finished') > 0, tick, 60)).toBe(true);
      expect(bench.guestEvents.find((e) => e.type === 'music_finished')).toMatchObject({
        air: CANON,
        duo: true,
        rating: 3,
      });
      bench.expectSameState();
      expect(bench.errors()).toEqual([]);
    });
});

// --- Activités dont tout l'état est dans le monde ---

const HOUSE = 'maison-essai';
const SLATE = { id: 'chantier-salle', x: 28.5, y: 6.5 };

function siteContent(): Content {
  return contentWith((files) => {
    files['commun/meubles/ardoise-factice.json'] = {
      schema: 1,
      id: 'ardoise-factice',
      name: 'Ardoise',
      model: 'chalk-board',
      size: { w: 1, h: 1 },
      solid: true,
      placeable: false,
      series: null,
      bricks: [{ brick: 'worksite' }],
    };
    const objects = files[`lieux/${PLACE}/carte.json`]?.objects as Json[];
    objects.push({ ...SLATE, type: 'ardoise-factice', rotation: 0 });
    objects.push({
      id: 'chantier-chambre',
      x: 27.5,
      y: 11.5,
      type: 'ardoise-factice',
      rotation: 0,
    });
    const rooms = files[`lieux/${PLACE}/logements/${HOUSE}.json`]?.rooms as Json[];
    for (const room of rooms) room.site = `chantier-${String(room.id)}`;
  });
}

function housing(sim: Sim) {
  const state = placeOf(sim).housing?.[HOUSE];
  if (state === undefined) throw new Error('logement absent');
  return state;
}

const furnished = furnishedWith(
  [{ id: 'lit-essai', size: { w: 2, h: 2 }, bricks: [{ brick: 'sleep', places: 2, wakeAt: 90 }] }],
  [
    { id: 'banc-sud', type: 'banc', x: 20, y: 25.5 },
    { id: 'lit', type: 'lit-essai', x: 35, y: 26 },
  ],
);

/** Une suite d'une étape: choisir à deux la saison de la fête, chez la cheffe de gare. */
function decisionContent(): Content {
  return contentWith((files) => {
    const option = (id: string): Json => ({
      id,
      text: `Fête en ${id}.`,
      when: [],
      effects: [{ type: 'choose', decision: 'fete', option: id }],
      next: null,
    });
    files[`lieux/${PLACE}/dialogues/decision-factice.json`] = {
      schema: 1,
      id: 'decision-factice',
      villager: 'cheffe-de-gare',
      priority: 50,
      when: [],
      once: null,
      start: 'choix',
      nodes: { choix: { kind: 'choice', options: [option('ete'), option('automne')] } },
    };
    files[`lieux/${PLACE}/quetes/quete-decision.json`] = {
      schema: 1,
      id: 'quete-decision',
      kind: 'side',
      title: 'La saison de la fête',
      giver: 'cheffe-de-gare',
      requires: [],
      chapters: [
        {
          id: 'chapitre-1',
          title: 'Choisir à deux',
          steps: [
            {
              id: 'choisir',
              objective: 'Choisissez à deux la saison de la fête.',
              target: { villager: 'cheffe-de-gare' },
              done: [{ type: 'decision_is', decision: 'fete', state: 'agreed' }],
              decision: { id: 'fete', options: ['ete', 'automne'] },
              together: false,
              onStart: [],
              onDone: [],
            },
          ],
        },
      ],
    };
  });
}

describe('coupure pendant une activité tenue dans l’état du monde', () => {
  it('chantier: le travail de l’invité continue, l’étape se finit', () => {
    const sim = newSim(siteContent());
    put(sim, 1, SLATE.x + 0.2, SLATE.y + 1.1, NORTH);
    const bench = cutBench(sim);
    bench.step({ guest: [{ type: 'housing_work', housing: HOUSE, room: 'salle', on: true }] });
    bench.run(30);
    expect(housing(sim).working[1]).toBe('salle');
    bench.cut();
    bench.back();
    expect(bench.guest().world()?.places[PLACE]?.housing?.[HOUSE]?.working[1]).toBe('salle');
    expect(bench.until(() => housing(sim).rooms.salle?.stage === 1, undefined, 10)).toBe(true);
    bench.expectSameState();
  });

  it('établi: l’ouvrage attend sur le poste, les coups reprennent, le meuble est donné une fois', () => {
    const sim = newSim();
    const station = stationOf(contextOf(sim), 'etabli-de-gare');
    if (station === null) throw new Error('établi absent');
    put(sim, 1, station.x + 0.2, station.y + 1);
    sim.world.players[1].toolbar[0] = { item: 'planche', count: 6 };
    const bench = cutBench(sim);
    const strike: Intent = { type: 'craft_strike', target: 'etabli-de-gare' };
    bench.step({
      guest: [
        { type: 'craft_start', target: 'etabli-de-gare', plan: 'tabouret-campagne', variant: 1 },
      ],
    });
    bench.run(30);
    bench.step({ guest: [strike] });
    bench.run(30);
    expect(jobAt(sim.world, 'etabli-de-gare')).toMatchObject({ by: 1, points: 4 });
    bench.cut();
    bench.back();
    expect(jobAt(sim.world, 'etabli-de-gare')).toMatchObject({ by: 1, points: 4 });
    for (let i = 0; i < 12 && jobAt(sim.world, 'etabli-de-gare') !== null; i++) {
      bench.step({ guest: [strike] });
      bench.run(30);
    }
    expect(count(bench.guestEvents, 'crafted')).toBe(1);
    expect(countItem(sim.world.players[1], 'tabouret-sauge')).toBe(1);
    expect(countItem(sim.world.players[1], 'planche')).toBe(4);
    bench.expectSameState();
  });

  it('geste d’outil: le coup de hache en cours va au bout, l’arbre garde son avancement', () => {
    const sim = newSim();
    sim.world.players[1].toolbar[0] = { item: 'hache', count: 1 };
    sim.world.players[1].selected = 0;
    put(sim, 1, 3.5, 37.6, NORTH);
    const bench = cutBench(sim);
    bench.run(3);
    bench.step({ guest: [{ type: 'act' }] });
    bench.run(5);
    expect(sim.world.players[1].gesture).toMatchObject({ clip: 'chop', target: 'chene' });
    bench.cut();
    const work = placeOf(sim).objects.chene?.harvest?.work;
    expect(work).toBeGreaterThan(0);
    bench.back();
    bench.run(10);
    expect(sim.world.players[1].gesture).toBeNull();
    expect(placeOf(sim).objects.chene?.harvest?.work).toBe(work);
    expect(count(bench.guestEvents, 'gesture_done')).toBe(1);
    bench.expectSameState();
  });

  it('dialogue et boutique: la conversation de l’invité est rendue telle quelle, il la ferme et achète', () => {
    const sim = newSim();
    sim.world.minutes = 600;
    sim.world.players[1].money = 1000;
    put(sim, 1, 20, 16, NORTH);
    const bench = cutBench(sim);
    bench.run(3);
    bench.step({ guest: [{ type: 'act' }] });
    bench.run(5);
    const talk = { ...sim.world.players[1].talk };
    expect(talk).toMatchObject({ villager: 'cheffe-de-gare' });
    bench.cut();
    bench.back();
    expect(bench.guest().world()?.players[1].talk).toEqual(talk);
    bench.step({ guest: [{ type: 'talk_close' }] });
    bench.run(5);
    expect(sim.world.players[1].talk).toBeNull();
    expect(placeOf(sim).villagers['cheffe-de-gare']?.talkingWith).toBeNull();
    put(sim, 1, 20, 17.3, NORTH);
    bench.step({
      guest: [
        { type: 'shop_buy', shop: 'buvette-de-la-gare', item: 'pain', count: 1, chest: false },
      ],
    });
    bench.run(5);
    expect(count(bench.guestEvents, 'shop_bought')).toBe(1);
    expect(countItem(sim.world.players[1], 'pain')).toBe(1);
    bench.expectSameState();
  });

  it('décision à deux en attente: le choix de l’hôte attend l’invité, qui le retrouve et tranche', () => {
    const sim = newSim(decisionContent());
    put(sim, 0, 20, 16, NORTH);
    put(sim, 1, 20, 16, NORTH);
    const bench = cutBench(sim);
    bench.run(3);
    bench.step({ host: [{ type: 'act' }] });
    bench.step({ host: [{ type: 'talk_choose', option: 'ete' }] });
    bench.run(3);
    expect(decisionState(sim.world, 'fete')).toBe('waiting');
    bench.cut();
    bench.back();
    const seen = bench.expectSameState();
    expect(decisionState(seen, 'fete')).toBe('waiting');
    bench.step({ guest: [{ type: 'act' }] });
    bench.step({ guest: [{ type: 'talk_choose', option: 'ete' }] });
    bench.run(20);
    expect(decisionTaken(sim.world, 'fete')).toBe('ete');
    expect(decisionTaken(bench.expectSameState(), 'fete')).toBe('ete');
  });

  it('scène: la réplique lue par l’hôte attend l’invité, puis la scène va au bout', () => {
    const say = (who: string, text: string): Json => ({
      do: 'say',
      who,
      text,
      emote: null,
      sound: null,
      to: 'both',
      seconds: null,
    });
    const content = contentWith((files) => {
      files[`lieux/${PLACE}/scenes/repliques.json`] = {
        schema: 1,
        id: 'repliques',
        title: 'Le réveil',
        together: false,
        roles: { a: 'Sur le banc', b: 'Sur le banc' },
        trigger: null,
        beats: [say('cheffe-de-gare', 'Un.'), say('a', 'Deux.')],
      };
    });
    const sim = newSim(content);
    const bench = cutBench(sim);
    bench.run(6);
    const story = sim.world.common.story;
    if (story !== undefined) {
      story.scene = null;
      story.queue = [];
    }
    expect(queueScene(contextOf(sim), 'repliques', 0, HOOKS)).toBe(true);
    sim.revisions.common += 1;
    bench.run(5);
    bench.step({ host: [{ type: 'scene_next' }] });
    bench.run(5);
    bench.cut();
    expect(sim.world.common.story?.scene).toMatchObject({ beat: 0, read: [true, false] });
    bench.back();
    expect(bench.guest().world()?.common.story?.scene).toMatchObject({ beat: 0 });
    bench.step({ guest: [{ type: 'scene_next' }] });
    bench.run(5);
    expect(sim.world.common.story?.scene).toMatchObject({ beat: 1 });
    bench.step({ host: [{ type: 'scene_next' }], guest: [{ type: 'scene_next' }] });
    bench.run(5);
    expect(sim.world.common.story?.scene ?? null).toBeNull();
    bench.expectSameState();
  });

  it('sommeil à deux: l’invité reste couché, l’hôte le rejoint au retour et la nuit passe', () => {
    const sim = newSim(furnished);
    sim.world.minutes = 15 * 60 + 1;
    put(sim, 0, 34.6, 27.6, NORTH);
    put(sim, 1, 35.4, 27.6, NORTH);
    const bench = cutBench(sim);
    bench.run(3);
    bench.step({ guest: [{ type: 'act' }] });
    bench.run(5);
    expect(placeOf(sim).objects.lit?.sleep).toEqual([null, 1]);
    bench.cut();
    bench.back();
    expect(placeOf(sim).objects.lit?.sleep).toEqual([null, 1]);
    bench.step({ host: [{ type: 'act' }] });
    bench.run(5);
    expect(bench.guestEvents).toContainEqual({ type: 'day_started', day: 2, slept: true });
    bench.expectSameState();
  });

  it('assis: l’invité garde sa place sur le banc, et se lève à la première direction au retour', () => {
    const sim = newSim(furnished);
    put(sim, 1, 20.4, 26.6, NORTH);
    const bench = cutBench(sim);
    bench.run(3);
    bench.step({ guest: [{ type: 'act' }] });
    bench.run(5);
    expect(placeOf(sim).objects['banc-sud']?.sit).toEqual([null, 1]);
    bench.cut();
    bench.back();
    expect(placeOf(sim).objects['banc-sud']?.sit).toEqual([null, 1]);
    bench.run(20, () => ({ guestInput: { moveY: 1 } }));
    expect(placeOf(sim).objects['banc-sud']?.sit).toEqual([null, null]);
    bench.expectSameState();
  });

  it('mode déco: le meuble en main reste en main, même si le signal de reprise de l’invité arrive après l’envoi de l’hôte', () => {
    const sim = newSim();
    const bench = cutBench(sim);
    for (const room of Object.values(housing(sim).rooms)) room.state = 'restored';
    put(sim, 0, 29.5, 11);
    put(sim, 1, 30.5, 11);
    bench.run(3);
    const take: Intent = {
      type: 'deco_take',
      housing: HOUSE,
      prop: 'table-essai',
      x: 30.2,
      y: 7.4,
      rotation: 0,
    };
    bench.step({ guest: [{ type: 'deco_mode', housing: HOUSE, on: true }] });
    bench.step({ guest: [take] });
    bench.run(20);
    expect(housing(sim).held[1]).toMatchObject({ prop: null, type: 'table-essai' });
    expect(housing(sim).stock['table-essai']).toBeUndefined();
    bench.cut();
    bench.back('guest-last');
    // Ce qui change après la reprise arrive bien chez l'invité (différences appliquées).
    bench.step({ guest: [{ type: 'deco_move', housing: HOUSE, x: 29, y: 10, rotation: 1 }] });
    const seen = bench.expectSameState();
    expect(seen.places[PLACE]?.housing?.[HOUSE]?.held[1]).toMatchObject({ x: 29, y: 10 });
    bench.step({ guest: [{ type: 'deco_mode', housing: HOUSE, on: false }] });
    bench.run(5);
    // Rien de perdu: la table retourne à l'inventaire de la maison.
    expect(housing(sim).held).toEqual([null, null]);
    expect(housing(sim).stock['table-essai']).toBe(1);
    bench.expectSameState();
  });

  it('draisine: les deux restent à bord, elle roule sur son élan, on repart puis on descend à l’arrêt', () => {
    const content = contentWith((files) => {
      const settings = files['commun/reglages.json'] as { start: Json };
      settings.start = { ...settings.start, place: 'aubrune', minute: 600 };
    });
    const sim = newSim(content);
    remember(contextOf(sim), 'aubrune.draisine.sortie', true, 'duo');
    put(sim, 0, 219.3, 92.5, 0);
    put(sim, 1, 218.4, 93.4, 0);
    const bench = cutBench(sim);
    bench.run(3);
    bench.step({ host: [{ type: 'act' }] });
    put(sim, 0, 214.9, 98.6, NORTH);
    put(sim, 1, 213.1, 98.6, NORTH);
    bench.run(3);
    bench.step({ host: [{ type: 'act' }], guest: [{ type: 'act' }] });
    bench.run(3);
    const vehicle = () => {
      const state = sim.world.places.aubrune?.vehicles?.draisine;
      if (state === undefined) throw new Error('draisine absente');
      return state;
    };
    expect(vehicle().riders).toEqual([0, 1]);
    let beat = 0;
    const pump = (i: number): Turn => {
      if (i % 14 !== 0) return {};
      beat += 1;
      return beat % 2 === 0 ? { host: [{ type: 'act' }] } : { guest: [{ type: 'act' }] };
    };
    bench.run(4 * SIM_HZ, pump);
    const speed = vehicle().speed;
    expect(speed).toBeGreaterThan(2);
    bench.cut();
    // Pas de partenaire fantôme: l'invité est toujours à bord, la draisine a seulement ralenti.
    expect(vehicle().riders).toEqual([0, 1]);
    expect(vehicle().speed).toBeLessThan(speed);
    bench.back();
    bench.run(3 * SIM_HZ, pump);
    expect(vehicle().speed).toBeGreaterThan(speed);
    bench.run(4 * SIM_HZ, () => ({ hostInput: { run: true } }));
    expect(vehicle().speed).toBe(0);
    bench.run(10, () => ({ guestInput: { moveY: 1 } }));
    expect(vehicle().riders).toEqual([0, null]);
    bench.expectSameState();
    expect(bench.errors()).toEqual([]);
  });
});

// --- L'hôte relancé: la partie repart de la sauvegarde ---

describe('reprise d’une sauvegarde faite en pleine activité', () => {
  it('rend ce que chacun tenait: ligne rangée et appât rendu, meuble de retour à l’inventaire', () => {
    const sim = pond(false);
    // Le joueur 0 pêche, poisson ferré (l'appât est mangé); le joueur 1 décore, une table en main.
    sim.world.players[0].toolbar[0] = { item: 'pomme', count: 2 };
    const run = (player: PlayerIndex, intent: Intent): void => {
      step(sim, [idleInput(0), idleInput(0)], [{ player, intent }]);
    };
    run(0, { type: 'fish_cast', x: BANK.x, y: BANK.y + 3.5, bait: 'pomme' });
    run(0, { type: 'fish_hooked' });
    expect(lineOf(sim, 0)).toMatchObject({ hooked: true, bait: 'pomme' });
    expect(countItem(sim.world.players[0], 'pomme')).toBe(1);
    for (const room of Object.values(housing(sim).rooms)) room.state = 'restored';
    put(sim, 1, 30.5, 11);
    run(1, { type: 'deco_mode', housing: HOUSE, on: true });
    run(1, {
      type: 'deco_take',
      housing: HOUSE,
      prop: 'table-essai',
      x: 30.2,
      y: 7.4,
      rotation: 0,
    });
    expect(housing(sim).held[1]).not.toBeNull();

    const saved = JSON.parse(JSON.stringify(snapshotOf(sim.world, sim.content))) as {
      dataSchema: number;
      data: unknown;
    };
    const restored = restoreWorld(sim.content, saved, MEMBERS);
    if (!restored.ok) throw new Error(restored.reason);
    const again = createSim(sim.content, restored.world);
    expect(lineOf(again, 0)).toBeNull();
    expect(countItem(again.world.players[0], 'pomme')).toBe(2);
    expect(housing(again).held).toEqual([null, null]);
    expect(housing(again).decorating).toEqual([false, false]);
    expect(housing(again).stock['table-essai']).toBe(1);
    // La partie repart: on peut relancer la ligne aussitôt.
    step(
      again,
      [idleInput(0), idleInput(0)],
      [{ player: 0, intent: { type: 'fish_cast', x: BANK.x, y: BANK.y + 3.5 } }],
    );
    expect(lineOf(again, 0)).not.toBeNull();
  });
});

// --- La séance: le signal de pause de la plateforme arrive bien jusqu'à la règle ---

describe('pause de la plateforme vue par la séance', () => {
  it('les deux machines se savent en pause, préviennent leur interface, et repartent', async () => {
    const duo = await startLocalDuo<GameAction>({
      manifest,
      conditions: { latencyMs: 5, jitterMs: 0, spikeProbability: 0 },
      seed: 5,
    });
    const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
    try {
      await duo.start();
      const content = gameContent();
      const host = createSession({ duo: duo.hostGame, content });
      const guest = createSession({ duo: duo.guestGame, content });
      const seen: [string[], string[]] = [[], []];
      host.view.onEvent((event) => seen[0].push(event.type));
      guest.view.onEvent((event) => seen[1].push(event.type));
      for (let i = 1; i <= 30; i++) {
        host.step(idleInput(i));
        guest.step(idleInput(i));
        await wait(1);
      }
      expect([host.paused(), guest.paused()]).toEqual([false, false]);
      duo.guest.pause();
      await wait(40);
      expect([host.paused(), guest.paused()]).toEqual([true, true]);
      expect(seen[0].filter((type) => type === 'session_paused')).toHaveLength(1);
      expect(seen[1].filter((type) => type === 'session_paused')).toHaveLength(1);
      duo.host.resume();
      await wait(40);
      expect([host.paused(), guest.paused()]).toEqual([false, false]);
      for (let i = 31; i <= 50; i++) {
        host.step(idleInput(i));
        guest.step(idleInput(i));
        await wait(1);
      }
      expect(guest.view.world()?.common).toEqual(host.hostSim()?.world.common);
      expect(duo.logs.filter((entry) => entry.level === 'error')).toEqual([]);
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });
});
