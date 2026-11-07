// Événements du chantier « service » (hôte vers les deux machines: son, interface).
// Le son de chaque type est dans `donnees/sons.json`. Un champ `quality` ne s'affiche que chez
// `player` (CO-06: la qualité d'un geste se montre en petit au seul joueur qui l'a fait, sans son).
import { v } from '@duo/sdk';

const Player = v.picklist([0, 1]);
const Id = v.pipe(v.number(), v.integer(), v.minValue(0));
const Quality = v.picklist(['parfait', 'bien', 'correct']);

const ev = <const T extends string, E extends v.ObjectEntries>(
  type: T,
  entries: E,
): v.StrictObjectSchema<{ type: v.LiteralSchema<T, undefined> } & E, undefined> =>
  v.strictObject({ type: v.literal(type), ...entries });

export const SERVICE_EVENTS = [
  /** Une commande prise à la caisse: le ticket s'imprime et monte au rail. */
  ev('service-order-taken', { player: Player, ticket: Id, customer: v.nullable(v.string()) }),
  /** Encaissement à la commande (SE-02); l'économie relève `world.service.receipts`. */
  ev('service-paid', { ticket: Id, amount: v.number() }),
  ev('service-ticket-taken', { player: Player, ticket: Id }),
  /** Tous les articles du ticket sont sur le passe: le client peut venir. */
  ev('service-ticket-ready', { ticket: Id, customer: v.nullable(v.string()) }),
  /** Le client a pris son plateau. */
  ev('service-ticket-collected', { ticket: Id, customer: v.nullable(v.string()) }),
  ev('service-grind-start', { player: Player, furniture: v.string() }),
  ev('service-dose', { player: Player, furniture: v.string(), doses: Id }),
  ev('service-extraction-start', { player: Player, furniture: v.string() }),
  ev('service-extraction-stop', { player: Player, furniture: v.string(), quality: Quality }),
  ev('service-steam-start', { player: Player, furniture: v.string() }),
  ev('service-steam-stop', {
    player: Player,
    furniture: v.string(),
    quality: Quality,
    temperatureC: v.number(),
  }),
  ev('service-kettle-start', { player: Player, furniture: v.string() }),
  ev('service-kettle-hot', { furniture: v.string() }),
  ev('service-tea-poured', { player: Player, furniture: v.string(), quality: Quality }),
  ev('service-cook-start', { player: Player, furniture: v.string() }),
  ev('service-cook-done', { player: Player, furniture: v.string(), quality: Quality }),
  /** Une étape sans jugement (vitrine, plan, frigo, presse) est faite. */
  ev('service-prep-done', { player: Player, furniture: v.string(), recipe: v.string() }),
  /** Un article est prêt (dernière étape); `quality` chez `player` seulement. */
  ev('service-item-ready', {
    player: Player,
    object: Id,
    recipe: v.string(),
    quality: v.nullable(Quality),
  }),
  ev('service-latte-art', { player: Player, object: Id, shape: v.string() }),
  ev('service-washed', { player: Player, vessel: v.string() }),
  ev('service-dishwasher-start', { player: Player, furniture: v.string(), pieces: Id }),
  ev('service-dishwasher-done', { furniture: v.string() }),
  ev('service-dishwasher-emptied', { player: Player, furniture: v.string(), pieces: Id }),
  /** L'étagère de vaisselle propre est vide pour cette sorte (tension à deux). */
  ev('service-dishes-out', { vessel: v.string() }),
  ev('service-carton-delivered', { ingredient: v.string(), object: Id }),
  ev('service-carton-stored', { player: Player, ingredient: v.string(), units: v.number() }),
  ev('service-recipe-unlocked', { recipe: v.string() }),
  ev('service-equipment', { purchase: v.string() }),
  ev('service-tip', { amount: v.number() }),
] as const;
