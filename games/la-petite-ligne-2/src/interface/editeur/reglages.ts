/**
 * Réglages de l'éditeur de personnage (interface 5.8, cahier 1.5): rayons, règles des
 * emplacements, réserves. Aucune pièce n'est nommée ici: les rayons regroupent des emplacements,
 * le catalogue fournit les pièces. Une pièce ajoutée au catalogue paraît d'elle-même.
 */
import type { Gender, Slot } from '../../donnees/schemas/personnage';

/** Ce qu'un rayon montre, dans l'ordre: des choix du corps, ou les pièces d'un emplacement. */
export type EditorSection =
  | { readonly kind: 'gender' }
  | { readonly kind: 'shape' }
  | { readonly kind: 'height' }
  | { readonly kind: 'skin' }
  | { readonly kind: 'slot'; readonly slot: Slot };

export interface EditorCategory {
  readonly id: string;
  readonly sections: readonly EditorSection[];
  /** Angle du personnage quand le rayon s'ouvre (rad, 0: de face); absent: trois quarts avant. */
  readonly yaw?: number;
}

export const EDITOR_SETTINGS = {
  /** Rayons, en signets à images; un rayon sans aucune pièce au catalogue est masqué. */
  categories: [
    {
      id: 'corps',
      sections: [{ kind: 'gender' }, { kind: 'shape' }, { kind: 'height' }, { kind: 'skin' }],
    },
    {
      id: 'visage',
      sections: [
        { kind: 'slot', slot: 'head' },
        { kind: 'slot', slot: 'glasses' },
      ],
    },
    { id: 'cheveux', sections: [{ kind: 'slot', slot: 'hair' }], yaw: 2.2 },
    { id: 'haut', sections: [{ kind: 'slot', slot: 'top' }] },
    {
      id: 'bas',
      sections: [
        { kind: 'slot', slot: 'bottom' },
        { kind: 'slot', slot: 'dress' },
      ],
    },
    { id: 'pieds', sections: [{ kind: 'slot', slot: 'shoes' }] },
    { id: 'coiffe', sections: [{ kind: 'slot', slot: 'hat' }], yaw: 1.0 },
    { id: 'accessoire', sections: [{ kind: 'slot', slot: 'accessory' }] },
  ] as readonly EditorCategory[],

  /** Emplacements qu'on peut laisser vides (une case « sans »). */
  optional: ['hair', 'hat', 'glasses', 'accessory'] as readonly Slot[],
  /** Choisir une pièce de la clé retire celles des emplacements listés (robe contre haut et bas). */
  exclusive: { dress: ['top', 'bottom'], top: ['dress'], bottom: ['dress'] } as Readonly<
    Partial<Record<Slot, readonly Slot[]>>
  >,

  /** Âges permis aux joueurs (cahier 1.5: deux adultes). */
  playerAges: ['adult'] as readonly string[],
  /** Étiquette d'une pièce réservée aux habitants (bible 3.4, marque H): masquée ici. */
  villagerOnlyTag: 'habitants',
  /**
   * Teintes réservées aux joueurs (bible 2.4): montrées ici seulement, à la fin de la rangée.
   * Elles ne paraissent que si le catalogue les porte dans la zone (sinon rien à montrer).
   */
  playerOnlyColors: ['#3e5578', '#a65c7c', '#6f8f5a'] as readonly string[],

  /** Tailles proposées (cm), dans la fourchette des joueurs (bible 2.2: 1,60 à 1,80 m). */
  heights: [160, 165, 170, 175, 180] as readonly number[],
  /** Silhouette d'une morphologie selon le genre: la morphose `f` ou `m` (morphologies.json). */
  genderMorph: { f: 'f', m: 'm' } as Readonly<Record<Gender, string>>,

  /** Au hasard: chance d'une robe plutôt que haut et bas, et de laisser vide un emplacement facultatif. */
  randomDress: 0.3,
  randomOptional: { hair: 0.08, other: 0.5 },

  /** Mise en page: colonnes de la grille des pièces, pastilles par rangée. */
  columns: 6,
  swatchesPerRow: 12,
  /** Angle par défaut à l'ouverture d'un rayon: trois quarts avant (rad). */
  frontYaw: 0.35,
  /** Rotation au clavier (rad par seconde) et au glissé (rad par pixel). */
  turnPerSecond: 2.6,
  turnPerPixel: 0.012,
  /** Couleurs de profil quand Duo n'en donne pas (démonstration): pièces de départ du look. */
  fallbackAccents: ['#d9654f', '#4f8fd9'] as const,
  /** Longueur maximale du prénom (contrat `LabelSchema`). */
  nameMax: 20,
} as const;

export type EditorSettings = typeof EDITOR_SETTINGS;
