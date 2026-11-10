# Briques (lot L2 pour le registre; L3 pour `relieve` et `store`)

Le moteur ne connaît aucun meuble. La touche d'action vise un meuble, lit ses briques (`donnees/commun/meubles/`) et appelle le comportement inscrit dans `registre.ts`. Une brique = un fichier de comportement ici, inscrit dans `BRICK_BEHAVIOURS`.

Brique nouvelle: schéma dans `src/donnees/schemas/briques.ts`, état dans `src/etat/briques.ts`, comportement ici, exemple dans `donnees/_gabarits/meuble.jsonc`. Ensuite tout contenu peut la déclarer.
