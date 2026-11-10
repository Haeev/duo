/**
 * Échanges d'un dialogue (ou d'une étape): objets donnés et repris, argent payé et reçu, à celui
 * qui agit ou à chacun des deux (`to: 'duo'`). Un échange est tout ou rien: avant de l'appliquer,
 * `exchangeRefusal` le rejoue sur une copie des poches et des bourses et dit pourquoi il échouerait
 * (poches pleines, argent insuffisant, objet manquant, chez soi ou chez l'autre).
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Effect } from '../../donnees/schemas/regles';
import type { PlayerState } from '../../etat/joueur';
import type { ReadonlyWorld } from '../../etat/monde';
import { addItem, removeItem } from '../sac/inventaire';

export type ExchangeRefusal =
  | 'pockets-full'
  | 'other-pockets-full'
  | 'not-enough-money'
  | 'other-not-enough-money'
  | 'missing-item'
  | 'other-missing-item';

const CHECKED: ReadonlySet<Effect['type']> = new Set<Effect['type']>([
  'give_item',
  'take_item',
  'give_money',
  'take_money',
]);

/** Joueurs visés par un effet: celui qui agit, ou les deux. */
export function effectTargets(actor: PlayerIndex, to: 'actor' | 'duo' | undefined): PlayerIndex[] {
  return to === 'duo' ? [0, 1] : [actor];
}

function refusal(
  actor: PlayerIndex,
  player: PlayerIndex,
  reason: 'pockets-full' | 'not-enough-money' | 'missing-item',
): ExchangeRefusal {
  return player === actor ? reason : `other-${reason}`;
}

/** Pourquoi ces effets échoueraient maintenant, `null` s'ils passent tous. Pur. */
export function exchangeRefusal(
  look: { readonly world: ReadonlyWorld; readonly content: Content },
  actor: PlayerIndex,
  effects: readonly Effect[],
): ExchangeRefusal | null {
  if (!effects.some((e) => CHECKED.has(e.type))) return null;
  // Copies jetables: l'échange se rejoue dans l'ordre (reprendre puis donner libère des cases).
  const pockets: [PlayerState, PlayerState] = [
    structuredClone(look.world.players[0]) as PlayerState,
    structuredClone(look.world.players[1]) as PlayerState,
  ];
  for (const effect of effects) {
    if (
      effect.type !== 'give_item' &&
      effect.type !== 'take_item' &&
      effect.type !== 'give_money' &&
      effect.type !== 'take_money'
    )
      continue;
    for (const p of effectTargets(actor, effect.to)) {
      const state = pockets[p];
      switch (effect.type) {
        case 'take_item':
          if (!removeItem(state, effect.item, effect.count))
            return refusal(actor, p, 'missing-item');
          break;
        case 'give_item':
          if (addItem(look.content, state, effect.item, effect.count) > 0)
            return refusal(actor, p, 'pockets-full');
          break;
        case 'take_money':
          if (state.money < effect.amount) return refusal(actor, p, 'not-enough-money');
          state.money -= effect.amount;
          break;
        case 'give_money':
          state.money += effect.amount;
          break;
      }
    }
  }
  return null;
}
