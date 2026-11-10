/**
 * Les espaces d'un lieu à l'écran: le dehors, et chaque pièce. Les pièces sont rangées côte à côte
 * sur la grille du lieu, hors du dehors (ADR 0022), mais à l'écran chacune est un monde clos: on
 * ne dessine que l'espace où se trouve le joueur local, et la vue reste dans ses bornes.
 * Logique pure.
 */
import type { MapBounds } from '../camera';
import { TILE_SETTINGS } from './reglages-tuiles';
import type { InteriorRect } from './terrain-rendu';

/** Identifiant de la pièce, `null`: le dehors. */
export type SpaceId = string | null;

export class Spaces {
  private readonly outdoor: Required<MapBounds>;

  constructor(
    map: {
      readonly width: number;
      readonly height: number;
      readonly outdoor?:
        | { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
        | undefined;
    },
    private readonly rooms: readonly InteriorRect[],
  ) {
    const o = map.outdoor;
    this.outdoor =
      o === undefined
        ? { x: 0, y: 0, width: map.width, height: map.height }
        : { x: o.x, y: o.y, width: o.w, height: o.h };
  }

  /**
   * L'espace qui contient ce point. `margin` (m) élargit les pièces: ce qui est posé sur un mur
   * (une porte sur son seuil) appartient à la pièce.
   */
  at(x: number, y: number, margin = 0): SpaceId {
    for (const room of this.rooms) {
      const { x: ox, y: oy } = room.at;
      if (
        x >= ox - margin &&
        y >= oy - margin &&
        x <= ox + room.width + margin &&
        y <= oy + room.height + margin
      )
        return room.id;
    }
    return null;
  }

  /**
   * Ce qui est posé en (x, y) se dessine-t-il quand on affiche `space` ? Une porte tient sur le
   * mur de sa pièce: la marge couvre l'épaisseur du mur et de son encadrement.
   */
  shows(space: SpaceId, x: number, y: number): boolean {
    return this.at(x, y, TILE_SETTINGS.interior.wallThickness + 0.3) === space;
  }

  /** Bornes de la vue dans cet espace: la pièce, ou le dehors du lieu. */
  bounds(space: SpaceId): Required<MapBounds> {
    const room = space === null ? undefined : this.rooms.find((r) => r.id === space);
    if (room === undefined) return this.outdoor;
    return { x: room.at.x, y: room.at.y, width: room.width, height: room.height };
  }
}
