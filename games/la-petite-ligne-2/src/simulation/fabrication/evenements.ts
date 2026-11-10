/** Événements de l'atelier: l'interface, le rendu et le son des deux machines les lisent. */
import * as v from 'valibot';
import {
  CentsSchema,
  FiniteSchema,
  IdSchema,
  IntSchema,
  PlayerIndexSchema,
} from '../../donnees/schemas/communs';
import { CRAFT_STATIONS } from '../../donnees/schemas/plan';

const Ratio = v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1));

export const CRAFT_EVENTS = [
  /** Le joueur a ouvert l'atelier de ce poste: son interface le montre. */
  v.strictObject({
    type: v.literal('workshop_opened'),
    player: PlayerIndexSchema,
    target: IdSchema,
    station: v.picklist(CRAFT_STATIONS),
  }),
  v.strictObject({
    type: v.literal('craft_started'),
    player: PlayerIndexSchema,
    target: IdSchema,
    plan: IdSchema,
    variant: v.pipe(IntSchema, v.minValue(0)),
  }),
  /** Un coup porté: l'ouvrage avance (`progress` de 0 à 1); les deux écrans le montrent. */
  v.strictObject({
    type: v.literal('craft_hit'),
    player: PlayerIndexSchema,
    target: IdSchema,
    plan: IdSchema,
    progress: Ratio,
  }),
  v.strictObject({
    type: v.literal('craft_cancelled'),
    player: PlayerIndexSchema,
    target: IdSchema,
  }),
  /** L'objet est fait; `first`: jamais fabriqué, on le fête; `together`: les deux y ont frappé. */
  v.strictObject({
    type: v.literal('crafted'),
    player: PlayerIndexSchema,
    target: IdSchema,
    plan: IdSchema,
    item: IdSchema,
    first: v.boolean(),
    together: v.boolean(),
  }),
  /** Plan appris pour les deux (papier lu à l'atelier). */
  v.strictObject({ type: v.literal('plan_learned'), player: PlayerIndexSchema, plan: IdSchema }),
  /** Outil laissé à l'artisan, rendu à partir de ce jour (amélioration « prête demain »). */
  v.strictObject({
    type: v.literal('tool_ordered'),
    player: PlayerIndexSchema,
    item: IdSchema,
    day: v.pipe(IntSchema, v.minValue(1)),
  }),
  /** Réparation payée faite à l'atelier, pour ce prix. */
  v.strictObject({
    type: v.literal('tool_mended'),
    player: PlayerIndexSchema,
    item: IdSchema,
    cents: CentsSchema,
  }),
  /** Un tour de meule: l'usure remonte jusqu'à `ratio`. */
  v.strictObject({
    type: v.literal('tool_sharpened'),
    player: PlayerIndexSchema,
    item: IdSchema,
    ratio: Ratio,
  }),
] as const;
