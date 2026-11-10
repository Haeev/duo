/**
 * Modèle de vue de l'écran de la basse-cour (interface.md 5.5), pur: trois zones de gauche à
 * droite (la mangeoire, les bêtes, le nid), le focus, et le geste que dit la bulle.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Look } from '../../simulation/briques/types';
import {
  fillRefusal,
  petRefusal,
  shelterView,
  type ShelterView,
} from '../../simulation/elevage/abri';

/** Une zone focalisable: la mangeoire, une bête (son numéro), le nid. */
export type CoopFocus =
  | { readonly kind: 'feeder' }
  | { readonly kind: 'animal'; readonly animal: number }
  | { readonly kind: 'nest' };

export type CoopGesture = 'fill' | 'pet' | 'collect';

export interface CoopModel {
  readonly view: ShelterView;
  readonly focus: CoopFocus;
  readonly index: number;
  readonly zones: readonly CoopFocus[];
  readonly gesture: CoopGesture;
  /** Clé de refus du geste (`no-feed`, `already-petted`...), `null`: l'appui agit. */
  readonly refusal: string | null;
}

export function zonesOf(view: ShelterView): CoopFocus[] {
  return [
    { kind: 'feeder' },
    ...view.animals.map((animal): CoopFocus => ({ kind: 'animal', animal: animal.id })),
    { kind: 'nest' },
  ];
}

export function coopModel(
  look: Look,
  player: PlayerIndex,
  target: string,
  index: number,
): CoopModel | null {
  const view = shelterView(look, target);
  if (view === null) return null;
  const zones = zonesOf(view);
  const at = Math.max(0, Math.min(zones.length - 1, index));
  const focus = zones[at] ?? { kind: 'feeder' };
  let gesture: CoopGesture;
  let refusal: string | null;
  if (focus.kind === 'feeder') {
    gesture = 'fill';
    refusal = fillRefusal(look, player, target);
  } else if (focus.kind === 'animal') {
    gesture = 'pet';
    refusal = petRefusal(look, player, target, focus.animal);
  } else {
    gesture = 'collect';
    refusal = view.nest.count === 0 ? 'nest-empty' : null;
  }
  return { view, focus, index: at, zones, gesture, refusal };
}
