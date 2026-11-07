// Données propres au chantier « amenagement »: lire ses fichiers de `donnees/` avec `readFile`
// (schéma Valibot, problèmes ajoutés à `issues`) et décrire chaque clé dans `donnees/SCHEMA.md`.
import type { DataFiles } from '../donnees/charger';

export type ArrangementContent = Readonly<Record<string, never>>;

export function loadArrangementContent(files: DataFiles, issues: string[]): ArrangementContent {
  // Aucun fichier propre encore: un fichier déposé sans son lecteur est signalé, pas ignoré.
  if ('amenagement.json' in files)
    issues.push('amenagement.json: lecteur à écrire dans src/amenagement/donnees.ts');
  return {};
}
