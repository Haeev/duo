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
   * Priorité à partir de laquelle un dialogue a quelque chose à dire (histoire, quête, souvenir,
   * première rencontre, remarque sur l'hygiène): au comptoir tenu, il passe avant la boutique, et
   * l'offre de la boutique ne le suit pas. En dessous: conversation ordinaire (quotidien).
   */
  readonly pendingPriority: number;
  /**
   * Fait daté « entendu » d'un dialogue qui se répète (`once` nul) et qui a quelque chose à dire:
   * `<préfixe>.<lieu>.<dialogue>.j<joueur>`, qui compte les écoutes du jour (daté du jour).
   * Entendu dans la journée, il ne repasse plus avant la boutique du comptoir tenu; réentendu en
   * face du commerçant, il est suivi de l'offre de la boutique (`commerce.ts`).
   */
  readonly heardPrefix: string;
}

export const DIALOGUES: DialogueTuning = {
  shopOffer: { node: 'offre-du-commerce', open: 'voir-le-commerce', leave: 'au-revoir' },
  shopClosed: { node: 'commerce-ferme' },
  pendingPriority: 10,
  heardPrefix: 'entendu',
};
