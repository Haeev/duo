# Lecture des données (lot L0)

`schemas/`: un schéma Valibot par type de contenu, source unique des types et des validateurs. `charger.ts` lit la table des fichiers et lève `ContentError` avec tous les problèmes. `valider.ts` contrôle ce qui relie les fichiers (références, graphes de dialogue, durées de geste). `fichiers.ts` est le seul fichier lié à Vite.

Ajouter un type de contenu: son schéma ici, son dossier dans `charger.ts`, ses contrôles dans `valider.ts`, son gabarit dans `donnees/_gabarits/`, sa ligne dans `outils/nouveau.ts`, son test dans `tests/gabarits.test.ts`.
