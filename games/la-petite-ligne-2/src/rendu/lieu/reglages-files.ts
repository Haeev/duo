/**
 * Données des files et des repères livrés (rendu encré des grands lieux): quelles cases portent
 * une haie, un talus ou un rang de culture, avec quels modules du manifeste des décors, et quel
 * modèle montre chaque nature de repère de la carte (`landmarks.kind`). Aucun nom de modèle dans
 * le moteur: une sorte de plus est une entrée ici (recette dans le README du dossier).
 *
 * Directions d'un module, dans son propre repère (avant la rotation): `w` et `e` le long de x,
 * `n` vers -z, `s` vers +z; `ne`, `nw`, `se`, `sw` pour les coins.
 */

export type Side4 = 'n' | 's' | 'e' | 'w';
export type Side8 = Side4 | 'ne' | 'nw' | 'se' | 'sw';

/** Un module d'une file: son modèle (ses variantes viennent du manifeste) et ses raccords. */
export interface RunModule {
  readonly model: string;
  /** Côtés où la file continue dans la case voisine (le profil ouvert du module). */
  readonly links: readonly Side4[];
  /**
   * Côtés (coins compris) qui doivent donner sur une nature de `facing` (l'eau d'un talus); un
   * côté dont seul un coin y touche compte à moitié (une berge en escalier).
   */
  readonly facing?: readonly Side8[];
  /** Peut se poser en miroir (est et ouest échangés): le bout d'un talus, à gauche comme à droite. */
  readonly mirror?: boolean;
}

/** Une sorte de file: les cases qu'elle prend et les modules qui la dessinent. */
export interface RunSort {
  readonly pourquoi: string;
  /** Natures dessinées des cases prises (`GroundField.names`). */
  readonly on: readonly string[];
  /** Au moins une des huit voisines (coins compris) est de l'une de ces natures. */
  readonly near?: readonly string[];
  /** Aucune des quatre voisines n'est de ces natures (elles ont leur propre habillage). */
  readonly notNear?: readonly string[];
  /** Une colonne (`x`) ou une rangée (`y`) sur `step`: les rangs du labour. */
  readonly every?: { readonly axis: 'x' | 'y'; readonly step: number };
  /** Natures vers lesquelles un module tourne ses côtés `facing`. */
  readonly facing?: readonly string[];
  /**
   * Du plus courant au plus rare: à égalité, le premier l'emporte. Vide: la sorte réserve ses
   * cases (ni boîte ni autre file) sans rien y poser, parce que le relief du sol les dessine.
   */
  readonly modules: readonly RunModule[];
  /** Modules grossis en travers de la file et en hauteur (parts; 1: tels que livrés). */
  readonly scale?: { readonly across: number; readonly up: number };
  /**
   * Ligne du dessus inégale: la hauteur de chaque sommet varie de `amount` (part) selon un bruit
   * lisse de `span` m tiré de sa place, continu d'un module à l'autre et d'une tuile à l'autre.
   */
  readonly crest?: { readonly amount: number; readonly span: number };
}

/**
 * Sortes de files, dans l'ordre de priorité: une case appartient à la première qui la prend
 * (une lisière au bord de l'eau est un talus, pas une haie; ce talus est une berge du relief,
 * `reglages-relief.ts`, les modules `bank*` du manifeste ne sont plus posés). Les clôtures de la voie restent à
 * `fenceRuns` (modèle `decor.fenceModel`).
 */
export const RUN_SORTS: Readonly<Record<string, RunSort>> = {
  talus: {
    pourquoi:
      "la berge d'une lisière qui touche l'eau: ni haie ni module, le relief du sol y descend en talus (terre, pierres, racines) le long de la ligne d'eau lissée, qu'un module d'un mètre posé d'équerre ne peut pas suivre",
    on: ['lisiere'],
    near: ['eau'],
    modules: [],
  },
  haie: {
    pourquoi: 'la lisière qui ferme un pré, partout où elle ne borde ni l’eau ni la voie',
    on: ['lisiere'],
    notNear: ['eau', 'voie'],
    modules: [
      { model: 'hedge', links: ['w', 'e'] },
      { model: 'hedge-end', links: ['w'] },
      { model: 'hedge-corner', links: ['w', 'n'] },
    ],
    crest: { amount: 0.28, span: 1.9 },
  },
  rang: {
    pourquoi:
      'les rangs nord-sud du labour, sur la crête d’un billon sur deux (on marche dans le creux), assez fournis pour se lire de la caméra de jeu',
    on: ['labour'],
    every: { axis: 'x', step: 2 },
    modules: [{ model: 'field-row', links: ['n', 's'] }],
    scale: { across: 1.7, up: 1.6 },
  },
};

/** Comment un repère s'oriente, d'après les données du lieu. */
export type LandmarkFacing =
  /** Avant (+z) vers le point le plus proche d'une voie à ciel ouvert. */
  | { readonly rule: 'toward-rail' }
  /** Axe z le long de la voie à ciel ouvert la plus proche, avant tourné vers elle (bouche d'un tunnel). */
  | { readonly rule: 'along-rail' }
  /** Axe x le long de l'eau autour du repère (`radius` cases), avant (+z) vers le sud (la caméra). */
  | { readonly rule: 'along-water'; readonly radius: number }
  /** Cap fixe (radians): la face que le modèle montre déjà au sud. */
  | { readonly rule: 'fixed'; readonly yaw: number };

/** Le modèle d'une nature de repère, sa pose et son emprise. */
export interface LandmarkLook {
  readonly pourquoi: string;
  readonly model: string;
  readonly facing: LandmarkFacing;
  /** Cap arrondi au quart de tour le plus proche (un ouvrage parallèle au bourg). */
  readonly snap?: boolean;
  /** Enfoncement sous le sol (m), en plus de celui du relief: rien ne flotte sur une pente. */
  readonly sink: number;
  /** Mis à la hauteur du repère (`height` de la carte) au lieu de la sienne. */
  readonly fitHeight?: boolean;
}

/** Natures de repère (`landmarks.kind` de la carte) dessinées par un modèle livré. */
export const LANDMARK_LOOKS: Readonly<Record<string, LandmarkLook>> = {
  'chateau-d-eau': {
    pourquoi: 'réservoir des locomotives: sa vidange regarde la voie',
    model: 'water-tower',
    facing: { rule: 'toward-rail' },
    snap: true,
    sink: 0.1,
  },
  'grue-a-eau': {
    pourquoi:
      'en face du château d’eau, au bord de la voie: son bras pivote au-dessus de la locomotive',
    model: 'water-crane',
    facing: { rule: 'toward-rail' },
    snap: true,
    sink: 0.05,
  },
  signal: {
    pourquoi: 'le sémaphore montre son bras à la voie qu’il ferme',
    model: 'semaphore',
    facing: { rule: 'toward-rail' },
    snap: true,
    sink: 0.1,
  },
  roue: {
    pourquoi: 'la roue tourne dans le courant: son axe en travers du bief, sa face au sud',
    model: 'mill-wheel',
    facing: { rule: 'along-water', radius: 6 },
    snap: true,
    sink: 0,
  },
  portail: {
    pourquoi: 'la voie entre dans l’arc: la bouche regarde la ligne qui arrive',
    model: 'tunnel-portal',
    facing: { rule: 'along-rail' },
    sink: 0.3,
  },
  pigeonnier: {
    pourquoi: 'la lucarne d’envol est au sud, au soleil',
    model: 'dovecote',
    facing: { rule: 'fixed', yaw: 0 },
    sink: 0.1,
  },
};
