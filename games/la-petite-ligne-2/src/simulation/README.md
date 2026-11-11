# Simulation

Logique pure: ni DOM, ni horloge, ni `Math.random`. Elle tourne chez l'hôte, à 30 pas par seconde.

- `noyau/` (L2): le pas, les entrées, les unions d'intentions et d'événements, la création du monde.
- `voyage/` (L2), `briques/` (L2), `besoins/`, `sac/`, `dialogues/`, `regles/` (L3), `quetes/` et `scenes/` (histoire): un dossier par système.
- `vehicules/`: véhicules de voie à deux places (la draisine), déclarés par lieu; recette dans son README.

Chaque dossier de système contient `index.ts` (son `GameSystem`, déjà relié dans `noyau/systemes.ts`), `intentions.ts` et `evenements.ts` (ses tableaux, déjà réunis dans les unions du noyau). Un lot ajoute une intention ou un événement dans son tableau, sans toucher au noyau.
