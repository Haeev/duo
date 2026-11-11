# Outils et gestes de récolte (cahier 4.5 et 4.7)

La touche d'action fait la bonne chose selon l'outil en main et la cible. Chaque geste est une brique déclarée dans la fiche d'un meuble: `harvest` (ressource du monde, ici) et `field` (terre cultivable, `cultures/`). Toutes les valeurs sont en données: outils (`tool.work` d'un objet), ressources (`commun/ressources/`), cultures (`commun/cultures/`); règles communes dans `reglages.ts`.

| Fichier         | Rôle                                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `outils.ts`     | l'objet tenu, niveau, points et cases par coup, durée d'un coup (`toolSpeed` des besoins), `strike` (usure par `wearTool`, faim, saleté par `soil`) |
| `ressources.ts` | brique `harvest`: coups cumulés, butin, repousse en jours; `resourceReady`, `resourceProgress` pour le rendu                                        |
| `butin.ts`      | tables de butin: heure, météo, saison, pluie de la veille (`rainedYesterday`, `rainedOn` de `monde/meteo.ts`), `rareLuck`, `extraCatch`             |
| `forge.ts`      | amélioration et réparation payée: `upgradeOf`, `repairCostOf`, intentions `tool_upgrade` et `tool_repair_paid`                                      |
| `saison.ts`     | saison du jour, plages d'heures, pluie                                                                                                              |
| `briques.ts`    | les deux briques pour le registre (`briques/registre.ts`)                                                                                           |
| `evenements.ts` | `work_hit` (chaque coup), `harvested`, `plot_changed`, `crop_reaped`, `tool_upgraded`                                                               |

## Pour le rendu, le son et l'interface

- Début d'un geste: `gesture_started` du noyau (clip, cible); coup: `work_hit` (`action`, `progress`, `done`); fin: `harvested` (l'arbre tombe, `rare` pour fêter une trouvaille), `crop_reaped` (avec `quality`), `plot_changed`.
- Verbe de la cible: `player.aim` et `aimOf(...).verb` (« Couper », « Bêcher », « Semer », « Arroser », « Récolter »); refus: `aimOf(...).refusal` (`needs-axe`, `tool-too-weak`, `not-yet-back`, `nothing-now`, `needs-spade`, `needs-tilling`, `needs-seed`, `not-ripe`, `already-watered`, `no-more-plots`, `wrong-season`).
- État d'une ressource: `resourceReady` (sinon, montrer `after` de la fiche: souche, arbre nu, rien).
- Usure: `toolWearRatio` (`sac/outils.ts`).

## Règle d'un coup

Une ressource demande `work` points; un coup en donne `power` (outil en état) ou `bluntPower` (émoussé), 1 à mains nues. Hache de base 6, forgée 9, émoussée 4: le chêne (36) tombe en 6, 4 ou 9 coups, chacun de 1,5 s au plus. Une ressource de `minTier` 1 refuse l'outil de base.
