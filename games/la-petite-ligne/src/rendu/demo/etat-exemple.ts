/**
 * État d'exemple pour la page de démonstration du rendu: tout ce que le rendu
 * sait dessiner y figure (deux joueurs, les quatre habitants, le potager à
 * tous ses stades, les poules, des meubles, un fantôme, le train à quai), et
 * une petite mise en scène fait bouger tout le monde sans la simulation.
 *
 * Le monde de départ vient de `createWorld` (tous les champs de l'état, à
 * jour des types); la scène est ensuite écrite à la main. Seules deux règles
 * du jeu y tournent, pour ne pas tromper les relecteurs: les habitants posés
 * à leur place de l'emploi du temps (`placeVillagers`, assis sur un banc
 * quand le jeu les y assoit) et l'assise des joueurs (`sitDown`).
 */
import type { GameMap } from '../../etat/carte';
import { createWorld } from '../../simulation/monde';
import { sitDown } from '../../simulation/bancs';
import { placeVillagers } from '../../simulation/habitants';
import { newToday } from '../../simulation/moments';
import { waterAhead } from '../../simulation/peche';
import type {
  ActionKind,
  Character,
  CropStage,
  GardenCell,
  Hen,
  PlacedFurniture,
  WorldEvent,
  WorldState,
} from '../../etat/types';
import type { Content } from '../../donnees/types';

/** Couleurs de profil Duo des deux joueurs de l'exemple (astre aqua, croissant mauve). */
const SCARF_P1 = '#5ce1e6';
const SCARF_P2 = '#8d6cff';
const SIM_HZ = 30;
const SEED = 7;
/** Jour de l'exemple: le premier où Jeanne est au bourg (`habitants.json`). */
const DEMO_DAY = 3;
/**
 * Jeanne dans `banc-quai`: elle laisse le banc aux deux joueurs et les regarde,
 * debout sur le quai entre la cloche et le banc, hors de la marquise.
 */
const QUAY_WATCH = { x: 30.5, y: 17.5 };

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
  c.appearance = { ...c.appearance, hair, outfit, scarf };
  c.pos = { x, y };
  c.prev = { x, y };
  c.facing = Math.PI / 2;
  c.speed = 0;
  c.status = 'active';
  c.action = { kind: 'idle', since: 0, duration: 0, target: null };
  return c;
}

export const DEMO_SCENES = [
  'rencontre',
  'place',
  'repas',
  'banc',
  'banc-quai',
  'coucher',
  'outils',
] as const;
export type DemoScene = (typeof DEMO_SCENES)[number];

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
   * côté et s'arrête (`rencontre`), Firmin seul sur la place (`place`), ou
   * Camille mange assise à la table (`repas`), ou s'assoit sur le banc de la
   * place (`banc`), ou les deux joueurs côte à côte sur le banc du quai
   * (`banc-quai`, Jeanne debout sur le quai). L'assise passe par la règle de
   * la simulation (`sitDown`): places réservées, comme en jeu.
   */
  scene?: DemoScene | undefined;
  /** Draisine poussée, posée au bout de la voie (`world.handcarAt`), remise ouverte. */
  handcarParked?: boolean;
  /**
   * Scène `coucher` (retour R05): Camille sur une paillasse et Sacha dans le lit double, tous deux
   * posés en quarts de tour `bedRotation`. Scène `outils` (retour R08): Camille tient `tool` et
   * fait `toolAction` (ou attend), Sacha marche à côté avec le même outil.
   */
  bedRotation?: number;
  /** Point de pêche de Sacha (`peche=...`): par défaut la berge nord du gué. */
  fishingSpot?: string | undefined;
  tool?: string | undefined;
  toolAction?: ActionKind | undefined;
  /**
   * Moment rare du jour (`moment=<id>`): en attente, à l'instant `t` de l'apogée (`t=<s>`), ou
   * après; les deux joueurs à leurs places de spectateurs (tenant l'échelle pour `ladder`).
   */
  moment?: DemoMoment | undefined;
}

export interface DemoMoment {
  id: string;
  phase: 'waiting' | 'climax' | 'after';
  /** Secondes depuis le début de l'apogée (ou de la phase). */
  t: number;
}

/**
 * Places des deux spectateurs de chaque moment (cases libres, à moins de 6 m de la cible), et
 * le point qu'ils regardent. L'échelle: les deux places à tenir.
 */
const MOMENT_SPOTS: Readonly<Record<string, readonly [number, number, number, number]>> = {
  heron: [22.5, 35.5, 21.0, 35.5],
  geese: [24.5, 37.5, 26.5, 37.5],
  ladder: [51.48, 5.66, 50.79, 6.61],
  tits: [50.6, 8.2, 51.4, 7.4],
  fox: [10.5, 17.5, 11.5, 16.5],
  glowworms: [53.5, 32.5, 54.5, 31.5],
  // Tour 7: figés à l'ouest de la chevrette (3,6 et 3,4 m), au bout du ponton et sur la berge, un sur chaque rive de la brume.
  roe_deer: [54.5, 28.0, 55.0, 25.5],
  kingfisher: [44.5, 37.5, 45.5, 36.5],
  mist: [29.5, 38.5, 29.5, 42.5],
  // Tour 9: côte à côte à 3,5 m de la dame blanche; chacun à sa lanterne.
  barn_owl: [54.5, 26.6, 54.5, 27.8],
  quay_lanterns: [48.5, 18.5, 35.5, 24.5],
};

/** Rencontre: départ et arrivée de Camille par rapport à Firmin (m), durée de l'approche (s). */
const MEET_FROM = { x: 5, y: -2.5 };
const MEET_TO = { x: 1.9, y: -0.6 };
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
      nameKnownBy: [],
      namedBy: null,
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
    // Chaise au sud de la table, tournée vers elle (vers le nord: rotation 2).
    const chair = { cx: room.x + 2, cy: room.y + 3 };
    furniture.push({ id: 'f9', item: 'chair', cell: chair, rotation: 2, placedBy: 'p1' });
    p1.inHouse = true;
    p1.pos = { x: chair.cx + 0.5, y: chair.cy + 0.5 };
    p1.prev = { ...p1.pos };
    p1.facing = -Math.PI / 2;
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
    day: DEMO_DAY,
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
    felledDay: index === 0 ? 1 : null,
    lastHitTick: -1000,
  }));
  world.beam = null;
  world.constructions = constructions;
  world.furniture = furniture;
  if (options.scene === 'coucher') {
    layBeds(world, p1, p2, room, options.bedRotation ?? 0);
  }
  if (options.scene === 'outils') {
    holdTools(p1, p2, door, options.tool ?? 'hoe', options.toolAction ?? 'idle');
  }
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
  world.hens = hens;
  // Habitants à leur place de l'emploi du temps, comme le jeu les pose (au
  // matin, au chargement): sur un banc, devant sa place, donc dessinés assis.
  for (const villager of world.villagers) {
    villager.met = true;
  }
  placeVillagers(sim);
  const villagers = world.villagers;
  if (options.scene === 'rencontre' || options.scene === 'place') {
    // Firmin sur la place, face à la caméra de départ, pour voir le regard et le salut.
    const firmin = villagers.find((villager) => villager.id === 'firmin');
    const square = point(map, 'village_square', 40, 28);
    if (firmin !== undefined) {
      firmin.pos = { x: square.x - 6, y: square.y };
      firmin.prev = { ...firmin.pos };
      firmin.facing = Math.PI / 4;
      firmin.target = 'village_square';
      firmin.visible = true;
    }
  }
  if (options.scene === 'banc' || options.scene === 'banc-quai') {
    const both = options.scene === 'banc-quai';
    const jeanne = villagers.find((villager) => villager.id === 'jeanne');
    if (both && jeanne !== undefined) {
      // Point fixe hors du banc (aucun banc pour point: elle reste debout), tournée vers les joueurs.
      jeanne.pos = { ...QUAY_WATCH };
      jeanne.prev = { ...QUAY_WATCH };
      jeanne.target = 'quay_bell';
      jeanne.activity = 'stand';
      jeanne.visible = true;
      jeanne.speed = 0;
      const bench = point(map, 'quay_bench', 33, 18.5);
      jeanne.facing = Math.atan2(bench.y - QUAY_WATCH.y, bench.x - QUAY_WATCH.x);
    }
    p1.aim = null;
    p2.action = { kind: 'idle', since: 0, duration: 0, target: null };
    sitDown(sim, p1, both ? 'quay_bench' : 'square_bench', 0);
    if (both) {
      sitDown(sim, p2, 'quay_bench', 1);
    }
  }
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
    const bank = point(map, options.fishingSpot ?? 'fishing_ford_north', 21.5, 37.5);
    p2.pos = { ...bank };
    p2.prev = { ...bank };
    p2.facing = Math.PI / 2;
    p2.bag[0] = { item: 'fishing_rod', quality: 'ordinary', count: 1 };
    p2.action = { kind: 'idle', since: 0, duration: 0, target: null };
    if (options.fishing !== 'none') {
      p2.fishing = {
        phase: options.fishing,
        // Le bouchon là où la simulation le lancerait (R09), sinon à distance fixe.
        bobber: waterAhead(sim, p2) ?? { x: bank.x, y: bank.y + CAST_DISTANCE },
        biteAt: 0,
        until: PIN_TICKS,
      };
    }
    if (options.absent) {
      p2.absent = true;
      p2.action = { kind: 'sit', since: 0, duration: 0, target: null };
    }
  }
  if (options.handcarParked === true) {
    // Même arrivée que la simulation: point de la remise décalé de `carry.handcar.toOffset`.
    const shed = point(map, 'handcar_shed', 30, 20);
    const offset = content.settings.carry.handcar?.toOffset ?? [-6, 4];
    world.handcarAt = { pos: { x: shed.x + offset[0], y: shed.y + offset[1] }, facing: Math.PI };
    world.worldStates.handcar_shed = 'open';
  }
  if (options.moment !== undefined) {
    placeMoment(sim, map, content, options.moment, p1, p2);
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
 * place à ses heures. `seconds`: temps de la page. Renvoie les événements du pas, comme le
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
    p1.facing = Math.atan2(MEET_TO.y - MEET_FROM.y, MEET_TO.x - MEET_FROM.x);
    p1.speed =
      u < 1 ? Math.hypot(MEET_TO.x - MEET_FROM.x, MEET_TO.y - MEET_FROM.y) / MEET_SECONDS : 0;
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
  // Jeanne ne joue sur la place qu'aux heures où l'emploi du temps l'y envoie.
  if (jeanne !== undefined && walking && jeanne.visible && jeanne.target === 'village_square') {
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

/** Pose le moment du jour de la démonstration et ses deux spectateurs. */
function placeMoment(
  sim: ReturnType<typeof createWorld>,
  map: GameMap,
  content: Content,
  moment: DemoMoment,
  p1: Character,
  p2: Character,
): void {
  const def = content.moments.find((m) => m.id === moment.id);
  if (def === undefined) {
    return;
  }
  const world = sim.world;
  const today = newToday(sim, def, def.mode === 'ambient' ? 'ambient' : 'quest');
  today.phase = moment.phase;
  today.phaseTick = world.tick - Math.round(moment.t * SIM_HZ);
  today.startTick = moment.phase === 'waiting' ? null : today.phaseTick;
  today.elapsed = moment.phase === 'climax' ? moment.t : 0;
  // Démonstration figée: l'instant demandé reste à l'écran (la page ne fait pas tourner la simulation).
  today.paused = true;
  world.moments.today = today;
  if (moment.id === 'ladder' && moment.phase !== 'waiting') {
    world.flags = world.flags.filter((flag) => flag !== 'nest_box_straight');
  }
  if (moment.id === 'tits' || (moment.id === 'ladder' && moment.phase === 'after')) {
    world.flags = [...world.flags, 'nest_box_straight'];
  }
  const spots = MOMENT_SPOTS[moment.id];
  const anchor = map.points[def.anchor] ?? { x: 0, y: 0 };
  if (spots !== undefined) {
    const [x1, y1, x2, y2] = spots;
    for (const [c, x, y] of [
      [p1, x1, y1],
      [p2, x2, y2],
    ] as const) {
      c.pos = { x, y };
      c.prev = { x, y };
      c.inHouse = false;
      c.aim = null;
      c.action = { kind: 'idle', since: 0, duration: 0, target: null };
      c.facing = Math.atan2(anchor.y - y, anchor.x - x);
    }
  }
  const hold = def.watch.hold;
  if (hold !== null && moment.phase !== 'after') {
    // L'échelle: chacun tient sa place, face au montant (comme `takeHold`).
    [p1, p2].forEach((c, index) => {
      const place = hold[index];
      if (place === undefined) return;
      c.holding = place;
      c.facing = map.pointFacings[place] ?? c.facing;
      // À la place même de la carte (la simulation l'y pose en prenant l'échelle).
      const at = map.points[place];
      if (at !== undefined) {
        c.pos = { x: at.x, y: at.y };
        c.prev = { x: at.x, y: at.y };
      }
      c.bag[c.selected] = null;
    });
  }
  // L'habitant du moment (Basile) à son point, arrêté.
  for (const actor of def.actors) {
    const villager = world.villagers.find((v) => v.id === actor.villager);
    const at = map.points[actor.at];
    if (villager === undefined || at === undefined) continue;
    villager.pos = { x: at.x, y: at.y };
    villager.prev = { x: at.x, y: at.y };
    villager.target = actor.at;
    villager.speed = 0;
    villager.visible = true;
    villager.activity = 'stand';
  }
}

/** Scène `coucher`: une paillasse et un lit double dans la pièce, un joueur couché dans chacun. */
function layBeds(
  world: WorldState,
  p1: Character,
  p2: Character,
  room: { x: number; y: number; w: number; h: number },
  rotation: number,
): void {
  const turned = rotation % 2 !== 0;
  const mattress: PlacedFurniture = {
    id: 'lit-a',
    item: 'straw_mattress',
    cell: { cx: room.x, cy: room.y },
    rotation,
    placedBy: 'p1',
  };
  const double: PlacedFurniture = {
    id: 'lit-b',
    item: 'double_bed',
    cell: { cx: room.x + (turned ? 2 : 1) + 1, cy: room.y },
    rotation,
    placedBy: 'p2',
  };
  world.furniture = [
    ...world.furniture.filter((piece) => piece.item !== 'straw_mattress' && piece.item !== 'table'),
    mattress,
    double,
  ];
  // Comme `goToBed` de la simulation: centre du lit, et 0,45 m vers l'ouest pour le premier d'un lit double.
  const lay = (c: Character, bed: PlacedFurniture, w: number, d: number, side: number): void => {
    c.inHouse = true;
    c.status = 'sleeping';
    c.bedId = bed.id;
    c.aim = null;
    c.pos = { x: bed.cell.cx + w / 2 + side, y: bed.cell.cy + d / 2 };
    c.prev = { ...c.pos };
    // Cap quelconque (celui de la marche vers le lit): le rendu doit l'ignorer.
    c.facing = -Math.PI / 2;
    c.action = { kind: 'sleep', since: 0, duration: 0, target: null };
  };
  lay(p1, mattress, turned ? 2 : 1, turned ? 1 : 2, 0);
  lay(p2, double, 2, 2, -0.45);
}

/** Scène `outils`: Camille fait le geste de l'outil (ou attend), Sacha passe à côté en le portant. */
function holdTools(
  p1: Character,
  p2: Character,
  door: { x: number; y: number },
  tool: string,
  action: ActionKind,
): void {
  for (const c of [p1, p2]) {
    c.bag[0] = { item: tool, quality: 'ordinary', count: 1 };
    c.selected = 0;
    c.aim = null;
    c.inHouse = false;
  }
  p1.pos = { x: door.x + 0.5, y: door.y + 3.5 };
  p1.prev = { ...p1.pos };
  p1.facing = Math.PI / 4;
  p1.action = { kind: action, since: 0, duration: 0, target: null };
  p2.pos = { x: door.x + 2.6, y: door.y + 3.5 };
  p2.prev = { x: p2.pos.x - 0.05, y: p2.pos.y };
  p2.facing = 0;
  p2.speed = 2.4;
  p2.action = { kind: 'walk', since: 0, duration: 0, target: null };
}
