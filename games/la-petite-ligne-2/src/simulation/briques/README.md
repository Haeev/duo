# Briques et touche d'action (lot L2 pour le registre; L3 pour `relieve`)

Le moteur ne connaît aucun meuble. La touche d'action vise un objet visible (un meuble et ses briques de `donnees/commun/meubles/`, un objet au sol, un habitant) et appelle le comportement inscrit dans `registre.ts`.

| Fichier                                | Rôle                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `types.ts`                             | contrat: `BrickBehaviour` (`verb`, `gesture?`, `refuse`, `use`), `EntityBehaviour`, `Aim`, `Look`  |
| `registre.ts`                          | `BRICK_BEHAVIOURS` (par brique) et `ENTITY_BEHAVIOURS` (`pickup`, `talk`)                          |
| `visee.ts`                             | `aimOf(look, player)`: la cible, son verbe et son refus éventuel, fonction pure de l'état transmis |
| `geste.ts`                             | geste d'une action, lu sans rien modifier (lancement chez l'hôte, prédiction chez l'invité)        |
| `index.ts`                             | le système: intentions `act`, `use_brick`, `store_put`, `store_take`; fin des gestes; `player.aim` |
| `asseoir.ts`, `dormir.ts`, `ranger.ts` | briques `sit`, `sleep`, `store`                                                                    |
| `ramasser.ts`, `parler.ts`             | actions `pickup` (objet au sol, avec geste) et `talk` (habitant)                                   |
| `postures.ts`, `piles.ts`              | places assises ou couchées; piles dans des cases                                                   |

## Ajouter une brique

1. Schéma dans `src/donnees/schemas/briques.ts` et état dans `src/etat/briques.ts` (L0).
2. Un fichier ici qui exporte un `BrickBehaviour`: `refuse` est pur et ne lit que `Look` (il sert aussi à montrer la cible avant l'appui et à la prédiction de l'invité); `use` modifie l'état, appelle `sim.touch` pour chaque tranche touchée et émet ses événements; `gesture` rend un clip et une durée si l'effet doit attendre la fin d'un geste.
3. Une ligne dans `registre.ts`, un test court dans `tests/`.

Une brique déclarée sans comportement est inerte: son meuble n'est pas une cible. Intentions et événements propres à une brique: dans `intentions.ts` et `evenements.ts` de ce dossier.

## Règles de la visée

Portée et cône dans `reglages.json` (`reach`). À portée et dans le cône: d'abord ce qui sert l'outil en main (champ `tool` ou `tools` de la brique), puis ce qui peut servir, enfin ce qui est refusé (l'interface montre ce qui manque); à rang égal, le plus proche de l'axe du regard. Jamais de cible derrière un mur, ni sans objet. Assis, couché, en geste, en dialogue ou sur le marchepied: pas de cible.
