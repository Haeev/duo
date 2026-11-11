/**
 * Conditions et effets des données (quêtes, dialogues, objets de la carte): vocabulaire du
 * jalon 1. Le lot L3 (`simulation/regles/`) les évalue; un nouveau type s'ajoute ici, avec son
 * cas dans l'évaluateur et dans `valider.ts`.
 */
import * as v from 'valibot';
import {
  CentsSchema,
  CountSchema,
  FiniteSchema,
  IntSchema,
  IdSchema,
  NeedIdSchema,
  type NeedId,
} from './communs';

/** Valeur retenue dans la mémoire des actions (`progress.memory`). */
export const FactValueSchema = v.union([v.string(), v.number(), v.boolean()]);
export type FactValue = v.InferOutput<typeof FactValueSchema>;

/** Clé de mémoire: `lieu.sujet.detail`. */
export const FactKeySchema = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+){0,3}$/));

/**
 * Fait attaché à un joueur (`of`): la clé reçoit le suffixe `.j0` ou `.j1` de celui qui agit
 * (`actor`) ou de l'autre joueur (`other`), comme les faits par joueur du moteur
 * (`habitants.<id>.cadeaux.j1`). La clé donnée a donc trois segments au plus.
 */
export const FACT_OWNERS = ['actor', 'other'] as const;
export type FactOwner = (typeof FACT_OWNERS)[number];

/** États d'une décision à deux que lit la condition `decision_is`. */
export const DECISION_IS = ['agreed', 'split', 'mine', 'theirs', 'last'] as const;
export type DecisionIs = (typeof DECISION_IS)[number];

/**
 * Moments d'un événement du calendrier que lit la condition `event_is` (`simulation/monde/`):
 * `on` en cours (dans ses heures), `begun` commencé aujourd'hui (jusqu'à l'aube suivante, heures
 * passées comprises), `today` a lieu aujourd'hui (commencé ou à venir), `tomorrow` a lieu demain
 * (ce qu'annonce la veille).
 */
export const EVENT_IS = ['on', 'begun', 'today', 'tomorrow'] as const;
export type EventIs = (typeof EVENT_IS)[number];

export type Condition =
  | { type: 'all'; conditions: Condition[] }
  | { type: 'any'; conditions: Condition[] }
  | { type: 'not'; condition: Condition }
  /** Fait retenu égal à `equals` (absent: le fait existe); `of`: fait de qui agit ou de l'autre. */
  | { type: 'remembered'; key: string; equals?: FactValue; of?: FactOwner }
  /**
   * Jours écoulés depuis la dernière écriture du fait (`aujourd'hui - jour du fait`), entre
   * `atLeast` et `atMost` (bornes comprises, l'une au moins). Fait absent: faux.
   */
  | { type: 'days_since'; key: string; of?: FactOwner; atLeast?: number; atMost?: number }
  /** Compteur retenu (fait numérique) d'au moins `value`. Absent ou non numérique: faux. */
  | { type: 'fact_at_least'; key: string; of?: FactOwner; value: number }
  | { type: 'need_at_least'; need: NeedId; value: number }
  | { type: 'item_in_bag'; item: string; count: number }
  /** La bourse du joueur qui agit contient au moins `amount` centimes. */
  | { type: 'money_at_least'; amount: number }
  | { type: 'place_is'; place: string }
  /**
   * Décision à deux (`simulation/quetes/decisions.ts`): `agreed` les deux choix concordent (sur
   * `option` si elle est donnée), `split` deux avis différents, `mine` celui qui agit a choisi,
   * `theirs` l'autre a choisi, `last` la décision prise à l'occurrence précédente d'une décision
   * rejouable (`reopens` de l'étape: « comme l'an dernier »).
   */
  | { type: 'decision_is'; decision: string; state: DecisionIs; option?: string }
  /**
   * Un des événements du calendrier du lieu courant (`evenements/<id>.json`) en est à ce moment
   * (`EVENT_IS`), ses conditions d'histoire comprises.
   */
  | { type: 'event_is'; events: string[]; when: EventIs }
  /** Points d'amitié du joueur qui agit avec cet habitant (cahier 4.9: 100 par cœur). */
  | { type: 'bond_at_least'; villager: string; points: number }
  /** Heure de jeu, en minutes depuis minuit (`from` inclus, `to` exclu; la plage peut passer minuit). */
  | { type: 'time_is'; from: number; to: number }
  /** Temps du monde (`simulation/monde/`): météo du lieu courant, saison, jour de la semaine. */
  | { type: 'weather_is'; weathers: string[] }
  | { type: 'season_is'; seasons: string[] }
  | { type: 'weekday_is'; weekdays: string[] };

const Minutes = v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1440));
const Days = v.pipe(IntSchema, v.minValue(0), v.maxValue(10000));
// Listes recopiées de `etat/commun.ts`, `prise.ts` et `temps.ts` (qui importent ce fichier):
// `tests/monde-temps.test.ts` vérifie qu'elles restent égales.
export const WORLD_WEATHERS = ['clear', 'overcast', 'rain', 'mist', 'snow', 'storm'] as const;
export const WORLD_SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const WORLD_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export const ConditionSchema: v.GenericSchema<Condition> = v.lazy(() =>
  v.variant('type', [
    v.strictObject({
      type: v.literal('all'),
      conditions: v.pipe(v.array(ConditionSchema), v.minLength(1)),
    }),
    v.strictObject({
      type: v.literal('any'),
      conditions: v.pipe(v.array(ConditionSchema), v.minLength(1)),
    }),
    v.strictObject({ type: v.literal('not'), condition: ConditionSchema }),
    v.strictObject({
      type: v.literal('remembered'),
      key: FactKeySchema,
      equals: v.exactOptional(FactValueSchema),
      of: v.exactOptional(v.picklist(FACT_OWNERS)),
    }),
    v.strictObject({
      type: v.literal('days_since'),
      key: FactKeySchema,
      of: v.exactOptional(v.picklist(FACT_OWNERS)),
      atLeast: v.exactOptional(Days),
      atMost: v.exactOptional(Days),
    }),
    v.strictObject({
      type: v.literal('fact_at_least'),
      key: FactKeySchema,
      of: v.exactOptional(v.picklist(FACT_OWNERS)),
      value: FiniteSchema,
    }),
    v.strictObject({
      type: v.literal('need_at_least'),
      need: NeedIdSchema,
      value: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(100)),
    }),
    v.strictObject({
      type: v.literal('item_in_bag'),
      item: IdSchema,
      count: v.pipe(CountSchema, v.minValue(1)),
    }),
    v.strictObject({
      type: v.literal('money_at_least'),
      amount: v.pipe(CentsSchema, v.minValue(1)),
    }),
    v.strictObject({ type: v.literal('place_is'), place: IdSchema }),
    v.strictObject({
      type: v.literal('decision_is'),
      decision: IdSchema,
      state: v.picklist(DECISION_IS),
      option: v.exactOptional(IdSchema),
    }),
    v.strictObject({
      type: v.literal('event_is'),
      events: v.pipe(v.array(IdSchema), v.minLength(1), v.maxLength(8)),
      when: v.picklist(EVENT_IS),
    }),
    v.strictObject({
      type: v.literal('bond_at_least'),
      villager: IdSchema,
      points: v.pipe(IntSchema, v.minValue(1), v.maxValue(500)),
    }),
    v.strictObject({ type: v.literal('time_is'), from: Minutes, to: Minutes }),
    v.strictObject({
      type: v.literal('weather_is'),
      weathers: v.pipe(v.array(v.picklist(WORLD_WEATHERS)), v.minLength(1)),
    }),
    v.strictObject({
      type: v.literal('season_is'),
      seasons: v.pipe(v.array(v.picklist(WORLD_SEASONS)), v.minLength(1)),
    }),
    v.strictObject({
      type: v.literal('weekday_is'),
      weekdays: v.pipe(v.array(v.picklist(WORLD_WEEKDAYS)), v.minLength(1)),
    }),
  ]),
);

/** À qui s'applique un effet d'échange: celui qui agit, ou chacun des deux joueurs. */
export const EffectTargetSchema = v.picklist(['actor', 'duo']);

export const EffectSchema = v.variant('type', [
  /**
   * Écrit un fait dans la mémoire, au nom du joueur qui agit (`by: 'duo'`: au nom des deux).
   * `of: 'actor'`: le fait est attaché à celui qui agit (suffixe `.j0` ou `.j1` de la clé).
   */
  v.strictObject({
    type: v.literal('remember'),
    key: FactKeySchema,
    value: FactValueSchema,
    by: v.picklist(['actor', 'duo']),
    of: v.exactOptional(v.literal('actor')),
  }),
  /**
   * Compteur: ajoute `amount` (1 par défaut, négatif permis) au fait numérique (0 s'il est absent),
   * lu par `fact_at_least`. `by` et `of` comme pour `remember`.
   */
  v.strictObject({
    type: v.literal('bump'),
    key: FactKeySchema,
    amount: v.exactOptional(
      v.pipe(
        IntSchema,
        v.minValue(-1000),
        v.maxValue(1000),
        v.check((n) => n !== 0, 'pas nul'),
      ),
    ),
    by: v.picklist(['actor', 'duo']),
    of: v.exactOptional(v.literal('actor')),
  }),
  /** `to`: à celui qui agit (défaut) ou à chacun des deux (`duo`); refusé si les poches sont pleines. */
  v.strictObject({
    type: v.literal('give_item'),
    item: IdSchema,
    count: v.pipe(CountSchema, v.minValue(1)),
    to: v.exactOptional(EffectTargetSchema),
  }),
  /** Reprend des objets (à chacun avec `to: 'duo'`); refusé s'il en manque. */
  v.strictObject({
    type: v.literal('take_item'),
    item: IdSchema,
    count: v.pipe(CountSchema, v.minValue(1)),
    to: v.exactOptional(EffectTargetSchema),
  }),
  /** Montant en centimes. */
  v.strictObject({
    type: v.literal('give_money'),
    amount: v.pipe(CentsSchema, v.minValue(1)),
    to: v.exactOptional(EffectTargetSchema),
  }),
  /** Paiement de la bourse, en centimes (tout ou rien); refusé si elle n'y suffit pas. */
  v.strictObject({
    type: v.literal('take_money'),
    amount: v.pipe(CentsSchema, v.minValue(1)),
    to: v.exactOptional(EffectTargetSchema),
  }),
  /** Points d'amitié avec un habitant, gagnés (positif) ou perdus (négatif, jamais sous zéro). */
  v.strictObject({
    type: v.literal('change_bond'),
    villager: IdSchema,
    points: v.pipe(
      IntSchema,
      v.minValue(-500),
      v.maxValue(500),
      v.check((n) => n !== 0, 'points non nuls'),
    ),
    to: v.exactOptional(EffectTargetSchema),
  }),
  /** Ajoute `amount` (négatif permis) à un besoin de celui qui agit, sans dépasser `cap`. */
  v.strictObject({
    type: v.literal('change_need'),
    need: NeedIdSchema,
    amount: v.pipe(FiniteSchema, v.minValue(-100), v.maxValue(100)),
    cap: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(100)),
  }),
  /** Remplace le sac de celui qui agit (identifiant de `sacs.json`). */
  v.strictObject({ type: v.literal('give_bag'), bag: IdSchema }),
  /** Ouvre la boutique de ce commerce du lieu pour celui qui agit (dialogue du commerçant). */
  v.strictObject({ type: v.literal('open_shop'), shop: IdSchema }),
  /**
   * Récompenses qui ne sont ni un objet ni de l'argent (`simulation/regles/recompenses.ts`),
   * acquises au duo et annoncées aux deux joueurs (sauf la pièce de tenue, à chacun). Déjà
   * acquise: sans effet.
   */
  /** Apprend une recette à apprendre (`known: "learned"` de `commun/recettes/<id>.json`). */
  v.strictObject({ type: v.literal('give_recipe'), recipe: IdSchema }),
  /** Apprend un plan d'artisanat à apprendre (`source` autre que `start`, `commun/plans/<id>.json`). */
  v.strictObject({ type: v.literal('give_plan'), plan: IdSchema }),
  /** Inscrit une entrée au carnet des collections (carte postale, musique: `commun/collections/`). */
  v.strictObject({ type: v.literal('give_entry'), entry: IdSchema }),
  /**
   * Ajoute une pièce de tenue à gagner (étiquette `a-gagner` du catalogue) à la garde-robe de celui
   * qui agit, ou de chacun avec `to: 'duo'` (les tenues sont à chacun, cahier 2.1). Déjà à lui: rien.
   */
  v.strictObject({
    type: v.literal('give_piece'),
    piece: IdSchema,
    to: v.exactOptional(EffectTargetSchema),
  }),
  /**
   * Décision à deux: celui qui agit dit son choix. Elle n'est prise que si l'autre dit le même
   * (`decision` et ses options: champ `decision` d'une étape de quête; lire par `decision_is`).
   */
  v.strictObject({ type: v.literal('choose'), decision: IdSchema, option: IdSchema }),
  /**
   * Révèle l'apparence de celui qui agit (ou de chacun avec `to: 'duo'`): jusque-là son personnage
   * se montre en silhouette, sans traits ni tenue (`simulation/regles/apparence.ts`). Déjà révélée:
   * sans effet.
   */
  v.strictObject({ type: v.literal('reveal_look'), to: v.exactOptional(EffectTargetSchema) }),
]);
export type Effect = v.InferOutput<typeof EffectSchema>;
