# Véhicules de voie (la draisine)

Un véhicule de voie à deux places que les joueurs sortent de sa remise et font avancer ensemble. Données: `lieux/<lieu>/vehicules/<id>.json` (schéma `src/donnees/schemas/vehicule.ts`, gabarit `donnees/_gabarits/vehicule.jsonc`). Le moteur ne connaît aucun véhicule par son nom: une autre draisine, un autre lieu s'ajoutent par un fichier.

| Fichier         | Rôle                                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`      | le système: coups de balancier (touche d'action à bord), frein, sens, descente, butées, trains, arrêts et leurs effets                         |
| `pompe.ts`      | brique d'entraînement `pump`: justesse d'un coup, blocage à l'unisson (logique pure)                                                           |
| `voie.ts`       | pose sur la voie ou dans la remise, places, butées (fiche, bord de carte, verrous d'histoire), arrêts; le tracé est celui de `monde/trains.ts` |
| `cible.ts`      | touche d'action à pied: la porte de la remise (sortir, rentrer), le bord du véhicule (monter); pur pour la visée, effets chez l'hôte           |
| `emprise.ts`    | cases prises par un véhicule arrêté (`noyau/obstacles.ts`)                                                                                     |
| `places.ts`     | qui est à bord (`riddenBy`): lu par le déplacement, la visée et la prédiction de l'invité                                                      |
| `etat.ts`       | création de l'état, remise au repos à la reprise                                                                                               |
| `reglages.ts`   | ce qui vaut pour tous les véhicules                                                                                                            |
| `evenements.ts` | `vehicle_out`, `vehicle_in`, `vehicle_seat`, `vehicle_stroke`, `vehicle_started`, `vehicle_stopped`, `vehicle_turned`, `vehicle_warning`       |

## Jeu

- **Remise**: il dort au bout de sa voie de garage, dans le bâtiment. Quand `available` est vrai (la suite qui en donne la clé), la porte (dernier point de la voie de garage) offre « Sortir »: il est posé à `launch`. Vide et arrêté à son point de pose, la même porte offre « Rentrer ».
- **À bord** (touche d'action sur le véhicule, chacun prend la place libre la plus proche): la touche d'action donne un coup de balancier. Seuls les coups alternés comptent; au battement (`beat`, à `tolerance` près) le coup est plein, trop lent il garde un fond (`offBeat`), martelé il ne donne rien, et deux coups ensemble (`jam`) bloquent le balancier. Seul, on n'avance pas. Rien n'est puni.
- **Frein**: la touche de course, tenue. **Sens**: la même touche, appuyée à l'arrêt, l'inverse; en bout de voie il s'inverse de lui-même. **Descendre**: une direction, à l'arrêt seulement, après avoir lâché les directions (on ne tombe pas du véhicule en arrivant).
- **Voie**: il suit le tracé de `track` entre les butées `range`, et ne passe jamais une case fermée de la voie (bord de la carte, verrou d'histoire fermé): il freine de lui-même et s'y arrête. Un verrou qui s'ouvre rallonge la ligne, sans rien écrire.
- **Trains**: un train d'événement sur la même voie, à quai, en marche ou annoncé à moins de `trains.warnMinutes`, interdit de sortir et de monter (refus `train-due`). En balade, l'annonce donne un avertissement (`vehicle_warning`); quand le train entre, le véhicule est rangé d'office et ses passagers posés à côté de la voie, sans dommage (`vehicle_in`, raison `train`). Le train, lui, n'attend jamais: sa pose reste une fonction pure de l'heure.
- **Arrêts** (`stops`): arrêté à moins de `stopReach` d'un repère, il y est (`vehicle_stopped`); les effets `arrive` de l'arrêt jouent s'il porte quelqu'un (les faits d'une suite: « allez jusqu'au passage, puis revenez »).

## État, réseau, sauvegarde

L'état (`etat/vehicules.ts`: sorti ou rangé, position sur la voie, vitesse, sens, places, balancier) vit dans la tranche du lieu, champ facultatif `vehicles`: il part chez l'invité avec l'état lent du lieu (par différences, toutes les 200 ms en marche) et se sauvegarde avec lui, sans message ni canal de plus et sans monter le format (une sauvegarde d'avant le relit, véhicule à la remise). Les corps des joueurs à bord suivent leur place à chaque pas (canal rapide). À la reprise: véhicule où il était, à l'arrêt, joueurs descendus (`restVehicles`). Le rendu (`rendu/lieu/vehicules.ts`) prolonge la position à l'estime entre deux états: même code chez l'hôte et chez l'invité.

## Ajouter un véhicule (aucun code)

1. `pnpm nouveau vehicule <id> <lieu>`, puis ouvre `donnees/_gabarits/vehicule.jsonc` à côté.
2. `model`: le modèle du manifeste des décors (nœuds `balancier`, `roue-avant`, `roue-arriere`); `fallback`: un modèle existant en attendant.
3. `body` et `seats`: gabarit et places, dans le repère du modèle (+z devant, +x à gauche).
4. `track`, `garage`: deux tracés de `rails` de la carte; `launch`, `range`, `stops`: des points de la carte (`points`).
5. `available`: la condition d'histoire qui en donne la clé (`[]`: toujours).
6. `speed`, `drive`: vitesse de pointe, roue libre, frein, battement et poussée.
7. `lines`: verbes de la bulle et mots d'explication (tutoiement).
8. `pourquoi` du véhicule et de chaque arrêt (règle « cohérence du monde »).
9. `pnpm exec vitest run tests/vehicules.test.ts tests/rendu/vehicules.test.ts` (un véhicule factice y est ajouté par le gabarit).
10. Regarde-le: `pnpm exec vite build`, puis `pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts draisine`.

Une autre façon de le faire avancer (pédales, voile): une variante de `VehicleDriveSchema` et sa logique à côté de `pompe.ts`; c'est une brique nouvelle, pas un contenu.
