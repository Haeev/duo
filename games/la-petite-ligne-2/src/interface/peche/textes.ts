/** Textes de la pêche (la fête de la prise: une ligne, cahier 4.7). */
export const FISHING_TEXTS = {
  /** Fiche d'une espèce nouvelle. */
  newCatch: 'Nouveau au carnet !',
  record: 'Record',
  together: 'Épuisette de {nom}',
  /** Fête vue de l'épuisette (pêche à deux). */
  rodBy: 'Canne de {nom}',
  /** Appât de la ligne, pendant la visée (`{touche}`: la touche pour en changer). */
  bait: 'Appât: {appat} ({touche} pour changer)',
  noBait: 'Sans appât ({touche} pour changer)',
  /** Pêche à deux: consignes de chaque rôle (les deux écrans ne montrent pas la même chose). */
  pairRod: 'Tu sens où elle tire, sans la voir. Tiens {espace} quand elle tire, dis de quel côté.',
  pairNet:
    'Tu vois l’ombre, sans rien sentir. {gauche} et {droite}: l’épuisette. {espace} quand elle remonte.',
  pairStrength: 'Ses forces',
  /** Plongeon raté, sur les deux écrans: rien n'est perdu, elle replonge. */
  netMissed: {
    deep: 'Trop tôt: elle était au fond. Attends qu’elle remonte.',
    side: 'À côté ! Elle a replongé. Écoute de quel côté elle tire.',
    slack: 'La canne ne tenait pas: elle a replongé. Tiens bon en même temps.',
  },
  /** Elle a cassé la ligne: aucune punition, on peut réessayer. */
  pairEscaped: 'Elle a filé. Elle reviendra: réessayez ce soir ou demain.',
} as const;

/** Taille en centimètres, à la française: « 23,4 cm ». */
export function formatSize(sizeMm: number): string {
  const cm = Math.round(sizeMm) / 10;
  return `${cm.toFixed(1).replace('.', ',')} cm`;
}
