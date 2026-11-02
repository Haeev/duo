# Travaux en cours, arrêtés le 2026-11-02

Le client a demandé d'arrêter (quota hebdomadaire presque épuisé). Deux lots du tour 10 étaient à mi-chemin: leur travail non fini est gardé ici en correctifs, pour le reprendre sans rien perdre. Ils ne sont pas appliqués au jeu.

| Fichier | Lot | Base | État à l'arrêt |
|---|---|---|---|
| `L3-simulation-du-monde.patch` | L3, simulation du monde (habitants, intérieurs, salon, fournil, migration `inHouse`) | `fe0ff06` | en cours: tests du verbe des rideaux, du banc du salon et du menu de sieste à écrire; non vérifié |
| `L5-rendu-et-son.patch` | L5, rendu et son du tour 10 (budgets de la carte de 100 m, ru, intérieurs, pièces, rideaux, personnages, son) | `d5840c0` | en cours: captures à faire; non vérifié |

Reprise: créer une branche depuis la base indiquée, `git apply --index <fichier>.patch`, puis fusionner la branche de session et relancer lint, types et tests. Ordre d'intégration: L3, puis L5 (section 13.2 de `tour-10-conception.md`). Les demandes faites à ces lots (deliverHen, place d'Odette, `MenuKind` du salon et du fournil, coin du gué, accroches d'intérieur) sont dans le journal de la session et dans les comptes rendus de L4, L6 et des retouches de carte.
