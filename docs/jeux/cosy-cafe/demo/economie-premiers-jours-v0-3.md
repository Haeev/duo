# Deux Tabliers: l'économie des premiers jours

| Champ | Valeur |
|---|---|
| Rédaction | game-designer, 2026-11-09 |
| Statut | proposition, à valider par le client (question EP-Q1) |
| Origine | séance du 2026-11-09 sur la 0.2.4, mardi 2, premier jour ouvert: « on a fini une journée en servant tous les clients avec des marges de +90 % et on finit la journée à -14 euros » |
| Vaut pour | le départ équipé de la v0.2 (300 € de caisse) et le départ en cellule vide de la v0.3 (`depart-cellule-vide-v0-3.md`, 1 800 € d'épargne) |
| Simulation | `simulations/premiers_jours_v0_3.py` (5 s par lancement) |
| Ne change pas | la montée en charge de la 0.2.3 (`warmup`: 7 groupes calmes le mardi, puis 0,5, 0,7, 0,85), les prix, le loyer et les charges à partir du jour 8 |

## 1. En une phrase

Un premier mardi bien servi doit finir au-dessus de zéro: le bilan compte la marge des ventes et non le stock acheté, Simone laisse le loyer de la première semaine, et la commande proposée pendant la montée en charge ne remplit plus la vitrine pour une salle à moitié vide.

## 2. Diagnostic du mardi au calme

### 2.1 La journée de la séance, reconstituée

Relevés du carnet de séance (états de l'invité), recoupés avec le code de la 0.2.4 (`journee.ts`, `economie.ts`). La reconstitution tombe juste au centime.

| Moment | Caisse | Ce qui s'est passé |
|---|---|---|
| Départ | 300,00 € | `startCash` |
| Lundi 1, aube | 281,43 € | loyer 18,57 € (520 / 28) |
| Mardi 2, aube | 229,36 € | loyer 18,57 €, puis livraison payée à 7 h: 33,50 € |
| 9 h 31 | 234,56 € | premier groupe: allongé, tartine, espresso (5,20 €) |
| 10 h 19 | 236,16 € | Simone: allongé (1,60 €) |
| 17 h 12 | 239,96 € | un flâneur: thé noir, pain au chocolat (3,80 €) |
| Soir | 230,96 € | charges 9,00 €, aucun pourboire |

La livraison du mardi est exactement la commande habituelle que propose la tablette (recalculée par le script): 1 caisse de lait (6 L, 7,80 €) + port d'Armelle sous son franco (3,00 €), 1 pain de campagne (20 tranches, 2,40 €), 10 pains au chocolat (7,50 €), 1 tarte de 8 parts (12,80 €). Total 33,50 €.

Le bilan du soir de la 0.2.4 (`result` = recette + pourboires - marchandise reçue - port - loyer - charges) affiche donc:

| Ligne | Montant |
|---|---|
| Recette | + 10,60 € |
| Marchandise reçue | - 30,50 € |
| Port | - 3,00 € |
| Loyer | - 18,57 € |
| Charges | - 9,00 € |
| **Résultat du jour** | **- 50,47 €** |

Je ne retrouve pas les -14 € cités: aucune combinaison des lignes ne les donne (la plus proche, recette - loyer - charges, fait -16,97 €). Peut-être une autre partie, ou un chiffre retenu de mémoire. Le constat reste le même et il est pire: le jeu affiche une perte de 50 € pour une journée sans faute.

### 2.2 Pourquoi un service parfait finit dans le rouge

1. **Le bilan compte le stock comme une perte.** La marchandise reçue le matin sort en entier du résultat le jour de la livraison, alors qu'elle se vend sur plusieurs jours. Le soir de la séance, il restait en réserve 106,72 € de marchandise encore bonne (1 977 g de café, 6 L de lait, 18 tranches de pain, 8 parts de tarte, le sec offert par Simone). Le jeu dit « -50 € » à un café qui a surtout rempli sa réserve. Dans le départ v0.3, c'est pire: la première livraison achète aussi le sec (cacao, thé, sucre de table, confiture, beurre) et le même mardi parfait afficherait **-68 €** (simulation, duo qui sert tout).
2. **Les frais fixes ne suivent pas la montée en charge.** Loyer 18,57 € et charges 9,00 € font 27,57 € par jour. Avec 75 % de marge en moyenne (90 % sur les boissons, 42 à 50 % sur les viennoiseries et la tarte), il faut environ 37 € de ventes pour les couvrir. Sept groupes de une ou deux personnes en achètent environ 38 € quand on les sert tous (simulation): le mardi calme est construit pour finir à zéro au mieux, avant même les invendus.
3. **La commande proposée est calée sur l'affluence réduite, mais les cartons ne le sont pas.** La tablette applique bien le facteur 0,3 du mardi (`announced`), mais elle arrondit au carton supérieur: pour 4 à 5 pains au chocolat prévus, elle en commande 10, et une tarte entière de 8 parts. Le soir, 9 pains au chocolat partent au panier du voisinage (6,75 €).
4. **L'historique de la montée en charge est compté deux fois.** Le jeudi, la commande habituelle prend la moyenne de ce qui s'est vendu mardi et mercredi (jours réduits) et la multiplie encore par l'affluence annoncée du jeudi (0,7). Elle sous-estime donc les jours qui suivent. Le même défaut gonflera la commande après la fête du Tilleul (1,6), sans effet dans la démo puisqu'elle finit le lundi suivant.
5. **Le mardi calme suit le rythme du duo.** Un groupe calme n'entre que quand le précédent est servi (`holdCalmArrival`). Dans la séance, le premier groupe a attendu sa tartine de 9 h à l'après-midi (les notes montrent que le plan de travail, la bouilloire et la vitrine n'étaient pas compris): sur les 7 groupes prévus, 3 ont payé. « Tous les clients servis » était vrai, mais pour 10,60 € de ventes. Ce point relève du guide et de l'interface (notes de séance transmises à ux-ui-designer), pas de l'économie; il explique pourquoi la proposition doit tenir aussi pour un duo lent.

### 2.3 Le mardi selon la simulation, avant correction

Médianes de 200 parties, attrait 0,75 la première semaine (section 8). « Bilan par la marge » = la nouvelle lecture proposée en section 3.1, appliquée aux règles actuelles.

| Départ | Duo | Ventes | Bilan 0.2.4 affiché | Bilan par la marge |
|---|---|---|---|---|
| v0.2 équipé | sert tout | 38,35 € | -21,72 € | -8,33 € |
| v0.2 équipé | sert 60 % | 22,70 € | -37,81 € | -20,01 € |
| v0.3 cellule vide | sert tout | 38,35 € | -67,72 € | -13,33 € |
| v0.3 cellule vide | sert 60 % | 22,70 € | -83,81 € | -25,01 € |

Lire le bilan par la marge ne suffit donc pas: même avec un bilan juste, un mardi parfait reste à -8 €. Il faut aussi alléger les frais de la première semaine.

Ce que la montée en charge a coûté: sur les jours 2 à 5, elle retire 155 € de marge à un duo qui sert tout et 91 € à un duo qui sert 60 % (simulation avec et sans `warmup`). La simulation de la v0.3 (`depart-cellule-vide-v0-3.md`, section 10) a été faite sans la montée en charge: ses caisses de la première semaine sont donc trop optimistes d'autant.

## 3. Proposition

Cinq réglages, chacun avec sa raison. Le défi reste entier à partir du jour 8 (loyer et charges pleins, affluence normale, fête du jour 14).

### 3.1 Un bilan qui sépare la marge, les frais, les invendus et le stock

Le résultat du jour devient ce que la journée a vraiment rapporté: la marge des ventes, moins les frais du jour, moins ce qui est parti sans être vendu. La marchandise achetée n'y entre que le jour où elle se vend (coût des ventes) ou le jour où elle part (périmée ou donnée). Ce qui reste en réserve est un avoir, montré à part.

Page « La journée en chiffres », dans cet ordre:

| Bloc | Ligne | Calcul | Signe |
|---|---|---|---|
| Ventes et marge | Ventes | `today.revenue` | + |
| | Pourboires | `today.tips` | + |
| | Événement | `today.euros` (si non nul) | + |
| | Ingrédients des ventes | `today.materials` (coût des ventes) | - |
| | **Marge sur les ventes** | somme du bloc, et sa part des ventes en % | = |
| Loyer et charges | Loyer | `rentCents`, ou 0 avec la mention « offert par Simone » | - |
| | Charges | somme du détail, avec le facteur du jour (3.3) | - |
| | Port | ports du matin (0 et « offert » à l'ouverture, 3.4) | - |
| | Dépannages (majoration) | la seule majoration de 30 %: le carton lui-même entre en réserve | - |
| | Publicité | `today.marketing` | - |
| Invendus | Périmé ce matin | `today.lost` | - |
| | Panier du soir | `today.basketValue` (et « n pièces données aux voisins ») | - |
| | **Résultat du jour** | marge - loyer et charges - invendus | = |
| Caisse et réserve (à part) | Marchandise reçue ce matin | `today.goods` + dépannages au prix du carton | pour mémoire |
| | Réserve ce soir | valeur des lots encore bons, au coût unitaire | pour mémoire |
| | Achats du jour | catalogue et équipement | pour mémoire |
| | Caisse ce soir | `cash` et l'écart depuis hier soir | pour mémoire |

Invariant (à tester): à partir du jour 2, **résultat du jour = (caisse ce soir - caisse hier soir) + (réserve ce soir - réserve hier soir) + achats du jour**, où la caisse est nette de ce qui reste « à régler ». Le jour 1, la réserve offerte par Simone (85 € en v0.2, 21,30 € en v0.3) entre en réserve sans passer par le résultat.

Le lundi: Loyer (ou « offert par Simone »), Périmé ce matin s'il y en a, Résultat; le bloc « Caisse et réserve » s'affiche aussi.

Le résumé du téléphone (appli Bilans, « Mardi 2 : +1,07 € ») et l'historique de Duo lisent ce même résultat.

### 3.2 Simone laisse le loyer de la première semaine

Du jour 1 au jour 7, aucun loyer n'est prélevé. La ligne reste visible au bilan, à 0, avec son montant normal en petit: le joueur apprend ce qu'il paiera dès le lundi 8.

- Pourquoi Simone: elle possède les murs dans la v0.3 (Q20 validée) et elle veut que le café revive. Dans la v0.2, elle laisse déjà la caisse et la réserve; le geste lui ressemble dans les deux départs.
- Pourquoi sept jours: c'est la semaine de la montée en charge, et 7 x 18,57 = 130 € rendent à peu près ce que la montée en charge retire (155 € de marge pour un duo qui sert tout, 91 € pour un duo lent). La simulation de la v0.3, faite sans montée en charge, retrouve ainsi son équilibre.
- Pourquoi pas proportionnel à l'affluence: un loyer qui varie chaque jour ne se comprend pas; « la première semaine est offerte » se dit en une phrase et se voit au bilan.
- La réserve de sécurité des achats (EC-04, deux jours de loyer et de charges) ne change pas: elle prépare le jour 8.

### 3.3 Charges réduites les deux premiers jours ouverts

Mardi 2: charges x 0,5 (4,50 €); mercredi 3: x 0,75 (6,75 €); ensuite 9,00 €. Raison affichée: la machine a peu tourné, la plonge a peu servi. C'est le réglage le plus petit (6,75 € en tout); il fait passer le mardi d'un duo lent au-dessus de zéro sans toucher au reste.

### 3.4 Port offert à la première livraison

La livraison du premier jour ouvert ne paie pas de port (Armelle et Joseph: « Pour l'ouverture, on ne compte pas le port »). Pourquoi: le mardi, on commande un peu de tout pour remplir une réserve vide; le franco (15 € chez Armelle, 30 € chez Joseph) est alors hors d'atteinte sans sur-commander. En v0.3, le cadeau de grains de Simone fait tomber Joseph sous son franco: 8 € de port le premier matin. Coût: 3 € (v0.2) à 8 € (v0.3), une seule fois.

### 3.5 Une commande proposée à la mesure de la montée en charge

- **Viennoiseries par 5, tarte de 6 parts.** Lucas vend désormais ses croissants et ses pains au chocolat par 5 (au lieu de 10) et une tarte de 6 parts (au lieu de 8). Un boulanger de village vend à la pièce; garder un paquet évite une commande pièce par pièce. Le prix unitaire ne change pas.
- **Arrondi du frais pendant la montée en charge.** Un jour de livraison dont l'affluence annoncée est sous 1, une ligne fraîche (conservation de 2 jours ou moins) s'arrondit au carton le plus proche à partir d'une demi-carton (et non plus au carton supérieur dès la première unité qui manque). Exception: une ligne de l'ardoise sans rien de bon en réserve reçoit au moins un carton, pour que rien ne soit grisé le matin.
- **Historique ramené à l'affluence normale.** Ce qui s'est vendu un jour est divisé par l'affluence annoncée de ce jour avant d'entrer dans la moyenne (mardi: ventes / 0,3). La commande du jeudi ne réduit plus deux fois.
- **Ce qui ne change pas:** les facteurs annoncés (0,3; 0,5; 0,7; 0,85), les 14 portions par recette sans historique, les marges de commande (1,2 et 1,1 pour le frais).

Commande proposée pour le mardi 2, avec l'ardoise de la séance (huit lignes):

| Départ | 0.2.4 | Proposition |
|---|---|---|
| v0.2 équipé | lait 1 (7,80 €), pain de campagne 1 (2,40 €), pains au chocolat 10 (7,50 €), tarte 8 parts (12,80 €); port 3,00 €; **33,50 €** | lait 1 (7,80 €), pain de campagne 1 (2,40 €), pains au chocolat 5 (3,75 €), tarte 6 parts (9,60 €); port offert; **23,55 €** |
| v0.3 cellule vide | les mêmes, plus beurre (4,00 €), cacao (12,00 €), thé noir (9,00 €), confiture (4,00 €), accompagnements (12,00 €); port 8,00 €; **79,50 €** | les mêmes en version proposée, plus le même sec; port offert; **64,55 €** |

## 4. Effet chiffré

Commande (depuis la racine du dépôt):

```text
python3 -I -B docs/jeux/cosy-cafe/demo/simulations/premiers_jours_v0_3.py
python3 -I -B docs/jeux/cosy-cafe/demo/simulations/premiers_jours_v0_3.py servis=0.6
```

« Sert tout »: chaque groupe arrivé est servi (le cas de la plainte). « Sert 60 % »: un duo qui débute, proche de la séance (4 groupes sur 7 le mardi). Médianes de 200 parties; entre parenthèses, le décile bas (une partie sur dix fait moins).

### 4.1 Les quatre premiers jours ouverts, bilan par la marge

| Départ | Duo | Version | Mardi 2 | Mercredi 3 | Jeudi 4 | Vendredi 5 | Jours 2 à 5 | Invendus jours 2 à 5 |
|---|---|---|---|---|---|---|---|---|
| v0.2 équipé | sert tout | 0.2.4 | -8,33 (-14,97) | 17,09 | 24,14 | 40,36 | 75,65 (31,22) | 23,12 |
| v0.2 équipé | sert tout | proposition | **21,49 (14,85)** | 41,34 | 43,52 | 60,22 | **170,81 (128,76)** | 9,70 |
| v0.2 équipé | sert 60 % | 0.2.4 | -20,01 (-29,58) | -11,87 | -0,06 | 5,73 | -21,71 (-60,62) | 34,64 |
| v0.2 équipé | sert 60 % | proposition | **9,81 (0,24)** | 14,43 | 21,31 | 29,30 | **78,10 (44,39)** | 17,55 |
| v0.3 cellule vide | sert tout | 0.2.4 | -13,33 (-19,97) | 17,09 | 24,96 | 40,65 | 71,69 (26,62) | 23,14 |
| v0.3 cellule vide | sert tout | proposition | **21,49 (14,85)** | 41,34 | 44,24 | 60,22 | **169,88 (128,76)** | 9,70 |
| v0.3 cellule vide | sert 60 % | 0.2.4 | -25,01 (-34,58) | -11,87 | 0,30 | 5,73 | -26,71 (-65,62) | 34,64 |
| v0.3 cellule vide | sert 60 % | proposition | **9,81 (0,24)** | 14,43 | 22,03 | 29,30 | **78,96 (44,39)** | 17,55 |

Pour comparaison, le bilan affiché aujourd'hui au mardi 2 (sert tout): -21,72 € en v0.2 et -67,72 € en v0.3.

La journée exacte de la séance, rejouée avec la proposition: ventes 10,60 €, ingrédients 2,03 €, marge 8,57 € (81 %); loyer offert; charges 4,50 €; port offert; panier du soir 4 pains au chocolat (3,00 €). **Résultat: +1,07 €**, réserve ce soir 103,52 €. Le café de trois clients ne gagne presque rien, mais il ne « perd » plus 50 €.

### 4.2 Les deux semaines

| Départ | Duo | Version | Somme des résultats, jours 1 à 15 | Invendus | Caisse au jour 15 |
|---|---|---|---|---|---|
| v0.2 équipé | sert tout | 0.2.4 | 711 € (592) | 45 € | 1 055 € |
| v0.2 équipé | sert tout | proposition | 875 € (763) | 30 € | 1 223 € |
| v0.2 équipé | sert 60 % | 0.2.4 | 229 € (142) | 77 € | 571 € |
| v0.2 équipé | sert 60 % | proposition | 399 € (323) | 39 € | 741 € |
| v0.3 cellule vide | sert tout | 0.2.4 | 718 € (596) | 46 € | 1 210 € |
| v0.3 cellule vide | sert tout | proposition | 876 € (768) | 29 € | 1 368 € |
| v0.3 cellule vide | sert 60 % | 0.2.4 | 228 € (129) | 76 € | 723 € |
| v0.3 cellule vide | sert 60 % | proposition | 401 € (315) | 39 € | 891 € |

Les caisses absolues ne se comparent pas à celles de `depart-cellule-vide-v0-3.md`: ce script n'achète rien (ni places, ni décor, ni terrasse). Seuls les écarts comptent: **+158 à +170 € au jour 15**, faits d'environ 130 € de loyer offert, 7 € de charges, 3 à 8 € de port et 15 à 38 € d'invendus évités, moins quelques ventes manquées. C'est à peu près ce que la montée en charge de la 0.2.3 avait retiré: la courbe de la v0.3 (caisse de 70 à 240 € le soir la première semaine, terrasse et trois tasses avant la fête) est retrouvée.

### 4.3 Toujours un défi ?

- La première semaine devient une semaine d'apprentissage où un duo qui sert bien gagne un peu (20 à 60 € par soir en semaine, une centaine le samedi et le dimanche) et un duo qui débute finit à zéro au pire (décile bas du mardi: +0,24 €). C'est la promesse « un service parfait équilibre au moins ».
- Le défi revient le lundi 8 avec le loyer, puis la semaine pleine et la fête: à partir du jour 9, les deux versions donnent les mêmes journées (écarts de quelques euros, dans le bruit de la simulation).
- Un mauvais service se voit toujours: « Ce qui a manqué » au livre d'or, la réputation, les invendus au bilan. On n'efface pas les erreurs, on cesse de punir les bonnes journées.

## 5. Cohérence avec les deux départs

| Point | v0.2 (café équipé, 300 €) | v0.3 (cellule vide, 1 800 €) |
|---|---|---|
| Loyer offert jours 1 à 7 | Simone laisse la caisse, la réserve et la première semaine | Simone loue ses murs; le lundi de l'installation et la semaine d'ouverture sont pour elle |
| Bilan par la marge | le mardi passe de -21,72 € affiché à +21,49 € | le mardi passe de -67,72 € affiché à +21,49 €: le sec de la première livraison n'est plus une perte |
| Port offert à l'ouverture | 3 € | 8 € |
| Commande du mardi | 23,55 € au lieu de 33,50 € | 64,55 € au lieu de 79,50 € (la v0.3 annonçait 124 € sans montée en charge) |
| Ce que la v0.3 prévoyait déjà | | le lundi 1 de l'installation prélève 18,57 € (section 4.1 de la v0.3): avec cette proposition, il est offert aussi. À reporter dans `depart-cellule-vide-v0-3.md` (phrase « le loyer du lundi est prélevé comme d'habitude ») |
| Les autres adresses (Mérelles et après) | hors démo | hors démo: la règle `rentFree` vaut pour la maison de départ seulement; à rediscuter avec le cahier complet |

## 6. Données et règles à modifier (pour le développeur)

Rien n'est modifié dans le jeu par ce document. Mettre à jour `donnees/SCHEMA.md` avec chaque clé.

### 6.1 Données

| Fichier | Clé | Avant | Après | Raison |
|---|---|---|---|---|
| `donnees/clientele/economie.json` | `rentFree` (nouvelle) | absente | `{"untilDay": 7, "by": "Simone"}` | 3.2; `untilDay` = dernier jour sans loyer, jours de la maison de départ |
| `donnees/clientele/regles.json` | `warmup[day=2].charges` (nouvelle) | absente | `0.5` | 3.3 |
| `donnees/clientele/regles.json` | `warmup[day=3].charges` | absente | `0.75` | 3.3 |
| `donnees/clientele/regles.json` | `warmup[day=4].charges`, `warmup[day=5].charges` | absentes | `1` | explicite, pour le validateur |
| `donnees/clientele/fournisseurs.json` | `ordering.openingFreeShipping` (nouvelle) | absente | `true` | 3.4 |
| `donnees/clientele/fournisseurs.json` | `ordering.warmupFreshRoundFrom` (nouvelle) | absente | `0.5` | 3.5; part de carton à partir de laquelle on arrondit au-dessus, les jours dont l'affluence annoncée est sous 1 |
| `donnees/clientele/fournisseurs.json` | `ingredients[croissant_boulanger]` | `"pack": "par 10"`, `"cartonUnits": 10` | `"pack": "par 5"`, `"cartonUnits": 5` | 3.5 |
| `donnees/clientele/fournisseurs.json` | `ingredients[pain_chocolat_boulanger]` | `"pack": "par 10"`, `"cartonUnits": 10` | `"pack": "par 5"`, `"cartonUnits": 5` | 3.5 |
| `donnees/clientele/fournisseurs.json` | `ingredients[tarte_boulanger]` | `"pack": "tarte de 8 parts"`, `"cartonUnits": 8` | `"pack": "tarte de 6 parts"`, `"cartonUnits": 6` | 3.5 |
| `donnees/clientele/textes.json` | `dialogues.simone_rent_gift` (nouveau) | absent | voir 7.2 | dit le cadeau au moment où il compte |
| `donnees/clientele/textes.json` | `dialogues.simone_first_result` (nouveau) | absent | voir 7.2 | explique le résultat le premier soir |

Ne pas changer: `rentPerMonth` (520), `rentDaysPerMonth` (28), `charges` (9,00 € par jour ouvert), `reserveDaysOfCharges` (2), `warmup[].announced` (0,3; 0,5; 0,7; 0,85), `ordering.baselineServingsPerRecipe` (14), `ordering.margin` (1,2), `ordering.freshMargin` (1,1).

### 6.2 Règles (code)

- **Loyer** (`dawn`, `mondayReport`, `evening`): si `s.day <= rentFree.untilDay`, rien n'est prélevé; le rapport porte `rent: 0` et `rentWaived: rentCents(cc)` (pour la mention). Pas de remboursement rétroactif pour une sauvegarde déjà au-delà du jour 1: les jours restants jusqu'au 7 sont offerts.
- **Charges** (`evening`): `charges = Σ cents(perOpenDay x k)` avec `k = warmupOf(day)?.charges ?? 1`; le détail des charges affiche les montants réduits.
- **Port** (`receiveMorningOrder`): le premier jour ouvert de la maison (`s.openDays === 0` au matin), `shipping = 0` si `openingFreeShipping`; le rapport porte `shippingWaived` (somme des ports qui auraient été dus).
- **Commande habituelle** (`suggestedOrder`): (a) à la fin de chaque journée, ranger `todayUse / announcedAffluence(cc, day)` dans `s.usage` (sauvegardes anciennes: l'historique déjà rangé reste tel quel, trois jours au plus); (b) si `announcedAffluence(cc, day) < 1` et `ing.shelfDays <= 2`, `n = floor(want / units) + (reste >= warmupFreshRoundFrom ? 1 : 0)`, puis `n = max(n, 1)` si `goodOn(s, ing, day) === 0`; sinon `ceil` comme aujourd'hui.
- **Dépannage** (`index.ts`, `today.emergency`): garder le prix payé, et ajouter `today.emergencyExtra = prix - cartonCents(ing)` (la majoration seule).
- **Rapport du soir** (`journee.ts`): nouveaux champs `margin = revenue + tips + euros - materials`, `stockValue` (lots encore bons après le panier, au coût unitaire, centimes), `rentWaived`, `shippingWaived`, `chargesFactor`; `result = margin - rent - charges - shipping - emergencyExtra - marketing - lost - basketValue`. Le lundi: `result = -rent - lost - marketing`. `goods` et `emergency` restent au rapport pour le bloc « Caisse et réserve ».
- **Vue** (`branchement/interface.ts`, `interface/modele.ts`, `interface/bilan.ts`): les quatre blocs de 3.1, chacun avec son titre; la marge en % des ventes; la ligne « Réserve ce soir » toujours affichée un jour ouvert; à 1366 x 768, le bloc « Caisse et réserve » passe en deux colonnes sous le résultat si la page déborde.
- **Aperçu** (`interface/apercu/apercu.ts`): mettre à jour l'exemple du bilan (les valeurs « par 10 » et le résultat).

## 7. Textes

Tutoiement; Simone parle aux deux joueurs (« vous »); aucun accord au genre des joueurs; espace avant les deux-points comme dans l'interface existante.

### 7.1 Bilan du soir (`src/interface/textes.ts`, objet `evening`)

| Clé | Avant | Après |
|---|---|---|
| `revenue` | « Recette » | « Ventes » |
| `salesTitle` (nouvelle) | | « Ventes et marge » |
| `costOfSalesLine` (nouvelle) | | « Ingrédients des ventes » |
| `margin` (nouvelle) | | « Marge sur les ventes » |
| `marginPct` (nouvelle) | | « soit {pct} % des ventes » |
| `costsTitle` (nouvelle) | | « Loyer et charges » |
| `rentWaived` (nouvelle) | | « Loyer : offert par Simone ({amount} par jour à partir du lundi {day}) » |
| `chargesLight` (nouvelle) | | « Charges d'une petite journée (la machine a peu tourné) » |
| `shippingWaived` (nouvelle) | | « Port : offert pour l'ouverture ({amount}) » |
| `emergency` | « Dépannages » | « Dépannages (majoration) » |
| `unsoldTitle` (nouvelle) | | « Invendus » |
| `lost` | « Perdu (dates passées) » | « Périmé ce matin » |
| `basket` | « Panier du soir » | « Panier du soir, donné aux voisins » |
| `result` | « Résultat du jour » | inchangé |
| `resultHelp` (nouvelle) | | « Ce que la journée a rapporté une fois tout payé. La marchandise encore en réserve n'est pas perdue : elle compte le jour où tu la vends. » |
| `resultWarmup` (nouvelle, jours de montée en charge, résultat sous 10 €) | | « Petite journée : cette semaine, les clients arrivent peu à peu. » |
| `resultNegative` (nouvelle, résultat négatif hors montée en charge) | | « La journée n'a pas couvert ses frais. Regarde les invendus et la commande de demain. » |
| `stockTitle` (nouvelle) | | « Caisse et réserve » |
| `goodsIn` (nouvelle) | | « Marchandise reçue ce matin, payée à la livraison » |
| `reserve` (nouvelle) | | « Réserve ce soir : {amount} de marchandise encore bonne » |
| `cashMove` (nouvelle) | | « {amount} depuis hier soir » |
| `goods` | « Marchandise reçue » | retirée du compte (remplacée par `goodsIn`) |
| `costOfSales` | « Coût des ventes : {amount} » | retirée (devenue la ligne `costOfSalesLine`) |

Exemple, la journée de la séance avec la proposition:

```text
Ventes et marge
  Ventes                                   + 10,60 €
  Ingrédients des ventes                    - 2,03 €
  Marge sur les ventes                      + 8,57 €   soit 81 % des ventes
Loyer et charges
  Loyer : offert par Simone (18,57 € par jour à partir du lundi 8)   0,00 €
  Charges d'une petite journée (la machine a peu tourné)            - 4,50 €
  Port : offert pour l'ouverture (3,00 €)                             0,00 €
Invendus
  Panier du soir, donné aux voisins          - 3,00 €
Résultat du jour                             + 1,07 €
  Petite journée : cette semaine, les clients arrivent peu à peu.
Caisse et réserve
  Marchandise reçue ce matin, payée à la livraison   23,55 €
  Réserve ce soir : 103,52 € de marchandise encore bonne
  Caisse ce soir   282,55 €   (- 17,45 € depuis hier soir)
```

L'invariant se vérifie sur l'exemple: la réserve est passée de 85,00 € (celle de Simone) à 103,52 €, soit + 18,52 €; - 17,45 + 18,52 = + 1,07 €.

### 7.2 Simone

| Clé | Moment | Texte |
|---|---|---|
| `simone_rent_gift` | jour 1, à la fin du prologue (v0.2) ou au moment de remettre les clés (v0.3) | « Le loyer, je ne vous le compte pas avant lundi prochain. Le temps que le village prenne le chemin. » |
| `simone_first_result` | premier bilan d'un jour ouvert, une fois | « Le résultat, c'est ce que la journée vous a laissé. Ce qui dort dans la réserve, vous le vendrez demain. » |
| `simone_rent_back` | matin du lundi 8 | « C'est lundi : le loyer reprend aujourd'hui. Vous avez bien démarré. » |

## 8. Hypothèses et limites de la simulation

- Ardoise fixe de huit lignes (celle de la séance: espresso, allongé, crème, thé noir, chocolat, pain au chocolat, tartine, tarte); elle explique exactement la livraison de la séance.
- Attrait (ardoise, prix, salle, réputation, humeur) estimé à 0,75 la première semaine et 0,9 la seconde, d'après les facteurs de `regles.json` (1,5 tasse, ambiance de départ); environ 22 groupes un jour de semaine ordinaire.
- Pas d'achat d'équipement, pas de recommande en cours de séjour, pas d'événement ni de dépannage, météo neutre, pourboires à leur espérance (5 % une fois sur deux, facteur du profil).
- « Sert 60 % » retire des groupes au hasard; dans le jeu, un duo lent perd surtout les groupes calmes suivants (ils attendent) et les impatients.
- Le bruit de 200 parties: écarts de quelques euros d'un jour à l'autre en deuxième semaine, à ne pas lire comme un effet.
- Non vérifié dans le jeu lui-même: tout ce qui précède vient du script et de la lecture du code; la reconstitution de la séance, elle, est exacte au centime.

## 9. Critères d'acceptation proposés (à rendre testables par qa-testeur)

| # | Critère | Vérification |
|---|---|---|
| EP-01 | Au bilan d'un jour ouvert, le résultat est exactement la somme des lignes des trois premiers blocs; le bloc « Caisse et réserve » n'entre pas dans le résultat | test du rapport |
| EP-02 | À partir du jour 2, résultat du jour = écart de caisse nette depuis la veille au soir + écart de valeur de la réserve + achats du jour, au centime | test sur 15 jours de robots (graine fixe) |
| EP-03 | Jours 1 à 7: aucun loyer prélevé, ligne « Loyer : offert par Simone » au bilan; jour 8 (lundi): 18,57 € prélevés | test des jours 1 à 8 |
| EP-04 | Charges: 4,50 € le jour 2, 6,75 € le jour 3, 9,00 € ensuite | test |
| EP-05 | Première livraison: port à 0, ligne « Port : offert pour l'ouverture »; les livraisons suivantes paient le port sous le franco | test |
| EP-06 | Départ v0.2, ardoise de la séance, sans commande envoyée: la livraison du mardi 2 est lait 1, pain de campagne 1, pains au chocolat 1 x 5, tarte 1 x 6, soit 23,55 € | test de `suggestedOrder` |
| EP-07 | L'historique de commande est rangé divisé par l'affluence annoncée du jour (mardi: ventes / 0,3) | test unitaire |
| EP-08 | Un jour de montée en charge, une ligne fraîche sans rien de bon en réserve reçoit au moins un carton; rien n'est grisé à l'ardoise le matin pour faute de livraison | test et capture |
| EP-09 | Simulation courte: mardi 2, duo qui sert tout, résultat médian au moins +10 € dans les deux départs; duo à 60 %, médian au moins 0 € | `premiers_jours_v0_3.py` |
| EP-10 | Une sauvegarde 0.2.4 rouverte au jour 2 ou 3 se charge; ses jours restants jusqu'au 7 sont sans loyer; aucun remboursement | test de chargement |
| EP-11 | Bilan lisible à 1366 x 768 sans défilement horizontal | capture |
| EP-12 | Aucun texte nouveau n'accorde au genre d'un joueur ni ne contient de tiret cadratin ou demi-cadratin | relecture et contrôle du CLAUDE.md |

## 10. Questions pour le client

| # | Question | Recommandation |
|---|---|---|
| EP-Q1 | Le résultat du soir compte la marge des ventes et met à part la marchandise encore en réserve (elle n'est plus une perte le jour où elle arrive). D'accord ? | oui: c'est la cause principale du « -50 € » de mardi, et en v0.3 la première livraison (le sec) aurait affiché -68 € pour un mardi parfait |
| EP-Q2 | Simone laisse le loyer de la première semaine (130 €), et les charges des deux premiers jours sont réduites de moitié puis d'un quart ? | oui: c'est ce que la montée en charge vous a retiré, la semaine d'apprentissage finit au-dessus de zéro, le défi revient le lundi 8 |
| EP-Q3 | Lucas vend ses viennoiseries par 5 et des tartes de 6 parts, et la tablette commande moins de frais pendant la montée en charge ? | oui: moins d'invendus jetés (environ 10 € au lieu de 23 € sur les jours 2 à 5), sans manque mesurable ensuite |

## 11. Écarts avec les documents existants

- `realisme-v0-2.md`, P0-4: la formule du résultat (marchandise reçue retirée en entier) est remplacée par celle de 3.1; le tableau des lignes aussi.
- `depart-cellule-vide-v0-3.md`, section 4.1: « le loyer du lundi est prélevé comme d'habitude (18,57 €) » devient « le loyer de la première semaine est offert par Simone »; section 10: les caisses de la première semaine ont été simulées sans la montée en charge de la 0.2.3 (note à ajouter sous le tableau).
- Cahier des charges, EC-03 (loyer prélevé chaque jour): exception de la première semaine de la démo; voir l'historique (0.2.5).
