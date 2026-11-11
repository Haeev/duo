/**
 * `donnees/commun/prises/<id>.json`: un poisson, un insecte, un coquillage, un fossile ou un
 * trésor (réponses 28, 56 et 58): où, quand et par quel temps on le trouve. Moteurs au jalon 3.
 */
import * as v from 'valibot';
import { FileVersionSchema, FiniteSchema, IdSchema, IntSchema } from './communs';
import { FishTraitsSchema } from './peche';
import { ConditionSchema, FactKeySchema } from './regles';

export const CATCH_KINDS = ['fish', 'insect', 'shell', 'fossil', 'treasure'] as const;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const CATCH_WEATHERS = ['clear', 'overcast', 'rain', 'mist', 'snow', 'storm'] as const;

const MinuteOfDay = v.pipe(IntSchema, v.minValue(0), v.maxValue(1440));

/**
 * Prise unique: un poisson qui n'existe qu'une fois dans la partie. Son ombre paraît seulement
 * dans le coin `spot`, aux heures de la prise (`hours`), quand `when` est vrai et tant que `fact`
 * n'est pas retenu. Elle ne mord qu'à une ligne amorcée de `bait` et, avec `crew: "pair"`, que si
 * l'autre joueur est là pour tenir l'épuisette (pêche à deux, `simulation/peche/a-deux.ts`).
 * Sortie, elle écrit `fact` (vrai) et ne revient plus, qu'on la garde ou qu'on la relâche.
 */
export const UniqueCatchSchema = v.strictObject({
  /** Coin de pêche (`fishing` du lieu) où elle vit; elle n'est dans aucune table. */
  spot: IdSchema,
  /** Condition de son apparition (fait d'histoire, étape de quête...). */
  when: v.array(ConditionSchema),
  /** Appât exigé (objet du sac), `null`: toute ligne. */
  bait: v.nullable(IdSchema),
  /** `solo`: le mini-jeu ordinaire; `pair`: l'un à la canne, l'autre à l'épuisette. */
  crew: v.picklist(['solo', 'pair']),
  /** Fait écrit à la sortie: c'est lui qui la rend unique (et que lisent les quêtes). */
  fact: FactKeySchema,
  /** Elle va au sac du pêcheur; `false`: elle reste à l'épuisette, l'histoire décide d'elle. */
  toBag: v.boolean(),
});
export type UniqueCatchDef = v.InferOutput<typeof UniqueCatchSchema>;

export const CatchSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  kind: v.picklist(CATCH_KINDS),
  /** Objet obtenu (`objets/<id>.json`): c'est lui qui porte le nom et la pile. */
  item: IdSchema,
  /** Lieux où on le trouve. */
  places: v.pipe(v.array(IdSchema), v.minLength(1)),
  /** Plage d'heures de jeu (elle peut passer minuit), météos et saisons; liste vide: toutes. */
  hours: v.strictObject({ from: MinuteOfDay, to: MinuteOfDay }),
  weathers: v.array(v.picklist(CATCH_WEATHERS)),
  seasons: v.array(v.picklist(SEASONS)),
  rarity: v.picklist(['common', 'uncommon', 'rare']),
  /** Difficulté du mini-jeu, de 1 (facile) à 5. */
  difficulty: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(5)),
  /** Poisson: son caractère au combat (`schemas/peche.ts`). Absent: il ne se pêche pas. */
  fish: v.exactOptional(FishTraitsSchema),
  /**
   * Appâts qui l'attirent (objets du sac dont on amorce la ligne) et de combien: `factor` 2, il
   * vient d'aussi loin que deux fois le rayon de touche et passe devant les autres ombres.
   */
  baits: v.exactOptional(
    v.pipe(
      v.array(
        v.strictObject({
          item: IdSchema,
          factor: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(5)),
        }),
      ),
      v.maxLength(4),
    ),
  ),
  /** Prise unique (une seule fois dans la partie): voir `UniqueCatchSchema`. */
  unique: v.exactOptional(UniqueCatchSchema),
});
export type CatchDef = v.InferOutput<typeof CatchSchema>;
