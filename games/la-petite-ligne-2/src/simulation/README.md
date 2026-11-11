# Simulation

Logique pure: ni DOM, ni horloge, ni `Math.random`. Elle tourne chez l'hôte, à 30 pas par seconde.

- `noyau/` (L2): le pas, les entrées, les unions d'intentions et d'événements, la création du monde.
- `voyage/` (L2), `briques/` (L2), `besoins/`, `sac/`, `dialogues/`, `regles/` (L3), `quetes/` et `scenes/` (histoire): un dossier par système.
- `vehicules/`: véhicules de voie à deux places (la draisine), déclarés par lieu; recette dans son README.

Chaque dossier de système contient `index.ts` (son `GameSystem`, déjà relié dans `noyau/systemes.ts`), `intentions.ts` et `evenements.ts` (ses tableaux, déjà réunis dans les unions du noyau). Un lot ajoute une intention ou un événement dans son tableau, sans toucher au noyau.

Règle des coupures (`GameSystem.interrupt`, `noyau/systemes.ts`): une activité dont tout l'état est dans le monde et sur l'horloge des pas n'a rien à déclarer (la pause la suspend, la reprise la renvoie à l'invité). Sinon son système dit comment elle s'annule sans rien coûter: cause `pause` pour ce qui court sur l'heure de session ou le son (la musique), cause `reload` pour ce qui demandait une interface ouverte à la reprise d'une sauvegarde (ligne à l'eau, meuble tenu). Un cas par activité dans `tests/reconnexion-activites.test.ts`; tableau dans `docs/jeux/jeu-1/refonte/reconnexion-activites.md`.
