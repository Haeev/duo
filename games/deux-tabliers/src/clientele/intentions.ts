// Intentions du chantier « clientele » (invité vers hôte, et hôte pour lui-même). Toutes sont
// revérifiées par l'hôte (portée, phase, prix, caisse); une intention invalide est refusée par
// l'événement `refused` du cœur, jamais appliquée à moitié.
import { v } from '@duo/sdk';

const Nat = v.pipe(v.number(), v.integer(), v.minValue(0));
const Short = v.pipe(v.string(), v.maxLength(40));
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export const CLIENTELE_INTENTS = [
  /** Répondre à une question posée aux deux (« On ouvre ? », « À demain », mariage, Mérelles...). */
  v.strictObject({
    type: v.literal('clientele-vote'),
    topic: v.picklist(['open', 'close', 'next-day', 'wedding', 'merelles', 'name']),
    yes: v.boolean(),
  }),
  /** Proposer le nom de la maison (l'autre le confirme par un vote `name`). */
  v.strictObject({
    type: v.literal('clientele-name'),
    name: v.pipe(v.string(), v.minLength(1), v.maxLength(32)),
  }),
  /** Écrire l'ardoise: recettes et pas de prix, 8 lignes au plus au village. */
  v.strictObject({
    type: v.literal('clientele-slate'),
    lines: v.pipe(
      v.array(v.tuple([Short, v.pipe(v.number(), v.integer(), v.minValue(-3), v.maxValue(5))])),
      v.maxLength(20),
    ),
  }),
  /** Prendre la commande du groupe en tête de file (à portée de la caisse). */
  v.strictObject({ type: v.literal('clientele-take-order') }),
  /** Parler à un groupe (2,5 m au plus). */
  v.strictObject({ type: v.literal('clientele-talk'), group: Nat }),
  /** Acheter (équipement, extension, meuble du catalogue, pièce de la brocante). */
  v.strictObject({ type: v.literal('clientele-buy'), item: Short }),
  /** Répondre à l'achat proposé par l'autre. */
  v.strictObject({
    type: v.literal('clientele-answer'),
    by: v.picklist([0, 1]),
    accept: v.boolean(),
  }),
  /** Commande du soir aux fournisseurs (cartons par ingrédient). */
  v.strictObject({
    type: v.literal('clientele-supply'),
    cartons: v.pipe(v.array(v.tuple([Short, v.pipe(Nat, v.maxValue(20))])), v.maxLength(30)),
  }),
  /** Dépannage chez Mireille: livré dans l'heure de jeu, +30 %. */
  v.strictObject({ type: v.literal('clientele-emergency'), ingredient: Short }),
  /** Geste propre à l'événement du jour (chauffeur, réparation, signe à la vitrine, conseil...). */
  v.strictObject({
    type: v.literal('clientele-scene'),
    action: v.picklist(['driver', 'repair', 'signal', 'advice', 'surprise']),
    choice: v.pipe(Nat, v.maxValue(20)),
  }),
  /** Réglage des remises (onglet « Remises »), pris à l'ouverture suivante (remises v0.2). */
  v.strictObject({
    type: v.literal('clientele-discounts'),
    settings: v.strictObject({
      happyHour: v.strictObject({
        on: v.boolean(),
        start: v.pipe(Nat, v.maxValue(24)),
        length: v.pipe(Nat, v.maxValue(12)),
        rate: v.pipe(v.number(), v.minValue(0), v.maxValue(0.9)),
        days: v.pipe(v.array(v.picklist(WEEKDAYS)), v.maxLength(7)),
      }),
      loyalty: v.boolean(),
      profiles: v.pipe(
        v.record(
          Short,
          v.strictObject({
            on: v.boolean(),
            rate: v.pipe(v.number(), v.minValue(0), v.maxValue(0.9)),
            days: v.pipe(v.array(v.picklist(WEEKDAYS)), v.maxLength(7)),
          }),
        ),
        v.check((r) => Object.keys(r).length <= 8, 'Trop de tarifs'),
      ),
      dailyOffer: v.nullable(v.tuple([Short, v.pipe(v.number(), v.minValue(0), v.maxValue(0.9))])),
    }),
  }),
  /** Lancer une action pour faire connaître le café (au-delà du seuil: proposée à l'autre). */
  v.strictObject({ type: v.literal('clientele-campaign'), action: Short }),
  /** Rythme du duo: normal (1 s par minute de jeu) ou paisible (1,25 s). */
  v.strictObject({ type: v.literal('clientele-pace'), peaceful: v.boolean() }),
  /** Page du bilan du soir que lit ce joueur (la puce de l'autre la montre). */
  v.strictObject({
    type: v.literal('clientele-evening-page'),
    page: v.pipe(Nat, v.minValue(1), v.maxValue(8)),
  }),
  /** Où est ce joueur dans l'interface (« Sur son téléphone : Catalogue »), pour la carte de l'autre. */
  v.strictObject({
    type: v.literal('clientele-ui-place'),
    place: v.nullable(v.pipe(v.string(), v.maxLength(60))),
  }),
] as const;
