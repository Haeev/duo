/**
 * Tranche « joueurs ». Les champs lents (sac, argent, apparence, geste, dialogue) partent quand
 * ils changent, au pas même; `body` et `needs` bougent à chaque pas et partent sur le canal rapide.
 */
import * as v from 'valibot';
import {
  CountSchema,
  FiniteSchema,
  GaugeSchema,
  IdSchema,
  IntSchema,
  LabelSchema,
  TickSchema,
} from '../donnees/schemas/communs';
import { NeedStateSchema } from '../donnees/schemas/besoins';
import { GenderSchema, LookSchema } from '../donnees/schemas/personnage';

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
  /** Bourse du joueur, en euros entiers (réponse 10: chacun la sienne). */
  money: CountSchema,
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
  gesture: v.nullable(GestureSchema),
  talk: v.nullable(TalkSchema),
  /** Ce que vise la touche d'action (objet de la carte ou habitant), calculé par la simulation. */
  aim: v.nullable(IdSchema),
} as const;

/** Ce qui part dans la tranche « joueurs ». */
export const PlayerSlowSchema = v.strictObject(slow);
export type PlayerSlow = v.InferOutput<typeof PlayerSlowSchema>;

export const PlayerSchema = v.strictObject({ ...slow, body: BodySchema, needs: NeedsSchema });
export type PlayerState = v.InferOutput<typeof PlayerSchema>;

/** Les champs lents d'un joueur, dans l'ordre du schéma (copie de surface). */
export function slowOf(player: PlayerState): PlayerSlow {
  const { member, name, look, gender, money, toolbar, bag, selected, tiers, gesture, talk, aim } =
    player;
  return { member, name, look, gender, money, toolbar, bag, selected, tiers, gesture, talk, aim };
}
