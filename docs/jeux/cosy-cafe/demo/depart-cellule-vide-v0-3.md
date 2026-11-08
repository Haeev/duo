# Deux Tabliers, démo v0.3: le départ dans une cellule vide

| Champ | Valeur |
|---|---|
| Statut | proposition du game designer, à relire par le manager, puis à faire valider par le client; prête à programmer (dev-gameplay-3d) |
| Date | 2026-11-08 |
| Demande du client (texte exact, 2026-11-08) | « en plus de base le jeu devait commencer sur une cellule vide et le café fermé, un budget pour démarrer et acheter meubles, et stock pour commencer ensuite là on arrive sur un café déjà tout prêt c'est dommage » |
| Pitch d'origine (cadrage) | « on commence dans une petite cellule commerciale de village, on achète meubles, déco, produits, etc. et on sert des clients » |
| Base | démo publiée (`games/deux-tabliers`, `ETAT.md`), `demo-v0-1.md`, `realisme-v0-2.md`, `remises-marketing-v0-2.md`, `ux-telephone.md`, cahier v0.2.3 |
| Lus pour les cotes | `games/deux-tabliers/donnees/adresses/village.json` (plan `village-arrivee`), `assets/modeles/shell_village.glb` et sa source `assets-src/modeles/coque.py`, `donnees/departs/village.json`, `donnees/amenagement.json`, `donnees/service/reglages.json` |
| Simulation | `docs/jeux/cosy-cafe/demo/simulations/depart_v0_3.py` (4 parties par duo et par départ, 2,5 s) |
| Remplace | le jour 1 « Les clés » de `demo-v0-1.md` (section 4), la réserve de Simone offerte de `realisme-v0-2.md` (P0-1), l'équipement fourni et la caisse de 300 € |

## 1. En une phrase

Le café de la place est fermé depuis trois ans: vous levez le rideau d'une boutique vide et poussiéreuse, vous choisissez à deux avec votre épargne la machine, le comptoir, les tables et le premier stock, vous installez tout de vos mains, et le lendemain vous retournez la pancarte d'un café qui est vraiment le vôtre.

Fantasme du joueur: « On est partis de rien. Cette machine, on l'a choisie, on l'a portée, on l'a branchée; ces chaises, on les a descendues des tables; le premier café qu'on a tiré, c'était pour Simone. »

## 2. Ce qui change

| | Démo publiée (v0.2) | Démo v0.3 |
|---|---|---|
| Arrivée | à l'intérieur d'un café équipé, Simone sur le seuil | sur la place, devant le rideau baissé d'un café fermé |
| Argent | 300 € de caisse, laissés par Simone | **1 800 € d'épargne**, la vôtre |
| Équipement | machine, moulin, caisse, frigo, bouilloire, cloche, 36 pièces de vaisselle, fournis | **rien d'autre que ce qui tient aux murs**: tout s'achète (section 4) |
| Places | 8 dedans, 2 dehors | 0 dedans (le zinc garde ses 3 places debout), 2 dehors (le banc de Simone) |
| Stock | réserve de Simone offerte (85 €) | réserve vide; Simone apporte seulement un sac de grains et une bouteille de lait pour le café d'essai |
| Jour 1 (lundi) | l'annonce, le nom, « À demain » | **l'installation**: 13 à 24 minutes de jeu réel (section 5.3) |
| Jour 2 | retourner la pancarte | lever le rideau à deux, puis retourner la pancarte |
| Ensuite | inchangé | inchangé (montée de l'affluence, événements, fête du Tilleul) |

## 3. Le local à l'arrivée

### 3.1 Qui est Simone maintenant

Simone a tenu le café trente ans. Elle l'a fermé il y a trois ans, à sa retraite, faute de repreneur, et a vendu le fonds pièce par pièce. **Elle est propriétaire des murs et habite au-dessus**: l'escalier du logement a sa propre porte sur la place, juste à l'ouest de la vitrine (plan: `door-3`, `fixture-3`). Elle vous loue la boutique (le loyer de 520 € par mois lui revient), sans caution, parce qu'elle veut que le café revive. Elle garde tout ce qui faisait d'elle une habituée et la voix des premiers jours (HA-06): son noisette au comptoir, son jardin, son banc sous la vitrine, ses conseils.

Raisons: elle est déjà la personne qui confie le lieu dans le cahier, la première cliente, la gérante future; elle habite logiquement à l'étage d'une maison de village dont elle tenait le rez-de-chaussée; et la propriétaire des murs est exactement celle qui vend « pour pas cher » ce qu'elle n'a pas eu le cœur de vendre. Une épicière d'à côté aurait fait doublon avec Mireille (`mireille`, l'épicerie d'Ormeval, déjà fournisseuse et dépanneuse).

### 3.2 Ce qui reste, parce que c'est le local

En France, ce qui est fixé aux murs reste avec le bail (les « immeubles par destination »); ce qui se débranche part avec le fonds. La coque cuite `shell_village.glb` contient déjà tout ce qui suit: la conception n'ajoute rien à la géométrie fixe.

| Élément | Où (plan `village-arrivee`) | Pourquoi il est là |
|---|---|---|
| Murs de pierre de 0,50 m, solives de chêne, plafond à 2,70 m, parquet | salle x 4,0 à 11,0, z 7,1 à 12,5 | la boutique elle-même |
| Vitrines (2 x 2,00 m), petite fenêtre au-dessus de la file, porte vitrée de 1,20 m | façade sud, z 12,5 à 13,0 | la façade de la maison |
| **Quatre rideaux métalliques**, enroulés dans l'épaisseur des linteaux (40 cm sous le plafond, dans un mur de 50 cm) | devant chaque baie, côté place | un café fermé depuis trois ans a ses rideaux baissés; enroulés dans le linteau, ils ne changent ni la façade ni l'accroche du futur store banne (E1) |
| **Le vieux comptoir de zinc et de noyer**, la passe, la joue basse et le portillon | x 8,0 à 11,0, z 8,8 à 9,5 | construit sur place, scellé au plancher sur les arrivées d'eau et de la prise de 32 A: on ne vend pas un comptoir qu'on ne peut pas sortir par la porte |
| L'arrière-comptoir carrelé et **son évier** (la plonge) | contre le refend, x 7,1 à 9,9 | l'eau et l'évacuation de l'ancienne cuisine arrivent derrière ce mur; un évier se raccorde à demeure |
| Les arrivées techniques: eau, évacuation et prise de 32 A sous la place de la machine; prise sous l'arrière-comptoir pour le frigo | marqueurs `marker-2` à `marker-4` | ce qui fait d'un local un café; c'est aussi la raison pour laquelle chaque appareil n'a qu'une place possible (DE-04) |
| Le rail à tickets au-dessus de la passe | `rail-1` | vissé au plafond; « Personne n'en a voulu », dit Simone |
| L'ardoise murale, les deux suspensions fixes du comptoir, l'applique de laiton (usée) | cuites dans la coque; l'applique est dans `startDecor` | scellées et câblées au mur |
| Les toilettes et leur lave-mains | angle nord-ouest | obligatoires dans un lieu qui reçoit du public |
| La réserve: étagères vissées, armoire froide, tableau électrique, compteur d'eau | x 8,1 à 11,0, z 3,5 à 6,7 | Simone laisse l'armoire froide: elle ne passe plus par l'escalier de son logement. La réserve reste hors de la vue jouable pour l'instant (`ETAT.md`, limite connue) |
| La pièce du fond, fermée, avec les affaires de Simone | x 4,0 à 8,0, z 3,5 à 6,7 | inchangé: c'est l'extension E2 |
| Dehors: le banc de Simone sous la vitrine ouest et son ardoise de trottoir | `seat-9`, `seat-10`, `furniture-4` | à elle; elle s'y assoit chaque matin. L'ardoise dit « Bientôt » jusqu'à l'ouverture, puis porte votre carte |

### 3.3 Ce qui n'y est plus

Vendu avec le fonds: le moulin, la caisse, le réfrigérateur sous plan, la vaisselle de restaurant, la bouilloire, la cloche à viennoiseries, la décoration, l'enseigne (le support de fer reste au-dessus de la porte, vide, prêt pour l'enseigne au nom de la maison).

Restés, mais **à Simone**, à acheter ou à laisser (section 4.2):
- **la vieille dame**, sa machine à deux groupes de 1987, à sa place sur le comptoir, sous le drap: elle n'a pas eu le cœur de la vendre. C'est la machine de l'événement « La vieille dame tousse » (jour 6);
- **ses tables et ses chaises**, à leurs anciennes places, **chaises retournées sur les tables**, sous des draps: trois guéridons de marbre le long des vitrines et la table carrée dans le coin des toilettes, deux chaises paillées par table (`departs/village.json`: `table-1` à `table-4`, `seat-1` à `seat-8`);
- un carton de vaisselle dépareillée (24 pièces), dans la pièce du fond: Simone le descend si vous le voulez.

### 3.4 L'ambiance: un café qui dort

Chaque détail dit « fermé depuis trois ans », sans rien de sale ni de triste (le ton du cahier):

| Détail | Où | Ce qu'on en fait |
|---|---|---|
| Rideaux baissés, un mot de Simone scotché sur celui de la porte: « Merci pour ces trente années. Simone » | façade | Simone le décolle en levant le rideau: « Celui-là, je le garde. » |
| Vitrines passées au blanc de Meudon (le badigeon des boutiques en travaux), une inscription tracée au doigt sur la vitrine ouest: « À LOUER · s'adresser au-dessus » | trois vitrines et la porte vitrée | se nettoient à l'éponge (section 5.6); la lumière entre, filtrée, laiteuse |
| Draps de coton gris-beige sur le comptoir et sur chaque table | comptoir, `table-1` à `table-4` | se retirent d'un geste; plis, poussière sur le dessus |
| **Une trace propre dans la poussière** du comptoir, à la place de la machine, et au sol sous chaque table | comptoir, salle | dit sans un mot où chaque chose a toujours été |
| Sept taches de poussière et de feuilles mortes entrées sous la porte | salle et allée (coordonnées section 12) | se balaient |
| Le courrier de trois ans glissé sous la porte | sol, derrière la porte (9,4 ; 12,2) | se ramasse: on y trouve les cartes des fournisseurs (section 5.2) |
| Le balai de Simone, appuyé contre la cloison des toilettes; un seau d'eau et une éponge près de la porte | (5,9 ; 9,3) et (8,6 ; 12,2) | les outils du ménage, un de chaque: l'un balaie, l'autre lave les vitrines |
| Poussière en suspension dans la lumière des vitrines | salle | disparaît quand les vitrines sont propres et la salle balayée |
| Sons: rideau qui grince et cliquette, porte qui colle, silence de la salle vide (réverbération plus longue tant qu'il n'y a ni tables ni chaises découvertes), cloches de l'église au loin | partout | la salle se réchauffe à l'oreille à mesure qu'on l'équipe |

Ce qu'on évite exprès: tags, vitres cassées, moisissures, nuisibles, dégâts à réparer (punitifs et hors ton). Trois ans de sommeil se lisent à la poussière, aux draps et au courrier.

## 4. Le budget de départ

### 4.1 L'épargne: 1 800 €, sans prêt

- **1 800 € d'épargne**, « mis de côté pour l'aventure », dans la caisse dès l'arrivée. Pas de caution (Simone), pas de frais d'agence (elle loue elle-même), le loyer du lundi est prélevé comme d'habitude (18,57 €).
- **Pas de prêt en v0.3.** Un prêt n'a pas de coût visible dans une démo de quinze jours (deux ou trois mensualités seulement): tout duo le prendrait et le choix disparaîtrait. Il contredit aussi le cahier (1.2: « pas de dette ni de faillite »). On le propose pour le jeu complet (question V3-2).
- **Pourquoi 1 800 €** (simulation, section 10): à 1 500 €, deux des quatre paniers types ne tiennent plus et le duo tranquille rate les trois tasses avant la fête dans trois parties sur quatre; à 2 100 €, tout se vaut et rien ne force à choisir. À 1 800 €, le minimum pour ouvrir (1 030 €, stock compris 1 154 €) laisse environ 770 € de marge, alors que « tout ce qu'on voudrait » en coûte plus de 2 200 (section 4.3): il faut choisir entre une meilleure machine, une salle neuve et de quoi voir venir.
- **Les prix** sont ceux d'un village et de l'occasion, tassés comme le reste de l'économie du jeu (cahier EC-08: des lieux confiés à prix d'ami). La vieille dame de Simone à 450 €, une machine révisée à 800 €: c'est trois à cinq fois moins qu'en vrai, assumé, pour que deux semaines de recettes (1 800 à 2 200 €) aient le même poids que l'installation.

### 4.2 Ce qui s'achète pour ouvrir

Nouveaux achats (groupe « Pour ouvrir » du Catalogue, palier `t0`, disponibles dès l'arrivée), plus les pièces existantes réutilisées. Les prix existants ne changent pas.

| Id proposé | Nom affiché | Prix | Vendu par | Effet | Livraison | Nécessaire ? |
|---|---|---|---|---|---|---|
| `machine-vieille-dame` | La vieille dame de Simone (deux groupes, 1987) | 450 € | Simone | poste espresso 1, vapeur 1; l'événement du jour 6 a lieu | déjà sur le comptoir, sous le drap: rien à porter | une machine des deux |
| `machine-revisee` | Machine deux groupes révisée par Joseph | 800 € | Joseph (livrée par Gaby) | espresso 1, **vapeur 2** (deux buses en état: deux laits à la fois; la vieille dame n'en a qu'une, et le pichet thermomètre n'ajoute plus rien à la révisée), **fenêtre « Parfait » de 3 s au lieu de 2**, pas de panne le jour 6 | gros carton, à deux | une machine des deux |
| `moulin-simple` | Moulin à café | 140 € | Gaby (quincaillerie de la vallée) | moulin, niveau 1 | petit carton | oui |
| `terminal-caisse` | Tiroir-caisse et terminal de carte | 80 € | Gaby | caisse | petit carton | oui |
| `vaisselle-simone` | Le carton de vaisselle de Simone (24 pièces dépareillées) | 30 € | Simone | 24 pièces | petit carton, descendu par Simone tout de suite | au moins un lot de vaisselle |
| `service-blanc` | Service blanc de café (36 pièces) | 110 € | Gaby | 36 pièces | petit carton | au moins un lot de vaisselle |
| `frigo-occasion` | Réfrigérateur sous plan d'occasion | 180 € | Gaby | poste frigo et plan; sans lui, le lait, le beurre et les œufs ne se commandent pas | gros carton, à deux | presque: sans lui, ni crème, ni noisette, ni chocolat, ni tartine |
| `bouilloire-simple` | Bouilloire | 25 € | Gaby | poste bouilloire 1 (thés, infusion) | petit carton | non |
| `cloche-viennoiseries` | Cloche à viennoiseries | 35 € | Gaby | poste vitrine 1 (croissant, pain au chocolat, tarte) | petit carton | non |
| `lot-simone-a` à `lot-simone-c` | Un guéridon de Simone et ses deux chaises | 45 € chacun (25 + 2 x 10) | Simone | 2 places, mobilier usé (charme x 0,5, rénovable: 15 € la chaise, 30 € le guéridon) | déjà en place: retirer le drap, descendre les chaises | non (le zinc garde 3 places debout); 4 places conseillées |
| `lot-simone-d` | La table carrée de Simone et ses deux chaises | 45 € | Simone | 2 places, usées | déjà en place | non |

Déjà au catalogue et proposés pendant l'installation sans changement: chaises (45 à 60 €), guéridons et tables (90 à 190 €), luminaires, plantes, cadres, peintures (`t0`), gobelets (40 €), fiches de recettes, pichet thermomètre (60 €), service de vaisselle +24 (90 €). Les pièces de palier `t1` et au-delà restent fermées (moulin à dose, terrasse, papiers peints...).

Le **premier stock** se commande dans l'appli Commandes pour mardi (inchangée): environ 124 € pour une ardoise de huit lignes (simulation), payés à la livraison du mardi à 7 h. La commande du lundi est mise de côté dans la caisse dès qu'elle est envoyée (`realisme-v0-2.md` P0-1).

### 4.3 Quatre paniers d'ouverture types

Coûts exacts (simulation), hors premier stock. « Reste » = caisse du lundi soir avant le loyer.

| Panier | Contenu | Coût | Reste | Ce que ça donne les premiers jours (duo médian, simulation) |
|---|---|---|---|---|
| **Débrouille** | vieille dame, moulin, caisse, vaisselle de Simone (24), frigo, bouilloire, cloche, deux lots de Simone (4 places) | 1 030 € | 770 € | petit café de quatre places, usé, mais 628 € en caisse le mardi après la livraison: dès le mardi soir, le duo rachète les deux autres tables de Simone (90 €) et ses premiers petits plaisirs. Gagné en 12 jours: 1 899 € |
| **Le café de Simone** | vieille dame, moulin, caisse, service blanc (36), frigo, bouilloire, cloche, les quatre lots de Simone (8 places), deux murs de peinture lin, un bouquet | 1 292 € | 508 € | le café d'avant, rouvert et repeint: le départ le plus proche de la v0.2 et le meilleur résultat (2 010 € en 12 jours, 283 € au jour 15) |
| **La belle machine** | machine révisée, moulin, caisse, vaisselle de Simone, frigo, bouilloire, cloche, deux lots de Simone (4 places) | 1 380 € | 420 € | plus de « Parfait », deux laits à la fois, pas de panne le samedi du marché; mais la salle reste modeste plus longtemps: 1 796 € en 12 jours, ambiance 74 au lieu de 77-78. C'est un choix de confort au bar, pas un placement: il aide surtout le joueur qui tient la machine sans en avoir l'habitude |
| **Coup de cœur** | vieille dame, moulin, caisse, service blanc, frigo, bouilloire, cloche, six chaises paillées neuves, trois guéridons de marbre neufs, une suspension d'osier | 1 690 € | 110 € | la plus belle salle dès le mardi (charme plein), mais **32 € « à régler » le mardi à 7 h**: la livraison de 124 € dépasse la caisse; la somme se reprend sur les recettes du soir. Aucun achat le mardi soir. 1 849 € en 12 jours |

Ce qui est impossible et le dit: « tout neuf tout de suite » (machine révisée, service blanc, six chaises et trois guéridons neufs, une suspension, deux murs de peinture, plus les appareils) coûte 2 120 €, et 2 244 € avec la première livraison. Le téléphone affiche le manque avant l'achat (section 7.2).

Lecture: aucun panier ne perd la démo (terrasse pour la fête dans 47 parties sur 48, la seule manquante est un duo tranquille avec la belle machine). Les écarts se jouent sur la première semaine: une caisse confortable ou une belle salle ou un bar plus facile. Le panier le plus « naturel » (le café de Simone) est aussi le plus rentable: on ne piège pas le duo qui suit son cœur et le guide.

## 5. Le déroulé de l'installation (jour 1, lundi)

L'horloge est arrêtée tout le lundi, comme aujourd'hui (TE-08): rien ne presse, rien ne se perd. Seul compte le temps réel, pour les livraisons du jour (section 5.4) et la chauffe de la machine.

### 5.1 L'arrivée sur la place

1. Les deux joueurs apparaissent sur la place, face au café, en (9,0 ; 14,6) et (9,9 ; 14,6), regard vers le nord. Les quatre rideaux sont baissés. Simone sort de sa porte (2,95 ; 13,2) et s'avance.
2. Simone: « Ah, vous voilà. Le café dort depuis trois ans, depuis ma retraite. Les murs sont à moi, j'habite juste au-dessus. » Puis: « Vous voilà chez vous. Faites de ce café l'endroit où l'on aime s'arrêter : équipez-le, écrivez votre carte, servez vos clients, et la maison grandira. » Puis: « Tenez, les clés. Le rideau de la porte est dur : levez-le à deux. »
3. **Lever le rideau** (geste à deux): les deux visent la poignée basse du rideau de la porte (9,4 ; 13,1), à 1,5 m au plus, et maintiennent E ensemble. Il faut 2 s de maintien commun (les deux maintiens se recouvrent; on peut commencer l'un après l'autre). Un joueur seul le soulève de 20 cm et le rideau retombe: « Trop lourd : il faut être deux. » Le rideau de la porte remonte en 1,5 s, puis Simone tourne la clé du boîtier et ceux des vitrines suivent, l'un après l'autre (0,4 s d'écart). Simone décolle son mot: « Celui-là, je le garde. »
4. La porte colle un peu (son), elle s'ouvre. Dedans: les draps, la poussière, la lumière laiteuse des vitrines blanchies.

### 5.2 La découverte (Simone fait le tour, une phrase par lieu)

Simone entre et attend au bout du comptoir. Ses répliques partent quand un joueur regarde le lieu à moins de 3 m (une seule fois chacune); elles ne bloquent rien:
- le comptoir: « Le comptoir, l'évier, les toilettes : ce qui tient aux murs est resté. Le reste, je l'ai vendu en partant. »
- le drap du comptoir: « Sous le drap, c'est la vieille dame. Ma machine. Je n'ai pas eu le cœur de la vendre. »
- une table sous un drap: « Mes tables et mes chaises sont restées là. Si elles vous plaisent, je vous les laisse pour pas cher. »
- le courrier: « Trois ans de courrier. Il doit y avoir les cartes de tout le monde là-dedans. »
- la trace propre sur le comptoir (après le drap): « Tu vois la trace ? Trente ans au même endroit. Il n'y a que là qu'arrivent l'eau et le courant. »
- sans regard particulier au bout de 40 s: « Pour ouvrir, il vous faut une machine, un moulin, une caisse et de la vaisselle. Le reste, ça se gagne. »

**Le courrier** (E sur la pile): il part en cinq messages dans l'appli Messages (conversation « Les fournisseurs » et « La mairie »), une bannière à la fois:
- Lucas: « Pour vos viennoiseries, je traverse la ruelle. Fermé le lundi, comme vous. »
- Armelle: « Le lait de la ferme, le mardi, le jeudi et le samedi. »
- Joseph: « Café torréfié dans la vallée, je passe le mardi et le vendredi. Si votre vieille machine vous lâche, j'en ai une révisée à l'atelier. »
- Mireille: « L'épicerie est à deux pas : s'il vous manque quelque chose, appelez. »
- La mairie: « Bienvenue à Ormeval. La fête du Tilleul a lieu le deuxième dimanche du printemps, sur la place. »

Le courrier n'ouvre rien: les fournisseurs sont dans Commandes dès le départ (pas de dépendance cachée). Il présente le monde et annonce le but de la deuxième semaine.

### 5.3 Combien de temps (estimation, secondes réelles)

| Étape | Duo tranquille | Duo médian | Duo rapide |
|---|---|---|---|
| Arrivée, Simone, clés, lever le rideau | 70 | 50 | 35 |
| Découverte, courrier, draps | 125 | 100 | 75 |
| Achats sur le téléphone (8 à 14 achats, 2 ou 3 propositions à deux) | 420 | 300 | 180 |
| Ménage pendant que Gaby charge (balai et vitrines en parallèle) | 60 | 45 | 35 |
| Rentrer les cartons (7 à 9, dont 2 lourds à deux) | 150 | 120 | 95 |
| Déballer et poser les appareils, descendre les chaises, placer les tables | 190 | 150 | 120 |
| Raccorder, chauffe (20 s, en temps masqué), noisette d'essai pour Simone | 75 | 60 | 50 |
| Écrire l'ardoise | 110 | 90 | 70 |
| Commande pour mardi | 110 | 90 | 70 |
| Nommer la maison | 75 | 60 | 45 |
| Bilan du lundi, « À demain » | 35 | 30 | 25 |
| **Total** | **23,7 min** | **18,3 min** | **13,3 min** |

Plus, le mardi matin, environ 30 s de plus pour lever le rideau. Cible du brief: 15 à 25 minutes; le duo rapide passe un peu sous 15 en allant droit au but, c'est voulu (rien d'obligatoire n'est allongé artificiellement). Ces durées sont des estimations, à mesurer en séance (critère DV3-16).

Pourquoi on ne s'ennuie pas: il y a toujours deux tâches indépendantes ouvertes (un outil de ménage chacun; un joueur au téléphone pendant que l'autre découvre ou balaie); la seule attente, la chauffe de 20 s, tombe au moment où il reste des appareils et des chaises à placer; la livraison arrive pendant le ménage.

### 5.4 Les achats et la livraison du jour

- **Où l'on achète**: dans le téléphone (Tab), appli Catalogue, nouvelle rubrique en tête « Pour ouvrir », qui liste les achats de la section 4.2 par besoin (« Une machine », « Un moulin », « Une caisse », « De la vaisselle », « Garder le frais », « Les thés », « Les viennoiseries », « S'asseoir »). Une puce par besoin: coche verte quand il est couvert. Le reste du catalogue suit, inchangé. Les règles d'achat existantes s'appliquent: achat de 150 € ou plus proposé à l'autre (« Proposer à Sacha »), somme réservée pendant la proposition, réserve de deux jours de charges jamais entamée (EC-04).
- **Achats de Simone** (vieille dame, lots, carton de vaisselle): l'achat se fait aussi dans le monde, en visant l'objet découvert: « Maintiens E : acheter la vieille dame à Simone · 450 € » (même intention que le téléphone, même proposition à l'autre au-dessus de 150 €). Ce qui est à Simone porte une petite étiquette de carton écrite à la main (« 45 € la table et ses chaises »).
- **Qui livre, quand**: Gaby, le plombier du village, fait les courses de la vallée le lundi avec sa camionnette (son jour de repos). La première tournée arrive **45 s réelles** après le premier achat livrable; tout achat fait pendant une tournée en cours part avec elle s'il reste plus de 15 s, sinon avec la suivante, 30 s après. Gaby: « Je vous pose tout devant la vitrine. Les gros cartons, c'est à deux ! »
- **Où**: sur le trottoir de la place, devant la vitrine ouest, dans la zone x 4,2 à 8,4, z 13,7 à 14,9. Pourquoi là et pas par la cour: une machine de 60 kg et un réfrigérateur passent par la grande porte de 1,20 m sur la place, là où la camionnette peut s'arrêter, et non par le portail de la ruelle, la réserve et l'allée de 1,10 m derrière le comptoir; la zone laisse libres le banc de Simone (z 13,05 à 13,5), l'ardoise et le passage droit devant la porte. Les livraisons quotidiennes des fournisseurs restent dans la cour (inchangé).
- **Porter**: petits cartons seul, gros cartons à deux (règles existantes: 1,2 m/s, sans demi-tour sur place, SI-08 si l'on lâche). Gros cartons de l'installation: la machine révisée, le réfrigérateur, la table de ferme, le banc, la banquette et les fauteuils s'ils sont achetés.
- **Rendre un carton**: un carton pas encore ouvert se rend à Gaby (E maintenu sur le carton, « Rendre à Gaby »: remboursé entier). Un objet de Simone se lui rend tant qu'il n'est pas raccordé ou que ses chaises ne sont pas descendues. Raison: on peut changer d'avis sans perte, le droit de se tromper fait partie du plaisir de composer.

### 5.5 Placer, brancher, essayer

- **Mode aménagement** (B, existant). Un carton ouvert devient son objet, à poser.
- **Les appareils n'ont qu'une place** (DE-04, et la trace dans la poussière la montre): l'aperçu les aimante à leur emplacement, sinon il dit pourquoi la pose est refusée.

| Appareil | Emplacement (`departs/village.json`) | Raison | Refus ailleurs |
|---|---|---|---|
| Machine | `station-4` (9,15 ; 9,005 ; hauteur 0,95) | seul point du comptoir où arrivent l'eau, l'évacuation et la prise de 32 A | « La machine ne va que là où arrivent l'eau et la prise de 32 A. » |
| Moulin | `station-5` (9,775 ; 9,04) | à droite de la machine, sur sa prise | « Le moulin se pose à côté de la machine, sur sa prise. » |
| Caisse | `station-6` (10,6 ; 9,01) | au bout est, là où la file arrive en longeant le mur | « La caisse va au bout du comptoir, là où arrive la file. » |
| Réfrigérateur | `station-2` (8,375 ; 7,395) | sous l'arrière-comptoir, sur sa prise, à un pas de la machine | « Le réfrigérateur se glisse sous l'arrière-comptoir, sur sa prise. » |
| Bouilloire, cloche | `bouilloire-1`, `vitrine-1` (ancrés à `backbar-1`) | sur l'arrière-comptoir, à portée de prise | (ancrage existant) |
| Vaisselle | `pile-tasses-1` (9,7 ; 7,4 ; 0,9) | elle se range seule sur l'arrière-comptoir quand on ouvre son carton derrière le comptoir | « Ouvre le carton derrière le comptoir : la vaisselle se range sur l'arrière-comptoir. » |

- **Tables et chaises**: celles de Simone sont déjà à leur place; une fois achetées, E sur la table « Descendre les chaises » (0,6 s, les deux chaises reprennent leur place autour). Elles se déplacent ensuite en B comme tout meuble. Les meubles neufs se posent en B (règles de passage existantes).
- **Raccorder la machine**: maintenir E 2 s sur la machine posée (« Raccorder l'eau et la prise »); la vieille dame est déjà à sa place, elle demande seulement ce geste. Puis **la chauffe**: 20 s réelles, aiguille du manomètre qui monte, gargouillis; à la fin, la soupape siffle. Pendant la chauffe, E sur la machine dit « Elle chauffe : encore 12 s. » Le moulin, la caisse, le réfrigérateur, la bouilloire se branchent seuls à la pose (rien à faire de plus: un geste par appareil serait une corvée).
- **Le café d'essai**: quand la machine siffle, Simone s'accoude au comptoir: « Elle siffle : elle est chaude. Tu me fais un noisette ? J'ai apporté un paquet de café et une bouteille de lait. » Le cadeau de Simone entre en réserve (1 kg de grains, 1 L de lait, `simoneGift`). Le noisette se prépare avec le guide de recette existant (`guideOf(..., always)`), jugé comme un vrai geste, sans encaissement. Simone: « Elle tire bien. Elle a encore de belles années. » (vieille dame) ou « Joseph a fait du beau travail. » (révisée). Il faut un moulin et de la vaisselle; sinon Simone: « Il te faut un moulin et une tasse, d'abord. »

### 5.6 Le ménage (facultatif, mais il se voit)

- **Balayer**: prendre le balai (E), puis maintenir E 2 s sur chaque tache (sept taches). La poussière s'envole en petit nuage, la tache disparaît.
- **Laver les vitrines**: prendre l'éponge dans le seau (E), puis maintenir E 3 s sur chaque vitre de l'intérieur (vitrine ouest, vitrine centre, petite fenêtre, porte vitrée). Le blanc s'efface en arc, la place apparaît derrière; l'inscription « À LOUER » part avec la vitrine ouest.
- Un seul balai et une seule éponge: l'un fait l'un, l'autre l'autre. Rien ne l'impose, mais c'est le partage naturel.
- **Conséquences**, sans pénalité cachée: tant qu'il reste des taches, la propreté du jour compte 4 au lieu de 8 dans l'ambiance (règle existante, réglage `cleanliness`); tant qu'une vitrine est blanchie, les passants intéressés sont multipliés par 0,8 (on ne voit pas qu'il y a un café). Le guide le dit (section 6), la pancarte le rappelle (section 7). Tout se fait aussi le mardi matin avant d'ouvrir.

### 5.7 L'ardoise, la commande, le nom

- **L'ardoise** (existante): seules les recettes dont l'équipement est posé s'écrivent; les autres restent grisées avec « Il faut : une bouilloire » (ou le réfrigérateur, la cloche, la machine). La proposition de la tablette (AT-02) ne retient que les recettes possibles.
- **La commande pour mardi** (existante, `realisme-v0-2.md`): « Habituelle » sans historique = 14 portions par recette de l'ardoise; tous les fournisseurs passent le mardi. Simone: « Lucas, Armelle, Joseph, Mireille : ils passent tous demain à 7 h. Commandez ce que vous avez mis à l'ardoise. » Si un réfrigérateur manque, les lignes de lait, de beurre et d'œufs sont refusées: « Sans réfrigérateur, le frais ne se garde pas. »
- **Le nom de la maison** (existant, « Notre maison »): proposé par Simone quand l'ardoise est écrite, ou au plus tard au bilan: « Avant demain, il lui faut un nom, à cette maison. À vous deux de choisir. »
- **« À demain »**: le bilan du lundi (existant) gagne une ligne « Installation » (somme des achats du jour) et, page « Demain », ce qui manque encore pour ouvrir (section 7). « À demain » n'est **jamais** refusé: on peut finir la séance au milieu de l'installation.

### 5.8 Le mardi: le grand jour

- La nuit, Gaby et Simone baissent les rideaux. Le mardi, **pour la première ouverture seulement**, les deux joueurs apparaissent sur la place (comme le lundi): l'écran du matin dit « Le grand jour : levez le rideau, puis retournez la pancarte. » La livraison de 7 h attend dans la cour (cartons existants).
- Lever le rideau à deux (même geste qu'au 5.1), entrer, ranger la livraison si l'on veut, finir ce qui reste (ménage, ardoise), puis **retourner la pancarte** (existant: E maintenu, ou « On ouvre ? » à l'autre). Simone attend sur son banc et entre la première (« Comme d'habitude ? »).
- Les matins suivants, les rideaux sont levés avant l'écran du matin (aucun geste), les joueurs apparaissent derrière le comptoir comme aujourd'hui. Raison: un rituel touchant une fois, une corvée tous les jours.
- Si quelque chose bloque l'ouverture (section 7), le mardi reste une préparation (horloge arrêtée): on finit l'installation sans perdre le jour. On peut aussi choisir « Rester fermé aujourd'hui » (écran du matin, à deux): le mardi devient un jour fermé (loyer prélevé, aucune recette), les événements du calendrier ne bougent pas.

## 6. Le guide de Simone pour l'installation

Même principe que `src/branchement/guide.ts`: une fonction pure qui déduit tout du monde partagé, sans état propre (les deux machines voient la même étape; une sauvegarde reprend où l'on en était). Carte « À faire » à gauche, poste ou objet suggéré encadré en vert (`surlignage.ts`). Le guide d'installation est actif le jour 1 et pendant la préparation du premier jour ouvert, jusqu'à la pancarte; ensuite le guide du premier service prend le relais (inchangé).

**Chapitres et étapes** (une coche par étape; « facultatif » écrit en petit; chaque chapitre se replie quand il est fini):

| Chapitre | Étape (libellé de la carte) | Cochée quand (état du monde) | Facultatif |
|---|---|---|---|
| **Ouvrir le local** | Lever le rideau à deux | `installation.shutter === 'up'` | non |
| | Ramasser le courrier | `installation.mail` | oui |
| | Retirer les draps | plus aucun drap sur le comptoir (`sheets` sans `drap-comptoir`) | non |
| **Équiper le comptoir** | Choisir une machine | une machine achetée (vieille dame, ou révisée achetée ou en livraison) | non |
| | Acheter un moulin, une caisse, de la vaisselle (« 2 sur 3 ») | un achat de chaque besoin, posé ou en livraison | non |
| | Rentrer les cartons | aucun carton d'installation dans la zone du trottoir | non |
| | Poser chaque appareil à sa place (B) | machine, moulin, caisse et vaisselle à leur emplacement | non |
| | Raccorder la machine et la laisser chauffer | `machine.connected` et `machine.heatLeftSec === 0` | non |
| | Un noisette pour Simone | `machine.tested` | oui |
| **La salle** | Des places pour s'asseoir (« 2 sur 4 conseillées ») | au moins 4 places assises dedans | oui |
| | Garder le frais : un réfrigérateur | `frigo` posé | oui |
| | Balayer la salle (« 3 taches sur 7 ») | `dust` vide | oui |
| | Laver les vitrines (« 1 sur 4 ») | `panes` vide | oui |
| **Avant d'ouvrir** | Écrire l'ardoise | au moins une ligne servable | non |
| | Passer la commande pour mardi | commande envoyée pour le prochain jour ouvert | non |
| | Choisir un nom | `houseName !== null` | non |
| | « À demain » | (jour 1) le vote `next-day` des deux | non |
| **Le grand jour** (mardi) | Lever le rideau à deux | rideau levé le jour 2 | non |
| | Retourner la pancarte | `phase === 'service'` | non |

**Ce que dit Simone** (l'étape en cours = la première étape non cochée et non facultative du premier chapitre inachevé; un joueur qui a les mains prises par un carton voit d'abord « Pose-le », comme le guide du service):

| Étape en cours | Réplique (`say`) | Ce qui s'encadre |
|---|---|---|
| Lever le rideau | « Le rideau de la porte est dur : prenez la poignée à deux et maintenez E ensemble. » | la poignée |
| Retirer les draps | « Tirez les draps : vise le comptoir ou une table et appuie sur E. » | le drap le plus proche |
| Choisir une machine | « La vieille dame est sous le drap, à 450 €. Joseph en a une révisée à 800 € : regarde dans ton téléphone (Tab), Catalogue, Pour ouvrir. » | la vieille dame |
| Acheter le reste | « Il manque encore {missing} : tout est dans Pour ouvrir. » | rien |
| Rentrer les cartons | « Gaby a tout posé devant la vitrine. Les gros cartons se portent à deux. » | le carton le plus proche |
| Poser les appareils | « Ouvre le carton, puis pose {item} à sa place : la trace dans la poussière te la montre. » | l'emplacement libre |
| Raccorder | « Maintiens E sur la machine pour la raccorder : l'eau et la prise sont dessous. » | la machine |
| Chauffe en cours | « Elle chauffe. Pendant ce temps, installez la salle. » | la table de Simone la plus proche, ou rien |
| Écrire l'ardoise | « Écris seulement ce que tu sais faire avec ce que tu as. » | l'ardoise |
| Commande | « Les fournisseurs passent tous demain à 7 h : Commandes, dans ton téléphone. » | rien |
| Nom | « Avant demain, il lui faut un nom, à cette maison. » | rien |
| Tout est fait | « C'est prêt. Demain, on lève le rideau et on retourne la pancarte à 8 heures. » | rien |

Rappels des étapes facultatives, une seule fois chacune, quand toutes les étapes obligatoires du chapitre sont cochées: « Quatre places, c'est un minimum : les gens aiment s'asseoir. », « Un coup de balai, et ça sentira le café plutôt que la poussière. », « Lave les vitrines : sinon, de la place, on ne voit pas que le café est ouvert. »

## 7. Ce qui empêche d'ouvrir, et comment le jeu le dit

### 7.1 À la pancarte

Fonction pure `openingCheck(content, world)`, lue par l'écran du matin, par la pancarte et par l'hôte (qui refuse le vote `open` tant qu'il reste un blocage).

| Type | Condition | Texte affiché (pancarte et page « Demain » du bilan) | Recours proposé |
|---|---|---|---|
| Blocage | pas de caisse posée | « Pas encore : il faut une caisse pour encaisser. » | « Voir dans Pour ouvrir » |
| Blocage | aucune pièce de vaisselle | « Pas encore : il faut de la vaisselle pour servir. » | idem |
| Blocage | aucune ligne de l'ardoise servable (postes posés et raccordés, ingrédients en réserve) | « Pas encore : aucune ligne de l'ardoise ne peut se servir. » + la première raison (« Il faut : la machine, raccordée. », « Plus de lait en réserve. ») | « Dépanner chez Mireille » si c'est un ingrédient (le mardi matin avant l'ouverture, livré aussitôt, +30 %) |
| Avertissement | aucune place assise | « Aucune place assise : seuls les pressés et les voisins resteront, debout au zinc. On ouvre quand même ? » | « On ouvre » / « Pas encore » |
| Avertissement | vitrine blanchie | « Les vitrines sont encore blanches : de la place, on ne voit pas que le café est ouvert. » | idem |
| Avertissement | taches de poussière | « Il reste de la poussière : la salle paraîtra négligée. » | idem |
| Avertissement | machine présente mais pas raccordée, ardoise servable sans elle | « La machine n'est pas raccordée : pas de café aujourd'hui. » | idem |

Un blocage s'affiche en entier avec ce qui manque, jamais « Impossible » seul; la carte du guide s'ouvre sur l'étape concernée. Un avertissement ne bloque jamais: l'un propose « On ouvre quand même ? », l'autre accepte (comme « On ouvre ? »).

Un café sans machine mais avec une bouilloire et une cloche peut ouvrir (thés et viennoiseries): Simone sourit: « Un café sans café ? C'est osé. »

### 7.2 Au moment d'acheter

- **Le minimum garde sa place**: avant un achat qui n'est pas « Pour ouvrir », si la caisse disponible après lui ne couvre plus ce qui manque pour ouvrir (au prix le plus bas de chaque besoin non couvert, plus la commande habituelle estimée), le bouton devient « Acheter quand même » avec, au-dessus: « Après cet achat, il manquerait {amount} pour ouvrir ({missing}). » Rien n'est refusé: on prévient.
- **La première livraison**: si la commande pour mardi dépasse la caisse disponible, l'avertissement existant de Commandes s'affiche (« La commande dépasse ce que la caisse pourra payer »), avec la suite: « Le reste passera en « à régler », repris sur vos recettes. »
- **Jamais bloqué par l'argent**: si la caisse disponible ne permet plus d'acheter le moins cher d'un besoin obligatoire (machine, moulin, caisse, vaisselle) encore non couvert, ces achats-là se proposent « à régler plus tard » (EC-06): Simone avance pour sa machine et sa vaisselle, Gaby fait crédit pour le moulin et la caisse. La somme passe dans « à régler », reprise sur les recettes du soir, sans intérêt. Texte: « Pas assez en caisse : {name} vous fait crédit. {amount} à régler, repris sur vos recettes. »
- Rendre un carton non ouvert reste toujours possible (section 5.4).

## 8. Règles et cas limites

| # | Cas | Règle |
|---|---|---|
| IN-01 | Les deux achètent la même pièce unique (la vieille dame, un lot de Simone) au même instant | le premier reçu par l'hôte l'obtient; l'autre lit « Sacha vient de l'acheter. » (SI-06), rien n'est débité |
| IN-02 | Deux machines | une seule machine à la fois: acheter la révisée quand la vieille dame est achetée est refusé (« Tu as déjà la vieille dame. Rends-la d'abord à Simone ? »); si la vieille dame n'est pas achetée, Gaby la monte chez Simone quand le carton de la révisée s'ouvre, et sa place sur le comptoir se libère |
| IN-03 | Un seul joueur tient le rideau | il se soulève de 20 cm et retombe: « Trop lourd : il faut être deux. » Les maintiens se recouvrent: chaque joueur maintient E au moins 2 s pendant que l'autre maintient aussi |
| IN-04 | Un joueur lâche un gros carton | SI-08: il se pose là où il est, glisse s'il barre un passage, rien ne s'abîme |
| IN-05 | Un carton laissé dehors le soir | Gaby le rentre dans la salle, contre le mur ouest, pendant la nuit; jamais perdu |
| IN-06 | Tables de Simone non achetées le soir du jour 1 | elles restent sous leur drap jusqu'à l'achat ou jusqu'à « Laisser à Simone » (E maintenu sur la table découverte): Gaby les monte chez elle la nuit; elles se rachètent ensuite dans le Catalogue (« Chez Simone »), livrées le matin suivant à leur ancienne place si elle est libre, sinon devant la vitrine |
| IN-07 | Pause (Échap) | PA-01: tout se fige, le compte à rebours de Gaby et la chauffe aussi |
| IN-08 | Absence d'un joueur (aucune entrée depuis 180 s) | PA-04 hors service: l'indicateur « absent » s'affiche; le compte à rebours de Gaby et la chauffe s'arrêtent (rien ne se passe sans l'autre) |
| IN-09 | Déconnexion | PA-05: pause des deux côtés; à la reconnexion, tout reprend à la seconde, cartons portés à deux reposés |
| IN-10 | Fin de séance au milieu de l'installation | tout s'enregistre (draps, poussière, vitrines, cartons, livraisons en route, chauffe); on reprend exactement là. Libellé de sauvegarde: « Jour 1 · L'installation » |
| IN-11 | Achat pendant une proposition en attente | règle existante: une proposition à la fois par joueur |
| IN-12 | Deux joueurs prennent le balai ou l'éponge | un seul balai, une seule éponge: le premier les prend, l'autre lit « Déjà pris par Sacha » |
| IN-13 | Balayer une tache sous un carton ou un meuble | la tache se balaie quand même (rayon de 0,6 m) |
| IN-14 | Vieille dame achetée puis panne du jour 6 | l'événement « La vieille dame tousse » a lieu (inchangé). Machine révisée: il n'a pas lieu; le marché aux fleurs du jour 6 reste |
| IN-15 | Sauvegarde d'une partie v0.2 (café équipé) | elle se reprend telle quelle: l'installation ne concerne que les nouvelles maisons (`installation` absent = déjà ouvert) |

## 9. Retour de chaque action

| Action | Retour visuel | Retour sonore |
|---|---|---|
| Lever le rideau (à deux) | anneaux de maintien des deux joueurs à la poignée, rideau qui monte, mot de Simone décollé | grincement et cliquetis des lames, coup sourd en butée, moteurs des vitrines |
| Lever seul | rideau soulevé de 20 cm, retombe | lames qui retombent |
| Ramasser le courrier | la pile disparaît, cinq bannières dans le téléphone | froissement de papier, notification douce |
| Retirer un drap | le drap glisse et tombe en tas, poussière qui s'envole | tissu, souffle |
| Acheter (téléphone ou monde) | coche « Pour ouvrir », caisse mise à jour, étiquette « À vous » sur l'objet de Simone | son d'achat existant |
| Livraison de Gaby | bannière « Gaby a tout posé devant la vitrine », cartons qui apparaissent sur le trottoir | moteur de camionnette qui s'arrête, portière, cartons posés |
| Rendre un carton | le carton disparaît, caisse recréditée | son d'achat inversé (existant pour les remboursements, sinon le même plus grave) |
| Ouvrir un carton | le carton se déplie, l'objet apparaît | carton déchiré |
| Poser un appareil | aperçu aimanté vert à l'emplacement, rouge ailleurs avec la raison | clac de pose existant |
| Descendre les chaises | les deux chaises pivotent et se posent | bois sur parquet |
| Raccorder | anneau de maintien, flexible et prise qui se vissent | clé, clic de prise |
| Chauffe | aiguille du manomètre, voyant orange puis vert | gargouillis, puis sifflement de la soupape |
| Balayer | nuage de poussière, tache qui s'efface | balai sur parquet |
| Laver une vitre | blanc effacé en arcs, lumière qui change | éponge sur verre |
| Café d'essai | gestes et qualité existants, chez celui qui le fait seulement | sons des postes existants |
| Avertissement à la pancarte | encadré ambre avec la phrase et les deux boutons | aucun son (rien de négatif ne sonne, son.md) |
| Blocage à la pancarte | encadré crème, ce qui manque, bouton « Voir » | aucun |

## 10. L'économie des premières semaines (simulation)

Commande (depuis la racine du dépôt, 2,5 s):

```text
python3 -I -B docs/jeux/cosy-cafe/demo/simulations/depart_v0_3.py
python3 -I -B docs/jeux/cosy-cafe/demo/simulations/depart_v0_3.py epargne=1500
```

Le script rejoue la démo v0.2 (service client par client, stock payé à la livraison, lots datés, dépannages, ordre d'achat « équilibre ») et remplace seulement le départ: caisse = 1 800 € - panier, aucune réserve offerte (le sac de grains de Simone seulement), postes, vaisselle, places et décor selon le panier. Le robot rachète d'abord des places tant que la salle en a moins de huit (tables de Simone à 45 €, puis neuves). 4 parties par duo et par départ, graines 1000 à 1003.

**Synthèse** (médianes de 4 parties):

| Duo | Départ | Première livraison (mardi 7 h) | Caisse le mardi après la livraison | Plus bas de la caisse (soirs) | Gagné en 12 jours | Ambiance au jour 14 | Terrasse pour la fête | Trois tasses avant la fête | Caisse au jour 15 |
|---|---|---|---|---|---|---|---|---|---|
| Duo tranquille | v0.2 (café équipé) | 54 € | 228 € | 61 € | 1 739 € | 77 | 4 sur 4 | 4 sur 4 | 200 € |
| Duo tranquille | Débrouille | 124 € | 628 € | 90 € | 1 672 € | 77 | 4 sur 4 | 4 sur 4 | 160 € |
| Duo tranquille | Le café de Simone | 124 € | 366 € | 154 € | 1 715 € | 78 | 4 sur 4 | 4 sur 4 | 365 € |
| Duo tranquille | La belle machine | 124 € | 278 € | 90 € | 1 540 € | 73 | 3 sur 4 | 1 sur 4 | 134 € |
| Duo tranquille | Coup de cœur | 124 € | -32 € | 55 € | 1 612 € | 71 | 4 sur 4 | 1 sur 4 | 84 € |
| Duo médian | v0.2 (café équipé) | 54 € | 228 € | 128 € | 2 081 € | 77 | 4 sur 4 | 4 sur 4 | 145 € |
| Duo médian | Débrouille | 124 € | 628 € | 138 € | 1 899 € | 77 | 4 sur 4 | 4 sur 4 | 246 € |
| Duo médian | Le café de Simone | 124 € | 366 € | 168 € | 2 010 € | 78 | 4 sur 4 | 4 sur 4 | 283 € |
| Duo médian | La belle machine | 124 € | 278 € | 81 € | 1 796 € | 74 | 4 sur 4 | 4 sur 4 | 180 € |
| Duo médian | Coup de cœur | 124 € | -32 € | 76 € | 1 849 € | 78 | 4 sur 4 | 4 sur 4 | 276 € |
| Duo rapide | v0.2 (café équipé) | 54 € | 228 € | 143 € | 2 249 € | 77 | 4 sur 4 | 4 sur 4 | 313 € |
| Duo rapide | Débrouille | 124 € | 628 € | 168 € | 2 211 € | 77 | 4 sur 4 | 4 sur 4 | 565 € |
| Duo rapide | Le café de Simone | 124 € | 366 € | 140 € | 2 218 € | 78 | 4 sur 4 | 4 sur 4 | 447 € |
| Duo rapide | La belle machine | 124 € | 278 € | 112 € | 2 022 € | 75 | 4 sur 4 | 4 sur 4 | 176 € |
| Duo rapide | Coup de cœur | 124 € | -32 € | 76 € | 1 936 € | 78 | 4 sur 4 | 4 sur 4 | 344 € |

**La caisse du duo médian, soir après soir** (médianes):

| Jour | v0.2 | Débrouille | Le café de Simone | La belle machine | Coup de cœur |
|---|---|---|---|---|---|
| 1 (lundi) | 281 € | 751 € | 489 € | 401 € | 91 € |
| 2 | 84 € | 97 € | 88 € | 76 € | 71 € |
| 3 | 89 € | 126 € | 137 € | 91 € | 112 € |
| 4 | 127 € | 133 € | 101 € | 107 € | 120 € |
| 5 | 123 € | 117 € | 158 € | 102 € | 79 € |
| 6 | 189 € | 151 € | 189 € | 80 € | 79 € |
| 7 | 182 € | 202 € | 242 € | 184 € | 115 € |
| 8 (lundi) | 163 € | 184 € | 224 € | 165 € | 96 € |
| 9 | 172 € | 234 € | 211 € | 196 € | 158 € |
| 10 | 292 € | 408 € | 325 € | 268 € | 330 € |
| 11 | 402 € | 156 € | 201 € | 249 € | 451 € |
| 12 | 265 € | 274 € | 296 € | 263 € | 182 € |
| 13 | 246 € | 220 € | 186 € | 236 € | 181 € |
| 14 | 164 € | 265 € | 301 € | 199 € | 294 € |
| 15 (lundi) | 145 € | 246 € | 283 € | 180 € | 276 € |

**Sensibilité à l'épargne** (duos médian et tranquille):

| Épargne | Ce qui change |
|---|---|
| 1 500 € | « Coup de cœur » dépasse l'épargne (190 € à régler dès le lundi, caisse sous zéro au moins un soir dans les 4 parties, plus bas -224 €); le duo tranquille n'a ses trois tasses avant la fête qu'avec « Le café de Simone » (4 sur 4), 2 sur 4 en « Débrouille », 0 sur 4 avec la belle machine ou le coup de cœur. Trop dur pour un premier jeu |
| **1 800 €** | quatre paniers possibles et différents; aucun à régler le soir, un seul à régler le mardi matin (coup de cœur, 32 €); toutes les fêtes ont leur terrasse sauf une partie sur 48; le duo tranquille paie son ambition (une partie sur quatre à trois tasses avec la belle machine ou le coup de cœur) |
| 2 100 € | tous les paniers mènent aux trois tasses; caisses de fin plus grosses (jusqu'à 481 € pour le duo médian): le choix ne coûte plus rien |

**Lecture:**
- **La courbe reste celle de la v0.2**: la caisse de la première semaine vit entre 70 et 240 € le soir, comme avant (84 à 189 €); la terrasse pour la fête et les trois tasses restent atteintes par les duos médian et rapide quel que soit le panier. Le nouveau départ change la première semaine sans abîmer la fin de la démo.
- **Ce qu'on a gagné**: un vrai choix, chiffré, aux conséquences visibles dès le mardi (628 € en caisse ou 32 € à régler; quatre places usées ou six neuves; une machine qui tousse ou une qui tire juste). Au jour 15, la caisse du duo médian va de 180 à 283 € selon le panier, et ses gains de 12 jours de 1 796 à 2 010 € (214 € d'écart): assez pour se sentir, jamais assez pour punir.
- **Ce qui coûte**: le stock n'est plus offert (124 € au lieu de 54 € la première livraison) et l'équipement se paie; le duo médian gagne 70 à 285 € de moins qu'en v0.2 sur 12 jours selon le panier. C'est le prix de la demande du client, absorbé sans changer aucun autre réglage.
- **Le duo tranquille** est le seul que l'ambition fait trébucher: avec la belle machine ou le coup de cœur, une partie sur quatre seulement a ses trois tasses avant la fête (la fête a lieu quand même, date fixe; ce sont les objectifs « Formidable » qui reculent). Le guide le prévient doucement (« Gardez de quoi payer le lait de mardi », « Quatre places, c'est un minimum »).
- **La machine révisée** ne se rembourse pas en deux semaines: c'est un confort de jeu (fenêtre « Parfait » plus large, deux laits à la fois, pas de panne), utile au joueur moins à l'aise à la machine. Elle doit être présentée comme telle, pas comme un investissement.

Ce que la simulation ne couvre pas: le temps réel de l'installation (estimé, section 5.3), l'effet des vitrines blanchies et de la poussière (le robot fait tout le ménage), le crédit de Simone et de Gaby (aucun duo simulé n'en a eu besoin), la rénovation partielle des chaises (le robot rénove toutes les chaises usées d'un coup), le bruit de 4 parties (écarts de moins de 5 % à lire avec prudence).

## 11. Tables d'équilibrage

| Clé | Paramètre | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|---|
| `startCash` | Épargne de départ | 1 800 | € | 1 500 à 2 100 | simulation: quatre paniers différents possibles, aucun piège, la marge force à choisir (section 10) |
| `machine-vieille-dame.price` | La vieille dame de Simone | 450 | € | 300 à 600 | le choix « débrouille »: assez cher pour qu'on hésite avec des chaises neuves, assez bas pour laisser la révisée tentante |
| `machine-revisee.price` | Machine révisée par Joseph | 800 | € | 650 à 1 000 | à 950, le duo médian perdait 300 € sur 12 jours: un confort trop cher; à 800, environ 210 € (premier passage de la simulation, puis réglage) |
| `machine-revisee.perfectBonusSec` | Fenêtre « Parfait » en plus | 1 | s | 0,5 à 1,5 | 2 s deviennent 3: on le sent sans que la vieille dame paraisse injuste |
| `moulin-simple.price` | Moulin à café | 140 | € | 100 à 180 | sous le moulin à dose (380 €) qui reste la montée de niveau |
| `terminal-caisse.price` | Tiroir-caisse et terminal | 80 | € | 50 à 120 | obligatoire: modeste |
| `vaisselle-simone` | Vaisselle de Simone | 24 pièces, 30 € | pièces, € | 18 à 30 pièces | assez pour le calme du mardi; on la complète au premier week-end |
| `service-blanc` | Service blanc | 36 pièces, 110 € | pièces, € | 30 à 48 pièces | la vaisselle de la v0.2 (36), payée |
| `frigo-occasion.price` | Réfrigérateur sous plan | 180 | € | 140 à 250 | le lait est au cœur de la carte: presque obligatoire, donc pas cher |
| `bouilloire-simple.price`, `cloche-viennoiseries.price` | Bouilloire, cloche | 25, 35 | € | 20 à 50 | petits achats qui ouvrent une famille de l'ardoise |
| `simoneLots[].price` | Une table de Simone et ses deux chaises | 45 | € | 30 à 60 | quatre places usées pour le prix d'une chaise neuve: la voie débrouille; prix des pièces (25 et 10 €) proches de `meubles.json` (30 et 12 €) |
| `install.seatsAdvised` | Places conseillées | 4 | places | 2 à 6 | sous 4, les familles et les flâneurs repartent dès le jeudi |
| `install.deliveryFirstSec` | Première tournée de Gaby | 45 | s réelles | 30 à 90 | le temps de balayer ou de retirer les draps, pas d'attente subie |
| `install.deliveryNextSec` | Tournées suivantes | 30 | s réelles | 20 à 60 | les oublis arrivent vite |
| `install.deliveryJoinSec` | Un achat rejoint la tournée en cours s'il reste plus de | 15 | s réelles | 5 à 30 | pas de carton qui arrive seul trois secondes après les autres |
| `install.heatSec` | Chauffe de la machine | 20 | s réelles | 10 à 40 | un vrai temps masqué, rempli par la salle (25 minutes en vrai) |
| `install.connectHoldSec` | Raccorder | 2 | s de maintien | 1 à 3 | un geste qui compte, pas une corvée |
| `install.shutterHoldSec` | Lever le rideau à deux | 2 | s de maintien commun | 1 à 3 | le rituel, assez court pour le mardi |
| `install.sweepHoldSec` | Balayer une tache | 2 | s | 1 à 3 | sept taches: environ 40 s pour un joueur |
| `install.wipeHoldSec` | Laver une vitre | 3 | s | 2 à 5 | quatre vitres: environ 30 s pour l'autre |
| `install.dustCleanliness` | Propreté avec de la poussière | 4 | points d'ambiance (sur 10) | 2 à 6 | se voit au bilan (ambiance), ne punit pas |
| `install.whitewashPassers` | Passants intéressés, vitrine blanchie | x 0,8 | facteur | 0,6 à 0,9 | la raison réelle de laver les vitrines |
| `simoneGift` | Cadeau de Simone | 1 000 g de grains, 1 000 ml de lait | unités | fixe | de quoi faire le café d'essai et le premier matin; rien d'autre: le stock est à vous |
| `startStock` | Réserve offerte | aucune | | | la demande du client: « stock pour commencer » à acheter |

## 12. Données de jeu à créer ou modifier

Rien n'est modifié dans les fichiers du jeu par cette conception: liste pour dev-gameplay-3d. Conventions existantes: identifiants de contenu en `kebab-case` dans `meubles.json` et `service/`, en `snake_case` dans `clientele/`; `donnees/SCHEMA.md` se met à jour avec chaque clé.

**Départ.** Recommandation: garder le départ équipé pour les tests et les robots (`tests/journee.test.ts`, `recette-quinze-jours.test.ts` le supposent sans doute) et ajouter le nouveau.
- `donnees/departs/village-cellule.json` (nouveau): le contenu de `village.json` moins `station-2` (réfrigérateur), `station-5` (moulin), `station-6` (caisse), `pile-tasses-1` et les objets de départ (tasses, plateau, tasse sale); plus les objets d'installation:
  - garder: `backbar-1`, `station-1` (évier), `counter-1`, `station-3` (passe), `station-4` (la vieille dame, `owner: "simone"`), `furniture-1`, `furniture-2`, `station-7` (réserve), `furniture-3`, `table-1` à `table-4` et `seat-1` à `seat-8` (`owner: "simone"`, chaises en pose « retournées », `worn: true`), `seat-9`, `seat-10`, `furniture-4`;
  - ajouter: `drap-comptoir` (sur `counter-1`), `drap-table` x 4 (sur `table-1` à `table-4`), `courrier` (9,4 ; 12,2), `balai` (5,9 ; 9,3), `seau-eponge` (8,6 ; 12,2), `poussiere` x 7 en (5,0 ; 11,4), (6,6 ; 10,4), (8,2 ; 11,6), (9,6 ; 10,8), (9,4 ; 12,0), (8,6 ; 8,2), (6,4 ; 8,6);
  - `spawns`: (9,0 ; 14,6) et (9,9 ; 14,6), regard au nord.
- `donnees/clientele/economie.json`: nouvelle clé `start`: `"cellule"` (`"equipe"` pour l'ancien départ); `startCash`: 1800; `startStock`: `[]`; nouvelle `simoneGift`: `[["grains_maison", 1000], ["lait_entier", 1000]]` (unités, lot daté du jour 1); `stationsAtStart`: `{}`; `dishesAtStart`: 0; `startDecor`: `[{"id": "applique_laiton", "count": 1, "worn": true}]` (les tables de Simone comptent quand elles sont achetées); nouveau bloc `install` (valeurs de la section 11: `deliveryFirstSec`, `deliveryNextSec`, `deliveryJoinSec`, `heatSec`, `connectHoldSec`, `shutterHoldSec`, `sweepHoldSec`, `wipeHoldSec`, `dustCleanliness`, `whitewashPassers`, `seatsAdvised`, `deliveryArea`: `[4.2, 13.7, 4.2, 1.2]`, `nightCartonSpot`: `[4.3, 10.8]`); nouveau `opening`: `{"required": [{"need": "machine", "any": ["machine-vieille-dame", "machine-revisee"], "blocks": false}, {"need": "moulin", "any": ["moulin-simple", "moulin-dose"], "blocks": false}, {"need": "caisse", "any": ["terminal-caisse"], "blocks": true}, {"need": "vaisselle", "any": ["vaisselle-simone", "service-blanc", "service-vaisselle"], "blocks": true}], "creditFrom": {"machine-vieille-dame": "Simone", "vaisselle-simone": "Simone", "moulin-simple": "Gaby", "terminal-caisse": "Gaby"}}` (la machine et le moulin ne bloquent pas seuls: c'est « aucune ligne servable » qui bloque); nouveau `simoneLots`: `[{"id": "lot-simone-a", "table": "table-1", "seats": ["seat-1", "seat-2"], "price": 45}, ...b: table-2, seat-3, seat-4; ...c: table-3, seat-5, seat-6; ...d: table-4, seat-7, seat-8]`.
- `donnees/service/equipements.json`, `purchases`: ajouter `machine-vieille-dame`, `machine-revisee`, `moulin-simple`, `terminal-caisse`, `vaisselle-simone`, `service-blanc`, `frigo-occasion`, `bouilloire-simple`, `cloche-viennoiseries` (prix et effets de la section 4.2), chacun avec `tier: "t0"` et trois clés nouvelles: `group: "ouverture"`, `need` (« machine », « moulin », « caisse », « vaisselle », « frais », « thes », « viennoiseries »), `seller` (« simone », « gaby »); `exclusive: "machine"` pour les deux machines; `delivery`: `"en-place"` (vieille dame), `"simone"` (vaisselle de Simone, posée tout de suite devant le comptoir) ou `"gaby"`. Effets: `station-level` existant; `dishes` existant; nouvel effet `machine-perfect-bonus` (1 s) pour la révisée.
- `donnees/clientele/economie.json`, `purchases`: les mêmes, au format de la clientèle (`poste:espresso:1`, `poste:vapeur:2`, `vaisselle:24`...), pour la caisse et le bilan (le test de branchement compare les deux fichiers).
- `donnees/service/reglages.json`: `purchaseSpots` pour `machine-espresso` et `machine-espresso-revisee` (`station-4`), `moulin` (`station-5`), `caisse` (`station-6`), `frigo-sous-plan` (`station-2`), `pile-tasses` (`pile-tasses-1`), `bouilloire` (`bouilloire-1`), `vitrine` (`vitrine-1`); `installation` (groupes, buse, bouilloire, cloche, rail) conditionnée à la présence de l'appareil qui les porte (aujourd'hui posée d'office), plus une seconde buse (`buse-2`, ancrée à `station-4`, à gauche des groupes) pour la machine révisée.
- `donnees/meubles.json`: types nouveaux `machine-espresso-revisee` (même gabarit que `machine-espresso`), `drap-comptoir`, `drap-table`, `courrier`, `poussiere` (sans collision), `balai`, `seau-eponge`; `fixed: false` et `carry: "two"` pour `machine-espresso` et `frigo-sous-plan` quand ils sortent d'un carton (le carton lourd existant porte le poids, l'appareil déballé ne se pose qu'à son emplacement).
- `donnees/amenagement.json`: `delivery.installAreas`: `[[4.2, 13.7, 4.2, 1.2]]` avec sa raison (section 5.4); `outlets`: ajouter la prise de l'arrière-comptoir (8,4 ; 7,1).
- `donnees/clientele/journees.json`: jour 1 `title` « L'installation », `new` mis à jour; jour 2 `title` « Le grand jour ».
- `donnees/clientele/textes.json`: dialogues `prologue` remplacé (section 13), nouveaux `install_*`; textes du guide d'installation (aujourd'hui les phrases du guide du service sont dans `guide.ts`: les nouvelles gagneraient à vivre dans les données).
- État du monde (sauvegarde, nouveau format daté): `world.installation`: `{ stage: 'arrival' | 'setup' | 'ready' | 'opened', shutter: 'down' | 'up', mail: boolean, sheets: string[], dust: number[], panes: string[], lots: Record<string, 'simone' | 'ours' | 'returned'>, machine: { connected: boolean, heatLeftSec: number, tested: boolean }, deliveries: { piece: Piece, dueSec: number }[], installSec: number }`; absent pour une partie v0.2 (= déjà ouverte, IN-15).

## 13. Textes du jeu

Tutoiement du joueur; Simone parle aux deux (« vous »); aucun accord au genre des joueurs. Espaces avant deux-points comme dans l'interface existante.

| Clé proposée | Texte |
|---|---|
| `prologue[0]` | « Ah, vous voilà. Le café dort depuis trois ans, depuis ma retraite. Les murs sont à moi, j'habite juste au-dessus. » |
| `prologue[1]` | « Vous voilà chez vous. Faites de ce café l'endroit où l'on aime s'arrêter : équipez-le, écrivez votre carte, servez vos clients, et la maison grandira. » |
| `prologue[2]` | « Tenez, les clés. Le rideau de la porte est dur : levez-le à deux. » |
| `install_note` | « Celui-là, je le garde. » |
| `install_counter` | « Le comptoir, l'évier, les toilettes : ce qui tient aux murs est resté. Le reste, je l'ai vendu en partant. » |
| `install_machine` | « Sous le drap, c'est la vieille dame. Ma machine. Je n'ai pas eu le cœur de la vendre. » |
| `install_tables` | « Mes tables et mes chaises sont restées là. Si elles vous plaisent, je vous les laisse pour pas cher. » |
| `install_mail` | « Trois ans de courrier. Il doit y avoir les cartes de tout le monde là-dedans. » |
| `install_trace` | « Tu vois la trace ? Trente ans au même endroit. Il n'y a que là qu'arrivent l'eau et le courant. » |
| `install_minimum` | « Pour ouvrir, il vous faut une machine, un moulin, une caisse et de la vaisselle. Le reste, ça se gagne. » |
| `install_budget` (au premier achat de plus de 300 €) | « Gardez de quoi payer le lait de mardi. » |
| `install_gaby` | « Je vous pose tout devant la vitrine. Les gros cartons, c'est à deux ! » |
| `install_hot` | « Elle siffle : elle est chaude. Tu me fais un noisette ? J'ai apporté un paquet de café et une bouteille de lait. » |
| `install_tested_old` / `_new` | « Elle tire bien. Elle a encore de belles années. » / « Joseph a fait du beau travail. » |
| `install_order` | « Lucas, Armelle, Joseph, Mireille : ils passent tous demain à 7 h. Commandez ce que vous avez mis à l'ardoise. » |
| `install_name` | « Avant demain, il lui faut un nom, à cette maison. À vous deux de choisir. » |
| `install_done` | « C'est prêt. Demain, on lève le rideau et on retourne la pancarte à 8 heures. Je serai la première. » |
| `install_no_coffee` | « Un café sans café ? C'est osé. » |
| `mail_lucas`, `mail_armelle`, `mail_joseph`, `mail_mireille`, `mail_mairie` | section 5.2 |
| `ui.install.shutterHold` | « Maintiens E avec l'autre : lever le rideau » |
| `ui.install.shutterAlone` | « Trop lourd : il faut être deux. » |
| `ui.install.sheet` | « E : retirer le drap » |
| `ui.install.buySimone` | « Maintiens E : acheter à Simone · {price} » |
| `ui.install.tag` | « {price} la table et ses chaises » |
| `ui.install.chairsDown` | « E : descendre les chaises » |
| `ui.install.leaveToSimone` | « Maintiens E : laisser à Simone » |
| `ui.install.connect` | « Maintiens E : raccorder l'eau et la prise » |
| `ui.install.heating` | « Elle chauffe : encore {s} s. » |
| `ui.install.sweep` | « Maintiens E : balayer » |
| `ui.install.wipe` | « Maintiens E : laver la vitre » |
| `ui.install.returnCarton` | « Maintiens E : rendre à Gaby (remboursé) » |
| `ui.install.spot.machine` | « La machine ne va que là où arrivent l'eau et la prise de 32 A. » |
| `ui.install.spot.grinder` | « Le moulin se pose à côté de la machine, sur sa prise. » |
| `ui.install.spot.register` | « La caisse va au bout du comptoir, là où arrive la file. » |
| `ui.install.spot.fridge` | « Le réfrigérateur se glisse sous l'arrière-comptoir, sur sa prise. » |
| `ui.install.spot.dishes` | « Ouvre le carton derrière le comptoir : la vaisselle se range sur l'arrière-comptoir. » |
| `ui.install.oneMachine` | « Tu as déjà la vieille dame. Rends-la d'abord à Simone ? » |
| `tablet.catalog.opening` | « Pour ouvrir » |
| `tablet.catalog.openingHelp` | « Le minimum pour servir : une machine, un moulin, une caisse, de la vaisselle. Le reste rend la carte plus large et la salle plus accueillante. » |
| `tablet.catalog.needs` | « Une machine », « Un moulin », « Une caisse », « De la vaisselle », « Garder le frais », « Les thés », « Les viennoiseries », « S'asseoir » |
| `tablet.catalog.afterThis` | « Après cet achat, il manquerait {amount} pour ouvrir ({missing}). » |
| `tablet.catalog.buyAnyway` | « Acheter quand même » |
| `tablet.catalog.credit` | « Pas assez en caisse : {name} vous fait crédit. {amount} à régler, repris sur vos recettes. » |
| `tablet.orders.noFridge` | « Sans réfrigérateur, le frais ne se garde pas. » |
| `slate.needs` | « Il faut : {what} » |
| `morning.bigDay` | « Le grand jour : levez le rideau, puis retournez la pancarte. » |
| `morning.stayClosed` | « Rester fermé aujourd'hui » |
| `open.block.register` | « Pas encore : il faut une caisse pour encaisser. » |
| `open.block.dishes` | « Pas encore : il faut de la vaisselle pour servir. » |
| `open.block.slate` | « Pas encore : aucune ligne de l'ardoise ne peut se servir. » |
| `open.warn.seats` | « Aucune place assise : seuls les pressés et les voisins resteront, debout au zinc. On ouvre quand même ? » |
| `open.warn.windows` | « Les vitrines sont encore blanches : de la place, on ne voit pas que le café est ouvert. » |
| `open.warn.dust` | « Il reste de la poussière : la salle paraîtra négligée. » |
| `open.warn.unplugged` | « La machine n'est pas raccordée : pas de café aujourd'hui. » |
| `evening.install` | « Installation » (ligne du bilan du lundi) |
| `evening.tomorrowMissing` | « Pour ouvrir demain, il manque encore : {missing}. Vous pourrez finir demain matin, avant de retourner la pancarte. » |
| `save.label.install` | « Jour 1 · L'installation » |
| `guide.install.*` | libellés et répliques de la section 6 |
| Ardoise de trottoir | « Bientôt » jusqu'à l'ouverture |

## 14. Tâches pour demain

Estimations pour un développeur qui connaît le code (dev-gameplay-3d); ordre conseillé. P0 = la démo v0.3 jouable ce soir-là; P1 = finitions.

**Développement**

| # | Tâche | Fichiers | Estimation | Priorité |
|---|---|---|---|---|
| D1 | Départ « cellule »: `start` dans `economie.json`, `departs/village-cellule.json`, `startCash`, `simoneGift`, stations et vaisselle vides; l'ancien départ gardé pour les tests | `donnees/`, chargement du départ, `SCHEMA.md` | 45 min | P0 |
| D2 | État `world.installation` (schéma valibot, format de sauvegarde daté, relecture des sauvegardes v0.2 sans installation) | `src/etat/monde.ts`, `src/donnees/schemas.ts` | 30 min | P0 |
| D3 | Achats « Pour ouvrir »: nouveaux achats, exclusivité de la machine, achats de Simone dans le monde (E maintenu sur l'objet), lots de Simone (propriété, chaises descendues, « laisser à Simone ») | `service/equipements.json`, `clientele/economie.json`, `src/amenagement/systeme.ts`, `intentions.ts` | 1 h 30 | P0 |
| D4 | Livraison du jour par Gaby: zone du trottoir, délais en secondes réelles (pause et absence comprises), regroupement, cartons rendus remboursés, cartons rentrés la nuit | `src/amenagement/systeme.ts` (`deliver`, `deliverySpot`), `amenagement.json` | 1 h | P0 |
| D5 | Appareils posés à leur emplacement seulement (aimantation et refus avec raison), installation des groupes, buse, bouilloire et cloche conditionnée à l'appareil, pile de vaisselle rangée à l'ouverture du carton | `service/reglages.json` (`purchaseSpots`), `src/amenagement/regles.ts`, `visee-pose.ts` | 1 h | P0 |
| D6 | Raccorder et chauffer la machine, café d'essai pour Simone (geste réel, sans encaissement), effet `machine-perfect-bonus` et pas de panne avec la révisée | `src/service/`, `src/clientele/scenes.ts` | 1 h | P0 |
| D7 | Rideau: geste à deux à la poignée (maintiens qui se recouvrent), états levé et baissé, apparition sur la place le jour 1 et la première ouverture | `src/clientele/scenes.ts` ou nouveau `src/installation/`, `journee.ts` | 1 h | P0 |
| D8 | Draps, courrier (cinq messages), balai et éponge (un exemplaire chacun), taches et vitres, effets sur la propreté et les passants | nouveau `src/installation/`, `clientele/attrait.ts` | 1 h 15 | P0 |
| D9 | Guide d'installation (fonction pure, chapitres, répliques, objet encadré) et carte « À faire » | `src/branchement/guide.ts` (ou `guide-installation.ts`), `src/interface/guide-carte.ts` | 1 h 15 | P0 |
| D10 | `openingCheck`: blocages et avertissements à la pancarte et à l'écran du matin, refus du vote `open` par l'hôte, « Rester fermé aujourd'hui », page « Demain » du bilan | `src/branchement/interface.ts`, `src/interface/ecrans.ts`, `bilan.ts` | 1 h | P0 |
| D11 | Téléphone: rubrique « Pour ouvrir » et ses puces, avertissement « il manquerait », crédit de Simone et de Gaby, frais refusé sans réfrigérateur, ardoise « Il faut : ... » | `src/interface/telephone-applis.ts`, `ardoise.ts` | 1 h | P0 |
| D12 | Textes (section 13) dans les données; libellé de sauvegarde | `clientele/textes.json`, `src/interface/textes.ts` | 30 min | P0 |
| D13 | Tests courts: départ cellule à graine fixe, achat simultané de la vieille dame, garde-fous, rideau à deux et seul, crédit, reprise d'une sauvegarde v0.2, une installation complète par les robots en quelques secondes | `tests/installation.test.ts` | 1 h | P0 |
| D14 | Robots: savoir faire l'installation (panier « Le café de Simone ») pour que `recette-quinze-jours` puisse partir du nouveau départ | `src/robots/` | 45 min | P1 |
| D15 | Lumière: la salle s'éclaircit à mesure que les vitrines se lavent (intensité de la carte de lumière x 0,85 par vitre blanchie, de 0,6 à 1) | `src/rendu/` | 30 min | P1 |
| D16 | Camionnette de Gaby visible sur la place pendant la livraison | `src/rendu/` | 30 min | P1 |

Total P0: environ 13 h 30 de développement, soit deux développeurs sur une journée (D1, D2, D3, D5, D6 d'un côté; D4, D7, D8, D9, D10, D11 de l'autre; D12 et D13 en commun), ou un seul sur deux jours. À trancher par le manager: si une seule journée et un seul développeur, P0 réduit (section 14.3).

**Assets** (artiste-3d, artiste-2d, tech-artist, sound-designer; budgets de `bible-artistique.md`)

| # | Asset | Détail | Priorité |
|---|---|---|---|
| A1 | Rideau métallique à lames, quatre baies (2,00, 2,00, 1,20 et 0,60 m de large; hauteurs 1,95, 1,95, 2,10 et 1,50 m), enroulé dans le linteau | lames galvanisées un peu ternies, poignée basse et serrure au sol pour la porte; animation de montée de 1,5 s (ou translation par code); mot de Simone en décalque sur celui de la porte | P0 |
| A2 | Vitres au blanc de Meudon | variante du matériau `dt_verre` de `shell_village_glass`: voile laiteux irrégulier, traces de pinceau, inscription « À LOUER · s'adresser au-dessus » sur la vitrine ouest; un masque par vitre pour l'effacement | P0 |
| A3 | Drap de comptoir et drap de table | drap de coton gris-beige à plis, épousant le comptoir et la vieille dame (3,2 x 0,9 m, 1,45 m de haut) et un guéridon avec deux chaises retournées; tas de drap au sol après retrait | P0 |
| A4 | Pose « chaises retournées sur la table » | deux chaises paillées à l'envers sur chaque guéridon et sur la table carrée: regarder de près, aucun pied ne traverse le plateau ni l'autre chaise | P0 |
| A5 | Courrier, balai (existant `event_balai.glb`), seau et éponge, étiquette de prix en carton de Simone | petits objets | P0 |
| A6 | Taches de poussière et feuilles mortes au sol, trace propre sur le comptoir et sous les tables | décalques | P0 (taches), P1 (traces) |
| A7 | Machine révisée | variante de `station_espresso_2g.glb`: inox brossé et noir, sans les patines de la vieille dame | P0 (variante de couleur), P1 (modèle distinct) |
| A8 | Ardoise de trottoir « Bientôt » | texte à la craie | P1 |
| A9 | Poussière en suspension dans la lumière des vitrines | particules légères (budget du PC) | P1 |
| A10 | Camionnette de Gaby | utilitaire de village, sans marque | P1 |
| S1 | Sons: rideau qui monte (grincement, cliquetis, butée), rideau qui retombe, porte qui colle, drap, carton déchiré, balai, éponge sur verre, raccord (clé, clic), chauffe (gargouillis) et soupape, camionnette (arrêt, portière), salle vide plus réverbérante | famille des sons du jeu (`son.md`), aucun son de réussite ou d'échec | P0 (rideau, chauffe, carton), P1 (le reste) |

Le support d'enseigne vide au-dessus de la porte (3.3) existe-t-il dans la coque ? À vérifier par l'artiste 3D; sinon il s'ajoute avec l'enseigne au nom de la maison (achat existant).

### 14.3 Si une seule journée de développement

P0 minimal, environ 7 h: D1, D2, D3 (sans achats dans le monde: tout par le téléphone), D4 (sans regroupement), D5, D6 (sans bonus de fenêtre), D7 (rideau sans animation des vitrines), D9 (chapitres sans répliques facultatives), D10, D12; assets A1, A3, A4. Le ménage (D8, A2, A6) et la rubrique « Pour ouvrir » complète (D11) suivent le lendemain.

## 15. Critères d'acceptation proposés (à rendre testables par qa-testeur)

| Id | Critère | Vérification |
|---|---|---|
| DV3-01 | Une nouvelle maison commence le jour 1 sur la place, rideaux baissés, avec 1 800 € en caisse, aucune station, aucune vaisselle, réserve vide | test: état initial du départ « cellule » |
| DV3-02 | Un joueur seul ne lève pas le rideau; à deux, 2 s de maintien commun le lèvent, chez les deux | test réseau à deux clients |
| DV3-03 | Le panier « Débrouille » coûte 1 030 €, « Le café de Simone » 1 292 €, « La belle machine » 1 380 €, « Coup de cœur » 1 690 € avec les données du jeu | test: somme des prix des données |
| DV3-04 | La vieille dame achetée par les deux au même instant: une seule vente, un seul débit, l'autre lit « Sacha vient de l'acheter. » | test réseau |
| DV3-05 | Une seule machine à la fois; la révisée posée renvoie la vieille dame non achetée chez Simone | test |
| DV3-06 | Un achat livré par Gaby apparaît 45 s réelles après le premier achat, dans la zone du trottoir; le compte s'arrête en pause et en absence | test à horloge simulée |
| DV3-07 | Un carton non ouvert rendu rembourse son prix exact | test |
| DV3-08 | La machine ne se pose qu'à `station-4`; ailleurs, la pose est refusée avec sa phrase; de même pour le moulin, la caisse, le réfrigérateur | test de pose |
| DV3-09 | Raccorder (2 s) puis 20 s de chauffe; avant, l'extraction est impossible; après, le noisette d'essai se prépare sans encaissement et consomme le cadeau de Simone | test |
| DV3-10 | Sans caisse ou sans vaisselle, ou sans aucune ligne servable, la pancarte refuse avec la phrase de ce qui manque; l'hôte refuse le vote `open` | test réseau |
| DV3-11 | Sans place assise, avec vitres blanchies ou poussière, la pancarte avertit et laisse ouvrir après l'accord de l'autre | test |
| DV3-12 | Avec une caisse insuffisante pour le moins cher d'un besoin obligatoire, l'achat passe « à régler » avec le nom de qui fait crédit; jamais de blocage par l'argent | test: caisse forcée à 50 € |
| DV3-13 | Le guide coche chaque étape à partir du seul état du monde, identique chez les deux, et reprend à la même étape après une sauvegarde en pleine installation | test pur sur `guideInstallOf` et test de reprise |
| DV3-14 | Une sauvegarde de la v0.2 (café équipé) se reprend sans installation | test de reprise |
| DV3-15 | Chaque action de la section 9 a son retour visuel et sonore | crochet de test des sons, relecture |
| DV3-16 | L'installation dure de 13 à 25 minutes réelles pour le client et sa compagne, sans moment où l'un attend sans rien à faire | observation en séance (M) |
| DV3-17 | `depart_v0_3.py` relancé sur les données du jeu redonne, pour le duo médian, la terrasse pour la fête dans les quatre paniers et une caisse de fin entre 150 et 350 € | `python3 -I -B .../depart_v0_3.py` |
| DV3-18 | Aucun texte nouveau n'accorde au genre d'un joueur ni ne contient de tiret cadratin ou demi-cadratin | relecture et contrôle de CLAUDE.md |

## 16. Questions pour le client

| # | Question | Recommandation |
|---|---|---|
| V3-1 | Simone devient l'ancienne patronne qui a fermé il y a trois ans, propriétaire des murs, qui habite au-dessus et vous loue la boutique vide. Ça te va ? | oui: elle garde son rôle (première cliente, voix des premiers jours, gérante plus tard) et c'est elle qui rend le départ chaleureux |
| V3-2 | Un petit prêt de la banque pour démarrer ? | pas dans la démo: sur deux semaines, on n'en verrait que deux mensualités, tout le monde le prendrait et le choix disparaîtrait. Le proposer dans le jeu complet, à partir de Mérelles, quand les mensualités durent assez longtemps pour peser |
| V3-3 | 1 800 € d'épargne, avec des prix de village et d'occasion (la vieille machine de Simone à 450 €, une machine révisée à 800 €) | oui: c'est le réglage où les quatre façons d'ouvrir se valent sans piège; les prix sont tassés comme toute l'économie du jeu, pour que l'installation pèse autant que deux semaines de recettes |
| V3-4 | Les tables, les chaises et la vieille machine de Simone restent sous des draps, à racheter pour pas cher, ou bien une boutique tout à fait nue ? | les garder: c'est l'image du café fermé (chaises retournées sur les tables), la voie économique pour un duo prudent, et ça réutilise les modèles existants; tout le reste est vraiment vide |
| V3-5 | Livraisons de l'installation le jour même (Gaby et sa camionnette, en moins d'une minute), au lieu du lendemain matin comme les autres achats | oui: sinon le premier jour se passerait à attendre; les achats suivants gardent la livraison du lendemain |
| V3-6 | Les adresses suivantes (Mérelles, Montaurel, Paris) aussi à équiper de zéro ? | à moitié: on y garde ce qui tient aux murs et ce qui fait l'histoire du lieu (le four de René, les presses de l'Imprimerie), le reste s'achète; à décider avant de produire Mérelles |
| V3-7 | Le ménage (balayer, laver les vitrines) facultatif mais visible (moins d'ambiance, moins de passants tant que ce n'est pas fait) | oui: on le fait volontiers à deux, et personne n'est bloqué s'il a hâte d'ouvrir |

## 17. Écarts avec le cahier et les démos précédentes

- **Cahier**: la phrase « vous reprenez le petit café d'un village », « 8 places à l'arrivée », l'équipement fourni d'Ormeval (table `depart`), la caisse de 300 € (table `divers`), la première scène et Q19 (l'annonce « à reprendre ») changent; voir l'historique du cahier (0.2.4). Les tables marquées pour la simulation longue (`cosy_cafe.py --croise`) ne sont pas retouchées: elles restent celles de la simulation de 34 h, à recaler quand le manager relancera la simulation longue avec ce départ (une note le dit sous chaque table concernée).
- **`demo-v0-1.md`**: le jour 1 « Les clés » (section 4) devient « L'installation »; la visite de Simone et le premier noisette se font pendant l'installation; le reste du calendrier ne change pas.
- **`realisme-v0-2.md`**: la réserve de Simone offerte (P0-1, `startStock`) disparaît; Simone n'offre plus que de quoi faire le café d'essai. Le texte « Je vous laisse la réserve » est retiré.
- **`ux-telephone.md`**: le Catalogue gagne la rubrique « Pour ouvrir » (section 6.3 à compléter par ux-ui-designer); l'état vide de la Réserve (« La réserve est vide. Le frais se commande dans Commandes. ») devient l'état normal du jour 1.
- **`adresses.md`** (level designer): le paragraphe « À l'arrivée » d'Ormeval décrit le café équipé; à mettre à jour (tables de Simone sous les draps, comptoir nu, rideaux).
