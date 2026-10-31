/**
 * État d'exemple pour la page de démonstration du rendu: tout ce que le rendu
 * sait dessiner y figure (deux joueurs, les quatre habitants, le potager à
 * tous ses stades, les poules, des meubles, un fantôme, le train à quai), et
 * une petite mise en scène fait bouger tout le monde sans la simulation.
 *
 * Le monde de départ vient de `createWorld` (tous les champs de l'état, à
 * jour des types); la scène est ensuite écrite à la main: aucune règle du jeu
 * ne tourne ici.
 */
import type { GameMap } from '../../etat/carte';
import { createWorld } from '../../simulation/monde';
import type {
  ActionKind,
  Character,
  CropStage,
  GardenCell,
  Hen,
  PlacedFurniture,
  VillagerState,
  WorldEvent,
  WorldState,
} from '../../etat/types';
import type { Content } from '../../donnees/types';

/** Couleurs de profil Duo des deux joueurs de l'exemple (astre aqua, croissant mauve). */
const SCARF_P1 = '#5ce1e6';
const SCARF_P2 = '#8d6cff';
const SIM_HZ = 30;
const SEED = 7;

function dress(
  c: Character,
  name: string,
  x: number,
  y: number,
  scarf: string,
  hair: number,
  outfit: number,
): Character {
  c.name = name;
  c.created = true;
  c.appearance = { hair, outfit, scarf };
  c.pos = { x, y };
  c.prev = { x, y };
  c.facing = Math.PI / 2;
  c.speed = 0;
  c.status = 'active';
  c.action = { kind: 'idle', since: 0, duration: 0, target: null };
  return c;
}

export interface DemoOptions {
  /** Heure de jeu, en minutes depuis minuit. */
  minutes: number;
  weather: WorldState['weather'];
  /** Le joueur local est dans la maisonnette (murs et toit coupés). */
  inside: boolean;
  /** Toit et porte construits, poulailler réparé. */
  repaired: boolean;
  train: WorldState['train']['phase'];
  /** Repère planté par Camille (P1). */
  pin: boolean;
  /** Sacha pêche au gué (P1): rien, en attente, ou une touche. */
  fishing: 'none' | 'waiting' | 'bite';
  /** Sacha est absent (P1): assis, auréole douce. */
  absent: boolean;
  /** Coin à soi de chacun dans la pièce (P1), Sacha à l'intérieur dans le sien. */
  corners?: boolean;
  /**
   * Petites scènes de la vie au repos: Camille s'approche de Firmin par le
   * côté et s'arrête (`rencontre`), ou mange assise à la table (`repas`).
   */
  scene?: 'rencontre' | 'repas' | undefined;
}

/** Rencontre: départ et arrivée de Camille par rapport à Firmin (m), durée de l'approche (s). */
const MEET_FROM = { x: 6, y: 1.2 };
const MEET_TO = { x: 1.8, y: 1.2 };
const MEET_SECONDS = 1.6;

/** Durée d'un repère à 30 pas par seconde (15 s, comme la simulation). */
const PIN_TICKS = 450;
/** Le bouchon se pose à cette distance devant le pêcheur (m). */
const CAST_DISTANCE = 3;

function point(
  map: GameMap,
  id: string,
  fallbackX: number,
  fallbackY: number,
): { x: number; y: number } {
  const p = map.points[id];
  return p === undefined ? { x: fallbackX, y: fallbackY } : { x: p.x, y: p.y };
}

const STAGES: readonly (CropStage | null)[] = [null, 'seed', 'sprout', 'young', 'ripe'];
const CROPS = ['radish', 'lettuce', 'carrot'] as const;

export function createExampleWorld(
  map: GameMap,
  content: Content,
  options: DemoOptions,
): WorldState {
  const sim = createWorld(content, map, SEED, [
    { id: 'joueur-1', name: 'Camille', color: SCARF_P1 },
    { id: 'joueur-2', name: 'Sacha', color: SCARF_P2 },
  ]);
  const world = sim.world;
  const door = point(map, 'house_door', map.house.door.cx + 0.5, map.house.door.cy + 0.5);
  const room = map.house.room;
  const [first, second] = world.characters;
  if (first === undefined || second === undefined) {
    return world;
  }
  const p1 = options.inside
    ? dress(first, 'Camille', room.x + 1.5, room.y + 2.5, SCARF_P1, 0, 0)
    : dress(first, 'Camille', door.x + 0.5, door.y + 2.2, SCARF_P1, 0, 0);
  const p2 = dress(second, 'Sacha', door.x - 1.5, door.y + 3.5, SCARF_P2, 1, 2);
  p1.inHouse = options.inside;
  // Case visée (surlignage): une culture mûre du potager.
  const aimed = map.garden[4];
  if (aimed !== undefined && !options.inside) {
    p1.aim = { cell: { ...aimed }, verb: 'harvest', blocked: null };
  }
  p1.bag[0] = { item: 'hoe', quality: 'ordinary', count: 1 };
  p1.selected = 0;
  p2.bag[0] = { item: 'watering_can', quality: 'ordinary', count: 1 };
  p2.selected = 0;
  p2.action = { kind: 'water', since: 0, duration: 60, target: null };

  const garden: GardenCell[] = map.garden.map((cell, index) => {
    const stage = STAGES[index % STAGES.length] ?? null;
    const crop = CROPS[Math.floor(index / 4) % CROPS.length] ?? 'radish';
    return {
      index,
      cell,
      soil: index === 0 ? 'grass' : 'tilled',
      wet: index % 3 === 1,
      crop:
        stage === null
          ? null
          : {
              crop,
              days: 0,
              stage,
              ripe: stage === 'ripe',
              wateredEveryDay: true,
              sownDay: 1,
              sownBy: 'p1',
            },
      lastHarvest: null,
    };
  });

  const villagers: VillagerState[] = content.villagers.map((villager, index) => {
    const spots = ['quay_bell', 'grocery_counter', 'sawmill_workbench', 'quay_bench'];
    const at = point(map, spots[index % spots.length] ?? 'village_square', 30, 25);
    return {
      id: villager.id,
      pos: { ...at },
      prev: { ...at },
      facing: Math.PI / 2,
      speed: 0,
      visible: true,
      target: spots[index % spots.length] ?? 'village_square',
      activity: villager.id === 'basile' ? 'work' : 'stand',
      talkingWith: [],
      met: true,
    };
  });

  const pen = map.zones.hen_pen ?? { x: 13, y: 31, w: 4, h: 4 };
  const hens: Hen[] = ['hen_white', 'hen_red', 'hen_black'].map((variant, index) => {
    const at = { x: pen.x + 0.8 + index * 1.2, y: pen.y + pen.h - 1 };
    return {
      id: `hen_${index}`,
      name: variant,
      variant,
      pos: { ...at },
      prev: { ...at },
      facing: index,
      wander: { ...at },
    };
  });

  const furniture: PlacedFurniture[] = [
    {
      id: 'f1',
      item: 'straw_mattress',
      cell: { cx: room.x, cy: room.y },
      rotation: 0,
      placedBy: null,
    },
    {
      id: 'f2',
      item: 'straw_mattress',
      cell: { cx: room.x + 1, cy: room.y },
      rotation: 0,
      placedBy: null,
    },
    {
      id: 'f3',
      item: 'stove',
      cell: { cx: room.x + room.w - 1, cy: room.y },
      rotation: 0,
      placedBy: null,
    },
    {
      id: 'f4',
      item: 'chest',
      cell: { cx: room.x, cy: room.y + room.h - 1 },
      rotation: 0,
      placedBy: null,
    },
    {
      id: 'f5',
      item: 'table',
      cell: { cx: room.x + 2, cy: room.y + 2 },
      rotation: 0,
      placedBy: 'p2',
    },
    {
      id: 'f6',
      item: 'flower_pot',
      cell: { cx: room.x + room.w - 1, cy: room.y + room.h - 1 },
      rotation: 0,
      placedBy: 'p1',
    },
    // Semaine 2: le cadre au mur du fond (rotation 0, il s'accroche au bord nord de la case) et le poêle.
    {
      id: 'f7',
      item: 'picture_frame',
      cell: { cx: room.x + 2, cy: room.y },
      rotation: 0,
      placedBy: 'p1',
    },
    {
      id: 'f8',
      item: 'wood_stove',
      cell: { cx: room.x + room.w - 1, cy: room.y + 2 },
      rotation: 3,
      placedBy: 'p2',
    },
  ];
  if (options.scene === 'repas') {
    const chair = { cx: room.x + 1, cy: room.y + 2 };
    world.furniture.push({ id: 'f9', item: 'chair', cell: chair, rotation: 1, placedBy: 'p1' });
    p1.inHouse = true;
    p1.pos = { x: chair.cx + 0.5, y: chair.cy + 0.5 };
    p1.prev = { ...p1.pos };
    p1.facing = 0;
    p1.aim = null;
    p1.action = { kind: 'eat', since: 0, duration: 0, target: null };
  } else if (options.inside) {
    p1.placement = {
      item: 'chair',
      cell: { cx: room.x + 3, cy: room.y + 1 },
      rotation: 1,
      valid: true,
    };
  }

  const constructions = content.constructions.map((definition) => ({
    id: definition.id,
    status: options.repaired
      ? ('done' as const)
      : definition.id === 'house_beam'
        ? ('done' as const)
        : ('ghost' as const),
    elements: definition.elements.map((element, index) => ({
      id: element.id,
      progress: options.repaired ? 1 : index < 3 ? 1 : index === 3 ? 0.5 : 0,
      paid: options.repaired || index <= 3,
      done: options.repaired || index < 3,
      workers: [],
    })),
  }));

  world.phase = 'day';
  world.clock = {
    ...world.clock,
    day: 2,
    minutes: options.minutes,
    running: true,
    stoppedBy: null,
    veillee: false,
  };
  world.weather = options.weather;
  world.garden = garden;
  world.trees = map.trees.map((tree, index) => ({
    id: tree.id,
    kind: tree.kind,
    pos: { ...tree.pos },
    hits: 0,
    felled: index === 0,
    lastHitTick: -1000,
  }));
  world.beam = null;
  world.constructions = constructions;
  world.furniture = furniture;
  world.groundItems = [
    {
      id: 'g1',
      item: 'egg',
      quality: 'ordinary',
      count: 1,
      pos: { x: pen.x + 1.5, y: pen.y + 0.8 },
    },
    { id: 'g2', item: 'log', quality: 'ordinary', count: 2, pos: { x: door.x + 3, y: door.y + 1 } },
  ];
  world.villagers = villagers;
  world.hens = hens;
  if (options.corners === true) {
    p1.corner = { cx: room.x + room.w - 2, cy: room.y };
    p2.corner = { cx: room.x, cy: room.y + room.h - 2 };
    p2.pos = { x: room.x + 1.5, y: room.y + room.h - 0.5 };
    p2.prev = { ...p2.pos };
    p2.inHouse = true;
  }
  if (options.pin) {
    p1.pin = { pos: { x: door.x + 3.5, y: door.y + 4.5 }, since: 0, until: PIN_TICKS };
  }
  if (options.fishing !== 'none' || options.absent) {
    const bank = point(map, 'fishing_ford_north', 21.5, 37.5);
    p2.pos = { ...bank };
    p2.prev = { ...bank };
    p2.facing = Math.PI / 2;
    p2.bag[0] = { item: 'fishing_rod', quality: 'ordinary', count: 1 };
    p2.action = { kind: 'idle', since: 0, duration: 0, target: null };
    if (options.fishing !== 'none') {
      p2.fishing = {
        phase: options.fishing,
        bobber: { x: bank.x, y: bank.y + CAST_DISTANCE },
        biteAt: 0,
        until: PIN_TICKS,
      };
    }
    if (options.absent) {
      p2.absent = true;
      p2.action = { kind: 'sit', since: 0, duration: 0, target: null };
    }
  }
  world.train = {
    phase: options.train,
    progress: options.train === 'stopped' ? 1 : 0.5,
    prevProgress: options.train === 'stopped' ? 1 : 0.5,
  };
  return world;
}

/** Une boucle de promenade: le personnage suit ce trajet en va-et-vient. */
interface Stroll {
  points: { x: number; y: number }[];
  speed: number;
}

function strollPosition(
  stroll: Stroll,
  seconds: number,
): { x: number; y: number; facing: number; moving: boolean } {
  const segments: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    length: number;
  }[] = [];
  let total = 0;
  for (let i = 0; i < stroll.points.length; i += 1) {
    const from = stroll.points[i];
    const to = stroll.points[(i + 1) % stroll.points.length];
    if (from === undefined || to === undefined) {
      continue;
    }
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    segments.push({ from, to, length });
    total += length;
  }
  let distance = (seconds * stroll.speed) % Math.max(total, 1);
  for (const segment of segments) {
    if (distance <= segment.length) {
      const t = segment.length === 0 ? 0 : distance / segment.length;
      return {
        x: segment.from.x + (segment.to.x - segment.from.x) * t,
        y: segment.from.y + (segment.to.y - segment.from.y) * t,
        facing: Math.atan2(segment.to.y - segment.from.y, segment.to.x - segment.from.x),
        moving: true,
      };
    }
    distance -= segment.length;
  }
  const first = stroll.points[0] ?? { x: 0, y: 0 };
  return { x: first.x, y: first.y, facing: 0, moving: false };
}

/**
 * Fait vivre l'exemple: Sacha arrose, Camille se promène, Jeanne joue sur la
 * place. `seconds`: temps de la page. Renvoie les événements du pas, comme le
 * ferait la simulation.
 */
export function animateExampleWorld(
  world: WorldState,
  map: GameMap,
  seconds: number,
  walking: boolean,
  options?: Pick<DemoOptions, 'scene'>,
): WorldEvent[] {
  const events: WorldEvent[] = [];
  world.tick = Math.floor(seconds * SIM_HZ);
  const door = point(map, 'house_door', map.house.door.cx + 0.5, map.house.door.cy + 0.5);
  const p1 = world.characters[0];
  const firmin = world.villagers.find((villager) => villager.id === 'firmin');
  if (p1 !== undefined && firmin !== undefined && walking && options?.scene === 'rencontre') {
    const u = Math.min(1, seconds / MEET_SECONDS);
    p1.prev = { ...p1.pos };
    p1.pos = {
      x: firmin.pos.x + MEET_FROM.x + (MEET_TO.x - MEET_FROM.x) * u,
      y: firmin.pos.y + MEET_FROM.y + (MEET_TO.y - MEET_FROM.y) * u,
    };
    p1.facing = Math.PI;
    p1.speed = u < 1 ? (MEET_FROM.x - MEET_TO.x) / MEET_SECONDS : 0;
    p1.action = { kind: u < 1 ? 'walk' : 'idle', since: 0, duration: 0, target: null };
  } else if (p1 !== undefined && walking && !p1.inHouse && options?.scene === undefined) {
    const stroll = strollPosition(
      {
        points: [
          { x: door.x + 0.5, y: door.y + 2.2 },
          { x: door.x + 6, y: door.y + 2.2 },
          { x: door.x + 6, y: door.y + 6 },
          { x: door.x + 0.5, y: door.y + 6 },
        ],
        speed: 3.2,
      },
      seconds,
    );
    p1.prev = { ...p1.pos };
    p1.pos = { x: stroll.x, y: stroll.y };
    p1.facing = stroll.facing;
    p1.speed = stroll.moving ? 3.2 : 0;
    p1.action = { kind: stroll.moving ? 'walk' : 'idle', since: 0, duration: 0, target: null };
  }
  const jeanne = world.villagers.find((villager) => villager.id === 'jeanne');
  const square = point(map, 'village_square', 40, 28);
  if (jeanne !== undefined && walking) {
    const stroll = strollPosition(
      {
        points: [
          { x: square.x - 3, y: square.y - 2 },
          { x: square.x + 3, y: square.y - 2 },
          { x: square.x + 3, y: square.y + 2 },
          { x: square.x - 3, y: square.y + 2 },
        ],
        speed: 2.4,
      },
      seconds,
    );
    jeanne.prev = { ...jeanne.pos };
    jeanne.pos = { x: stroll.x, y: stroll.y };
    jeanne.facing = stroll.facing;
    jeanne.speed = 2.4;
  }
  return events;
}

/** Action à montrer pour un rôle donné (page de démonstration, sélecteur d'animation). */
export const DEMO_ACTIONS: readonly ActionKind[] = [
  'idle',
  'walk',
  'till',
  'sow',
  'water',
  'harvest',
  'carry',
  'talk',
  'sleep',
  'chop',
  'hammer',
  'eat',
];
