# Conditions et effets (lot L3)

Évaluateurs des conditions et des effets des données (`src/donnees/schemas/regles.ts`), utilisés par les dialogues, les briques et, au jalon 2, les quêtes. Un type nouveau: son schéma, son cas ici, son contrôle dans `src/donnees/valider.ts`.

- `conditions.ts`: `evaluate`, `evaluateAll` (contexte: monde, contenu, joueur qui agit).
- `effets.ts`: `applyEffect`, `applyEffects`; chaque effet passe par le système qui possède ce qu'il touche.
- `memoire.ts`: faits retenus (`remember`, `recall`, compteurs `bump`, clé par joueur `playerFactKey`), garde de taille `maxFacts`.
- `reglages.ts`: réglages du lot L3 que les fichiers de données n'ont pas encore (à migrer dans `reglages.json`).
- `apparence.ts`: apparence révélée ou non (`lookRevealed`, fait `joueurs.apparence.j<n>`), retenue par l'effet `reveal_look` (`to: "duo"` pour les deux) ou par la validation de l'éditeur (`set_look`). Une partie neuve ne commence cachée que si le lieu de départ sait révéler (`placeReveals`). Avant: silhouette dans le monde et les portraits, miroir refusé (`no-face-yet`), onglet Tenues fermé. Test: `tests/photo-prologue.test.ts`.
- `souvenirs.ts`: faits de souvenirs écrits par le moteur (première prise, nuit blanche, pluie dehors ensemble), réglages `RULES.memories`.
- `recompenses.ts`: récompenses qui ne sont pas des objets (recette, plan, entrée de collection, pièce de tenue), garde-robe de chaque joueur (`hasPiece`, `isPieceOwned`, `wardrobeOf`, `lockedPieceOf`: un index de joueur).

## Donner une récompense (recette)

1. Dans `onDone` d'une étape (ou une option de dialogue, un temps de scène): `{ "type": "give_recipe", "recipe": "<id>" }`, `give_plan` (`plan`), `give_entry` (`entry`) ou `give_piece` (`piece`, `to: "duo"` facultatif pour chacun des deux).
2. La recette est `known: "learned"`, le plan a une `source` autre que `start`, l'entrée existe au carnet, la pièce porte l'étiquette `a-gagner` du catalogue: le chargement refuse le reste.
3. Tout s'écrit dans la mémoire des faits (`cuisine.recette.<id>`, `fabrication.plan.<id>` pour le duo; `garde-robe.piece.<id>.j<n>` pour le joueur qui reçoit la pièce, cahier 2.1: chacun ses tenues; l'ancienne clé sans `.j<n>` vaut pour les deux) ou l'album: sauvegarde et réseau sans changement.
4. Annonce: événement `reward_given` (`kind`, `id`; pour une pièce, `by` est le joueur qui la reçoit et lui seul la voit annoncée), ou `collection_found` pour une entrée. Déjà acquise: sans effet. Cadeau d'un habitant: un dialogue `once: "player"` de priorité 58 avec `give_piece` (exemple: `lieux/aubrune/dialogues/solange-cadeau-foulard.json`).
5. Une pièce à gagner reste hors de l'éditeur de ce joueur et refusée par `set_look` (`piece-locked`) tant qu'il ne l'a pas. Vente en boutique: `pieces` d'un commerce (`simulation/commerces/README.md`).
6. Test court: `tests/recompenses.test.ts`.

## Faits par joueur, durées, compteurs (recette)

1. Un fait par joueur a une clé finie par `.j0` ou `.j1` (`playerFactKey`). En données, on écrit la clé sans ce suffixe et `"of"`: `"actor"` (celui qui parle ou agit), `"other"` (l'autre joueur). Trois segments au plus avant le suffixe (contrôlé au chargement).
2. Conditions: `remembered` (avec `of`), `fact_at_least` (`value`: compteur au moins), `days_since` (`atLeast`, `atMost`: jours depuis la dernière écriture du fait, l'une au moins). Fait absent: faux.
3. Effets: `remember` et `bump` (`amount`, 1 par défaut) prennent `"of": "actor"`; `by` reste l'auteur.
4. Faits du moteur à lire: commerces (`commerces/faits.ts`: `commerces.<commerce>.premier-achat`, `premiere-vente`, `ventes.<commerce>.<objet>` par joueur et pour le duo), dernier jour de conversation `amitie.<habitant>.jour` (avec `of`, pour « trois jours sans te voir »), souvenirs (`souvenirs.ts`, clés dans `RULES.memories`): première prise, nuit blanche (aube arrivée sans dormir), pluie passée dehors ensemble.
5. Rien d'autre à toucher: gabarits `donnees/_gabarits/dialogue.jsonc` et `quete.jsonc`. Test court: `tests/faits-briques.test.ts` (dialogues factices de la cheffe de gare).

Condition `money_at_least` (`amount` en centimes): la bourse de celui qui agit (dialogue, article, étape). Condition `decision_is` et effet `choose`: `quetes/README.md`. Condition `event_is` (un événement du calendrier en cours, commencé aujourd'hui, prévu aujourd'hui ou demain): `monde/README.md`.
