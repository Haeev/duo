/**
 * Les fichiers de données empaquetés avec le jeu, par chemin relatif à `donnees/`
 * (`commun/objets.json`, `lieux/essai-gare/lieu.json`). Seul fichier lié à Vite: `charger.ts`
 * reçoit une simple table, ce qui le rend testable avec des données fabriquées.
 */
const modules = import.meta.glob<unknown>('../../donnees/**/*.json', { eager: true, import: 'default' });

const PREFIX = '../../donnees/';

export const DATA_FILES: Readonly<Record<string, unknown>> = Object.fromEntries(
  Object.entries(modules).map(([path, value]) => [path.slice(PREFIX.length), value]),
);
