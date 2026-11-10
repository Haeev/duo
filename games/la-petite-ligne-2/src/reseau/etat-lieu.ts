/**
 * L'état lent du lieu courant (meubles, sol, meubles posés, habitants, commerces, et tout champ
 * qu'un système y ajoute) part par différences et par morceaux sur le canal 5, fiable (mission
 * M3, ADR 0022): la tranche entière d'un grand lieu ne tient plus dans un message (59 Ko au pire
 * d'Aubrune). Méthode générique: `par-cles.ts`.
 */
import { PlaceSlowSchema, type PlaceSlow } from '../etat/lieu';
import { createKeyedAssembler, KeyedPartSchema, type KeyedAssembler } from './par-cles';

export const PLACE_PART_CHANNEL = 5;
/** Budget d'un morceau, en octets de JSON (la moitié du budget d'une tranche). */
export const PLACE_PART_BUDGET_BYTES = 16_384;

export const PlacePartSchema = KeyedPartSchema;

export function createPlaceAssembler(): KeyedAssembler<PlaceSlow> {
  return createKeyedAssembler(PlaceSlowSchema);
}
