/**
 * Jauges et paliers des besoins (cahier 4.4, R23 à R26), d'après `donnees/commun/besoins.json`.
 * Fonctions pures: le système (`index.ts`) les applique à chaque pas.
 */
import type { Content } from '../../donnees/charger';
import type { NeedDef, NeedState } from '../../donnees/schemas/besoins';
import { NEED_IDS, type NeedId, type PlayerIndex } from '../../donnees/schemas/communs';
import type { PlayerState } from '../../etat/joueur';
import type { ReadonlyWorld } from '../../etat/monde';
import { mealPerkOf } from './repas';
import { RULES, type MealPerk } from '../regles/reglages';

export function needDef(content: Content, need: NeedId): NeedDef | null {
  return content.needs.needs.find((def) => def.id === need) ?? null;
}

function rawTier(def: NeedDef, value: number): { state: NeedState; from: number } {
  let found = { state: 'neutral' as NeedState, from: 0 };
  for (const tier of def.tiers)
    if (value >= tier.from) found = { state: tier.state, from: tier.from };
  return found;
}

/**
 * Palier d'une jauge. Un bonus tient jusqu'à repasser sous son seuil moins `hysteresis`
 * (R25): la jauge qui oscille autour du seuil ne fait pas clignoter le médaillon.
 */
export function tierFor(
  content: Content,
  need: NeedId,
  value: number,
  previous: NeedState,
): NeedState {
  const def = needDef(content, need);
  if (def === null) return 'neutral';
  const raw = rawTier(def, value);
  if (previous !== 'bonus' || raw.state === 'bonus') return raw.state;
  const bonus = def.tiers.find((tier) => tier.state === 'bonus');
  return bonus !== undefined && value >= bonus.from - content.needs.hysteresis
    ? 'bonus'
    : raw.state;
}

/** Points perdus par une jauge pendant `dt` secondes réelles. */
export function decayFor(content: Content, need: NeedId, dt: number, effort: boolean): number {
  const def = needDef(content, need);
  if (def === null) return 0;
  return (def.decayPerMinute / 60) * dt * (effort ? def.effortFactor : 1);
}

export function clampGauge(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Modificateurs nommés, lus par les autres systèmes: déplacement (`speed`), gestes d'outil
 * (`toolSpeed`, plus grand: plus rapide), mini-jeux (`minigame`), amitié (`bond`, 0: aucun gain),
 * chance d'une entrée rare (`rareLuck`), et le bonus de repas en cours.
 */
export interface NeedModifiers {
  speed: number;
  toolSpeed: number;
  minigame: number;
  bond: number;
  rareLuck: number;
  /** Chance d'un exemplaire en plus par prise (repas `extra_catch`). */
  extraCatch: number;
  /** Multiplicateur des prix de rachat par les commerçants (repas `better_prices`). */
  sellPrice: number;
  perk: MealPerk | null;
}

type Factor = 'speed' | 'toolSpeed' | 'minigame' | 'bond';
const FACTORS: readonly Factor[] = ['speed', 'toolSpeed', 'minigame', 'bond'];

export function neutralModifiers(): NeedModifiers {
  return {
    speed: 1,
    toolSpeed: 1,
    minigame: 1,
    bond: 1,
    rareLuck: 1,
    extraCatch: 0,
    sellPrice: 1,
    perk: null,
  };
}

/**
 * Produit des effets des trois paliers. Les bonus sont plafonnés ensemble (`maxBonus`, « on ne
 * devient pas un dieu parce qu'on a dîné »); les malus ne le sont pas. `out` évite une allocation.
 */
export function modifiersOf(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
  out: NeedModifiers = neutralModifiers(),
): NeedModifiers {
  const state = world.players[player];
  for (const factor of FACTORS) {
    let gain = 1;
    let loss = 1;
    for (const need of NEED_IDS) {
      const def = needDef(content, need);
      const tier = def?.tiers.find((t) => t.state === state.tiers[need]);
      const value = tier?.modifiers[factor] ?? 1;
      if (value >= 1) gain *= value;
      else loss *= value;
    }
    out[factor] = Math.min(gain, content.needs.maxBonus) * loss;
  }
  if (RULES.bonds.noGainHygiene.includes(state.tiers.hygiene)) out.bond = 0;
  const allBonus = NEED_IDS.every((need) => state.tiers[need] === 'bonus');
  out.rareLuck = allBonus ? content.needs.allBonusRareLuck : 1;
  const perk = mealPerkOf(world, player);
  out.perk = perk;
  out.extraCatch = perk === 'extra_catch' ? RULES.needs.extraCatchChance : 0;
  out.sellPrice = perk === 'better_prices' ? RULES.needs.betterPrices : 1;
  return out;
}

/** Besoin qui réserve la touche d'action à son seul soulagement (faim ou sommeil à 0), ou `null`. */
export function onlyReliefFor(
  content: Content,
  state: { readonly tiers: Readonly<PlayerState['tiers']> },
): NeedId | null {
  for (const need of NEED_IDS) {
    const tier = needDef(content, need)?.tiers.find((t) => t.state === state.tiers[need]);
    if (tier?.onlyRelief === true) return need;
  }
  return null;
}
