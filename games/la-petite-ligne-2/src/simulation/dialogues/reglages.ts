/** Réglages des dialogues (identifiants réservés du moteur; les textes sont dans les données). */

export interface DialogueTuning {
  /**
   * Page « boutique » ajoutée à la fin d'une conversation avec un commerçant (`commerce.ts`):
   * nœud réservé (refusé dans les fichiers de dialogue) et identifiants de ses deux options.
   */
  readonly shopOffer: { readonly node: string; readonly open: string; readonly leave: string };
}

export const DIALOGUES: DialogueTuning = {
  shopOffer: { node: 'offre-du-commerce', open: 'voir-le-commerce', leave: 'au-revoir' },
};
