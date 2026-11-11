/**
 * Faits écrits par les logements (`index.ts`), au nom du duo: `<lieu>.<logement>.<pièce>` vaut
 * `restored` quand la dernière étape de la pièce est finie, `<lieu>.<logement>.confort-<n>` vaut
 * `true` au palier de confort n (acquis pour de bon). Les quêtes et les dialogues les lisent par
 * `remembered`; le contrôle des quêtes les connaît (`housingFacts`).
 */
import type { FactValue } from '../../donnees/schemas/regles';
import type { HousingDef } from '../../donnees/schemas/logement';
import { HOUSING_TUNING } from './reglages';

export const RESTORED = 'restored';

export function housingFactKey(place: string, housing: string, detail: string): string {
  return `${place}.${housing}.${detail}`;
}

export function comfortFactDetail(level: number): string {
  return `confort-${String(level)}`;
}

/** Les faits que ce logement peut écrire, avec leurs valeurs. */
export function housingFacts(place: string, def: HousingDef): Map<string, Set<FactValue>> {
  const facts = new Map<string, Set<FactValue>>();
  for (const room of def.rooms)
    if (room.stages.length > 0)
      facts.set(housingFactKey(place, def.id, room.id), new Set<FactValue>([RESTORED]));
  HOUSING_TUNING.comfort.tiers.forEach((_, i) => {
    facts.set(housingFactKey(place, def.id, comfortFactDetail(i + 1)), new Set<FactValue>([true]));
  });
  return facts;
}
