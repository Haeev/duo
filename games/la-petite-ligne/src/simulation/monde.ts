/**
 * Création d'un monde neuf: jour 1, 10 h, le train à quai, les deux
 * personnages sur le quai (encore à créer), la maisonnette en ruine.
 */
import { emptyBreeding } from '../etat/elevage';
import { createRandom } from '@duo/sdk/sim';
import { type GameMap, buildingAt, offstagePoint } from '../etat/carte';
import { starterWardrobe, starterWear } from '../etat/garde-robe';
import type {
  Appearance,
  Character,
  CharacterId,
  ConstructionState,
  Counters,
  Needs,
  PlacedFurniture,
  VillagerState,
  WorldState,
} from '../etat/types';
import type { Content } from '../donnees/types';
import { BAG_SLOTS, DATA_SCHEMA } from './constantes';
import { emptyFishing } from '../etat/peche';
import { type Sim, wrapWorld } from './contexte';
import { ITEM, OLD_TOOL_RACK_CELL, SPAWN_POINTS, TOOL_RACK } from './ids';
import { emptyMemories } from './souvenirs';
import { emptyOrderBook } from './semaine';
import { addToBag, addStack } from './sac';
import { emptyBoard } from './annonces';
import { emptyImprovements } from './chantiers';
import { emptyVillageFields } from '../etat/types-voisins';

/** Ce que la plateforme dit d'un joueur: identifiant stable, pseudo, couleur du profil. */
export interface PlayerInfo {
  id: string;
  name: string;
  color: string;
}

/**
 * Couleur des cheveux d'avant le tour 10, celle des portraits (`PLAYER_BODIES` de l'interface):
 * p1 brun (1), p2 noir (0), dans l'ordre de la section 2.2.
 */
const DEFAULT_HAIR_COLOR: Readonly<Record<CharacterId, number>> = { p1: 1, p2: 0 };

/** Besoins du tour 10 (section 3) au repos: rien de compté aujourd'hui, personne loin de l'autre. */
function tour10Needs(): Pick<Needs, 'apartMinutes' | 'reunionsToday' | 'nappedToday' | 'napStart' | 'curtainsMorningDone' | 'missingShown'> {
  return { apartMinutes: 0, reunionsToday: 0, nappedToday: false, napStart: null, curtainsMorningDone: false, missingShown: false };
}

/**
 * 0.12.2 (R15): à la reprise, le râtelier quitte sa place d'avant (mur sud, devant la fenêtre) pour
 * le mur ouest. Sans changer le format: seule sa case et sa rotation changent.
 */
export function moveToolRack(world: WorldState): void {
  for (const f of world.furniture) {
    if (f.item === TOOL_RACK.item && f.cell.cx === OLD_TOOL_RACK_CELL.cx && f.cell.cy === OLD_TOOL_RACK_CELL.cy) {
      f.cell = { cx: TOOL_RACK.cell.cx, cy: TOOL_RACK.cell.cy };
      f.rotation = TOOL_RACK.rotation;
    }
  }
}

/** Le râtelier posé à sa place fixe (`ids.ts`, `TOOL_RACK`). */
function rackFurniture(): PlacedFurniture {
  const r = TOOL_RACK;
  return { id: r.id, item: r.item, cell: { cx: r.cell.cx, cy: r.cell.cy }, rotation: r.rotation, placedBy: null };
}

/** Un habitant hors de la carte, avant sa première entrée d'emploi du temps. */
export function newVillagerState(map: GameMap, id: string): VillagerState {
  const start = map.points.offstage ?? offstagePoint(map);
  return {
    id,
    pos: { x: start.x, y: start.y },
    prev: { x: start.x, y: start.y },
    facing: Math.PI / 2,
    speed: 0,
    visible: false,
    target: 'offstage',
    activity: 'absent',
    talkingWith: [],
    met: false,
    inside: null,
  };
}

export function emptyCounters(): Counters {
  return { duo: {}, p1: {}, p2: {} };
}

function newCharacter(content: Content, map: GameMap, id: CharacterId, player: PlayerInfo, offset: number): Character {
  const own = map.points[SPAWN_POINTS[id]];
  const spawn = map.points[content.settings.spawn.point] ?? map.house.spawn;
  const pos = own === undefined ? { x: spawn.x + offset, y: spawn.y } : { x: own.x, y: own.y };
  // Première nuit: on part du lit de départ (la paillasse).
  const startBed = map.startFurniture
    .map((f) => content.items[f.item]?.bed?.sleep)
    .find((sleep) => sleep !== undefined);
  const needs: Needs = {
    belly: content.settings.needs.belly.simple,
    sleep: startBed ?? content.settings.needs.heart.base,
    heart: content.settings.needs.heart.base,
    ...tour10Needs(),
  };
  // 0.12: avant la création, la tenue de départ d'avant (p1 la première, p2 la deuxième).
  const wear = starterWear(content.clothes, id === 'p1' ? 0 : 1);
  return {
    id,
    playerId: player.id,
    name: player.name,
    appearance: { hair: 0, hairColor: DEFAULT_HAIR_COLOR[id], beard: 0, wear, scarf: player.color },
    wardrobe: starterWardrobe(wear),
    created: false,
    titleReady: false,
    endReady: false,
    pos,
    prev: { x: pos.x, y: pos.y },
    facing: Math.PI / 2,
    speed: 0,
    inside: buildingAt(map, {}, pos.x, pos.y),
    hairChangedDay: null,
    hairNoticedBy: null,
    hairOffer: null,
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
    absent: false,
    needsSet: { belly: null, sleep: null, heart: null },
    heartToday: { envie: false, sharedEnvie: false, ateTogether: false, gesture: false },
    hintQueue: [],
    lastHintTick: -1_000_000,
    stays: {},
    lastMeal: null,
    envieHistory: [],
    crafting: null,
    pin: null,
    seat: null,
    fishing: null,
    momentHint: null,
    holding: null,
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
  // Le râtelier, à sa place fixe (identifiant hors de `nextId`: les autres meubles gardent les leurs).
  if (content.items[TOOL_RACK.item] !== undefined) furniture.push(rackFurniture());

  const beamDef = content.constructions.find((c) => c.kind === 'carry');
  const beamFrom = beamDef?.carry ? map.points[beamDef.carry.from] : undefined;

  const villagers: VillagerState[] = content.villagers.map((v) => newVillagerState(map, v.id));

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
    weatherLog: [],
    morningMist: false,
    stages: { passed: [], current: null, choice: { p1: null, p2: null } },
    characters,
    garden: map.garden.map((cell, index) => ({
      index,
      cell: { cx: cell.cx, cy: cell.cy },
      soil: 'grass',
      wet: false,
      crop: null,
      lastHarvest: null,
    })),
    trees: map.trees.map((t) => ({ id: t.id, kind: t.kind, pos: { x: t.pos.x, y: t.pos.y }, hits: 0, felled: false, felledDay: null, lastHitTick: -1 })),
    beam:
      beamFrom === undefined
        ? null
        : {
            item: beamDef?.carry?.item ?? 'beam',
            purpose: 'construction',
            construction: beamDef?.id ?? null,
            contents: null,
            to: { ...(map.points[beamDef?.point ?? ''] ?? beamFrom) },
            route: null,
            leg: 0,
            pos: { x: beamFrom.x, y: beamFrom.y },
            prev: { x: beamFrom.x, y: beamFrom.y },
            facing: 0,
            carried: false,
            holders: [],
          },
    constructions,
    furniture,
    decor: [],
    groundItems: [],
    villagers,
    hens: [],
    feederFilled: false,
    breeding: emptyBreeding(),
    train: { phase: 'stopped', progress: 1, prevProgress: 1 },
    purse: s.economy.startPurse,
    cellar: [],
    crate: [],
    catalogueOrders: [],
    catalogueOrderBy: [],
    heavyDeliveries: [],
    handcarAt: null,
    grocerSoldToday: 0,
    grocerSupply: {},
    ardoise: null,
    goodsSeen: [],
    market: null,
    mail: null,
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
    countersToday: emptyCounters(),
    scripts: [],
    nextId,
    heard: { p1: {}, p2: {} },
    heardOld: { key: '', p1: '', p2: '' },
    orderIndex: 0,
    orderResult: null,
    orderHistory: [],
    orderTotals: { orders: 0, linesDone: 0, linesTotal: 0, amount: 0 },
    order: emptyOrderBook({ content }),
    letterVariants: {},
    content: { firstDayWith: {} },
    ending: null,
    session: { firstDay: s.clock.firstDay.day, togetherMoments: 0, highlights: [] },
    moments: { today: null, history: [], hintTurn: s.moments.firstHint },
    secrets: { turn: s.secrets.firstInformed, entries: [] },
    memories: emptyMemories(),
    sharedEnvieRecent: [],
    board: emptyBoard(),
    improvements: emptyImprovements(),
    catalogueBought: {},
    giftsGiven: {},
    rooms: {},
    rack: [],
    upperStreetSince: 1,
    fishing: emptyFishing(),
    ...emptyVillageFields(),
  };

  // Pêche (P1): décrite dans les réglages, elle est ouverte dès le début.
  if (s.fishing !== null) world.flags.push(s.fishing.flag);
  const sim = wrapWorld(content, map, world);
  for (const stack of content.startingInventory.cellar) addStack(world.cellar, stack.item, 'ordinary', stack.count);
  for (const c of characters) {
    for (const stack of content.startingInventory.eachPlayer) addToBag(sim, c, stack.item, 'ordinary', stack.count);
    if (s.fishing !== null && content.items[ITEM.fishingRod] !== undefined) addToBag(sim, c, ITEM.fishingRod, 'ordinary', 1);
    const can = Object.values(content.items).find((i) => i.capacity !== null);
    c.water = can?.capacity ?? 0;
  }
  return sim;
}

/**
 * Champs du tour 10 absents d'une sauvegarde écrite avant (format 6, inchangé jusqu'au lot L4):
 * valeurs par défaut, et `inside` recalculé depuis la position. Rien n'est écrasé s'il est déjà là.
 */
export function fillTour10Fields(map: GameMap, world: WorldState): void {
  const w = world as Omit<WorldState, 'rooms' | 'rack' | 'upperStreetSince'> &
    Partial<Pick<WorldState, 'rooms' | 'rack' | 'upperStreetSince'>>;
  w.rooms ??= {};
  w.rack ??= [];
  if (!world.furniture.some((f) => f.item === TOOL_RACK.item)) world.furniture.push(rackFurniture());
  // Partie reprise d'avant la rue Haute: ses départs comptent depuis la première aube jouée avec elle.
  w.upperStreetSince ??= world.phase === 'breakfast' ? world.clock.day : world.clock.day + 1;
  const rooms = w.rooms;
  for (const c of world.characters) {
    const old = c as Omit<Character, 'inside' | 'hairChangedDay' | 'hairNoticedBy' | 'hairOffer'> &
      Partial<Pick<Character, 'inside' | 'hairChangedDay' | 'hairNoticedBy' | 'hairOffer'>>;
    old.inside = buildingAt(map, rooms, c.pos.x, c.pos.y);
    // L'ancien booléen `inHouse` (formats 1 à 6) ne sert plus: `inside` le remplace (lot L3).
    delete (old as { inHouse?: boolean }).inHouse;
    old.hairChangedDay ??= null;
    old.hairNoticedBy ??= null;
    old.hairOffer ??= null;
    const look: Partial<Appearance> = c.appearance;
    look.hairColor ??= DEFAULT_HAIR_COLOR[c.id];
    look.beard ??= 0;
    c.needs = { ...tour10Needs(), ...c.needs };
  }
  for (const v of world.villagers) {
    v.inside = v.visible ? buildingAt(map, rooms, v.pos.x, v.pos.y) : null;
  }
}
