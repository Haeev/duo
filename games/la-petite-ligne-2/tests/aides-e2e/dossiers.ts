// Noms des dossiers temporaires de la recette, propres à chaque copie du dépôt: plusieurs
// worktrees lancent leur recette en même temps sur la même machine, et un dossier commun dans
// le dossier temporaire mêlait leurs sauvegardes de départ et leurs pièces jointes.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PACKAGE_DIR = fileURLToPath(new URL('../..', import.meta.url));

/** `prefixe-<empreinte du chemin du paquet>`, stable d'un lancement à l'autre. */
export function e2eTempName(prefix: string): string {
  return `${prefix}-${createHash('sha1').update(PACKAGE_DIR).digest('hex').slice(0, 10)}`;
}
