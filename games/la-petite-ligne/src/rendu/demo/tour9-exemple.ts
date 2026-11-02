/**
 * Ce que le tour 9 ajoute, sur la page de démonstration (`rendu.html`):
 *
 * - `chantiers=tous` (ou une liste: `ford_bench,well_roof`): chantiers bâtis la veille;
 * - `cadeaux=1`: les quatre cadeaux offerts la veille (marelle, écharpe de Firmin);
 * - `outil=<objet>` (et `outil2=` pour Sacha): Camille tient cet outil (arrosoir de cuivre, hache de la forge, canne en
 *   bambou); `outil=lamp_pole`: elle lève la perche (geste `light`, figé à `t`);
 * - `maison9=1`: les objets muraux et le fauteuil d'osier posés dans la pièce;
 * - `poule9=1`: la dernière poule vient d'arriver par le train, dans sa cage, pas encore nommée;
 * - `cueillette9=1`: grappes de sureau, noisettes, cèpes et mûres posées à leurs coins;
 * - `assis=gue|pignon|ponton`: les deux joueurs assis sur le banc du gué, du pignon ou au bord
 *   du ponton;
 * - `arme=<s>`: le salut du mécanicien armé depuis `s` secondes (lisses, manivelles); à
 *   l'apogée, le train part au pas, à l'instant `t` de la chorégraphie;
 * - `allume=quai|place`: la lanterne allumée seule depuis `t` secondes (attente des lanternes).
 *
 * Les moments du tour 9 passent par `moment=<id>` (`placeMoment` d'`etat-exemple.ts`), avec les
 * places des spectateurs ci-dessous.
 */
import type { Content } from '../../donnees/types';
import { seatPlace, type BenchPlace } from '../../etat/bancs';
import type { GameMap, MapProp } from '../../etat/carte';
import { SIM_HZ, type Character, type WorldState } from '../../etat/types';

const WALL_ITEMS = ['straw_hat', 'pressed_flowers', 'coop_calendar', 'wall_clock', 'autumn_wreath'] as const;
const SEATS: Readonly<Record<string, string>> = { gue: 'ford_bench', pignon: 'house_bench', ponton: 'pontoon_edge' };
const PICKS: readonly { point: string; item: string; count: number }[] = [
  { point: 'forage_edge_06', item: 'elderberry', count: 3 },
  { point: 'forage_edge_02', item: 'cep', count: 2 },
  { point: 'forage_edge_03', item: 'blackberry', count: 3 },
];
/** Durée du geste d'allumage (s), comme la simulation. */
const LIGHT_SECONDS = 0.6;

export function applyTour9Example(world: WorldState, map: GameMap, content: Content, params: URLSearchParams): void {
  const day = world.clock.day;
  const asked = params.get('chantiers');
  if (asked !== null) {
    const ids = asked === 'tous' ? content.improvements.map((x) => x.id) : asked.split(',');
    for (const def of content.improvements) {
      if (!ids.includes(def.id)) continue;
      world.improvements[def.id] = { paid: def.price, planks: 0, funded: true, builtDay: day - 1 };
      if (!world.flags.includes(def.flag)) world.flags.push(def.flag);
    }
  }
  if (params.get('cadeaux') === '1') {
    world.giftsGiven = { ...world.giftsGiven, jeanne: day - 1, odette: day - 1, basile: day - 1, firmin: day - 1 };
  }
  const [p1, p2] = world.characters;
  const tool = params.get('outil');
  if (tool !== null && p1 !== undefined) {
    if (tool === 'lamp_pole') {
      const t = Math.max(0, Number(params.get('t') ?? '0.3') || 0);
      p1.action = { kind: 'light', since: world.tick - Math.round(t * SIM_HZ), duration: Math.round(LIGHT_SECONDS * SIM_HZ), target: null };
    } else {
      p1.bag[p1.selected] = { item: tool, quality: 'ordinary', count: 1 };
      p1.action = { kind: 'idle', since: 0, duration: 0, target: null };
    }
  }
  const tool2 = params.get('outil2');
  if (tool2 !== null && p2 !== undefined) {
    p2.bag[p2.selected] = { item: tool2, quality: 'ordinary', count: 1 };
    p2.action = { kind: 'idle', since: 0, duration: 0, target: null };
  }
  if (params.get('maison9') === '1') placeHouseItems(world, map);
  const hen = world.hens[world.hens.length - 1];
  if (params.get('poule9') === '1' && hen !== undefined) {
    // La poule du catalogue arrivée ce matin, pas encore nommée: dans sa cage.
    hen.arrivedDay = day;
    hen.nameKnownBy = [];
  }
  if (params.get('cueillette9') === '1') placePicks(world, map, content);
  const seat = SEATS[params.get('assis') ?? ''];
  if (seat !== undefined && p1 !== undefined && p2 !== undefined) seatBoth(map, content, seat, p1, p2);
  applyMomentExtras(world, content, params);
}

function applyMomentExtras(world: WorldState, content: Content, params: URLSearchParams): void {
  const today = world.moments.today;
  if (today === null) return;
  const def = content.moments.find((m) => m.id === today.id);
  const t = Math.max(0, Number(params.get('t') ?? '0') || 0);
  const armed = params.get('arme');
  if ((def?.watch.arm ?? null) !== null && def !== undefined && armed !== null) {
    const since = Math.max(0, Number(armed) || 0);
    today.armedTick = world.tick - Math.round(since * SIM_HZ);
    if (today.phase === 'climax') {
      // Départ au pas: le train suit la cabine (`train.slow`), à l'instant `t` de l'apogée.
      const progress = 1 - t / Math.max(1, def.climax.seconds);
      world.train = { phase: 'departing', progress, prevProgress: progress, slow: true };
      for (const c of world.characters) c.holding = null;
    }
  }
  const lit = params.get('allume');
  const places = def?.watch.syncPress?.places ?? [];
  const place = lit === 'quai' ? places[0] : lit === 'place' ? places[1] : undefined;
  if (place !== undefined) {
    today.presses = { p1: { tick: world.tick - Math.round(t * SIM_HZ), place }, p2: null };
  }
}

function placeHouseItems(world: WorldState, map: GameMap): void {
  const room = map.house.room;
  // Les objets muraux au mur nord, l'horloge au mur ouest, le fauteuil près de la fenêtre.
  WALL_ITEMS.forEach((item, index) => {
    // Le poêle tient le coin nord-est (son tuyau contre le mur): la couronne va au mur ouest.
    const cell =
      item === 'wall_clock' ? { cx: room.x, cy: room.y + 2 } : item === 'autumn_wreath' ? { cx: room.x, cy: room.y + 1 } : { cx: room.x + index, cy: room.y };
    world.furniture.push({ id: `t9-${item}`, item, cell, rotation: 0, placedBy: 'p1' });
  });
  world.furniture.push({ id: 't9-armchair', item: 'wicker_armchair', cell: { cx: room.x + 3, cy: room.y + 2 }, rotation: 3, placedBy: 'p2' });
}

function placePicks(world: WorldState, map: GameMap, content: Content): void {
  world.groundItems = world.groundItems.filter((g) => content.items[g.item]?.category !== 'forage');
  const picks = [...PICKS];
  // Les noisettes sous un noisetier: le premier buisson dont la variante est le noisetier (`nut_spots`).
  const hazel = map.props.find((prop) => prop.id === 'bush_33') ?? null;
  if (hazel !== null) picks.push({ point: '', item: 'hazelnut', count: 3 });
  picks.forEach((pick, index) => {
    const at = pick.point === '' ? (hazel === null ? undefined : { x: hazel.pos.x, y: hazel.pos.y + 0.5 }) : map.points[pick.point];
    if (at === undefined) return;
    world.groundItems.push({ id: `t9-${String(index)}`, item: pick.item, quality: 'ordinary', count: pick.count, pos: { x: at.x, y: at.y } });
  });
}

function benchOf(map: GameMap, id: string): MapProp | null {
  return map.improvements?.[id] ?? map.seats?.find((s) => s.id === id) ?? null;
}

function seatBoth(map: GameMap, content: Content, id: string, p1: Character, p2: Character): void {
  const bench = benchOf(map, id);
  if (bench === null) return;
  const place: BenchPlace = { x: 0, y: 0, facing: 0 };
  [p1, p2].forEach((c, slot) => {
    seatPlace(bench, slot, content.settings.benches, place);
    c.pos = { x: place.x, y: place.y };
    c.prev = { x: place.x, y: place.y };
    c.facing = place.facing;
    c.inHouse = false;
    c.speed = 0;
    c.aim = null;
    c.seat = { bench: id, slot, since: 0 };
    c.action = { kind: 'sit', since: 0, duration: 0, target: null };
  });
}
