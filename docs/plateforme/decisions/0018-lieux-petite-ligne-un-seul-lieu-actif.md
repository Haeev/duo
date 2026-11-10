# ADR 0018: Lieux de La Petite Ligne: un seul lieu actif

| Champ | Valeur |
|---|---|
| Statut | proposée (en attente de relecture par le manager) |
| Date | 2026-11-10 |
| Rédacteur | architecte-technique |
| À relire par | dev-gameplay-3d (simulation, rendu), dev-reseau, level-designer, game-designer |
| Jeu | `games/la-petite-ligne-2`; plan: `docs/jeux/jeu-1/refonte/technique.md`; cahier: `docs/jeux/jeu-1/refonte/cahier-des-charges.md` |
| Liens | ADR 0016 (intérieurs sur la carte), 0017, 0019; ADR 0006 (mêmes versions sur les deux machines) |

## Contexte

Le jeu va de lieu en lieu par le train (Aubrune, puis une métropole, puis un village hanté, d'autres par mises à jour). Les deux joueurs sont libres dans un lieu, mais le train exige d'être ensemble (réponse 9) et il n'y a pas de jeu en solo (réponse 15). Le cahier (4.1) fixe une seule horloge pour tous les lieux et dit que rien ne punit l'absence. La machine de référence est modeste; l'ADR 0016 a montré que le coût du rendu suit la vue, pas la taille de la carte.

## Options

| | A. Tous les lieux simulés en continu | B. Un seul lieu actif, les autres dormants | C. Un lieu par joueur (chacun où il veut) |
|---|---|---|---|
| Simulation | coût qui croît avec le nombre de lieux | constant | deux lieux simulés, deux tranches de lieu |
| Réseau | état de tous les lieux à transmettre | un lieu à la fois | deux lieux, prédiction de l'invité sur une autre carte que l'hôte |
| Rendu | sans objet | un lieu chargé | un lieu chargé par machine |
| Besoin du client | dépassé | couvert: on voyage à deux | non demandé |

## Décision

**Option B.**

1. **État**: `world.places` porte tous les lieux visités (sauvegardés); `world.common.place` désigne le seul lieu simulé, rendu et transmis. Un lieu est créé à la première visite d'après ses données (`createPlaceState`).
2. **Données**: un lieu est un dossier autonome `donnees/lieux/<id>/` (`lieu.json`, `carte.json`, `habitants/`, `dialogues/`, `commerces/`, `quetes/`) et un dossier d'assets `assets/lieux/<id>/`. Le rail se déclare par `links`, écrit des deux côtés (contrôlé au chargement).
3. **Voyage** (`common.phase`): `day`, puis `boarding` (les deux sur le quai, chacun valide « Monter », sans limite d'attente), puis `travel` (scène de wagon, 20 s au moins; l'hôte fige le lieu quitté avec `leftOn`, change `common.place`, envoie la tranche du nouveau lieu; chaque machine charge le lieu et envoie `place_loaded`), puis `arrival` quand les deux sont prêtes. Message d'attente au-delà de 30 s. Valeurs dans `reglages.json` (`travel`).
4. **Lieux dormants**: au retour, un rattrapage borné rejoue les jours écoulés (stocks, cultures), sans simuler les habitants.
5. **Rendu**: tout ce qui appartient au lieu est suivi par un `ResourceTracker` par lieu et libéré au départ; personnages, matériaux communs et interface restent. Critère: après dix allers-retours, géométries, textures et programmes reviennent à leur compte de départ.
6. **Intérieurs**: ADR 0016 conservé (sur la carte, coupe des murs). Un intérieur qui ne tient pas dans son bâtiment (appartement à l'étage) se pose à l'écart sur la même grille et se rejoint par une porte: une seule grille, une seule simulation.
7. **Budgets par lieu**: carte de 128 x 128 m au plus, 32 habitants transmis au plus, tranche de lieu de 32 Kio au plus (ADR 0019), 25 Mo d'assets, chargement en 8 s sur le PC de référence.

## Conséquences

- Ajouter un lieu par mise à jour: un dossier de données et un dossier d'assets, aucun changement du moteur (test du gabarit « lieu »).
- Un joueur ne peut pas rester dans un lieu pendant que l'autre voyage: voulu.
- Les habitants d'un lieu dormant ne vivent pas; leur calendrier avance par le rattrapage.
- La scène de wagon doit durer au moins le temps de chargement le plus long des deux machines.

## À vérifier

- Temps de chargement réel d'un lieu sur le PC du client (liste « à tester chez le client » du jalon 1).
- Libération complète des ressources au départ d'un lieu (mesure du lot L4).
- Passage à des paquets par lieu si le jeu dépasse 150 Mo: ADR à écrire à ce moment-là, pas avant.
