/**
 * Nature du sol sous un point, pour le son des pas. Source la plus simple et déterministe:
 * les données du lieu (pièce d'un grand lieu: plancher; petit lieu: `floor` de la carte), sinon le
 * sol dessiné du dehors fourni par l'appelant. Logique pure, testée dans Node.
 */
import type { PlaceContent } from '../donnees/charger';
import { floorNatures } from '../rendu/lieu/sol';
import { DEFAULT_LOOK, GROUND_LOOKS } from '../rendu/lieu/reglages-tuiles';

/** Ce qu'on entend dans une pièce d'un grand lieu: son sol est dessiné en plancher. */
export const INTERIOR_SURFACE = 'bois';

type PlaceForSound = Pick<PlaceContent, 'map' | 'interiors'>;

/** Surface d'un point de `place`; `outdoor` donne celle du dehors (`null`: inconnue, herbe). */
export function surfaceUnder(
  place: PlaceForSound | undefined,
  x: number,
  y: number,
  outdoor: (x: number, y: number) => string | null,
  cache?: Map<PlaceForSound, readonly string[]>,
): string | null {
  if (place === undefined) return outdoor(x, y);
  for (const room of place.interiors) {
    const { x: ox, y: oy } = room.at;
    if (x >= ox && y >= oy && x <= ox + room.width && y <= oy + room.height)
      return INTERIOR_SURFACE;
  }
  const { floor, width, height, terrain } = place.map;
  if (floor !== undefined && terrain === undefined) {
    let natures = cache?.get(place);
    if (natures === undefined) {
      natures = floorNatures(floor, width, height);
      cache?.set(place, natures);
    }
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) return null;
    const nature = natures[cy * width + cx] ?? floor.nature;
    return (GROUND_LOOKS[nature] ?? DEFAULT_LOOK).surface;
  }
  return outdoor(x, y);
}

/** Résolveur pour `createGameAudio`: lit le lieu courant de la vue et garde les sols en cache. */
export function createSurfaceLookup(
  view: {
    readonly content: { readonly places: Readonly<Record<string, PlaceForSound>> };
    world(): { readonly common: { readonly place: string | null } } | null;
  },
  outdoor: (x: number, y: number) => string | null,
): (x: number, y: number) => string | null {
  const cache = new Map<PlaceForSound, readonly string[]>();
  return (x, y) => {
    const id = view.world()?.common.place ?? null;
    const place = id === null ? undefined : view.content.places[id];
    return surfaceUnder(place, x, y, outdoor, cache);
  };
}
