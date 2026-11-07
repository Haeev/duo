# Cosy Café (titre de travail): résultats de la simulation

<!-- empreinte:4d4995c8a570 -->
Fichier écrit par `docs/jeux/cosy-cafe/simulations/cosy_cafe.py --resultats` (bibliothèque standard de Python, graines fixes). 40 parties par duo; chaque journée ouverte de chaque partie est jouée client par client. Ne pas retoucher à la main: relancer le script, puis `--croise` sur le cahier.

## Méthode

- Une journée ouverte est une simulation à événements discrets: chaque groupe de clients arrive selon l'attrait de la carte (règle AT-07), entre ou renonce (CL-03), commande, attend que chaque étape de chaque recette passe par son poste, s'assoit, reste, recommande parfois, part; joueurs et employés prennent les tâches par priorités (finir un geste, servir, prendre les commandes, préparer, laver, débarrasser).
- Entre les journées: achats selon le duo (catalogue et paliers d'ambiance), embauches, épargne après l'offre de l'adresse suivante, défi local, déménagement le lundi, succursales (SU-02), rattrapage de réputation (RE-05).
- Trois duos: tranquille, médian et rapide (vitesse des gestes, hésitation, gestes parfaits, temps de préparation et de fermeture, part épargnée, goût pour la décoration). Ce sont des hypothèses, à recaler au prototype (CA-51).

## 1. Progression: jour et heures de jeu à chaque arrivée, médiane [1er et 9e déciles]

<!-- table:res_progression -->
| Duo | Arrivée au bourg | En ville | À Paris (quartier) | À la maison parisienne | Fête de la maison | Parties finies |
|---|---|---|---|---|---|---|
| Duo tranquille | jour 36 [29-36], 11,7 h [9,4-11,8] | jour 64 [57-64], 21,6 h [19,2-21,7] | jour 92 [85-92], 31,8 h [29,4-31,9] | jour 113 [106-120], 40,0 h [37,6-42,4] | jour 148 [141-155], 53,1 h [50,7-55,5] | 40 sur 40 |
| Duo médian | jour 22 [22-22], 5,8 h [5,7-5,8] | jour 43 [43-50], 11,9 h [11,9-13,8] | jour 64 [64-71], 18,3 h [18,2-20,2] | jour 85 [85-92], 25,0 h [24,9-27,0] | jour 113 [113-120], 34,0 h [33,8-36,2] | 40 sur 40 |
| Duo rapide | jour 22 [22-22], 4,7 h [4,6-4,7] | jour 43 [43-43], 9,8 h [9,7-9,8] | jour 64 [64-64], 15,0 h [15,0-15,1] | jour 85 [78-85], 20,7 h [18,9-20,8] | jour 113 [106-113], 28,3 h [26,4-28,4] | 40 sur 40 |

Chaque arrivée tombe un lundi (on déménage le jour de fermeture): les écarts entre duos se comptent en semaines.

## 2. Ce qui décide du jour de chaque départ (part des parties)

<!-- table:res_blocage -->
| Duo | Départ | Réputation du défi | Extension du défi | Épargne | Offre |
|---|---|---|---|---|---|
| Duo tranquille | village vers bourg | 0 % | 25 % | 75 % | 0 % |
| Duo tranquille | bourg vers ville | 0 % | 0 % | 100 % | 0 % |
| Duo tranquille | ville vers Paris, quartier | 100 % | 0 % | 0 % | 0 % |
| Duo tranquille | Paris, quartier vers Paris, maison | 30 % | 0 % | 70 % | 0 % |
| Duo médian | village vers bourg | 80 % | 12 % | 8 % | 0 % |
| Duo médian | bourg vers ville | 18 % | 0 % | 82 % | 0 % |
| Duo médian | ville vers Paris, quartier | 100 % | 0 % | 0 % | 0 % |
| Duo médian | Paris, quartier vers Paris, maison | 80 % | 20 % | 0 % | 0 % |
| Duo rapide | village vers bourg | 90 % | 10 % | 0 % | 0 % |
| Duo rapide | bourg vers ville | 32 % | 57 % | 10 % | 0 % |
| Duo rapide | ville vers Paris, quartier | 100 % | 0 % | 0 % | 0 % |
| Duo rapide | Paris, quartier vers Paris, maison | 68 % | 8 % | 25 % | 0 % |

« Réputation » et « extension »: le défi attendait la réputation ou son lieu; « épargne »: le défi était fait, il manquait l'installation; « offre »: la lettre de l'adresse suivante n'était pas arrivée.

## 3. Service du duo médian: première et dernière semaine à chaque adresse

<!-- table:res_service -->
| Adresse | Période | Groupes venus par jour | Groupes servis | Repartis sans entrer | Attente moyenne | Attente, 9 sur 10 en dessous | Satisfaction | Charge de chaque joueur | Employés présents | Personnages présents (moyenne des pointes / plus haut) | Plafond C2 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| village | première semaine | 24 | 23 | 2 % | 33 s | 49 s | 76 | 58 % | 0 | 14 / 24 | 24 |
| village | dernière semaine | 38 | 33 | 10 % | 44 s | 71 s | 79 | 77 % | 0 | 18 / 24 | 24 |
| bourg | première semaine | 35 | 32 | 6 % | 40 s | 63 s | 72 | 72 % | 0 | 18 / 36 | 48 |
| bourg | dernière semaine | 54 | 44 | 16 % | 59 s | 98 s | 73 | 82 % | 0 | 25 / 38 | 48 |
| ville | première semaine | 63 | 48 | 22 % | 63 s | 102 s | 71 | 78 % | 0 | 27 / 38 | 72 |
| ville | dernière semaine | 96 | 73 | 23 % | 65 s | 113 s | 69 | 79 % | 3 | 40 / 47 | 72 |
| Paris, quartier | première semaine | 121 | 89 | 26 % | 60 s | 107 s | 70 | 74 % | 4 | 39 / 47 | 80 |
| Paris, quartier | dernière semaine | 147 | 101 | 29 % | 70 s | 132 s | 68 | 75 % | 5 | 46 / 59 | 80 |
| Paris, maison | première semaine | 144 | 130 | 8 % | 51 s | 88 s | 74 | 83 % | 6 | 61 / 78 | 120 |
| Paris, maison | dernière semaine | 221 | 160 | 26 % | 110 s | 200 s | 75 | 83 % | 9 | 90 / 115 | 120 |

Première semaine: gestes à la main, peu d'équipement; dernière semaine: machines achetées et, dès la ville, employés. Repartis: groupes qui n'entrent pas (file pleine, attente estimée trop longue, café complet).

## 4. Une journée ouverte moyenne du duo médian, par adresse

<!-- table:res_economie -->
| Adresse | Recettes | Pourboires | Matières | Loyer (lundi compris) | Salaires | Charges | Résultat | Succursales (en plus) |
|---|---|---|---|---|---|---|---|---|
| village | 197 € | 3 € | 43 € | 22 € | 0 € | 8 € | 127 € | 0 € |
| bourg | 313 € | 3 € | 45 € | 48 € | 17 € | 16 € | 190 € | 71 € |
| ville | 781 € | 6 € | 95 € | 121 € | 169 € | 34 € | 368 € | 178 € |
| Paris, quartier | 1 549 € | 9 € | 147 € | 271 € | 482 € | 60 € | 597 € | 385 € |
| Paris, maison | 3 068 € | 51 € | 285 € | 625 € | 806 € | 140 € | 1 263 € | 708 € |

Montants par journée ouverte; le loyer court aussi le lundi. Les succursales s'ajoutent au résultat du café joué.

## 5. Ce que l'équipe change: dernière configuration du duo médian, un mardi et un samedi

<!-- table:res_sans_employes -->
| Adresse | Équipe | Employés | Groupes servis par jour | Repartis | Attente moyenne | Satisfaction | Service fini après la fermeture |
|---|---|---|---|---|---|---|---|
| ville | avec l'équipe | 3 | 95 | 40 % | 63 s | 69 | 61 s |
| ville | à deux, sans employés | 0 | 52 | 67 % | 99 s | 64 | 135 s |
| Paris, quartier | avec l'équipe | 5 | 139 | 43 % | 64 s | 71 | 59 s |
| Paris, quartier | à deux, sans employés | 0 | 63 | 74 % | 91 s | 67 | 102 s |
| Paris, maison | avec l'équipe | 10 | 159 | 26 % | 128 s | 74 | 142 s |
| Paris, maison | à deux, sans employés | 0 | 63 | 71 % | 81 s | 85 | 45 s |

Même café, même carte, même jour: à deux seulement, les grandes adresses refusent une bonne part de leurs clients.

## 6. Personnages présents à la fois (joueurs et employés compris) et employés, toutes parties

<!-- table:res_presence -->
| Adresse | Présents au plus, 99 jours sur 100 | Présents au plus | Plafond C2 | Employés au plus | Plafond C5 | Respecté |
|---|---|---|---|---|---|---|
| village | 24 | 24 | 24 | 0 | 12 | oui |
| bourg | 34 | 39 | 48 | 1 | 12 | oui |
| ville | 45 | 47 | 72 | 5 | 12 | oui |
| Paris, quartier | 58 | 65 | 80 | 7 | 12 | oui |
| Paris, maison | 111 | 119 | 120 | 10 | 12 | oui |

Le plafond C2 de l'architecte compte tous les personnages présents dans l'adresse; le plafond des visibles (C1, C3) relève du validateur des plans.

## 7. Rythme réel: durée de chaque adresse (médiane) et d'une journée ouverte

<!-- table:res_rythme -->
| Duo | village | bourg | ville | Paris, quartier | Paris, maison | Journée ouverte moyenne |
|---|---|---|---|---|---|---|
| Duo tranquille | 35 jours, 11,7 h | 28 jours, 9,9 h | 28 jours, 10,2 h | 28 jours, 10,5 h | 35 jours, 13,1 h | 24,3 min |
| Duo médian | 21 jours, 5,8 h | 21 jours, 6,2 h | 21 jours, 6,3 h | 21 jours, 6,7 h | 28 jours, 8,9 h | 20,4 min |
| Duo rapide | 21 jours, 4,7 h | 21 jours, 5,1 h | 21 jours, 5,3 h | 21 jours, 5,7 h | 28 jours, 7,6 h | 17,1 min |

Temps réel joué, préparation et fermeture comprises, lundis compris.

## 8. Argent en caisse à l'arrivée à chaque adresse (duo médian)

<!-- table:res_epargne -->
| Arrivée à | Installation payée | Caisse le jour de l'arrivée (médiane) | 9 duos sur 10 entre |
|---|---|---|---|
| bourg | 600 € | 252 € | 110 € à 347 € |
| ville | 1 200 € | 477 € | 273 € à 787 € |
| Paris, quartier | 2 500 € | 966 € | 767 € à 1 473 € |
| Paris, maison | 3 000 € | 2 196 € | 1 729 € à 2 938 € |

Ce qui reste en caisse une fois l'installation payée: de quoi acheter les premières machines de la nouvelle adresse.

## 9. Réglages du duo sur la dernière configuration d'un duo tranquille, un mardi et un samedi

<!-- table:res_aides -->
| Adresse | Réglage du duo | Service réel | Groupes servis | Repartis | Attente moyenne | Satisfaction | Charge de chaque joueur |
|---|---|---|---|---|---|---|---|
| bourg | normal | 11,5 min | 42 | 14 % | 82 s | 70 | 80 % |
| bourg | rythme paisible | 14,4 min | 45 | 6 % | 70 s | 72 | 76 % |
| bourg | patience grande | 11,5 min | 44 | 9 % | 96 s | 67 | 81 % |
| bourg | les deux | 14,4 min | 47 | 3 % | 77 s | 70 | 76 % |
| Paris, quartier | normal | 13,0 min | 123 | 31 % | 80 s | 69 | 77 % |
| Paris, quartier | rythme paisible | 16,2 min | 138 | 24 % | 63 s | 71 | 77 % |
| Paris, quartier | patience grande | 13,0 min | 128 | 29 % | 86 s | 69 | 77 % |
| Paris, quartier | les deux | 16,2 min | 139 | 23 % | 70 s | 70 | 76 % |

Rythme paisible: une heure de jeu dure 75 s au lieu de 60, le même flux est moins serré. Patience grande: les clients attendent une fois et demie plus longtemps avant de renoncer.

## 10. Profil horaire, village

<!-- table:res_heures_village -->
| Heure de jeu | Groupes venus | Servis | Repartis | Attente moyenne | Personnages présents au plus |
|---|---|---|---|---|---|
| 8 h | 2,9 | 1,6 | 0,0 | 23 s | 5 |
| 9 h | 4,2 | 3,0 | 0,2 | 32 s | 9 |
| 10 h | 5,4 | 3,5 | 0,8 | 45 s | 13 |
| 11 h | 5,5 | 3,6 | 1,3 | 58 s | 15 |
| 12 h | 3,4 | 3,5 | 0,8 | 55 s | 15 |
| 13 h | 3,5 | 2,8 | 0,6 | 55 s | 13 |
| 14 h | 4,8 | 3,2 | 1,0 | 60 s | 14 |
| 15 h | 6,3 | 3,4 | 2,1 | 72 s | 16 |
| 16 h | 7,8 | 3,3 | 3,7 | 87 s | 18 |
| 17 h | 7,0 | 8,9 | 3,4 | 89 s | 18 |

Un dimanche de la dernière semaine au village (duo médian): le coup de feu du matin, puis celui du goûter.

## 11. Profil horaire, maison parisienne

<!-- table:res_heures_maison -->
| Heure de jeu | Groupes venus | Servis | Repartis | Attente moyenne | Personnages présents au plus |
|---|---|---|---|---|---|
| 8 h | 17,5 | 8,6 | 0,1 | 31 s | 24 |
| 9 h | 19,1 | 14,7 | 1,1 | 44 s | 35 |
| 10 h | 19,4 | 15,7 | 1,3 | 54 s | 48 |
| 11 h | 15,7 | 13,8 | 1,2 | 69 s | 58 |
| 12 h | 12,8 | 12,7 | 2,3 | 75 s | 60 |
| 13 h | 13,3 | 10,6 | 1,8 | 79 s | 59 |
| 14 h | 16,5 | 11,4 | 1,9 | 83 s | 60 |
| 15 h | 19,1 | 12,1 | 3,3 | 102 s | 67 |
| 16 h | 19,8 | 11,6 | 6,0 | 125 s | 72 |
| 17 h | 16,3 | 11,0 | 5,9 | 136 s | 75 |
| 18 h | 9,3 | 9,8 | 3,1 | 133 s | 72 |
| 19 h | 4,3 | 9,7 | 1,0 | 114 s | 65 |
| 20 h | 2,4 | 15,0 | 0,1 | 87 s | 52 |

Un mardi de la dernière semaine à la maison parisienne (duo médian).

## 12. Exemple chiffré de l'attrait

<!-- table:res_exemple -->
| Profil | Heure | Passants intéressés dans l'heure | Carte | Prix | Lieu | Réputation (2 tasses) | Humeur d'hier (74) | Groupes attendus dans l'heure |
|---|---|---|---|---|---|---|---|---|
| Les pressés | 8 h | 1,62 | 6 points: x1,1 | x1 | x0,93 | x0,85 | x1,04 | 1,47 |
| Les voisins | 8 h | 1,22 | 6 points: x1,1 | x1 | x0,95 | x0,85 | x1,04 | 1,13 |
| Les familles | 16 h | 0,60 | 4 points: x0,9 | x1 | x0,95 | x0,85 | x1,04 | 0,45 |
| Les gourmands | 16 h | 0,84 | 3 points: x0,75 | x1 | x0,95 | x0,85 | x1,04 | 0,53 |

Règle AT-07: groupes attendus = passants x carte x prix x lieu x réputation x humeur, ici le premier mardi au village.

## 13. Valeurs clés citées dans le cahier

<!-- table:res_cles -->
| Clé | Valeur |
|---|---|
| `aides_bourg_les_deux` | 3 |
| `aides_bourg_normal` | 14 |
| `aides_bourg_patience_grande` | 9 |
| `aides_bourg_rythme_paisible` | 6 |
| `aides_paris-quartier_les_deux` | 23 |
| `aides_paris-quartier_normal` | 31 |
| `aides_paris-quartier_patience_grande` | 29 |
| `aides_paris-quartier_rythme_paisible` | 24 |
| `equipe_paris-maison_avec` | 26 |
| `equipe_paris-maison_sans` | 71 |
| `equipe_paris-quartier_avec` | 43 |
| `equipe_paris-quartier_sans` | 74 |
| `equipe_ville_avec` | 40 |
| `equipe_ville_sans` | 67 |
| `journee_median_min` | 20 |
| `seances_median` | 51 |
| `parties` | 120 |
| `a_regler` | 0 |
| `fin_h_lent` | 53,1 |
| `fin_j_lent` | 148 |
| `arr_h_bourg_lent` | 11,7 |
| `arr_h_ville_lent` | 21,6 |
| `arr_h_paris-quartier_lent` | 31,8 |
| `arr_h_paris-maison_lent` | 40,0 |
| `fin_h_median` | 34,0 |
| `fin_j_median` | 113 |
| `arr_h_bourg_median` | 5,8 |
| `arr_h_ville_median` | 11,9 |
| `arr_h_paris-quartier_median` | 18,3 |
| `arr_h_paris-maison_median` | 25,0 |
| `fin_h_rapide` | 28,3 |
| `fin_j_rapide` | 113 |
| `arr_h_bourg_rapide` | 4,7 |
| `arr_h_ville_rapide` | 9,8 |
| `arr_h_paris-quartier_rapide` | 15,0 |
| `arr_h_paris-maison_rapide` | 20,7 |

Calcul: 136 s sur la machine de l'environnement cloud.
