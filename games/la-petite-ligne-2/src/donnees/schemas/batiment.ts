/**
 * `donnees/lieux/<lieu>/batiments/<id>.json`: la fiche d'un bâtiment, dont l'assembleur
 * (`assets-src/decors/batiments-aubrune/`) tire le modèle `assets/lieux/<lieu>/batiments/<id>.glb`.
 * L'identifiant est celui du bâtiment dans `buildings` de la carte du lieu. Le moteur lit le
 * manifeste `batiments.json` écrit à côté des modèles; de cette fiche, il ne lit que les niveaux
 * et l'`eclairage` (`rendu/lieu/eclairage.ts`). Les façades sont nommées dans le repère du monde
 * (le modèle se pose en rotation 0, au centre de l'emprise).
 */
import * as v from 'valibot';
import { FileVersionSchema, FiniteSchema, IdSchema, IntSchema } from './communs';

export const BUILDING_SIDES = ['nord', 'est', 'sud', 'ouest'] as const;
const Side = v.picklist(BUILDING_SIDES);

/** Ouvertures qu'une façade peut porter; `porte` désigne la porte d'entrée de la fiche. */
export const BUILDING_OPENINGS = [
  'fenetre',
  'fenetre-etroite',
  'fenetre-close',
  'fenetre-nue',
  'petite-fenetre',
  'vitrail',
  'abat-sons',
  'porte',
  'porte-service',
  'vitrine',
  'grange',
  'cochere',
  'baie',
] as const;
const OpeningKind = v.picklist(BUILDING_OPENINGS);

const Fraction = v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1));
const Metres = v.pipe(FiniteSchema, v.minValue(0.3), v.maxValue(30));
const Cells = v.pipe(IntSchema, v.minValue(2), v.maxValue(40));
const Tint = v.pipe(v.string(), v.regex(/^[a-z][a-z_]{1,30}$/));

/** Une ouverture: son nom seul, ou avec sa place (0 à 1 depuis la gauche vue de dehors) et ses cotes. */
const Opening = v.union([
  OpeningKind,
  v.strictObject({
    type: OpeningKind,
    position: v.exactOptional(Fraction),
    largeur: v.exactOptional(Metres),
    hauteur: v.exactOptional(Metres),
    /** Hauteur du bas du tableau: l'ouverture sort alors du rang (baie de clocher). */
    bas: v.exactOptional(Metres),
    linteau: v.exactOptional(v.picklist(['bois', 'pierre'])),
    /** Pourquoi une ouverture placée n'est pas au milieu de sa travée (sinon l'assembleur refuse). */
    raison: v.exactOptional(v.pipe(v.string(), v.minLength(10), v.maxLength(200))),
  }),
]);
const Openings = v.pipe(v.array(Opening), v.maxLength(8));

const Facade = v.strictObject({
  rdc: v.exactOptional(Openings),
  etage: v.exactOptional(Openings),
  etage2: v.exactOptional(Openings),
  pignon: v.exactOptional(Openings),
});

const Roof = v.strictObject({
  forme: v.picklist(['deux-pans', 'croupe', 'appentis']),
  /** Pente en degrés. */
  pente: v.exactOptional(v.pipe(FiniteSchema, v.minValue(10), v.maxValue(70))),
  /** Sens du faîtage d'un toit à deux pans; absent: le long du grand côté. */
  faitage: v.exactOptional(v.picklist(['est-ouest', 'nord-sud'])),
  /** Côté bas d'un appentis. */
  basVers: v.exactOptional(Side),
  debord: v.exactOptional(v.pipe(FiniteSchema, v.minValue(0.1), v.maxValue(1))),
  gouttieres: v.exactOptional(v.boolean()),
});

const Colours = v.strictObject({
  murs: v.exactOptional(Tint),
  toit: v.exactOptional(Tint),
  volets: v.exactOptional(Tint),
  porte: v.exactOptional(Tint),
  menuiseries: v.exactOptional(Tint),
  enseigne: v.exactOptional(Tint),
});

export const BUILDING_OPTIONS = [
  'cheminee',
  'lucarne',
  'enseigne',
  'auvent',
  'pendule',
  'drapeau',
  'roue',
  'bassin',
  'croix',
  'escalier',
  'contrefort',
  'bucher',
] as const;

/** Une option: la pièce, puis où elle se pose et ses cotes (voir le gabarit commenté). */
const Option = v.strictObject({
  piece: v.picklist(BUILDING_OPTIONS),
  /** `fronton`: l'horloge (`pendule`) monte dans un fronton au-dessus de l'égout. */
  forme: v.exactOptional(v.picklist(['souche', 'four', 'potence', 'bandeau', 'fronton'])),
  facade: v.exactOptional(Side),
  position: v.exactOptional(Fraction),
  hauteur: v.exactOptional(Metres),
  largeur: v.exactOptional(Metres),
  profondeur: v.exactOptional(Metres),
  longueur: v.exactOptional(Metres),
  diametre: v.exactOptional(Metres),
  accroche: v.exactOptional(Metres),
  monte: v.exactOptional(Metres),
  sommet: v.exactOptional(Metres),
  ecart: v.exactOptional(FiniteSchema),
  enfonce: v.exactOptional(v.pipe(FiniteSchema, v.minValue(0), v.maxValue(2))),
  x: v.exactOptional(FiniteSchema),
  y: v.exactOptional(FiniteSchema),
  rotation: v.exactOptional(v.picklist([0, 90, 180, 270])),
});

/** Ce qu'un corps de bâtiment décrit: le corps principal comme chaque annexe. */
const body = {
  /** Place du corps dans l'emprise (coin nord-ouest, en mètres); absent: toute l'emprise. */
  place: v.exactOptional(
    v.strictObject({
      x: v.pipe(FiniteSchema, v.minValue(0)),
      y: v.pipe(FiniteSchema, v.minValue(0)),
      largeur: Metres,
      profondeur: Metres,
    }),
  ),
  niveaux: v.pipe(IntSchema, v.minValue(1), v.maxValue(3)),
  /** Hauteur des murs sous l'égout; absente: 0,4 + 2,3 m par niveau. */
  hauteurMurs: v.exactOptional(v.pipe(FiniteSchema, v.minValue(2), v.maxValue(20))),
  /** `poteaux`: corps ouvert, toit porté par des poteaux (lavoir, halle). */
  murs: v.exactOptional(v.picklist(['pleins', 'poteaux'])),
  finition: v.picklist(['crepi', 'pierre', 'bardage']),
  couleurs: v.exactOptional(Colours),
  toit: Roof,
  facades: v.exactOptional(
    v.strictObject({
      nord: v.exactOptional(Facade),
      est: v.exactOptional(Facade),
      sud: v.exactOptional(Facade),
      ouest: v.exactOptional(Facade),
    }),
  ),
  /** Façades sans mur (mitoyenneté entre deux corps). */
  sansMur: v.exactOptional(v.array(Side)),
  options: v.exactOptional(v.pipe(v.array(Option), v.maxLength(16))),
};

const Minute = v.pipe(IntSchema, v.minValue(0), v.maxValue(1440));

/**
 * Éclairage propre d'un bâtiment sans habitant ni commerce pour l'allumer (gare, église): des
 * plages d'heures où ses fenêtres sont éclairées de l'intérieur. Un commerce s'éclaire à ses
 * heures d'ouverture et une maison selon le planning de ses habitants, sans rien écrire ici.
 */
export const BuildingLightingSchema = v.pipe(
  v.array(
    v.strictObject({
      /** Plage en minutes depuis minuit (`de` inclus, `a` exclu; elle peut passer minuit). */
      de: Minute,
      a: Minute,
      /** Niveaux éclairés; absent: le rez-de-chaussée. */
      niveau: v.exactOptional(v.picklist(['rdc', 'etage', 'tout'])),
      /** Force de 0 à 1 (une veilleuse: 0,4); absente: 1. */
      force: v.exactOptional(Fraction),
      pourquoi: v.pipe(v.string(), v.minLength(10), v.maxLength(200)),
    }),
  ),
  v.maxLength(6),
);
export type BuildingLighting = v.InferOutput<typeof BuildingLightingSchema>;

export const BuildingSheetSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  nom: v.pipe(v.string(), v.minLength(1), v.maxLength(60)),
  /** Le détail propre qui fait reconnaître le bâtiment de haut, et pourquoi il est ainsi. */
  detail: v.pipe(v.string(), v.minLength(1), v.maxLength(300)),
  /** Emprise au sol en cases de 1 m: largeur d'ouest en est, profondeur du nord au sud. */
  emprise: v.strictObject({ largeur: Cells, profondeur: Cells }),
  /** Budget de triangles; absent: 6 000. */
  budget: v.exactOptional(v.pipe(IntSchema, v.minValue(500), v.maxValue(15000))),
  /** La porte d'entrée, donnée sur l'emprise: façade, place de 0 à 1 depuis la gauche vue de dehors. */
  porte: v.exactOptional(
    v.strictObject({
      facade: Side,
      position: Fraction,
      modele: v.picklist(['pleine', 'vitree', 'grange', 'cochere', 'baie', 'ouverte']),
      largeur: v.exactOptional(Metres),
      hauteur: v.exactOptional(Metres),
    }),
  ),
  ...body,
  eclairage: v.exactOptional(BuildingLightingSchema),
  annexes: v.exactOptional(
    v.pipe(
      v.array(
        v.strictObject({ nom: v.pipe(v.string(), v.minLength(1), v.maxLength(40)), ...body }),
      ),
      v.maxLength(4),
    ),
  ),
});
export type BuildingSheet = v.InferOutput<typeof BuildingSheetSchema>;

/** Ouverture vitrée: milieu de l'appui sur le nu du mur (m depuis le centre de l'emprise), cotes, normale. */
const Glazing = v.object({
  x: FiniteSchema,
  appui: FiniteSchema,
  z: FiniteSchema,
  largeur: FiniteSchema,
  hauteur: FiniteSchema,
  nx: FiniteSchema,
  nz: FiniteSchema,
});

/** Entrée du manifeste `assets/lieux/<lieu>/batiments/batiments.json`: ce que le rendu lit. */
export const BuildingManifestSchema = v.object({
  format: v.literal('duo-batiments/1'),
  lieu: IdSchema,
  materiaux: v.array(v.string()),
  batiments: v.record(
    IdSchema,
    v.object({
      fichier: v.string(),
      noeud: IdSchema,
      nom: v.string(),
      emprise: v.strictObject({ largeur: Cells, profondeur: Cells }),
      triangles: IntSchema,
      budget: IntSchema,
      octets: IntSchema,
      hauteur: FiniteSchema,
      /** Seuil de la porte, en mètres depuis le centre de l'emprise (x est, z sud). */
      porte: v.nullable(
        v.object({ facade: Side, position: Fraction, x: FiniteSchema, z: FiniteSchema }),
      ),
      /** Fenêtres du rez-de-chaussée: celles qui jettent leur lumière dehors la nuit. */
      fenetres: v.array(Glazing),
      /**
       * Autres ouvertures vitrées du rez-de-chaussée (devanture, porte à carreaux, vitrail):
       * éclairées, elles jettent aussi leur lumière dehors; les pièces n'en font pas des fenêtres.
       */
      lueurs: v.optional(v.array(Glazing)),
    }),
  ),
});
export type BuildingManifest = v.InferOutput<typeof BuildingManifestSchema>;
