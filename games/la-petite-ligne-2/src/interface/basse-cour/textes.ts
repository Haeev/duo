/** Textes de l'écran de la basse-cour (tutoiement, aucun texte explicatif: des verbes et des noms). */
export const COOP_TEXTS = {
  verbs: { fill: 'Remplir', pet: 'Caresser', collect: 'Ramasser' },
  days: (n: number): string => (n <= 1 ? 'jour' : 'jours'),
  neighbour: 'zone voisine',
  provisional: 'Scène provisoire en 2D',
  /** Noms accessibles des zones et des cartes. */
  aria: {
    feeder: (days: number | null): string =>
      days === null
        ? 'Mangeoire'
        : `Mangeoire : ${String(days)} ${days <= 1 ? 'jour' : 'jours'} de grain`,
    nest: (n: number): string => (n === 0 ? 'Nid vide' : `Nid : ${String(n)} à ramasser`),
    animal: (name: string, hearts: number, max: number, laid: boolean, hungry: boolean): string =>
      `${name}, ${String(hearts)} ${hearts <= 1 ? 'cœur' : 'cœurs'} sur ${String(max)}${laid ? ', a pondu' : ''}${hungry ? ', a faim' : ''}`,
    free: 'Place libre',
    list: 'Tes bêtes',
  },
  refusals: {
    'no-feed': 'Plus de grain',
    'feeder-full': 'Mangeoire pleine',
    'nest-empty': 'Nid vide',
    'already-petted': 'Déjà caressée',
    'shelter-full': 'Plus de place',
  } as Readonly<Record<string, string>>,
} as const;
