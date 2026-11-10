/** Tranche « progression »: ce que le duo a accompli, tous lieux confondus. Elle change rarement. */
import * as v from 'valibot';
import { IdSchema, IntSchema } from '../donnees/schemas/communs';
import { FactValueSchema } from '../donnees/schemas/regles';

/** Un fait retenu (réponse 41: les habitants se souviennent): sa valeur, qui l'a fait, quel jour. */
export const FactSchema = v.strictObject({
  v: FactValueSchema,
  by: v.picklist([0, 1, 'duo']),
  day: v.pipe(IntSchema, v.minValue(1)),
});
export type Fact = v.InferOutput<typeof FactSchema>;

/** Avancement d'une suite de quêtes (moteur au jalon 2). */
export const QuestSchema = v.strictObject({
  chapter: IdSchema,
  step: IdSchema,
  done: v.boolean(),
});

export const ProgressSchema = v.strictObject({
  /** Mémoire des actions, par clé `lieu.sujet.detail`. */
  memory: v.record(v.string(), FactSchema),
  /**
   * Points d'amitié par habitant et par joueur (cahier 4.9), sous la clé `bondKey` (`j0-<habitant>`):
   * une clé par joueur garde le format d'enregistrement que le réseau envoie par morceaux.
   */
  bonds: v.record(IdSchema, v.pipe(IntSchema, v.minValue(0))),
  quests: v.record(IdSchema, QuestSchema),
  /** Entrées trouvées, par collection. */
  collections: v.record(IdSchema, v.array(IdSchema)),
  /** Lieux rouverts par l'histoire: le train y mène. */
  opened: v.array(IdSchema),
});
export type ProgressState = v.InferOutput<typeof ProgressSchema>;

/** Préfixe des clés d'amitié: un identifiant d'habitant en laisse 37 caractères (`valider.ts` le contrôle). */
export const BOND_KEY_PREFIX_LENGTH = 3;

/** Clé d'amitié d'un joueur avec un habitant. */
export function bondKey(villager: string, player: 0 | 1): string {
  return `j${String(player)}-${villager}`;
}
