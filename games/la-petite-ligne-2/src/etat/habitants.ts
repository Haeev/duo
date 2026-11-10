/**
 * État de vie d'un habitant qui a un planning (`life` de sa fiche), dans la tranche « lieu ».
 * Compact: ni chemin ni minuterie (le système les refait), seulement ce que lisent le rendu,
 * l'interface et le son. La position et le cap passent par le canal rapide (`body`).
 */
import * as v from 'valibot';
import { IdSchema, IntSchema, PlayerIndexSchema, TickSchema } from '../donnees/schemas/communs';

/** `here`: dans le lieu; `away`: pas encore arrivé ou reparti (hors de la carte, ni visible ni visable). */
export const PRESENCES = ['here', 'arriving', 'leaving', 'away'] as const;
/** Posture du corps: debout, en marche, assis sur une vraie place (`seat`). */
export const POSES = ['stand', 'walk', 'sit'] as const;

export const VillagerLifeStateSchema = v.strictObject({
  presence: v.picklist(PRESENCES),
  /** Ligne du planning en cours, -1: aucune (absent). */
  entry: v.pipe(IntSchema, v.minValue(-1), v.maxValue(31)),
  /** Activité en cours une fois à son poste, `null` en chemin ou absent. */
  activity: v.nullable(IdSchema),
  pose: v.picklist(POSES),
  /** Geste joué en boucle à son poste (balayer), `null`: au repos. */
  gesture: v.nullable(IdSchema),
  /** Place assise tenue: meuble et numéro de place. */
  seat: v.nullable(v.tuple([IdSchema, v.pipe(IntSchema, v.minValue(0), v.maxValue(3))])),
  /** Onomatopée au-dessus de la tête jusqu'au pas `emoteUntil`. */
  emote: v.nullable(IdSchema),
  emoteUntil: TickSchema,
  /** Qui il regarde: un joueur, un autre habitant (discussion), ou personne. */
  gaze: v.nullable(v.union([PlayerIndexSchema, IdSchema])),
});
export type VillagerLifeState = v.InferOutput<typeof VillagerLifeStateSchema>;
