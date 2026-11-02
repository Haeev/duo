# Carte du bourg: La Halte d'Aubrune (démo)

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne (titre provisoire) |
| Statut | blockout validé par script, rue Haute comprise (tour 10, lot L1); bâtiments de l'est en caisses rayées dans le jeu jusqu'aux modèles du lot L2 |
| Version du document | 0.3 |
| Dernière mise à jour | 2026-11-02 |
| Rédaction | level-designer |
| Documents liés | cahier des charges: `docs/jeux/jeu-1/cahier-des-charges.md` (sections 4.4, 4.7, 4.10, 4.15, 6.1 à 6.3); périmètre de la démo: `docs/jeux/jeu-1/demo.md` (fait foi); points attendus par les données: `games/la-petite-ligne/donnees/README.md` (section 5); tour 10: `docs/jeux/jeu-1/tour-10-conception.md` (sections 1.3 à 1.6, 4.2, 13) et ADR 0016 (`docs/plateforme/decisions/0016-interieurs-et-carte-elargie-petite-ligne.md`, format des intérieurs) |
| Fichiers | carte: `games/la-petite-ligne/donnees/cartes/halte.json`; aperçus: `halte-apercu.png` (vue de dessus), `halte-apercu-iso.png` (caméra par défaut), `halte-apercu-est.png` (rue Haute de près) et `halte-apercu-interieurs.png` (maisonnette et épicerie de près), même dossier; outils: `games/la-petite-ligne/outils/construire_carte_halte.py`, `valider_carte.py`, `apercu_carte.py` |

## En bref

- **Une seule zone de 100x48 m** depuis le tour 10 (64x48 m pour la démo), la partie habitée de l'enveloppe de 120x90 m du cahier. Un anneau de 2 m autour est du décor lointain, jamais franchissable.
- **La composition**: la voie traverse le nord de la carte; le quai est au cœur, la halte à son bout est; la maisonnette du garde-barrière est au passage à niveau, à l'ouest du quai; la place du bourg s'ouvre juste au sud du quai; la lisière du bois de la Côte borde la voie côté nord, l'Aubrune coule au sud. **À l'est de la halte, le ru de la Côte** descend du coteau vers l'Aubrune; au-delà, **la rue Haute** (tour 10): le fournil d'Achille, la mercerie-coiffure de Solange, la maison de Lucie où loge Jeanne, l'école-mairie, et la route des hameaux qui sort de la carte (section 2.1).
- **Deux intérieurs visitables en plus de la maisonnette** (ADR 0016): la boutique de l'épicerie-pension et la mercerie-coiffure; la maisonnette porte déjà les places de ses deux pièces à bâtir, le cellier et la chambre (section 2.2).
- **Tout est proche**: depuis la porte de la maisonnette, le potager est à 1 m, le poulailler à 2,5 s, la caisse du quai à 8,4 s, le comptoir d'Odette à 8,3 s, l'établi de Basile à 6,6 s, la lisière à 8,7 s, le gué à 5,7 s. Le plus long trajet contrôlé (la remise de la draisine, qui ne sert qu'à la fin) prend 16 s. Plafond demandé: 25 s.
- **Pensée pour la caméra isométrique**: ce qui est haut est au nord et à l'ouest, ce qui compte est au sud-est de ce qui est haut. Chaque lieu important est vu depuis la caméra par défaut (sud-est) et depuis au moins une autre des quatre orientations.
- **La rue Haute est à 18 à 21 s de la maisonnette** (fournil 18,1 s, école 20,4 s, mercerie 21,1 s, maison de Lucie 21,5 s): assez loin pour être une course qu'on décide, sous le plafond de 25 s.
- **Contrôles**: `python3 games/la-petite-ligne/outils/valider_carte.py` (0 erreur) et `python3 games/la-petite-ligne/outils/valider_donnees.py` (0 erreur, tous les points des données trouvés).

## 1. Intention

| | |
|---|---|
| Ce que la carte enseigne | Où vivent les choses, en une journée: la maison, le potager, le quai et l'épicerie forment une boucle de moins de 30 s; la lisière et la rivière sont au bord, pour l'envie d'aller voir. |
| Ce qu'elle met à l'épreuve | S'organiser à deux pour la commande du samedi: les quatre lignes viennent de trois directions (radis et laitues au potager, à l'ouest; œufs au poulailler, juste à côté; planches au nord, de la lisière à l'établi) et se déposent au centre, à la caisse du quai. « Je fais le bois, tu t'occupes du potager ? » vient tout seul. |
| Émotion visée | Être accueilli et se sentir chez soi: on descend du train sur un quai fleuri, la place est à deux pas, la maison a son jardin et sa barrière. Rien ne presse: aucun lieu du quotidien (potager, poulailler, quai, épicerie, puits, établi, lisière, gué) n'est à plus de 10 s de la maison. |
| Difficulté | 1 sur 5 (cahier, section 6.1): aucune impasse, aucun obstacle à contourner pour aller à un lieu utile, des chemins qui montrent la route. |

## 2. Composition

| Lieu | Où (cases) | Pourquoi là |
|---|---|---|
| La voie | rangées y 12 à 14, de bord à bord; passage à niveau en x 17 à 19; traversée de service en x 50 | Le train vient de la ville par l'ouest, passe le passage à niveau du garde-barrière et s'arrête le long du quai; les Vergers sont à l'est (chapitre 2). Au nord du quai, le train à l'arrêt ne cache jamais le quai depuis les caméras du sud. Le ballast est franchissable partout, sauf sous le train à quai le samedi. |
| Le quai et la halte | quai x 21 à 50, y 15 à 18; halte x 51 à 60, y 15 à 20, porte au sud | Le quai est le cœur: caisse, tableau, cloche et banc sont groupés au milieu, à moins de 10 m de la porte de la voiture (`train_stop`). La halte est au bout est, en ligne avec le quai: placée au sud, elle aurait caché le quai à la caméra. |
| La maisonnette du garde-barrière | x 5 à 11, y 21 à 26, porte au sud, pièce de 5x4 | Au passage à niveau, au bout ouest du quai: c'est la première chose que le train croise en arrivant. Son jardin borde la voie; le potager de 12 cases est juste devant la porte, le tonneau d'eau à 1 m, le poulailler à côté. |
| La place du bourg | pavés x 31 à 48, y 23 à 33; puits au centre (x 39 et 40, y 27 et 28) | Juste au sud du quai: on y entre en descendant du quai. L'épicerie-pension Ferrand la borde à l'ouest, façade et comptoir tournés vers la place, avec la tonnelle du souper. L'est de la place reste dégagé pour les fêtes (arbre de mai, foire). |
| La lisière du bois de la Côte | zone x 15 à 39, y 3 à 10, au nord de la voie | Les 12 arbres à couper (chênes et sapins), des sureaux, des ronces, les pissenlits. Au fond de l'image vue par la caméra par défaut: ses grands arbres ne cachent rien d'important. |
| La scierie de Basile | x 2 à 11, y 2 à 9, établi sous auvent en x 12 et 13, y 7 et 8 | Contre le bois, au bout de la lisière: le premier arbre est à 1 s de l'établi. De l'autre côté de la voie par rapport à la maisonnette, à 6,6 s par le petit sentier du jardin. |
| La maison de Firmin | x 41 à 47, y 2 à 7, porte au sud | En face du quai, de l'autre côté de la voie: Firmin traverse chaque matin par la traversée de service au bout du quai, libre même quand le train est là. |
| La remise de la draisine | x 54 à 59, y 4 à 8, porte au sud sur une courte voie de garage | Au bout est, côté Vergers: fermée toute la semaine, elle s'ouvre à la fin pour annoncer la suite. |
| L'Aubrune | eau profonde y 38 à 42 (berges aux anses irrégulières), gué x 16 à 20 | Au premier plan de la caméra, basse: rien de haut sur la rive sud. Le gué prolonge la route du passage à niveau; le banc de la berge et le ponton sont à l'est du gué, devant l'épicerie et la place. |
| Le pré de l'est | x 50 à 61, y 24 à 33 | Herbes hautes, rochers, buissons: l'espace qui respire entre la halte et la rivière, le chemin de Jeanne. Depuis le tour 10, il est bordé à l'est par la haie du ru (x 62), ouverte au droit du gué de pierres. |

Réserves pour le jeu complet, inutilisées par la démo et laissées sans rien de fixe: le plan de la maison (14x12, règle MA-01) au nord de la maisonnette, entre elle et la voie, pour qu'une maison agrandie pousse derrière et ne cache jamais le potager; le potager de 96 cases (règle FE-01) autour de celui de la démo, jusqu'à la clôture de la berge. Le cellier et la chambre du tour 10 prennent place dans la réserve de la maison (section 2.2).

### 2.1 La rue Haute (tour 10): pourquoi chaque élément est là

Le récit, comme un habitant le raconterait: au nord, le coteau de la Côte descend jusqu'à la voie. Le ru de la Côte en sort et coule vers le sud jusqu'à l'Aubrune, qui coule vers l'est. Le bourg ancien (halte, place, épicerie) est à l'ouest du ru; à l'est, la rue Haute monte de la rivière vers le pied du coteau, d'où son nom. La voie existait avant la rue: elle passe le ru sur un ponceau. La rue de la halte, qui s'arrêtait au bord de la carte parce que la carte s'arrêtait, passe le ru sur un pont de pierre et devient la route des hameaux, par où partent les habitants et arrivent les élèves. La promenade de Jeanne passe le ru sur une passerelle et finit au bas de la rue Haute.

Places indicatives de la conception (table 1.3) calées ici; les écarts sont dans la section 11.

| Élément | Où (cases) | Pourquoi là, dans ce sens, à cette taille |
|---|---|---|
| Le ru de la Côte | x 63 et 64, du bord nord (y 0, il sort du bois) à l'Aubrune (y 37); code `r`, eau vive, infranchissable | Il borne le bourg ancien et la rue Haute. Deux cases pour un ru de 1 à 1,5 m: le reste est berge raide, dessinée par le rendu. Il se jette dans l'Aubrune en traversant la grève (y 36 et 37), sans détour. |
| Le ponceau | sous la voie, x 63 et 64, y 12 à 14 | La voie est plus ancienne que la rue Haute: elle passe le ru sur une voûte de pierre, sans qu'aucune case de la voie change. On y passe sur le ballast, comme partout sur la voie (c'est le chemin des sacs de farine). |
| Le pont de la rue | x 63 et 64, y 21 à 23 (code `P`), 3 m entre parapets bas | Dans le prolongement de la cour de la halte, qui fait déjà 3 m de large: deux personnes et une charrette. Parapets sur les bords nord et sud du tablier. |
| La passerelle de la promenade | x 63 et 64, y 34 et 35 (code `Y`), 1,6 m | La promenade est un chemin à pied, sans charrette: planches sur deux poutres, on y croise un habitant. Garde-corps côté amont (nord) seulement: il ne masque personne à la caméra par défaut, qui regarde vers le nord-ouest. |
| Le gué de pierres | x 63 et 64, y 30 (code `j`), trois pierres plates | À mi-chemin du pont et de la passerelle, dans l'axe du pré de l'est et de l'arrière de la mercerie: le raccourci de Jeanne, qui le passe en sautant; les joueurs aussi. La haie du ru s'ouvre là (y 29 à 31) et seulement là. |
| La haie du ru | x 62, y 24 à 28 et 32, 33 (buissons) | Une rive de ru porte des aulnes et des saules. La chevrette du tour 7 en sort toujours (`roe_deer_edge`, case 62, 27, dans la haie): elle sortait de la haie de l'ancien bord est. |
| Le fournil d'Achille | x 65 à 71, y 15 à 20, porte (68, 20) et guichet (70, 20) au sud, sur la rue | Entre la rue et la voie, au plus près du quai: les sacs de farine du train du samedi se portent du quai le long du ballast, passent le ponceau et entrent par la trappe de l'arrière (`bakery_back`) sans traverser le bourg. Le four et sa cheminée à l'arrière, côté voie, loin des maisons. Au nord de la rue, il ne cache rien d'utile à la caméra. Un niveau (faîtage à 5 m). |
| La ruelle | x 72 et 73, y 15 à 20 | Deux mètres entre le fournil et la cour de l'école: le passage d'Achille vers l'arrière de son fournil. |
| La cour de l'école | x 74 à 79, y 15 à 20, mur de 2,2 m, portail de 2 m centré en x 77 (cases 76 et 77, case de passage 77, 20) | Au bout nord de la rue Haute, le portail dans son axe: c'est « le haut » de la rue. Cour murée côté voie, son tilleul au milieu: on entend la récréation sans voir les enfants. Elle ne se visite pas à ce tour (`school_gate` devant le portail). |
| L'école-mairie | x 80 à 86, y 15 à 20, porte de la mairie en (83, 20) sur la route | À l'est de sa cour, sur la route des hameaux, d'où arrivent les élèves; deux niveaux (la mairie à l'étage, faîtage à 8 m) au nord de la rue: le seul bâtiment haut de l'est est contre la voie, où il ne cache rien. Dernière maison du bourg: la route est pavée jusqu'à elle. |
| La placette du carrefour | pavés x 65 à 78, y 21 à 24 | Au débouché du pont, la rue s'élargit devant le fournil et la mercerie: c'est le carrefour de la rue Haute, là où l'on s'arrête. |
| La rue Haute | pavés x 75 à 78, y 21 à 33 (chaussée x 76 et 77, trottoirs x 75 et 78), jusqu'à la promenade (y 34) | Elle relie la promenade, la rue de la halte et l'école: aucune impasse. Quatre mètres entre les façades, assez pour que les toits de la mercerie et de la maison de Lucie ne cachent pas les deux portes (section 8). |
| La mercerie-coiffure de Solange | x 68 à 74, y 25 à 31 (7 x 7, pièce de 5 x 5), façade à l'est: porte (74, 28) et vitrine (74, 27) sur la rue Haute | À l'angle des deux rues: c'est la boutique qu'on voit en passant le pont. Pignon, vitrine et porte sur la rue Haute, où l'on passe. Un niveau, faîtage à 4,8 m et égout à 3 m, faîtage est-ouest: en retrait d'une rangée de la placette, son toit ne cache pas la chaussée en orientation 0. |
| La maison de Lucie | x 79 à 84, y 26 à 31, façade à l'ouest: porte (79, 28) | En face de la mercerie: les deux portes se regardent à 4 m (y 28), Jeanne traverse seule. Un niveau, faîtage à 4,6 m, pignon sur la rue. Jardinet à l'est. |
| Le verger de Lucie | trois pommiers en (87, 27), (89, 29), (87, 31) | Derrière la maison, côté jardin. Au sud-est de tout ce qui compte: leurs houppiers ne cachent que l'arrière de la maison. |
| Le banc de la rue Haute | x 75, y 30 et 31, dos au mur de la mercerie, tourné vers l'est | Sur le trottoir, au sud de la porte du salon: on y déjeune à midi (Achille aussi), on y attend que le salon rouvre, face à la maison de Lucie. |
| Le banc de la berge | x 66 et 67, y 36, tourné vers l'Aubrune | Juste à l'est de la passerelle, au bord de la grève: la vue sur la rivière et sur le confluent du ru. |
| Le lampadaire du carrefour | (78, 24), à l'angle de la maison de Lucie | Il éclaire le pont, le carrefour et la porte de la mercerie: le bourg s'allume jusqu'à sa dernière boutique. |
| La route des hameaux | y 21 et 22, pavée de x 79 à 86, en terre (`:`) de x 87 au bord | Pavée dans le bourg, en terre au-delà de l'école: une route de campagne. C'est la seule voie qui sort de la carte; `village_exit` est à son bout (97,5 ; 21,5). |
| La promenade | y 34 et 35, prolongée de x 62 à 78 | Elle passe la passerelle et finit au bas de la rue Haute. Elle ne va pas plus loin vers l'est: elle n'y mènerait nulle part. |
| La grève | y 36 et 37 à l'est du ru | Elle touche la promenade: pas de bande d'herbe entre le chemin et la berge (retour R22). |
| Le pied du coteau | x 65 à 97, y 2 à 11, herbe haute, sept arbres et quelques buissons | Le bas de la Côte, bois clair. Pas de chemin: on n'y va pas encore (étape 4 du monde). On y entre par le ballast, comme dans la lisière. |
| Les prés du sud-est | x 85 à 97, y 23 à 35 | En pente douce vers la rivière, rien de fixe: la place des étapes suivantes et la vue sur l'Aubrune. Rien de haut au premier plan de la caméra. |

### 2.2 Les intérieurs (ADR 0016)

Chaque bâtiment visitable garde son intérieur dans son emprise, sur la même grille (clé `interieurs` de `halte.json`, section 9). Les murs restants pour la caméra par défaut sont ceux du nord et de l'ouest (le jeu coupe les deux murs côté caméra pour le joueur qui est dedans): le mobilier qu'on doit voir est adossé à ces murs.

| Bâtiment | Pièces | Porte | Mobilier fixe (cases bloquées) et pourquoi |
|---|---|---|---|
| La maisonnette (`house`) | la pièce, x 6 à 10, y 22 à 25 (zone `house_interior`) | (8, 26), au sud | aucun: les meubles se posent (aménagement) |
| L'épicerie-pension (`grocery`) | la boutique, x 24 à 29, y 26 à 31 (6 x 6) | (30, 30), à l'est sur la place | Repris du modèle de l'artiste (2026-11-02, `interior_blocked` tourné avec l'objet): le comptoir en L (29, 26 à 28), présentoir de bocaux sous la vitrine et retour perpendiculaire à la façade, avec la place d'Odette au guichet (29, 26), entre le retour et la cloison, où l'on n'entre pas: le même comptoir sert la place et la boutique; l'escalier des chambres (24 à 27, 26) le long de la cloison, pied sur le palier (28, 26) devant la porte de la salle à manger; le rayonnage du mur ouest (24, 28); la petite table ronde (25, 30) et ses deux chaises, à l'est et à l'ouest; le poêle (26, 31), le rayonnage du mur sud (27, 31) et les sacs de graines près de la porte (29, 31). Un écart avec l'artiste: (24, 29) reste libre (le rayonnage n'y a que 0,35 m de fond, comme en (24, 30), libre chez lui), sinon la table et le poêle enferment le coin de la chaise ouest. La salle à manger de la pension (x 24 à 29, y 24 et 25) reste fermée: on la regarde par la porte entrouverte (`grocery_dining_door`). |
| La mercerie-coiffure (`salon`) | le salon, x 69 à 73, y 26 à 30 (5 x 5) | (74, 28), à l'est sur la rue Haute | comptoir de mercerie (70 à 72, 27), Solange derrière, rouleaux de tissu au mur nord; fauteuil (69, 29) tourné vers le grand miroir du mur ouest, qui reste debout pour la caméra (au mur sud, le miroir disparaîtrait avec la coupe); banc d'attente (71 et 72, 30), tourné vers le fauteuil: de là, on propose une coupe à l'autre. Solange coud à la vitrine (`salon_window`, 73, 26). |

Pièces à bâtir de la maisonnette (conception, section 4.2), actives seulement une fois bâties: leurs cases restent dehors jusque-là.

| Pièce | Emprise (sans le mur commun) | Pièce | Porte percée | Pourquoi |
|---|---|---|---|---|
| Le cellier | x 2 à 4, y 21 à 26 | x 3 et 4, y 22 à 25 | (5, 24): la fenêtre ouest de la pièce (modèle `gatekeeper_house`, mur gauche, u 0,3) | Pignon aveugle à l'opposé du chemin; appentis bas qui ne cache rien. Les deux places d'étagère haute (x 3, y 22 et 23; x 3, y 24 et 25) sont contre le mur ouest, le passage x 4 reste libre devant la porte. Le buisson qui était en (4, 21) est passé en (2, 20). |
| La chambre | x 5 à 11, y 16 à 20 | x 6 à 10, y 17 à 20 | (9, 21): la fenêtre nord (mur arrière, u -1) | Côté voie, dans la réserve de la maison; la rangée y 15 reste libre (1 m avant le ballast), le banc du pignon (contre le mur, x 11,34 à 11,97, y 22 et 23) et le sentier du jardin (x 13) restent dehors. |

Sites des chantiers (panneau et caisse, section 4.3): `room_cellar_site` (3,5 ; 18,5), au nord du pignon ouest, hors de l'emprise et hors du chemin; `room_bedroom_site` (12,5 ; 17,5), entre le pignon est de l'aile et le sentier, à 2 m de la panne qui attend à `beam_pickup`. Aucun meuble de départ n'est devant les deux futures portes.

Une fois les deux pièces bâties (et tous les chantiers du tour 9), le validateur vérifie que tout reste atteignable: 3 096 cases, aucune poche. Aucun point ne tombe plus dans une pièce à bâtir: `fox_mousing` (le renard qui mulote, tour 6), qui était en (7,5 ; 17,0), dans la future chambre, est passé en (3,0 ; 16,5) le 2026-11-02, dans la bande d'herbe entre la voie et le futur cellier (2 m du site du cellier, 1,5 m du ballast, 2 m de l'aile); sa chorégraphie (`moments.json`: arrivée, apogée, départ) suit le même chemin, du ballast à cette herbe.

## 3. Schéma

Aperçus générés par `apercu_carte.py`: `games/la-petite-ligne/donnees/cartes/halte-apercu.png` (vue de dessus, points numérotés, trajets des habitants, zones) et `halte-apercu-iso.png` (blockout vu par la caméra par défaut).

Grille ASCII (nord en haut; x de 0 à 99, y de 0 à 47), générée depuis `halte.json`:

```text
     0         1         2         3         4         5         6         7         8         9         
     0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789
  0  TXXXXXXXTXXXTXXXTXXXTXTXXXXXTXTXTXXXTXTXXXTXTXXXXXXXXXXXXXXXTXTrrXXXTXTXXXXXXXTXTXXXTXTXTXXXXXXXXXXX
  1  XXTXTXTXXXTXXXTXXXTXXXXXTXTXXXXXXXTXXXXXTXXXXXTXTXTXTXTXTXTXXXXrrXTXXXXXTXTXTXXXXXTXXXXXXXTXTXTXTXTX
  2  XXSSSSSSSSSS.,,,....,,,,..,...,.,...,.,..FFFFFFF,,.T.,,...,,.,.rr..,.,,..,,.,.,,...,,..,,..,.,,...XX
  3  XXSSSSSSSSSS...,.,A....,...,A.,,.,,,.,A.,FFFFFFF,..,..,,,,..T..rr,.,...,T,,.,.,.,,.,,,,,.,T.....,.XX
  4  TXSSSSSSSSSS,.,,,,,..,..A......,.,A,.,.,,FFFFFFF,.,,.,RRRRRR...rr,.,.....,..,..,.T,.,,...,.,,.....XX
  5  XXSSSSSSSSSS...,,..,A,,,......A,.,,,..,..FFFFFFF..T...RRRRRR,,.rr,,.T,.,.,,.,,,..,...,....,.....,.XX
  6  XXSSSSSSSSSS,,,.A.......,.A.....,...A..,.FFFFFFF..,...RRRRRR.T.rr,,,..,,.,.,..,,..,,,,T..,,,.,....XX
  7  TXSSSSSSSSSSww....,,..A,.,,...,.A...,,.,.FFFDFFF.,..,,RRRRRR,,,rr,,,.,,..,,,,T,,,,,...,....,,.T,.,XX
  8  XXSSSSSSSSSSww...,...,.,.,,,.,.,,.,,.,,..,..:,.,..,..,RRDRRR,,,rr,.,,,,..,,.,,..,..,,,...,,..,,,,,XX
  9  XXSSSSSDSSSS...,,...,,,,,,,,,,,,.......,...,:,,......,,.=.,.,..rr..,..,.,,....,...,..,.,.,,.,.,..,XX
 10  TX::::::::::::::::::::::::::::::::::::::::::::::::::::::=:::::.rr.................................XX
 11  XX::::::::::::::::::::::::::::::::::::::::::::::::::::::=:::::.rr.................................XX
 12  =================###==============================#=================================================
 13  =================###==============================#=================================================
 14  =================###==============================#=================================================
 15  XX...........:::::::.qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqHHHHHHHHHH..rrBBBBBBB..ZZZZZZKKKKKKK...........XX
 16  XX...*******.:...:::.qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqHHHHHHHHHH..rrBBBBBBB..ZZZZZZKKKKKKK...........XX
 17  XX...*******.:...:::.qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqHHHHHHHHHH..rrBBBBBBB..ZZZZZZKKKKKKK...........XX
 18  XX...*******.:...:::.qlqqqqqqkqqnnqcqqqqqiqqqqqlqqqHHHHHHHHHH..rrBBBBBBB..ZZZZZZKKKKKKK...........XX
 19  XX...*******.:...:::..........++...........++......HHHHHHHHHH..rrBBBBBBB..ZZZZZZKKKKKKK...........XX
 20  XX...*******.:...:::l.........++...........++......HHHHDHHHHH..rrBBBDBCB..ZZZCZZKKKDKKK...........XX
 21  XX***MMMMMMM.:...:::+++++++++++++++++++++++++++++++++++++++++++PP++++++++++++++++++++++:::::::::::::
 22  XX***M     M.:...:::+++++++++++++++++++++++++++++++++++++++++++PP++++++++++++++++++++++:::::::::::::
 23  XX***M     M.:...:::...EEEEEEEE++++++++++++++++++..++++++++++++PP++++++++++++++...................XX
 24  XX***M     M.:...:::...EEEEEEEE+++l++++++++++++l+.,,,....,,.,,.rr+++++++++++++l.......,.,,,.,....,XX
 25  XX***M     M.:...:::...EEEEEEEE++++++++++++++++++.,,,,,.,.,,..,rr...WWWWWWW++++........,.,.,..,.,,XX
 26  XX***MMMDMMMu:..m:::...Eoooo oC++++++++++++++++++....,.,..,,..,rr...W     W++++LLLLLL.,,..,,,,,,,.XX
 27  XX.:::::::::::::::::...E     oE++++++++OO++++++++.,,,,,,.,..,,,rr...W ooo C++++LLLLLL,,t,...,.,...XX
 28  XX.....pppp...UUU:::...Eo    oE+aaa++++OO+n++++++.......,,...,,rr...W     D++++DLLLLL,.,,.,,,,,,.,XX
 29  XX.....pppp...UUU:::...E      E+aaa+++++++n++++++..,,.,,,,,,,,.rr...Wo    W++++LLLLLL.,..t,,,,.,,,XX
 30  XX.....pppp...UDU:::...E o    D++++++++++++++++++..,,,.,.,..,,,jj...W  oo Wn+++LLLLLL..,,.......,,XX
 31  XX...............:::...E  oo oE++++nn++++++++++++.,,,,,.,,.,.,.rr...WWWWWWWn+++LLLLLL.,t.....,.,.,XX
 32  XX..............|:::...EEEEEEEE++++++++++++++++l+.,.,,,,..,,,,,rr..........++++.......,..,.,.,.,..XX
 33  XX..............|:::...........++++++++++++++++++.,,,,.,.,,,,..rr..........++++,,..,.,.,....,,,.,,XX
 34  XX..............|::::::::::::::::::::::::::::::::::::::::::::::YY::::::::::::::,,.,.,,,.,,,,,,,,.,XX
 35  XX..............|::::::::::::::::::::::::::::::::::::::::::::::YY::::::::::::::.,,.,..,,,.,,..,,,,XX
 36  XX--------------.:::bbbbbbbnnbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbrrbnnbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
 37  bbbbbbbbbbbbbbbbgggggbbbbbbbbbbbbbbbbbbbbbbbvvbbbbbbbbbbbbbbbbbrrbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
 38  bbbbbbbb~~~~~~~~ggggg~~~~~~bbbbbbbb~~~~~~~~~vv~~~~~~~~bbbbbbbb~~~~~~~~~~~~~~~~~~~bbbbbbbb~~~~~~~~~~~
 39  ~~~~~~~~~~~~~~~~ggggg~~~~~~~~~~~~~~~~~~~~~~~vv~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 40  ~~~~~~~~~~~~~~~~ggggg~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 41  ~~~~~~~~~~~~~~~~ggggg~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 42  ~~~~~~~~~~~~~~~~ggggg~~bbbbbbbbb~~~~~~~~~~~~~~~~~~~~~~~bbbbbbbbb~~~~~~~~~~~~~~~~~~~~~~~bbbbbbbbb~~~~
 43  bbbbbbbbbbbbbbbbgggggbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
 44  XX,.,,,,,...,..,,:::.,,,,,.,,,,,,.,,,,,..,,,,,,,,,.,.,.,,,.,.,.,,.,,,..,,.,,..,,.,,.,,.,.,,...,.,.XX
 45  XX,..,,,.,.,.,,.,:::,..,,,,..,,,,,.,.,.,.,,,,.,...,.,,,,.,..,,,,.,,.,,,,,,.,.,,,.,,,,..,,,,,,,.,.,XX
 46  XXXXXXXXXXXXXXXXX:::XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 47  XXXXXXXXXXXXXXXXX:::XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Terrain: `.` herbe, `,` herbe haute, `:` chemin de terre, `+` pavés, `p` potager, `~` eau profonde, `g` gué, `b` berge, `=` voie, `#` traversée en planches, `q` quai, `X` bord, `r` ru de la Côte, `P` pont de la rue, `Y` passerelle, `j` gué de pierres. Objets: `H` halte, `M` maisonnette, `E` épicerie-pension, `F` maison de Firmin, `S` scierie, `R` remise, `U` poulailler, `B` fournil, `W` mercerie-coiffure, `L` maison de Lucie, `K` école-mairie, `Z` cour de l'école; dans un bâtiment visitable, une case vide est une pièce et `o` du mobilier fixe; `*` emprise d'une pièce à bâtir (cellier, chambre); `D` porte, `C` ouverture fermée (comptoir, guichet, vitrine, portail); `O` puits, `a` tonnelle, `w` établi, `c` caisse, `i` tableau, `k` cloche, `n` banc, `l` lampadaire, `u` tonneau d'eau, `m` boîte aux lettres, `v` ponton, `-` et `|` clôtures, `A` arbre à couper, `T` arbre de décor, `t` pommier. Buissons et rochers ne sont pas dessinés ici.

## 4. Parcours du joueur pendant la première heure

### Arrivée (jour 1, 10 h)

Le train sort du bord ouest, passe le passage à niveau (barrière baissée) et longe le jardin de la maisonnette avant de s'arrêter le long du quai, la voiture au milieu. Les deux joueurs apparaissent sur le quai devant la porte de la voiture (`spawn_1`, `spawn_2`, tournés vers le sud); Firmin les attend à `train_stop`, tourné vers eux.

Ce que montre la caméra par défaut (sud-est), centrée sur le quai, sur un écran 16:9:

| Zoom (largeur de vue) | Ce qu'on voit |
|---|---|
| 16 m | Firmin, la cloche et son banc, la caisse, le tableau, le bord de la lisière derrière le train |
| 24 m | en plus: le puits et la tonnelle d'Odette sur la place, la maison de Firmin de l'autre côté de la voie |
| 36 m | en plus: la façade de l'épicerie et son comptoir, la halte, le passage à niveau et sa barrière, la poutre de Basile |

La maisonnette n'est pas dans la première image: Firmin la désigne « là-bas, au passage à niveau ». On longe le quai vers l'ouest; la barrière rouge et blanche du passage à niveau sert de balise; la maisonnette et Basile sont derrière, à 10 s de marche.

### Découverte, jour par jour (aligné sur `demo.md`, section 1.1)

| Jour | Où l'on va | Ce que la carte fait pour ce moment |
|---|---|---|
| 1, samedi | quai, maisonnette, épicerie | Basile attend à `beam_pickup`, au coin du jardin près du passage à niveau; la poutre se porte à deux sur 6,4 m (3,6 s à 1,8 m/s) jusqu'au pignon est (`house_beam_spot`), dans un couloir d'au moins 3 m. Le chantier du toit et de la porte se joue devant la porte. Odette (graines, pain) est à 8,3 s par la rue de la Gare. Retour pour la première veillée. |
| 2, dimanche | potager, puits | Le potager de 12 cases est juste devant la porte; le tonneau est à 1,4 m; le puits de la place, à 9 s, sert de second point d'eau. On se répartit le potager et le bois. |
| 3, lundi | lisière, scierie, quai | Jeanne joue sur le banc du quai le matin. Petit sentier du jardin vers le nord, la voie, l'établi de Basile: le premier arbre est à 1 s de l'établi, le plus loin à 7,7 s. Le poulailler à réparer est à 2,5 s de la porte. |
| 4, mardi | potager, épicerie | La boucle récolte, vente chez Odette, retour fait moins de 20 s de marche. |
| 5, mercredi | poulailler, place | Les œufs. À 19 h, le souper sous la tonnelle d'Odette, au bord de la place. Jeanne est sur la berge l'après-midi, sur la place le soir. |
| 6, jeudi | tableau du quai | Le catalogue au tableau, à 6,7 s de la porte. |
| 7, vendredi | cloche et banc | L'énigme: le banc est 3,5 m à l'est de la cloche, sur l'herbe du talus du quai; on bêche au pied du banc (`bell_shadow_spot`), dans l'herbe, pas sur les dalles. |
| 8, samedi | quai, remise | Le train revient; la caisse est au milieu du quai, jamais cachée par le train (il est au nord). Le rassemblement final se fait à la cloche; la remise, au bout est, s'ouvre sur la draisine. |

Boucle type d'un matin: porte, potager (sur place), tonneau (1 m), poulailler (2,5 s), comptoir d'Odette (8 s), caisse du quai (2 s), retour (7,5 s): environ 20 s de marche, soit moins d'une heure de jeu avec l'horloge de la démo (0,35 s par minute).

Facultatif, pour l'envie d'explorer: la rive sud par le gué, le ponton, le banc de la berge, le pré de l'est, la cueillette le long de la lisière.

## 5. Repères visuels

- **La barrière rouge et blanche du passage à niveau**: « chez nous ». On la voit depuis le quai au zoom large.
- **La cloche sur son poteau et le panneau « Aubrune »**: le quai, la commande, Firmin.
- **La façade colorée de l'épicerie et sa tonnelle**: la place, Odette.
- **Le puits**: le centre du bourg, l'eau.
- **Le tas de bois et l'auvent de l'établi**: le travail du bois.
- **La remise fermée au bout de la voie**: le mystère de la fin, la suite de la ligne.
- **Les sols disent où l'on est**: pavés au bourg, chemin de terre vers la nature (lisière, jardin, rivière), planches aux traversées de la voie.

## 6. Distances de marche entre les lieux clés

Chemin le plus court sur la grille (huit directions, sans couper les angles), à 3,5 m/s, calculé par `valider_carte.py`. Le samedi, le train à quai occupe la voie le long du quai: la dernière colonne donne le temps dans ce cas quand il change.

| De | À | Distance | Temps | Train à quai |
|---|---|---|---|---|
| porte de la maisonnette | potager | 1 m | 0,3 s |  |
| porte de la maisonnette | poulailler | 8,7 m | 2,5 s |  |
| porte de la maisonnette | gué | 20,1 m | 5,7 s |  |
| porte de la maisonnette | cloche (Firmin) | 22,7 m | 6,5 s |  |
| porte de la maisonnette | établi de Basile | 23,0 m | 6,6 s |  |
| porte de la maisonnette | berge (banc) | 24,1 m | 6,9 s |  |
| porte de la maisonnette | comptoir d'Odette | 29,1 m | 8,3 s |  |
| porte de la maisonnette | caisse de la coopérative | 29,3 m | 8,4 s |  |
| porte de la maisonnette | arbre du milieu de la lisière | 30,4 m | 8,7 s |  |
| porte de la maisonnette | porte de la voiture | 34,1 m | 9,8 s |  |
| porte de la maisonnette | puits | 34,3 m | 9,8 s |  |
| porte de la maisonnette | place (Jeanne le soir) | 35,1 m | 10,0 s |  |
| porte de la maisonnette | comptoir intérieur d'Odette (par la porte de l'épicerie) | 35,1 m | 10,0 s |  |
| porte de la maisonnette | tableau du quai | 35,3 m | 10,1 s |  |
| porte de la maisonnette | ponton | 42,6 m | 12,2 s |  |
| porte de la maisonnette | maison de Firmin | 43,9 m | 12,5 s | 13,7 s |
| porte de la maisonnette | remise de la draisine | 55,5 m | 15,8 s | 16,0 s |
| porte de la maisonnette | guichet du fournil (tour 10) | 63,5 m | 18,1 s |  |
| porte de la maisonnette | portail de l'école (tour 10) | 71,5 m | 20,4 s |  |
| porte de la maisonnette | porte de la mercerie (tour 10) | 73,9 m | 21,1 s |  |
| porte de la maisonnette | porte de la maison de Lucie (tour 10) | 75,1 m | 21,5 s |  |
| potager | tonneau d'eau | 1,4 m | 0,4 s |  |
| potager | puits | 32,3 m | 9,2 s |  |
| caisse | comptoir d'Odette | 6,8 m | 2,0 s |  |
| caisse | établi de Basile | 24,3 m | 6,9 s |  |
| caisse | poulailler | 26,3 m | 7,5 s |  |
| établi | premier arbre de la lisière | 3,4 m | 1,0 s |  |
| établi | arbre le plus loin de la lisière | 27,1 m | 7,7 s |  |
| établi | comptoir d'Odette | 27,4 m | 7,8 s |  |
| comptoir d'Odette | place | 7,2 m | 2,1 s |  |
| porte de la voiture | comptoir d'Odette | 10,5 m | 3,0 s |  |
| porte de la voiture | remise | 21,3 m | 6,1 s | 6,3 s |
| porte de la voiture | berge | 25,3 m | 7,2 s |  |
| porte de la voiture | trappe à farine du fournil (ballast et ponceau, tour 10) | 31,2 m | 8,9 s | 9,1 s |
| cloche | pied du banc (énigme) | 7,4 m | 2,1 s |  |
| berge | gué | 11,8 m | 3,4 s |  |
| cour de la scierie | berge | 37,2 m | 10,6 s |  |
| maison de Firmin | comptoir d'Odette | 22,0 m | 6,3 s | 9,5 s |
| cueillette de la lisière (est) | porte de la maisonnette | 37,5 m | 10,7 s | 11,9 s |
| porte d'Odette | porte du fournil (la panière, tour 10) | 40,7 m | 11,6 s |  |
| place | porte de la mercerie (tour 10) | 43,2 m | 12,4 s |  |
| banc de la rue Haute | berge (banc) | 48,1 m | 13,7 s |  |

Comparaison avec les places indicatives de `demo.md` (section 1.2): la halte à 6,7 à 9,8 s (prévu 6 s), la place à 8,3 à 10 s (9 s), la scierie à 6,6 s (13 s), la lisière à 8,6 s (14 s), la rivière à 5,7 à 6,9 s (10 s), la remise à 15,8 s (40 m, environ 11 s). La journée marche donc moins que prévu, ce qui laisse plus de temps aux gestes avec l'horloge rapide de la démo.

Tour 10: la conception (annexe A, partie 5) comptait 24 à 27 s de la maisonnette à la rue Haute; la grille donne 18 à 21,5 s (le pont est dans l'axe de la rue de la halte). Avec la journée doublée (0,7 s par minute de jeu), c'est 26 à 31 minutes de jeu: un détour d'une demi-heure, comme voulu. Le tableau a aussi été remis à jour pour l'ancienne carte (le quai a changé aux tours 5 et 6: cloche plus proche, caisse et tableau plus loin).

## 7. Éléments placés

### Bâtiments et équipements

Position: centre de l'emprise; rotation en quarts de tour, 0 pour une porte au sud.

| Objet (type) | Emprise (x, y, l, p) | Rotation | Ouvertures | Pièce jouable |
|---|---|---|---|---|
| `station` | 51, 15, 10x6 | 0 | porte en (55, 20) | non (démo) |
| `platform` | 21, 15, 30x4 | 0 | | sol franchissable |
| `gatekeeper_house` | 5, 21, 7x6 | 0 | porte en (8, 26) | oui, pièce x 6 à 10, y 22 à 25 |
| `ferrand_shop` | 23, 23, 8x10 | 1 (façade à l'est) | comptoir en (30, 26), porte en (30, 30) | oui depuis le tour 10: la boutique x 24 à 29, y 26 à 31 (le comptoir sert aussi la place) |
| `firmin_house` | 41, 2, 7x6 | 0 | porte en (44, 7) | non |
| `sawmill` | 2, 2, 10x8 | 0 | porte en (7, 9) | non |
| `handcar_shed` | 54, 4, 6x5 | 0 | porte en (56, 8), voie de garage x 56, y 9 à 11 | non |
| `henhouse` | 14, 28, 3x3 | 0 | porte en (15, 30) | non |
| `well` | 39, 27, 2x2 | 0 | | |
| `workbench` (établi sous auvent) | 12, 7, 2x2 | 0 | | |
| `arbor` (tonnelle d'Odette) | 32, 28, 3x2 | 0 | | |
| `coop_crate` | 35, 18 | 0 | | |
| `notice_board` | 41, 18 | 0 | | |
| `bell_post` | 29, 18 | 0 | | |
| `bench` du quai | 32, 18, 2x1 | 2 (face à la voie) | | |
| `water_barrel` | 12, 26 | 0 | | |
| `pontoon` | 44, 37, 2x3 | 0 | | sol franchissable sur l'eau |
| `level_crossing_gate` | (16, 11) et (20, 15) | 0 et 2 | | |
| `bakehouse` (fournil, tour 10) | 65, 15, 7x6 | 0 | porte en (68, 20), guichet en (70, 20) | non (étape 2 du monde) |
| `school_yard` (cour murée) | 74, 15, 6x6 | 0 | portail en (77, 20), fermé | non |
| `school_house` (école-mairie) | 80, 15, 7x6 | 0 | porte en (83, 20) | non (étape 2) |
| `salon_shop` (mercerie-coiffure) | 68, 25, 7x7 | 1 (façade à l'est) | vitrine en (74, 27), porte en (74, 28) | oui: le salon x 69 à 73, y 26 à 30 |
| `lucie_house` | 79, 26, 6x6 | 3 (façade à l'ouest) | porte en (79, 28) | non (sur invitation, plus tard) |
| `tree_apple` (trois pommiers) | (87, 27), (89, 29), (87, 31) | 0 | | |
| `bench` de la rue Haute, de la berge est | 75, 30, 1x2 et 66, 36, 2x1 | 1 et 0 | | |

Hauteurs au faîtage et toits des bâtiments du tour 10 (contrôle de la caméra, section 8): fournil 5 m (égout 3 m, faîtage parallèle à la façade), mercerie 4,8 m (égout 3 m, faîtage est-ouest, pignon sur la rue Haute), maison de Lucie 4,6 m (égout 2,8 m, idem), école-mairie 8 m (égout 6 m, faîtage parallèle à la façade), mur de la cour 2,2 m, pommier 5 m (houppier de 3 m dès 1,6 m).

Décor: lampadaires, bancs de la place et des berges, tonneaux, boîte aux lettres, panneau « Aubrune » (facultatif), tas de bois, clôture du jardin, buissons, rochers, arbres (dont 12 à couper). Le détail est dans le fichier.

### Points

| Point | x, y | Rôle |
|---|---|---|
| `train_stop` | 38,5 ; 17,5 | porte de la voiture: Firmin attend le train, rendez-vous du samedi |
| `spawn_1`, `spawn_2` | 37,5 et 39,5 ; 15,5 | apparition des deux joueurs en descendant du train |
| `quay_bell` | 27,5 ; 18,5 | Firmin à l'ouest de la cloche, à 1,5 m du poteau (cloche en x 29,5, hors de la marquise, gauntlet tour 5): son ombre du soir passe sous la cloche, loin du banc pendant l'énigme; rassemblement de la fin |
| `quay_bench` | 33,0 ; 18,5 | le banc du quai (entre deux poteaux de la marquise, 3,5 m à l'est de la cloche), Jeanne le matin |
| `bell_shadow_spot` | 34,7 ; 19,8 | derrière le bout est du banc, dans l'herbe: on y bêche pour l'énigme |
| `coop_crate` | 35,5 ; 18,5 | la caisse de la coopérative, sous la marquise |
| `notice_board` | 41,5 ; 18,5 | le tableau: commande, catalogue, courrier, sous la marquise |
| `house_door` | 8,5 ; 27,5 | devant la porte de la maisonnette: toit et porte à construire |
| `house_spawn` | 8,5 ; 24,5 | dans la pièce: retour de minuit |
| `house_attic` | 8,5 ; 23,0 | le grenier: la boîte en fer |
| `house_beam_spot` | 13,5 ; 24,5 | où poser la poutre, contre le pignon est |
| `beam_pickup` | 14,5 ; 18,5 | la poutre et Basile au jour 1 |
| `water_barrel` | 12,5 ; 26,5 | le tonneau: remplir l'arrosoir |
| `chicken_coop` | 15,5 ; 31,5 | devant le poulailler |
| `hen_feeder` | 13,5 ; 31,5 | la mangeoire |
| `village_square` | 38,5 ; 30,5 | la place, Jeanne le soir |
| `well` | 40,0 ; 28,0 | le puits (on agit depuis une case qui le touche) |
| `grocery_counter` | 30,5 ; 26,5 | Odette derrière son comptoir, ouvert sur la place (portée 2,5 m) |
| `grocery_door` | 31,5 ; 30,5 | devant la porte d'Odette |
| `grocery_terrace` | 33,5 ; 29,0 | la tonnelle du souper de bienvenue |
| `firmin_house` | 44,5 ; 8,5 | devant la porte de Firmin |
| `sawmill_yard` | 9,5 ; 10,5 | la cour de la scierie, Basile chez lui |
| `sawmill_workbench` | 13,0 ; 9,5 | devant l'établi |
| `handcar_shed` | 56,5 ; 9,5 | devant la remise |
| `riverbank` | 28,0 ; 37,5 | la berge devant le banc: Jeanne l'après-midi, regarder la rivière |
| `river_ford` | 18,5 ; 40,5 | le gué (pêche en P1) |
| `fishing_ford_north`, `fishing_ford_south`, `fishing_pontoon` | 21,5 ; 37,5, puis 15,5 ; 43,5, puis 45,0 ; 39,5 | autres coins de pêche (P1), tous à moins de 6 m d'eau profonde |
| `forage_edge_01` à `forage_edge_05` | y 9,5, de x 19,5 à 38,5 | cueillette au bord du bois |
| `station_door`, `sawmill_door`, `level_crossing`, `mailbox` | | repères secondaires |
| `village_exit` | 97,5 ; 21,5 | depuis le tour 10, bout de la route des hameaux (au bord est): un habitant « hors carte » (`offstage`) y entre et disparaît; les élèves des hameaux en arrivent. Avant: 61,5 ; 34,5, au bout de la promenade, qui ne sort plus de la carte |
| `bakery_door` | 68,5 ; 21,5 | devant la porte du fournil (porte d'un lieu: vue dans les quatre orientations) |
| `bakery_window` | 70,5 ; 20,5 | Achille au guichet, dans l'embrasure (portée 2 m): on achète depuis la rue, sous l'auvent |
| `bakery_back` | 68,5 ; 14,5 | l'arrière du fournil, sur le ballast: la trappe des sacs de farine du samedi |
| `upper_street_bench` | 75,5 ; 31,0 | le banc de la rue Haute (portée 1,5 m) |
| `salon_door` | 75,5 ; 28,5 | devant la porte de la mercerie-coiffure |
| `lucie_house_door` | 78,5 ; 28,5 | devant la porte de la maison de Lucie, en face |
| `school_gate` | 77,0 ; 21,5 | devant le portail de la cour de l'école |
| `school_door` | 83,5 ; 21,5 | devant la porte de la mairie (repère secondaire) |
| `ru_stepping_stones` | 64,0 ; 30,5 | le gué de pierres du ru |
| `salon_inside`, `salon_counter`, `salon_chair`, `salon_stylist`, `salon_bench`, `salon_window` | 72,5 ; 28,5, puis 71,0 ; 26,5, puis 69,5 ; 29,5, puis 70,5 ; 29,5, puis 72,0 ; 30,5, puis 73,5 ; 26,5 | dans le salon: apparition, Solange au comptoir, le fauteuil (portée 1,5 m), Solange qui coupe (cap 270), le banc d'attente (portée 1,5 m), Solange à la vitrine |
| `grocery_inside` | 27,5 ; 28,5 | dans la boutique: apparition |
| `grocery_inside_counter`, `grocery_customer` | 29,5 ; 26,5 et 29,05 ; 27,95 | le comptoir intérieur, à la place d'Odette au guichet (portée 1,5 m, depuis le palier ou devant le retour), et la place du client au bout du retour (portée 1 m) |
| `grocery_table`, `grocery_table_seat_east`, `grocery_table_seat_west` | 25,65 ; 30,35, puis 26,25 ; 30,35, puis 25,05 ; 30,35 | la petite table ronde (portée 1,5 m) et ses deux chaises (portée 1 m) |
| `grocery_stove`, `grocery_dining_door`, `grocery_stairs` | 26,6 ; 31,55, puis 28,0 ; 26,4, puis 27,95 ; 26,45 | le poêle (portée 1,5 m), la porte entrouverte de la salle à manger, le pied de l'escalier (portée 1,5 m), tous deux sur le palier |
| `room_cellar_site`, `room_bedroom_site` | 3,5 ; 18,5 et 12,5 ; 17,5 | sites des chantiers du cellier et de la chambre (panneau et caisse) |

### Zones

| Zone | Rectangle (x, y, l, h) | Rôle |
|---|---|---|
| `garden` | 7, 28, 4x3 | les 12 cases du potager; ordre des cases: ligne par ligne, d'ouest en est, du nord au sud |
| `house_interior` | 6, 22, 5x4 | la pièce de la maisonnette |
| `forest_edge` | 15, 3, 25x8 | la lisière et ses 12 arbres à couper, et eux seuls |
| `quay`, `square`, `river`, `river_ford_area`, `meadow`, `level_crossing_area` | | le quai, la place, la rivière, le gué, le pré, le passage à niveau |
| `hen_pen` | 13, 31, 4x4 | où les poules picorent |
| `train_at_platform` | 23, 12, 27x3 | les cases du train à quai, infranchissables le samedi de 10 h à 16 h (train de 27 m au plus) |
| `house_plan_reserved`, `garden_extension_reserved` | 2, 15, 14x12 et 2, 28, 12x8 | réserves du jeu complet |

Meubles déjà posés (`maison.mobilier_depart`, d'après `objets.json`): deux paillasses côte à côte au nord-ouest de la pièce (la place du futur lit double), le réchaud au nord-est, le coffre au sud-ouest. L'entrée et le centre de la pièce restent libres pour la table et les chaises.

### Habitants

`habitants.json` fait foi pour les heures; la carte dit où, et par quel chemin.

| Habitant | Matin | Midi | Soir | Cas particuliers | Trajets |
|---|---|---|---|---|---|
| Firmin | `quay_bell` | `quay_bell` | `firmin_house` | jours 1 et 8: `train_stop` | maison, traversée de service au bout du quai, quai |
| Odette | `grocery_counter` | `grocery_counter` | `grocery_door` | jour 5 à 19 h: `grocery_terrace` | entre la porte, le comptoir et la tonnelle, le long de sa façade |
| Basile | `sawmill_workbench` | `sawmill_workbench` | `sawmill_yard` | jour 1: `beam_pickup`; jour 8: `train_stop` | cour et établi; jour 1 par-dessus la voie; jour 8 par le passage à niveau et le quai |
| Jeanne | `quay_bench` | `riverbank` | `village_square` | absente les jours 1 et 2; tour 10: jours d'école d'automne `school_gate` à 8 h 15; nuit chez Lucie (`lucie_house_door`) | tour 10: de la porte de Lucie au banc du quai par le gué de pierres et le pré de l'est; à 18 h 30, elle remonte avec Solange par le pont. Tant que `habitants.json` n'est pas repris (lot L3), elle sort encore par `village_exit`, désormais au bout de la route des hameaux |
| Achille (tour 10) | `bakery_window` | `upper_street_bench` | `fishing_ford_north` (17 h 30, sans pluie) | lundi `fishing_pontoon`; samedi 10 h `train_stop`; la panière à 9 h jusqu'à `grocery_door` | panière par le pont, la rue de la halte et la place; pêche par la rue Haute, la promenade et la passerelle; samedi par la ruelle, le ballast et le ponceau, retour des sacs jusqu'à `bakery_back` |
| Solange (tour 10) | `salon_counter` | chez elle | `village_square` à 18 h, puis `lucie_house_door` avec Jeanne | lundi `salon_window`; dimanche `riverbank` et `grocery_table`; samedi `train_stop` | du salon par la porte, la rue Haute et le pont; dimanche par la promenade, ou jusqu'à la petite table d'Odette par la porte de l'épicerie |

## 8. Caméra isométrique

Règle de composition: ce qui est haut (bois, scierie, maison de Firmin, épicerie, halte) est au nord et à l'ouest des lieux importants, puisque la caméra par défaut regarde vers le nord-ouest et que tout volume cache ce qui est derrière lui dans cette direction. Le premier plan (rivière, rive sud, pré) reste bas: buissons et rochers seulement.

Contrôle (`valider_carte.py`, section 7): rayon du buste d'un personnage (1 m de haut) vers la caméra orthographique à 35,264 degrés, contre des volumes pleins jusqu'au faîte (prudent: un vrai toit est plus bas aux égouts); houppiers des arbres comptés comme des cubes; poteaux, lampadaires et troncs de moins de 0,6 m ignorés.

Résultat: les 38 lieux importants (32 de la démo et des tours 6 à 9, 6 de la rue Haute) sont tous visibles depuis l'orientation par défaut, et chacun depuis au moins une autre orientation; les deux places d'apparition (vues au moment de l'arrivée seulement) et les 12 cases du potager sont visibles depuis l'orientation par défaut. Ce qui reste caché dans les autres orientations est attendu:

- vers le sud-ouest, l'épicerie masque le groupe du quai (caisse, tableau, cloche): on le revoit depuis les deux orientations du nord;
- vers le nord, la maisonnette masque son potager, et la lisière masque ses cueillettes: on les voit depuis les deux orientations du sud;
- le samedi, le train à quai masque, depuis le sud-est, le bord de la lisière derrière lui (quatre coins de cueillette): avertissement seulement, le samedi n'est pas un jour de cueillette.

Part des cases franchissables où un personnage est caché par un volume: 24 % depuis le sud-est, 22 % depuis le sud-ouest, 43 % depuis chacune des orientations du nord (surtout dans le bois et derrière l'épicerie). **Le rendu doit donc rendre transparents, ou découper, le bâtiment, l'arbre ou le train qui cache un personnage**; la carte garantit seulement qu'aucun lieu utile n'en dépend depuis la caméra par défaut.

### 8.1 La rue Haute (tour 10)

Les bâtiments du tour 10 portent un toit (`toit` du type: hauteur à l'égout, sens du faîtage): le contrôle suit alors la pente du toit, par pas de 5 cm le long du rayon, au lieu d'un volume plein jusqu'au faîte. C'est ce qui rend vérifiable la règle de la conception (1.3): des maisons basses au sud de la rue ne cachent pas la rue. Les bâtiments plus anciens gardent le volume plein, plus prudent.

| Contrôle | Résultat |
|---|---|
| Portes des lieux nouveaux, au moins trois orientations sur quatre (T10-03; le bâtiment de la porte lui-même ne compte pas, le jeu le coupe ou le rend transparent) | `bakery_door`, `bakery_window`, `salon_door`, `lucie_house_door`: quatre sur quatre; `school_gate`: trois (cachée vers le nord-est par l'école-mairie) |
| Banc de la rue Haute (lieu important: orientation par défaut et une autre) | vu du sud-est et du nord-est; caché par la mercerie, contre laquelle il est adossé, vers l'ouest |
| Chaussée de la rue de la halte et de la route des hameaux, x 62 à 86, y 21 et 22, en orientation 0, contre la mercerie et la maison de Lucie (`camera.rues_degagees`) | aucune case cachée. Il a fallu reculer les deux maisons d'une rangée par rapport à la conception (mercerie y 25 au lieu de 24): avec un égout à 3 m, une maison posée en y 24 cachait la rangée y 22 |
| Part des cases cachées, carte entière | 25,7 % (sud-est), 26,5 % (sud-ouest), 47,8 % (nord-ouest), 45,0 % (nord-est): le pied du coteau et les prés du sud-est, sans lieu utile, ajoutent surtout de la surface cachée par leurs arbres vers le nord |

Une porte de façade ne se voit de face que depuis les deux orientations de son côté; le contrôle ci-dessus dit qu'aucun autre volume ne la cache. Côtés vus de face: fournil et portail de l'école (sud) depuis le sud-est et le sud-ouest; mercerie (est) depuis le sud-est et le nord-est; **maison de Lucie (ouest) depuis le sud-ouest et le nord-ouest seulement**: pour que les deux portes se fassent face, comme le veut la conception, celle de Lucie tourne le dos à la caméra par défaut (vérifié en jeu: elle se voit de face en orientation 2). Depuis le sud-est, Jeanne qui rentre passe derrière la maison, sous la transparence du rendu. Acceptable à mon sens: la maison de Lucie ne se visite pas, la porte de la mercerie, elle, est face à la caméra.

Ce qui reste caché est voulu: la ruelle (x 72 et 73) entre le fournil et la cour de l'école, et la placette au pied du mur nord de la mercerie (y 24), cachées par les façades qui les bordent. Le rendu découpe ou rend transparents ces volumes devant un personnage (règle du jeu).

La forêt du pourtour, semée par le rendu hors du bord jouable, cache ce qui est à moins de 10 m du bord sud ou est en orientation 0 (carnet du level designer): rien d'utile n'est à moins de 10 m du nouveau bord est (x 98), sauf `village_exit`, qui n'a pas à être vu.

`moments_tour7_geometrie.py` (lignes de vue des moments, tour 7) ne tourne plus sur la carte actuelle, avant comme après le tour 10: il s'arrête sur `KeyError: 'roe_deer'` (le moment de la chevrette a été ajouté à `moments.json` depuis). Les lignes de vue du tour 10 sont donc contrôlées par `valider_carte.py`, ci-dessus.

## 9. Format du fichier, pour le développeur

`halte.json`, clés principales:

| Clé | Contenu |
|---|---|
| `taille` | `largeur` 100 (64 avant le tour 10), `hauteur` 48, `bord` 2 (anneau infranchissable) |
| `conventions` | unités, axes (x vers l'est, y vers le sud; Three.js: y du monde vers +Z), cases, rotation (`rotation.y = rotation x PI/2` pour un modèle dont la porte regarde +Z; `facing = PI/2 - rotation x PI/2` pour un point) |
| `terrain` | `legende` (code, nom, `sol` au sens de `GroundKind`, franchissable, bruit de pas) et `lignes` (48 chaînes de 100 codes); codes du tour 10: `r` ru (`water`, bloqué), `P` pont (`stone`), `Y` passerelle (`wood`), `j` gué de pierres (`gravel`) |
| `types` | catalogue des objets: catégorie, emprise à la rotation 0, hauteur, ouvertures, pièce jouable, volumes d'occultation, `toit` (égout et sens du faîtage, tour 10); catégorie `enclos` pour la cour murée de l'école |
| `objets` | `id`, `type` (nom du modèle), `x`, `y` (centre), `rotation`, `rect` (emprise en cases); `coupable: true` pour les 12 arbres de la lisière |
| `points` | liste d'objets avec `id`, `x`, `y`, `role`, et selon le cas `objet`, `portee`, `rayon`, `rotation`, `interieur` |
| `zones` | liste d'objets avec `id`, `rect` (un seul rectangle par zone, comme `GameMap.zones`) |
| `maison` | objet, pièce, case de la porte, point de retour de minuit, meubles de départ (`item`, `cx`, `cy`, `rotation`, `cx` et `cy` étant la case nord-ouest du meuble) |
| `habitants`, `trajets` | emplacements matin, midi, soir, et chemins en lignes brisées (`par`, en mètres) |
| `infranchissable` | règles et `grille` (48 chaînes: `#` bloqué, `.` libre), recalculée et comparée par le validateur |
| `trajets_cles`, `portage`, `sorties` | ce que contrôle le validateur; sorties toutes fermées dans la démo (`exit_hamlets_road` remplace `exit_east_promenade` au tour 10) |
| `interieurs` (tour 10, ADR 0016) | un bâtiment visitable par entrée: `id` (`house`, `grocery`, `salon`), `objet`, `nom`, `pieces` (`id`, `nom`, `rect`; la pièce de la maisonnette porte aussi `zone`), `portes` (`id`, `cx`, `cy`, case `dehors`, `point` devant la porte; déduites des ouvertures `porte` de l'objet), `apparition` (point), `heures` (clé de premier niveau de `reglages.json`: `grocer`, `salon`; `null` pour la maisonnette), `ambiance` (`room-tone-shop`, `room-tone-salon`, `null`), `mobilier` (`id`, `cases` bloquées, `rotation`, `role`), `fermees` (parties où l'on n'entre pas: salle à manger de la pension), `accroches` (petits objets posés sur le mobilier, dessinés avec l'intérieur: `id`, `modele`, `sur` (le meuble), `x`, `y`, `z` (au-dessus du sol), `regarde`, `visible_si` (liste de conditions au format de `habitants.json`, toutes vraies); le moulin à café d'Odette, sur la tablette du guichet, après le cadeau). Une pièce `a_batir` (`room_cellar`, `room_bedroom` de `pieces.json`) porte en plus `emprise` (sans le mur commun), `mur_commun`, `porte` (`cx`, `cy`, `vers`: la pièce d'où l'on entre), `site` (point du chantier), `etageres` (cellier) ou `fenetres` (chambre) |
| `ru`, `ouvrages` (tour 10) | le lit du ru (`colonnes`, `de_y`, `a_y`) et ses quatre passages (`id`, `nature`: ponceau, pont, passerelle, gué; `rect`; `modele` à poser par le rendu; `largeur_m`) |
| `camera.rues_degagees` (tour 10) | rectangles de rue que des objets donnés ne doivent pas cacher en orientation par défaut |

Lecture par le jeu: depuis le contrat du lot L0, `loadMap` lit `interieurs` (`parseBuildings` de `src/donnees/carte-interieurs.ts`: pièces, portes, apparition, heures, ambiance, mobilier, parties fermées), `ru` (`parseStream`) et `ouvrages` (`parseCrossings`), contrôlés à l'exécution; une carte sans `interieurs` (carte de secours) n'a que la maisonnette. Les `accroches` d'un intérieur ne sont pas encore lues (champ ignoré): le moulin d'Odette attend le rendu des intérieurs (lot L5) et la condition `visible_si`. Ce qui change pour le jeu, par la grille `infranchissable`: la boutique de l'épicerie est franchissable par sa porte (30, 30), son mobilier fixe et la salle à manger bloqués; la mercerie aussi (porte 74, 28). Les heures d'ouverture (portes fermées), `Character.inside` et la coupe des murs viennent des lots L0, L3 et L5. Les pièces à bâtir ne sont pas dans la grille tant qu'elles ne sont pas bâties: le lot L4 bloque leur emprise et ouvre leur pièce et leur porte (même calcul que `calculer_infranchissable(carte, pieces_baties=True)` du validateur).

Correspondance avec `GameMap` (`src/etat/carte.ts`): `ground` vient de `terrain.legende[code].sol`, `blocked` de `infranchissable.grille`, `points` de la liste des points (`x`, `y`), `zones` de la liste des zones, `house` de la clé `maison` (pièce = zone `house_interior`, porte = `maison.porte`, retour = point `house_spawn`), `garden` des cases de la zone `garden` dans l'ordre ci-dessus, `trees` des objets `tree_oak` et `tree_fir` (genre `oak` ou `fir`), `props` des autres objets (`model` = `type`, `pos` = `x`, `y`, `rect`). Le samedi de 10 h à 16 h, ajouter la zone `train_at_platform` aux cases bloquées.

## 10. Progression

La démo n'a qu'une zone; la progression se fait par les lieux qu'on découvre.

| Jour | Lieu introduit | Nouveauté | Difficulté (1 à 5) | Durée de jeu estimée |
|---|---|---|---|---|
| 1 | quai, maisonnette, épicerie | marcher, parler, porter à deux, construire | 1 | 11 min (création des personnages et scène d'arrivée comprises) |
| 2 | potager, puits | bêcher, semer, arroser | 1 | 7 min |
| 3 | lisière, scierie, poulailler | couper, scier, réparer | 1 | 7 min |
| 4 à 6 | place, tonnelle, tableau | vendre, souper chez Odette, catalogue à deux | 1 | 7 min par jour |
| 7 | cloche et banc | observer l'ombre, bêcher au bon endroit | 2 | 7 min |
| 8 | quai, remise | caisse, départ du train, suite annoncée | 1 | 7 à 8 min, fin comprise |

Durées estimées avec les hypothèses de la simulation de `demo.md` (dehors de 6 h à 19 h 30 en 4,7 min, veillée, dialogues, petit-déjeuner; 63 min au total).

Tour 10, la rue Haute (étape 1 du monde plus grand; une nouveauté par journée, conception 1.7):

| Jour | Lieu introduit | Nouveauté | Difficulté (1 à 5) | Durée de jeu estimée |
|---|---|---|---|---|
| 4 (mardi) | fournil, pont, rue de la halte jusqu'au carrefour | porter la panière à deux du fournil à la porte d'Odette (40,7 m, 11,6 s à pied, plus au pas du porter) | 1 | 15 à 20 min à 0,7 s par minute de jeu (journée doublée) |
| 5 (ou le mardi suivant) | mercerie-coiffure, rue Haute, maison de Lucie en face | entrer dans un intérieur, le fauteuil et le banc à deux | 1 | idem |
| 6 et après | gué de pierres, passerelle, banc de la berge, école au bout de la rue | raccourcis, déjeuner sur le banc, Jeanne qui rentre chez Lucie | 1 | idem |
| 23 | cellier et chambre (sites au pied de la maisonnette) | bâtir une pièce à deux | 2 | idem |

Les durées par jour viennent de la conception (section 0, annexe A); la carte n'ajoute que la marche (18 à 21,5 s de la maisonnette à la rue Haute).

## 11. Écarts avec les places indicatives de `demo.md`, et décisions

- **Bois au nord de la voie** (au lieu du coin sud-est): avec la caméra au sud-est, des grands arbres au sud-est auraient caché la scierie et le pré; au nord, ils font le fond de l'image. La scierie suit le bois, au nord-ouest.
- **Halte au bout est du quai, en ligne**: au sud du quai, elle l'aurait caché. Le quai fait 30 m (emprise des modèles) au lieu des 16 m indicatifs.
- **Épicerie à l'ouest de la place, façade à l'est**: tournée vers l'ouest comme dans les places indicatives, sa façade aurait été cachée depuis la caméra par défaut.
- **Maison de Firmin en face du quai, de l'autre côté de la voie**, et non entre la maisonnette et la halte, où passe la route du gué.
- **Potager de 12 cases (4x3)**, comme la démo et `reglages.json`; le rectangle de 6x4 du cahier et les 96 cases sont des réserves.
- **Puits** au centre de la place, à la place de la fontaine (même emprise de 2x2).
- **Lucie** n'avait pas de maison sur la carte de la démo; depuis le tour 10, sa maison est rue Haute (Jeanne y loge), Lucie restant en tournée.
- **Ballast franchissable** partout: on traverse la voie où l'on veut, sauf sous le train à quai. Les chemins montrent quand même les deux traversées.

Écarts du tour 10 avec la table 1.3 de la conception (places indicatives), et pourquoi:

- **Mercerie y 25 à 31 et maison de Lucie y 26 à 31** (au lieu de y 24 à 30 et 25 à 30): en y 24, l'égout de la mercerie cachait la rangée y 22 de la rue de la halte en orientation 0. Les deux portes restent face à face (y 28); la maison de Lucie a 6 x 6 m.
- **Rue Haute de 4 m entre façades** (chaussée x 76 et 77, trottoirs x 75 et 78): les deux portes face à face sont alors vues dans les quatre orientations; plus étroite, chaque maison cachait la porte d'en face.
- **École en deux objets**: la cour murée (x 74 à 79, portail dans l'axe de la rue) et le bâtiment à deux niveaux à côté (x 80 à 86, porte de la mairie sur la route), au lieu d'un seul bloc x 74 à 84, y 15 à 19: la cour est basse (mur de 2,2 m) et le bâtiment haut, le contrôle de la caméra doit les distinguer. Ils vont jusqu'à y 20, au bord de la route, comme le fournil.
- **Pont de 3 m sur y 21 à 23**: la largeur de la cour de la halte, qu'il prolonge; la rue de la halte fait 2 m (y 21 et 22) plus loin, à l'est de la rue Haute, devenue la route des hameaux, pavée jusqu'à l'école puis en terre.
- **Guichet du fournil en (70, 20)**, à côté de la porte (68, 20), au lieu d'une même case: une porte et un guichet ne peuvent pas être la même ouverture. `bakery_window` est dans l'embrasure, comme `grocery_counter`.
- **Ponceau sans objet posé**: la voie garde ses cases, et le ponceau, le pont, la passerelle et le gué sont décrits dans `ouvrages` (avec leur `modele`) plutôt que posés comme objets: un objet sans modèle se dessine en caisse rayée, ce qui aurait mis une caisse sur la voie et sur les tabliers. Le rendu les posera à partir de `ouvrages` (lot L5) quand l'artiste 3D les aura (lot L2).
- **Boutique d'Odette de 6 x 6 (y 26 à 31)** et salle à manger réduite à y 24 et 25 (au lieu de 5 et 3 rangées): le comptoir de la place (30, 26) doit être dans la boutique pour servir dedans et dehors.
- **Pommiers** de type `tree_apple` (décor): le validateur ne réserve plus les types chêne et sapin qu'aux arbres à couper, les seuls que le code lit comme arbres.

## 12. À aligner avec les autres membres

- **artiste-3d** (par le manager): noms des types et emprises (section 7), hauteurs au faîte retenues pour le contrôle de la caméra (halte 7 m, épicerie 8,5 m, scierie 7,5 m, maison de Firmin 6 m, maisonnette 5,5 m, remise 4,5 m, chêne 8 m, sapin 9 m), ouvertures décalées depuis la gauche de la façade vue de dehors (halte 4, maisonnette 3, épicerie porte 2 et comptoir 6, Firmin 3, scierie 5, remise 2, poulailler 1), murs d'une case autour de la pièce de 5x4 de la maisonnette. Types de décor ajoutés: `bell_post`, `notice_board`, `coop_crate`, `bench`, `arbor`, `workbench`, `log_pile`, `water_barrel`, `mailbox`, `lamp_post`, `level_crossing_gate`, `station_sign` (facultatif), `barrel`, `bush`, `rock`, `fence`, `pontoon`.
- **Développeur du jeu**: lecture du format (section 9), cases bloquées par le train le samedi, transparence des volumes qui cachent un personnage.
- **tech-artist**: l'énigme veut qu'entre 17 h et 17 h 30, par soleil, l'ombre de la cloche (poteau de 3 m) touche le banc posé 3,5 m à l'est (2 m entre le poteau et le bout du banc): le soleil doit alors venir de l'ouest.

Tour 10:

- **artiste-3d (lot L2)**: emprises, rotations, ouvertures et hauteurs de la section 7 (`bakehouse`, `school_yard`, `school_house`, `salon_shop`, `lucie_house`, `tree_apple`); toits à deux pans aux égouts et faîtages indiqués (le contrôle de la caméra en dépend: un toit plus haut doit me revenir); mobilier fixe des deux intérieurs aux cases de `interieurs[].mobilier`, adossé aux murs nord et ouest; modèles `ru_culvert`, `ru_road_bridge`, `ru_footbridge`, `ru_stepping_stones` aux rectangles de `ouvrages`; trappe à farine dans le mur nord du fournil, au droit de `bakery_back`; tilleul au milieu de la cour de l'école.
- **dev gameplay 3D, simulation (lots L0 et L3)**: lecture de `interieurs` (section 9); `habitants.json`: Jeanne rentre chez Lucie et va à l'école (`school_gate`) au lieu de `village_exit`, désormais à 70 m de la place au bout de la route des hameaux; ne pas viser une porte fermée en boucle (ADR 0016).
- **dev gameplay 3D, maison (lot L4)**: heures `grocer` et `salon` dans `reglages.json` (le validateur avertit tant qu'elles manquent); grille des pièces bâties (section 9).
- **dev gameplay 3D, rendu (lot L5)**: le ru (code `r`, sol `water`) est une eau vive de 2 cases, distincte de l'Aubrune; vérifié en jeu (captures du 2026-11-01), le rendu actuel le dessine en lit de sable avec un mince filet d'eau, qui se lit comme un chemin de terre: à dessiner en eau courante entre deux berges raides; la passerelle (sol `wood`) est déjà dessinée en tablier de planches, le pont (`stone`) en pavés; ouvrages à poser depuis `ouvrages`; les éclaircies de la forêt du pourtour (`forestClearings`, côté est, y 18 à 36) suivent maintenant le bord x 98, derrière les prés du sud-est.
- **game designer**: `fox_mousing` déplacé en (3,0 ; 16,5) le 2026-11-02 (il tombait dans la chambre), chorégraphie du renard reprise dans `moments.json` (même chemin du ballast à l'herbe, mêmes durées de phase; à relire); `tour-06-conception.md` cite encore (7,5 ; 17,0); `moments_tour7_geometrie.py` à remettre en marche (`KeyError: 'roe_deer'`).

Retouches du 2026-11-02, à aligner:

- **artiste-3d**: le perchoir de la dame blanche est maintenant `rock_03` (variante `rock_medium`, 0,50 m), en (56, 27); `rock_02` (`rock_small`) est passé en (60, 32). Le README des modèles et `faune.py` citent encore `rock_02`. Dans `interior_blocked` de `ferrand_shop`, la case [-2, -3] (carte (24, 29)) est laissée libre: bloquée, elle enferme le coin de la chaise ouest; raccourcir le rayonnage du mur ouest à x glTF -2 à 0, ou retirer la case. Le poêle est contre le mur sud, coupé pour la caméra par défaut: son tuyau ne doit pas finir dans le vide quand le mur disparaît.
- **dev gameplay 3D (simulation)**: `deliverHen` pose la poule au poulailler + (0,6 ; 0,9), en dur dans `src/simulation/catalogue.ts`: ce point tombe dans la clôture `fence_15` (16, 32). La cage est dessinée au poulailler + (-1,2 ; 0,7) (`src/rendu/vie.ts`): le même décalage dans la simulation (ou un point de carte `hen_delivery`, que je poserai) remettrait la poule dans sa cage. Odette (`grocery_counter`, 30,5 ; 26,5) se tient à 0,15 m devant le nu de la façade avancée (x 30,35), sur le perron: sa vraie place est derrière le guichet, `grocery_inside_counter` (29,5 ; 26,5), ce qui change son trajet (par la porte de la boutique); à décider avec le lot L3.
- **dev gameplay 3D (rendu)**: les `accroches` d'un intérieur (le moulin) à dessiner avec `ferrand_shop_interior`, selon `visible_si`. Le coin carré entre la route du gué et la grève, en (20, 36), vient du rendu: l'angle d'un chemin contre le sable n'est pas arrondi (il l'est contre l'herbe). La carte ne peut pas le corriger seule: les pierres du gué partent du bout de la route, une rangée au-dessus de la berge (`src/rendu/gue.test.ts`); finir la route sur la promenade casse cet alignement (essayé), l'élargir d'une case déplace seulement le coin d'un mètre (essayé, capture).

## 13. Outils et vérifications

```text
python3 games/la-petite-ligne/outils/construire_carte_halte.py   # écrit halte.json
python3 games/la-petite-ligne/outils/valider_carte.py            # contrôles, code 1 en cas d'erreur
python3 games/la-petite-ligne/outils/apercu_carte.py             # aperçus PNG (rsvg-convert)
python3 games/la-petite-ligne/outils/valider_donnees.py          # données du jeu, points de la carte compris
```

La carte se retouche dans `construire_carte_halte.py`, jamais à la main dans le JSON: la grille `infranchissable` et les rectangles des objets en dépendent, et le validateur refuse un fichier incohérent. Le validateur a été éprouvé sur quinze cartes cassées exprès (porte bloquée, point dans l'eau, chevauchement, poche isolée, point enclos, trajet trop long, lieu caché à la caméra, point attendu absent, potager occupé, treizième arbre dans la lisière, couloir de portage trop étroit, pêche loin de l'eau, trajet d'habitant bloqué, tiret long, grille périmée): les quinze défauts sont signalés.

Tour 10: quatorze défauts de plus, chacun signalé (pièce dans un mur, porte bouchée par un rocher, ru franchissable hors des passages, mobilier qui coupe une pièce en deux, pièce partagée, maison de Lucie trop haute qui cache la rue, emprise du cellier occupée, pont bloqué, site de chantier dans l'emprise de la chambre, apparition hors de la pièce, porte du cellier hors du mur commun, bâtiment visitable déplacé contre le ru, vitrine devenue franchissable, gué non déclaré); la règle de l'écart entre deux bâtiments visitables est vérifiée à part (0 case collés, 1 case, 4 cases de la mercerie à la maison de Lucie). Les identifiants numérotés des objets de l'ancienne carte (`bush_41`, `tree_oak_01`...) sont restés les mêmes: seuls les buissons de l'ancienne haie du bord est ont changé de place (x 63 vers x 99), et `bush_09` (4, 21) est passé en (2, 20).

Correction du 2026-11-02: le retrait des deux massifs de l'angle sud-ouest de la place (R22) avait décalé de deux la numérotation des buissons suivants. Le rendu dessinait donc le sureau (`bush_41`, `MODEL_BY_PROP`) en (39, 7), à 6,3 m du coin 06, au lieu de (33, 8); la liste de la lisière échange ces deux places pour le remettre au pied du coin. Avant de retirer un objet numéroté, le remplacer à sa place ou vérifier tous les identifiants qui suivent.

Retouches du 2026-11-02, contrôles ajoutés au validateur, chacun éprouvé sur une carte cassée exprès: buisson, rocher ou arbre sur un sol de passage (erreur, c'était un avertissement; sept massifs de la place étaient en faute); place de banc sans case libre et atteignable où se relever (banc du pignon dont les cases de devant sont bloquées); cueillette posée sur un hôte absent à moins de 1,6 m (`HOST_REACH` du rendu: noisetier reculé de 1 m; sureau du coin 06, en faute avant la correction); accroche d'intérieur hors de son meuble (moulin déplacé sur le sol). Le mobilier complet de l'artiste dans l'épicerie est signalé comme poche (trois cases isolées et deux morceaux de pièce).

Vérifié dans le jeu (captures Playwright du 2026-11-02, `rendu.html`): la place et ses abords, le coin de la route du gué (inchangé, voir section 12), les noisettes posées sous le noisetier du coin 02 (page `lisiere=1`).
