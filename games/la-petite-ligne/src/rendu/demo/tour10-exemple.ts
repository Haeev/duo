/**
 * Ce que le tour 10 ajoute, sur la page de démonstration (`rendu.html`). Les champs d'état sont
 * ceux déclarés par le lot L0 (`inside`, `rooms`, `rack`, `PlacedFurniture.window` et `closed`,
 * `appearance.hairColor` et `beard`); tant que les règles (lots L3 et L4) ne les remplissent pas,
 * la page les pose elle-même:
 *
 * - `scene=mercerie`: Camille dans la mercerie de Solange (Sacha sur le banc d'attente);
 *   `scene=epicerie`: chez Odette (Sacha à la petite table); `scene=pont`: Camille sur le pont
 *   de la rue, Sacha sur la passerelle; `scene=rue`: les deux dans la rue Haute;
 * - `habitants10=1`: Achille au guichet du fournil et Solange à son comptoir (absents des
 *   données tant que le lot L3 ne les a pas ajoutés);
 * - `pieces=site|chantier|baties` (ou `cellier=` et `chambre=` séparément): le cellier et la
 *   chambre au matin du site (fantômes), à moitié bâtis, ou bâtis;
 * - `rideaux=1`: rideaux de couleur aux fenêtres de la pièce, certains fermés (`rideaux=fermes`:
 *   tous fermés); `rangement=1`: grand coffre, étagère, étagères hautes du cellier, râtelier et ses
 *   outils;
 * - `deco=1`: une plume de geai et un pot de fleurs posés sur la table, Camille assise sur une
 *   chaise posée au sud de la table (S03, S07);
 * - `habitants=0`: aucun habitant à l'écran (mesures « sans habitants » de l'ADR 0016);
 * - `coiffure=<0..14>`, `couleur=<0..7>`, `barbe=<0..3>` pour Camille, `coiffure2=`,
 *   `couleur2=`, `barbe2=` pour Sacha.
 *
 * Après tout déplacement, `inside` de chacun est recalculé depuis sa position (`buildingAt`).
 */
import type { Content } from '../../donnees/types';
import { buildingAt, type GameMap } from '../../etat/carte';
import type { Character, PlacedFurniture, RoomState, VillagerState, WorldState } from '../../etat/types';

const SCENES: Readonly<Record<string, { p1: [number, number, number]; p2: [number, number, number] | null }>> = {
  // [x, y, cap en radians (0 vers l'est, sens horaire vu du dessus)]
  mercerie: { p1: [72.5, 28.6, Math.PI], p2: [72.6, 30.4, -Math.PI / 2] },
  epicerie: { p1: [27.5, 28.5, 0], p2: [27.6, 30.2, -Math.PI / 2] },
  pont: { p1: [63.5, 22.4, 0], p2: [63.6, 34.8, Math.PI] },
  rue: { p1: [76.5, 27.5, Math.PI / 2], p2: [77.5, 26.0, Math.PI / 2] },
  // Le pré de l'est, dégagé: gros plans des coiffures, les deux face à la caméra par défaut.
  pre: { p1: [90.4, 30.5, Math.PI / 4], p2: [91.4, 30.1, (3 * Math.PI) / 4] },
};

/** Éléments de chaque pièce, dans l'ordre de `donnees/pieces.json` (lot L4). */
const ROOM_ELEMENTS: Readonly<Record<string, readonly string[]>> = {
  room_cellar: ['post_south', 'post_north', 'wall_plate', 'wall_west', 'wall_north', 'roof'],
  room_bedroom: [
    'post_nw',
    'post_ne',
    'post_sw',
    'post_se',
    'plate_west',
    'plate_east',
    'wall_north',
    'wall_west',
    'wall_east',
    'wall_gable',
    'truss_ridge',
    'floor',
  ],
};

const CURTAINS: readonly { window: string; item: string; closed: boolean }[] = [
  { window: 'window_1', item: 'curtains_blue', closed: false },
  { window: 'window_2', item: 'curtains_gingham', closed: true },
  { window: 'window_5', item: 'curtains_yellow', closed: false },
  { window: 'window_3', item: 'curtains_green', closed: true },
  { window: 'window_4', item: 'curtains_red', closed: false },
  { window: 'window_7', item: 'curtains', closed: true },
  { window: 'window_8', item: 'curtains_blue', closed: false },
];

function place(c: Character, x: number, y: number, facing: number): void {
  c.pos = { x, y };
  c.prev = { x, y };
  c.facing = facing;
  c.speed = 0;
}

function roomState(stage: string, room: string, day: number): RoomState | null {
  const elements = ROOM_ELEMENTS[room] ?? [];
  if (stage === 'site') {
    return { ordered: day - 1, crate: [], elementsBuilt: [], beamPlaced: false, builtDay: null };
  }
  if (stage === 'chantier') {
    return {
      ordered: day - 2,
      crate: [],
      elementsBuilt: elements.slice(0, Math.ceil(elements.length / 2)),
      beamPlaced: false,
      builtDay: null,
    };
  }
  if (stage === 'baties' || stage === 'batie' || stage === 'bati') {
    return { ordered: day - 4, crate: [], elementsBuilt: [...elements], beamPlaced: true, builtDay: day - 1 };
  }
  return null;
}

function villager(id: string, x: number, y: number, facing: number, target: string, inside: string | null): VillagerState {
  return {
    id,
    pos: { x, y },
    prev: { x, y },
    facing,
    speed: 0,
    visible: true,
    target,
    activity: 'serve',
    talkingWith: [],
    met: true,
    inside,
  };
}

function numberParam(params: URLSearchParams, key: string, max: number): number | null {
  const raw = params.get(key);
  if (raw === null) return null;
  const value = Math.trunc(Number(raw));
  return Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}

export function applyTour10Example(
  world: WorldState,
  map: GameMap,
  content: Content,
  params: URLSearchParams,
): void {
  const day = world.clock.day;
  const [p1, p2] = world.characters;
  const scene = SCENES[params.get('scene') ?? ''];
  if (scene !== undefined && p1 !== undefined) {
    place(p1, ...scene.p1);
    if (p2 !== undefined && scene.p2 !== null) place(p2, ...scene.p2);
  }
  if (params.get('habitants10') === '1') {
    if (!world.villagers.some((v) => v.id === 'achille')) {
      // Au point du guichet (dehors, sous l'auvent: `bakery_window` du modèle), tourné vers la rue.
      world.villagers.push(villager('achille', 70.5, 20.6, Math.PI / 2, 'bakery_window', null));
    }
    if (!world.villagers.some((v) => v.id === 'solange')) {
      world.villagers.push(villager('solange', 71.0, 26.6, Math.PI / 2, 'salon_counter', 'salon'));
    }
  }
  const all = params.get('pieces');
  for (const [room, key] of [
    ['room_cellar', 'cellier'],
    ['room_bedroom', 'chambre'],
  ] as const) {
    const stage = params.get(key) ?? all;
    const state = stage === null ? null : roomState(stage, room, day);
    if (state !== null) world.rooms = { ...world.rooms, [room]: state };
  }
  const curtains = params.get('rideaux');
  if (curtains !== null) {
    const built = (room: string): boolean => (world.rooms[room]?.builtDay ?? null) !== null;
    const house = map.buildings.house?.rooms[0]?.rect;
    CURTAINS.forEach((entry, index) => {
      // Fenêtre devenue porte (pièce bâtie): plus de rideaux; fenêtres de la chambre: seulement bâtie.
      if (entry.window === 'window_3' && built('room_bedroom')) return;
      if (entry.window === 'window_4' && built('room_cellar')) return;
      if ((entry.window === 'window_7' || entry.window === 'window_8') && !built('room_bedroom')) return;
      const piece: PlacedFurniture = {
        id: `rideaux_t10_${String(index)}`,
        item: entry.item,
        cell: { cx: house?.x ?? 6, cy: house?.y ?? 22 },
        rotation: 0,
        placedBy: 'p1',
        window: entry.window,
      };
      if (curtains === 'fermes' || entry.closed) piece.closed = true;
      world.furniture.push(piece);
    });
    // Les anciens rideaux muraux (sans fenêtre) de l'exemple disparaissent: ils iraient à une fenêtre.
    world.furniture = world.furniture.filter((piece) => !(piece.item === 'curtains' && piece.window === undefined));
  }
  if (params.get('rangement') === '1') {
    const extra: PlacedFurniture[] = [
      { id: 'grand_coffre', item: 'oak_chest', cell: { cx: 10, cy: 22 }, rotation: 3, placedBy: null },
      { id: 'etagere', item: 'shelf', cell: { cx: 8, cy: 22 }, rotation: 0, placedBy: 'p1' },
      { id: 'ratelier', item: 'tool_rack', cell: { cx: 6, cy: 22 }, rotation: 1, placedBy: 'p2' },
    ];
    if ((world.rooms.room_cellar?.builtDay ?? null) !== null) {
      extra.push(
        { id: 'etagere_haute_1', item: 'cellar_rack', cell: { cx: 3, cy: 22 }, rotation: 1, placedBy: 'p1' },
        { id: 'etagere_haute_2', item: 'cellar_rack', cell: { cx: 3, cy: 24 }, rotation: 1, placedBy: 'p2' },
      );
    }
    world.furniture = world.furniture.filter((piece) => piece.item !== 'chest' || piece.id === 'grand_coffre');
    world.furniture.push(...extra);
    world.rack = [
      { item: 'hoe', quality: 'ordinary' as const, count: 1 },
      { item: 'watering_can', quality: 'ordinary' as const, count: 1 },
      { item: 'axe', quality: 'ordinary' as const, count: 1 },
      { item: 'fishing_rod', quality: 'ordinary' as const, count: 1 },
    ].filter((stack) => content.items[stack.item] !== undefined);
  }
  for (const [c, suffix] of [
    [p1, ''],
    [p2, '2'],
  ] as const) {
    if (c === undefined) continue;
    const hair = numberParam(params, `coiffure${suffix}`, 14);
    const color = numberParam(params, `couleur${suffix}`, 7);
    const beard = numberParam(params, `barbe${suffix}`, 3);
    c.appearance = {
      ...c.appearance,
      ...(hair === null ? {} : { hair }),
      ...(color === null ? {} : { hairColor: color }),
      ...(beard === null ? {} : { beard }),
    };
  }
  // `deco=1` (0.11.2): une plume et un pot de fleurs sur la table, Camille assise sur une chaise posée.
  if (params.get('deco') === '1') applyDecorExample(world);
  // `habitants=0`: aucun habitant à l'écran (mesures des budgets de l'ADR 0016, « sans habitants »).
  if (params.get('habitants') === '0') {
    for (const v of world.villagers) v.visible = false;
  }
  for (const c of world.characters) {
    c.inside = buildingAt(map, world.rooms, c.pos.x, c.pos.y);
  }
}

/** Petits objets sur la table et une chaise posée où Camille est assise (0.11.2, S03 et S07). */
function applyDecorExample(world: WorldState): void {
  const table = world.furniture.find((piece) => piece.item === 'table');
  const p1 = world.characters[0];
  if (table === undefined || p1 === undefined) return;
  world.decor = [
    { id: 'deco_plume', item: 'jay_feather', on: table.id, place: 0, placedBy: 'p1' },
    { id: 'deco_fleurs', item: 'flower_pot', on: table.id, place: 1, placedBy: 'p2' },
  ];
  // Chaise au sud de la table, tournée vers elle (rotation 2: dossier au sud, assise vers le nord).
  const cell = { cx: table.cell.cx + 1, cy: table.cell.cy + 1 };
  world.furniture = world.furniture.filter((piece) => piece.id !== 'deco_chaise');
  world.furniture.push({ id: 'deco_chaise', item: 'chair', cell, rotation: 2, placedBy: 'p1' });
  p1.pos = { x: cell.cx + 0.5, y: cell.cy + 0.5 };
  p1.prev = { ...p1.pos };
  p1.facing = -Math.PI / 2;
  p1.aim = null;
  p1.placement = null;
  p1.seat = { bench: 'deco_chaise', slot: 0, since: 0 };
  p1.action = { kind: 'sit', since: 0, duration: 0, target: null };
}
