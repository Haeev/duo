// Domaine « service » de l'état partagé (postes et gestes, commandes, tickets, service, plonge).
// Sérialisé dans les sauvegardes et envoyé à l'invité quand il change (canal du domaine).
// Les champs ajoutés après le format 1 ont une valeur par défaut: une sauvegarde du squelette
// (`{ nextTicketId }`) se relit sans migration. Les durées en cours se comptent en pas
// (`startTick`): le domaine ne change qu'aux événements, pas à chaque image.
import { v } from '@duo/sdk';
// Pas d'import de etat/monde.ts: il importe ce fichier (cycle à l'initialisation).
const PlayerIndexSchema = v.picklist([0, 1]);

const Int = v.pipe(v.number(), v.integer(), v.minValue(0));
const Tick = v.pipe(v.number(), v.integer());

export const QualitySchema = v.picklist(['parfait', 'bien', 'correct']);
export type Quality = v.InferOutput<typeof QualitySchema>;

const ArticleSchema = v.strictObject({
  recipe: v.string(),
  options: v.array(v.string()),
  /** Prix payé (ardoise du jour, chantier clientèle). */
  price: v.number(),
  /** Récipient qui porte l'article, dès sa première étape. */
  object: v.nullable(Int),
});
export type Article = v.InferOutput<typeof ArticleSchema>;

/** Commande d'un client arrivé à la caisse, pas encore prise. */
const WaitingOrderSchema = v.strictObject({
  customer: v.string(),
  articles: v.array(ArticleSchema),
});
export type WaitingOrder = v.InferOutput<typeof WaitingOrderSchema>;

export const TicketSchema = v.strictObject({
  id: Int,
  customer: v.nullable(v.string()),
  articles: v.array(ArticleSchema),
  /** Joueur qui a pris le ticket (sa couleur), ou personne. */
  taker: v.nullable(PlayerIndexSchema),
  createdTick: Int,
  /** `ready`: tout est sur le passe, le client peut venir le prendre. */
  status: v.picklist(['open', 'ready']),
  total: v.number(),
});
export type Ticket = v.InferOutput<typeof TicketSchema>;

/** Un récipient engagé dans une recette (la vaisselle propre n'en a pas). */
export const ItemSchema = v.strictObject({
  object: Int,
  recipe: v.string(),
  ticket: v.nullable(Int),
  /** Étapes faites (index dans `recipe.steps`). */
  step: Int,
  /** Plus faible qualité des gestes jugés, `null` si aucun geste n'a été jugé. */
  quality: v.nullable(QualitySchema),
  /** Dessin sur le lait (cœur, feuille, tulipe), facultatif. */
  art: v.nullable(v.strictObject({ shape: v.string(), quality: QualitySchema })),
  /** Dernière étape faite à la buse (le dessin se trace juste après le moussage). */
  steamed: v.optional(v.boolean(), false),
});
export type Item = v.InferOutput<typeof ItemSchema>;

/** Ce qui tourne seul sur un poste: extraction, crêpe. */
export const ProcessSchema = v.strictObject({
  kind: v.picklist(['extraction', 'cook']),
  furniture: v.string(),
  object: Int,
  player: PlayerIndexSchema,
  startTick: Tick,
  /** Prêt après ce temps (s): 12 s pour l'extraction, la cuisson de la recette. */
  readySeconds: v.number(),
});
export type Process = v.InferOutput<typeof ProcessSchema>;

/** Geste qu'un joueur tient (maintien d'Agir) ou buse qu'il mène. */
export const GestureSchema = v.strictObject({
  kind: v.picklist(['hold', 'steam']),
  /** Ce que le maintien accomplit à son terme. */
  action: v.picklist(['grind', 'order', 'wash', 'prep', 'cook-start', 'steam']),
  furniture: v.string(),
  object: v.nullable(Int),
  startTick: Tick,
  seconds: v.number(),
  /** Buse: degrés par seconde de la recette. */
  rate: v.number(),
});
export type Gesture = v.InferOutput<typeof GestureSchema>;

const KettleSchema = v.strictObject({
  furniture: v.string(),
  /** Chauffe depuis ce pas, `null` si elle est froide. */
  startTick: v.nullable(Tick),
  /** Qui l'a mise à chauffer (son anneau suit la température). */
  player: v.optional(v.nullable(PlayerIndexSchema), null),
});

const DishCountSchema = v.strictObject({ tasse: Int, verre: Int, assiette: Int });
export type DishCount = v.InferOutput<typeof DishCountSchema>;

const DishwasherSchema = v.strictObject({
  furniture: v.string(),
  loaded: DishCountSchema,
  /** Cycle lancé à ce pas, `null` à l'arrêt. */
  startTick: v.nullable(Tick),
  done: v.boolean(),
});

const CartonSchema = v.strictObject({ object: Int, ingredient: v.string(), units: v.number() });

const ReceiptSchema = v.strictObject({
  ticket: Int,
  customer: v.nullable(v.string()),
  amount: v.number(),
  /** Joueur qui a pris la commande, `null` sans joueur (recommande, commande de l'interface). */
  player: v.optional(v.nullable(PlayerIndexSchema), null),
});
export type Receipt = v.InferOutput<typeof ReceiptSchema>;

const ZERO_DISHES = (): DishCount => ({ tasse: 0, verre: 0, assiette: 0 });

export const ServiceStateSchema = v.strictObject({
  /** Prochain numéro de ticket (chantier service). */
  nextTicketId: v.pipe(v.number(), v.integer(), v.minValue(0)),
  /** Le service s'est installé dans la coque (pièces de la machine, bouilloire, rail...). */
  installed: v.optional(v.boolean(), false),
  waiting: v.optional(v.array(WaitingOrderSchema), () => []),
  tickets: v.optional(v.array(TicketSchema), () => []),
  items: v.optional(v.array(ItemSchema), () => []),
  processes: v.optional(v.array(ProcessSchema), () => []),
  gestures: v.optional(v.tuple([v.nullable(GestureSchema), v.nullable(GestureSchema)]), () => [
    null,
    null,
  ]),
  kettles: v.optional(v.array(KettleSchema), () => []),
  /** Doses moulues prêtes dans les porte-filtres. */
  doses: v.optional(Int, 0),
  /** Groupes de la machine en panne (événement « La vieille dame tousse »). */
  groupsOut: v.optional(v.array(v.string()), () => []),
  clean: v.optional(DishCountSchema, ZERO_DISHES),
  /** Vaisselle sale rapportée au comptoir, en attente à la plonge. */
  dirtyBacklog: v.optional(DishCountSchema, ZERO_DISHES),
  dishwashers: v.optional(v.array(DishwasherSchema), () => []),
  /** Matières en réserve, par ingrédient (unités de `ingredients.json`). */
  stock: v.optional(v.record(v.string(), v.number()), () => ({})),
  cartons: v.optional(v.array(CartonSchema), () => []),
  /** Recettes connues au-delà de celles du départ. */
  unlocked: v.optional(v.array(v.string()), () => []),
  /** Équipements sans poste (gobelets, pichet thermomètre...) et niveaux achetés. */
  equipment: v.optional(v.array(v.string()), () => []),
  /** Aide « gestes simplifiés », par joueur (CO-07). */
  assist: v.optional(v.tuple([v.boolean(), v.boolean()]), () => [false, false]),
  /** Encaissements pas encore relevés par l'économie (chantier clientèle). */
  receipts: v.optional(v.array(ReceiptSchema), () => []),
});
export type ServiceState = v.InferOutput<typeof ServiceStateSchema>;

export function createServiceState(): ServiceState {
  return v.parse(ServiceStateSchema, { nextTicketId: 0 });
}
