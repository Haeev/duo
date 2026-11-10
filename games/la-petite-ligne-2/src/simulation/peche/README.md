# Pêche

Conception: `docs/jeux/jeu-1/refonte/peche.md`. Données: bloc `fish` d'une prise (`src/donnees/schemas/peche.ts`), coins de pêche dans le champ `fishing` de `lieu.json`. État: champ facultatif `fishing` de la tranche « lieu » (`src/etat/peche.ts`).

| Fichier       | Rôle                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `reglages.ts` | toutes les valeurs (vagues d'ombres, lancer, touche, combat, aides, qualité, épuisette)                                  |
| `ombres.ts`   | ombres d'un coin: fonction pure de la graine du lieu, du jour, de l'heure et de la météo (rien sur le réseau)            |
| `combat.ts`   | touche (feintes, plongeon), combat à pas fixe, journal des touches, rejeu, robot pêcheur                                 |
| `local.ts`    | la partie jouée sur la machine du pêcheur (visée, touche, combat): rend les intentions à envoyer                         |
| `index.ts`    | le système de l'hôte: lancer (ombre choisie, graine), validation par rejeu, prise (taille, qualité, record, carnet, sac) |
| `lecture.ts`  | lectures pures: canne en main, coin devant soi, `fishingView` (rendu), `fishCollectionView` (carnet)                     |

Intentions: `fish_cast`, `fish_hooked`, `fish_result`, `fish_cancel`. Événements: `fish_cast`, `fish_hooked`, `fish_caught`, `fish_lost`.

## Pour se brancher

- **Rendu (L4, L6)**: `fishingView(content, world, secondes)` donne les ombres (position, cap, taille, `biting`) et les lignes (bouchon, `pose`: `waiting` ou `fighting`); `secondes` = `world.tick * SIM_DT` interpolé. Posture « montrer la prise » sur `fish_caught` (`big`: vibration d'écran 0,15 s). La canne pliée sur `fish_hooked`.
- **Son (L9)**: `fish_cast` (plouf), `fish_hooked`, `fish_caught` (`isNew`: jingle), `fish_lost`.
- **Carnet (L7)**: `fishCollectionView` (espèces vues, record de chaque joueur en mm). Les records sont des faits de mémoire `fish.record-j<joueur>.<espèce>`, la collection est `progress.collections.fish`: rien de neuf à transmettre.
- **Entrées**: pendant la partie, `capturing()` de l'interface est vrai, la boucle n'envoie ni marche ni action.
