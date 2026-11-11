# Conditions et effets (lot L3)

Évaluateurs des conditions et des effets des données (`src/donnees/schemas/regles.ts`), utilisés par les dialogues, les briques et, au jalon 2, les quêtes. Un type nouveau: son schéma, son cas ici, son contrôle dans `src/donnees/valider.ts`.

- `conditions.ts`: `evaluate`, `evaluateAll` (contexte: monde, contenu, joueur qui agit).
- `effets.ts`: `applyEffect`, `applyEffects`; chaque effet passe par le système qui possède ce qu'il touche.
- `memoire.ts`: faits retenus (`remember`, `recall`, compteurs `bump`), garde de taille `maxFacts`.
- `reglages.ts`: réglages du lot L3 que les fichiers de données n'ont pas encore (à migrer dans `reglages.json`).
- `apparence.ts`: apparence révélée ou non (`lookRevealed`, fait `joueurs.apparence.j<n>`), retenue par l'effet `reveal_look` (`to: "duo"` pour les deux) ou par la validation de l'éditeur (`set_look`). Une partie neuve ne commence cachée que si le lieu de départ sait révéler (`placeReveals`). Avant: silhouette dans le monde et les portraits, miroir refusé (`no-face-yet`), onglet Tenues fermé. Test: `tests/photo-prologue.test.ts`.
- `recompenses.ts`: récompenses qui ne sont pas des objets (recette, plan, entrée de collection, pièce de tenue), garde-robe gagnée (`isPieceOwned`, `wardrobeOf`).

## Donner une récompense (recette)

1. Dans `onDone` d'une étape (ou une option de dialogue, un temps de scène): `{ "type": "give_recipe", "recipe": "<id>" }`, `give_plan` (`plan`), `give_entry` (`entry`) ou `give_piece` (`piece`).
2. La recette est `known: "learned"`, le plan a une `source` autre que `start`, l'entrée existe au carnet, la pièce porte l'étiquette `a-gagner` du catalogue: le chargement refuse le reste.
3. Tout s'écrit dans la mémoire commune (`cuisine.recette.<id>`, `fabrication.plan.<id>`, `garde-robe.piece.<id>`) ou l'album: sauvegarde et réseau sans changement.
4. Annonce aux deux joueurs: événement `reward_given` (`kind`, `id`), ou `collection_found` pour une entrée. Déjà acquise: sans effet.
5. Une pièce à gagner reste hors de l'éditeur et refusée par `set_look` (`piece-locked`) tant qu'elle n'est pas donnée.
6. Test court: `tests/recompenses.test.ts`.

Condition `money_at_least` (`amount` en centimes): la bourse de celui qui agit (dialogue, article, étape). Condition `decision_is` et effet `choose`: `quetes/README.md`.
