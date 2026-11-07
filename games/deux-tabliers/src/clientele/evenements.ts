// Événements du chantier « clientele » (hôte vers les deux machines: son, interface, service).
// Un événement qui porte `player` ne se montre que chez ce joueur (indices des scènes, D-08).
import { v } from '@duo/sdk';

const Nat = v.pipe(v.number(), v.integer(), v.minValue(0));
const Player = v.picklist([0, 1]);
const Text = v.pipe(v.string(), v.maxLength(400));
const Outcome = v.picklist(['reussi', 'formidable']);

export const CLIENTELE_EVENTS = [
  /** Une nouvelle journée commence (aube): jour, titre, météo. */
  v.strictObject({
    type: v.literal('clientele-dawn'),
    day: Nat,
    title: Text,
    weather: v.string(),
    open: v.boolean(),
  }),
  /** Un joueur a voté (« On ouvre ? » chez l'autre, « À demain »...). */
  v.strictObject({
    type: v.literal('clientele-ask'),
    topic: v.string(),
    by: Player,
    yes: v.boolean(),
  }),
  v.strictObject({ type: v.literal('clientele-opened') }),
  v.strictObject({ type: v.literal('clientele-closing') }),
  /** Le dernier client est parti: le bilan est dans `world.clientele.report`. */
  v.strictObject({ type: v.literal('clientele-evening'), day: Nat }),
  /** Un groupe entre (pour le son de la porte), ou repart sans entrer. */
  v.strictObject({ type: v.literal('clientele-arrived'), group: Nat, profile: v.string() }),
  v.strictObject({
    type: v.literal('clientele-passed-by'),
    profile: v.string(),
    full: v.boolean(),
  }),
  /**
   * Commande prise et payée (vers le service, chantier a): le service crée le ticket des
   * `items` pour le groupe `group`, puis appelle `deliverOrder` quand c'est servi.
   */
  v.strictObject({
    type: v.literal('clientele-order'),
    group: Nat,
    player: v.nullable(Player),
    items: v.array(v.string()),
    reorder: v.boolean(),
    amount: Nat,
  }),
  v.strictObject({ type: v.literal('clientele-served'), group: Nat }),
  /** Vaisselle sale laissée à table (vers le service): table, assises, nombre de pièces. */
  v.strictObject({
    type: v.literal('clientele-dishes'),
    table: v.nullable(v.string()),
    seats: v.array(v.string()),
    pieces: Nat,
  }),
  v.strictObject({
    type: v.literal('clientele-left'),
    group: Nat,
    satisfaction: v.number(),
    tip: Nat,
  }),
  /** Une réplique dite par un personnage (`player`: entendue par ce joueur seulement, sinon les deux). */
  v.strictObject({
    type: v.literal('clientele-say'),
    who: v.string(),
    text: Text,
    player: v.nullable(Player),
  }),
  /** Un mot au livre d'or. */
  v.strictObject({ type: v.literal('clientele-guestbook'), text: Text, sign: v.string() }),
  /** Indice d'une scène, visible de ce seul joueur. */
  v.strictObject({
    type: v.literal('clientele-clue'),
    event: v.string(),
    player: Player,
    text: Text,
    choices: v.array(Text),
  }),
  v.strictObject({ type: v.literal('clientele-event-start'), event: v.string(), name: Text }),
  v.strictObject({
    type: v.literal('clientele-event-end'),
    event: v.string(),
    outcome: Outcome,
    text: Text,
  }),
  /** Livraison du matin (vers le service: cartons à poser à la porte de service). */
  v.strictObject({
    type: v.literal('clientele-delivery'),
    cartons: v.array(v.tuple([v.string(), Nat, v.boolean()])),
    emergency: v.boolean(),
  }),
  v.strictObject({
    type: v.literal('clientele-purchased'),
    item: v.string(),
    by: v.nullable(Player),
    price: Nat,
  }),
  v.strictObject({
    type: v.literal('clientele-proposal'),
    by: Player,
    item: v.string(),
    price: Nat,
  }),
  v.strictObject({ type: v.literal('clientele-gift'), item: v.string(), from: v.string() }),
  v.strictObject({ type: v.literal('clientele-tier'), tier: v.string() }),
  v.strictObject({ type: v.literal('clientele-cups'), cups: v.number() }),
  v.strictObject({
    type: v.literal('clientele-story'),
    regular: v.string(),
    step: v.string(),
    scene: Text,
  }),
  v.strictObject({ type: v.literal('clientele-letter'), how: v.picklist(['mail', 'rene']) }),
  v.strictObject({ type: v.literal('clientele-demo-end') }),
] as const;
