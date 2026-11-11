/**
 * Les portraits dessinés (SVG en texte, environ 2,3 Mo), dans un lot à part chargé par
 * `loadPortraits()` de `portrait.ts`: ils ne pèsent plus sur l'analyse du lot principal au
 * démarrage, et se chargent pendant celui des modèles.
 */
const DRAWN = import.meta.glob<string>('../../assets/commun/interface/portraits/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Texte de chaque portrait, par identifiant (nom du fichier sans `.svg`). */
export const DRAWN_PORTRAITS: ReadonlyMap<string, string> = new Map(
  Object.entries(DRAWN).map(([path, svg]) => [path.slice(path.lastIndexOf('/') + 1, -4), svg]),
);
