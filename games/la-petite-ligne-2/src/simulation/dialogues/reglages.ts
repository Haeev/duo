/** Réglages des dialogues (identifiants réservés du moteur; les textes sont dans les données). */

export interface DialogueTuning {
  /**
   * Page « boutique » ajoutée à la fin d'une conversation avec un commerçant (`commerce.ts`):
   * nœud réservé (refusé dans les fichiers de dialogue) et identifiants de ses deux options.
   */
  readonly shopOffer: { readonly node: string; readonly open: string; readonly leave: string };
  /**
   * Page dite à la place de l'offre quand un événement ferme le commerce (`lines.closed` de la
   * fiche: « Fermé pour la fête »): nœud réservé, une réplique du commerçant, puis la fin.
   */
  readonly shopClosed: { readonly node: string };
  /**
   * Page « livrer la commande » ajoutée à la fin d'une conversation avec qui reçoit la commande de
   * la semaine (`commande.json` du lieu, `simulation/commandes/`): nœud réservé et deux options.
   */
  readonly orderOffer: { readonly node: string; readonly open: string; readonly leave: string };
  /**
   * Priorité à partir de laquelle un dialogue a quelque chose à dire (histoire, quête, souvenir,
   * première rencontre, remarque sur l'hygiène): l'offre de la boutique ne le suit pas à sa
   * première écoute du jour. En dessous: conversation ordinaire (quotidien). Ce qui passe avant la
   * boutique au comptoir tenu ne dépend pas de la priorité: c'est l'histoire seule (`histoire.ts`).
   */
  readonly pendingPriority: number;
  /**
   * Fait daté « entendu » d'un dialogue qui se répète (`once` nul) et qui a quelque chose à dire:
   * `<préfixe>.<lieu>.<dialogue>.j<joueur>`, qui compte les écoutes du jour (daté du jour).
   * Entendue dans la journée, une réplique d'histoire ne repasse plus avant la boutique du
   * comptoir tenu; réentendue en face du commerçant, elle est suivie de l'offre de la boutique
   * (`commerce.ts`).
   */
  readonly heardPrefix: string;
}

export const DIALOGUES: DialogueTuning = {
  shopOffer: { node: 'offre-du-commerce', open: 'voir-le-commerce', leave: 'au-revoir' },
  shopClosed: { node: 'commerce-ferme' },
  orderOffer: { node: 'offre-de-la-commande', open: 'livrer-la-commande', leave: 'pas-maintenant' },
  pendingPriority: 10,
  heardPrefix: 'entendu',
};
