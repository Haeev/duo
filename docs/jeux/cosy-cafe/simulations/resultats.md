# Cosy Café (titre de travail): résultats de la simulation

<!-- empreinte:82123c3f8313 -->
Fichier écrit par `docs/jeux/cosy-cafe/simulations/cosy_cafe.py --resultats` (bibliothèque standard de Python, graines fixes). 40 parties par duo; chaque journée ouverte de chaque partie est jouée client par client. Ne pas retoucher à la main: relancer le script, puis `--croise` sur le cahier.

## Méthode

- Une journée ouverte est une simulation à événements discrets: chaque groupe de clients arrive selon l'attrait de la carte (règle AT-07), entre ou renonce (CL-03), commande, attend que chaque étape de chaque recette passe par son poste, s'assoit, reste, recommande parfois, part; joueurs et employés prennent les tâches par priorités (finir un geste, servir, prendre les commandes, préparer, laver, débarrasser).
- Entre les journées: achats selon le duo (catalogue et paliers d'ambiance), embauches, épargne après l'offre de l'adresse suivante, défi local, déménagement le lundi, succursales (SU-02), rattrapage de réputation (RE-05).
- Trois duos: tranquille, médian et rapide (vitesse des gestes, hésitation, gestes parfaits, temps de préparation et de fermeture, part épargnée, goût pour la décoration). Ce sont des hypothèses, à recaler au prototype (CA-58).

## 1. Progression: jour et heures de jeu à chaque arrivée, médiane [1er et 9e déciles]

<!-- table:res_progression -->
| Duo | Arrivée au bourg | En ville | À Paris (quartier) | À la maison parisienne | Fête de la maison | Parties finies |
|---|---|---|---|---|---|---|
| Duo tranquille | jour 36 [29-36], 11,7 h [9,4-11,8] | jour 64 [57-64], 21,6 h [19,3-21,7] | jour 92 [85-92], 31,9 h [29,7-32,2] | jour 120 [106-127], 42,8 h [38,1-45,5] | jour 155 [148-169], 56,2 h [53,1-61,1] | 40 sur 40 |
| Duo médian | jour 22 [22-22], 5,8 h [5,7-5,8] | jour 43 [43-43], 11,9 h [11,9-12,0] | jour 64 [64-64], 18,4 h [18,3-18,5] | jour 85 [85-92], 25,4 h [25,1-27,6] | jour 120 [120-127], 36,4 h [36,0-38,6] | 40 sur 40 |
| Duo rapide | jour 22 [22-22], 4,7 h [4,6-4,7] | jour 43 [43-43], 9,7 h [9,7-9,8] | jour 64 [64-64], 15,1 h [15,0-15,2] | jour 85 [78-85], 21,0 h [19,1-21,1] | jour 113 [106-120], 28,5 h [26,7-30,5] | 40 sur 40 |

Chaque arrivée tombe un lundi (on déménage le jour de fermeture): les écarts entre duos se comptent en semaines.

## 2. Ce qui décide du jour de chaque départ (part des parties)

<!-- table:res_blocage -->
| Duo | Départ | Réputation du défi | Extension du défi | Épargne | Offre |
|---|---|---|---|---|---|
| Duo tranquille | village vers bourg | 0 % | 25 % | 75 % | 0 % |
| Duo tranquille | bourg vers ville | 0 % | 0 % | 100 % | 0 % |
| Duo tranquille | ville vers Paris, quartier | 92 % | 0 % | 8 % | 0 % |
| Duo tranquille | Paris, quartier vers Paris, maison | 40 % | 0 % | 60 % | 0 % |
| Duo médian | village vers bourg | 80 % | 12 % | 8 % | 0 % |
| Duo médian | bourg vers ville | 20 % | 0 % | 80 % | 0 % |
| Duo médian | ville vers Paris, quartier | 100 % | 0 % | 0 % | 0 % |
| Duo médian | Paris, quartier vers Paris, maison | 52 % | 5 % | 42 % | 0 % |
| Duo rapide | village vers bourg | 90 % | 10 % | 0 % | 0 % |
| Duo rapide | bourg vers ville | 28 % | 55 % | 18 % | 0 % |
| Duo rapide | ville vers Paris, quartier | 100 % | 0 % | 0 % | 0 % |
| Duo rapide | Paris, quartier vers Paris, maison | 38 % | 0 % | 62 % | 0 % |

« Réputation » et « extension »: le défi attendait la réputation ou son lieu; « épargne »: le défi était fait, il manquait l'installation; « offre »: la lettre de l'adresse suivante n'était pas arrivée.

## 3. Service du duo médian: première et dernière semaine à chaque adresse

<!-- table:res_service -->
| Adresse | Période | Groupes venus par jour | Groupes servis | Repartis sans entrer | Attente moyenne | Attente, 9 sur 10 en dessous | Satisfaction | Charge de chaque joueur | Employés présents | Personnages présents (moyenne des pointes / plus haut) | Plafond C2 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| village | première semaine | 24 | 23 | 2 % | 33 s | 49 s | 76 | 58 % | 0 | 14 / 24 | 24 |
| village | dernière semaine | 38 | 33 | 10 % | 44 s | 71 s | 79 | 77 % | 0 | 18 / 24 | 24 |
| bourg | première semaine | 36 | 33 | 7 % | 41 s | 65 s | 73 | 73 % | 0 | 18 / 38 | 48 |
| bourg | dernière semaine | 53 | 44 | 15 % | 56 s | 94 s | 73 | 81 % | 0 | 25 / 42 | 48 |
| ville | première semaine | 63 | 48 | 22 % | 65 s | 108 s | 70 | 78 % | 0 | 28 / 41 | 72 |
| ville | dernière semaine | 97 | 80 | 16 % | 84 s | 159 s | 67 | 80 % | 3 | 49 / 59 | 72 |
| Paris, quartier | première semaine | 122 | 94 | 22 % | 66 s | 119 s | 69 | 74 % | 4 | 43 / 51 | 80 |
| Paris, quartier | dernière semaine | 144 | 116 | 18 % | 66 s | 130 s | 69 | 72 % | 7 | 54 / 72 | 80 |
| Paris, maison | première semaine | 148 | 129 | 11 % | 49 s | 81 s | 74 | 84 % | 5 | 56 / 76 | 120 |
| Paris, maison | dernière semaine | 235 | 180 | 23 % | 100 s | 194 s | 77 | 84 % | 9 | 97 / 120 | 120 |

Première semaine: gestes à la main, peu d'équipement; dernière semaine: machines achetées et, dès la ville, employés. Repartis: groupes qui n'entrent pas (file pleine, attente estimée trop longue, café complet).

## 4. Une journée ouverte moyenne du duo médian, par adresse

<!-- table:res_economie -->
| Adresse | Recettes | Pourboires | Matières | Loyer (lundi compris) | Salaires | Charges | Résultat | Succursales (en plus) |
|---|---|---|---|---|---|---|---|---|
| village | 197 € | 3 € | 43 € | 22 € | 0 € | 8 € | 127 € | 0 € |
| bourg | 314 € | 3 € | 46 € | 48 € | 18 € | 16 € | 190 € | 71 € |
| ville | 788 € | 7 € | 91 € | 121 € | 187 € | 34 € | 363 € | 176 € |
| Paris, quartier | 1 523 € | 10 € | 134 € | 271 € | 613 € | 60 € | 456 € | 374 € |
| Paris, maison | 2 887 € | 49 € | 249 € | 625 € | 850 € | 140 € | 1 072 € | 590 € |

Montants par journée ouverte; le loyer court aussi le lundi. Les succursales s'ajoutent au résultat du café joué.

## 5. Ce que l'équipe change: dernière configuration du duo médian, un mardi et un samedi

<!-- table:res_sans_employes -->
| Adresse | Équipe | Employés | Groupes servis par jour | Repartis | Attente moyenne | Satisfaction | Service fini après la fermeture |
|---|---|---|---|---|---|---|---|
| ville | avec l'équipe | 4 | 103 | 32 % | 87 s | 66 | 139 s |
| ville | à deux, sans employés | 0 | 53 | 65 % | 97 s | 66 | 152 s |
| Paris, quartier | avec l'équipe | 8 | 142 | 21 % | 69 s | 69 | 100 s |
| Paris, quartier | à deux, sans employés | 0 | 66 | 63 % | 79 s | 70 | 107 s |
| Paris, maison | avec l'équipe | 12 | 186 | 19 % | 112 s | 76 | 146 s |
| Paris, maison | à deux, sans employés | 0 | 68 | 70 % | 73 s | 86 | 40 s |

Même café, même carte, même jour: à deux seulement, les grandes adresses refusent une bonne part de leurs clients.

## 6. Personnages présents à la fois (joueurs et employés compris) et employés, toutes parties

<!-- table:res_presence -->
| Adresse | Présents au plus, 99 jours sur 100 | Présents au plus | Plafond C2 | Employés au plus | Plafond C5 | Respecté |
|---|---|---|---|---|---|---|
| village | 24 | 24 | 24 | 0 | 12 | oui |
| bourg | 35 | 42 | 48 | 1 | 12 | oui |
| ville | 56 | 62 | 72 | 5 | 12 | oui |
| Paris, quartier | 68 | 73 | 80 | 8 | 12 | oui |
| Paris, maison | 118 | 120 | 120 | 12 | 12 | oui |

Le plafond C2 de l'architecte compte tous les personnages présents dans l'adresse; le plafond des visibles (C1, C3) relève du validateur des plans.

## 7. Rythme réel: durée de chaque adresse (médiane) et d'une journée ouverte

<!-- table:res_rythme -->
| Duo | village | bourg | ville | Paris, quartier | Paris, maison | Journée ouverte moyenne |
|---|---|---|---|---|---|---|
| Duo tranquille | 35 jours, 11,7 h | 28 jours, 9,9 h | 28 jours, 10,5 h | 28 jours, 10,7 h | 42 jours, 15,6 h | 24,5 min |
| Duo médian | 21 jours, 5,8 h | 21 jours, 6,2 h | 21 jours, 6,4 h | 21 jours, 6,9 h | 35 jours, 11,1 h | 20,6 min |
| Duo rapide | 21 jours, 4,7 h | 21 jours, 5,1 h | 21 jours, 5,4 h | 21 jours, 5,9 h | 28 jours, 7,6 h | 17,3 min |

Temps réel joué, préparation et fermeture comprises, lundis compris.

## 8. Argent en caisse à l'arrivée à chaque adresse (duo médian)

<!-- table:res_epargne -->
| Arrivée à | Installation payée | Caisse le jour de l'arrivée (médiane) | 9 duos sur 10 entre |
|---|---|---|---|
| bourg | 600 € | 252 € | 110 € à 347 € |
| ville | 1 200 € | 491 € | 299 € à 766 € |
| Paris, quartier | 2 500 € | 1 678 € | 1 032 € à 4 581 € |
| Paris, maison | 3 000 € | 2 662 € | 2 299 € à 7 937 € |

Ce qui reste en caisse une fois l'installation payée: de quoi acheter les premières machines de la nouvelle adresse.

## 9. Réglages du duo sur la dernière configuration d'un duo tranquille, un mardi et un samedi

<!-- table:res_aides -->
| Adresse | Réglage du duo | Service réel | Groupes servis | Repartis | Attente moyenne | Satisfaction | Charge de chaque joueur |
|---|---|---|---|---|---|---|---|
| bourg | normal | 11,5 min | 41 | 15 % | 82 s | 69 | 81 % |
| bourg | rythme paisible | 14,4 min | 45 | 9 % | 70 s | 72 | 77 % |
| bourg | patience grande | 11,5 min | 44 | 11 % | 95 s | 67 | 81 % |
| bourg | les deux | 14,4 min | 47 | 5 % | 79 s | 70 | 76 % |
| Paris, quartier | normal | 13,0 min | 142 | 25 % | 77 s | 70 | 76 % |
| Paris, quartier | rythme paisible | 16,2 min | 154 | 19 % | 67 s | 71 | 76 % |
| Paris, quartier | patience grande | 13,0 min | 144 | 24 % | 87 s | 68 | 76 % |
| Paris, quartier | les deux | 16,2 min | 156 | 17 % | 70 s | 70 | 77 % |

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
| 8 h | 17,7 | 8,6 | 0,1 | 31 s | 25 |
| 9 h | 20,1 | 15,5 | 1,0 | 44 s | 37 |
| 10 h | 20,5 | 15,8 | 1,2 | 58 s | 52 |
| 11 h | 18,0 | 15,7 | 2,0 | 66 s | 63 |
| 12 h | 13,8 | 13,2 | 2,4 | 74 s | 66 |
| 13 h | 14,4 | 12,1 | 2,2 | 75 s | 64 |
| 14 h | 18,9 | 12,5 | 1,6 | 85 s | 66 |
| 15 h | 19,6 | 13,4 | 3,1 | 100 s | 74 |
| 16 h | 21,4 | 12,9 | 6,1 | 120 s | 81 |
| 17 h | 16,9 | 12,4 | 5,6 | 132 s | 81 |
| 18 h | 10,8 | 11,0 | 3,6 | 127 s | 78 |
| 19 h | 5,2 | 9,4 | 1,2 | 112 s | 69 |
| 20 h | 2,2 | 16,9 | 0,1 | 80 s | 57 |

Un mardi de la dernière semaine à la maison parisienne (duo médian).

## 12. Exemple chiffré de l'attrait

<!-- table:res_exemple -->
| Profil | Passants intéressés dans l'heure | Carte | Prix | Lieu | Réputation (2 tasses) | Humeur d'hier (74) | Groupes attendus dans l'heure |
|---|---|---|---|---|---|---|---|
| Les pressés | 1,62 | 6 points: x1,1 | x1 | x0,93 | x0,85 | x1,04 | 1,47 |
| Les voisins | 1,22 | 6 points: x1,1 | x1 | x0,95 | x0,85 | x1,04 | 1,13 |
| Les familles | 0,07 | 4 points: x0,9 | x1 | x0,95 | x0,85 | x1,04 | 0,05 |
| Les gourmands | 0,00 | 3 points: x0,75 | x1 | x0,95 | x0,85 | x1,04 | 0,00 |

Règle AT-07: groupes attendus = passants x carte x prix x lieu x réputation x humeur, ici le premier mardi au village.

## 13. Valeurs clés citées dans le cahier

<!-- table:res_cles -->
| Clé | Valeur |
|---|---|
| `fin_h_lent` | 56,2 |
| `fin_j_lent` | 155 |
| `arr_h_bourg_lent` | 11,7 |
| `arr_h_ville_lent` | 21,6 |
| `arr_h_paris-quartier_lent` | 31,9 |
| `arr_h_paris-maison_lent` | 42,8 |
| `fin_h_median` | 36,4 |
| `fin_j_median` | 120 |
| `arr_h_bourg_median` | 5,8 |
| `arr_h_ville_median` | 11,9 |
| `arr_h_paris-quartier_median` | 18,4 |
| `arr_h_paris-maison_median` | 25,4 |
| `fin_h_rapide` | 28,5 |
| `fin_j_rapide` | 113 |
| `arr_h_bourg_rapide` | 4,7 |
| `arr_h_ville_rapide` | 9,7 |
| `arr_h_paris-quartier_rapide` | 15,1 |
| `arr_h_paris-maison_rapide` | 21,0 |

Calcul: 162 s sur la machine de l'environnement cloud.
