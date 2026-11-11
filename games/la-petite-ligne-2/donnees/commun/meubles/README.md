# Meubles

Une fiche par meuble (`<id>.json`, gabarit `donnees/_gabarits/meuble.jsonc`, recette générale dans `donnees/README.md`).

## Poser un objet sur un meuble (une lampe sur une table)

1. Le meuble porteur déclare la hauteur de son plateau en mètres depuis le sol: `"top": 0.75` dans sa fiche. Sans `top`, rien ne se pose dessus.
2. L'objet posé (`lampe-de-table`, `bocaux-de-confiture`, `pendule`...) est une fiche ordinaire sans brique et non solide.
3. Dans `objects` de la carte ou de l'intérieur, ajoute l'objet avec `"on": "<id du porteur>"` et un centre (x, y) qui tombe sur l'emprise du porteur.
4. Sans porteur à identifier (sur une cheminée, un rebord), `"on": 1.1` donne la hauteur directement, en mètres.
5. L'objet se dessine à cette hauteur, ne bloque pas, ne se vise pas (la touche d'action reste celle du porteur), disparaît avec son porteur s'il est conditionné (`when`), et sa lampe éclaire de sa vraie hauteur.
6. Une chaîne est permise (un livre sur un plateau sur une table), quatre niveaux au plus.
7. Le validateur refuse: porteur inconnu, porteur sans `top`, centre hors de l'emprise du porteur, objet posé à brique ou solide.
8. Le mode déco des joueurs garde sa propre règle `deco.surface` (`src/simulation/logement/pose.ts`). Au rendu, un meuble de la couche `top` posé par un joueur sur une surface se dessine sur le plateau du porteur (`top` de sa fiche, sinon la hauteur de son modèle), et sa lampe éclaire de là (`describeDynamic`, `src/rendu/lieu/description.ts`).
9. Test court: `tests/poses.test.ts` (une table et une lampe factices).

## Ajouter un meuble obtenable (fabriqué, acheté ou reçu, puis posé chez soi)

1. `pnpm nouveau meuble-obtenable pouf-bleu` crée `commun/meubles/pouf-bleu.json` (le meuble posé) et `commun/objets/pouf-bleu.json` (l'objet du sac, dont le champ `prop` nomme la fiche). Gabarits commentés: `_gabarits/meuble-obtenable/`.
2. Fiche du meuble: nom, `model` (nœud de `assets/commun/decors/decors.json`; inconnu: forme simple), taille, briques, section `deco` (couche, surface, dedans ou dehors, confort). `placeable` reste à `true`.
3. Objet: nom, `family` `furniture`, `stack` 1. Deux couleurs: deux objets et deux fiches (ou deux objets vers la même fiche tant que le modèle teinté manque).
4. Pour le fabriquer: un plan (`pnpm nouveau plan pouf`) dont `makes` est `{ "kind": "furniture", "variants": [{ "color": "#4a6fa5", "item": "pouf-bleu" }] }`.
5. Pour le vendre: une ligne dans `sells` d'un commerce, `{ "item": "pouf-bleu", "price": 1200, "dailyStock": 1, "payment": "purse-or-chest" }` (`purse-or-chest`: payable au coffre commun).
6. Pour l'offrir: l'effet `give_item` d'un dialogue ou d'une étape de quête.
7. Vignette: `pnpm vignette` pour l'objet du sac (sans elle, vignette provisoire à initiales).
8. En jeu: l'objet arrive dans le sac; ouvrir le mode déco (B) chez soi, ou « Ranger à la maison » dans le Sac, le fait entrer dans l'inventaire de la maison; de là il se pose, et repris il y retourne.
9. Le validateur refuse: objet `furniture` sans `prop`, `prop` sur une autre famille, fiche inconnue ou non posable.
10. Tests courts: `tests/gabarits.test.ts` (le gabarit tel quel) et `tests/meubles-obtenables.test.ts` (fabriqué à l'établi, rangé, posé, repris, sauvegardé).
