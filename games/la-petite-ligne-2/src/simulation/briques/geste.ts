/**
 * Le geste d'une action, lu sans rien modifier: l'hôte s'en sert pour le lancer, l'invité pour le
 * prédire au pas de l'appui (ADR 0020). Ne lit que l'état transmis.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { SIM_HZ } from '../noyau/constantes';
import type { Intent } from '../noyau/entrees';
import { findProp } from '../noyau/obstacles';
import { BRICK_BEHAVIOURS, ENTITY_BEHAVIOURS } from './registre';
import type { ActionId, AimKind, GestureSpec, Look } from './types';
import { aimOf, behaviourOf, brickView } from './visee';

/** Geste joué avant l'effet de cette action sur cette cible, `null` si l'effet est immédiat. */
export function gestureOf(
  look: Look,
  player: PlayerIndex,
  kind: AimKind,
  id: string,
  action: ActionId,
): GestureSpec | null {
  if (kind === 'ground') return ENTITY_BEHAVIOURS.pickup.gesture?.(look, player, id) ?? null;
  if (kind === 'villager') return ENTITY_BEHAVIOURS.talk.gesture?.(look, player, id) ?? null;
  if (action === 'pickup' || action === 'talk') return null;
  const placeContent = look.content.places[look.world.common.place];
  const place = look.world.places[look.world.common.place];
  if (placeContent === undefined || place === undefined) return null;
  const prop = findProp(placeContent, place, id);
  const brick =
    prop === null
      ? undefined
      : look.content.props[prop.type]?.bricks.find((b) => b.brick === action);
  if (prop === null || brick === undefined) return null;
  const view = brickView(place, prop, brick);
  return behaviourOf(BRICK_BEHAVIOURS, action)?.gesture?.(look, player, view) ?? null;
}

/** Durée d'un geste en pas: aucune action courante ne bloque plus que `gestures.maxSeconds`. */
export function gestureTicks(content: Content, spec: GestureSpec): number {
  const seconds = Math.min(spec.seconds, content.settings.gestures.maxSeconds);
  return Math.max(1, Math.round(seconds * SIM_HZ));
}

/**
 * Le geste que l'hôte lancera pour cette intention du joueur, `null` s'il n'y en a pas (aucune
 * cible, refus, effet immédiat). Contrat `Predictor.gesture` du réseau.
 */
export function predictedGesture(
  look: Look,
  player: PlayerIndex,
  intent: Intent,
): { clip: string; target: string | null; ticks: number; long: boolean } | null {
  if (intent.type !== 'act') return null;
  const aim = aimOf(look, player);
  if (aim?.refusal !== null) return null;
  const spec = gestureOf(look, player, aim.kind, aim.id, aim.action);
  if (spec === null) return null;
  return { clip: spec.clip, target: aim.id, ticks: gestureTicks(look.content, spec), long: false };
}
