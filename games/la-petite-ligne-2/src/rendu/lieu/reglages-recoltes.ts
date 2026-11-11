/**
 * Ce que le rendu montre des récoltables (`recoltes.ts`): noms d'états du manifeste des décors,
 * repères des coins de pêche et des zones à insectes, végétation semée par tuile, objets au sol.
 * Aucun nom de modèle n'est écrit dans la logique: tout vient d'ici ou des données.
 */
import type { SurfaceKind } from './reglages-tuiles';

export interface HarvestLookSettings {
  readonly states: {
    readonly worked: string;
    readonly empty: string;
    readonly tilled: string;
    readonly watered: string;
  };
  readonly gone: string;
  readonly markers: {
    readonly fishing: string;
    readonly insects: string;
    readonly insectArea: number;
    readonly insectMax: number;
    readonly insectInset: number;
    /** Sols où un repère peut pousser (surface de `GROUND_LOOKS`): pas sur un ponton ni un pavé. */
    readonly soils: readonly SurfaceKind[];
    /** Distance (cases) jusqu'où chercher la berge d'un coin de pêche (un ponton s'enjambe). */
    readonly bankReach: number;
  };
  readonly ground: {
    readonly bundle: {
      readonly w: number;
      readonly d: number;
      readonly h: number;
      readonly cloth: string;
      readonly tie: string;
    };
    /** Échelle du modèle d'une ressource posé au sol: ce qu'on a pris est plus petit qu'en place. */
    readonly modelScale: number;
  };
  readonly semis: {
    readonly trees: readonly string[];
    readonly bushes: readonly string[];
    /** Côté (m) des morceaux de tuile instanciés à part: ce qui sort du champ n'est pas dessiné. */
    readonly chunk: number;
  };
}

export const HARVEST_LOOK: HarvestLookSettings = {
  /**
   * États du manifeste (`states` d'un modèle) lus dans l'état des briques. Le reste d'une
   * ressource récoltée (`after` de sa fiche: `stump`, `bare`) est lui-même un nom d'état.
   */
  states: {
    /** Ressource entamée, pas encore récoltée (rocher fendu, coups de hache). */
    worked: 'chipped',
    /** Stock d'une brique `gather` vide (pommier sans pommes, tas de bois vide). */
    empty: 'bare',
    /** Case du potager bêchée, puis arrosée du jour. */
    tilled: 'tilled',
    watered: 'watered',
  },
  /** Ce que laisse une ressource dont il ne reste rien (`after` de sa fiche): rien n'est dessiné. */
  gone: 'gone',
  /** Repères posés sur les zones des données (rien ne s'y vise ni ne cache personne). */
  markers: {
    /** Coin de pêche (`fishing` de `lieu.json`): un repère sur la berge, au plus près du milieu. */
    fishing: 'fishing-spot',
    /** Zone à insectes (`nature.json`): une touffe par tranche de `insectArea` m², 1 à `insectMax`. */
    insects: 'insect-spot',
    insectArea: 16,
    insectMax: 4,
    /** Recul de la touffe depuis le bord de la zone (m): elle reste dans les herbes de la zone. */
    insectInset: 1,
    soils: ['herbe', 'terre', 'sable'],
    bankReach: 3,
  },
  /** Objet posé au sol: le modèle de la ressource qui le donne, sinon un ballot encré commun. */
  ground: {
    /** Ballot: largeur, profondeur et hauteur (m), teinte de toile, teinte du lien. */
    bundle: { w: 0.34, d: 0.28, h: 0.24, cloth: '#c9a46a', tie: '#7a5a3a' },
    modelScale: 0.55,
  },
  /**
   * Végétation semée par tuile (rendu encré): modèles du manifeste tirés par place. Chaque nom est
   * une essence; ses variantes (`variants`) et ses écarts de pose (`jitter`) suivent.
   */
  semis: {
    trees: ['oak-tree', 'ash-tree', 'birch-tree'],
    bushes: ['berry-bush-bare'],
    chunk: 16,
  },
};
