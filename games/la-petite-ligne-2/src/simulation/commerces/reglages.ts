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
  /** Exemplaires au plus par achat ou par vente. */
  readonly maxCount: number;
  /** Objets distincts retenus au plus par commerce à l'ouverture (mémoire des prix). */
  readonly rememberOnOpen: number;
}

export const SHOP_TUNING: ShopTuning = {
  dailyNeedFactor: 1.5,
  priceStep: 10,
  reach: 2.5,
  maxCount: 99,
  rememberOnOpen: 40,
};
