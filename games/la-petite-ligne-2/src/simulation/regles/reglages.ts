/**
 * Réglages du lot L3 que les fichiers de données n'ont pas encore (`reglages.json` et
 * `besoins.json` appartiennent au lot L0). Valeurs du cahier 4.4 à 4.9, typées et réunies ici
 * pour le game designer; elles migreront dans `donnees/commun/reglages.json` quand L0 aura ajouté
 * la section, sans changer les systèmes qui les lisent.
 */
import type { NeedState } from '../../donnees/schemas/besoins';
import { CENTS_MAX } from '../../donnees/schemas/communs';
import type { Effect } from '../../donnees/schemas/regles';

export { MEAL_PERKS, type MealPerk } from '../../donnees/schemas/objets';

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
  /**
   * Faits de souvenirs écrits par le moteur (`regles/souvenirs.ts`), lus par les dialogues: clés et
   * seuils. Par joueur, la clé reçoit `.j0` ou `.j1` (lire avec `"of"`).
   */
  readonly memories: {
    /** Première prise à la pêche de ce joueur (l'espèce, datée du jour): `<clé>.j<n>`. */
    readonly firstCatchKey: string;
    /** Aube arrivée sans que ce joueur dorme (la nuit ne s'est pas sautée au lit): `<clé>.j<n>`. */
    readonly sleeplessKey: string;
    /** Les deux dehors, l'un près de l'autre, sous l'un de ces temps (au nom du duo, daté du jour). */
    readonly rainTogetherKey: string;
    readonly rainWeathers: readonly string[];
    /** Distance (m) entre les deux joueurs pour être « ensemble » sous la pluie. */
    readonly togetherRadius: number;
  };
  readonly look: {
    /**
     * Préfixe du fait « apparence révélée » d'un joueur (`<préfixe>.j0`, `<préfixe>.j1`): absent,
     * le personnage n'a pas encore de visage et se montre en silhouette (`apparence.ts`).
     */
    readonly revealedPrefix: string;
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
  money: { max: CENTS_MAX },
  bonds: { firstTalkOfDay: 5, perHeart: 100, hearts: 5, noGainHygiene: ['blocked', 'low'] },
  dialogue: {
    failHygiene: ['blocked', 'low'],
    exchangeEffects: ['give_item', 'take_item', 'give_money', 'take_money', 'give_bag', 'remember'],
  },
  memories: {
    firstCatchKey: 'souvenirs.premiere-prise',
    sleeplessKey: 'souvenirs.nuit-blanche',
    rainTogetherKey: 'souvenirs.pluie-ensemble',
    rainWeathers: ['rain', 'storm'],
    togetherRadius: 8,
  },
  look: { revealedPrefix: 'joueurs.apparence' },
};
