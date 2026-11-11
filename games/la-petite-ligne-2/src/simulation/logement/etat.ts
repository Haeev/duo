/** État des logements: création à la première visite, confort, lectures pour l'interface et les quêtes. */
import type { Content, PlaceContent } from '../../donnees/charger';
import type { HousingDef, HousingFunction } from '../../donnees/schemas/logement';
import { initialBrickStates } from '../../etat/briques';
import type { PlayerState } from '../../etat/joueur';
import type { HousingState } from '../../etat/logement';
import type { PlaceState } from '../../etat/lieu';
import type { DeepReadonly, ReadonlyWorld } from '../../etat/monde';
import type { ReadPlace } from '../noyau/obstacles';
import { areaSlots } from '../sac/inventaire';
import { boxOf, decoOf, functionsOf, presentProps, roomState } from './pose';
import { HOUSING_TUNING } from './reglages';

/** Meubles de départ d'un logement, par type: l'inventaire (`stock`) et les meubles déjà posés. */
export function starterFurniture(def: HousingDef): Record<string, number> {
  const out: Record<string, number> = { ...def.stock };
  for (const piece of def.furnished ?? []) out[piece.prop] = (out[piece.prop] ?? 0) + 1;
  return out;
}

export function createHousingState(def: HousingDef, day: number): HousingState {
  const rooms: HousingState['rooms'] = {};
  for (const room of def.rooms)
    rooms[room.id] = { state: room.start, stage: 0, delivered: {}, paid: 0, work: 0 };
  return {
    rooms,
    stock: { ...def.stock },
    granted: starterFurniture(def),
    held: [null, null],
    decorating: [false, false],
    working: [null, null],
    comfort: 0,
    level: 0,
    sleptDay: day,
  };
}

/** Pose les meubles de départ (`furnished`) d'un logement neuf, comme une pose du mode déco. */
function placeStarters(content: Content, def: HousingDef, state: PlaceState): void {
  for (const piece of def.furnished ?? []) {
    const prop = content.props[piece.prop];
    if (prop === undefined) continue;
    const id = `pose-${String(state.nextPlacedId)}`;
    state.nextPlacedId += 1;
    state.placed.push({ id, type: piece.prop, x: piece.x, y: piece.y, rotation: piece.rotation });
    state.objects[id] = initialBrickStates(prop.bricks);
  }
}

/** Le logement ou les joueurs ont-ils au moins un meuble de ce type (rangé, posé, tenu, au sac) ? */
function owns(
  content: Content,
  players: readonly PlayerState[],
  state: PlaceState,
  hstate: HousingState,
  type: string,
): boolean {
  if ((hstate.stock[type] ?? 0) > 0) return true;
  if (state.placed.some((p) => p.type === type)) return true;
  if (hstate.held.some((h) => h?.type === type)) return true;
  return players.some((player) =>
    (['toolbar', 'bag'] as const).some((area) =>
      (areaSlots(player, area) ?? []).some(
        (stack) => stack !== null && content.items[stack.item]?.prop === type,
      ),
    ),
  );
}

/**
 * Rattrapage des meubles de départ: un logement d'une partie déjà commencée reçoit dans son
 * inventaire, une seule fois, ce que la fiche donne de plus que ce qu'il a déjà reçu. Un logement
 * d'avant le relevé (`granted` absent) a reçu chaque type qu'il possède encore quelque part; celui
 * qu'il n'a nulle part arrive. Vrai si quelque chose a changé.
 */
function grantStarters(
  content: Content,
  players: readonly PlayerState[],
  def: HousingDef,
  state: PlaceState,
  hstate: HousingState,
): boolean {
  const starters = starterFurniture(def);
  let changed = false;
  if (hstate.granted === undefined) {
    const granted: Record<string, number> = {};
    for (const [type, count] of Object.entries(starters))
      granted[type] = owns(content, players, state, hstate, type) ? count : 0;
    hstate.granted = granted;
    changed = true;
  }
  const granted = hstate.granted;
  for (const [type, count] of Object.entries(starters)) {
    const missing = count - (granted[type] ?? 0);
    if (missing <= 0) continue;
    hstate.stock[type] = (hstate.stock[type] ?? 0) + missing;
    granted[type] = count;
    changed = true;
  }
  return changed;
}

/**
 * Crée l'état des logements du lieu qui n'en ont pas encore (meubles de départ posés) et remet aux
 * autres les meubles de départ ajoutés depuis; vrai si quelque chose a changé.
 */
export function ensureHousings(
  content: Content,
  players: readonly PlayerState[],
  place: PlaceContent,
  state: PlaceState,
  day: number,
): boolean {
  let changed = false;
  for (const def of Object.values(place.housings)) {
    state.housing ??= {};
    const existing = state.housing[def.id];
    if (existing !== undefined) {
      if (grantStarters(content, players, def, state, existing)) changed = true;
      continue;
    }
    state.housing[def.id] = createHousingState(def, day);
    placeStarters(content, def, state);
    changed = true;
  }
  return changed;
}

/**
 * Un meuble pour se laver (fonction `wash`) attend dans l'inventaire d'un logement dont aucune pièce
 * n'en a en place (carte ou posé): son nom, pour l'aide de l'hygiène. `null` sinon.
 */
export function stowedWasher(content: Content, world: ReadonlyWorld): string | null {
  const washes = (type: string): boolean => {
    const prop = content.props[type];
    return prop !== undefined && functionsOf(prop).includes('wash');
  };
  for (const [id, pstate] of Object.entries(world.places)) {
    const place = content.places[id];
    if (place === undefined) continue;
    for (const def of Object.values(place.housings)) {
      const hstate = pstate.housing?.[def.id];
      if (hstate === undefined) continue;
      const stowed = Object.keys(hstate.stock).find(washes);
      if (stowed === undefined) continue;
      const inRoom = (at: { type: string; x: number; y: number; rotation: number }): boolean => {
        const prop = content.props[at.type];
        if (prop === undefined || !washes(at.type)) return false;
        const box = boxOf(prop, at);
        return def.rooms.some(
          (r) =>
            box.x0 < r.area.x + r.area.w &&
            r.area.x < box.x1 &&
            box.y0 < r.area.y + r.area.h &&
            r.area.y < box.y1,
        );
      };
      if (place.map.objects.some(inRoom) || pstate.placed.some(inRoom)) continue;
      return content.props[stowed]?.name ?? null;
    }
  }
  return null;
}

/** Ce que permettent les pièces restaurées (dormir, cuisiner, se laver, ranger). */
export function housingFunctions(
  def: HousingDef,
  state: DeepReadonly<HousingState> | undefined,
): HousingFunction[] {
  const out = new Set<HousingFunction>();
  for (const room of def.rooms)
    if (roomState(room, state) === 'restored') for (const f of room.unlocks) out.add(f);
  return [...out];
}

/** Confort: pièces restaurées et meubles posés; les copies au-delà de `fullCopies` comptent pour moitié. */
export function comfortOf(
  content: Content,
  place: PlaceContent,
  state: ReadPlace,
  def: HousingDef,
): number {
  const tuning = HOUSING_TUNING.comfort;
  const hstate = state.housing?.[def.id];
  let total = 0;
  for (const room of def.rooms) if (roomState(room, hstate) === 'restored') total += tuning.perRoom;
  const copies = new Map<string, number>();
  const placedIds = new Set(state.placed.map((p) => p.id));
  for (const present of presentProps(content, place, state, def, new Set())) {
    // Seuls les meubles des joueurs comptent: le décor de la carte n'est pas leur œuvre.
    if (!placedIds.has(present.instance.id)) continue;
    const n = (copies.get(present.def.id) ?? 0) + 1;
    copies.set(present.def.id, n);
    const value = decoOf(present.def).comfort;
    total += n <= tuning.fullCopies ? value : value / 2;
  }
  return Math.floor(total);
}

export function comfortLevel(comfort: number): number {
  let level = 0;
  for (const threshold of HOUSING_TUNING.comfort.tiers) if (comfort >= threshold) level += 1;
  return level;
}

/** Le logement d'un point du lieu (pièce ou jardin), pour le mode déco et le sommeil. */
export function housingAt(
  place: PlaceContent,
  state: ReadPlace,
  x: number,
  y: number,
): HousingDef | null {
  for (const def of Object.values(place.housings)) {
    const hstate = state.housing?.[def.id];
    for (const room of def.rooms) {
      const a = room.area;
      if (roomState(room, hstate) === 'absent') continue;
      if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return def;
    }
    const g = def.garden;
    if (g !== null && x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) return def;
  }
  return null;
}
