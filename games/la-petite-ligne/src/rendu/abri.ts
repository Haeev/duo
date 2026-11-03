/**
 * Abri du joueur local (retour S05 du 2026-11-02: « il pleut dans la maisonnette alors que le
 * toit est bâti, et dans la mercerie »). Quand il est dans un intérieur couvert, la pluie ne
 * se dessine pas par-dessus la pièce et le plancher n'est ni mouillé ni semé de flaques.
 *
 * L'abri, ce sont les rectangles au sol du bâtiment: son emprise sur la carte et, pour la
 * maisonnette, les pièces bâties (cellier, chambre) une fois leur toit posé. Pas d'abri tant que
 * le toit de la maisonnette n'est pas réparé: il pleut dans la ruine.
 */
import { HOUSE_BUILDING, type GameMap, type Rect } from '../etat/carte';
import type { CharacterId, ReadonlyWorld } from '../etat/types';

/** Nombre de rectangles lus par les shaders (bâtiment, cellier, chambre). */
export const SHELTER_SLOTS = 3;
/** Élément de pièce qui la couvre (`donnees/pieces.json`). */
const ROOF_ELEMENT = 'roof';
/** Chantier du toit de la maisonnette. */
const HOUSE_ROOF = 'house_roof';

/** Rectangles couverts autour du joueur local (au plus `SHELTER_SLOTS`), vide s'il est dehors. */
export function shelterRects(world: ReadonlyWorld, map: GameMap, local: CharacterId): Rect[] {
  const inside = world.characters.find((character) => character.id === local)?.inside ?? null;
  if (inside === null) return [];
  const building = map.buildings[inside];
  if (building === undefined) return [];
  if (inside === HOUSE_BUILDING) {
    const roof = world.constructions.find((construction) => construction.id === HOUSE_ROOF);
    if (roof?.status !== 'done') return [];
  }
  const out: Rect[] = [];
  const prop = map.props.find((candidate) => candidate.id === building.prop);
  if (prop !== undefined && prop.rect !== null) out.push({ ...prop.rect });
  for (const room of building.rooms) {
    if (room.build === null || out.length >= SHELTER_SLOTS) continue;
    if (world.rooms[room.build.room]?.elementsBuilt.includes(ROOF_ELEMENT) === true) {
      out.push({ ...room.build.footprint });
    }
  }
  return out;
}
