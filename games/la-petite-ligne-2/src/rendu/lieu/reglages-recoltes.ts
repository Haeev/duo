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
    /** Jour laissé entre un objet au sol et le meuble dont il a été sorti (m). */
    readonly clearGap: number;
    /** Hauteur (m) à partir de laquelle un meuble cache un objet au sol posé dans son emprise. */
    readonly hideHeight: number;
  };
  readonly semis: {
    readonly trees: readonly string[];
    readonly bushes: readonly string[];
    /** Côté (m) des morceaux de tuile instanciés à part: ce qui sort du champ n'est pas dessiné. */
    readonly chunk: number;
    /**
     * Version allégée d'un arbre semé: l'état du manifeste qui la porte (`state`), la distance au
     * couloir de jeu (cases) au-delà de laquelle elle remplace l'arbre entier (`beyond`), et son
     * emploi comme ombre portée des arbres entiers (`shadow`), rétrécie de `shadowShrink` pour
     * rester sous leur feuillage. `null`: tous les arbres entiers, ombre comprise.
     */
    readonly light: {
      readonly state: string;
      readonly beyond: number;
      readonly shadow: boolean;
      readonly shadowShrink: number;
      /** Côté (m) des morceaux de tuile où se rangent les ombres portées. */
      readonly shadowChunk: number;
      /**
       * État du manifeste qui porte l'ombre d'un arbre du fond du bois (forme sans festons, jamais
       * dessinée); `null`: sa version allégée la porte elle-même.
       */
      readonly deepShadow: string | null;
      /**
       * Faux: au fond du bois, une seule forme allégée par essence (celle du modèle de base), au
       * lieu d'une par variante: moitié moins d'appels de dessin, le cap et la taille varient encore.
       */
      readonly variants: boolean;
    } | null;
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
    /** Un objet au sol ne reste jamais dans l'emprise d'un meuble: on ne le verrait plus. */
    clearGap: 0.06,
    hideHeight: 0.35,
  },
  /**
   * Végétation semée par tuile (rendu encré): modèles du manifeste tirés par place. Chaque nom est
   * une essence; ses variantes (`variants`) et ses écarts de pose (`jitter`) suivent.
   */
  semis: {
    trees: ['oak-tree', 'ash-tree', 'birch-tree'],
    bushes: ['berry-bush-bare'],
    /**
     * 8 m. Un morceau qui touche le champ (ou la carte d'ombre) est dessiné en entier: à 16 m, le
     * bois le plus dense coûtait 359 000 triangles par image au lieu de 277 000.
     */
    chunk: 8,
    /**
     * Budget du bois (plancher de 30 images par seconde sur Intel UHD 620): au-delà de `beyond`
     * cases hors du couloir de jeu, personne ne voit un arbre de près, il prend sa version
     * allégée (état `far`: même silhouette, moitié moins de triangles); et l'ombre des arbres
     * entiers est portée par cette même version, jamais dessinée (la carte d'ombre ne distingue
     * pas les deux).
     */
    light: {
      state: 'far',
      beyond: 3,
      shadow: true,
      shadowShrink: 0.96,
      shadowChunk: 16,
      deepShadow: 'shade',
      variants: false,
    },
  },
};
