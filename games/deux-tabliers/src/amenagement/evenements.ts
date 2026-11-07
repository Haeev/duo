// Événements du chantier « amenagement » (hôte vers les deux machines: son, interface).
// Les refus passent par l'événement `refused` du cœur (texte de 80 signes au plus).
import { v } from '@duo/sdk';

const Player = v.picklist([0, 1]);
const Name = v.pipe(v.string(), v.maxLength(60));

export const ARRANGEMENT_EVENTS = [
  /** Achat fait: livré en carton demain matin, appliqué tout de suite, ou travaux lancés. */
  v.strictObject({
    type: v.literal('amenagement-achat'),
    player: Player,
    item: Name,
    price: v.number(),
    delivery: v.picklist(['carton', 'carton-lourd', 'direct', 'travaux']),
  }),
  /** Achat important proposé à l'autre (DE-10); `null` à la réponse. */
  v.strictObject({
    type: v.literal('amenagement-proposition'),
    player: Player,
    item: Name,
    price: v.number(),
    answer: v.nullable(v.boolean()),
  }),
  /** Livraison du matin: cartons déposés dans la cour (`waiting`: restés chez le livreur). */
  v.strictObject({
    type: v.literal('amenagement-livraison'),
    cartons: v.number(),
    heavy: v.number(),
    waiting: v.number(),
  }),
  /** Une pièce posée, prise, rangée. */
  v.strictObject({
    type: v.literal('amenagement-geste'),
    player: Player,
    gesture: v.picklist(['prise', 'pose', 'rangement', 'annulation', 'renovation', 'deballage']),
    furniture: Name,
    item: Name,
  }),
  /** Port à deux: un côté saisi (attente de l'autre), départ, pose, lâché. */
  v.strictObject({
    type: v.literal('amenagement-port'),
    player: Player,
    state: v.picklist(['attente', 'depart', 'pose', 'lache']),
    furniture: Name,
  }),
  /** Extension: travaux lancés, ou ouverte ce matin. */
  v.strictObject({
    type: v.literal('amenagement-extension'),
    extension: Name,
    state: v.picklist(['travaux', 'ouverte']),
  }),
  /** Brocante du lundi: nouvelle offre. */
  v.strictObject({ type: v.literal('amenagement-brocante'), items: v.number() }),
  /** Pièce unique reçue (habitué, événement): rangée dans la réserve. */
  v.strictObject({ type: v.literal('amenagement-unique'), item: Name }),
] as const;
