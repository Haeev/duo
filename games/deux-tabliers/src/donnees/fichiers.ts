// Tous les JSON de `donnees/`, embarqués à la construction. Un fichier ajouté par un chantier
// y entre sans toucher à ce module.
import type { DataFiles } from './charger';

const PREFIX = '../../donnees/';
const modules = import.meta.glob<unknown>('../../donnees/**/*.json', {
  eager: true,
  import: 'default',
});

export const DATA_FILES: DataFiles = Object.fromEntries(
  Object.entries(modules).map(([path, data]) => [path.slice(PREFIX.length), data]),
);
