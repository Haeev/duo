/**
 * Besoin à 0 (cahier 4.4, CA-09): quand la faim ou le sommeil est à 0 (palier `onlyRelief` de
 * `besoins.json`), la touche d'action ne sert plus qu'à ce qui soulage ce besoin. Les listes
 * vivent dans `RULES.needs.exhausted`; ici, la lecture pure, partagée par la visée (hôte et
 * invité voient le même refus avant l'appui) et par le pas (intentions de travail).
 */
import type { NeedId, PlayerIndex } from '../../donnees/schemas/communs';
import type { ActionId, Look } from '../briques/types';
import type { Intent } from '../noyau/entrees';
import { RULES } from '../regles/reglages';
import { onlyReliefFor } from './jauges';

/** Clé de texte du refus: elle dit quoi faire (`interface/textes.ts`). */
export function exhaustedReason(need: NeedId): string {
  return `exhausted-${need}`;
}

/** Le besoin à 0 qui réserve les gestes de ce joueur, ou `null`. */
export function exhaustedNeed(look: Look, player: PlayerIndex): NeedId | null {
  return onlyReliefFor(look.content, look.world.players[player]);
}

/** Refus d'une action de la touche d'action pour cause de besoin à 0, ou `null`. */
export function exhaustedActionRefusal(
  look: Look,
  player: PlayerIndex,
  action: ActionId,
): string | null {
  const need = exhaustedNeed(look, player);
  if (need === null) return null;
  const rule = RULES.needs.exhausted;
  if (rule.free.includes(action)) return null;
  if (rule.relief[need]?.actions.includes(action) === true) return null;
  return exhaustedReason(need);
}

/** Refus d'une intention de travail (filet, pêche, atelier) pour cause de besoin à 0, ou `null`. */
export function exhaustedIntentRefusal(
  look: Look,
  player: PlayerIndex,
  type: Intent['type'],
): string | null {
  const rule = RULES.needs.exhausted;
  if (!rule.gatedIntents.includes(type)) return null;
  const need = exhaustedNeed(look, player);
  if (need === null) return null;
  if (rule.relief[need]?.intents.includes(type) === true) return null;
  return exhaustedReason(need);
}
