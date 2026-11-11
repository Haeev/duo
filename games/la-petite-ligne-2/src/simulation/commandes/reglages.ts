/**
 * Réglages de la commande de la semaine et du courrier (`simulation/commandes/`). Les lignes, les
 * prix, le nombre de lignes et les répliques sont dans les données du lieu (`commande.json`,
 * `commandes/`, `lettres/`); ici, ce qui vaut pour tous les lieux.
 */
export const ORDERS = {
  /**
   * Clés des faits (`progress.memory`, quatre segments au plus): toute la commande y tient, ce qui
   * la sauve et l'envoie à l'invité sans rien changer au format ni au réseau.
   */
  facts: {
    /** `commande.<lieu>.pour`: jour de jeu de la livraison attendue (la commande en cours). */
    due: 'commande',
    dueField: 'pour',
    /** `commande.<lieu>.lignes-livrees`: lignes livrées en entier depuis le début (compteur). */
    linesDone: 'lignes-livrees',
    /** `commande.<lieu>.unites`: unités livrées depuis le début (compteur). */
    units: 'unites',
    /** `commande-ligne.<lieu>.<ligne>`: quantité demandée d'une ligne de la commande en cours. */
    asked: 'commande-ligne',
    /** `commande-livre.<lieu>.<ligne>`: quantité déjà livrée de cette ligne. */
    delivered: 'commande-livre',
    /** `objets.obtenu.<objet>`: le duo a eu cet objet en main au moins une fois. */
    obtained: 'objets.obtenu',
    /** `courrier.<lieu>.<lettre>`: `waiting` (dans le fourgon) ou `taken` (remise, lue). */
    mail: 'courrier',
    /** `courrier-passage.<lieu>`: jour du dernier passage qui a apporté le courrier. */
    mailVisit: 'courrier-passage',
    /** Préfixe des ventes au comptoir (`commerces/faits.ts`): un objet vendu a été obtenu. */
    sold: 'ventes',
  },
  mailWaiting: 'waiting',
  mailTaken: 'taken',
  /** Distance (m) entre le joueur et qui reçoit, au-delà de laquelle on ne livre plus. */
  reach: 3,
  /** Jours regardés en avant pour trouver la prochaine livraison (une semaine et un peu plus). */
  lookahead: 9,
  /** Graines du tirage (mêlées à la graine de la partie, au lieu et au jour de livraison). */
  salts: { size: 41, table: 43, line: 47, count: 53 },
} as const;
