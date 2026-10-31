/**
 * Création d'un monde neuf: jour 1, 10 h, le train à quai, les deux
 * personnages sur le quai (encore à créer), la maisonnette en ruine.
 */
import { createRandom } from '@duo/sdk/sim';
import type { GameMap } from '../etat/carte';
import type {
  Character,
  CharacterId,
  ConstructionState,
  Counters,
  PlacedFurniture,
  VillagerState,
  WorldState,
} from '../etat/types';
import type { Content } from '../donnees/types';
import { BAG_SLOTS, DATA_SCHEMA } from './constantes';
import { type Sim, wrapWorld } from './contexte';
import { addToBag, addStack } from './sac';

/** Ce que la plateforme dit d'un joueur: identifiant stable, pseudo, couleur du profil. */
export interface PlayerInfo {
  id: string;
  name: string;
  color: string;
}

export function emptyCounters(): Counters {
  return { duo: {}, p1: {}, p2: {} };
}

function newCharacter(content: Content, map: GameMap, id: CharacterId, player: PlayerInfo, offset: number): Character {
  const spawn = map.points[content.settings.spawn.point] ?? map.house.spawn;
  const pos = { x: spawn.x + offset, y: spawn.y };
  // Première nuit: on part du lit de départ (la paillasse).
  const startBed = map.startFurniture
    .map((f) => content.items[f.item]?.bed?.sleep)
    .find((sleep) => sleep !== undefined);
  const needs = {
    belly: content.settings.needs.belly.simple,
    sleep: startBed ?? content.settings.needs.heart.base,
    heart: content.settings.needs.heart.base,
  };
  return {
    id,
    playerId: player.id,
    name: player.name,
    appearance: { hair: 0, outfit: id === 'p1' ? 0 : 1, scarf: player.color },
    created: false,
    pos,
    prev: { x: pos.x, y: pos.y },
    facing: Math.PI / 2,
    speed: 0,
    inHouse: false,
    action: { kind: 'idle', since: 0, duration: 0, target: null },
    status: 'active',
    menu: null,
    dialogue: null,
    bag: new Array<null>(BAG_SLOTS).fill(null),
    selected: 0,
    water: 0,
    placement: null,
    aim: null,
    destination: null,
    endurance: 0,
    enduranceMax: 0,
    needs,
    form: 'okay',
    envie: null,
    sharedEnvie: null,
    bedId: null,
    breakfastDone: false,
    nightChoice: null,
    hintsShown: [],
    notifications: [],
    supper: { bread: 0, simple: 0, stew: 0 },
    midnightReturn: false,
    lastInputTick: 0,
    needsSet: { belly: null, sleep: null, heart: null },
    heartToday: { envie: false, sharedEnvie: false, ateTogether: false, gesture: false },
    hintQueue: [],
    lastHintTick: -1_000_000,
    stays: {},
    lastMeal: null,
    envieHistory: [],
    crafting: null,
  };
}

/** Crée le monde. `players`: dans l'ordre p1, p2 (en pratique l'hôte puis l'invité). */
export function createWorld(content: Content, map: GameMap, seed: number, players: readonly [PlayerInfo, PlayerInfo]): Sim {
  const s = content.settings;
  const rng = createRandom(seed);
  const characters = [newCharacter(content, map, 'p1', players[0], -0.6), newCharacter(content, map, 'p2', players[1], 0.6)];

  const constructions: ConstructionState[] = content.constructions.map((def) => ({
    id: def.id,
    status: def.requires.length === 0 ? 'ghost' : 'locked',
    elements: def.elements.map((e) => ({ id: e.id, progress: 0, paid: false, done: false, workers: [] })),
  }));

  let nextId = 0;
  const furniture: PlacedFurniture[] = map.startFurniture.map((f) => {
    nextId += 1;
    return { id: `f${nextId}`, item: f.item, cell: { cx: f.cell.cx, cy: f.cell.cy }, rotation: f.rotation, placedBy: null };
  });

  const beamDef = content.constructions.find((c) => c.kind === 'carry');
  const beamFrom = beamDef?.carry ? map.points[beamDef.carry.from] : undefined;

  const villagers: VillagerState[] = content.villagers.map((v) => {
    const start = map.points.offstage ?? { x: -20, y: -20 };
    return {
      id: v.id,
      pos: { x: start.x, y: start.y },
      prev: { x: start.x, y: start.y },
      facing: Math.PI / 2,
      speed: 0,
      visible: false,
      target: 'offstage',
      activity: 'absent',
      talkingWith: [],
      met: false,
    };
  });

  const world: WorldState = {
    schema: DATA_SCHEMA,
    tick: 0,
    revision: 0,
    seed,
    rng: [...rng.getState()],
    phase: 'creation',
    clock: {
      day: s.clock.firstDay.day,
      minutes: s.clock.firstDay.start,
      running: false,
      stoppedBy: 'creation',
      veillee: false,
    },
    weather: s.weatherByDay[s.clock.firstDay.day - 1] ?? 'sunny',
    weatherTomorrow: s.weatherByDay[s.clock.firstDay.day] ?? 'sunny',
    characters,
    garden: map.garden.map((cell, index) => ({
      index,
      cell: { cx: cell.cx, cy: cell.cy },
      soil: 'grass',
      wet: false,
      crop: null,
      lastHarvest: null,
    })),
    trees: map.trees.map((t) => ({ id: t.id, kind: t.kind, pos: { x: t.pos.x, y: t.pos.y }, hits: 0, felled: false, lastHitTick: -1 })),
    beam:
      beamFrom === undefined
        ? null
        : { pos: { x: beamFrom.x, y: beamFrom.y }, prev: { x: beamFrom.x, y: beamFrom.y }, facing: 0, carried: false, holders: [] },
    constructions,
    furniture,
    groundItems: [],
    villagers,
    hens: [],
    feederFilled: false,
    train: { phase: 'stopped', progress: 1, prevProgress: 1 },
    purse: s.economy.startPurse,
    cellar: [],
    crate: [],
    catalogueOrders: [],
    grocerSoldToday: 0,
    proposals: [],
    quests: [],
    letters: [],
    flags: [],
    worldStates: { handcar_shed: 'closed' },
    unlockedRecipes: Object.values(content.recipes)
      .filter((r) => !r.requiresUnlock)
      .map((r) => r.id),
    dialoguesDone: [],
    scene: null,
    counters: emptyCounters(),
    countersAtDawn: emptyCounters(),
    scripts: [],
    nextId,
    orderResult: null,
    ending: null,
    session: { firstDay: s.clock.firstDay.day, togetherMoments: 0, highlights: [] },
  };

  const sim = wrapWorld(content, map, world);
  for (const stack of content.startingInventory.cellar) addStack(world.cellar, stack.item, 'ordinary', stack.count);
  for (const c of characters) {
    for (const stack of content.startingInventory.eachPlayer) addToBag(sim, c, stack.item, 'ordinary', stack.count);
    const can = Object.values(content.items).find((i) => i.capacity !== null);
    c.water = can?.capacity ?? 0;
  }
  return sim;
}
