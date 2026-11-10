# Conditions et effets (lot L3)

Évaluateurs des conditions et des effets des données (`src/donnees/schemas/regles.ts`), utilisés par les dialogues, les briques et, au jalon 2, les quêtes. Un type nouveau: son schéma, son cas ici, son contrôle dans `src/donnees/valider.ts`.

- `conditions.ts`: `evaluate`, `evaluateAll` (contexte: monde, contenu, joueur qui agit).
- `effets.ts`: `applyEffect`, `applyEffects`; chaque effet passe par le système qui possède ce qu'il touche.
- `memoire.ts`: faits retenus (`remember`, `recall`, compteurs `bump`), garde de taille `maxFacts`.
- `reglages.ts`: réglages du lot L3 que les fichiers de données n'ont pas encore (à migrer dans `reglages.json`).
