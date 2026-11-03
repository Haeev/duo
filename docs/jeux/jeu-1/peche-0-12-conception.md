# La Petite Ligne 0.12.0: la pêche (conception)

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne |
| Version visée | 0.12.0 (cycle court) |
| Statut | proposition à valider par le client (deux questions, section 15) |
| Date | 2026-11-03 |
| Rédaction | game-designer, sur brief du manager |
| Demandes du client | S09 (variété, rareté en cinq niveaux), S10 (ombres de poissons, indication discrète des coins à poissons rares): `retours/2026-11-02/retours.md` |
| Règles de référence | cahier des charges CN-01, CN-04, CN-05, PE-08; plan des 100 heures R8, R10, R16 |
| Simulation | `simulations/peche_0_12.py` (Monte-Carlo; `--tableaux` réimprime les tables de ce document) |

## En bref

- **Pitch**: au bord de l'Aubrune et du ru de la Côte, on lit l'eau à deux: les ombres trahissent les poissons, l'un fait le guet et voit briller les beaux, l'autre lance là où on lui dit.
- **Fantasme de joueur**: « J'ai vu sa grande ombre passer sous le ponton, je t'ai soufflé où lancer, et on l'a sortie ensemble. »
- **Ce qui change**: 22 poissons au lieu de 3, en cinq raretés (16 communs à épiques, 4 légendaires, 2 mythiques); des ombres visibles dans l'eau, que l'on vise; sept coins de pêche; chaque jour un « coin qui frémit » où les beaux poissons sont de sortie, signalé seulement par l'eau et les oiseaux; un onglet « Poissons » dans le carnet, avec les records de taille.
- **Ce qui ne change pas** (CN-05): lancer, attendre la touche, ferrer dans la fenêtre (1,5 s, 3 s avec l'aide « Ferrage facile »). Aucune épreuve d'adresse après le ferrage. Personne n'est puni de mal viser: une ligne sans ombre proche finit toujours par attirer un poisson.
- **Mode à deux**: coopération avec une asymétrie d'information (R16). Le joueur qui fait le guet, immobile au bord sans pêcher, voit sur son seul écran l'éclat des poissons rares et plus; il le dit à l'autre. Les mythiques ne se montrent qu'à un guetteur et ne se prennent qu'à deux (l'un ferre, l'autre tend l'épuisette).
- **Jamais farmables**: un légendaire au plus par jour, le même au plus une fois par saison; un mythique au plus une fois par année de jeu, toujours remis à l'eau, sans valeur marchande.
- **Simulation** (400 duos sur deux années): les communs, rares et épiques sont tous au carnet au plus 6,5 h de jeu après l'ouverture de la dernière saison pour 90 % des duos tranquilles (R10 demande 10 h); le gain par prise passe de 3,6 à 3,8 à 5,0 de monnaie selon la saison; une journée de pêche à deux rapporte 120 à 140.

## 1. Le mode à deux, en quoi il rend la pêche meilleure

| Situation | Ce qui se passe | Pourquoi c'est mieux à deux |
|---|---|---|
| Pêcher côte à côte | Les deux lignes à l'eau dans le même coin: les ombres qui apparaissent sont un peu plus souvent rares ou épiques (section 4.2). | On a envie de pêcher ensemble plutôt que chacun dans son coin. |
| Faire le guet | Un joueur immobile au bord, sans ligne à l'eau, voit briller les rares et plus sur son écran; l'autre ne les voit pas. | Il faut se parler: « La deuxième ombre à gauche, celle qui brille. » Le moins à l'aise peut guider sans manier la canne. |
| Le mythique | Il ne se montre qu'au guetteur, ne mord que si un guetteur le regarde, et ne sort de l'eau qu'avec l'épuisette tendue par l'autre. | Le plus beau moment de la pêche est forcément partagé. |

Aide et niveaux différents: le guet ne demande aucune adresse (rester immobile), l'aide « Ferrage facile » (PE-08) s'applique à toutes les prises et double la fenêtre de l'épuisette, et le lancer assisté (section 5.4) vise l'ombre pour le joueur.

## 2. Les coins de pêche

La pêche se joue sur les cases d'eau (`water`): l'Aubrune (y 38 à 42, toute la largeur) et le ru de la Côte (x 63 et 64, y 0 à 37). Les cases du gué (`g`, gravier) ne se pêchent pas: on s'y tient les pieds dans l'eau et l'on lance de part et d'autre. Chaque case d'eau appartient à un seul coin; le coin d'une prise est celui de la case où tombe le bouchon.

| Coin (`id`) | Nom affiché | Cases d'eau | Eau | Pourquoi ce coin |
|---|---|---|---|---|
| `ford` | Le gué | x 11 à 23, y 38 à 42 | courant sur galets, peu profond | les poissons de courant et de fond; on y pêche debout dans l'eau, à 5,7 s de la maisonnette |
| `sands` | Les sables | x 24 à 37, y 38 à 42 | eau lente entre les deux bancs de sable | eau tiède et calme; le banc de la berge et le banc du gué sont là |
| `pontoon` | Le ponton | x 38 à 57, y 38 à 42 | eau profonde et calme, pieux | les poissons qui guettent à l'abri des pieux; le coin d'Achille le lundi |
| `confluence` | Le confluent | x 58 à 70, y 38 à 42, et le ru y 36 et 37 | eau froide du ru mêlée à l'Aubrune | là où les poissons qui remontent attendent; le banc de la berge est (x 66, 67) le regarde |
| `ru` | Le ru | x 63 et 64, y 0 à 35, hors des cases des ouvrages | eau vive froide, 1 à 1,5 m de large | la truite et les petits poissons d'eau vive; ombres petites et moyennes seulement |
| `upstream` | L'amont | x 0 à 10, y 38 à 42 | eau lente devant le bourg ancien | le coin le plus proche du jardin, calme le soir |
| `downstream` | L'aval | x 71 à 99, y 38 à 42 | rivière large, bancs de sable | le coin des promeneurs de la rue Haute |

Le level designer ou le dev qui tient `outils/construire_carte_halte.py` ajoute ces rectangles à la carte (clé `peche.coins`, avec `id`, `nom`, `rects`), jamais à la main dans le JSON; le validateur vérifie qu'aucune case d'eau n'est hors coin ni dans deux coins. Les trois points de pêche existants (`fishing_ford_north`, `fishing_ford_south`, `fishing_pontoon`) restent des places d'habitants (Achille) et des repères d'astuce.

## 3. Les poissons

### 3.1 Table de configuration

Heures en heures de jeu, fin exclue. Une heure de jeu dure 42 s au rythme normal. « Favori »: condition qui double le poids du poisson parmi ceux de sa rareté (`favoriteFactor`). « Remis à l'eau »: le poisson va au carnet, jamais au sac (espèce protégée ou mythique). Taille de l'ombre: petite 0,30 m, moyenne 0,50 m, grande 0,80 m, immense 1,20 m de long.

| `id` | Nom | Rareté | Coins | Saisons | Heures | Météo | Favori | Ombre | Longueur (cm) | Prix (monnaie) | Usage |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `gudgeon` | goujon | commun | ford, sands, confluence, upstream, downstream | toutes | 6 h à 24 h | tout temps | | petite | 8 à 15 | 2 | commandes, quêtes de la démo, envie |
| `minnow` | vairon | commun | ru, ford, confluence | toutes | 6 h à 21 h | tout temps | | petite | 5 à 10 | 1 | annonce de l'aquarium de l'école |
| `stone_loach` | loche franche | commun | ru, ford | toutes | 17 h à 24 h, toute heure sous la pluie | tout temps | | petite | 6 à 12 | 1 | carnet, envie |
| `bleak` | ablette | commun | pontoon, sands, downstream | printemps, été, automne | 9 h à 19 h | soleil, nuages | | petite | 10 à 18 | 2 | annonce de la friture d'Odette |
| `roach` | gardon | commun | pontoon, sands, upstream, downstream | toutes | 6 h à 24 h | tout temps | | moyenne | 12 à 30 | 2 | commandes |
| `chub` | chevesne | commun | ford, sands, pontoon, confluence, upstream, downstream | toutes | 6 h à 24 h | tout temps | | moyenne | 20 à 50 | 4 | commandes, quête de Firmin, annonce de Jeanne |
| `trout` | truite fario | rare | ru, ford, confluence | printemps, été, automne | 6 h à 24 h | tout temps | pluie, printemps | moyenne | 20 à 45 | 8 | commandes (dont la démo), annonces de Firmin, envies; prérequis de la Dorée |
| `perch` | perche | rare | pontoon, sands, upstream | toutes | 9 h à 19 h | tout temps | | moyenne | 15 à 35 | 7 | commandes, annonce d'Achille |
| `dace` | vandoise | rare | ford, confluence, upstream | automne, hiver, printemps | 9 h à 19 h | tout temps | | moyenne | 15 à 28 | 6 | commandes |
| `bullhead` | chabot | rare | ru, ford | toutes | 6 h à 24 h | tout temps | | petite | 8 à 15 | 4 | annonce de l'aquarium de l'école |
| `tench` | tanche | rare | pontoon, sands, upstream | été, automne | 6 h à 10 h et 18 h à 24 h | soleil, nuages | | moyenne | 20 à 45 | 9 | commandes |
| `barbel` | barbeau | épique | ford, confluence, downstream | printemps, été, automne | 17 h à 24 h | tout temps | | grande | 35 à 70 | 16 | carnet, envie |
| `pike` | brochet | épique | pontoon, sands, downstream | été, automne, hiver | 9 h à 19 h | tout temps | pluie | grande | 50 à 95 | 24 | carnet; prérequis du Brochet de lune |
| `grayling` | ombre commun | épique | ford, confluence, downstream | automne, hiver | 8 h à 19 h | tout temps | brume | moyenne | 25 à 45 | 18 | carnet |
| `brook_lamprey` | lamproie de Planer | épique | ru, confluence | printemps, été | 6 h à 24 h | tout temps | pluie | moyenne | 10 à 16 | remise à l'eau | carnet, souvenir |
| `bitterling` | bouvière | épique | pontoon, sands, upstream | printemps, été | 9 h à 19 h | soleil, nuages | | petite | 5 à 8 | remise à l'eau | carnet, souvenir |
| `shad` | alose | légendaire | ford | printemps | 19 h à 24 h | tout temps | | immense | 35 à 55 | 50 | carnet, souvenir |
| `mirror_carp` | carpe miroir | légendaire | pontoon | été | 6 h à 9 h | sans pluie | | immense | 55 à 85 | 60 | carnet, souvenir |
| `salmon` | saumon | légendaire | confluence | automne | 9 h à 17 h | pluie ou lendemain de pluie | | immense | 70 à 100 | 90 | carnet, souvenir |
| `burbot` | lote | légendaire | upstream | hiver | 19 h à 24 h | brume, nuages ou pluie | | grande | 35 à 60 | 60 | carnet, souvenir |
| `golden_trout` | la Dorée | mythique | ru | automne | 6 h à 9 h | matin de brume | | moyenne, lueur dorée | 42 à 48 | remise à l'eau | carnet, souvenir, dessin de Jeanne |
| `moon_pike` | le Brochet de lune | mythique | pontoon | hiver | 21 h à 24 h | sans pluie | | immense, lueur pâle | 110 à 125 | remis à l'eau | carnet, souvenir, dessin de Jeanne |

Les trois poissons de la 0.11 gardent leur identifiant, leur nom, leur modèle et leur prix: les sauvegardes, les quêtes (`firmin_chub`, les trois goujons, la commande du jour 15 et ses deux truites), les annonces et les envies qui les citent restent valables.

Cohérence avec une vraie rivière de campagne: la truite ne se pêche pas l'hiver (c'est la fermeture, et sa saison de frai) et mord mieux au printemps (l'ouverture); le brochet manque au printemps (son frai); l'alose et le saumon remontent de la mer, l'une au printemps sur les graviers du gué, l'autre après les pluies d'automne, d'où le confluent; la lote est le seul poisson qui aime l'hiver et la nuit; la lamproie de Planer et la bouvière sont protégées, on les rend à l'eau. Les deux mythiques sont des variantes de couleur rares (une truite xanthique, un brochet pâle): crédibles, jamais magiques.

### 3.2 Cinq raretés, comment le jeu les montre

| Rareté | Écailles | Couleur du libellé | Ce que l'on ressent |
|---|---|---|---|
| commun | 1 | gris-vert de l'eau | le poisson de tous les jours, qui remplit les commandes |
| rare | 2 | bleu ardoise | une belle prise, qu'on montre à l'autre |
| épique | 3 | vert martin-pêcheur | une page du carnet qui se gagne à l'heure et au coin justes |
| légendaire | 4 | bronze | un rendez-vous de saison, qu'on prépare |
| mythique | 5 | or pâle | une histoire du bourg, vécue une fois par an au mieux |

Les écailles (une à cinq petites écailles dessinées à côté du nom) portent la rareté sans dépendre de la couleur (accessibilité). Couleurs à valider par le directeur artistique.

### 3.3 Textes du carnet

Une phrase de description, révélée à la première prise, et un indice, lisible avant (sur la silhouette). L'indice d'un légendaire ou d'un mythique n'apparaît qu'après la réplique d'Achille qui en parle (section 7.5).

| `id` | Description | Indice avant la première prise |
|---|---|---|
| `gudgeon` | Petit, moustachu, toujours au fond sur les galets: le premier poisson de bien des pêcheurs. | Sur les galets du gué, à toute heure. |
| `minnow` | Grand comme un doigt et vif comme l'éclair. Au printemps, son ventre rougit. | Dans l'eau vive du ru et du gué, avant la nuit. |
| `stone_loach` | Elle se cache sous les pierres le jour et sort le soir, ou dès qu'il pleut. | Le soir, sous les pierres du ru. |
| `bleak` | Un éclat d'argent juste sous la surface: les ablettes chassent en bande au soleil. | Autour du ponton, quand il ne pleut pas. |
| `roach` | L'œil rouge et l'écaille sage: le voisin de tous les pontons. | En eau calme, toute l'année. |
| `chub` | Grosse tête, grand appétit: il goûte à tout ce qui tombe à l'eau. | Partout dans l'Aubrune. |
| `trout` | Des points rouges cerclés de blanc. Elle aime l'eau froide et vive, et mord mieux sous la pluie. | Le ru et le gué, sauf l'hiver. |
| `perch` | Des rayures sombres et une nageoire qui pique. Elle guette à l'abri des pieux. | Autour du ponton, en journée. |
| `dace` | Une cousine fine et pressée du chevesne, qui préfère le courant. | Le courant du gué, hors de l'été. |
| `bullhead` | Une tête énorme sur un corps minuscule. Il ne quitte jamais sa pierre. | Sous les pierres du ru, en toute saison. |
| `tench` | Verte comme un vieux bronze, l'œil rouge. Elle se lève tôt et se couche tard. | En eau calme, l'été et l'automne, à l'aube ou le soir. |
| `barbel` | Quatre barbillons et un corps de lutteur. Il fouille le gravier quand le jour baisse. | Le soir, dans le courant. |
| `pike` | Un long museau et une patience de héron. Il attend dans les herbes que passe le dîner. | Près du ponton, à partir de l'été; il aime le temps gris. |
| `grayling` | Une grande nageoire de dos, comme une voile. De commun, il n'a que le nom. | Dans le courant clair, l'automne et l'hiver, surtout les matins de brume. |
| `brook_lamprey` | Ni écailles ni mâchoire: une ventouse et sept petits trous de chaque côté. On la regarde, puis on la rend au ru. | Dans le sable du ru, au printemps et en été. |
| `bitterling` | Petite et irisée, elle pond ses œufs dans les moules d'eau douce. On la rend à l'eau. | En eau calme, par beau temps, au printemps et en été. |
| `shad` | Elle remonte de la mer au printemps, et la nuit ses remous claquent sur le gué. | Au printemps, le soir, sur le gué. |
| `mirror_carp` | Quelques grandes écailles comme des miroirs sur un dos nu. | Au ponton, l'été, au lever du jour. |
| `salmon` | Il revient de l'océan pour remonter vers les sources. | Au confluent, après les pluies d'automne. |
| `burbot` | La seule de nos rivières à aimer le froid. Elle ne chasse que l'hiver, à la nuit. | L'amont, l'hiver, à la nuit tombée, quand le temps est gris. |
| `golden_trout` | Une truite couleur de miel, que l'on dit plus vieille que la halte. | Le ru, les matins de brume d'automne. Elle ne se montre qu'à qui ne pêche pas. |
| `moon_pike` | Un brochet pâle comme la lune. On en parle encore au bourg. | Sous le ponton, les nuits d'hiver sans pluie. Il faut être deux. |

Note d'écriture: l'ombre commun est un vrai poisson; son nom croise les ombres de la pêche, et la description en joue. Le directeur artistique et l'interface évitent seulement d'écrire « ombre » seul pour le poisson.

## 4. Probabilités

### 4.1 Principe: chaque ombre est un poisson

Quand une ombre apparaît dans un coin, le jeu tire tout de suite le poisson qu'elle est; c'est lui qui mordra si l'on vise cette ombre. Les probabilités se règlent donc à l'apparition des ombres, pas au ferrage. Le tirage se fait en deux temps:

1. **La rareté**, parmi commun, rare et épique, avec les poids de base 72, 24 et 4, multipliés par les bonus de la situation (4.2), puis plafonnée (rare 40 %, épique 15 %; l'excédent revient au commun). Une rareté sans aucun poisson possible ici et maintenant (coin, saison, heure, météo) a un poids nul.
2. **Le poisson**, parmi ceux de cette rareté possibles ici et maintenant, poids 1, multiplié par le favori (x2), par le coup de pouce du carnet (x4 pour un commun ou un rare jamais pris par le duo, x8 pour un épique, CN-04), et divisé par 3 si le joueur vient de prendre trois fois de suite ce même poisson.

Les légendaires et les mythiques ne passent pas par ce tirage (4.3).

Tous les tirages nouveaux passent par `unitDraw(seed, clé, jour)` (`src/etat/tirage.ts`), avec une clé qui compte les ombres (`ombre:<coin>:<numéro du jour>`), jamais par `sim.rng`: les autres systèmes de la démo gardent leur déroulé.

### 4.2 Ce qui fait monter la chance

| Bonus | Condition exacte | Rare | Épique |
|---|---|---|---|
| Coin qui frémit | l'ombre apparaît dans le coin du jour (section 6) | x 1,6 | x 2,5 |
| Pluie | météo du jour `rain` | x 1,15 | x 1 |
| Brume du matin | `world.morningMist` et avant 10 h 30 | x 1 | x 1,3 |
| Heures dorées | de 6 h à 9 h et de 17 h à 21 h | x 1,2 | x 1,2 |
| Pêcher à deux | au moment de l'apparition, les deux joueurs ont une ligne à l'eau (`waiting` ou `bite`) dans ce coin, bouchons à moins de 10 m | x 1,2 | x 1,25 |
| Épique jamais pris | un épique possible ici n'a jamais été pris par le duo | x 1 | x 1,5 |

Les bonus se multiplient, puis les plafonds s'appliquent. Le guet ne change aucun tirage: il aide seulement à viser la bonne ombre.

Mesures (simulation, carnet complet, 4 000 prises par ligne; la part des prises dépasse un peu celle des apparitions parce que les joueurs visent les grandes ombres):

| Situation | Commun | Rare | Épique |
|---|---|---|---|
| gué, été, 13 h, soleil, seul | 74 % | 26 % | 0 % (aucun épique de jour au gué l'été) |
| gué, été, 19 h, soleil, seul | 64 % | 30 % | 6 % |
| ponton, été, 13 h, soleil, seul | 69 % | 27 % | 4 % |
| ponton, été, 13 h, à deux | 68 % | 28 % | 5 % |
| ponton, été, 13 h, seul avec un guetteur | 55 % | 38 % | 7 % |
| ponton, été, 13 h, coin qui frémit, seul | 58 % | 33 % | 8 % |
| ponton, été, 13 h, coin qui frémit, guetteur | 41 % | 47 % | 12 % |
| gué, automne, 8 h, pluie et brume, coin qui frémit, à deux (tout cumulé) | 46 % | 41 % | 13 % |
| gué, automne, 10 h, brume, coin qui frémit, guetteur (tout cumulé) | 44 % | 42 % | 14 % |

Lecture: rien ne dépasse 15 % d'épiques; le coin qui frémit double les épiques; le guet est le meilleur bonus parce qu'il faut se parler pour en profiter, ce qui est le but.

### 4.3 Légendaires et mythiques: des rendez-vous

| Règle | Légendaire | Mythique |
|---|---|---|
| Présence | tirée à 6 h, chaque jour où la saison et la condition de météo sont remplies, à partir du jour 16 (la démo ne change pas): alose 0,35, carpe miroir 0,30, saumon 0,40, lote 0,35; x 1,5 tant que le duo ne l'a jamais pris (au plus 0,6) | tirée à 6 h, chaque jour où la condition est remplie: 0,25; jamais avant que le duo ait pris le poisson prérequis (truite pour la Dorée, brochet pour le Brochet de lune) |
| Où et quand | une seule ombre, dans son coin, pendant ses heures; elle s'ajoute aux ombres du coin | une seule ombre, dans son coin, pendant ses heures, visible seulement d'un guetteur (7.2) |
| Morsure | l'ombre ne vient qu'à un bouchon tombé à moins de 1 m (le lancer assisté le permet); attente de 8 à 20 s | seulement si un guetteur est à moins de 6 m de l'ombre au moment de la touche; attente de 6 à 12 s |
| Ferrage manqué | l'ombre s'en va: plus de présence pour aujourd'hui | idem, et l'épuisette manquée aussi |
| Limites | un légendaire au plus par jour pour le duo; le même au plus une fois par saison | le même au plus une fois par année de jeu; toujours remis à l'eau, sans prix |
| Si un joueur est absent | possible pour le joueur présent | impossible (il faut un guetteur et une épuisette) |

Mesures sur deux années (400 duos par profil; « attentif »: pêche 7 jours sur 10, va au coin qui frémit 6 fois sur 10, va au rendez-vous d'un grand dont il connaît l'heure et le coin une fois sur trois; « tranquille »: 45 % des jours, 25 %, une fois sur huit):

| Poisson | Attentif, année 1 | Tranquille, année 1 | Au plus, par duo |
|---|---|---|---|
| alose (printemps; en année 1, seulement les jours 16 à 21) | 47 % | 18 % | une par saison |
| carpe miroir | 76 % | 38 % | une par saison |
| saumon | 74 % | 37 % | une par saison |
| lote (hiver) | 82 % | 44 % | une par saison |
| la Dorée | 69 % | 30 % | une par année |
| le Brochet de lune (hiver) | 85 % | 45 % | une par année |

Aucun duo simulé n'a pris deux fois le même grand dans la même année. Un légendaire vaut 50 à 90 de monnaie une fois par saison: l'économie n'en dépend pas.

Attention au calendrier: la partie s'arrête aujourd'hui au jour 64 à 16 h (premier jour de l'hiver). La lote et le Brochet de lune sont dans les données mais ne se pêcheront qu'une fois l'hiver ouvert (question 2).

### 4.4 Garde-fous contre la répétition

| Garde-fou | Règle | Pourquoi |
|---|---|---|
| Coup de pouce du carnet | x4 (commun, rare), x8 (épique) pour un poisson jamais pris par le duo; x1,5 sur la rareté épique tant qu'un épique possible ici manque | R10: la dernière entrée arrive vite après la dernière débloquée |
| Pas trois fois le même | après trois prises de suite du même poisson par un joueur, son poids est divisé par 3 | casse les séries de goujons |
| Pas de banc d'un seul poisson | au plus deux ombres du même poisson dans un coin | les ombres d'un coin restent variées |
| Filet des communs | après 10 communs de suite pour le duo, la prochaine ombre qui apparaît là où pêche le dernier preneur est au moins rare (s'il en existe un ici) | une séance sans surprise ne dure jamais plus de 2 à 3 minutes |
| Coin qui frémit tournant | jamais le même coin deux jours de suite | on bouge le long de la rivière |
| Saisons (R8) | entre deux saisons, 5 à 10 poissons changent (mesuré par le script) | chaque saison a ses pêches |

Mesure du R10 (communs, rares et épiques, dernière saison ouverte au jour 64): au 90e centile, la dernière espèce arrive 1,9 h avant pour un duo attentif et 6,5 à 7,6 h après pour un duo tranquille selon la graine (400 duos; sur 100 duos le bruit monte jusqu'à 9,5 h; cible: 10 h). Les épiques les plus tardifs sont l'ombre commun (automne) et la bouvière (printemps et été, par beau temps).

Pour les 100 heures: 22 poissons sur les 36 prévus par le plan; les 14 suivants viennent du lac (arc A4) et de la pêche de nuit à la nasse (anguille, rang 4 du métier), sans toucher à cette table.

## 5. Les ombres

### 5.1 Combien et où

- Un coin s'éveille quand un joueur est à moins de 12 m de l'une de ses cases d'eau; il s'endort 30 s après que plus personne n'est à moins de 16 m (ses ombres s'effacent; elles ne sont pas sauvegardées).
- Ombres par coin éveillé: ponton 4; gué, sables, confluent, amont et aval 3; ru 2. Plus l'ombre d'un légendaire ou d'un mythique s'il est là.
- Place: une case d'eau du coin, à 0,4 m au moins de la berge, à moins de `castRange` (6 m) d'une case où l'on peut se tenir; dans le ru, au milieu du lit. Jamais sous le ponton ni sous un ouvrage (on ne verrait pas l'ombre).
- Dans le ru, les ombres sont petites ou moyennes; une grande ombre de la rivière qui remonterait est ramenée à moyenne (seuls la lamproie et la Dorée y sont moyennes).
- Une ombre non visée part au bout de 60 à 120 s (elle glisse vers le fond et s'efface en 2 s); une nouvelle apparaît 6 à 10 s après chaque départ ou chaque prise, en fondu de 2 s, à plus de 2 m de tout bouchon.

### 5.2 Comment elles bougent selon la rareté

Les deux joueurs voient les mêmes ombres, au même endroit (sauf l'éclat du guet et le mythique). La rareté ne se lit pas sur un repère: elle se devine à la taille et à la façon de nager.

| Rareté | Nage | Repère pour l'œil attentif |
|---|---|---|
| commun | par à-coups: pause de 1 à 3 s, élan de 0,6 m; les petites vont souvent par deux | vif, nerveux |
| rare | glisse lente (0,3 m/s), pauses de 3 à 6 s, demi-tours | calme, posé |
| épique | presque immobile près du fond, tourne lentement sur place, se déplace une fois toutes les 8 à 12 s | on dirait une pierre, puis elle bouge |
| légendaire | très lente, longue, la queue ondule; s'enfonce et remonte (opacité de 40 % à 70 %) | on la remarque de loin |
| mythique | invisible, sauf pour le guetteur: lente, avec une lueur (dorée ou pâle) | « Là ! Tu ne la vois pas ? » |

Nuit (21 h à 24 h) et pluie: une ombre sombre se perd dans l'eau sombre. La nuit, l'ombre se dessine par son sillage (deux traits clairs fins qui attrapent la lumière des lanternes et du ciel); sous la pluie, elle reste visible mais plus floue. Le tech-artist règle la lisibilité; critère: lisible à 22 h au zoom 1 sur l'écran de 1366 x 768.

### 5.3 Approche et touche

1. Le bouchon tombe. L'ombre libre la plus proche à moins de 1,5 m (1 m dans le ru et pour un grand) le remarque, se tourne et vient dessous à 0,4 m/s. Elle est alors réservée à cette ligne.
2. La touche arrive au temps tiré par la règle actuelle (3 à 15 s, multiplicateurs de pluie, de brume et de canne), mais jamais moins de 1,5 s après l'arrivée de l'ombre sous le bouchon. Le bouchon frémit deux fois avant de plonger.
3. Aucune ombre à moins de 1,5 m: une nouvelle ombre apparaît à 3 m (tirée comme en 4.1) et vient au bouchon; l'attente est multipliée par 1,5. On n'est donc jamais sans touche.
4. Ferré à temps: le poisson de l'ombre sort de l'eau. Manqué: l'ombre file (2 m/s, effacée en 1 s), « Il s'est échappé. » comme aujourd'hui.
5. Ligne remontée avant la touche (marcher, Agir): l'ombre perd l'intérêt et reprend sa nage, toujours là.

### 5.4 Lancer assisté

Si une ombre libre est à moins de 20° de la direction du regard et à portée de lancer, le bouchon tombe à 0,5 m devant elle, côté pêcheur, au lieu des 4 m habituels. Sinon, le lancer actuel (R09). Le guet et la parole servent ainsi à choisir l'ombre, pas à doser un geste.

### 5.5 Cas limites

| Cas | Règle |
|---|---|
| Deux bouchons pour la même ombre | la première ligne arrivée la réserve; l'autre attire l'ombre libre suivante ou fait venir une ombre nouvelle (5.3, point 3) |
| L'ombre part (fin de vie) pendant l'approche | impossible: une ombre réservée ne part pas tant que la ligne est à l'eau |
| Le coin s'endort pendant une ligne à l'eau | impossible: un joueur qui pêche est à moins de 6 m du bouchon, donc le coin reste éveillé |
| Changement d'heure pendant l'attente (un poisson sort de ses heures) | le poisson déjà tiré reste celui de l'ombre jusqu'à la fin de sa vie; seules les nouvelles ombres suivent l'heure |
| Fin de la fenêtre d'un grand pendant l'approche | s'il est réservé, il reste jusqu'à la touche ou au ferrage manqué |
| Pause de la plateforme, sieste | les ombres s'arrêtent avec l'horloge; pendant la sieste, on ne pêche pas, les coins s'endorment |
| Sauvegarde et chargement | les ombres ne sont pas sauvegardées; elles réapparaissent au chargement (4.1 retire au hasard, la clé `unitDraw` comprend le numéro de l'ombre) |

## 6. Le coin qui frémit (l'indication discrète)

### 6.1 La règle

Chaque jour à 6 h, `unitDraw(seed, "coin_peche", jour)` choisit un des sept coins, jamais celui de la veille, le même pour les deux joueurs. Il dure toute la journée. Il est actif dès le jour 1. Effet: les bonus de 4.2.

### 6.2 Ce qu'on voit (sans HUD)

| Signe | Coin qui frémit | Ailleurs | Détail |
|---|---|---|---|
| Ronds de gobage | un rond toutes les 5 à 9 s, deux ou trois à la fois au plus | un rond toutes les 20 à 40 s | le rond s'élargit en 1,5 s jusqu'à 0,6 m et s'efface; le plus lisible des trois signes |
| Bulles | quelques bulles fines qui crèvent la surface, toutes les 8 à 15 s, dans les eaux calmes (ponton, sables, amont, aval) | aucune | par la pluie, ce sont elles qui restent lisibles |
| Oiseaux | hirondelles qui rasent l'eau (printemps, été) ou bergeronnette qui sautille sur les pierres ou la berge (automne, hiver), un passage toutes les 40 à 80 s | aucun | jamais par la pluie; vol bas, à moins de 2 m (la caméra ne voit pas le ciel) |

Il n'y a ni icône, ni marque sur la carte, ni flèche. Les signes ne sont dessinés qu'à moins de 20 m d'un joueur.

### 6.3 Comment l'interface le nomme

- Nom: « le coin qui frémit ». Partout le même, sans majuscule au milieu d'une phrase.
- Regarder l'eau (touche `{examine}`) près d'un coin: « Le ponton: l'eau frémit, les beaux poissons sont de sortie aujourd'hui. » dans le coin du jour; ailleurs, « Le ponton: quelques ombres sous la surface. »
- Astuce, la première fois qu'un joueur pêche dans le coin du jour sans le savoir: « Tu vois ces ronds dans l'eau ? Ça gobe: c'est le coin qui frémit aujourd'hui. Les beaux poissons y sont plus nombreux. »
- Bonus (P1): une réplique du matin d'Achille, propre au joueur qui lui parle: « Ce matin, ça gobait au confluent. » (`{coin}`, nom du coin en minuscule après « au », « aux » ou « à l' »: au gué, aux sables, au ponton, au confluent, au ru, à l'amont, à l'aval).

## 7. Ce que voient les deux joueurs

### 7.1 Pendant la pêche

| Action | Pêcheur | L'autre joueur | Son |
|---|---|---|---|
| Lancer | animation `fish_cast`, bouchon qui tombe près de l'ombre visée | idem, vu de sa caméra | plouf léger du bouchon (existant) |
| Ombre qui approche | l'ombre tourne et vient sous le bouchon | idem | aucun |
| Touche | bouchon qui frémit deux fois puis plonge, cercle de ferrage (existant) | le bouchon qui plonge | « bloup » de touche (existant) |
| Prise d'un commun | poisson levé, notification « Un chevesne de 34 cm. » | rien (il voit le geste) | plouf de sortie, selon la taille (3 variantes) |
| Prise d'un rare | notification avec la vignette et deux écailles | ligne discrète: « Alex: une perche de 28 cm. » | plouf et petite note claire |
| Prise d'un épique | bandeau avec vignette: « Un barbeau de 61 cm ! Épique. » | même bandeau, au nom du pêcheur | deux notes montantes |
| Prise d'un légendaire | le personnage montre le poisson à deux mains (2 s, animation `fish_show`), bandeau « Prise légendaire: l'alose ! 48 cm. » | même bandeau, même geste vu de sa caméra | petit motif de quatre notes |
| Remis à l'eau | le personnage se penche et rend le poisson: « Une lamproie de Planer ! Tu la regardes un instant, puis tu la rends au ru. » | ligne discrète | glissement dans l'eau |
| Première prise d'une espèce | en plus: « Nouveau dans le carnet: la tanche. » | idem (le carnet est commun, CN-01) | aucun en plus |
| Nouveau record | « Nouveau record: chevesne de 46 cm. » | idem | aucun en plus |

Règle des sons: les deux machines sont dans la même pièce, donc un son de prise ne joue que sur la machine du pêcheur (sinon on l'entend deux fois, décalé). Seul le motif du mythique joue sur les deux, au même instant de la simulation.

### 7.2 Le guet (information propre, R16)

- **Faire le guet**: être immobile depuis 1,5 s, à moins de 3 m d'une case d'eau d'un coin, sans ligne à l'eau (on peut tenir la canne). Le guet cesse au premier pas.
- **Ce que voit le guetteur, et lui seul**: sur les ombres à moins de 8 m de lui, un éclat bref selon la rareté. Rare: éclat argenté toutes les 3 à 5 s; épique: éclat irisé vert-bleu toutes les 2 à 4 s; légendaire: reflet bronze sur le dos; mythique: l'ombre entière, avec sa lueur. Rythme et couleur diffèrent (lisible sans les couleurs). Rien pour les communs.
- **Ce que voit l'autre**: rien de tout cela. L'état du monde part chez les deux; le filtrage se fait dans l'interface et le rendu du joueur qui n'est pas au guet.
- **Retour au guetteur**: la première seconde de guet, un petit œil discret près du portrait (« Au guet »), qui s'efface au premier pas. Première fois: astuce « Reste immobile au bord de l'eau sans pêcher: tu verras briller les beaux poissons. Dis à l'autre où lancer. »

### 7.3 Le mythique, pas à pas

1. Le jour où il est là, pendant ses heures, son ombre existe dans son coin; seul un guetteur la voit.
2. Le guetteur guide l'autre; le pêcheur lance (le lancer assisté vise aussi l'ombre invisible pour lui: elle compte comme une ombre libre).
3. Touche, si un guetteur est à moins de 6 m de l'ombre: le pêcheur ferre normalement. Notification au pêcheur: « Ça tire fort ! Il faut l'épuisette. » Au guetteur: « Vite, l'épuisette ! `{act}` près d'Alex. »
4. L'autre joueur a 5 s (10 s avec « Ferrage facile ») pour agir à moins de 2,5 m du pêcheur. La vieille épuisette du ponton apparaît dans ses mains (pas d'objet à acheter).
5. Réussi: les deux personnages tiennent le poisson ensemble (3 s), puis le rendent à l'eau. Carte douce sur les deux écrans (4 s, se ferme seule ou par `{act}`): « La Dorée. Vous l'avez vue, vous l'avez tenue, vous l'avez rendue au ru. » Le motif du mythique joue sur les deux machines. Le lendemain, une lettre de Jeanne: « Racontez-moi la Dorée, je la dessine. » avec le dessin encadré (décoration).
6. Manqué (ferrage ou épuisette): « Elle s'est décrochée et a filé vers l'amont. Peut-être un autre matin… » Plus de présence ce jour-là.
7. Un joueur se déconnecte pendant les étapes 3 à 5: le mythique se décroche, sans message d'échec (la plateforme affiche déjà l'absence).

Textes du Brochet de lune: « Le Brochet de lune. Vous l'avez vu, vous l'avez tenu, vous l'avez rendu à l'Aubrune. » et « Il s'est décroché et s'est fondu dans le noir. Peut-être une autre nuit… »

### 7.4 Le carnet des poissons (collection)

Nouvel onglet « Poissons » dans le carnet, entre « Sac » et « Souvenirs ».

- En tête: « 17 poissons sur 22 » et, si l'on est près de l'eau, le nom du coin où l'on se tient.
- Cinq rangées, une par rareté (« Communs », « Rares », « Épiques », « Légendaires », « Mythiques »), avec leurs écailles.
- Poisson jamais pris: la silhouette de son ombre (taille réelle relative) et son indice (3.3). Légendaires et mythiques: silhouette sans indice tant qu'Achille n'en a pas parlé.
- Poisson pris: vignette, nom, écailles, description, coins, saisons, heures, météo préférée si elle existe, prix de vente (ou « remis à l'eau »), nombre de prises du duo, record (« 46 cm, Alex, 12 de l'été, année 1 »), première prise (date, coin, « ensemble » si l'autre était à moins de 15 m, CN-01).
- Chaque première prise remplit une page du carnet (CN-02) et compte dans la progression envoyée à la plateforme.
- Navigation au clavier comme les autres onglets; aucune information propre au guet n'y figure.

### 7.5 Souvenirs et répliques

- Souvenirs (onglet existant): la première prise de chaque épique, chaque légendaire, chaque mythique (vignette, date, coin, « ensemble »).
- Répliques d'Achille (pêcheur du bourg), une par grand, dites une fois par saison au plus, qui débloquent l'indice du carnet:
  - alose (printemps): « Au printemps, les aloses remontent. Le soir, on les entend claquer sur le gué. »
  - carpe miroir (été): « Il y a une carpe au ponton, grande comme un banc. Elle ne se montre qu'au lever du jour. »
  - saumon (automne): « Après une bonne pluie d'automne, guette le confluent: un saumon y passe parfois. »
  - lote (hiver): « L'hiver, à la nuit, une lote chasse à l'amont. Il faut aimer le froid. »
  - la Dorée (automne, après la première truite): « Mon grand-père parlait d'une truite couleur de miel, dans le ru, les matins de brume. Elle ne se montre qu'à qui ne pêche pas. »
  - le Brochet de lune (hiver, après le premier brochet): « Un brochet pâle passe sous le ponton, les nuits d'hiver sans pluie. Il faut être deux: une personne qui regarde, une qui pêche. »

## 8. Économie, commandes, annonces, envies

### 8.1 Prix

Prix de vente de la table 3.1, en nombre; la monnaie du jeu est appelée ici « monnaie » (son nom inventé est fixé par la conception de l'économie, `v0-12-conception.md`). La pêche devient une source de revenus claire sans toucher au reste de l'économie: on vend ses prises à Odette, et chaque poisson a un prix lisible dans le carnet.

| Mesure (simulation) | Valeur |
|---|---|
| Gain moyen par prise, sans les grands | printemps 3,8, été 4,5, automne 5,0, hiver 4,3 (0.11: 3,6) |
| Gain moyen par prise, grands compris | 4,6 à 4,8 |
| Une heure de jeu passée à pêcher (42 s), un joueur | environ 3,5 prises, 15 de monnaie |
| Une journée ordinaire où l'on pêche un peu (5 à 9 prises) | 25 à 40 |
| Une journée de pêche à deux (4 heures de jeu, environ 28 prises, coin qui frémit) | 120 à 140 |
| Un légendaire | 50 à 90, une fois par saison au plus |

Ce qui rapporte vraiment se lit dans le jeu: les rares (6 à 9) valent deux à quatre communs, les épiques (16 à 24) une matinée de communs, et le coin qui frémit, le guet et les heures dorées augmentent le gain d'une séance de 20 % à 40 %. Une journée entière de pêche à deux reste sous le plafond d'achat d'Odette (300 par jour). Si la nouvelle monnaie change d'échelle, un seul coefficient suffit: `fishing.priceScale` (1 par défaut) multiplie tous les prix de poissons, arrondis à l'unité, au moins 1 pour un poisson vendable. Le gardon est à 2 (et non 3) pour tenir la moyenne.

### 8.2 Commandes du samedi

- Poissons commandables: `gudgeon`, `roach`, `chub`, `trout`, `perch`, `dace`, `tench`. Jamais un épique, un légendaire, un mythique ni un poisson remis à l'eau; pas les tout petits (`minnow`, `stone_loach`, `bullhead`) ni l'ablette, réservés aux annonces.
- Le coût d'une ligne suit la part du poisson dans les prises de la saison de production: `coût = riverUnitCost / part`, avec `riverUnitCost` 0,0454 (la valeur implicite de la 0.11: goujon 0,0833 x 6/11). Cela remplace `fishCostFromWeights` et `fishCostReferenceSeason`, qui donneraient un coût nul à la tanche (absente au printemps). Parts mesurées (section 9, `fishShareBySeason`).
- Plus de poissons différents veut dire moins de chaque: `resources.river` passe de 1 à 2, les minimums et plafonds de ligne baissent (section 9). La commande fixe du jour 15 (deux truites) reste: la truite fait 9 % des prises au printemps, soit environ une par jour pour un duo qui pêche.
- À mesurer par le dev avec le test de bourse du tour 9 (`order_paid`, `sold`) avant de livrer: le paiement moyen d'une commande ne doit pas bouger de plus de 10 %.

### 8.3 Annonces nouvelles (tableau de la halte)

| `id` | Sorte | Habitant | Saisons | Lignes | Texte |
|---|---|---|---|---|---|
| `jeanne_school_tank` | coup de main | Jeanne | automne | 2 vairons | « Pour l'aquarium de l'école: deux vairons, bien vivants. On les rendra au ru à la fin de la semaine. Jeanne » |
| `achille_perch` | coup de main | Achille | toutes | 1 perche | « Une perche pour le déjeuner du dimanche, si vous passez au ponton. Je fournis le pain. Achille » |
| `odette_fry` | à deux | Odette | printemps, été, automne | 4 ablettes, 4 goujons | « Une friture pour la pension ! Des ablettes du ponton et des goujons du gué: il faudra vous partager la rivière. Odette » |

### 8.4 Envies nouvelles

| `id` | Sorte | Texte | Condition nouvelle |
|---|---|---|---|
| `catch_rare` | personnelle | Pêcher un poisson rare. | `caught_rarity` (rareté au moins `rare`) |
| `fish_hot_spot` | personnelle | Pêcher au coin qui frémit. | `caught` avec `inHotSpot: true` |
| `watch_for_other` | personnelle (touche l'autre, R16) | Faire le guet pour l'autre. | l'autre prend un rare ou plus pendant que tu es au guet à moins de 8 m |
| `two_lines` | partagée | Deux lignes dans le même coin. | les deux prennent un poisson dans le même coin à moins de 10 minutes de jeu d'écart |
| `beat_record` | personnelle | Battre un record du carnet. | `fish_record` |
| `released_fish` | personnelle | Rendre un poisson à l'eau. | prise d'un poisson `released` |

## 9. Valeurs pour `reglages.json` et `objets.json`

Ajouts à `reglages.fishing` (les clés existantes restent):

```json
"fishing": {
  "tier": "P1", "castRange": 6, "castDistance": 4, "castShoreMargin": 0.3,
  "biteWaitSeconds": [3, 15], "hookWindowSeconds": 1.5, "flag": "fishing_enabled",
  "priceScale": 1,
  "rarity": {
    "tierWeights": { "common": 72, "rare": 24, "epic": 4 },
    "hotSpot": { "rare": 1.6, "epic": 2.5 },
    "rain": { "rare": 1.15, "epic": 1.0 },
    "mist": { "rare": 1.0, "epic": 1.3, "until": "10:30" },
    "goldenHours": { "rare": 1.2, "epic": 1.2, "ranges": [["06:00", "09:00"], ["17:00", "21:00"]] },
    "together": { "rare": 1.2, "epic": 1.25, "maxBobberGap": 10 },
    "maxShare": { "rare": 0.40, "epic": 0.15 },
    "favoriteFactor": 2,
    "unseenFactor": { "common": 4, "rare": 4, "epic": 8 },
    "unseenEpicTier": 1.5,
    "streak": { "length": 3, "factor": 0.3333 },
    "maxSameSpecies": 2,
    "pityAfterCommons": 10
  },
  "shadows": {
    "perZone": { "ford": 3, "sands": 3, "pontoon": 4, "confluence": 3, "ru": 2, "upstream": 3, "downstream": 3 },
    "wakeRadius": 12, "sleepRadius": 16, "sleepAfterSeconds": 30,
    "lifeSeconds": [60, 120], "respawnSeconds": [6, 10], "fadeSeconds": 2,
    "minShoreDistance": 0.4, "minBobberDistance": 2,
    "attractRadius": 1.5, "attractRadiusSmallWater": 1.0, "approachSpeed": 0.4,
    "minBiteAfterArrival": 1.5, "noShadowSpawnDistance": 3, "noShadowWaitFactor": 1.5,
    "fleeSpeed": 2, "fleeSeconds": 1,
    "assistConeDegrees": 20, "assistOffset": 0.5,
    "sizes": { "small": 0.30, "medium": 0.50, "large": 0.80, "huge": 1.20 }
  },
  "hotSpot": {
    "drawKey": "coin_peche", "notSameAsYesterday": true,
    "ringEverySeconds": [5, 9], "ringElsewhereSeconds": [20, 40], "maxRings": 3,
    "bubbleEverySeconds": [8, 15], "birdEverySeconds": [40, 80], "signsRadius": 20
  },
  "watch": { "stillSeconds": 1.5, "waterRadius": 3, "glintRadius": 8 },
  "grands": {
    "fromDay": 16, "maxLegendaryPerDay": 1,
    "unseenPresenceFactor": 1.5, "presenceMax": 0.6,
    "attractRadius": 1.0, "biteWaitSeconds": [8, 20],
    "mythic": { "watchRange": 6, "biteWaitSeconds": [6, 12], "netSeconds": 5, "netSecondsEasy": 10, "netRange": 2.5 }
  }
}
```

Coins de pêche: dans la carte (`peche.coins`, section 2), pas dans les réglages.

Commandes (`order.generated`): `fishCostFromWeights` et `fishCostReferenceSeason` remplacés par `riverUnitCost` 0,0454 et `fishShareBySeason`; `resources.river` 2.

```json
"riverUnitCost": 0.0454,
"fishShareBySeason": {
  "spring": { "gudgeon": 0.096, "roach": 0.206, "chub": 0.293, "trout": 0.092, "perch": 0.095, "dace": 0.042 },
  "summer": { "gudgeon": 0.083, "roach": 0.179, "chub": 0.267, "trout": 0.109, "perch": 0.090, "tench": 0.059 },
  "autumn": { "gudgeon": 0.096, "roach": 0.170, "chub": 0.264, "trout": 0.089, "perch": 0.091, "dace": 0.037, "tench": 0.053 },
  "winter": { "gudgeon": 0.106, "roach": 0.213, "chub": 0.291, "perch": 0.082, "dace": 0.074 }
}
```

| Produit | `min` | `lineMax` | Saisons |
|---|---|---|---|
| `chub` | 3 | 8 | toutes |
| `roach` | 2 | 6 | toutes |
| `gudgeon` | 2 | 4 | toutes |
| `trout` | 1 | 3 | printemps, été, automne |
| `perch` | 1 | 3 | toutes |
| `tench` | 1 | 2 | été, automne |
| `dace` | 1 | 2 | automne, hiver, printemps |

Fiche de poisson dans `objets.json` (sous-objet `fish` des objets `category: "fish"`), exemple:

```json
{ "id": "tench", "name": "tanche", "plural": "tanches", "indefinite": "une tanche", "category": "fish", "stack": 99,
  "buyPrice": null, "sellPrice": 9, "shop": null, "model": "fish_tench", "tier": "P1",
  "fish": { "rarity": "rare", "zones": ["pontoon", "sands", "upstream"], "seasons": ["summer", "autumn"],
            "hours": [["06:00", "10:00"], ["18:00", "24:00"]], "weather": ["sunny", "cloudy"], "rainAnyHour": false,
            "favorite": [], "shadow": "medium", "lengthCm": [20, 45], "released": false,
            "description": "Verte comme un vieux bronze, l'œil rouge. Elle se lève tôt et se couche tard.",
            "hint": "En eau calme, l'été et l'automne, à l'aube ou le soir." } }
```

Pour un grand, en plus: `"presence": 0.35`, `"condition": "any" | "dry" | "wet" | "mist" | "misty_or_wet" | "night_dry"`, `"prerequisite": "trout" | null`, `"rumorDialogue": "<id de réplique>"`. Les remis à l'eau ont `sellPrice` nul et `released: true`; ils n'entrent jamais dans le sac. `feel.fishWeights` et `feel.fishWeightsBySeason` ne servent plus après la 0.12 (à retirer, avec leurs lecteurs dans `contenu.ts` et `defauts.ts`).

Sauvegarde (état du monde, environ 1,5 Ko): `fishLog[id]` = `{ count, first: { day, by, zone, together }, record: { cm, by, day } }`; `grands[id]` = dernière saison ou année de prise; les compteurs de série (`streak` par joueur, communs de suite du duo). Les ombres, la présence du jour et le coin qui frémit se recalculent (`unitDraw`) et ne se sauvegardent pas. La longueur d'une prise est tirée dans `lengthCm` (loi triangulaire centrée au tiers bas: les grands spécimens sont rares).

## 10. Règles complémentaires et cas limites

| Cas | Règle |
|---|---|
| Sac plein | comme aujourd'hui (PE-10): la prise tombe au sol à côté du pêcheur; un poisson remis à l'eau ne passe jamais par le sac |
| Pêcher depuis le gué de pierres du ru ou un ouvrage | on peut lancer depuis les pierres et la passerelle; le bouchon ne tombe jamais sur une case d'ouvrage (déjà vrai: ce ne sont pas des cases `water`) |
| Les deux joueurs au guet, personne ne pêche | les éclats s'affichent chez les deux; le mythique ne mord pas sans ligne |
| Un seul joueur connecté | tout marche sauf le mythique et le bonus « à deux »; le guet n'a pas de destinataire mais reste visible |
| Achille pêche dans le coin | ses lancers sont décoratifs: il ne réserve pas d'ombre et ne prend rien aux joueurs |
| Commande et prises | une prise ne compte pour une commande que si le poisson est au sac (les remis à l'eau ne comptent pas) |
| Prix et Odette | Odette achète tous les poissons qui ont un prix, au prix de la table 3.1 |
| Démo (jours 1 à 15) | ombres, coins et coin qui frémit dès le jour 1; pas de grand avant le jour 16; les quêtes de la démo (trois goujons, le chevesne de Firmin, deux truites le jour 15) restent faisables au gué |

## 11. Découpage en tâches

**Découpage pour ce soir: trois lots qui avancent en parallèle.**

| Lot | Qui | Tâches | Dépend de |
|---|---|---|---|
| 1. Simulation | un dev gameplay | C1, S1 à S9, U1 à U3 (l'onglet, les notifications et la pastille se branchent sur l'état qu'il crée); S10 si le temps le permet | rien: commence par S1 et C1 |
| 2. Rendu | un dev rendu (avec le tech-artist si disponible) | R1 à R4 | l'état des ombres de S2 (forme convenue en premier: `world.fishing.shadows`, `hotSpot`, état de guet); en attendant, une page de démonstration avec des ombres posées à la main |
| 3. Modèles simples | artiste 3D | M1 en version simple: un seul script Blender paramétrique, couleurs unies de la palette, 300 à 600 triangles; M2 réduit à `fish_show` | rien; livre les GLB et les substituts |

Repli si le temps manque, sans rien retirer au jeu: les sons A1 et A2 réutilisent les sons existants (plouf, touche, motif d'un moment) et passent à la version suivante; les vignettes M3 sont des rendus des modèles M1 sur fond clair; `fish_release` et `net_hold` reprennent `fish_show`. Ce qui ne se replie pas: les ombres, le guet, le coin qui frémit, les 22 poissons et l'onglet du carnet, qui sont la demande du client.

Ordre dans le lot 1: S1 et C1, puis S2 à S4 (le cœur jouable), S5 et S6, S7, S8, S9, puis l'interface.

### Simulation (dev gameplay 3D, `src/simulation/peche.ts`, `src/etat/`)

| Tâche | Contenu | Critères d'acceptation |
|---|---|---|
| S1 Données | sous-objet `fish` des 22 poissons, lecteur typé et validé dans `contenu.ts`, réglages de la section 9, validateur `outils/valider_donnees.py` | le validateur refuse un poisson sans `rarity`, un coin inconnu, une heure mal formée; pour chaque coin, chaque saison, chaque heure de 6 h à 24 h et chaque météo, au moins un commun possible (contrôle du validateur, 0 trou) |
| S2 Ombres | état `world.fishing.shadows` par coin éveillé (espèce, position, rareté, réservée), éveil et sommeil, vie, réapparition, placement | test: un joueur au ponton pendant 10 minutes de jeu réelles a toujours 3 à 4 ombres au ponton (au plus 1 manquante pendant 10 s); aucune ombre hors d'une case `water` ni à moins de 0,4 m d'une berge; aucune ombre au ponton après 46 s sans personne à moins de 16 m |
| S3 Tirage | raretés, bonus, plafonds, favori, coup de pouce, série, plafond d'espèce, filet des communs, par `unitDraw` | test sur 10 000 apparitions au ponton, été, 13 h, soleil, seul, carnet complet: épiques entre 3 % et 5 %, rares entre 22 % et 27 % des apparitions; aucune situation de la section 4.2 au-delà de 15 % d'épiques ni 40 % de rares à l'apparition; après 10 communs de suite, l'apparition suivante est au moins rare |
| S4 Lancer et touche | lancer assisté, attraction, réservation, attente minimale, ombre qui vient de 3 m, fuite | test: ombre à 15° et 5 m, bouchon à moins de 0,6 m d'elle; ombre à 30°, lancer de la 0.11; deux lignes sur la même ombre, une seule la réserve; la touche n'arrive jamais avant 1,5 s après l'arrivée de l'ombre |
| S5 Coin qui frémit | tirage du jour, bonus, jamais deux jours de suite, texte d'examen | test: sur 200 jours et 3 graines, jamais le même coin deux jours de suite; mêmes coins chez l'hôte et l'invité |
| S6 À deux et guet | état « à deux » par coin, état de guet par joueur (immobile 1,5 s, 3 m de l'eau, sans ligne) | test: le bonus « à deux » ne s'applique que bouchons à moins de 10 m dans le même coin; le guet cesse au premier pas |
| S7 Grands | présence du jour, prérequis, limites (un légendaire par jour, un par saison; un mythique par an), touche réservée au guet, épuisette, déconnexion | robot longue vie sur 2 années et 20 graines: jamais deux prises du même légendaire dans une saison ni du même mythique dans une année; jamais de mythique sans guetteur à moins de 6 m; un joueur qui quitte pendant l'épuisette: pas de prise, pas d'erreur |
| S8 Carnet et sauvegarde | `fishLog`, records, première prise avec « ensemble », pages du carnet, progression | test: sauvegarde puis chargement gardent compteurs, records et grands; « ensemble » si l'autre est à moins de 15 m |
| S9 Commandes, annonces, envies | `riverUnitCost`, `fishShareBySeason`, produits de 8.2, annonces de 8.3, conditions des envies de 8.4 | test de bourse du tour 9: paiement moyen des commandes à moins de 10 % de la 0.11; aucune commande avec un épique ou plus; quêtes de la démo réussies par les robots |
| S10 Contrôle croisé | `peche_0_12.py --tableaux` contre les données | un test lit la table de `objets.json` et la compare à celle du script (mêmes coins, saisons, heures, prix) |

### Carte (level designer ou dev qui tient l'outil de carte)

| Tâche | Contenu | Critères |
|---|---|---|
| C1 Coins | `peche.coins` dans `construire_carte_halte.py` (section 2), contrôle dans le validateur de carte | chaque case `water` dans un seul coin; noms des sept coins dans la carte; aucun coin sans case accessible à moins de 6 m |

### Rendu (dev rendu 3D et tech-artist, `src/rendu/`)

| Tâche | Contenu | Critères |
|---|---|---|
| R1 Ombres | ombres instanciées (un seul maillage, quatre tailles), nage selon la rareté (5.2), approche, fuite, fondus, sillage de nuit, flou sous la pluie | captures examinées au gué, au ponton et dans le ru, à 13 h et à 22 h, zooms 0 à 2, mode léger compris: ombres lisibles, aucune sur la berge ni sous le ponton, aucune qui traverse une pierre du gué; budget: au plus 2 appels de dessin et 1 programme de plus (place et rivière à 13 h, 1366 x 768) |
| R2 Guet | éclats par rareté chez le seul guetteur, lueur des mythiques | capture à deux navigateurs: éclats et mythique visibles chez le guetteur, absents chez l'autre au même instant |
| R3 Coin qui frémit | ronds de gobage, bulles, hirondelles et bergeronnette (6.2), sans icône | capture: au coin du jour, au moins un rond visible en 10 s; ailleurs, au plus un en 20 s; aucun oiseau sous la pluie |
| R4 Poisson en main | modèle de l'espèce prise au bout de la ligne et dans les mains, geste `fish_show`, remise à l'eau, prise à deux du mythique | capture de près: le poisson est dans la main, à la bonne taille (longueur tirée), ni dans le bras ni flottant |

### Modèles (artiste 3D, artiste 2D)

| Tâche | Contenu | Critères |
|---|---|---|
| M1 Poissons | 19 modèles nouveaux et 2 variantes (la Dorée sur la truite, le Brochet de lune sur le brochet), par un script Blender paramétrique (longueur, hauteur, nageoires, barbillons, couleurs) versionné dans `assets-src/` | chaque modèle a son substitut dans `src/rendu/substituts.ts` (sinon `rendu.test.ts` échoue); au plus 600 triangles; revue du directeur artistique: chaque espèce reconnaissable de près (nageoire dorsale de l'ombre, barbillons du barbeau et du goujon, rayures de la perche, points de la truite, écailles de la carpe miroir) |
| M2 Animation | `fish_show` (montrer à deux mains, 2 s), `fish_release` (se pencher et rendre), `net_hold` (tenir l'épuisette) sur le squelette commun | les mains tiennent le poisson et le manche sans traverser |
| M3 Vignettes et silhouettes | 22 vignettes du carnet et des notifications, 4 silhouettes d'ombre, 5 écailles de rareté; deux dessins de Jeanne pour les mythiques (cadre `picture_frame` existant, image nouvelle) | lisibles à 48 px; style de la bible artistique |

### Sons (sound-designer)

| Tâche | Contenu | Critères |
|---|---|---|
| A1 Prises | plouf de sortie (petite, moyenne, grande), note du rare, deux notes de l'épique, motif du légendaire (quatre notes), motif du mythique, remise à l'eau, épuisette | joués sur la seule machine du pêcheur, sauf le mythique (les deux, même instant); niveaux sous la musique de journée; écoute chez le client |
| A2 Eau | gobage (trois variantes), bulles, hirondelles et bergeronnette | discrets: on les entend à moins de 8 m, jamais au-dessus des pas |

### Interface (designer UX/UI, puis dev)

| Tâche | Contenu | Critères |
|---|---|---|
| U1 Onglet « Poissons » | section 7.4 | 22 cases, silhouettes et indices avant la prise, fiche complète après; navigation au clavier; lisible à 150 % sur 1366 x 768 |
| U2 Notifications | section 7.1, ligne discrète chez l'autre, bandeaux épique et légendaire, carte du mythique | test du modèle d'interface: chaque rareté produit le bon texte chez le pêcheur et chez l'autre; aucune ligne chez l'autre pour un commun |
| U3 Guet | pastille « Au guet », astuces de 6.3 et 7.2 | la pastille n'apparaît que chez le guetteur et disparaît au premier pas |

### Recette (qa-testeur)

Plan de test de la section 11, plus: une séance à deux navigateurs où le guetteur guide l'autre vers une ombre rare (capture des deux écrans au même instant), le contrôle typographique de `CLAUDE.md`, et la relecture des textes neutres (aucun accord au genre des joueurs).

## 12. Périmètre

- **Version 0.12.0**: tout ce document, sauf les points ci-dessous.
- **Bonus si le cycle le permet (P1)**: la réplique du matin d'Achille sur le coin qui frémit; les envies `watch_for_other` et `two_lines`; les records par joueur en plus du record du duo.
- **Plus tard**: les 14 poissons du lac et de la nuit (arc A4, rang 4 du métier: anguille, nasse); les appâts et l'amorce (CN-05 les prévoit: le pain rassis d'Achille ferait un bon début); une friture à cuisiner; l'ouverture de l'hiver jouable (question 2).
- **Hors périmètre**: toute épreuve d'adresse après le ferrage (combat, jauge de tension); vente des mythiques; marque des coins sur une carte ou dans le HUD.

## 13. Notes de version proposées (0.12.0)

Titre: « Ça mord à l'Aubrune »

- Vingt-deux poissons dans l'Aubrune et le ru de la Côte, du goujon au saumon, en cinq raretés: commun, rare, épique, légendaire et mythique.
- Les poissons se voient: vise une ombre, c'est elle qui mordra. Les grandes et les calmes cachent souvent les plus beaux.
- Chaque jour, un coin de la rivière frémit: ronds dans l'eau, bulles, hirondelles. Les beaux poissons y sont de sortie.
- Fais le guet: immobile au bord, sans pêcher, tu vois briller les poissons rares. Dis à l'autre où lancer.
- Quatre légendaires, un par saison, et deux mythiques qu'on ne prend qu'à deux, une fois par an.
- Un onglet « Poissons » dans le carnet, avec les tailles records.
- De nouvelles annonces au tableau: l'aquarium de l'école, la perche d'Achille, la friture d'Odette.

## 14. Originalité

Viser des ombres de poissons dont la taille trahit l'espèce est une mécanique connue du genre (le jeu de référence « île paisible » l'emploie). On garde l'intention (lire l'eau, choisir sa cible) et l'on en fait une version propre: la rareté se lit à la nage plutôt qu'à la taille seule, le guet donne une information à un seul joueur et oblige à se parler, le coin qui frémit se lit dans la nature et non dans l'interface, les mythiques se prennent à deux et se rendent à l'eau, les espèces protégées aussi, et la faune est celle d'une rivière française réelle. Noms, textes et règles sont originaux.

## 15. Questions pour le client

1. **Les mythiques se prennent seulement à deux et se rendent toujours à l'eau, sans être vendus. D'accord ?** Recommandation: oui. C'est ce qui les rend inoubliables et empêche de les farmer; la récompense est la page du carnet, le souvenir et le dessin de Jeanne accroché chez vous.
2. **La partie s'arrête au premier jour de l'hiver (jour 64): la lote et le Brochet de lune ne seront pêchables qu'une fois l'hiver ouvert. On ouvre l'hiver dans une prochaine version, ou on les remplace par des poissons d'automne pour la 0.12 ?** Recommandation: les garder pour l'hiver et ouvrir l'hiver dans une version suivante (le saumon et la Dorée suffisent à faire vivre l'automne).

## 16. Historique

| Date | Version | Changement | Auteur |
|---|---|---|---|
| 2026-11-03 | 0.1 | Première rédaction (S09, S10), simulation `peche_0_12.py` | game-designer |
