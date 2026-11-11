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
| `uniques.ts`  | appâts (`baits` d'une prise) et prises uniques (`unique`): ombre du coin, appât exigé, fait de sortie                    |
| `a-deux.ts`   | pêche à deux: élans et remontées (fonction pure de la graine), jugement de l'épuisette, pas de l'hôte                    |

Intentions: `fish_cast` (avec `bait` facultatif), `fish_hooked`, `fish_result`, `fish_cancel`, `fish_hold` (canne tenue, à deux), `fish_net` (épuisette, à deux). Événements: `fish_cast`, `fish_hooked`, `fish_caught`, `fish_lost`, `fish_net_missed`.

## Appâts et prises uniques (recette)

1. **Appât**: dans la fiche d'une prise, `"baits": [{ "item": "goujon", "factor": 2 }]`. L'objet doit exister; on l'amorce pendant la visée (touche S), il est mangé à la touche.
2. **Prise unique**: une fiche de prise avec un bloc `unique` (gabarit `donnees/_gabarits/prise.jsonc`): `spot` (coin d'un de ses lieux), `when` (conditions), `bait` (ou `null`), `crew` (`solo` ou `pair`), `fact` (écrit à la sortie), `toBag`. Heures, météos, saisons: celles de la prise.
3. Ne pas la mettre dans une `table` de coin: son ombre vient de sa fiche, et le validateur le refuse.
4. Une quête attend sa sortie par `{ "type": "remembered", "key": "<fact>" }`.
5. Essai court: `tests/peche-appats-uniques.test.ts` (une vieille carpe factice); aide de test `tests/aides-peche-a-deux.ts`.

## Pêche à deux (`crew: "pair"`)

Elle ne mord qu'avec son appât et l'autre joueur à moins de `FISHING.pair.radius` m, sans ligne. L'hôte ferre lui-même au plongeon du bouchon (l'appât est mangé), puis juge seul: à la canne, `fish_hold` (Espace tenu) pendant ses élans la fatigue (`holdSeconds`); fatiguée, elle plonge d'un côté puis remonte de ce côté; à l'épuisette, `fish_net` dans le bon couloir pendant la remontée, la canne tenue, la sort. Raté: elle replonge, un peu reposée (`missKeep`). Trop long (`maxSeconds`): elle casse la ligne et reste dans le coin, on peut réessayer aussitôt avec un autre appât. Les deux écrans diffèrent (`interface/peche`): ressenti sans eau à la canne, eau sans ressenti à l'épuisette.

## Pour se brancher

- **Rendu (L4, L6)**: `fishingView(content, world, secondes)` donne les ombres (position, cap, taille, `biting`) et les lignes (bouchon, `pose`: `waiting` ou `fighting`); `secondes` = `world.tick * SIM_DT` interpolé. Posture « montrer la prise » sur `fish_caught` (`big`: vibration d'écran 0,15 s). La canne pliée sur `fish_hooked`.
- **Son (L9)**: `fish_cast` (plouf), `fish_hooked`, `fish_caught` (`isNew`: jingle), `fish_lost`.
- **Carnet (L7)**: `fishCollectionView` (espèces vues, record de chaque joueur en mm). Les records sont des faits de mémoire `fish.record-j<joueur>.<espèce>`, la collection est `progress.collections.fish`: rien de neuf à transmettre.
- **Entrées**: pendant la partie, `capturing()` de l'interface est vrai, la boucle n'envoie ni marche ni action.
