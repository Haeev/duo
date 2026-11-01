# La Petite Ligne, robot longue vie: premier rapport (tour 8)

| Champ | Valeur |
|---|---|
| Date | 2026-11-01 |
| Rédaction | qa-testeur (gauntlet, tour 8) |
| Code mesuré | `claude/stoic-lamport-lueey2` à `97f9dd5` |
| Spécification | `docs/jeux/jeu-1/tour-08-conception.md`, section 6 (L-01 à L-12, I-01 à I-08, O-01 à O-10) |
| Commande | `pnpm test:longue-vie` dans `games/la-petite-ligne` (`vitest.longue-vie.config.ts`, tests `tests/longue-vie/`) |
| Sorties de la commande | `test-results/longue-vie.md` (ce tableau) et `test-results/longue-vie.json` (toutes les mesures, jour par jour) |

Ce rapport sert de référence aux tours suivants. La partie « Résultats bruts » est la sortie de la commande telle quelle (nombres décimaux avec une virgule ici).

## Comment le robot joue

- Sept parties de 84 jours: graines 20261030, 1, 2 et 3 en profil médian; graine 99 en profil assidu; graine 2026 en profil glouton; graine 5 au rythme de 0,8 s par minute de jeu dès le jour 24 (D1). Plus une partie de contrôle de 14 aubes pour I-07 (graine 1).
- Seule prolongation: `clock.lastDay` porté au vendredi 84 à 16 h, **dans le contenu passé au test** (`longContent`, `tests/longue-vie/partie.ts`). Les réglages livrés ne changent pas, aucun code de production n'est touché. Les deux robots choisissent « Rester » aux étapes `demo` (jour 15) et `summer_end` (jour 43).
- Sauvegarde et relecture à chaque aube, hôte et invité inversés, empreinte comparée (L-02).
- Mesures L-01 à L-12 relevées à chaque aube ou à chaque événement; les invariants font échouer le test (`expect.soft`, tous listés), les objectifs sont seulement calculés.

## Ce qu'il faut retenir

1. **Tous les invariants tiennent, sauf I-06 (taille de l'état), qui échoue dans les sept parties.** Les 84 jours sont atteints sans blocage, chaque reprise est identique, la météo, les commandes, les envies et les textes respectent leurs règles, et les jours 1 à 15 sont inchangés (I-07).
2. **Taille de l'état (I-06).** En profil médian, l'état vaut 42 400 à 43 200 octets au jour 43 et 47 000 à 48 000 au jour 84, soit 4 350 à 5 300 octets de plus qu'au jour 43 (limite: 4 096). La graine du robot dépasse 48 000 octets aux aubes 61, 82, 83 et 84 (48 526 au plus); le profil assidu dès le jour 45 (49 024 au plus). Le profil glouton monte à 72 342 octets, mais c'est surtout un défaut du robot (point 5).
3. **Ce qui grossit**, du jour 43 au jour 84 en profil médian:
   - `heard`: +1,8 à +2,1 Ko (de 130 à 150 entrées vers 220). Une entrée par réplique entendue et par joueur: c'est borné par le nombre de répliques (239 dialogues), mais la borne est haute, et chaque réplique ajoutée au jeu l'augmente.
   - `letters`: +1,4 à +1,5 Ko (de 18 à 23 lettres). Les lettres hebdomadaires lues par les deux sont bornées à 12; restent les lettres uniques et les lettres lues par un seul joueur, qui ne partent jamais.
   - `characters`: +0,6 à +1,2 Ko, dont `envieHistory` (+1,16 Ko: une envie par joueur et par jour, jamais tronquée, 166 entrées au jour 84). Seule croissance sans aucune borne de l'état en profil médian.
   - `moments` (+0,2 à +0,5 Ko) et `orderHistory` (+0,25 Ko, borné à 8 commandes).
   - `dialoguesDone` ne grossit presque plus après le jour 22 (de 103 à 104 entrées): le correctif du tour 8 (répliques quotidiennes hors de `dialoguesDone`) tient.
   - Du jour 15 au jour 43 (médian): `letters` et `heard` +2,6 à +2,9 Ko chacun, `characters` +0,6 à +1,2 Ko, `moments` +0,5 à +0,6 Ko, `order` +0,4 à +0,5 Ko.
4. **Objectifs**: O-01 (jours 16 à 43), O-02 (jours 16 à 43, les deux profils; médian aussi jusqu'au jour 84), O-04 (86,1 % de commandes complètes), O-05 et O-08 tenus. Non tenus: O-01 et O-03 après le jour 43, O-02 en profil assidu après le jour 43, O-07 en hiver (attendus: il n'y a pas de contenu d'automne ni d'hiver, section 12); O-06 (écart médian de 11 jours au printemps et de 16,5 en été, pour 19 visés); O-09 (4 graines seulement: indicatif, le test sur 1 000 graines `suite-meteo.test.ts`, T8-11, tient); O-10 (voir le point 6).
5. **Profil glouton: le robot achète des matelas en boucle.** Son sac est plein (lits doubles fabriqués qu'il ne peut pas poser, planches, poissons, cueillettes); le matelas acheté tombe à ses pieds, et le robot, qui ne compte que le sac et le coffre (`robot.ts`, plan des meubles), en rachète un. Au jour 84: 229 objets au sol, dont 58 matelas, 78 piles de planches, 46 truites et 46 goujons. Le jeu, lui, n'a aucune borne sur `groundItems`: un vrai duo dont le sac est plein laisse aussi tomber un tas par objet reçu, et ces tas restent dans l'état.
6. **Durée (O-10).** Mesurée sur une machine partagée (charge de 25 sur 4 cœurs): 36 minutes de temps réel pour la suite. Le temps processeur par partie est le chiffre utile: 180 à 191 s pour 84 jours (2,2 s par journée), 322 s au rythme de 0,8 s. Sur quatre cœurs libres, les quatre graines médianes tiendraient en 3 à 4 minutes et la suite entière en 6 à 7 minutes (estimation, non mesurée ici).

## Résultats bruts

Parties: median-20261030 (graine 20261030, median); median-1 (graine 1, median); median-2 (graine 2, median); median-3 (graine 3, median); assidu-99 (graine 99, assidu); glouton-2026 (graine 2026, glouton); rythme-08-5 (graine 5, median, 0,8 s dès le jour 24).

### Invariants (le test échoue)

### median-20261030

| # | Seuil | Valeur | Attendu | Résultat |
|---|---|---|---|---|
| I-01 | jour 84 atteint, aucune journée bloquée, étapes franchies par « Rester » | jour 84; étapes demo, summer_end | jour 84, 0 blocage, demo et summer_end | tenu |
| I-02 | empreinte identique après chaque reprise | 0 écart | 0 | tenu |
| I-03 | pluie au plus 3 jours d’affilée, jamais 7 jours sans soleil, jour 16 au soleil, jamais de brume sous la pluie | pluie 3 j, sans soleil 6 j, jour 16 sunny, brume sous la pluie 0 | 3, 6, sunny, 0 | tenu |
| I-04 | commandes: jamais identiques à la précédente, 3 lignes au moins, 2 par famille au plus, aucun produit de base partagé, rien hors saison ni jamais obtenu | 10 commandes tirées, 0 problème | 0 problème | tenu |
| I-05 | jamais la même envie deux fois en 7 jours pour un joueur; envie à deux, la même chez les deux, tous les trois jours dès le jour 16 | 0 problème | 0 problème | tenu |
| I-06 | souvenirs sous 1536 octets, état sous 48000 octets à chaque aube, au plus 4096 octets de plus au jour 84 qu’au jour 43 | souvenirs 889, état 48526 au plus, +4793 du jour 43 au jour 84 (grossit: heard +1828, letters +1552, characters +1009, moments +270) | < 1536, < 48000, <= 4096 | non tenu |
| I-08 | aucun texte affiché ne contient `{` (variables remplies) | 0 texte | 0 | tenu |

### median-1

| # | Seuil | Valeur | Attendu | Résultat |
|---|---|---|---|---|
| I-01 | jour 84 atteint, aucune journée bloquée, étapes franchies par « Rester » | jour 84; étapes demo, summer_end | jour 84, 0 blocage, demo et summer_end | tenu |
| I-02 | empreinte identique après chaque reprise | 0 écart | 0 | tenu |
| I-03 | pluie au plus 3 jours d’affilée, jamais 7 jours sans soleil, jour 16 au soleil, jamais de brume sous la pluie | pluie 3 j, sans soleil 6 j, jour 16 sunny, brume sous la pluie 0 | 3, 6, sunny, 0 | tenu |
| I-04 | commandes: jamais identiques à la précédente, 3 lignes au moins, 2 par famille au plus, aucun produit de base partagé, rien hors saison ni jamais obtenu | 10 commandes tirées, 0 problème | 0 problème | tenu |
| I-05 | jamais la même envie deux fois en 7 jours pour un joueur; envie à deux, la même chez les deux, tous les trois jours dès le jour 16 | 0 problème | 0 problème | tenu |
| I-06 | souvenirs sous 1536 octets, état sous 48000 octets à chaque aube, au plus 4096 octets de plus au jour 84 qu’au jour 43 | souvenirs 737, état 47455 au plus, +4352 du jour 43 au jour 84 (grossit: heard +1942, letters +1457, characters +931, orderHistory +246) | < 1536, < 48000, <= 4096 | non tenu |
| I-08 | aucun texte affiché ne contient `{` (variables remplies) | 0 texte | 0 | tenu |

### median-2

| # | Seuil | Valeur | Attendu | Résultat |
|---|---|---|---|---|
| I-01 | jour 84 atteint, aucune journée bloquée, étapes franchies par « Rester » | jour 84; étapes demo, summer_end | jour 84, 0 blocage, demo et summer_end | tenu |
| I-02 | empreinte identique après chaque reprise | 0 écart | 0 | tenu |
| I-03 | pluie au plus 3 jours d’affilée, jamais 7 jours sans soleil, jour 16 au soleil, jamais de brume sous la pluie | pluie 3 j, sans soleil 6 j, jour 16 sunny, brume sous la pluie 0 | 3, 6, sunny, 0 | tenu |
| I-04 | commandes: jamais identiques à la précédente, 3 lignes au moins, 2 par famille au plus, aucun produit de base partagé, rien hors saison ni jamais obtenu | 10 commandes tirées, 0 problème | 0 problème | tenu |
| I-05 | jamais la même envie deux fois en 7 jours pour un joueur; envie à deux, la même chez les deux, tous les trois jours dès le jour 16 | 0 problème | 0 problème | tenu |
| I-06 | souvenirs sous 1536 octets, état sous 48000 octets à chaque aube, au plus 4096 octets de plus au jour 84 qu’au jour 43 | souvenirs 889, état 47540 au plus, +4927 du jour 43 au jour 84 (grossit: heard +2051, letters +1404, characters +1248, moments +271) | < 1536, < 48000, <= 4096 | non tenu |
| I-08 | aucun texte affiché ne contient `{` (variables remplies) | 0 texte | 0 | tenu |

### median-3

| # | Seuil | Valeur | Attendu | Résultat |
|---|---|---|---|---|
| I-01 | jour 84 atteint, aucune journée bloquée, étapes franchies par « Rester » | jour 84; étapes demo, summer_end | jour 84, 0 blocage, demo et summer_end | tenu |
| I-02 | empreinte identique après chaque reprise | 0 écart | 0 | tenu |
| I-03 | pluie au plus 3 jours d’affilée, jamais 7 jours sans soleil, jour 16 au soleil, jamais de brume sous la pluie | pluie 3 j, sans soleil 6 j, jour 16 sunny, brume sous la pluie 0 | 3, 6, sunny, 0 | tenu |
| I-04 | commandes: jamais identiques à la précédente, 3 lignes au moins, 2 par famille au plus, aucun produit de base partagé, rien hors saison ni jamais obtenu | 10 commandes tirées, 0 problème | 0 problème | tenu |
| I-05 | jamais la même envie deux fois en 7 jours pour un joueur; envie à deux, la même chez les deux, tous les trois jours dès le jour 16 | 0 problème | 0 problème | tenu |
| I-06 | souvenirs sous 1536 octets, état sous 48000 octets à chaque aube, au plus 4096 octets de plus au jour 84 qu’au jour 43 | souvenirs 737, état 47233 au plus, +4527 du jour 43 au jour 84 (grossit: heard +1979, letters +1418, characters +810, moments +269) | < 1536, < 48000, <= 4096 | non tenu |
| I-08 | aucun texte affiché ne contient `{` (variables remplies) | 0 texte | 0 | tenu |

### assidu-99

| # | Seuil | Valeur | Attendu | Résultat |
|---|---|---|---|---|
| I-01 | jour 84 atteint, aucune journée bloquée, étapes franchies par « Rester » | jour 84; étapes demo, summer_end | jour 84, 0 blocage, demo et summer_end | tenu |
| I-02 | empreinte identique après chaque reprise | 0 écart | 0 | tenu |
| I-03 | pluie au plus 3 jours d’affilée, jamais 7 jours sans soleil, jour 16 au soleil, jamais de brume sous la pluie | pluie 3 j, sans soleil 6 j, jour 16 sunny, brume sous la pluie 0 | 3, 6, sunny, 0 | tenu |
| I-04 | commandes: jamais identiques à la précédente, 3 lignes au moins, 2 par famille au plus, aucun produit de base partagé, rien hors saison ni jamais obtenu | 10 commandes tirées, 0 problème | 0 problème | tenu |
| I-05 | jamais la même envie deux fois en 7 jours pour un joueur; envie à deux, la même chez les deux, tous les trois jours dès le jour 16 | 0 problème | 0 problème | tenu |
| I-06 | souvenirs sous 1536 octets, état sous 48000 octets à chaque aube, au plus 4096 octets de plus au jour 84 qu’au jour 43 | souvenirs 887, état 49024 au plus, +3033 du jour 43 au jour 84 (grossit: letters +1453, characters +577, heard +570, moments +328) | < 1536, < 48000, <= 4096 | non tenu |
| I-08 | aucun texte affiché ne contient `{` (variables remplies) | 0 texte | 0 | tenu |

### glouton-2026

| # | Seuil | Valeur | Attendu | Résultat |
|---|---|---|---|---|
| I-01 | jour 84 atteint, aucune journée bloquée, étapes franchies par « Rester » | jour 84; étapes demo, summer_end | jour 84, 0 blocage, demo et summer_end | tenu |
| I-02 | empreinte identique après chaque reprise | 0 écart | 0 | tenu |
| I-03 | pluie au plus 3 jours d’affilée, jamais 7 jours sans soleil, jour 16 au soleil, jamais de brume sous la pluie | pluie 3 j, sans soleil 6 j, jour 16 sunny, brume sous la pluie 0 | 3, 6, sunny, 0 | tenu |
| I-04 | commandes: jamais identiques à la précédente, 3 lignes au moins, 2 par famille au plus, aucun produit de base partagé, rien hors saison ni jamais obtenu | 10 commandes tirées, 0 problème | 0 problème | tenu |
| I-05 | jamais la même envie deux fois en 7 jours pour un joueur; envie à deux, la même chez les deux, tous les trois jours dès le jour 16 | 0 problème | 0 problème | tenu |
| I-06 | souvenirs sous 1536 octets, état sous 48000 octets à chaque aube, au plus 4096 octets de plus au jour 84 qu’au jour 43 | souvenirs 735, état 72342 au plus, +25398 du jour 43 au jour 84 (grossit: groundItems +20553, heard +2141, letters +1510, characters +666) | < 1536, < 48000, <= 4096 | non tenu |
| I-08 | aucun texte affiché ne contient `{` (variables remplies) | 0 texte | 0 | tenu |

### rythme-08-5

| # | Seuil | Valeur | Attendu | Résultat |
|---|---|---|---|---|
| I-01 | jour 84 atteint, aucune journée bloquée, étapes franchies par « Rester » | jour 84; étapes demo, summer_end | jour 84, 0 blocage, demo et summer_end | tenu |
| I-02 | empreinte identique après chaque reprise | 0 écart | 0 | tenu |
| I-03 | pluie au plus 3 jours d’affilée, jamais 7 jours sans soleil, jour 16 au soleil, jamais de brume sous la pluie | pluie 3 j, sans soleil 6 j, jour 16 sunny, brume sous la pluie 0 | 3, 6, sunny, 0 | tenu |
| I-04 | commandes: jamais identiques à la précédente, 3 lignes au moins, 2 par famille au plus, aucun produit de base partagé, rien hors saison ni jamais obtenu | 10 commandes tirées, 0 problème | 0 problème | tenu |
| I-05 | jamais la même envie deux fois en 7 jours pour un joueur; envie à deux, la même chez les deux, tous les trois jours dès le jour 16 | 0 problème | 0 problème | tenu |
| I-06 | souvenirs sous 1536 octets, état sous 48000 octets à chaque aube, au plus 4096 octets de plus au jour 84 qu’au jour 43 | souvenirs 738, état 47637 au plus, +5282 du jour 43 au jour 84 (grossit: heard +2144, letters +1517, characters +1024, moments +550) | < 1536, < 48000, <= 4096 | non tenu |
| I-08 | aucun texte affiché ne contient `{` (variables remplies) | 0 texte | 0 | tenu |

### I-07

| # | Seuil | Valeur | Attendu | Résultat |
|---|---|---|---|---|
| I-07 | jours 1 à 15 identiques à une partie sans les systèmes nouveaux (graine 1, reprises comprises) | 14 aubes comparées, aucune ne diffère | 14 aubes, 0 écart | tenu |

### Objectifs (mesurés, ne font pas échouer au tour 8)

| # | Seuil | Valeur | Attendu | Résultat |
|---|---|---|---|---|
| O-01 | journées neuves (R1), jours 16-43 | 96,4 % au plus bas (joueur et partie); semaines sous 3: aucune | >= 95 % par joueur; >= 3 par semaine | tenu |
| O-01 | journées neuves (R1), jours 16-84 | 52,2 % au plus bas (joueur et partie); semaines sous 3: 29 (median-20261030 p1 jours 79-84: 0; median-1 p1 jours 72-78: 0; median-1 p2 jours 72-78: 2; median-1 p1 jours 79-84: 0...) | >= 95 % par joueur; >= 3 par semaine | non tenu |
| O-02 | redites des répliques (R2), profil median, jours 16-43 | 0 % au plus (odette, rythme-08-5) | < 2 % par habitant | tenu |
| O-02 | redites des répliques (R2), profil assidu, jours 16-43 | 0 % au plus (jeanne, assidu-99) | < 2 % par habitant | tenu |
| O-02 | redites des répliques (R2), profil median, jours 16-84 | 1,2 % au plus (odette, median-20261030) | < 2 % par habitant | tenu |
| O-02 | redites des répliques (R2), profil assidu, jours 16-84 | 54,3 % au plus (basile, assidu-99) | < 2 % par habitant | non tenu |
| O-03 | envies (R6): jamais reçues par saison; possibles chaque matin | printemps 75 %, été 71,4 %, automne 16,7 %, hiver 0 %; 29 possibles au plus bas | >= 30 % par saison; >= 12 | non tenu |
| O-04 | commandes complètes, profil médian, samedis 22 à 84 | 31/36 (86,1 %) | >= 80 % | tenu |
| O-05 | arbres abattables le jour 42; jamais 0 dès le jour 16 (profil médian) | 10 au jour 42 au plus bas; 2 au plus bas dès le jour 16 | >= 6; > 0 | tenu |
| O-06 | moments d’ambiance (M-22), dès le jour 16: écart médian entre deux passages d’un même moment; écart au plus bas après le jour 24 | printemps 11 j (9 écarts), été 16,5 j (30 écarts), automne 23 j (15 écarts), hiver 21,5 j (12 écarts); 10 j au plus bas après le jour 24 | >= 19 j au printemps et en été; >= 10 j après le jour 24 | non tenu |
| O-07 | moments différents vus ensemble par saison (saisons d’au moins 7 jours joués) | 1 au plus bas (median-20261030, hiver) | >= 2 | non tenu |
| O-08 | soins quotidiens (R12): arroser, remplir l’arrosoir et nourrir les poules, part du temps dehors dès le jour 16 | 0,5 % au plus | <= 30 % | tenu |
| O-09 | météo par saison (soleil/nuages/pluie, 4 graines médianes: indicatif) | printemps 75/4,2/20,8 (visé 45/25/30, 24 j); été 66,7/21,4/11,9 (visé 60/22/18, 84 j); automne 46,4/20,2/33,4 (visé 35/30/35, 84 j); hiver 35,7/41,7/22,6 (visé 30/45/25, 84 j); écart 30 points au plus | <= 8 points | non tenu |
| O-10 | durée de la suite longue vie | suite 2185 s (36,4 min); temps réel (processeur) par partie: median-20261030 1969 s (180 s), median-1 2022 s (186 s), median-2 2030 s (190 s), median-3 2043 s (191 s), assidu-99 1980 s (181 s), glouton-2026 2038 s (191 s), rythme-08-5 2172 s (322 s) | < 600 s | non tenu |

### Taille de l’état (L-03)

| Partie | Jour 15 | Jour 43 | Jour 84 | +43 à 84 | Max | Ce qui grossit du jour 15 au jour 43 | Ce qui grossit du jour 43 au jour 84 |
|---|---|---|---|---|---|---|---|
| median-20261030 | 32932 | 43242 | 48035 | 4793 | 48526 | heard +2884, letters +2883, characters +1230, moments +623, order +453 | heard +1828, letters +1552, characters +1009, moments +270, orderHistory +247 |
| median-1 | 32615 | 42604 | 46956 | 4352 | 47455 | letters +2859, heard +2737, characters +968, moments +547, order +426 | heard +1942, letters +1457, characters +931, orderHistory +246, moments +202 |
| median-2 | 32915 | 42525 | 47452 | 4927 | 47540 | letters +2933, heard +2569, characters +634, order +496, moments +483 | heard +2051, letters +1404, characters +1248, moments +271, orderHistory +247 |
| median-3 | 32408 | 42448 | 46975 | 4527 | 47233 | letters +2877, heard +2753, characters +1036, moments +612, order +460 | heard +1979, letters +1418, characters +810, moments +269, orderHistory +247 |
| assidu-99 | 33147 | 45361 | 48394 | 3033 | 49024 | heard +4620, letters +2868, characters +1404, moments +549, order +459 | letters +1453, characters +577, heard +570, moments +328, orderHistory +246 |
| glouton-2026 | 32301 | 46808 | 72206 | 25398 | 72342 | groundItems +3941, letters +2834, heard +2291, characters +2066, moments +619 | groundItems +20553, heard +2141, letters +1510, characters +666, moments +264 |
| rythme-08-5 | 32268 | 42355 | 47637 | 5282 | 47637 | letters +2811, heard +2529, characters +1132, moments +619, order +434 | heard +2144, letters +1517, characters +1024, moments +550, orderHistory +247 |

| Partie | Jour | heard (entrées, octets) | letters (nombre, octets) | dialoguesDone (nombre, octets) | envieHistory (nombre, octets) | moments.history | souvenirs |
|---|---|---|---|---|---|---|---|
| median-20261030 | 15 | 11, 285 | 9, 2666 | 89, 1944 | 28, 380 | 6 | 638 |
| median-20261030 | 43 | 147, 3169 | 18, 5502 | 103, 2203 | 84, 1247 | 15 | 810 |
| median-20261030 | 84 | 224, 4997 | 23, 7025 | 104, 2225 | 166, 2410 | 19 | 889 |
| median-1 | 15 | 9, 245 | 9, 2666 | 85, 1855 | 28, 395 | 6 | 650 |
| median-1 | 43 | 136, 2982 | 18, 5480 | 98, 2096 | 84, 1242 | 14 | 737 |
| median-1 | 84 | 219, 4924 | 23, 6912 | 99, 2118 | 166, 2433 | 17 | 737 |
| median-2 | 15 | 9, 238 | 9, 2666 | 87, 1884 | 28, 420 | 6 | 565 |
| median-2 | 43 | 132, 2807 | 18, 5551 | 100, 2124 | 84, 1229 | 13 | 889 |
| median-2 | 84 | 218, 4858 | 23, 6934 | 101, 2146 | 166, 2395 | 17 | 889 |
| median-3 | 15 | 10, 269 | 9, 2666 | 88, 1927 | 28, 400 | 5 | 577 |
| median-3 | 43 | 138, 3022 | 18, 5495 | 103, 2204 | 84, 1226 | 14 | 737 |
| median-3 | 84 | 222, 5001 | 23, 6897 | 104, 2226 | 166, 2421 | 18 | 737 |
| assidu-99 | 15 | 11, 285 | 9, 2666 | 88, 1924 | 28, 401 | 6 | 638 |
| assidu-99 | 43 | 228, 4905 | 18, 5488 | 106, 2252 | 84, 1240 | 14 | 887 |
| assidu-99 | 84 | 247, 5475 | 23, 6916 | 107, 2274 | 166, 2409 | 19 | 887 |
| glouton-2026 | 15 | 11, 294 | 9, 2666 | 90, 1983 | 28, 387 | 4 | 489 |
| glouton-2026 | 43 | 118, 2585 | 18, 5450 | 108, 2311 | 84, 1231 | 13 | 735 |
| glouton-2026 | 84 | 210, 4726 | 23, 6940 | 109, 2333 | 166, 2408 | 17 | 735 |
| rythme-08-5 | 15 | 11, 308 | 9, 2666 | 87, 1904 | 28, 392 | 5 | 491 |
| rythme-08-5 | 43 | 131, 2837 | 18, 5429 | 102, 2181 | 84, 1249 | 14 | 659 |
| rythme-08-5 | 84 | 222, 4981 | 23, 6921 | 103, 2203 | 166, 2405 | 19 | 738 |

### Mesures par partie

| Partie | s par journée (processeur) | Journées neuves 16-43 (p1, p2) | 16-84 | Commandes complètes 22-84 | Arbres jour 42 / min dès 16 | Envies neuves par saison | Soins (p1, p2) | Moments vus par saison |
|---|---|---|---|---|---|---|---|---|
| median-20261030 | 23,719 (2,174) | 100 %, 100 % | 82,6 %, 84,1 % | 7/9 | 10 / 4 | printemps 75 %, été 83,3 %, automne 21,4 %, hiver 4,8 % | 0,4 %, 0,2 % | printemps: fox geese heron ladder roe_deer tits; été: fox glowworms heron kingfisher roe_deer; automne: fox kingfisher mist; hiver: heron |
| median-1 | 24,359 (2,242) | 100 %, 100 % | 78,3 %, 79,7 % | 9/9 | 10 / 2 | printemps 75 %, été 81 %, automne 19 %, hiver 2,4 % | 0,5 %, 0,2 % | printemps: fox geese heron kingfisher mist roe_deer; été: fox glowworms heron kingfisher roe_deer; automne: fox kingfisher; hiver: fox |
| median-2 | 24,463 (2,295) | 100 %, 100 % | 76,8 %, 78,3 % | 6/9 | 12 / 4 | printemps 75 %, été 71,4 %, automne 21,4 %, hiver 2,4 % | 0,4 %, 0,2 % | printemps: fox geese heron kingfisher ladder roe_deer tits; été: glowworms kingfisher mist roe_deer; automne: fox heron kingfisher; hiver: heron |
| median-3 | 24,62 (2,301) | 100 %, 96,4 % | 75,4 %, 81,2 % | 9/9 | 12 / 2 | printemps 83,3 %, été 71,4 %, automne 21,4 %, hiver 4,8 % | 0,4 %, 0,3 % | printemps: fox geese glowworms heron kingfisher mist roe_deer; été: fox glowworms heron roe_deer; automne: fox kingfisher; hiver: fox heron |
| assidu-99 | 23,856 (2,179) | 100 %, 100 % | 55,1 %, 52,2 % | 7/9 | 10 / 4 | printemps 75 %, été 73,8 %, automne 19 %, hiver 2,4 % | 0,4 %, 0,2 % | printemps: fox geese heron kingfisher ladder mist tits; été: fox glowworms heron kingfisher roe_deer; automne: fox mist; hiver: fox heron |
| glouton-2026 | 24,551 (2,301) | 100 %, 100 % | 81,2 %, 75,4 % | 5/9 | 10 / 0 | printemps 83,3 %, été 85,7 %, automne 16,7 %, hiver 0 % | 0,4 %, 0,1 % | printemps: fox glowworms heron ladder tits; été: fox glowworms heron kingfisher roe_deer; automne: fox heron; hiver: fox heron |
| rythme-08-5 | 26,166 (3,883) | 96,4 %, 100 % | 75,4 %, 73,9 % | 8/9 | 10 / 2 | printemps 75 %, été 73,8 %, automne 19 %, hiver 0 % | 0,2 %, 0,1 % | printemps: fox geese glowworms heron kingfisher roe_deer; été: fox heron kingfisher roe_deer; automne: fox mist; hiver: fox heron |

### Commandes tirées (L-05), première partie

| N | Samedi | Lignes | Familles | Reprises | Budget | Payé | Complète |
|---|---|---|---|---|---|---|---|
| 3 | 22 | 4 | 3 | 0 | 1,9 | 851 | oui |
| 4 | 29 | 4 | 4 | 0 | 2,05 | 631 | non |
| 5 | 36 | 5 | 3 | 0 | 2,05 | 1137 | oui |
| 6 | 43 | 5 | 4 | 0 | 2,2 | 1084 | oui |
| 7 | 50 | 5 | 4 | 0 | 2,35 | 1512 | oui |
| 8 | 57 | 5 | 4 | 0 | 2,5 | 694 | non |
| 9 | 64 | 5 | 4 | 0 | 2,5 | 1348 | oui |
| 10 | 71 | 4 | 3 | 0 | 2,65 | 769 | oui |
| 11 | 78 | 3 | 3 | 2 | 2,8 | 680 | oui |
| 12 | 85 | 3 | 3 | 1 | 2,95 | - | - |

### Cueillette par saison (L-07), première partie

- printemps: dandelion 23, wild_garlic 6
- été: blackberry 50, chanterelle 41
- automne: hazelnut 32, chanterelle 29
- hiver: rien
