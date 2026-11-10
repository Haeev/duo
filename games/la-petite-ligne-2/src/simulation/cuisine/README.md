# Cuisine

Conception: `docs/jeux/jeu-1/refonte/cuisine.md`. Recettes: `donnees/commun/recettes/` (gabarit `donnees/_gabarits/recette.jsonc`, `pnpm nouveau recette <id>`); postes: un meuble qui déclare la brique `cook` (`stove`, `kitchen`, `oven`, `counter`).

- `briques.ts`: brique `cook` (inscrite dans `briques/registre.ts`): événement `kitchen_opened`, l'interface ouvre le livre.
- `index.ts`: le système. Intentions `cook_start` (l'hôte choisit la part et la graine), `cook_step` (note 1 à 3, bornée; `after` faite trop tôt: un cran de moins), `cook_cancel`, `cook_read` (livre). Ingrédients contrôlés au départ, retirés à la fin; part finie trop vite refusée (`minFraction`). Préparations en cours hors de l'état (moins d'une minute, non sauvegardées).
- `minijeu.ts`: le mini-jeu, pur, joué chez le joueur (`createMinigame`), et `botAct` pour le mode bot.
- `recettes.ts`: lecture (connue, meilleure qualité, parts, ingrédients, qualité, durées). Mémoire: `cuisine.recette.<id>` = meilleure qualité (0: connue, jamais faite). Un habitant apprend une recette par l'effet de dialogue `remember` sur cette clé.
- `scene.ts`: temps forts de la scène du repas à deux (après `meal_shared` du système des besoins).
- `reglages.ts`: toutes les valeurs (fenêtres, durées, seuils de qualité, aide, cuisine tranquille, scène).
- `valider.ts`: contrôles croisés appelés par `donnees/valider.ts` (objets, `after`, repas à deux, durée 15 à 40 s).

Test: `tests/cuisine.test.ts`. Démonstration: `/src/interface/cuisine/demo/index.html#livre` (aussi `#couper`, `#remuer`, `#cuire`, `#duo`, `#resultat`, `#repas`).
