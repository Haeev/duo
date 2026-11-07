// Données propres au chantier « service »: lire ses fichiers de `donnees/` avec `readFile`
// (schéma Valibot, problèmes ajoutés à `issues`) et décrire chaque clé dans `donnees/SCHEMA.md`.
import type { DataFiles } from '../donnees/charger';

export type ServiceContent = Readonly<Record<string, never>>;

export function loadServiceContent(files: DataFiles, issues: string[]): ServiceContent {
  // Aucun fichier propre encore: un fichier déposé sans son lecteur est signalé, pas ignoré.
  if ('service.json' in files)
    issues.push('service.json: lecteur à écrire dans src/service/donnees.ts');
  return {};
}
