/**
 * Mémoire des faits (cahier 4.9, R41): drapeaux et compteurs par clé `lieu.sujet.detail`, avec
 * l'auteur et le jour. Elle vit dans la tranche « progression »: toute écriture appelle `touch`.
 */
import * as v from 'valibot';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { FactKeySchema, type FactValue } from '../../donnees/schemas/regles';
import type { Fact } from '../../etat/progression';
import type { WorldState } from '../../etat/monde';
import type { SimContext } from '../noyau/systemes';
import { RULES } from './reglages';

export type FactAuthor = PlayerIndex | 'duo';

export function isFactKey(key: string): boolean {
  return v.is(FactKeySchema, key);
}

export function recall(world: Readonly<WorldState>, key: string): Fact | null {
  return world.progress.memory[key] ?? null;
}

/**
 * Retient un fait. Refuse une clé mal formée et, au-delà de `maxFacts`, toute clé nouvelle (une
 * clé déjà connue se réécrit toujours): la mémoire ne grossit jamais sans fin.
 */
export function remember(sim: SimContext, key: string, value: FactValue, by: FactAuthor): boolean {
  const memory = sim.world.progress.memory;
  if (!isFactKey(key)) return false;
  const known = key in memory;
  if (!known && Object.keys(memory).length >= RULES.memory.maxFacts) return false;
  const previous = memory[key];
  if (previous?.v === value && previous.by === by && previous.day === sim.world.common.day)
    return true;
  memory[key] = { v: value, by, day: sim.world.common.day };
  sim.touch('progress');
  return true;
}

/** Compteur: ajoute `amount` à la valeur numérique retenue (0 si absente ou d'un autre type). */
export function bump(sim: SimContext, key: string, by: FactAuthor, amount = 1): number {
  const before = recall(sim.world, key)?.v;
  const next = (typeof before === 'number' ? before : 0) + amount;
  return remember(sim, key, next, by) ? next : typeof before === 'number' ? before : 0;
}
