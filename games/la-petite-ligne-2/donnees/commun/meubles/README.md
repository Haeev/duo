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
8. Le mode déco des joueurs n'est pas concerné: il garde sa propre règle `deco.surface` (`src/simulation/logement/pose.ts`).
9. Test court: `tests/poses.test.ts` (une table et une lampe factices).
