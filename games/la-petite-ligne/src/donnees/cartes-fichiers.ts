/**
 * Les cartes du level designer, empaquetées avec le jeu. Le dossier peut être
 * vide: la carte de secours prend alors le relais (`carte.ts`).
 */
const modules = import.meta.glob<unknown>('../../donnees/cartes/*.json', { eager: true, import: 'default' });

export const MAP_FILES: Record<string, unknown> = Object.fromEntries(
  Object.entries(modules).map(([path, value]) => [path.slice(path.lastIndexOf('/') + 1), value]),
);
