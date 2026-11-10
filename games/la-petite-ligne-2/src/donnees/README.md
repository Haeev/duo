# Lecture des données (lot L0)

`schemas/`: un schéma Valibot par type de contenu, source unique des types et des validateurs. `charger.ts` lit la table des fichiers et lève `ContentError` avec tous les problèmes. `valider.ts` contrôle ce qui relie les fichiers (références, graphes de dialogue, durées de geste). `fichiers.ts` est le seul fichier lié à Vite.

Ajouter un type de contenu: son schéma ici, son dossier dans `charger.ts`, ses contrôles dans `valider.ts`, son gabarit dans `donnees/_gabarits/`, sa ligne dans `outils/nouveau.ts`, son test dans `tests/gabarits.test.ts`.

`carte.ts` (grands lieux, ADR 0022): terrain en plages (`decodeTerrain`, `encodeRuns`), tuiles de rendu de 32 m (`tileGrid`, `tileOf`, `tilesAround`, `byTile`), intérieurs fusionnés à la carte du lieu (`withInteriors`, appelé par `charger.ts`: `PlaceContent.map` est toujours la grille complète, `PlaceContent.interiors` garde les fichiers tels qu'écrits). Les verrous (`map.locks`) n'ont pas d'état: ouverts quand leurs conditions `opens` sont vraies.
