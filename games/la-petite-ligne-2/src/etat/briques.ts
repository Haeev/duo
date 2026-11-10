/**
 * État des briques d'un meuble posé (carte ou joueur). Seules les briques qui ont une mémoire en
 * ont un: un stock qui baisse, des cases de rangement, des places assises, une porte ouverte.
 */
import * as v from 'valibot';
import { IntSchema, PlayerIndexSchema, TickSchema } from '../donnees/schemas/communs';
import type { Brick } from '../donnees/schemas/briques';
import { StackSchema } from './joueur';
import { FieldStateSchema, HarvestStateSchema } from '../donnees/schemas/recolte-briques';

const Seat = v.nullable(PlayerIndexSchema);

export const BrickStatesSchema = v.strictObject({
  /** Stock restant et pas de son retour (`null`: plein). */
  gather: v.exactOptional(
    v.strictObject({ left: v.pipe(IntSchema, v.minValue(0)), refillAt: v.nullable(TickSchema) }),
  ),
  /** Joueur assis à chaque place. */
  sit: v.exactOptional(v.pipe(v.array(Seat), v.maxLength(4))),
  /** Joueur couché à chaque place. */
  sleep: v.exactOptional(v.pipe(v.array(Seat), v.maxLength(2))),
  store: v.exactOptional(v.pipe(v.array(v.nullable(StackSchema)), v.maxLength(40))),
  open: v.exactOptional(v.boolean()),
  /** Point de récolte et terre cultivable (`donnees/schemas/recolte-briques.ts`). */
  harvest: v.exactOptional(HarvestStateSchema),
  field: v.exactOptional(FieldStateSchema),
});
export type BrickStates = v.InferOutput<typeof BrickStatesSchema>;

/** État de départ des briques d'un meuble, d'après ses données. Les briques sans mémoire n'y figurent pas. */
export function initialBrickStates(bricks: readonly Brick[]): BrickStates {
  const states: BrickStates = {};
  for (const brick of bricks) {
    switch (brick.brick) {
      case 'gather':
        if (brick.stock !== null) states.gather = { left: brick.stock.count, refillAt: null };
        break;
      case 'sit':
        states.sit = Array.from({ length: brick.seats }, () => null);
        break;
      case 'sleep':
        states.sleep = Array.from({ length: brick.places }, () => null);
        break;
      case 'store':
        states.store = Array.from({ length: brick.slots }, () => null);
        break;
      case 'open':
        states.open = brick.startsOpen;
        break;
      case 'relieve':
      case 'shop':
      case 'cook':
      case 'repair':
      case 'travel':
      case 'mirror':
      case 'craft':
        break;
      case 'harvest':
        states.harvest = { work: 0, back: null };
        break;
      case 'field':
        states.field = { cells: [], work: null };
        break;
    }
  }
  return states;
}
