/** Textes de la cuisine: presque rien, les images parlent (tutoiement). */
export const COOK_TEXTS = {
  marks: { 1: 'Pas mal', 2: 'Bien', 3: 'Parfait !' } as Readonly<Record<number, string>>,
  newDish: 'Nouveau plat !',
  waitPartner: 'On attend l’autre part',
  learned: 'Recette apprise',
  meal: 'Bon appétit !',
  hints: {
    chop: 'en rythme',
    stir: 'en alternance',
    heat: 'tiens, relâche dans l’or',
    season: 'sur la pincée',
    plate: 'la suite',
  } as Readonly<Record<string, string>>,
} as const;
