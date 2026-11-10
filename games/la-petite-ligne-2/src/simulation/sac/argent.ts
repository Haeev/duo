/**
 * Argent (cahier 4.6, R10): l'euro, compté en centimes entiers (jamais de flottant). Une bourse
 * par joueur, un coffre commun où les deux versent et retirent librement.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { SimContext } from '../noyau/systemes';
import { RULES } from '../regles/reglages';

/** Espace insécable entre le nombre et le symbole (typographie française). */
const NBSP = String.fromCharCode(0xa0);

/** « 1,20 € », « 12,00 € », « -0,50 € »: la seule mise en forme des montants, partagée par l'interface. */
export function formatEuros(cents: number): string {
  const whole = Math.trunc(Math.round(cents));
  const sign = whole < 0 ? '-' : '';
  const abs = Math.abs(whole);
  const euros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const rest = (abs % 100).toString().padStart(2, '0');
  return `${sign}${euros},${rest}${NBSP}€`;
}

function valid(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0;
}

/** Ajoute à la bourse, sans dépasser le plafond; renvoie ce qui est vraiment entré. */
export function earn(sim: SimContext, player: PlayerIndex, cents: number): number {
  if (!valid(cents)) return 0;
  const state = sim.world.players[player];
  const added = Math.min(cents, RULES.money.max - state.money);
  if (added <= 0) return 0;
  state.money += added;
  sim.touch('players');
  sim.emit({ type: 'money_changed', who: player, delta: added });
  return added;
}

export type MoneyRefusal = 'not-enough-money' | 'chest-empty' | 'chest-full' | 'purse-full';

/** Paie de sa bourse: tout ou rien. */
export function pay(sim: SimContext, player: PlayerIndex, cents: number): MoneyRefusal | null {
  const state = sim.world.players[player];
  if (!valid(cents) || state.money < cents) return 'not-enough-money';
  state.money -= cents;
  sim.touch('players');
  sim.emit({ type: 'money_changed', who: player, delta: -cents });
  return null;
}

/** Verse de la bourse au coffre commun. */
export function deposit(sim: SimContext, player: PlayerIndex, cents: number): MoneyRefusal | null {
  const state = sim.world.players[player];
  const common = sim.world.common;
  if (!valid(cents) || state.money < cents) return 'not-enough-money';
  if (common.chest + cents > RULES.money.max) return 'chest-full';
  state.money -= cents;
  common.chest += cents;
  sim.touch('players');
  sim.touch('common');
  sim.emit({ type: 'money_changed', who: player, delta: -cents });
  sim.emit({ type: 'money_changed', who: 'chest', delta: cents });
  return null;
}

/** Retire du coffre commun vers la bourse. */
export function withdraw(sim: SimContext, player: PlayerIndex, cents: number): MoneyRefusal | null {
  const state = sim.world.players[player];
  const common = sim.world.common;
  if (!valid(cents) || common.chest < cents) return 'chest-empty';
  if (state.money + cents > RULES.money.max) return 'purse-full';
  common.chest -= cents;
  state.money += cents;
  sim.touch('players');
  sim.touch('common');
  sim.emit({ type: 'money_changed', who: 'chest', delta: -cents });
  sim.emit({ type: 'money_changed', who: player, delta: cents });
  return null;
}
