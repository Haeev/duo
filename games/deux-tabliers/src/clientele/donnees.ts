// Données propres au chantier « clientele »: lire ses fichiers de `donnees/` avec `readFile`
// (schéma Valibot, problèmes ajoutés à `issues`) et décrire chaque clé dans `donnees/SCHEMA.md`.
import type { DataFiles } from '../donnees/charger';

export type ClienteleContent = Readonly<Record<string, never>>;

export function loadClienteleContent(files: DataFiles, issues: string[]): ClienteleContent {
  // Aucun fichier propre encore: un fichier déposé sans son lecteur est signalé, pas ignoré.
  if ('clientele.json' in files)
    issues.push('clientele.json: lecteur à écrire dans src/clientele/donnees.ts');
  return {};
}
