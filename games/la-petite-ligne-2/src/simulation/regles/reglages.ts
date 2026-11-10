/**
 * Réglages du lot L3 que les fichiers de données n'ont pas encore (`reglages.json` et
 * `besoins.json` appartiennent au lot L0). Valeurs du cahier 4.4 à 4.9, typées et réunies ici
 * pour le game designer; elles migreront dans `donnees/commun/reglages.json` quand L0 aura ajouté
 * la section, sans changer les systèmes qui les lisent.
 */
import type { NeedState } from '../../donnees/schemas/besoins';
import type { Effect } from '../../donnees/schemas/regles';

/** Bonus exclusif d'un repas spécial pris à deux (cahier 4.4, R26): vocabulaire du moteur, pas un plat. */
export const MEAL_PERKS = [
  'extra_catch',
  'no_tool_wear',
  'better_prices',
  'night_rare_glow',
] as const;
export type MealPerk = (typeof MEAL_PERKS)[number];

export interface RulesSettings {
  readonly memory: {
    /** Garde de taille de `progress.memory` (sauvegarde et tranche « progression »). */
    readonly maxFacts: number;
  };
  readonly needs: {
    /** Nuit au lit: ce que perdent la faim et l'hygiène au réveil (le sommeil vient de la brique). */
    readonly nightHungerLoss: number;
    readonly nightHygieneLoss: number;
    /** Points d'hygiène perdus par geste salissant (bêcher, fouiller, poulailler). */
    readonly dirtyGestureLoss: number;
    /** Repas spécial à deux: faim des deux joueurs après le repas. */
    readonly specialMealHunger: number;
    /** Le bonus du repas tient tant que la faim reste au-dessus de ce seuil (strictement). */
    readonly specialMealKeepAbove: number;
    /** Part de chance d'un exemplaire en plus (`extra_catch`). */
    readonly extraCatchChance: number;
    /** Multiplicateur des prix de rachat (`better_prices`). */
    readonly betterPrices: number;
  };
  readonly bag: {
    /** Distance (m) pour ramasser au sol, donner à l'autre joueur ou ranger dans un meuble. */
    readonly reach: number;
  };
  readonly money: {
    /** Plafond d'une bourse et du coffre, en centimes. */
    readonly max: number;
  };
  readonly bonds: {
    /** Points d'une première conversation du jour (cahier 4.9). */
    readonly firstTalkOfDay: number;
    /** Points par cœur; cinq cœurs. */
    readonly perHeart: number;
    readonly hearts: number;
    /** États d'hygiène où aucun point d'amitié n'est gagné. */
    readonly noGainHygiene: readonly NeedState[];
  };
  readonly dialogue: {
    /** États d'hygiène où un échange (option à effet) échoue et se retente une fois lavé. */
    readonly failHygiene: readonly NeedState[];
    /** Effets qui font d'une option un échange. */
    readonly exchangeEffects: readonly Effect['type'][];
  };
}

export const RULES: RulesSettings = {
  memory: { maxFacts: 4000 },
  needs: {
    nightHungerLoss: 15,
    nightHygieneLoss: 10,
    dirtyGestureLoss: 1,
    specialMealHunger: 100,
    specialMealKeepAbove: 50,
    extraCatchChance: 0.1,
    betterPrices: 1.1,
  },
  bag: { reach: 1.6 },
  money: { max: 9999 },
  bonds: { firstTalkOfDay: 5, perHeart: 100, hearts: 5, noGainHygiene: ['blocked', 'low'] },
  dialogue: {
    failHygiene: ['blocked', 'low'],
    exchangeEffects: ['give_item', 'take_item', 'give_money', 'give_bag', 'remember'],
  },
};
