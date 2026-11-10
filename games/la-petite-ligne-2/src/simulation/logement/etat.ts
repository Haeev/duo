/** État des logements: création à la première visite, confort, lectures pour l'interface et les quêtes. */
import type { Content, PlaceContent } from '../../donnees/charger';
import type { HousingDef, HousingFunction } from '../../donnees/schemas/logement';
import type { HousingState } from '../../etat/logement';
import type { PlaceState } from '../../etat/lieu';
import type { DeepReadonly } from '../../etat/monde';
import type { ReadPlace } from '../noyau/obstacles';
import { decoOf, presentProps, roomState } from './pose';
import { HOUSING_TUNING } from './reglages';

export function createHousingState(def: HousingDef, day: number): HousingState {
  const rooms: HousingState['rooms'] = {};
  for (const room of def.rooms)
    rooms[room.id] = { state: room.start, stage: 0, delivered: {}, paid: 0, work: 0 };
  return {
    rooms,
    stock: { ...def.stock },
    held: [null, null],
    decorating: [false, false],
    working: [null, null],
    comfort: 0,
    level: 0,
    sleptDay: day,
  };
}

/** Crée l'état des logements du lieu qui n'en ont pas encore; vrai si quelque chose a changé. */
export function ensureHousings(place: PlaceContent, state: PlaceState, day: number): boolean {
  let changed = false;
  for (const def of Object.values(place.housings)) {
    state.housing ??= {};
    if (state.housing[def.id] !== undefined) continue;
    state.housing[def.id] = createHousingState(def, day);
    changed = true;
  }
  return changed;
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
