# Noyau (lot L2)

| Fichier                                        | Rôle                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pas.ts`                                       | un pas: intentions, horloge, déplacements, puis les systèmes; intentions du noyau (`select_slot`, `set_look`, `unstick`) |
| `systemes.ts` (L0)                             | `SimContext`, `GameSystem`, liste `SYSTEMS`                                                                              |
| `entrees.ts`, `evenements.ts`, `intentions.ts` | unions réunies à partir des tableaux de chaque lot; événements `day_started` et `unstuck`                                |
| `monde.ts`                                     | partie neuve, état d'un lieu à la première visite, placement à la descente du train                                      |
| `grille.ts`, `obstacles.ts`                    | collisions: carte, meubles solides (porte ouverte exceptée), verrous fermés (`lieux/`)                                   |
| `deplacement.ts`                               | `walkStep` et `canWalk`, purs; `movePlayers` chez l'hôte                                                                 |
| `deblocage.ts`                                 | personnage pris dans un obstacle ou enfermé                                                                              |
| `horloge.ts`                                   | heure, nuit, aube, saut de nuit                                                                                          |
| `prediction.ts`                                | `createPredictor`: ce que le réseau (L1) appelle chez l'invité                                                           |
| `reglages-noyau.ts`                            | réglages typés qui attendent leur place dans `reglages.json`                                                             |

Le déplacement tient tout son élan dans `body.speed` et `body.facing`: `walkStep(obstacles, corps, commande)` donne le même résultat chez l'hôte et dans la prédiction de l'invité. La commande est dans le repère du monde (x vers l'est, y vers le sud); c'est `entrees/commandes.ts` qui la tourne selon la caméra.
