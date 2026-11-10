/** Textes de la pêche (la fête de la prise: une ligne, cahier 4.7). */
export const FISHING_TEXTS = {
  /** Fiche d'une espèce nouvelle. */
  newCatch: 'Nouveau au carnet !',
  record: 'Record',
  together: 'Épuisette de {nom}',
} as const;

/** Taille en centimètres, à la française: « 23,4 cm ». */
export function formatSize(sizeMm: number): string {
  const cm = Math.round(sizeMm) / 10;
  return `${cm.toFixed(1).replace('.', ',')} cm`;
}
