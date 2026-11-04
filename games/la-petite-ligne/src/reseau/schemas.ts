/**
 * Messages du jeu entre les deux machines (ADR 0007, modèle `host-authority`),
 * validés à l'arrivée par le SDK. L'invité n'envoie que des intentions et ses
 * commandes de déplacement; l'hôte envoie l'état.
 */
import * as v from 'valibot';
import type { ControlFrame, Intent } from '../etat/actions';
import type { SentWorld } from './etat-transmis';
import { FISH_RARITIES, SHADOW_SIZES, type FishShadow } from '../etat/peche';
import type { WorldEvent } from '../etat/types';
import { CAT_POSES } from '../etat/chat';

/** Canaux (0 à 15), les mêmes chez les deux. */
export const CHANNEL = {
  /** Invité vers hôte: commandes et intentions, fiable. */
  guestInput: 0,
  /** Hôte vers invité: état complet quand il change, seul le dernier compte. */
  world: 1,
  /** Hôte vers invité: positions et horloge, 15 fois par seconde. */
  fast: 2,
  /** Hôte vers invité: événements ponctuels (sons, effets), fiable. */
  events: 3,
  /** Hôte vers invité: ombres des poissons, quand elles changent; seul le dernier compte. */
  shadows: 4,
} as const;

const Finite = v.pipe(v.number(), v.finite());
const Int = v.pipe(v.number(), v.integer());
const Id = v.pipe(v.string(), v.maxLength(64));
const Unit = v.pipe(Finite, v.minValue(-1), v.maxValue(1));
const Count = v.pipe(Int, v.minValue(0), v.maxValue(999));
const QualitySchema = v.picklist(['ordinary', 'fine']);
const CharacterIdSchema = v.picklist(['p1', 'p2']);
const MenuSchema = v.nullable(
  v.picklist(['notebook', 'shop', 'catalogue', 'crate', 'workbench', 'stove', 'chest', 'proposal', 'letter', 'salon', 'bakery', 'clothes_shop', 'wardrobe', 'farm', 'stall']),
);
const CellSchema = v.strictObject({ cx: Int, cy: Int });

export const ControlFrameSchema = v.strictObject({
  seq: v.pipe(Int, v.minValue(0)),
  moveX: Unit,
  moveY: Unit,
  actHeld: v.boolean(),
}) satisfies v.GenericSchema<ControlFrame>;

const ClickTargetSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('ground'), x: Finite, y: Finite }),
  v.strictObject({ kind: v.literal('villager'), villager: Id }),
  v.strictObject({ kind: v.literal('character'), character: CharacterIdSchema }),
  v.strictObject({ kind: v.literal('furniture'), furniture: Id }),
  v.strictObject({ kind: v.literal('ground_item'), groundItem: Id }),
  v.strictObject({ kind: v.literal('tree'), tree: Id }),
]);

const stack = { item: Id, quality: QualitySchema, count: Count };

export const IntentSchema = v.variant('type', [
  v.strictObject({ type: v.literal('title_ready'), ready: v.boolean() }),
  v.strictObject({ type: v.literal('end_ready'), ready: v.boolean() }),
  v.strictObject({ type: v.literal('stage_choice'), choice: v.nullable(v.picklist(['stay', 'finish'])) }),
  v.strictObject({
    type: v.literal('create_character'),
    name: v.pipe(v.string(), v.maxLength(64)),
    hair: Int,
    outfit: Int,
    hairColor: v.exactOptional(Int),
    beard: v.exactOptional(Int),
  }),
  v.strictObject({ type: v.literal('move_to'), target: ClickTargetSchema, act: v.boolean() }),
  v.strictObject({ type: v.literal('point_at'), target: v.nullable(ClickTargetSchema) }),
  v.strictObject({ type: v.literal('act') }),
  v.strictObject({ type: v.literal('examine') }),
  v.strictObject({ type: v.literal('select_slot'), slot: Int }),
  v.strictObject({ type: v.literal('cycle_slot'), delta: Int }),
  v.strictObject({ type: v.literal('swap_slots'), from: Int, to: Int }),
  v.strictObject({ type: v.literal('rotate_furniture'), delta: Int }),
  v.strictObject({ type: v.literal('place_furniture'), cell: CellSchema, rotation: Int }),
  v.strictObject({ type: v.literal('take_furniture'), furniture: Id }),
  v.strictObject({ type: v.literal('hold_furniture'), item: Id }),
  v.strictObject({ type: v.literal('plot_place'), cells: v.pipe(v.array(CellSchema), v.maxLength(256)) }),
  v.strictObject({ type: v.literal('plot_remove'), cells: v.pipe(v.array(CellSchema), v.maxLength(256)) }),
  v.strictObject({ type: v.literal('plot_hold'), cell: v.nullable(CellSchema) }),
  v.strictObject({ type: v.literal('corner'), x: Finite, y: Finite }),
  v.strictObject({ type: v.literal('corner_clear') }),
  v.strictObject({ type: v.literal('cancel_placement') }),
  v.strictObject({ type: v.literal('menu'), menu: MenuSchema }),
  v.strictObject({ type: v.literal('dialogue_next') }),
  v.strictObject({ type: v.literal('dialogue_choice'), choice: Id }),
  v.strictObject({ type: v.literal('dialogue_close') }),
  v.strictObject({ type: v.literal('buy'), item: Id, count: Count }),
  v.strictObject({ type: v.literal('sell'), ...stack }),
  v.strictObject({ type: v.literal('catalogue_order'), item: Id }),
  v.strictObject({ type: v.literal('bakery_buy'), item: v.picklist(['bread', 'brioche']) }),
  v.strictObject({ type: v.literal('haircut'), hair: Int, hairColor: Int, beard: Int }),
  v.strictObject({ type: v.literal('hair_offer'), hair: Int, hairColor: Int, beard: Int }),
  v.strictObject({ type: v.literal('hair_offer_answer'), accept: v.boolean() }),
  v.strictObject({ type: v.literal('clothes_buy'), item: Id }),
  v.strictObject({ type: v.literal('wear'), slot: v.picklist(['top', 'outer', 'bottom', 'shoes', 'hat']), item: v.nullable(Id) }),
  v.strictObject({ type: v.literal('improvement_pay'), improvement: Id, amount: v.nullable(v.pipe(Int, v.minValue(0), v.maxValue(100_000))) }),
  v.strictObject({ type: v.literal('improvement_planks'), improvement: Id, count: Count }),
  v.strictObject({ type: v.literal('proposal_answer'), proposal: Id, accept: v.boolean() }),
  v.strictObject({ type: v.literal('proposal_withdraw') }),
  v.strictObject({ type: v.literal('decision_vote'), decision: Id, option: v.nullable(Id) }),
  v.strictObject({ type: v.literal('crate_deposit'), ...stack }),
  v.strictObject({ type: v.literal('crate_take'), ...stack }),
  v.strictObject({ type: v.literal('chest_deposit'), ...stack }),
  v.strictObject({ type: v.literal('chest_take'), ...stack }),
  v.strictObject({ type: v.literal('stall_deposit'), ...stack }),
  v.strictObject({ type: v.literal('stall_take'), ...stack }),
  v.strictObject({ type: v.literal('market_level'), level: v.picklist(['soft', 'fair', 'strong']) }),
  v.strictObject({ type: v.literal('market_serve'), villager: Id }),
  v.strictObject({ type: v.literal('storage_deposit_family'), family: Id }),
  v.strictObject({ type: v.literal('storage_sort') }),
  v.strictObject({ type: v.literal('room_deposit'), room: Id, item: Id, count: Count }),
  v.strictObject({ type: v.literal('curtains'), furniture: Id }),
  v.strictObject({ type: v.literal('animal_name'), animal: Id, name: v.pipe(v.string(), v.maxLength(40)) }),
  v.strictObject({ type: v.literal('brood_start'), hen: Id }),
  v.strictObject({ type: v.literal('craft'), recipe: Id }),
  v.strictObject({ type: v.literal('eat'), item: Id }),
  v.strictObject({ type: v.literal('give'), to: Id, ...stack }),
  v.strictObject({ type: v.literal('gift'), villager: Id, item: Id }),
  v.strictObject({ type: v.literal('read_letter'), letter: Id }),
  v.strictObject({ type: v.literal('start_day') }),
  v.strictObject({ type: v.literal('get_up') }),
  v.strictObject({ type: v.literal('night_choice'), choice: v.picklist(['continue', 'finish']) }),
  v.strictObject({ type: v.literal('hint_seen'), hint: Id }),
  v.strictObject({ type: v.literal('unstick') }),
  v.strictObject({ type: v.literal('pin'), x: Finite, y: Finite }),
]) satisfies v.GenericSchema<Intent>;

/** Ce que l'invité envoie à chaque pas (au plus quelques commandes en retard et ses intentions). */
export const GuestInputSchema = v.strictObject({
  frames: v.pipe(v.array(ControlFrameSchema), v.maxLength(16)),
  intents: v.pipe(v.array(IntentSchema), v.maxLength(32)),
});
export type GuestInput = v.InferOutput<typeof GuestInputSchema>;

const MoverSchema = v.strictObject({ id: Id, x: Finite, y: Finite, f: Finite, s: Finite });

/** Positions et horloge, envoyées souvent (interpolation chez l'invité). */
export const FastSnapshotSchema = v.strictObject({
  tick: v.pipe(Int, v.minValue(0)),
  /** Dernière commande de l'invité appliquée par l'hôte (réconciliation de la prédiction). */
  ack: v.pipe(Int, v.minValue(-1)),
  minutes: Finite,
  characters: v.pipe(v.array(MoverSchema), v.maxLength(2)),
  // 0.13: 21 habitants, marge comprise pour les arcs suivants.
  villagers: v.pipe(v.array(MoverSchema), v.maxLength(32)),
  // Poules, puis (0.12) poussines, chèvres et coq: 9 + 2 + 1 au plus, marge comprise.
  hens: v.pipe(v.array(MoverSchema), v.maxLength(24)),
  beam: v.nullable(v.strictObject({ x: Finite, y: Finite, f: Finite })),
  train: Finite,
  // 0.13 (lot H7): le chat du bourg, simulé par l'hôte seul; absent: pas de chat au bourg.
  cat: v.exactOptional(
    v.strictObject({ x: Finite, y: Finite, f: Finite, s: Finite, p: v.picklist(CAT_POSES), t: v.pipe(Int, v.minValue(0)) }),
  ),
});
export type FastSnapshot = v.InferOutput<typeof FastSnapshotSchema>;

/**
 * L'état complet vient de l'hôte, qui fait autorité: on contrôle sa forme
 * générale (de quoi éviter un plantage sur un message abîmé), pas chaque champ.
 */
function looksLikeWorld(value: unknown): value is SentWorld {
  if (typeof value !== 'object' || value === null) return false;
  const w = value as Record<string, unknown>;
  return (
    typeof w.tick === 'number' &&
    typeof w.revision === 'number' &&
    typeof w.phase === 'string' &&
    Array.isArray(w.characters) &&
    w.characters.length === 2 &&
    Array.isArray(w.garden) &&
    w.garden.every((p) => Array.isArray(p)) &&
    typeof w.plots === 'object' &&
    w.plots !== null &&

    Array.isArray(w.villagers) &&
    typeof w.clock === 'object' &&
    w.clock !== null
  );
}

export const WorldMessageSchema = v.strictObject({
  /** Dernière commande de l'invité appliquée quand cet état a été pris. */
  ack: v.pipe(Int, v.minValue(-1)),
  world: v.custom<SentWorld>(looksLikeWorld, 'état du monde invalide'),
});
export type WorldMessage = v.InferOutput<typeof WorldMessageSchema>;

const PointSchema = v.strictObject({ x: Finite, y: Finite });

/** Une ombre de poisson (`etat/peche.ts`), contrôlée champ par champ: le rendu de l'invité la lit telle quelle. */
const FishShadowSchema = v.strictObject({
  id: v.pipe(Int, v.minValue(0)),
  zone: Id,
  fish: Id,
  rarity: v.picklist(FISH_RARITIES),
  size: v.picklist(SHADOW_SIZES),
  pos: PointSchema,
  roam: v.pipe(Finite, v.minValue(0)),
  heading: Finite,
  move: v.exactOptional(v.strictObject({ from: PointSchema, since: Int, until: Int })),
  state: v.picklist(['free', 'approach', 'under', 'leaving', 'fleeing']),
  line: v.exactOptional(CharacterIdSchema),
  born: Int,
  ends: Int,
  watchOnly: v.exactOptional(v.literal(true)),
}) satisfies v.GenericSchema<FishShadow>;

/**
 * Les ombres de tous les coins éveillés (la liste entière: un message perdu ou remplacé ne laisse
 * rien de faux). 7 coins à 12 ombres au plus (`reglages.json`), plus celles qui s'effacent.
 */
export const ShadowsMessageSchema = v.strictObject({
  tick: v.pipe(Int, v.minValue(0)),
  shadows: v.pipe(v.array(FishShadowSchema), v.maxLength(128)),
});
export type ShadowsMessage = v.InferOutput<typeof ShadowsMessageSchema>;

function looksLikeEvent(value: unknown): value is WorldEvent {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).type === 'string';
}

export const EventsMessageSchema = v.strictObject({
  tick: v.pipe(Int, v.minValue(0)),
  events: v.pipe(v.array(v.custom<WorldEvent>(looksLikeEvent, 'événement invalide')), v.maxLength(256)),
});
export type EventsMessage = v.InferOutput<typeof EventsMessageSchema>;
