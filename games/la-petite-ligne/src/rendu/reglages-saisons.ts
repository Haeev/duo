/**
 * Réglages du rendu des saisons (tour 8, sections 2.2, 2.5 et 3.4 de la conception): texture de
 * palette, lever et fin du jour, hauteur du soleil, brume du matin. Le rendu garde ses courbes de
 * la journée (`reglages-ambiance.ts`) et les lit à travers une déformation de l'heure par saison
 * (`saisons.ts`): au printemps, rien ne change.
 *
 * Heures en minutes depuis minuit.
 */
import type { Season } from '../donnees/types';

export interface SeasonLook {
  /** Texture de couleur de la palette commune (`assets/modeles/textures/`, même disposition). */
  palette: string;
  /** Heure réelle où la lumière est celle de la clé du lever (`anchors.sunrise`). */
  sunrise: number;
  /** Heure réelle où la lumière est celle de la clé de fin du jour (`anchors.dayEnd`). */
  dayEnd: number;
  /** Facteur sur la hauteur du soleil (le jour; la lune garde la sienne). */
  sunElevationScale: number;
}

export const SEASON_RENDER_SETTINGS = {
  seasons: {
    spring: { palette: 'palette.png', sunrise: 330, dayEnd: 1230, sunElevationScale: 1 },
    summer: { palette: 'palette-ete.png', sunrise: 300, dayEnd: 1290, sunElevationScale: 1.1 },
    autumn: { palette: 'palette-automne.png', sunrise: 390, dayEnd: 1170, sunElevationScale: 0.85 },
    winter: { palette: 'palette-hiver.png', sunrise: 435, dayEnd: 1080, sunElevationScale: 0.7 },
  } satisfies Record<Season, SeasonLook>,
  /**
   * Ancres de la déformation, sur l'heure des courbes: le lever (clé de 5 h 30), le plein jour
   * (13 h, qui ne bouge jamais) et la fin du jour (clé de 20 h 30).
   */
  anchors: { sunrise: 330, noon: 780, dayEnd: 1230 },
  /**
   * Brume du matin (`world.morningMist`): la brume au ras du sol des courbes est portée au moins
   * à `level` tant que `mistAmount` vaut 1 (jusqu'à 9 h), puis suit sa levée jusqu'à 10 h 30.
   */
  morningMist: {
    level: 0.6,
    /**
     * Nappe basse (`ciel.ts`, sprites couchés à plat comme les bancs de l'aube): bancs semés sur
     * l'eau et l'herbe basse de ces zones de la carte (l'Aubrune et le pré de l'est), seulement
     * les matins de brume.
     */
    zones: ['river', 'meadow'],
    banks: 46,
    /** Demi-côté d'un banc (m), hauteur au-dessus du sol (m), opacité au centre. */
    size: 3.6,
    height: 0.25,
    opacity: 0.42,
  },
} as const;
