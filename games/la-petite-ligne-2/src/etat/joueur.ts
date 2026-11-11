/**
 * Tranche « joueurs ». Les champs lents (sac, argent, apparence, geste, dialogue) partent quand
 * ils changent, au pas même; `body`, `needs` et `stamina` bougent à chaque pas et partent sur le canal rapide.
 */
import * as v from 'valibot';
import {
  CentsSchema,
  FiniteSchema,
  GaugeSchema,
  IdSchema,
  IntSchema,
  LabelSchema,
  TickSchema,
} from '../donnees/schemas/communs';
import { NeedStateSchema } from '../donnees/schemas/besoins';
import { GenderSchema, LookSchema } from '../donnees/schemas/personnage';
import { StaminaModsField, StaminaValueField } from './endurance';

/** Une pile dans une case. `wear`: usages restants d'un outil amélioré (absent: sans usure). */
export const StackSchema = v.strictObject({
  item: IdSchema,
  count: v.pipe(IntSchema, v.minValue(1), v.maxValue(99)),
  wear: v.exactOptional(v.pipe(IntSchema, v.minValue(0))),
});
export type Stack = v.InferOutput<typeof StackSchema>;

const SlotsSchema = v.pipe(v.array(v.nullable(StackSchema)), v.maxLength(40));

export const BodySchema = v.strictObject({
  x: FiniteSchema,
  y: FiniteSchema,
  /** Cap en radians: 0 vers l'est, PI/2 vers le sud (convention de l'ancien jeu). */
  facing: FiniteSchema,
  /** Vitesse au sol (m/s), pour l'animation. */
  speed: FiniteSchema,
});
export type Body = v.InferOutput<typeof BodySchema>;

export const NeedsSchema = v.strictObject({
  hunger: GaugeSchema,
  sleep: GaugeSchema,
  hygiene: GaugeSchema,
});
export type Needs = v.InferOutput<typeof NeedsSchema>;

/** Geste en cours: l'animation, ce qu'il vise et le pas où il finit. */
export const GestureSchema = v.strictObject({
  clip: IdSchema,
  /** Objet de la carte ou habitant visé, `null` pour un geste sans cible (manger). */
  target: v.nullable(IdSchema),
  until: TickSchema,
  /** Geste long: une direction l'interrompt. */
  long: v.boolean(),
});

export const TalkSchema = v.strictObject({
  villager: IdSchema,
  dialogue: IdSchema,
  /** Nœud affiché (une réplique ou un choix); le défilement du texte est local. */
  node: IdSchema,
});

/**
 * Cran d'aide des mini-jeux, choisi par chaque joueur dans ses réglages (cahier 2.4, CA-23):
 * Normal, Coup de pouce, Grand coup de pouce. L'hôte l'applique (`simulation/aide`).
 */
export const ASSIST_LEVELS = ['normal', 'nudge', 'big'] as const;
export const AssistLevelSchema = v.picklist(ASSIST_LEVELS);
export type AssistLevel = v.InferOutput<typeof AssistLevelSchema>;

const slow = {
  /** Identifiant de membre du duo: le personnage suit le joueur, jamais le rôle d'hôte ou d'invité. */
  member: v.pipe(v.string(), v.maxLength(64)),
  name: LabelSchema,
  /** `null` tant que le personnage n'est pas créé dans l'éditeur. */
  look: v.nullable(LookSchema),
  /**
   * Genre choisi à la création (décision du client du 2026-11-10): il règle les accords des textes
   * et la silhouette de départ (`start.shapes`), rien d'autre; toutes les pièces vont à tous.
   * `null` tant que le personnage n'est pas créé.
   */
  gender: v.nullable(GenderSchema),
  /** Bourse du joueur, en centimes d'euro (réponse 10: chacun la sienne). */
  money: CentsSchema,
  /** La barre: toujours là, même sans sac. */
  toolbar: SlotsSchema,
  /** Sac possédé (`sacs.json`) et ses cases; `null`: pas encore de sac. */
  bag: v.nullable(v.strictObject({ id: IdSchema, slots: SlotsSchema })),
  /** Case de la barre en main, `null`: mains libres. */
  selected: v.nullable(v.pipe(IntSchema, v.minValue(0), v.maxValue(9))),
  /** Palier de chaque besoin: l'interface ne montre une jauge que quand il change. */
  tiers: v.strictObject({
    hunger: NeedStateSchema,
    sleep: NeedStateSchema,
    hygiene: NeedStateSchema,
  }),
  /** Essoufflement et renforts d'endurance (`etat/endurance.ts`); la jauge part sur le canal rapide. */
  staminaMods: StaminaModsField,
  gesture: v.nullable(GestureSchema),
  talk: v.nullable(TalkSchema),
  /** Ce que vise la touche d'action (objet de la carte ou habitant), calculé par la simulation. */
  aim: v.nullable(IdSchema),
  /** Cran d'aide envoyé par sa machine (`set_assist`); absent: « normal » (parties d'avant). */
  assist: v.exactOptional(AssistLevelSchema),
} as const;

/** Ce qui part dans la tranche « joueurs ». */
export const PlayerSlowSchema = v.strictObject(slow);
export type PlayerSlow = v.InferOutput<typeof PlayerSlowSchema>;

export const PlayerSchema = v.strictObject({
  ...slow,
  body: BodySchema,
  needs: NeedsSchema,
  stamina: StaminaValueField,
});
export type PlayerState = v.InferOutput<typeof PlayerSchema>;

/**
 * Les champs lents d'un joueur (copie de surface): tout, sauf ce qui part sur le canal rapide. Un
 * champ ajouté au joueur est donc transmis sans rien écrire ici (une liste écrite à la main
 * laisserait un champ facultatif de côté sans erreur de type).
 */
export function slowOf(player: PlayerState): PlayerSlow {
  return withoutFields(player, ['body', 'needs', 'stamina']);
}

/** Copie de surface sans les champs nommés (ceux du canal rapide). */
export function withoutFields<T extends object, K extends keyof T>(
  value: T,
  fields: readonly K[],
): Omit<T, K> {
  const copy: Omit<T, K> & Partial<Pick<T, K>> = { ...value };
  for (const field of fields) Reflect.deleteProperty(copy, field);
  return copy;
}
