/**
 * Réglages des commerces (cahier 4.6), typés et réunis ici pour le game designer. Les prix et les
 * goûts de chaque commerçant vivent dans ses données (`donnees/lieux/<lieu>/commerces/`).
 */
export interface ShopTuning {
  /** Le besoin du jour, écrit à la craie: cet objet est payé tant de fois son prix. */
  readonly dailyNeedFactor: number;
  /** Tout prix calculé s'arrondit à ce pas (centimes): « 1,20 € », jamais « 1,17 € ». */
  readonly priceStep: number;
  /** Distance (m) au commerçant ou à son comptoir pour acheter et vendre. */
  readonly reach: number;
  /**
   * Distance (m) entre le commerçant et l'emprise de son comptoir tenu (`held`) pour qu'il soit
   * tenu pour derrière son comptoir: la touche d'action s'adresse alors à lui.
   */
  readonly keeperReach: number;
  /** Exemplaires au plus par achat ou par vente. */
  readonly maxCount: number;
  /** Objets distincts retenus au plus par commerce à l'ouverture (mémoire des prix). */
  readonly rememberOnOpen: number;
  /**
   * Faits écrits par les commerces (`faits.ts`), lus par les dialogues et les quêtes:
   * `<prefix>.<commerce>.<firstBuy>.j<n>`, `<prefix>.<commerce>.<firstSale>.j<n>` (l'objet, daté du
   * premier jour), `<sold>.<commerce>.<objet>` (total vendu par le duo) et `.j<n>` (par joueur).
   */
  readonly facts: {
    readonly prefix: string;
    readonly firstBuy: string;
    readonly firstSale: string;
    readonly sold: string;
  };
}

export const SHOP_TUNING: ShopTuning = {
  dailyNeedFactor: 1.5,
  priceStep: 10,
  reach: 2.5,
  keeperReach: 1.5,
  maxCount: 99,
  rememberOnOpen: 40,
  facts: {
    prefix: 'commerces',
    firstBuy: 'premier-achat',
    firstSale: 'premiere-vente',
    sold: 'ventes',
  },
};
