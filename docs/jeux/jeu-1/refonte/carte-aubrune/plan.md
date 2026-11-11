# Aubrune: le plan vu du dessus (refonte)

| Champ | Valeur |
|---|---|
| Statut | version 3: plan validé par le client le 2026-11-10 (taille, ouest allongé de 64 m, ferme sur la rive sud derrière le gué, rive du bourg ouverte dès l'acte 1), complété pour la 3D (section 12), raccordé à l'histoire écrite des actes 1 à 3 (section 13); manques de la nuit du 2026-11-11 comblés (section 15); décor des fêtes et des veillées, présent le jour de la fête seulement (section 18) |
| Date | 2026-11-10 |
| Source unique | `construire_plan.py` (composition en code), qui écrit `plan.json`, les SVG, les PNG et les tableaux marqués « généré » de ce document |
| Contrôle | `controler_plan.py` (0 erreur, dont l'ordre réel de l'histoire relu dans les fiches et rejoué sur la grille du lieu), `controler_plan.py --eprouver` (36 casses vues sur 36, dont 6 du décor des fêtes), `assembler_lieu.py` (aucun verrou contournable sur la grille); règle d'accès des intérieurs et du dehors (section 14), aussi tenue par `tests/points-de-quete.test.ts` du jeu; `controler_trouvailles.py` (0 erreur: les 19 trouvailles de berge, section 19) |
| Règle suivie | « le plan avant le volume » (CLAUDE.md): la carte 3D sera générée à partir de `plan.json`, jamais l'inverse |

Images: `plan-ensemble.png`, `zone-1-bourg.png` à `zone-7-tunnel.png`, `quetes-acte-1.png` à `quetes-acte-3.png` (SVG de même nom à côté).

## En bref

- **Version 2: 384 x 208 m** (79 872 m²). Tout ce qui est à l'est de x 44,5 a glissé de 64 m vers l'est: la tranchée de l'acte 2 fait 144 m du passage à niveau au poste (80 m en version 1), un peu plus que la ligne morte de l'acte 3 (127 m du passage des Hameaux à la cachette). Les coordonnées citées dans le texte des sections 4 à 8 sont celles de la version 1; les tableaux générés sont à jour.
- Version 1: 320 x 208 m (66 560 m²), contre 164 x 78 m en 0.13. Sept zones, 28 bâtiments, 66 points d'intérêt, 2 km de chemins.
- **Un centre et cinq rayons**: le quai et la place au centre; la voie vers l'ouest (le poste), la voie vers l'est (le tunnel), la Côte au nord, le gué et la ferme au sud, le bief et le moulin au sud-ouest. Chaque rayon a son repère visible de loin.
- **Des zones fermées par l'histoire**: 12 verrous, chacun un obstacle qu'on voit et qu'un habitant lève (un saule couché, un gué emporté, une grille de la Compagnie). Le contrôle vérifie qu'aucune zone ne s'ouvre avant son acte.
- **Deux sentiers de quête linéaires qui reviennent au centre par un raccourci**: la voie jusqu'au sémaphore (acte 2, retour par la vanne et la berge) et la ligne morte jusqu'au fond du tunnel (acte 3, retour par l'escalier de service, le belvédère et le cimetière).
- **Les quatre retours de séance du client sont traités et contrôlés par script**: le chemin de la berge suit la rivière à 8 m de son axe; toute eau a une source et un exutoire; le lavoir s'ouvre côté chemin; le bourg est une seule rue (la Grand-Route) avec la place en son milieu.
- **Le budget de 128 x 128 m par lieu ne suffit pas**: demande chiffrée à l'architecte en section 9 (une seule grille, rendu par tuiles; solution de repli en quatre lieux coupés aux verrous).

## 1. Intention

| | |
|---|---|
| Ce que le lieu enseigne | Lire un pays: une voie, une rivière, une rue, un coteau. Acte 1, tout le nécessaire est à moins de 40 m du quai. Acte 2, on apprend à suivre une ligne (les rails, puis l'eau). Acte 3, on apprend à se repérer de loin (le clocher, le Vieux Chêne, le Gros Noyer) |
| Ce qu'il met à l'épreuve | Se répartir à deux sur des rayons opposés (l'un à la ferme, l'autre au bois) et se retrouver au centre; revenir à temps par le bon raccourci |
| Émotion visée | « Il y a encore quelque chose derrière »: de la place on voit le pigeonnier par-dessus la rivière bien avant de pouvoir passer le gué; du passage à niveau on voit la voie se perdre dans les ronces; du belvédère, à la fin, on voit tout ce qu'on a rouvert |
| Difficulté | 1 sur 5 dans le bourg, 2 sur 5 sur la Côte (boucles de sentiers), 1 sur 5 sur les sentiers de quête (linéaires par construction) |

Le récit, comme un habitant le raconterait. L'Aubrune coule d'ouest en est au pied du coteau de la Côte. Le vieux village est né en haut, autour de l'église, hors des crues; la vieille route descendait au gué. Le meunier a pris l'eau en amont, à la vanne, et l'a menée par un bief jusqu'à sa roue. Puis la Compagnie a posé sa ligne entre le coteau et la rivière: une halte, un château d'eau, un passage à niveau gardé là où la vieille route coupe la voie, un poste d'aiguillage à l'entrée ouest, et à l'est une courbe qui s'enfonce sous l'éperon de la Côte, vers Combe-Veilleuse. Le bourg s'est allongé le long de la Grand-Route, parallèle à la voie. La ferme est restée de l'autre côté de l'eau, avec ses champs.

## 2. Échelle, taille, repère

- 1 case = 1 m. x vers l'est, y vers le sud, origine au coin nord-ouest: plus d'origine négative.
- Carte: 320 x 208 m. Les marges sud-ouest et est (prés lointains, bois) sont du décor non jouable.
- Reprise de l'ancien bourg: ancien (x, y) de `halte.json` = nouveau (x - 100, y - 84), à 1 ou 2 m près pour le coeur (quai, halte, place, rue Haute, église).
- Métriques: marche 1,5 m/s et course 3,2 m/s (décision du client du 2026-11-10; le cahier 4.12 disait 3 et 5), vue large de 28 m au plus. Traverser toute la carte de la version 2 (384 m) d'ouest en est prend 2 min en courant, 4 min 16 en marchant; la vue ne montre qu'un quatorzième de la largeur: d'où les repères hauts.

<!-- genere:zones:debut -->
| Zone | Ouverte à | Surface | Bâtiments | Points d’intérêt |
|---|---|---|---|---|
| Le bourg et le passage à niveau | acte 1 | 8759 m² | 23 | 25 |
| La rivière et le bief | acte 2 | 5377 m² | 0 | 6 |
| La voie jusqu'au poste d'aiguillage | acte 2 | 2081 m² | 1 | 6 |
| La Côte | acte 3 | 16551 m² | 1 | 13 |
| Le moulin | acte 3 | 828 m² | 1 | 2 |
| La ferme | acte 3 | 12715 m² | 2 | 10 |
| Le tunnel | acte 3 | 4612 m² | 0 | 6 |
| **Total jouable** | | **50923 m²** sur 79872 m² de carte (384 x 208 m) | 28 | 68 |
<!-- genere:zones:fin -->

## 3. Principes de level design appliqués

Aucune carte de jeu existant n'est imitée: ce sont des principes de métier, appliqués à un pays de voie ferrée.

| Principe | Où il est appliqué |
|---|---|
| **Un centre et des rayons** (moyeu) | Le quai et la place. Cinq rayons en partent: route du Gué (sud), Grand-Route (est), rue de l'Église (nord-est), chemin de la Lisière (nord), voie (ouest et est). Toute quête repasse par le centre, où sont la caisse, la pompe, Odette et Firmin |
| **Repères visibles de loin** (ce qui attire) | Huit repères hauts, un par direction: château d'eau (centre), clocher (nord-est), sémaphore (ouest), roue du moulin (sud-ouest), Vieux Chêne (nord), portail du tunnel (est), Gros Noyer (sud), pigeonnier de la ferme (sud, vu depuis le ponton). Le château d'eau dit toujours où est le quai |
| **Lignes de vue** | La route du Gué est droite du coteau à la ferme: du passage à niveau on voit le gué. La place est dans l'axe du ponton. La tranchée de la voie ouest cadre le sémaphore. La courbe de la ligne morte cache le tunnel jusqu'à la guérite, puis le montre d'un coup |
| **Zones fermées par l'histoire, puis ouvertes** | 12 verrous (section 5): chaque fermeture est un objet du monde, posé au bord d'une zone que l'on voit déjà. Rien n'est un mur invisible |
| **Voir avant d'atteindre** | Le pigeonnier depuis le ponton (acte 1, ferme à l'acte 3); la roue immobile depuis le chemin du Moulin; le belvédère, que l'on devine depuis la Grand-Route |
| **Boucles et raccourcis qui se débloquent** | Portillon du poste (V11, ouvert depuis le poste), escalier de service du tunnel (V10, ouvert depuis le tunnel), passerelle des Jardins (V9, posée depuis la ferme), puis la draisine sur trois arrêts (poste, halte, tunnel) |
| **Alternance d'espaces ouverts et de passages étroits** | Place (18 x 12 m) puis tranchée de la voie (3 m entre deux talus) puis prairie du poste; berge ouverte puis planches du canal de fuite puis île étroite; courbe à ciel ouvert puis tunnel puis belvédère |
| **Sentier linéaire de quête, retour par un raccourci** | Section 7: la voie jusqu'au signal, le tunnel, la piste des pas blancs, le clocher |
| **Densité d'intérêt** | Un point d'intérêt tous les 20 à 30 s de marche au plus: mesuré en section 6 |
| **Fil d'Ariane sans flèche** | On suit toujours une ligne du paysage: des rails, une berge, une rue, des traces de farine, une rangée de lampes dans le tunnel. Le suivi de quête sur demande (3 secondes) ne sert que de secours |
| **Aucune impasse gratuite** | Cinq bouts de chemin seulement, chacun avec sa raison écrite dans `plan.json` (le ponton, la vanne, le jardin, la croix de chemin, le fond du tunnel) ou un bâtiment au bout |

## 4. Les zones

Surfaces: tableau généré en section 2. Plans: un PNG par zone.

### Zone 1: le bourg et le passage à niveau (acte 1)

- **Ce qu'on y fait**: tout le quotidien. Dormir, manger, se laver (pompe de la place), potager et poulailler au jardin, vendre (Odette, Achille), outils (Basile, Mado), tenues (Solange), commande du samedi sur le quai.
- **Habitants**: Firmin (halte, maison en face du quai), Odette (épicerie-pension), Basile (atelier à la lisière), Achille (fournil), Solange et Jeanne (mercerie), Mado (forge), Ambroise (atelier au bout de la rue, loin de Firmin: ils ne se croisent pas par hasard), Honorine (dernière maison, vue sur la voie), Marthe (au pied du parvis). Acte 2: Lucie, Colette (café), Armand (école).
- **Composition**: la Grand-Route (est-ouest) porte toutes les portes, au nord contre la voie, au sud vers la rivière. La place s'ouvre en son milieu, entre le quai et le ponton. La rue de l'Église monte au parvis. Le chemin de la Berge double la Grand-Route au bord de l'eau: deux parallèles reliées par cinq traverses (route du Gué, place, chemin du Lavoir, venelle des Jardins, chemin des Jardins), donc cinq petites boucles de 1 à 2 minutes.
- **Repères**: château d'eau, clocher.
- **Liaisons**: voie ouest (V2), berge amont (V1), gué (V3), moulin (V4), Côte (V5, V6, V7), ligne morte (V8).

### Zone 2: la rivière et le bief (acte 2)

- **Ce qu'on y fait**: pêche (ponton, aval, fosse du bief, vanne), coquillages des grèves, libellules des roseaux, ricochets à la vanne, la suite de la Baronne.
- **Habitants de passage**: Achille (pêche du lundi, à la fosse), Jeanne.
- **Composition**: l'Aubrune (9 m de large) traverse toute la carte. À la vanne, un déversoir relève l'eau et le bief (3 m) part en biais vers le moulin; entre les deux, l'île du Bief, que l'on rejoint par les planches du canal de fuite et que l'on quitte par la passerelle de la vanne. Devant le bourg, la rive nord appartient à la zone 1 (on s'y promène dès l'acte 1): c'est la canne à pêche et le saule (V1) qui ouvrent la zone.
- **Repères**: la roue du moulin, vue depuis l'île.
- **Liaisons**: berge du bourg (V1), descente du poste (V11), cour du moulin (V4).

### Zone 3: la voie jusqu'au poste d'aiguillage (acte 2)

- **Ce qu'on y fait**: dégager la voie (ronces, puis frênes avec la hache améliorée), mûres, fouilles du ballast, le wagon oublié sur la voie de garage, la scène asymétrique des leviers (cabine à l'étage du poste: celui du dedans voit les étiquettes, celui du dehors voit le sémaphore et l'aiguille, à 12 m l'un de l'autre, à portée de voix).
- **Composition**: une ligne droite dans une tranchée, sans embranchement, puis la plaine du garage (le wagon oublié sur la voie de garage), puis l'étranglement du poste où les frênes sont couchés (V2b). Au bout, la clairière du poste, le sémaphore, et le portillon qui descend vers la vanne. Version 3: la plus grande part de la zone est avant les frênes, car l'histoire l'ouvre dès l'article 7 (section 13).
- **Repère**: le sémaphore.
- **Liaisons**: passage à niveau (V2), vanne (V11).

### Zone 4: la Côte (acte 3)

- **Ce qu'on y fait**: bois pour la chambre (coupe de Basile), châtaignes, champignons, myrtilles, insectes des trois prairies, fouilles (Pierre Levée, roche aux fossiles), pêche à l'étang, photo.
- **Habitants de passage**: Basile (coupe), Barnabé (bûcheron), Armand (fossiles); Inès à la maison forestière après la fin.
- **Composition**: un chemin forestier carrossable en grande boucle à l'ouest (les grumes descendent chez Basile), le sentier du Ru au milieu (il suit le ru jusqu'à l'étang et la source), le sentier des Crêtes à l'est (de l'étang au belvédère en passant derrière le cimetière). Trois entrées, donc trois boucles qui ramènent au bourg.
- **Repères**: le Vieux Chêne; le clocher, toujours visible vers le sud-est pour redescendre.
- **Liaisons**: barrière forestière (V5), raidillon du ru (V6), porte haute du cimetière (V7), belvédère (zone 7).

### Zone 5: le moulin (acte 3)

- **Ce qu'on y fait**: farine (Berthe), guet de nuit de la suite du « fantôme », insectes du pré du meunier.
- **Habitants**: Berthe; Barnabé la nuit.
- **Composition**: la cour au nord (les charrettes arrivent par le chemin du Moulin), le moulin entre la cour et le bief, la roue sur le pignon sud. Petite zone voulue: c'est un lieu de scène, pas de promenade.
- **Liaisons**: chemin du Moulin et berge (V4, deux portails de la même clôture).

### Zone 6: la ferme (acte 3)

- **Ce qu'on y fait**: graines et poules (les Delmas), champs à louer, balles de foin, ruches, noix, papillons du pré bas, photo à la croix de chemin.
- **Habitants**: Paulin, Margot, Léon.
- **Composition**: logis face au midi, grange à l'ouest, cour entre les deux; le tour de la ferme (boucle de 2 minutes par le Gros Noyer); le chemin des Champs vers l'est jusqu'à la passerelle des Jardins.
- **Repères**: Gros Noyer, pigeonnier.
- **Liaisons**: le gué (V3), la passerelle des Jardins (V9, raccourci vers le bout de la Grand-Route).

### Zone 7: le tunnel (acte 3)

- **Ce qu'on y fait**: la quête du verre de la lanterne; fouilles de la courbe avec Jeanne; photo du belvédère.
- **Composition**: la ligne morte en courbe (93 m), le portail, 34 m de tunnel éclairés par les niches, la cachette d'Émile au fond, devant un éboulis et de la brume: la voie continue, on ne passe pas (c'est par là qu'Émile est parti à pied, c'est de là que vient le 5 h 12). L'escalier de service monte de la deuxième niche au belvédère de l'Éperon.
- **Repère**: le portail du tunnel.
- **Liaisons**: passage des Hameaux (V8), escalier (V10), sentier des Crêtes.

### Intérieurs

Posés à l'écart sur la même grille ou coupés en place (ADR 0016), à trancher par l'architecte. Surfaces utiles visées:

| Intérieur | Surface | Remarque |
|---|---|---|
| Maison du garde-barrière | 85 m² au sol, étage, cave | emprise finale de 11 x 8 m dessinée dès maintenant; la ruine du début en occupe la moitié est |
| Halte | 54 m² | salle, guichet, consigne (coffre commun), bureau de Firmin |
| Épicerie-pension | 70 m² | boutique, cuisine, chambre du premier soir |
| Atelier de Basile, fournil, mercerie, forge, atelier d'Ambroise, café, école | 32 à 60 m² chacun | une pièce principale chacun |
| Église et clocher | 250 m², clocher à trois niveaux | montée linéaire de « La robe et la cloche » |
| Poste d'aiguillage | 24 m² à l'étage | scène des leviers |
| Moulin | 64 m² par niveau, deux niveaux | |
| Logis de la ferme | 54 m² | |
| Tunnel | 34 m de long, 5 m de large, trois niches | couvert: murs et voûte s'effacent comme un toit |

## 5. Verrous, bâtiments, eau

<!-- genere:verrous:debut -->
| Verrou | Où | Obstacle | Ce qui le lève |
|---|---|---|---|
| V1 (acte 2) | x 174, y 127 | le saule couché en travers du chemin de la berge | Achille le fait débiter le jour de la leçon de pêche (acte 2) |
| V2 (acte 2) | x 170, y 97.5 | les ronces de la tranchée, sur la voie | Firmin donne le but « voie dégagée » (acte 2); hache de base |
| V2b (acte 2) | x 51, y 97.5 | trois frênes couchés en travers de l'étranglement du poste, sur la ligne, trop gros pour la hache de base | hache améliorée par Mado (acte 2): on bute, on revient avec l'outil |
| V3 (acte 3) | x 182.5, y 135 | le gué emporté par la dernière crue (trois dalles manquent) | Paulin Delmas remet les dalles en arrivant par le train (acte 3) |
| V4 (acte 3) | x 144, y 110 | le portail de la cour du moulin, cadenassé, et le portillon de la berge | Berthe arrive avec la clé (acte 3) |
| V5 (acte 3) | x 182.5, y 83 | la barrière forestière de Basile (« coupe en cours ») | Basile vous envoie au bois pour la chambre (acte 3) |
| V6 (acte 3) | x 220, y 79 | le raidillon du ru, raviné | Basile y pose trois rondins en marches (acte 3) |
| V7 (acte 3) | x 281, y 63.5 | la porte haute du cimetière, fermée à clé | Marthe prête la clé (acte 3, la coutume) |
| V8 (acte 3) | x 298, y 97.5 | la grille de la Compagnie en travers de la voie (« Ligne fermée ») | Firmin sort enfin la clé avec la lettre (acte 3); Jeanne connaît un trou, trop petit pour vous |
| V9 (acte 3, raccourci) | x 316, y 142.8 | la passerelle des Jardins, sans tablier | les planches viennent de la ferme: raccourci ouvert depuis la rive sud (acte 3) |
| V10 (acte 3, raccourci) | x 356, y 30 | l'escalier de service du tunnel, verrouillé de l'intérieur | on tire le verrou depuis le tunnel: raccourci vers le belvédère (acte 3) |
| V11 (acte 2, raccourci) | x 31.2, y 104.5 | le portillon du poste, fermé d'un loquet côté voie | on l'ouvre depuis le poste: raccourci vers la vanne et le retour par la berge (acte 2) |
<!-- genere:verrous:fin -->

Les obstacles et ce qui les lève sont des propositions au game-designer: le plan n'a besoin que de leur place et de leur acte.

<!-- genere:batiments:debut -->
| Bâtiment | Emprise | Qui | Porte | Pourquoi là, pourquoi dans ce sens |
|---|---|---|---|---|
| le quai | 27 x 4 m | tous | (pas de porte: plateforme) | le coeur: le train s'arrête là, la caisse de la commande, le tableau, la cloche et la pendule y sont; 27 m: il s'arrête à 3 m de la halte, où passe la traversée de service |
| la halte | 10 x 6 m | Firmin (bureau), consigne | sud | au bout est du quai, en ligne avec lui; porte au sud, sur la Grand-Route, là où arrivent les voyageurs à pied |
| la maison du garde-barrière | 11 x 8 m | les deux joueurs | est | au passage à niveau; porte à l'est, vers la route: le garde sort et il est à sa barrière en dix pas. Emprise de la maison finie (88 m²), la ruine du début n'en occupe que la moitié est |
| l'épicerie-pension Ferrand | 8 x 10 m | Odette | est | borde la place à l'ouest, vitrine et porte vers la place: on la voit en descendant du quai |
| l'atelier de Basile | 10 x 8 m | Basile | est | contre le bois, au départ du chemin forestier: les grumes descendent et s'arrêtent là; porte et auvent à l'est, vers le chemin |
| la maison de Firmin | 7 x 6 m | Firmin | sud | en face du quai, de l'autre côté de la voie: il traverse par la traversée de service |
| la remise de la draisine | 6 x 5 m | draisine | ouest | sur sa courte voie, porte à l'ouest dans l'axe des rails: la draisine sort droit sur la ligne (déplacée: l'ancienne avait sa porte au sud, sans rail devant) |
| le fournil d'Achille | 7 x 6 m | Achille | sud | sur la Grand-Route juste après le pont du ru: l'eau du pétrin est à sa porte |
| la mercerie-coiffure | 7 x 7 m | Solange, Jeanne | nord | en face du fournil; porte au nord, sur la rue |
| l'école-mairie | 7 x 6 m | Armand (acte 2) | sud | au milieu du bourg, sa cour à l'ouest, entre le fournil et le café |
| la maison de Lucie | 6 x 6 m | Lucie (acte 2) | nord | en face de l'école, porte au nord sur la rue; la boîte aux lettres du bourg est à sa grille |
| le café de la Halte | 7 x 6 m | Colette (acte 2) | sud | au carrefour de l'Église, terrasse et jeu de quilles au sud, côté soleil |
| la forge | 6 x 6 m | Mado, Barnabé (acte 3) | sud | sur la Grand-Route, où passent les charrettes, à l'écart des maisons pour le bruit et le feu |
| l'atelier d'Ambroise | 7 x 6 m | Ambroise | sud | ancienne menuiserie de la carte 0.13, reprise pour l'ancien régleur: à l'autre bout de la rue par rapport à la halte, il ne croise pas Firmin |
| la maison d'Honorine | 6 x 6 m | Honorine | sud | dernière maison avant le passage des Hameaux: de sa fenêtre elle voit la voie, c'est le témoin de la nuit de la fermeture |
| la maison aux volets clos | 6 x 6 m | réserve (Nour, après la fin) | sud | une maison vide donne un habitant à accueillir plus tard |
| la maison du bout | 6 x 6 m | réserve (suite des lettres) | nord | destinataire d'une lettre en retard |
| l'église Saint-Aubin | 21 x 12 m | Marthe (clocher) | sud | sur le coteau, hors des crues, au bout de la rue de l'Église; portail au sud, sur le parvis; le clocher est à l'ouest de la nef |
| le presbytère | 7 x 7 m | Martial (après la fin) | est | contre l'église, porte à l'est sur le parvis |
| la maison de Marthe | 6 x 6 m | Marthe | est | maison de la sonneuse, au pied du parvis, porte à l'est sur la rue de l'Église |
| la maison de cheminot (ouest) | 6 x 6 m | réserve (Inès, après la fin) | nord | logements de la Compagnie près du passage à niveau; portes au nord, sur le chemin du Moulin |
| la maison de cheminot (est) | 6 x 6 m | Barnabé avant son mariage: grenier (fanfare) | nord | voisine de la précédente |
| le lavoir | 5 x 4 m | tous (Armand et ses grenouilles) | ouest | sur une dérivation du ru (eau claire), entre la halte, la place et la berge. Ouvert à l'OUEST, côté chemin: on y entre à pied sec; le bassin est côté ru. L'ancien s'ouvrait sur la rivière et n'était pas accessible |
| le poste d'aiguillage | 6 x 4 m | personne (scène des leviers) | nord | au droit de l'aiguille de la voie de garage; porte au nord, face à la voie, cabine vitrée à l'étage d'où l'on voit le signal |
| le moulin de la Vanne | 8 x 8 m | Berthe (acte 3) | nord | au bout du bief; la roue est sur le pignon sud, dans le bief; la porte au nord, sur la cour où s'arrêtent les charrettes |
| le logis de la ferme Delmas | 9 x 6 m | Paulin, Margot, Léon (acte 3) | sud | sur la rive sud, hors du bourg, façade et porte au midi sur la cour (déplacée: l'ancienne ferme était serrée entre la route et la rivière, sans champs à elle) |
| la grange | 8 x 10 m | les Delmas | est | ferme la cour à l'ouest (vents de pluie), porte charretière à l'est sur la cour |
| la maison forestière | 6 x 6 m | réserve (Inès, après la fin) | est | au bout carrossable du chemin forestier, porte à l'est sur le chemin |
<!-- genere:batiments:fin -->

Eau: quatre règles tenues par le contrôle. Toute eau courante part du bord de la carte, d'une source ou d'une autre eau, et finit au bord ou dans une autre eau. Tout plan d'eau est traversé par un cours d'eau (l'étang est une retenue du ru, avec sa digue et sa bonde). Tout chemin qui passe l'eau le fait sur un ouvrage nommé (pont, passerelle, planches, gué, digue). Le ru passe sous la voie par un ponceau. Les raisons de chaque eau et de chaque ouvrage sont dans `plan.json` (champs `raison`).

## 6. Distances et densité d'intérêt

Dijkstra sur le graphe des chemins, tous verrous ouverts. Temps: distance divisée par 1,5 m/s (marche) et 3,2 m/s (course), les vitesses décidées par le client le 2026-11-10 (avant: 3 et 5 m/s; les temps ont presque doublé, les distances n'ont pas bougé).

<!-- genere:distances:debut -->
| De | À | Distance | Marche (1,5 m/s) | Course (3,2 m/s) |
|---|---|---|---|---|
| le quai | la maison | 34 m | 23 s | 11 s |
| le quai | la place (pompe) | 14 m | 9 s | 4 s |
| le quai | l'épicerie | 20 m | 13 s | 6 s |
| le quai | l'atelier de Basile | 36 m | 24 s | 11 s |
| le quai | le fournil et la mercerie | 36 m | 24 s | 11 s |
| le quai | le carrefour de l'Église (café, forge) | 61 m | 41 s | 19 s |
| le quai | l'église | 75 m | 50 s | 23 s |
| le quai | le lavoir | 28 m | 19 s | 9 s |
| le quai | le ponton | 27 m | 18 s | 8 s |
| le quai | le gué (rive nord) | 45 m | 30 s | 14 s |
| le quai | l'arrêt du car | 116 m | 1 min 17 | 36 s |
| le quai | la fosse du bief | 97 m | 1 min 05 | 30 s |
| le quai | la vanne | 207 m | 2 min 18 | 1 min 05 |
| le quai | le poste d'aiguillage | 170 m | 1 min 53 | 53 s |
| le quai | le moulin | 73 m | 49 s | 23 s |
| le quai | la ferme | 86 m | 57 s | 27 s |
| le quai | le Gros Noyer | 112 m | 1 min 15 | 35 s |
| le quai | la clairière du Vieux Chêne | 74 m | 49 s | 23 s |
| le quai | l'étang | 73 m | 49 s | 23 s |
| le quai | la source | 103 m | 1 min 09 | 32 s |
| le quai | le belvédère | 191 m | 2 min 07 | 1 min 00 |
| le quai | le portail du tunnel | 184 m | 2 min 03 | 58 s |
| le quai | la cachette d'Émile | 218 m | 2 min 25 | 1 min 08 |
| la maison | l'épicerie | 44 m | 29 s | 14 s |
| la maison | le fournil et la mercerie | 58 m | 39 s | 18 s |
| la maison | le carrefour de l'Église (café, forge) | 84 m | 56 s | 26 s |
| la maison | le poste d'aiguillage | 162 m | 1 min 48 | 51 s |
| la maison | le moulin | 53 m | 35 s | 17 s |
| la maison | la ferme | 53 m | 35 s | 17 s |
| la maison | l'étang | 105 m | 1 min 10 | 33 s |
| la maison | la cachette d'Émile | 252 m | 2 min 48 | 1 min 19 |
| le poste d'aiguillage | le moulin | 188 m | 2 min 05 | 59 s |
| le moulin | la ferme | 97 m | 1 min 05 | 30 s |
| la ferme | l'arrêt du car | 162 m | 1 min 48 | 51 s |
| le belvédère | l'église | 116 m | 1 min 17 | 36 s |
| l'étang | l'église | 108 m | 1 min 12 | 34 s |
| la clairière du Vieux Chêne | l'atelier de Basile | 38 m | 25 s | 12 s |
| le passage à niveau | le poste d'aiguillage | 144 m | 1 min 36 | 45 s |
| le passage des Hameaux | la cachette d'Émile | 127 m | 1 min 25 | 40 s |
<!-- genere:distances:fin -->

Densité d'intérêt (plafond visé: jamais plus de 25 s de marche sans rien à faire, soit 37,5 m à 1,5 m/s; c'était 75 m à 3 m/s, et le contrôle tire maintenant le plafond de la vitesse du plan):

<!-- genere:densite:debut -->
- Réseau de chemins: 2141 m; 96 points d’intérêt et bâtiments, soit un tous les 22,3 m de chemin en moyenne.
- Distance moyenne, depuis un point quelconque du réseau, au point d’intérêt le plus proche: 6,9 m (5 s à la marche).
- Pire cas: 28,0 m (19 s à la marche, 9 s à la course), sur le tronçon trav - pne.
<!-- genere:densite:fin -->

## 7. Les sentiers de quête

<!-- genere:quetes:debut -->
| Sentier | Forme | Aller | Retour | Total à la marche | Total à la course |
|---|---|---|---|---|---|
| Acte 1, « Logement fourni »: le tour du propriétaire | étoile autour de la place | 336 m | sur place | 3 min 44 | 1 min 45 |
| Acte 2, « La minute d’écart »: la voie jusqu’au signal | sentier linéaire, retour en boucle | 191 m | 212 m | 4 min 29 | 2 min 06 |
| Acte 2: la pendule et la leçon de pêche | deux allers courts depuis le centre | 270 m | sur place | 3 min 00 | 1 min 25 |
| Acte 3, « Ceux qui partent »: le verre de la lanterne | sentier linéaire, retour par le haut | 253 m | 252 m | 5 min 37 | 2 min 38 |
| Suite « Le fantôme du moulin »: les pas blancs | piste de traces, linéaire | 220 m | sur place | 2 min 26 | 1 min 09 |
| Suite « Les lettres en retard »: la ligne de la draisine | raccourci sur rail | 340 m | sur place | 3 min 47 | 1 min 46 |
<!-- genere:quetes:fin -->

Ces durées sont du déplacement pur; les obstacles, scènes et activités s'y ajoutent.

### Acte 1, « Logement fourni »: une étoile, pas une ligne (`quetes-acte-1.png`)

L'acte apprend le centre. Du banc du quai, chaque étape se voit depuis la précédente: la halte au bout du quai, la maison au passage à niveau, l'enseigne d'Odette sur la place, la pompe au milieu, l'auvent de Basile de l'autre côté de la barrière, la lisière derrière le château d'eau, le fournil après le pont. Rien n'est à plus de 40 m du quai. **Sans flèche**: les habitants montrent du doigt le lieu suivant, qui est en vue.

### Acte 2, « La minute d'écart »: la voie jusqu'au signal (`quetes-acte-2.png`)

- **Départ**: Firmin, à la halte. **Étapes**: le passage à niveau; les ronces (V2); le wagon oublié; les frênes couchés (V2b), qui renvoient chez Mado pour la hache améliorée: on bute, on revient avec l'outil, la moitié du chemin est déjà connue. **Point culminant**: le poste, la scène des leviers, le sémaphore qui s'incline.
- **Retour par raccourci**: le portillon (V11), la descente à la fontaine des cheminots, la passerelle de la vanne, l'île, la fosse du bief (où Achille donnera la leçon de pêche), les planches, la berge, le gué, la maison. On revient par l'eau après être parti par le fer.
- **Sans flèche**: deux talus et deux rails à l'aller; au retour le sentier descend toujours et suit l'eau vers l'aval; la roue du moulin puis le château d'eau sont en vue.
- **Version 2**: 144 m de voie entre le passage à niveau et le poste (oui du client à la question 2). La tranchée fait 6 m de large entre deux talus hors jeu.
- **Version 3** (ordre des fiches): ronces (V2), tranchée et mûres (`tw2`), plaine du garage et wagon (`tw3`), puis les frênes (V2b) en travers d'un étranglement de 6,5 m à 12 m du poste: on les voit depuis le wagon, on revient avec la hache forgée, et toute la voie est déjà connue.
- La pendule et la confidence d'Honorine se jouent sur la Grand-Route, d'un bout à l'autre: Ambroise et Honorine sont à l'est exprès, pour faire traverser le bourg rouvert.

### Acte 3, « Ceux qui partent »: le verre de la lanterne (`quetes-acte-3.png`)

- **Départ**: la cave de la maison. **Étapes**: Jeanne au passage des Hameaux; la grille de la Compagnie (V8); la guérite du cantonnier; les fouilles de la courbe; le portail; la première niche. **Point culminant**: la cachette d'Émile au fond du tunnel, puis, en haut de l'escalier, le belvédère: tout Aubrune sous les yeux, la barrière et le quai en bas.
- **Retour par raccourci**: escalier de service (V10), sentier des Crêtes, porte haute du cimetière (V7, que Marthe a ouverte), le parvis (Marthe et la cloche), la rue de l'Église, la forge (Mado sertit le verre), la barrière. Le retour passe devant chaque personne dont la quête a besoin.
- **Sans flèche**: une voie en courbe sans embranchement; une lampe par niche dans le tunnel; en haut, le clocher droit devant.
- La nuit du dénouement se joue au centre: l'un à la barrière, l'autre à la lanterne, à 20 m l'un de l'autre, tous deux en vue de la voie.

### Suites secondaires

| Suite | Trajet | Forme |
|---|---|---|
| La Baronne | fournil, berge, saule, île, fosse du bief; variantes à la vanne (niveau du bief) et au ponton | aller et retour court sur le sentier de l'Île, déjà appris à l'acte 2 |
| Le « fantôme » du moulin | ferme (Léon), gué, cour du moulin (guet), puis la piste des pas blancs: portail, chemin du Moulin, Grand-Route, arrière de la forge | linéaire, 218 m; la piste finit au centre, pas de retour à faire |
| La robe et la cloche | parvis, nef, trois niveaux du clocher; la robe et la vue en haut | linéaire en hauteur; retour par l'échelle du sonneur, qui redescend d'un trait |
| Les lettres en retard | six portes le long de la Grand-Route et de la rue de l'Église (boîte de Lucie, Basile, Marthe, la maison du bout), puis la remise | en étoile; débloque la draisine: poste, halte, tunnel, 277 m en 35 s à 8 m/s (vitesse à fixer par le game-designer) |
| La fanfare | grenier de la maison de cheminot, forge, fosse du bief, wagon oublié; Armand au lavoir | en étoile autour du centre; le lavoir est à 12 m de la halte, on y entend le train |
| La guerre de la soupe | épicerie et café (70 m l'une de l'autre sur la Grand-Route), jardins de la Rive, ferme, Côte pour les champignons | en étoile; les guets de nuit se font sur la place |

## 8. Ce que l'ancien `halte.json` permet de reprendre

**Tel quel** (mêmes emprises, mêmes orientations, translation de +100, +84 à 1 ou 2 m près): le quai (30 x 4) et son mobilier (caisse, tableau, cloche, banc); la halte (10 x 6, porte au sud); l'épicerie-pension (8 x 10, façade sur la place) et sa tonnelle; la place et son puits (qui devient la pompe); l'atelier de Basile (10 x 8) et son établi; la maison de Firmin; le fournil, la cour et l'école, la mercerie, la maison de Lucie, le café et ses quilles, la forge et son enclume; l'église, le parvis, le presbytère, le cimetière (murs, grilles, tombes), la maison du sacristain (pour Marthe); les trois maisons du hameau (Honorine, volets clos, maison du bout); le passage à niveau gardé et ses lisses; la traversée de service; le passage de l'Église; le ru et ses trois ouvrages (ponceau, pont, passerelle); le gué dans l'axe de la route; les jardins de la Rive; tous les modèles 3D de ces types; les intérieurs déjà faits (boutique, mercerie, église, café, forge).

**À déplacer ou à retourner**:

| Élément | Avant | Maintenant | Pourquoi |
|---|---|---|---|
| Maison du garde-barrière | 7 x 6, porte au sud | 11 x 8 (maison finie), porte à l'est | un garde sort vers sa barrière; l'emprise finale est réservée dès le plan |
| Potager, poulailler | devant la porte sud | jardin au sud de la maison, au bout d'une allée | suivent la porte |
| Remise de la draisine | porte au sud, sans rail | porte à l'ouest, sur un bout de voie relié à la ligne | une draisine sort sur des rails |
| Lavoir | au bord de l'Aubrune, ouvert vers l'eau | sur une dérivation du ru, ouvert à l'ouest sur le chemin du Lavoir | retour du client; un lavoir veut de l'eau claire et une entrée à pied sec |
| Moulin et sa roue | à 20 m de la maisonnette, bief très court | 13 m plus à l'ouest, au bout d'un bief de 60 m pris à la vanne | le bief a une prise, une chute et un canal de fuite |
| Maisons de cheminots | au nord du chemin | au sud du chemin du Moulin, portes au nord | libèrent la tranchée de la voie |
| Ferme (logis, grange) | entre la route des hameaux et la rivière | rive sud, au bout du gué | une ferme a ses champs autour d'elle; donne un rayon sud au plan |
| Menuiserie | atelier de menuisier | atelier d'Ambroise | Basile a déjà son atelier à la lisière |
| L'Aubrune et son chemin | rivière droite, anses carrées répétées à intervalles réguliers, chemin droit | rivière en courbes, 10 m plus au sud devant le bourg; chemin retracé à 8 m de l'axe de l'eau | retour du client: le chemin suit la berge |
| Ponton | 4 m à l'est | dans l'axe de la place | on le voit depuis la pompe |
| Mare du bois | plan d'eau fermé | étang sur le ru, avec digue et bonde | retour du client: plus d'eau sans source |
| Source, clairière, coupe, maison forestière, belvédère | bois de 30 m de profondeur | Côte de 90 m de profondeur | le bois devient une zone d'acte 3 |
| Passage de la ferme | menait aux champs du Haut | passage des Hameaux, accès à la ligne morte | la ferme a changé de rive |

**À abandonner**: la grille de caractères écrite comme source (`terrain.lignes`: le plan devient la source, la grille sera générée); l'origine négative (`taille.origine`); les règles de caméra fixe (`camera.regle`, `rues_degagees`: la caméra est libre); l'ancien lavoir; le chemin droit du bord de l'eau; les parcelles de la 0.13 (friche, potager collectif, champs du Haut: remplacés par le potager de 6, 12, 24 cases et les champs de la ferme); la vigne du curé et le parc à grumes; les 53 trajets d'habitants et leurs plannings (à refaire sur le graphe du plan); les 266 points et 39 zones (identifiants à reprendre au cas par cas quand la refonte en a l'usage); le semis d'arbres et de buissons posé à la main (à resemer par règles depuis le plan).

## 9. Demande à l'architecte: le budget par lieu

Le budget de `technique.md` 3.10 (128 x 128 m, 16 384 cases) est 4,1 fois trop court pour ce plan (66 560 cases, dont 56 571 dans les sept zones).

| | Option A (recommandée): une grille, rendu par tuiles | Option B (repli): quatre lieux chargés séparément |
|---|---|---|
| Principe | une seule simulation sur 320 x 208; le rendu ne garde que les tuiles proches | Bourg et aval (172 x 80), Ouest: voie, bief, moulin (118 x 78), Côte et tunnel (280 x 112, à recouper en deux), Ferme (210 x 82) |
| Rendu | tuiles de 32 m: 10 x 7 = 70 tuiles; avec une vue de 28 m, 9 tuiles au plus à l'écran: le budget de triangles par vue ne change pas | inchangé |
| Chemins | A* mesuré à 1 ms pour 100 m; trajets jusqu'à 350 m: router les habitants sur le graphe du plan (115 noeuds, 135 arêtes), A* local sur 64 m au plus | inchangé (lieux de 128 m) |
| Réseau, sauvegarde | l'état dépend du nombre d'objets, pas de la surface: à mesurer; habitants hors de 60 m des joueurs simulés à gros grain | un lieu actif à la fois: les deux joueurs doivent changer ensemble, ou il faut deux lieux actifs |
| Ressenti | continu: on voit le pigeonnier depuis le ponton | fondu de 1 à 2 s à chaque couture; les vues d'une zone sur l'autre sont du décor |
| Risque | nouveau code de tuiles et de simulation à gros grain | casse la règle « un seul lieu actif » dès que les deux joueurs se séparent, ce que le plan encourage |

Les coutures de l'option B tombent sur des verrous existants (V1, V2, V3, V5 à V8): le plan permet les deux. Mémoire de la grille pour l'option A: 66 560 cases, négligeable. Poids des assets: mêmes modèles que la 0.13 plus le poste, la guérite, le portail et le château d'eau.

## 10. Outils

- `python3 -I construire_plan.py`: écrit `plan.json`, 11 SVG, 11 PNG et les tableaux de ce document. Ne jamais retoucher ces sorties à la main.
- `python3 -I controler_plan.py`: bâtiments (emprises, porte sur un mur, porte tournée vers son chemin à 10 m au plus, chemin relié au quai), eau (source, exutoire, plan d'eau alimenté, ponceau sous la voie), chemins (ouvrage à chaque franchissement d'eau ou de voie, aucun bâtiment traversé, aucun croisement sans carrefour, aucune impasse sans raison), zones (chaque noeud s'ouvre à l'acte de sa zone, ni avant ni après), densité, quêtes (étapes reliées à l'acte dit, longueurs recalculées, retour distinct de l'aller), distances de `plan.json` et de ce document recalculées.
- `python3 -I controler_plan.py --eprouver`: casse une copie du plan de 21 façons (dont les quatre retours du client, un ordre de verrous faux, des frênes trop courts, un belvédère sans antichambre) et vérifie que chaque casse est vue.
- Version 3: `controler_plan.py` relit aussi les fiches de quêtes et de scènes du lieu et rejoue chaque ordre possible de l'histoire sur `carte.json` (section 13); il faut donc lancer avant lui l'outil du paquet puis l'assembleur. L'assembleur écrit en plus `peche-lieu.json` (proposition du champ `fishing`) et met les fichiers du lieu en forme avec prettier.
- Ajouter un lieu: copier `construire_plan.py`, remplacer les listes (zones, eaux, noeuds, arêtes, bâtiments, points, quêtes); le contrôle et le dessin ne changent pas.

## 11. Hypothèses et questions

Hypothèses à faire confirmer par le game-designer: le train du samedi vient de l'ouest (Hautefonte) et le tunnel mène à l'est vers Combe-Veilleuse; Émile est parti à pied par le tunnel; Ambroise loge dans l'ancienne menuiserie, Honorine au bout de la Grand-Route, Marthe au pied du parvis, Barnabé chez Mado; les obstacles des verrous; la vitesse de la draisine.

Questions pour le client, dans le compte rendu du level-designer.

## 12. Version 2: ce qu'il faut pour la 3D

Tout ce qui suit est écrit par `construire_plan.py` dans `plan.json` (champs `bordures`, `habillages`, `sols`, `mobilier`, `vegetation`, `arbres`, `ressources`, `points_nommes`, `interieurs`, `gabarit` de chaque bâtiment; `objet`, `modele`, `pas_encore` de chaque verrou), puis passé dans le lieu par deux étapes:

1. `node games/la-petite-ligne-2/outils/plan-vers-lieu.ts docs/jeux/jeu-1/refonte/carte-aubrune/plan.json <brute.json>`: grille, collisions, zones, verrous, graphe;
2. `python3 -I docs/jeux/jeu-1/refonte/carte-aubrune/assembler_lieu.py <brute.json>`: écrit `donnees/lieux/aubrune/carte.json`, `climat.json`, `interieurs/*.json` (et `lieu.json` s'il manque): sols détaillés (codes ajoutés au bout de la légende de l'outil, les 14 premiers ne bougent pas), meubles dont le type existe déjà, points nommés, portes par paires, nœuds de portes et d'intérieurs dans le graphe. Il prouve ensuite, verrou par verrou, qu'aucun nœud que le graphe dit fermé n'est atteint en marchant sur la grille, et liste les modèles à créer.

Le format reste `version: 1` pour l'outil du paquet (son schéma l'exige); la révision du contenu est `revision: 2`.

### Corrections de la version 2

- La vanne (`vn`) est sur la berge nord du bief (x 26, y 142,5), à 3,4 m de l'eau: plus aucun nœud sur une case pleine.
- V2b se tient dans une tranchée de 6 m entre deux talus hors jeu, V11 dans une descente de 4 m entre deux haies, V10 dans l'escalier de service (le rocher de l'éperon est hors jeu: le belvédère ne touche plus le tunnel), et la courbe de la ligne morte est séparée de la Côte par un talus. Le contrôle mesure la largeur du passage au droit de chaque verrou interne à une zone (7 m au plus); l'assembleur le prouve sur la grille.
- Le ponton de l'acte 1 ne mord plus sur la zone de l'acte 2: la zone du bourg l'englobe (encoche de 5 x 2,5 m sur l'eau).
- Château d'eau, pigeonnier et Gros Noyer ne sont plus posés sur un chemin.
- Images: légende élargie, étiquettes de verrou à la largeur du texte, pastilles décalées quand elles couvriraient un numéro de bâtiment, lisières et hors-jeu dessinés.

### Verrous: l'objet qu'on voit et la phrase « pas encore »

<!-- genere:verrous_v2:debut -->
| Verrou | Objet posé | Modèle | Phrase « pas encore » |
|---|---|---|---|
| V1 | arbre couché | `willow-fallen` | Le vieux saule barre le chemin. Pas encore: il faudra une scie, et quelqu'un qui sait par où couper. |
| V2 | ronces | `brambles-wall` | Les ronces ont avalé la voie. Pas encore: Firmin a dit d'attendre son signal. |
| V2b | arbres couchés | `ash-trunks-fallen` | Trois frênes en travers des rails, d'un talus à l'autre. Pas encore: ta hache rebondit sur l'écorce. |
| V3 | dalles manquantes | `ford-stones-missing` | Trois dalles du gué ont filé avec la crue. Pas encore: l'eau est trop vive pour sauter. |
| V4 | portail cadenassé | `gate-padlocked` | Le portail du moulin est cadenassé. Pas encore: la clé est partie avec le meunier. |
| V5 | barrière forestière | `forest-barrier` | « Coupe en cours, défense d'entrer. » Pas encore: Basile t'emmènera quand ce sera le moment. |
| V6 | éboulis | `gully-washout` | Le raidillon s'est raviné, la terre s'effrite sous ton pied. Pas encore: il faudrait des marches. |
| V7 | grille fermée | `cemetery-gate-locked` | La porte haute du cimetière est fermée à clé. Pas encore: c'est Marthe qui a la clé. |
| V8 | grille | `company-gate` | « Ligne fermée. Compagnie des chemins de fer. » Pas encore: la grille ne bouge pas d'un pouce. |
| V9 | passerelle sans tablier | `footbridge-bare` | Il ne reste que les poutres de la passerelle. Pas encore: il manque les planches. |
| V10 | chaîne | `stair-door-chained` | La porte de l'escalier est fermée d'une chaîne, de l'autre côté. Pas encore: elle s'ouvre d'en bas. |
| V11 | portillon au loquet | `wicket-latched` | Le portillon est fermé d'un loquet, côté voie. Pas encore: il s'ouvre depuis le poste. |
<!-- genere:verrous_v2:fin -->

### Lisières

Chaque côté de chaque zone est découpé par voisin (autre zone, hors jeu, bord de carte) et reçoit un habillage: haie, talus, clôture, rivière, bois dense ou muret (`bordures` et `habillages` de `plan.json`, dessinés sur les plans de zone). Le contrôle refuse un contour non couvert ou un habillage hors de cette liste: aucune lisière n'est un mur nu.

### Sols

Par zone: bourg en herbe rase, rivière en prairie humide, voie en friche (ballast sur les rails), Côte en sous-bois, moulin et ferme en pré, tunnel en friche rocheuse. Par chemin: route empierrée, rue pavée, chemin de terre, sentier de terre tassée. Par parcelle et par rectangle: place et parvis pavés, cours en terre battue, potagers en terre de jardin, champs en labour, lande, prairies, galets des grèves, vase de l'étang, gravier du quai.

### Gabarits des bâtiments

Une entrée de `assets-src/decors/gabarits.toml` par bâtiment, façades dans le repère du monde (le modèle se pose en rotation 0).

<!-- genere:gabarits:debut -->
| Bâtiment | Gabarit de base | Largeur x profondeur | Étages | Toit | Porte (façade, position) | Couleurs ou note |
|---|---|---|---|---|---|---|
| le quai | `quai` | 27 x 4 m | (modèle) | (modèle) | (aucune) | plateforme de 0,55 m, bordure de pierre côté voie, pas de toit |
| la halte | `batiments/halte.json` | 10 x 6 m | 1 | croupe | sud 0.50 | murs pierre_claire, toit lauze, menuiseries rouge_cheminot, volets rouge_cheminot, porte rouge_cheminot |
| la maison du garde-barrière | `batiments/maison.json` | 11 x 8 m | 2 | deux-pans | est 0.50 | murs enduit, toit tuile, menuiseries creme, volets sauge, porte sauge |
| l'épicerie-pension Ferrand | `batiments/epicerie.json` | 8 x 10 m | 2 | croupe | est 0.50 | murs enduit_ocre, toit lauze, volets vert_sombre, porte vert_sombre, menuiseries vert_sombre, enseigne vert_sombre |
| l'atelier de Basile | `batiments/scierie.json` | 10 x 8 m | 1 | deux-pans | est 0.50 | murs bois_brut, toit lauze, menuiseries bois_sombre, porte bois_sombre |
| la maison de Firmin | `batiments/firmin.json` | 7 x 6 m | 2 | deux-pans | sud 0.50 | murs pierre, toit tuile, volets rouge_cheminot, porte rouge_cheminot |
| la remise de la draisine | `batiments/remise.json` | 6 x 5 m | (modèle) | (modèle) | ouest 0.50 | porte charretière de 3 m dans l'axe des rails |
| le fournil d'Achille | `batiments/fournil.json` | 7 x 6 m | 2 | deux-pans | sud 0.50 | murs enduit, toit tuile, menuiseries miel, porte miel, enseigne bois_sombre |
| la mercerie-coiffure | `batiments/mercerie.json` | 7 x 7 m | 2 | deux-pans | nord 0.50 | murs enduit_rose, toit tuile, menuiseries creme, volets fleur_rose, porte creme |
| l'école-mairie | `batiments/ecole.json` | 7 x 6 m | 2 | croupe | sud 0.50 | murs pierre_claire, toit lauze, volets bleu, porte bleu |
| la maison de Lucie | `batiments/lucie.json` | 6 x 6 m | 2 | (modèle) | nord 0.50 | murs enduit, toit tuile, volets bleu, porte bleu |
| le café de la Halte | `batiments/cafe.json` | 7 x 6 m | 2 | deux-pans | sud 0.50 | murs enduit_ocre, toit tuile, menuiseries rouge_cheminot, porte rouge_cheminot, enseigne rouge_cheminot |
| la forge | `batiments/forge.json` | 6 x 6 m | 1 | deux-pans | sud 0.50 | murs pierre, toit lauze, porte bois_sombre |
| l'atelier d'Ambroise | `batiments/horloger.json` | 7 x 6 m | 2 | (modèle) | sud 0.50 | murs pierre_claire, toit tuile, menuiseries bois_sombre, enseigne laiton |
| la maison d'Honorine | `batiments/honorine.json` | 6 x 6 m | 2 | (modèle) | sud 0.50 | murs enduit_rose, toit tuile, volets sauge, porte sauge |
| la maison aux volets clos | `batiments/hameau-b.json` | 6 x 6 m | 2 | (modèle) | sud 0.50 | murs enduit, toit tuile, volets bois_gris, porte bois_gris |
| la maison du bout | `batiments/hameau-c.json` | 6 x 6 m | 1 | (modèle) | nord 0.50 | murs pierre, toit lauze, volets rouge_cheminot, porte rouge_cheminot |
| l'église Saint-Aubin | `eglise` | 21 x 12 m | (modèle) | (modèle) | sud 0.50 | modèle à part: nef de 21 x 12 m, clocher carré de 6 m à l'ouest (22 m de haut), portail au sud |
| le presbytère | `batiments/presbytere.json` | 7 x 7 m | 2 | (modèle) | est 0.50 | murs pierre, toit lauze, volets vert_sombre, porte vert_sombre |
| la maison de Marthe | `batiments/marthe.json` | 6 x 6 m | 2 | (modèle) | est 0.50 | murs enduit, toit tuile, volets bleu, porte bleu |
| la maison de cheminot (ouest) | `batiments/cheminot-o.json` | 6 x 6 m | 2 | (modèle) | nord 0.50 | murs pierre_claire, toit tuile, volets rouge_cheminot, porte rouge_cheminot |
| la maison de cheminot (est) | `batiments/cheminot-e.json` | 6 x 6 m | 2 | (modèle) | nord 0.50 | murs pierre_claire, toit tuile, volets rouge_cheminot, porte rouge_cheminot |
| le lavoir | `lavoir` | 5 x 4 m | (modèle) | (modèle) | ouest 0.50 | toit en appentis sur quatre poteaux, ouvert à l'ouest, bassin de pierre à l'est |
| le poste d'aiguillage | `batiments/poste.json` | 6 x 4 m | 2 | croupe | nord 0.50 | murs pierre, toit lauze, menuiseries rouge_cheminot, porte rouge_cheminot |
| le moulin de la Vanne | `batiments/moulin.json` | 8 x 8 m | 2 | deux-pans | nord 0.50 | murs pierre, toit tuile, menuiseries bois_sombre, porte bois_sombre |
| le logis de la ferme Delmas | `batiments/ferme-logis.json` | 9 x 6 m | 2 | deux-pans | sud 0.50 | murs enduit_ocre, toit tuile, volets sauge, porte sauge |
| la grange | `batiments/grange.json` | 8 x 10 m | 1 | deux-pans | est 0.50 | murs bois_gris, toit tuile, porte bois_brut |
| la maison forestière | `batiments/forestiere.json` | 6 x 6 m | 1 | (modèle) | est 0.50 | murs pierre, toit lauze, volets vert_sombre, porte vert_sombre |
<!-- genere:gabarits:fin -->

### Mobilier de lieu

<!-- genere:mobilier:debut -->
| Objet | Type du jeu | Modèle | Où (x, y) | Face au | Pourquoi |
|---|---|---|---|---|---|
| banc-du-quai | banc | `bench-platform` | 200, 100.5 | nord | le banc du réveil: on attend le train face à la voie |
| banc-quai-ouest | banc | `bench-platform` | 191, 100.5 | nord | second banc du quai, face à la voie |
| poteau-quai | poteau-de-quai | `platform-sign` | 205.5, 102.5 | sud | là où l'on monte à deux: le point du quai |
| caisse-commande | (à créer) | `crate` | 207.5, 101.5 | sud | la caisse de la commande du samedi, au pied du poteau |
| panneau-gare | (à créer) | `platform-sign` | 196, 99.6 | nord | le nom de la halte se lit depuis le train, donc tourné vers la voie |
| reverbere-quai-1 | lanterne-de-quai | `platform-lantern` | 188, 102.5 | nord | éclairage du quai, au bout ouest: la potence vers la voie |
| reverbere-quai-2 | lanterne-de-quai | `platform-lantern` | 210.5, 102.5 | nord | éclairage du quai, au bout est, au-dessus de la marche de la traversée de service: la potence vers la voie |
| reverbere-quai-3 | lanterne-de-quai | `platform-lantern` | 203, 102.5 | nord | au milieu du quai, entre le banc du réveil et le poteau où l'on monte: on attend le train sous elle |
| reverbere-route-1 | reverbere | `street-lantern` | 195.5, 111 | sud | la Grand-Route éclairée côté sud, entre les façades, tous les 20 m environ |
| reverbere-route-2 | reverbere | `street-lantern` | 216.5, 111 | sud | la Grand-Route éclairée côté sud, entre les façades, tous les 20 m environ |
| reverbere-route-3 | reverbere | `street-lantern` | 240.5, 111 | sud | la Grand-Route éclairée côté sud, entre les façades, tous les 20 m environ |
| reverbere-route-4 | reverbere | `street-lantern` | 262, 111 | sud | la Grand-Route éclairée côté sud, entre les façades, tous les 20 m environ |
| reverbere-route-5 | reverbere | `street-lantern` | 280.5, 111 | sud | la Grand-Route éclairée côté sud, entre les façades, tous les 20 m environ |
| reverbere-route-6 | reverbere | `street-lantern` | 302.5, 111 | sud | la Grand-Route éclairée côté sud, entre les façades, tous les 20 m environ |
| reverbere-route-7 | reverbere | `street-lantern` | 313, 111 | sud | la Grand-Route éclairée côté sud, entre les façades, tous les 20 m environ |
| reverbere-gue | reverbere | `street-lantern` | 179.5, 104.5 | sud | au carrefour du passage à niveau, la nuit du dénouement se joue ici |
| reverbere-place | reverbere | `street-lantern` | 205.5, 120.4 | sud | au sud de la place, près du banc: la pompe et le banc se trouvent la nuit, et la descente vers la berge |
| reverbere-parvis | reverbere | `street-lantern` | 257.5, 81 | sud | sur le parvis, à gauche du portail en sortant: on trouve la rue de l'Église en quittant l'office du soir |
| lanterne-halte | lanterne-de-porte | `wall-lantern` | 221.2, 105.03 | sud | à droite de la porte de la halte, côté place: la gare se trouve de loin, même le dernier train parti |
| lanterne-cafe | lanterne-de-porte | `wall-lantern` | 255.4, 106.03 | sud | entre la porte et la vitrine du café: allumée, elle dit que Colette sert encore |
| lanterne-epicerie | lanterne-de-porte | `wall-lantern` | 194.03, 117.2 | est | à la porte de l'épicerie-pension, côté place: les pensionnaires rentrent à la nuit |
| lisse-nord | lisse-de-passage-a-niveau | `crossing-gate` | 182.5, 95.5 | sud | en travers de la route du Gué au nord de la voie, socle (poteau et lanterne) au bord ouest de la chaussée, à droite de qui descend vers le sud, bras de 4 m sur toute la chaussée; absente quand la lisse fleurie, qui la remplace, est baissée |
| lisse-sud | lisse-de-passage-a-niveau | `crossing-gate` | 182.5, 99.5 | nord | en travers de la route du Gué au sud de la voie, socle au bord est de la chaussée, à droite de qui monte vers le nord, côté maison de Firmin (qui se tient contre lui); absente quand la lisse fleurie est baissée |
| croix-pn-eglise | (à créer) | `crossing-sign` | 256.8, 95 | sud | passage à niveau non gardé: croix de Saint-André au bord de la rue |
| pompe-de-la-place | pompe | `water-pump` | 208, 113.5 | sud | la pompe de la place, sur l'ancien puits: l'eau de tous et la toilette du matin (acte 1) |
| banc-place | banc | `bench-platform` | 208, 119.4 | nord | face au puits et à la halte: on y voit qui descend du train |
| ronces-maison-1 | ronces-maison | `bramble` | 167.5, 112.5 | sud | les ronces qui ont envahi la ruine, contre le pignon ouest: on les arrache à la bêche à l'acte 1, avant de refaire le toit (on ne monte pas d'échelle dans les ronces) |
| ronces-maison-2 | ronces-maison | `bramble` | 176, 119.6 | sud | les ronces du jardin, devant le futur potager: arrachées à la bêche, racines comprises, avant de bêcher le premier carré |
| table-tonnelle | table-a-manger | `table-farm` | 197.5, 120 | sud | la tonnelle d'Odette: le souper des pensionnaires |
| chaise-tonnelle-n | chaise | `chair-farm` | 197, 118.9 | sud | autour de la table de la tonnelle |
| chaise-tonnelle-s | chaise | `chair-farm` | 198, 121.1 | nord | autour de la table de la tonnelle |
| banc-ponton | banc | `bench-platform` | 201.5, 128.2 | sud | au pied du ponton, face à la rivière et au pigeonnier de l'autre rive |
| banc-berge | banc | `bench-platform` | 248, 124.4 | sud | face à la rivière, à l'ombre des saules |
| panneau-1 | (à créer) | `fingerpost` | 179.4, 105 | sud | panneau de carrefour: passage à niveau, Grand-Route, chemin du Moulin, le Gué |
| panneau-2 | (à créer) | `fingerpost` | 256.4, 111.5 | sud | panneau de carrefour: rue de l'Église, venelle des Jardins |
| panneau-3 | (à créer) | `fingerpost` | 185.6, 85 | sud | panneau de carrefour: chemin forestier, chemin de la Lisière |
| panneau-4 | (à créer) | `fingerpost` | 185.6, 123.6 | sud | panneau de carrefour: chemin de la Berge, le Gué |
| panneau-5 | (à créer) | `fingerpost` | 317, 111.6 | sud | panneau de carrefour: bout de la Grand-Route, chemin des Jardins, l'arrêt du car |
| panneau-6 | (à créer) | `fingerpost` | 150, 105.4 | sud | panneau de carrefour: chemin du Moulin, portail du moulin |
| boite-lucie | (à créer) | `letter-box` | 248.4, 110.6 | nord | la boîte aux lettres du bourg, à la grille de Lucie, tournée vers la rue |
| boite-maison | (à créer) | `letter-box` | 179.6, 113.4 | est | la boîte de la maison du garde, à côté de la porte, tournée vers la route: les lettres des habitants |
| pompe-jardin | pompe | `water-pump` | 179.5, 121.5 | sud | la pompe du jardin: l'eau de l'arrosoir à deux pas du potager |
| bois-maison | tas-de-bois | `woodpile` | 167.4, 116.5 | sud | bois de chauffage contre le pignon ouest, à l'abri du vent de pluie |
| bois-atelier | tas-de-bois | `woodpile` | 171, 93 | sud | les grumes refendues de Basile, au sud de l'atelier |
| haches-basile | etal-de-haches | `ratelier` | 176.5, 90.5 | est | sous l'auvent est, dos au mur de l'atelier, à côté de la porte: Basile prête ses outils (acte 1) |
| potager | terre-cultivable | `garden-bed` | 174, 122.5 | sud | le potager de 6 x 4 cases au bout de l'allée du jardin (24 cases) |
| banc-cretes | banc | `bench-platform` | 304, 47.6 | sud | le banc des Crêtes: le bourg entier en contrebas |
| banc-etang | banc | `bench-platform` | 225.5, 39.5 | est | face à l'étang, au coin de pêche |
| tronc-clairiere | banc | `bench-platform` | 183, 52.4 | nord | un tronc couché sert de banc face au Vieux Chêne |
| banc-belvedere | banc | `bench-platform` | 345, 27.6 | ouest | le belvédère regarde le bourg et le clocher, à l'ouest |
| abreuvoir | pompe | `water-pump` | 201, 185.6 | sud | la pompe et l'abreuvoir des bêtes, au bout de la cour |
| tonneaux-ferme | tonneau | `barrel` | 196.5, 154.5 | sud | tonneaux de cidre contre le logis |
| caisses-epicerie | caisse | `crate` | 194.5, 113.5 | sud | cageots de légumes devant la vitrine d'Odette |
| tonneau-cafe | tonneau | `barrel` | 256.5, 111.5 | sud | le tonneau qui sert de table à la terrasse du café, en face de la porte, de l'autre côté de la Grand-Route (herbe rase, côté soleil, au bout du jeu de quilles): il ne barre plus la route |
| caillou-greve-1 | caillou | `stone` | 185, 129.4 | sud | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-2 | caillou | `stone` | 186.6, 129.4 | sud | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-3 | caillou | `stone` | 188.2, 129.4 | sud | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-4 | caillou | `stone` | 189.8, 129.4 | sud | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-5 | caillou | `stone` | 191.4, 129.4 | sud | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-6 | caillou | `stone` | 184, 129.6 | sud | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-ile-1 | caillou | `stone` | 39, 146.4 | sud | pierres plates de la grève de l'Île, au pied de la vanne (i4) |
| caillou-ile-2 | caillou | `stone` | 41, 146.4 | sud | pierres plates de la grève de l'Île, au pied de la vanne (i4) |
| caillou-ile-3 | caillou | `stone` | 43, 146.4 | sud | pierres plates de la grève de l'Île, au pied de la vanne (i4) |
| caillou-ile-4 | caillou | `stone` | 45, 146.4 | sud | pierres plates de la grève de l'Île, au pied de la vanne (i4) |
| ronces-tranchee-1 | ronces | `bramble` | 144.5, 95.5 | sud | les ronces des talus de la tranchée (tw2): mûres de l'été et de l'automne, sans barrer la voie |
| ronces-tranchee-2 | ronces | `bramble` | 148.5, 95.5 | sud | les ronces des talus de la tranchée (tw2): mûres de l'été et de l'automne, sans barrer la voie |
| ronces-tranchee-3 | ronces | `bramble` | 146.5, 99.5 | sud | les ronces des talus de la tranchée (tw2): mûres de l'été et de l'automne, sans barrer la voie |
| poulailler-jardin | poulailler | `poulailler` | 161.5, 120 | sud | le poulailler du jardin (3 x 2 m) en haut de son parc, à 5,5 m du pignon ouest de la maison: sa rampe descend au sud dans le parc, qui ne touche pas le chemin |
| wagon-oublie | (à créer) | `wagon-old` | 69, 93.5 | sud | le wagon oublié sur la voie de garage, porte côté ligne: la cabane de Jeanne (41 bâtons à la craie) |
| coquelicots-verger | coquelicots | `poppies` | 305.5, 124.5 | sud | dans l'herbe haute du verger, qu'on ne fauche qu'en juillet: la seule touffe du bourg (la mercerie les rachète) |
| coquelicots-champs | coquelicots | `poppies` | 236.5, 162.5 | sud | sur la tournière des champs des Delmas, entre le chemin des Champs et le labour: le coquelicot pousse au bord des blés |
| enclume-forge | enclume | `enclume` | 262.5, 103.5 | ouest | contre le mur ouest de la forge, sous l'auvent, au bord de la rue de l'Église: Mado s'y tient côté rue, au poste mado-enclume (amélioration et réparation des outils) |
| cageot-ferme-1 | caisse-de-legumes | `vegetable-crate` | 212.5, 157.5 | sud | cageots de la récolte du potager de la ferme, au bord du chemin des Champs: la charrette les prend là |
| cageot-ferme-2 | caisse-de-legumes | `vegetable-crate` | 213.5, 157.5 | sud | cageots de la récolte, au bord du chemin |
| cageot-ferme-3 | caisse-de-legumes | `vegetable-crate` | 214.5, 157.5 | sud | cageots de la récolte, au bord du chemin |
| seau-potager-ferme | seau | `bucket` | 210.5, 157.5 | sud | le seau d'arrosage, au coin du potager |
| banc-champs | banc-de-table | `table-bench` | 228, 156.5 | sud | le banc où Margot et Paulin cassent la croûte, au bord du chemin, face à leurs champs |
| panier-champs | panier-a-linge | `laundry-basket` | 229.5, 156.5 | sud | le panier du casse-croûte, à côté du banc |
| tonnelet-labour | tonnelet | `small-keg` | 213.5, 163.5 | sud | le tonnelet d'eau des travailleurs, au coin du labour |
| seau-labour | seau | `bucket` | 212.5, 164.5 | sud | le seau des bêtes de trait, au coin du labour |
| bois-logis-1 | buches-d-interieur | `indoor-logs` | 201.5, 146.5 | sud | le bois de chauffe empilé contre le mur nord du logis, sous l'avant-toit |
| bois-logis-2 | buches-d-interieur | `indoor-logs` | 202.5, 146.5 | sud | le bois de chauffe contre le mur nord du logis |
| tonnelet-logis | tonnelet | `small-keg` | 204.5, 146.5 | sud | un tonnelet qui attend le cidre, contre le mur nord, à l'ombre |
| banc-talus | banc-de-table | `table-bench` | 196, 143.5 | nord | un banc à mi-pente, face à la rivière et au bourg: Margot y écosse |
| panier-talus | panier-a-linge | `laundry-basket` | 197.5, 143.5 | sud | le panier de légumes à écosser, à côté du banc |
| seau-talus | seau | `bucket` | 192.5, 140.5 | sud | le seau puisé à la rivière, en haut de la berge (Margot descend à la grève le matin) |
| banc-cheminots | banc | `bench-platform` | 152, 101.5 | nord | le banc des cheminots face à la voie: on y regarde passer les trains |
| bois-cheminots-1 | buches-d-interieur | `indoor-logs` | 157.5, 100.5 | sud | le bois fendu des logements de la Compagnie, au pied de la clôture |
| bois-cheminots-2 | buches-d-interieur | `indoor-logs` | 158.5, 100.5 | sud | le bois fendu des logements de la Compagnie |
| cageot-cheminots | caisse-de-legumes | `vegetable-crate` | 147.5, 104.5 | sud | un cageot du jardin des cheminots, au bord de leur chemin |
| seau-cheminots | seau | `bucket` | 148.5, 104.5 | sud | le seau d'arrosage du jardin des cheminots |
| tonnelet-pension | tonnelet | `small-keg` | 188.5, 121.5 | sud | le tonnelet de cidre d'Odette contre le mur sud de la pension, à l'ombre |
| panier-pension | panier-a-linge | `laundry-basket` | 191.5, 122.5 | sud | le linge des pensionnaires, qu'Odette étend au soleil de la berge |
| seau-pension | seau | `bucket` | 190.5, 122.5 | sud | le seau de la lessive, à côté du panier |
| bois-flotte-1 | buches-d-interieur | `indoor-logs` | 193.5, 128.5 | sud | du bois flotté tiré de la grève, qui sèche au-dessus de l'eau |
| bois-flotte-2 | buches-d-interieur | `indoor-logs` | 194.5, 128.5 | sud | du bois flotté qui sèche |
| seau-pompe | seau | `bucket` | 208, 114.5 | sud | le seau sous le bec de la pompe de la place |
| tonnelet-tonnelle | tonnelet | `small-keg` | 195.5, 122.5 | sud | le cidre du souper de la tonnelle, au pied de la pension |
| panier-lessive | panier-a-linge | `laundry-basket` | 210.5, 122.5 | sud | la lessive descendue à la rivière, posée en haut de la berge |
| seau-lessive | seau | `bucket` | 211.5, 122.5 | sud | le seau de rinçage de la lessive |
| tonnelet-garage | tonnelet | `small-keg` | 97.5, 94.5 | sud | un tonnelet de graisse d'aiguillage oublié par la Compagnie au bord de la plaine du garage |
| seau-garage | seau | `bucket` | 96.5, 94.5 | sud | le seau de graisse, à côté |
| cloture-potager-n1 | cloture | `fence` | 211, 152.5 | sud | la clôture du potager de la ferme, côté pré: les bêtes n'y entrent pas |
| cloture-potager-n2 | cloture | `fence` | 213, 152.5 | sud | la clôture du potager de la ferme, côté pré: les bêtes n'y entrent pas |
| cloture-potager-n3 | cloture | `fence` | 215, 152.5 | sud | la clôture du potager de la ferme, côté pré: les bêtes n'y entrent pas |
| cloture-potager-n4 | cloture | `fence` | 217, 152.5 | sud | la clôture du potager de la ferme, côté pré: les bêtes n'y entrent pas |
| cloture-potager-n5 | cloture | `fence` | 219, 152.5 | sud | la clôture du potager de la ferme, côté pré: les bêtes n'y entrent pas |
| cloture-potager-n6 | cloture | `fence` | 221, 152.5 | sud | la clôture du potager de la ferme, côté pré: les bêtes n'y entrent pas |
| cloture-potager-e1 | cloture | `fence` | 222.5, 154 | est | la clôture du potager, côté est |
| cloture-potager-e2 | cloture | `fence` | 222.5, 156 | est | la clôture du potager, côté est; le côté du chemin reste ouvert |
| cloture-potager-o1 | cloture | `fence` | 209.5, 154 | est | la clôture du potager, côté de la cour |
| cloture-potager-o2 | cloture | `fence` | 209.5, 156 | est | la clôture du potager, côté de la cour |
| herbes-pre-1 | herbes-hautes | `wild-herbs` | 224.5, 149.5 | sud | l'herbe haute du pré, que la faux n'a pas encore prise |
| buisson-pre-1 | buisson | `berry-bush-bare` | 229.5, 149.5 | sud | un buisson de la haie vive qui borde le pré au nord |
| buisson-pre-2 | buisson | `berry-bush-bare` | 232.5, 150.5 | sud | la haie vive du pré |
| epierrage-1 | rocher | `rock` | 224.5, 153.5 | sud | le tas d'épierrage: les pierres sorties du champ, au coin du potager |
| epierrage-2 | rocher-moussu | `rock-mossy` | 225.5, 153.5 | sud | le tas d'épierrage, les plus vieilles pierres moussues |
| epierrage-3 | rocher | `rock` | 224.5, 154.5 | sud | le tas d'épierrage |
| herbes-pre-2 | herbes-hautes | `wild-herbs` | 230.5, 153.5 | sud | l'herbe haute du pré |
| herbes-pre-3 | herbes-hautes | `wild-herbs` | 228.5, 151.5 | sud | l'herbe haute du pré |
| bloc-pre | gros-rocher-moussu | `boulder-mossy` | 210, 167 | sud | le bloc que la charrue contourne depuis toujours, au coin du pré |
| herbes-labour-1 | herbes-hautes | `wild-herbs` | 212.5, 167.5 | sud | l'herbe haute de la tournière, au bout des sillons |
| herbes-labour-2 | herbes-hautes | `wild-herbs` | 211.5, 169.5 | sud | l'herbe haute de la tournière |
| herbes-labour-3 | herbes-hautes | `wild-herbs` | 209.5, 171.5 | sud | l'herbe haute du pré |
| herbes-labour-4 | herbes-hautes | `wild-herbs` | 211.5, 173.5 | sud | l'herbe haute du pré |
| buisson-labour-1 | buisson | `berry-bush-bare` | 209.5, 163.5 | sud | un buisson au bord du chemin, à l'angle du pré |
| buisson-labour-2 | buisson | `berry-bush-bare` | 213.5, 172.5 | sud | un buisson au bout du labour |
| epierrage-4 | rocher | `rock` | 213.5, 166.5 | sud | les pierres jetées hors du labour, au bord du champ |
| epierrage-5 | rocher-moussu | `rock-mossy` | 213.5, 167.5 | sud | les pierres jetées hors du labour |
| buisson-berge-1 | buisson | `berry-bush-bare` | 187.5, 140.5 | sud | un buisson de berge en haut du talus, les racines dans la pente |
| herbes-berge-1 | herbes-hautes | `wild-herbs` | 189.5, 140.5 | sud | l'herbe haute du haut de la berge, que personne ne fauche |
| herbes-berge-2 | herbes-hautes | `wild-herbs` | 196.5, 140.5 | sud | l'herbe haute du haut de la berge |
| herbes-berge-3 | herbes-hautes | `wild-herbs` | 200.5, 140.5 | sud | l'herbe haute du haut de la berge |
| herbes-berge-4 | herbes-hautes | `wild-herbs` | 203.5, 141.5 | sud | l'herbe haute du haut de la berge |
| bloc-talus | gros-rocher-moussu | `boulder-mossy` | 190, 144 | sud | un bloc moussu à mi-pente, tombé du talus il y a longtemps |
| rocher-talus | rocher | `rock` | 193.5, 146.5 | sud | une pierre du talus |
| herbes-talus-1 | herbes-hautes | `wild-herbs` | 187.5, 146.5 | sud | l'herbe haute de la pente |
| herbes-talus-2 | herbes-hautes | `wild-herbs` | 191.5, 148.5 | sud | l'herbe haute de la pente |
| herbes-talus-3 | herbes-hautes | `wild-herbs` | 196.5, 147.5 | sud | l'herbe haute de la pente |
| buisson-talus | buisson | `berry-bush-bare` | 199.5, 143.5 | sud | un buisson au coin du logis, côté rivière |
| buches-pignon | tas-de-buches | `log-pile` | 199.5, 148.5 | sud | les bûches empilées contre le pignon ouest du logis |
| baquet-margot | baquet-de-lessive | `tub` | 202, 143.5 | sud | le baquet de lessive de Margot, en haut de la berge: elle rince à la rivière |
| tonneau-cheminots | tonneau | `barrel` | 147.5, 102.5 | sud | le tonneau d'eau de pluie du jardin des cheminots |
| herbes-voie-1 | herbes-hautes | `wild-herbs` | 149.5, 100.5 | sud | l'herbe haute au pied de la clôture de la voie, où la faux ne passe pas |
| herbes-voie-2 | herbes-hautes | `wild-herbs` | 154.5, 100.5 | sud | l'herbe haute au pied de la clôture |
| herbes-voie-3 | herbes-hautes | `wild-herbs` | 155.5, 101.5 | sud | l'herbe haute au pied de la clôture |
| buisson-cheminots | buisson | `berry-bush-bare` | 159.5, 101.5 | sud | un buisson qui ferme le pré à l'est |
| rocher-cheminots | rocher | `rock` | 153.5, 103.5 | sud | une borne de pierre oubliée par la Compagnie |
| caisse-cheminots | caisse | `crate` | 150.5, 103.5 | sud | une caisse de la Compagnie qui sert de table au jardin |
| herbes-cheminots-1 | herbes-hautes | `wild-herbs` | 151.5, 104.5 | sud | l'herbe haute du pré des cheminots |
| herbes-cheminots-2 | herbes-hautes | `wild-herbs` | 157.5, 104.5 | sud | l'herbe haute du pré des cheminots |
| herbes-cheminots-3 | herbes-hautes | `wild-herbs` | 143.5, 103.5 | sud | l'herbe haute au bord du jardin |
| herbes-greve-1 | herbes-hautes | `wild-herbs` | 194.5, 129.5 | sud | une touffe de joncs au bord de l'eau |
| herbes-greve-2 | herbes-hautes | `wild-herbs` | 198.5, 129.5 | sud | une touffe de joncs au bord de l'eau |
| buisson-tonnelle | buisson | `berry-bush-bare` | 199.5, 123.5 | sud | un sureau au coin de la tonnelle, côté rivière |
| buisson-oree-1 | buisson | `berry-bush-bare` | 101.5, 87.5 | sud | un buisson de l'orée: la forêt gagne sur le sous-bois |
| buisson-oree-2 | buisson | `berry-bush-bare` | 104.5, 86.5 | sud | un buisson de l'orée |
| buisson-oree-3 | buisson | `berry-bush-bare` | 108.5, 87.5 | sud | un buisson de l'orée |
| buisson-oree-4 | buisson | `berry-bush-bare` | 112.5, 86.5 | sud | un buisson de l'orée |
| herbes-oree-1 | herbes-hautes | `wild-herbs` | 102.5, 84.5 | sud | l'herbe haute du sous-bois |
| herbes-oree-2 | herbes-hautes | `wild-herbs` | 106.5, 83.5 | sud | l'herbe haute du sous-bois |
| herbes-oree-3 | herbes-hautes | `wild-herbs` | 110.5, 84.5 | sud | l'herbe haute du sous-bois |
| herbes-oree-4 | herbes-hautes | `wild-herbs` | 114.5, 83.5 | sud | l'herbe haute du sous-bois |
| herbes-oree-5 | herbes-hautes | `wild-herbs` | 103.5, 80.5 | sud | l'herbe haute du sous-bois |
| herbes-oree-6 | herbes-hautes | `wild-herbs` | 108.5, 80.5 | sud | l'herbe haute du sous-bois |
| herbes-oree-7 | herbes-hautes | `wild-herbs` | 112.5, 80.5 | sud | l'herbe haute du sous-bois |
| bloc-oree | gros-rocher-moussu | `boulder-mossy` | 106, 86 | sud | un bloc moussu au pied de la forêt |
| rocher-oree-1 | rocher-moussu | `rock-mossy` | 110.5, 82.5 | sud | une pierre moussue du sous-bois |
| rocher-oree-2 | rocher-moussu | `rock-mossy` | 101.5, 81.5 | sud | une pierre moussue du sous-bois |
| buches-oree | tas-de-buches | `log-pile` | 114.5, 87.5 | sud | les bûches d'une ancienne coupe, laissées à sécher au bord du bois |
| herbes-friche-1 | herbes-hautes | `wild-herbs` | 94.5, 85.5 | sud | l'herbe haute de la friche du garage |
| herbes-friche-2 | herbes-hautes | `wild-herbs` | 97.5, 87.5 | sud | l'herbe haute de la friche du garage |
| herbes-friche-3 | herbes-hautes | `wild-herbs` | 95.5, 90.5 | sud | l'herbe haute de la friche du garage |
| herbes-friche-4 | herbes-hautes | `wild-herbs` | 98.5, 92.5 | sud | l'herbe haute de la friche du garage |
| buisson-friche-1 | buisson | `berry-bush-bare` | 93.5, 88.5 | sud | un buisson de la friche |
| buisson-friche-2 | buisson | `berry-bush-bare` | 96.5, 84.5 | sud | un buisson de la friche |
| rocher-friche | rocher | `rock` | 98.5, 89.5 | sud | un rocher laissé là quand on a tracé la voie, dans la friche |
| berge-coquilles-gue-1 | coquilles-de-greve | `stone-b` | 187.5, 129.5 | sud | grève du gué: le courant ralentit avant le gué et dépose les coquilles vides des mulettes sur le gravier |
| berge-coquilles-gue-2 | coquilles-de-greve | `stone-b` | 190.5, 129.5 | sud | grève du gué, côté aval: second dépôt de coquilles, entre deux pierres plates |
| berge-galets-gue | galets-veines | `stone-c` | 192.5, 129.5 | sud | bout aval de la grève: les galets veinés de quartz roulés depuis la Côte s'y arrêtent, avec les pierres plates |
| berge-laisse-joncs | laisse-de-crue | `dead-branches-b` | 197.5, 129.5 | sud | au pied des joncs, à côté du bois flotté qui sèche: les joncs retiennent ce que la rivière charrie |
| berge-tessons-lavoir | tessons-du-lavoir | `stone-b` | 225.5, 119.5 | sud | au pied du lavoir, côté bassin, sur la rive ouest de la rigole: les assiettes rincées au bassin y laissent leurs éclats |
| berge-tessons-rigole | tessons-du-lavoir | `stone-b` | 226.5, 128.5 | sud | à la bouche de la rigole, où elle rend à l'Aubrune ce qu'on a lavé: les tessons roulés s'arrêtent dans l'angle, sous le saule |
| berge-plumes-aval | plumes-de-heron | `wild-herbs` | 264.5, 130.5 | sud | sous le saule têtard de l'aval, au sud-est du tronc (vu de la caméra): le héron y pêche à l'aube et y laisse ses plumes |
| berge-laisse-aval | laisse-de-crue | `dead-branches-b` | 272.5, 130.5 | sud | là où la rive s'avance dans le courant: la crue y dépose son bois avant le coude |
| berge-coquilles-ile | coquilles-de-greve | `stone-b` | 37.5, 146.5 | sud | grève de l'Île, au pied de la vanne: l'eau qui tombe du déversoir y roule les coquilles |
| berge-galets-ile | galets-veines | `stone-c` | 46.5, 146.5 | sud | bout est de la grève de l'Île, après les pierres plates: les galets du déversoir |
| berge-mulettes-anse-1 | mulettes-du-bief | `stone-b` | 48.5, 141.5 | sud | l'anse du bief, côté Île: l'eau se calme en sortant de la vanne, les mulettes vivent dans le sable clair (la perle est là) |
| berge-mulettes-anse-2 | mulettes-du-bief | `stone-b` | 52.5, 141.5 | sud | l'anse du bief, plus à l'est: le second lit de mulettes, au bord du sentier de l'Île sans le toucher |
| berge-plumes-anse | plumes-de-heron | `wild-herbs` | 56.5, 141.5 | sud | le bout de l'anse, où l'eau est la plus basse: le héron y pêche à l'aube, le martin-pêcheur file au ras de l'eau |
| berge-laisse-ile | laisse-de-crue | `dead-branches-b` | 70.5, 145.5 | sud | rive sud de l'Île, face à la rivière: la pointe que la crue recouvre et où elle laisse son bois |
| berge-limnees-etang-o | limnees-de-l-etang | `stone-b` | 230.5, 46.5 | sud | bord de vase de l'étang, à l'ouest de la bonde: les escargots d'eau des roseaux y laissent leurs coquilles |
| berge-limnees-etang-e | limnees-de-l-etang | `stone-b` | 242.5, 46.5 | sud | bord de vase de l'étang, à l'est, au pied du sentier de la digue |
| berge-plumes-etang | plumes-de-heron | `wild-herbs` | 234.5, 47.5 | sud | la vase à l'est de la bonde, eau basse: le héron de l'étang y guette à l'aube |
| cote-girolles-1 | girolles | `wild-herbs` | 180.5, 26.5 | sud | sous-bois humide à l'est du chemin forestier, au carrefour du haut: les girolles de l'été et de l'automne, le matin |
| cote-girolles-2 | girolles | `wild-herbs` | 174.5, 29.5 | sud | sous-bois de l'autre côté du chemin, en contrebas: second rond de girolles |
| estrade-fanfare | estrade-de-fanfare | `bandstand` | 175.5, 102 | est | la fanfare de la halte joue pour les trains: au bout du quai, au coin du passage à niveau et de la Grand-Route, face au quai; le quai (5 m, le train à quai) n'a pas la place de 4 x 3 m, la place a ses fêtes |
| panneau-commande | panneau-d-affichage | `chalk-board` | 207.5, 102.5 | sud | la commande de la semaine, à la craie, sur la troisième rangée du quai (hors du bord): Rosalie l'écrit à 3 m de son poste, on la lit en montant de la Grand-Route par le passage; face au sud, vers qui arrive |
<!-- genere:mobilier:fin -->

### Végétation par zones

<!-- genere:vegetation:debut -->
| Zone | Arbres pour 100 m² | Essences | Sous-étage | Recul des chemins | Pourquoi |
|---|---|---|---|---|---|
| La Côte | 4,0 | chêne, hêtre, châtaignier, charme | noisetier, houx, fougère | 4,5 m | bois de coteau exposé au sud: feuillus, châtaigniers vers le bourg, sapins seulement sur les crêtes au nord; clairières et prairies laissées libres |
| Le tunnel | 1,2 | pin sylvestre, bouleau | genêt, ronce | 3,0 m | friche rocheuse au-dessus de la ligne morte: rien n'est entretenu depuis la fermeture |
| La voie jusqu'au poste d'aiguillage | 0,6 | frêne, sureau | ronce, églantier | 2,0 m | sur les talus de la tranchée seulement, rien dans le couloir des rails |
| La rivière et le bief | 1,5 | saule blanc, aulne, peuplier | roseau, iris des marais | 2,0 m | ripisylve: arbres en rang le long des berges, roseaux sur les grèves |
| Le moulin | 0,4 | noyer, saule têtard | ortie | 3,0 m | deux noyers dans le pré du meunier, saules têtards le long du bief |
| La ferme | 0,3 | chêne isolé, pommier, noyer | aubépine, charme (haies) | 3,0 m | bocage: arbres dans les haies entre les champs, jamais au milieu d'un champ |
| Le bourg et le passage à niveau | 0,2 | tilleul, pommier, saule (berge) | lilas, rosier grimpant | 1,5 m | des arbres plantés par les gens: tilleuls aux angles de la place, fruitiers dans les jardins, saules sur la berge |
<!-- genere:vegetation:fin -->

Arbres singuliers (champ `arbres`): Vieux Chêne, Gros Noyer, les deux chênes de la lisière à abattre (acte 1), deux tilleuls de la place, trois saules de la berge.

### Pêche, culture, récolte, fouille

<!-- genere:ressources:debut -->
| Ressource | Nature | Où | Acte | Heures | Saisons | Pourquoi |
|---|---|---|---|---|---|---|
| peche-ponton | peche | x 204, y 131.5 | 2 | toutes | toutes | eau calme sous le ponton, poissons blancs |
| peche-aval | peche | x 295, y 134 | 2 | matin et soir | toutes | courant de l'aval: truites au lever et au coucher |
| peche-fosse | peche | x 132, y 131.4 | 2 | toutes | toutes | la fosse de la Baronne, sous la roue |
| peche-saule-ile | peche | x 78, y 138.4 | 2 | jour | toutes | à l'ombre du saule têtard |
| peche-vanne | peche | x 24, y 146 | 2 | toutes | printemps, été, automne | l'eau qui tombe du déversoir: ricochets et brochets |
| peche-etang | peche | x 227, y 39 | 3 | toutes | toutes | l'étang de la Côte, carpes et tanches |
| terre-6 | culture | rectangle [171, 120.5, 6, 4] | 1 | toutes | toutes | le potager de départ (6 cases du jeu), au bout de l'allée du jardin |
| terre-12 | culture | rectangle [166, 120.5, 12, 4] | 1 | toutes | toutes | agrandi à 12 cases après la toiture, vers l'ouest |
| terre-24 | culture | rectangle [166, 120.5, 12, 5] | 2 | toutes | toutes | 24 cases à l'acte 2: le jardin entier au sud de la maison et de son allée, le poulailler à l'ouest |
| champs-location | culture | rectangle [214, 164, 48, 26] | 3 | toutes | toutes | les champs des Delmas, loués par parcelles |
| mures-tranchee | cueillette | x 146, y 100.2 | 2 | jour | été, automne | les ronces des talus |
| chataignes | cueillette | x 176, y 72 | 3 | jour | automne | châtaigniers du bas de la Côte, 3 m au sud des troncs (houppier) |
| champignons | cueillette | x 176, y 25 | 3 | matin | été, automne | girolles du sous-bois humide, le matin (plus quand il pleut), posées en version 8 |
| myrtilles | cueillette | x 152, y 17 | 3 | jour | été | la lande de la crête |
| noix | cueillette | x 162, y 184 | 3 | jour | automne | sous le Gros Noyer |
| pommes-verger | cueillette | x 310, y 120 | 1 | jour | automne | le verger communal |
| legumes-jardins | cueillette | x 256.5, y 121.5 | 1 | jour | printemps, été | les jardins de la Rive: ce qu'on vous laisse prendre |
| coquillages-greve | cueillette | x 187, y 128.6 | 1 | toutes | toutes | la grève au pied de la berge, eaux basses du matin; coquilles, galets et bois flotté (version 8): plus après la pluie |
| coquillages-ile | cueillette | x 42, y 146.6 | 2 | toutes | toutes | la grève de l'Île; coquilles, galets et bois flotté (version 8): plus après la pluie |
| insectes-roseaux | insectes | x 116, y 141 | 2 | jour | printemps, été | libellules des roseaux |
| insectes-cour-ecole | insectes | x 241, y 103 | 2 | jour | toutes | la cour d'Armand |
| insectes-pre-meunier | insectes | x 144, y 117 | 3 | jour | printemps, été | le pré du meunier |
| insectes-pre-bas | insectes | x 302, y 159 | 3 | jour | été | papillons du pré bas |
| insectes-pres-haut | insectes | x 269, y 23 | 3 | nuit | été | lucioles et insectes rares des prés du Haut, la nuit |
| insectes-clairiere | insectes | x 183, y 50 | 3 | jour | toutes | la clairière |
| fouille-ballast | fouille | x 112, y 99.8 | 2 | toutes | toutes | le ballast de la voie ouest: boulons, plaques |
| fouille-talus | fouille | x 288, y 95 | 3 | toutes | toutes | le talus des Hameaux |
| fouille-courbe | fouille | x 347, y 86 | 3 | toutes | toutes | la courbe de la ligne morte, avec Jeanne |
| fouille-pierre-levee | fouille | x 119, y 26 | 3 | toutes | toutes | la Pierre Levée |
| fouille-roche | fouille | x 268, y 51 | 3 | toutes | toutes | la roche aux fossiles |
| fouille-borne | fouille | x 185, y 185 | 3 | toutes | toutes | la borne de la vieille route |
| bois-coupe | bois | x 160, y 57 | 3 | jour | toutes | la coupe de Basile: le bois de la chambre |
| branches-lisiere | bois | x 199, y 88.6 | 1 | jour | toutes | branches tombées à la lisière, de quoi commencer |
| legumes-ferme | cueillette | x 216, y 155.5 | 3 | jour | printemps, été, automne | le potager de la ferme, à l'est de la cour: carottes, poireaux, pommes de terre du pot-au-feu |
<!-- genere:ressources:fin -->

### Points nommés du dehors

Tous les nœuds du graphe sont aussi des points (`quai`, `hd`, `pl`, `gr4`...). En plus:

<!-- genere:points_nommes:debut -->
| Point | Rôle | Qui | Pourquoi |
|---|---|---|---|
| firmin-quai | poste | Firmin | Firmin attend le train au milieu du quai |
| firmin-barriere | poste | Firmin | Firmin à la barrière, en l'absence du garde |
| odette-vitrine | poste | Odette | Odette balaie devant sa porte |
| basile-etabli | poste | Basile | l'établi sous l'auvent |
| achille-porte | poste | Achille | Achille sur le pas du fournil, au lever |
| mado-enclume | poste | Mado | l'enclume dehors, sous l'auvent de la forge |
| marthe-parvis | poste | Marthe | Marthe au pied du clocher, corde de la cloche |
| achille-peche | poste | Achille | la pêche du lundi à la fosse |
| siege-banc-place | siege | tous | le banc de la place |
| siege-banc-reveil | siege | tous | le banc du réveil |
| siege-banc-ponton | siege | tous | le banc du ponton |
| siege-banc-berge | siege | tous | le banc de la berge |
| siege-tonnelle | siege | Odette | la tonnelle, au souper |
| guet-moulin | poste | tous | le guet de nuit de la suite du « fantôme », dans la cour du moulin |
<!-- genere:points_nommes:fin -->

### Intérieurs

Posés dans l'annexe sous le dehors (y 210), reliés au dehors par une paire de portes, et entre niveaux par des escaliers (paires de portes aussi). Légende des plans: `#` cloison, `P` porte, `E` escalier, `*` point nommé, lettre: meuble (initiale de son type).

<!-- genere:interieurs:debut -->
**la halte** (`interieurs/halte.json`, 9 x 5 m, 45 m², niveau 0): le guichet sépare la salle du bureau; la consigne est le coffre commun des deux joueurs.

```text
C B . B . . . T C
. * . P . . . * P
. . . . . C * . .
B . . . . . # # .
. . P . . . T C C
```

Pièces: salle des pas perdus (5 x 5); guichet (1 x 5); bureau de Firmin (3 x 3); consigne (3 x 2). Meubles: halte-banc (banc), halte-guichet (comptoir, à créer), halte-bureau (table-a-manger), halte-chaise (chaise), halte-consigne (coffre), halte-horloge (horloge-murale), halte-affiche (cadre-paysage), halte-reglement (cadre-portrait), halte-patere (patere), halte-poele (poele), halte-buches (buches-d-interieur), halte-balai (balai), halte-colis (caisse-de-legumes), halte-fut (tonnelet), halte-lampe (lampe-de-table, sur halte-bureau), halte-registres (pile-de-livres, sur halte-bureau), halte-journal (journal, sur halte-bureau). Points: halte-p-guichet (comptoir, Firmin), halte-p-bureau (siege, Firmin), halte-p-banc (siege).

**la maison du garde, rez-de-chaussée** (`interieurs/maison-rdc.json`, 10 x 7 m, 70 m², niveau 0): au début, la ruine: la moitié ouest (chambre, troisième pièce) sans toit et encombrée de gravats; on dort dans la salle. L'escalier de l'étage part de la cuisine, celui de la cave de la chambre.

```text
. A S . A # T T H P
. . . B . # C . . P
. . . . . . T T * P
E A . . . . . B L C
. . . . A E . B L L
. . . . . A . * * S
. . A . . # R A P C
```

Pièces: salle commune et cuisine (5 x 7); chambre (5 x 4); troisième pièce (5 x 3). Meubles: maison-cuisiniere (cuisiniere), maison-plan (plan-de-travail), maison-table (table-a-manger), maison-chaise-1 (chaise), maison-chaise-2 (chaise), lit-de-la-maison (lit-double), maison-armoire (armoire), maison-rechaud (rechaud), maison-rdc-patere (patere), maison-rdc-horloge (horloge-murale), maison-rdc-portrait (cadre-ovale), maison-rdc-panier (panier-a-linge), maison-rdc-seau (seau), maison-rdc-baquet (baquet), maison-rdc-tapis-de-sol (tapis-long), maison-rdc-balai (balai), maison-rdc-seau-gravats (seau), maison-rdc-lampe (lampe-a-petrole, sur maison-table), maison-rdc-pain (corbeille-de-pain, sur maison-table), maison-rdc-journal (journal, sur maison-table), maison-rdc-pots (pots-de-gres, sur maison-plan), maison-chantier-salle (ardoise-de-chantier), maison-chantier-cuisine (ardoise-de-chantier), maison-chantier-chambre (ardoise-de-chantier), maison-chantier-troisieme-piece (ardoise-de-chantier), maison-chantier-etage (ardoise-de-chantier), maison-chantier-cave (ardoise-de-chantier). Points: maison-lit-g (lit), maison-lit-d (lit), maison-cuisine (poste).

**la maison du garde, étage** (`interieurs/maison-etage.json`, 10 x 7 m, 70 m², niveau 1): sous le toit, ouvert à l'acte 2 (chambre d'amis, atelier).

```text
. . . . . . . . . .
. . . . . . . . . .
. . . . . . . . . .
. . . . . * . . . .
. . . . . E . . . .
. . . . . . . . . .
. . . . . . . . . .
```

Pièces: grenier aménageable (10 x 7). Meubles: aucun. Points: maison-etage-milieu (poste).

**la cave de la maison** (`interieurs/maison-cave.json`, 5 x 4 m, 20 m², niveau -1): la lanterne sans verre (acte 3) y attend; l'escalier descend à l'aplomb de celui de la chambre.

```text
. E . C T
. . * . .
. . . . .
E . . . C
```

Pièces: cave voûtée (5 x 4). Meubles: cave-coffre (coffre), maison-cave-etagere (etagere-murale), maison-cave-caisse (caisse-de-legumes), maison-cave-tonnelet (tonnelet), maison-cave-bocaux (bocaux-de-confiture, sur cave-coffre), maison-cave-pots (pots-de-gres, sur cave-coffre). Points: cave-lanterne (poste).

**l'épicerie Ferrand** (`interieurs/epicerie-rdc.json`, 7 x 9 m, 63 m², niveau 0): la boutique donne sur la place (porte à l'est), la cuisine derrière.

```text
E C . E C C E
. . . . . . .
. * C . . . P
. . C . . . B
T . . . . . H
# # # . . # #
. V V . . P C
B T T . . . .
C * T . C T E
```

Pièces: boutique (7 x 5); cuisine (7 x 4). Meubles: epicerie-comptoir (comptoir-epicerie), epicerie-cuisiniere (cuisiniere), epicerie-table (table-a-manger), epicerie-rdc-etagere-1 (etagere-murale), epicerie-rdc-etagere-2 (etagere-murale), epicerie-rdc-etagere-3 (etagere-murale), epicerie-rdc-caisse-1 (caisse-de-legumes), epicerie-rdc-caisse-2 (caisse-de-legumes), epicerie-rdc-caisse-4 (caisse-de-legumes), epicerie-rdc-tonnelet (tonnelet), epicerie-rdc-horloge (horloge-murale), epicerie-rdc-balai (balai), epicerie-rdc-portrait (cadre-portrait), epicerie-rdc-buches (buches-d-interieur), epicerie-rdc-seau (seau), epicerie-rdc-vaisselier (vaisselier), epicerie-rdc-panier (panier-a-linge), epicerie-rdc-tonnelet-2 (tonnelet), epicerie-rdc-caisse-3 (caisse-de-legumes), epicerie-rdc-tapis-de-sol (tapis-rond), epicerie-rdc-bocaux (bocaux-de-confiture, sur epicerie-comptoir), epicerie-rdc-boites (boites-a-provisions, sur epicerie-comptoir), epicerie-rdc-pain (corbeille-de-pain, sur epicerie-table), epicerie-rdc-lampe (lampe-a-petrole, sur epicerie-table). Points: odette-comptoir (comptoir, Odette), odette-cuisine (poste, Odette).

**la pension Ferrand, étage** (`interieurs/epicerie-etage.json`, 7 x 9 m, 63 m², niveau 1): la chambre du premier soir, deux lits simples; l'escalier arrive sur un palier, la chambre d'Odette à côté.

```text
L C L C P . P
L * L * T . .
. T T T . . .
. . . . . . C
. . . . . . E
# # # # # . .
L C . . . . .
L * T T # . .
P . T T # . E
```

Pièces: chambre de la pension (7 x 5); chambre d’Odette (4 x 3); palier (2 x 4). Meubles: lit-pension-1 (lit-simple), lit-pension-2 (lit-simple), odette-lit (lit-simple), epicerie-etage-gravure (cadre-paysage), epicerie-etage-patere (patere), epicerie-etage-portrait (cadre-portrait), epicerie-etage-etagere (etagere-murale), epicerie-etage-panier (panier-a-linge), epicerie-etage-tapis-de-sol (tapis-long), epicerie-etage-tabouret (tabouret-de-ferme), epicerie-etage-odette-panier (panier-a-linge), epicerie-etage-odette-tapis-rond (tapis-rond), epicerie-etage-chevet (caisse), epicerie-etage-odette-chevet (caisse), epicerie-etage-chevet-lampe (lampe-de-table, sur epicerie-etage-chevet), epicerie-etage-odette-livres (pile-de-livres, sur epicerie-etage-odette-chevet), epicerie-etage-odette-lampe (lampe-a-petrole, sur epicerie-etage-odette-chevet). Points: pension-lit-a (lit), pension-lit-b (lit), odette-lit-p (lit, Odette).

**le fournil d'Achille** (`interieurs/fournil.json`, 6 x 5 m, 30 m², niveau 0): le four contre le pignon est, côté ru; la boutique sur la rue.

```text
E P P . B F
S . B T * C
# # . T C E
T . . T . H
P . . P . P
```

Pièces: boutique (6 x 3); fournil (6 x 2). Meubles: fournil-four (four), fournil-petrin (plan-de-travail), fournil-comptoir (comptoir-fournil), fournil-etagere (etagere-murale), fournil-buches (buches-d-interieur), fournil-affiche (cadre-paysage), fournil-etagere-pains (etagere-murale), fournil-horloge (horloge-murale), fournil-patere (patere), fournil-seau (seau), fournil-balai (balai), fournil-tabouret (tabouret-de-ferme), fournil-panier (panier-a-linge), fournil-tapis-de-sol (tapis-long), fournil-pain (corbeille-de-pain, sur fournil-comptoir), fournil-boites (boites-a-provisions, sur fournil-petrin). Points: achille-four (poste, Achille), achille-comptoir (comptoir, Achille).

**la mercerie-coiffure** (`interieurs/mercerie.json`, 6 x 6 m, 36 m², niveau 0): porte au nord sur la rue; la cabine sert à essayer les tenues.

```text
E E . P . P
. C C . . C
. . * . . .
P T T T # *
S T * . # M
B . . . . A
```

Pièces: boutique (6 x 3); salon de coiffure (4 x 3); cabine (2 x 3). Meubles: mercerie-comptoir (comptoir-mercerie), mercerie-fauteuil (chaise), mercerie-armoire (armoire), mercerie-miroir (miroir), mercerie-rubans (etagere-murale), mercerie-boutons (etagere-murale), mercerie-patere (patere), mercerie-affiche (cadre-portrait), mercerie-panier (panier-a-linge), mercerie-balai (balai), mercerie-tapis-de-sol (tapis-rond), mercerie-tabouret (tabouret-de-ferme), mercerie-seau (seau), mercerie-boites-boutons (boites-a-provisions, sur mercerie-comptoir), mercerie-bouquet (bouquet, sur mercerie-comptoir), mercerie-patrons (pile-de-livres, sur mercerie-comptoir). Points: solange-comptoir (comptoir, Solange), jeanne-fauteuil (poste, Jeanne), mercerie-cabine (poste).

**la forge** (`interieurs/forge.json`, 5 x 5 m, 25 m², niveau 0): foyer au nord sous la hotte; l'enclume est dehors, sous l'auvent.

```text
E S F B P
. T * . E
C . . * R
T . . . C
B . P . T
```

Pièces: forge (5 x 5). Meubles: forge-foyer (four), forge-haches (ratelier-de-la-forge), forge-coffre (coffre), forge-fers (etagere-murale), forge-patere (patere), forge-outils (etagere-murale), forge-seau (seau), forge-buches (buches-d-interieur), forge-tonnelet (tonnelet), forge-balai (balai), forge-fers-neufs (caisse), forge-tonneau (tonneau), forge-tabouret (tabouret-de-ferme), forge-lampe (lampe-a-petrole, sur forge-coffre), forge-clous (boites-a-provisions, sur forge-coffre). Points: mado-foyer (poste, Mado), mado-etabli (poste, Mado).

**l'atelier de Basile** (`interieurs/atelier-basile.json`, 9 x 7 m, 63 m², niveau 0): atelier d'une pièce, porte à l'est vers l'auvent.

```text
E E . P P S C P E
. . . . * T . . .
. . . . . . . . .
. . . . . . . . P
. . . . . . . . .
T . . . . . . . E
T . B . . . . . B
```

Pièces: atelier (9 x 7). Meubles: basile-etabli (plan-de-travail), basile-bois (tas-de-bois), basile-haches (etal-de-haches), atelier-basile-rabots (etagere-murale), atelier-basile-outils (etagere-murale), atelier-basile-patere (patere), atelier-basile-planches (etagere-murale), atelier-basile-balai (balai), atelier-basile-seau (seau), atelier-basile-tabouret (tabouret-de-ferme), atelier-basile-buches (buches-d-interieur), atelier-basile-tonnelet (tonnelet), atelier-basile-chevilles (caisse), atelier-basile-carnet (pile-de-livres, sur basile-etabli), atelier-basile-lampe (lampe-a-petrole, sur basile-etabli). Points: basile-p-etabli (poste, Basile).

**le café de la Halte** (`interieurs/cafe.json`, 6 x 5 m, 30 m², niveau 0): salle sur la rue (porte au sud, côté terrasse), comptoir et coin cuisine au nord; allée de 2 m de la porte au comptoir, passage derrière le comptoir à l'est.

```text
C E E . * H
S . . T C .
T C . T . C
T C . T . T
T . B P C C
```

Pièces: cuisine et comptoir (6 x 2); salle (6 x 3). Meubles: cafe-cuisiniere (cuisiniere), cafe-plan (plan-de-travail), cafe-comptoir (comptoir-cafe), cafe-table-1 (table-a-manger), cafe-chaise-1 (chaise), cafe-chaise-2 (chaise), cafe-table-2 (table-a-manger), cafe-chaise-3 (chaise), cafe-chaise-4 (chaise), cafe-etagere-1 (etagere-murale), cafe-etagere-2 (etagere-murale), cafe-horloge (horloge-murale), cafe-portrait (cadre-portrait), cafe-tonnelet (tonnelet), cafe-seau (seau), cafe-balai (balai), cafe-tapis-de-sol (tapis-long), cafe-pendule (pendule, sur cafe-comptoir), cafe-boites (boites-a-provisions, sur cafe-plan), cafe-bocaux (bocaux-de-confiture, sur cafe-plan), cafe-bouquet-1 (bouquet, sur cafe-table-1), cafe-pain (corbeille-de-pain, sur cafe-table-1), cafe-journal (journal, sur cafe-table-2), cafe-bouquet-2 (bouquet, sur cafe-table-2). Points: colette-comptoir (comptoir, Colette).

**l'école-mairie** (`interieurs/ecole.json`, 6 x 5 m, 30 m², niveau 0): une seule salle: l'instituteur est aussi secrétaire de mairie (armoire des archives, table du registre); les bancs regardent le tableau, au nord.

```text
P . . B . A
B . T * C .
B B . . B B
T T . . . .
. S . P B P
```

Pièces: classe et secrétariat de mairie (6 x 5). Meubles: ecole-tableau (blackboard, à créer), ecole-archives (armoire), ecole-banc-1 (banc), ecole-banc-2 (banc), ecole-table-mairie (table-a-manger), ecole-patere (patere), ecole-poele (poele), ecole-buches (buches-d-interieur), ecole-balai (balai), ecole-seau (seau), ecole-caisse (caisse), ecole-tabouret (tabouret-de-ferme), ecole-registres (pile-de-livres, sur ecole-table-mairie), ecole-lampe (lampe-de-table, sur ecole-table-mairie), ecole-journal (journal, sur ecole-table-mairie), ecole-bouquet (bouquet, sur ecole-table-mairie), ecole-cahiers (pile-de-livres, sur ecole-caisse). Points: armand-tableau (poste, Armand).

**l'église Saint-Aubin** (`interieurs/eglise.json`, 20 x 11 m, 220 m², niveau 0): portail latéral au sud, chœur à l'est, clocher à l'ouest: on entre face à l'allée, la corde de la cloche pend dans la base du clocher.

```text
# # # # # # . . . . . . . . . . . . . .
# # # # # # . . B . . . B . B . . . . .
# # # # # # . . B . . . B . B . . . . .
. . . . B # . . . . . . . . . . . . . .
. . * . . # . . . . . . . . . . . . . .
E . . . . . . T T T T T T T T T . * A .
. . . . . . . . . . . . . . . . . . . .
. . . . S # . . B . . . B . B . . . . .
# # # # # # . . B . . . B . B . . . . .
# # # # # # . . . . . . . . . . . . . .
# # # # # # . . . . P . . . . . . . . .
```

Pièces: base du clocher (5 x 5); nef (12 x 11); chœur (2 x 11). Meubles: eglise-autel (altar, à créer), eglise-banc-1 (banc), eglise-banc-2 (banc), eglise-banc-3 (banc), eglise-banc-4 (banc), eglise-banc-5 (banc), eglise-banc-6 (banc), eglise-tapis-1 (tapis-long), eglise-tapis-2 (tapis-long), eglise-tapis-3 (tapis-long), eglise-balai (balai), eglise-seau (seau). Points: marthe-corde (poste, Marthe), eglise-choeur (poste).

**la chambre des cloches** (`interieurs/eglise-clocher.json`, 5 x 5 m, 25 m², niveau 1): en haut de l'échelle du sonneur: la cloche au milieu, les abat-son ouverts sur le bourg (la vue de « La robe et la cloche »); le niveau intermédiaire attend l'écriture de la suite.

```text
. . . . .
. . . . .
E . B . .
. . . . .
. . * . .
```

Pièces: chambre des cloches (5 x 5). Meubles: clocher-cloche (bell, à créer). Points: clocher-vue (poste).

**le poste d'aiguillage, rez-de-chaussée** (`interieurs/poste.json`, 5 x 3 m, 15 m², niveau 0): les tringles des leviers descendent vers la voie; l'escalier monte à la cabine.

```text
H . P . P
. . * . C
C . . B E
```

Pièces: salle des transmissions (5 x 3). Meubles: poste-coffre (coffre), poste-horloge (horloge-murale), poste-patere (patere), poste-plan-voies (cadre-paysage), poste-balai (balai), poste-lampe (lampe-de-table, sur poste-coffre), poste-registre (journal, sur poste-coffre). Points: poste-bas (poste).

**la cabine des leviers** (`interieurs/poste-cabine.json`, 5 x 3 m, 15 m², niveau 1): les leviers face à la voie (nord), la vitre donne sur le sémaphore: celui du dedans lit les étiquettes, celui du dehors voit le bras.

```text
P . L . C
B . * . .
C . . . E
```

Pièces: cabine vitrée (5 x 3). Meubles: poste-leviers (lever-frame, à créer), poste-chaise (chaise), poste-cabine-poele (poele), poste-cabine-buches (buches-d-interieur), poste-cabine-plan-voies (cadre-paysage). Points: poste-cabine-leviers (poste).

**le moulin de la Vanne, salle des meules** (`interieurs/moulin.json`, 7 x 7 m, 49 m², niveau 0): porte au nord sur la cour; les meules au milieu, l'arbre de la roue entre par le pignon sud.

```text
. . . P . S .
. T . . . . .
. . . . . . .
. . . . * B C
. . . M . . T
. . . . . . .
E . . . . C C
```

Pièces: salle des meules (7 x 7). Meubles: moulin-meules (millstones, à créer), moulin-sacs (coffre), moulin-portrait (cadre-portrait), moulin-balai (balai), moulin-tabouret (tabouret-de-ferme), moulin-seau (seau), moulin-caisse (caisse), moulin-tonneau (tonneau), moulin-lampe (lampe-a-petrole, sur moulin-sacs), moulin-moutures (pile-de-livres, sur moulin-sacs). Points: berthe-meules (poste, Berthe).

**le grenier du moulin** (`interieurs/moulin-etage.json`, 7 x 7 m, 49 m², niveau 1): le grain monté en sacs, la trémie au-dessus des meules; le lit de Berthe au coin nord-ouest: le meunier dort au moulin, il entend la meule et la vanne.

```text
L P . P . . C
L * . . . . C
. . . . . . C
. . . * . . T
. . . . . . .
. . . . . . .
E . . . . . .
```

Pièces: grenier à grain (7 x 7). Meubles: moulin-grain-1 (coffre), moulin-grain-2 (coffre), berthe-lit (lit-simple), moulin-etage-patere (patere), moulin-etage-panier (panier-a-linge), moulin-etage-caisse (caisse), moulin-etage-tonneau (tonneau), moulin-etage-lampe (lampe-a-petrole, sur moulin-grain-1). Points: moulin-grenier (poste), berthe-lit-p (lit, Berthe).

**le logis de la ferme Delmas** (`interieurs/ferme-logis.json`, 8 x 5 m, 40 m², niveau 0): une salle commune: la cuisine au nord-ouest, la grande table à l'est de l'allée, la porte au midi sur la cour.

```text
C P P E H . . A
. * . S . C . .
B . . . . T T P
C . . . . * T .
T . . B P . . P
```

Pièces: salle commune (8 x 5). Meubles: logis-cuisiniere (cuisiniere), logis-plan (plan-de-travail), logis-table (table-a-manger), logis-chaise-1 (chaise), logis-chaise-2 (chaise), logis-armoire (armoire), ferme-logis-etagere (etagere-murale), ferme-logis-horloge (horloge-murale), ferme-logis-patere (patere), ferme-logis-seau (seau), ferme-logis-buches (buches-d-interieur), ferme-logis-caisse (caisse-de-legumes), ferme-logis-tonnelet (tonnelet), ferme-logis-panier (panier-a-linge), ferme-logis-balai (balai), ferme-logis-tapis-de-sol (tapis-rond), ferme-logis-lampe (lampe-a-petrole, sur logis-table), ferme-logis-pain (corbeille-de-pain, sur logis-table), ferme-logis-pots (pots-de-gres, sur logis-plan). Points: margot-cuisine (poste, Margot), paulin-table (poste, Paulin).

**la maison de Marthe** (`interieurs/marthe.json`, 5 x 5 m, 25 m², niveau 0): la maison de la sonneuse: une salle, le lit au fond contre le mur ouest, la table au midi; 1,5 m libres devant la porte, à l'est sur la rue de l'Église.

```text
C C P E P
L * . . .
. . T T P
. C T T .
T T . . S
```

Pièces: salle (5 x 5). Meubles: marthe-lit (lit-simple), marthe-table (table-a-manger), marthe-chaise (chaise), marthe-soeur (cadre-ovale), marthe-horloge (horloge-murale), marthe-etagere (etagere-murale), marthe-patere (patere), marthe-panier (panier-a-linge), marthe-seau (seau), marthe-tapis-de-sol (tapis-rond), marthe-chevet (caisse), marthe-lampe (lampe-a-petrole, sur marthe-table), marthe-journal (journal, sur marthe-table), marthe-bouquet (bouquet, sur marthe-table), marthe-missel (pile-de-livres, sur marthe-chevet). Points: marthe-lit-p (lit, Marthe).

<!-- genere:interieurs:fin -->

Prévus, pas encore dessinés: la maison de Firmin, le niveau intermédiaire du clocher (il attend l'écriture de « La robe et la cloche »). Les six de la version 3 (café, école-mairie, église et chambre des cloches, poste et cabine des leviers, moulin et grenier, logis de la ferme) sont ci-dessus.

### Repris de l'écriture de l'acte 1

Les objets que les quêtes de l'acte 1 citent sont posés par le plan, à leur place: `banc-du-quai`, `pompe-de-la-place`, `chene-lisiere-1` et `-2`, `ronces-maison-1` et `-2` (contre la ruine), `potager` (au bout de l'allée du jardin), `lit-pension-1` et `-2` (chambre de la pension, à l'étage de l'épicerie), `lit-de-la-maison` (dans la salle de la maison, la seule pièce couverte au début). Un nouveau passage de l'outil ne les efface plus.

## 13. Version 3: le plan raccordé à l'histoire écrite

### Les verrous « contournables »: d'où venait l'écart

L'auteur des actes 2 et 3 a mesuré « V2 seul ouvre 97 % de la zone v et 76 % de la zone r; V5 et V6 ouvrent 99 % de la zone t sans V8 » sur la carte de sa branche, qui était encore celle de la version 1 (commit de l'acte 1, avant l'assembleur de la version 2). Rejouée sur cette carte, la mesure redonne exactement 97, 76 et 99 %. Sur la carte de la version 2 intégrée, V2 seul ouvrait 10 % de « v » et 1 % de « r », V5 et V6 18 % de « t » (le belvédère seul): les verrous tenaient. Mais l'histoire réelle demandait autre chose, et trois défauts restaient, que le contrôle par verrou isolé ne voyait pas:

1. **La zone « v » trop tôt fermée**: l'histoire l'ouvre à l'article 7 (V2, `unlock_zone v`), avant les frênes; la version 2 mettait les frênes au premier tiers de la voie, si bien que la zone restait fermée pour le jeu (10 % des cases) jusqu'au chapitre suivant, et le test de l'acte 2 échouait. Les frênes sont maintenant dans un étranglement juste avant le poste: V2 ouvre 62 % de la zone, V2b le reste.
2. **La rivière fermée après la leçon de pêche**: le portillon de la berge du moulin (V4, acte 3) passait par un coin du bourg, et l'outil posait un second carré de V4 sur le sentier de l'Île. V1 seul ne donnait que 8 % de « r ». Le portillon descend maintenant droit du pré du meunier (`mp`): V1 seul donne 92 %.
3. **Le sentier des Crêtes coupé par la porte haute du cimetière**: le carrefour `k1` était dans le carré de V7; tant que Marthe n'a pas prêté la clé, le chemin de l'étang au belvédère était coupé sur la grille alors que le graphe le disait ouvert. `k1` est remonté de 5 m.

Le contrôle relit maintenant les fiches de quêtes et de scènes (`requires`, chapitres, `after`, effets `remember` sur `aubrune.verrou.*` et `unlock_zone`), énumère tous les ordres que les fils parallèles permettent (15 états), et rejoue chacun sur la grille du lieu: chaque zone ouverte par l'histoire l'est sur la grille (la moitié de ses cases, règle du jeu), aucune autre, aucun nœud d'une zone fermée n'est atteint hors de son antichambre déclarée, grille et graphe disent la même chose nœud par nœud, et la cible de chaque étape est atteignable quand elle s'ouvre.

<!-- genere:ordre_histoire:debut -->
| Acte | Étape (fiche) | Verrous levés | Zone ouverte | Ce qui s’ouvre sur la carte |
|---|---|---|---|---|
| 2 | `la-minute-d-ecart/article-7` | V2 | La voie jusqu'au poste d'aiguillage | la tranchée et la plaine du garage, jusqu'aux frênes |
| 2 | `la-minute-d-ecart/degager` | V2b | (aucune: dans une zone déjà ouverte) | l'étranglement et la clairière du poste |
| 2 | `la-minute-d-ecart/leviers` | V11 | La rivière et le bief | la descente vers la vanne: la rivière par l'amont |
| 2 | `la-minute-d-ecart/lecon` | V1 | La rivière et le bief | le saule débité: la rivière par l'aval (fil parallèle à celui de la voie) |
| 3 | `ceux-qui-partent/chambre` | V5, V6 | La Côte | la Côte par la barrière et le raidillon |
| 3 | `ceux-qui-partent/tirage` | V8 | Le tunnel | la ligne morte et le tunnel |
| 3 | `ceux-qui-partent/train-des-cinq` | V4 | Le moulin | la cour du moulin et le portillon de la berge |
| 3 | `ceux-qui-partent/gue` | V3, V9 | La ferme | le gué refait et la passerelle des Jardins |
| 3 | `ceux-qui-partent/lumignon` | V7 | (aucune: dans une zone déjà ouverte) | la porte haute du cimetière (raccourci des Crêtes) |
| 3 | `ceux-qui-partent/cachette` | V10 | (aucune: dans une zone déjà ouverte) | l'escalier de service, du tunnel au belvédère |

Antichambre: Le tunnel, nœuds `k3`, `bv`: le belvédère de l'Éperon est au bout du sentier des Crêtes: on le découvre avec la Côte (chapitre 1 de l'acte 3); le tunnel, lui, n'ouvre qu'avec la grille.
<!-- genere:ordre_histoire:fin -->

### Ce que l'histoire utilise, posé sur le plan

Types existants seulement (`donnees/commun/meubles` et `ressources`): chênes (`chene`, repoussent en 3 jours), pierres plates (`caillou`, 1 jour), mûres (`ronces`), poulailler (`poulailler`, pondoirs et parc), réchaud (`rechaud`). Chaque objet a son « pourquoi » dans `plan.json` et dans `carte.json` (champ `pourquoi`). Les verrous fermés disent leur phrase « pas encore » (champ `says`).

<!-- genere:objets_histoire:debut -->
| Objet | Type du jeu | Où (x, y) | Pourquoi là |
|---|---|---|---|
| caillou-greve-1 | caillou | 185, 129.4 | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-2 | caillou | 186.6, 129.4 | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-3 | caillou | 188.2, 129.4 | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-4 | caillou | 189.8, 129.4 | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-5 | caillou | 191.4, 129.4 | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-6 | caillou | 184, 129.6 | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-ile-1 | caillou | 39, 146.4 | pierres plates de la grève de l'Île, au pied de la vanne (i4) |
| caillou-ile-2 | caillou | 41, 146.4 | pierres plates de la grève de l'Île, au pied de la vanne (i4) |
| caillou-ile-3 | caillou | 43, 146.4 | pierres plates de la grève de l'Île, au pied de la vanne (i4) |
| caillou-ile-4 | caillou | 45, 146.4 | pierres plates de la grève de l'Île, au pied de la vanne (i4) |
| ronces-tranchee-1 | ronces | 144.5, 95.5 | les ronces des talus de la tranchée (tw2): mûres de l'été et de l'automne, sans barrer la voie |
| ronces-tranchee-2 | ronces | 148.5, 95.5 | les ronces des talus de la tranchée (tw2): mûres de l'été et de l'automne, sans barrer la voie |
| ronces-tranchee-3 | ronces | 146.5, 99.5 | les ronces des talus de la tranchée (tw2): mûres de l'été et de l'automne, sans barrer la voie |
| poulailler-jardin | poulailler | 161.5, 120 | le poulailler du jardin (3 x 2 m) en haut de son parc, à 5,5 m du pignon ouest de la maison: sa rampe descend au sud dans le parc, qui ne touche pas le chemin |
| wagon-oublie | (à créer: `wagon-old`) | 69, 93.5 | le wagon oublié sur la voie de garage, porte côté ligne: la cabane de Jeanne (41 bâtons à la craie) |
| chene-lisiere-3 | chene | 186, 84.2 | lisière: les bûches de l'acte 2 (cuisine, commande, hache); repousse en 3 jours, à 3 m du château d'eau |
| chene-lisiere-4 | chene | 192.5, 84 | lisière: second chêne de l'acte 2, hors du chemin forestier |
| chene-coupe-1 | chene | 157, 51 | la coupe de Basile (c2): les huit bûches de la chambre, au bord du chemin forestier |
| chene-coupe-2 | chene | 158, 64 | la coupe de Basile, côté aval du chemin |
| chene-coupe-3 | chene | 167, 56 | la coupe de Basile, côté amont |
| chene-coupe-4 | chene | 171, 60 | la coupe de Basile, vers le carrefour du bas |
| maison-rechaud | rechaud | cuisine de la maison (6,5; 6,5) | le réchaud de l’œuf au plat, contre le mur sud, façade vers la pièce |
| legumes-ferme | (point) | 216, 155,5 | le potager de la ferme, à l’est de la cour |
<!-- genere:objets_histoire:fin -->

Coins de pêche: `peche-lieu.json` (écrit par l'assembleur) propose le champ `fishing` de `lieu.json` pour les six coins, avec le plus grand rectangle d'eau près de chacun; `lieu.json` appartient à l'écriture, il reste à le recopier. Poissons et poids: proposition à équilibrer par le game designer.

Ce qui manque pour que la carte porte tout (rien n'est inventé):

<!-- genere:manques:debut -->
| Besoin de l’histoire | Ce qui manque dans `donnees/commun/` (ou ailleurs) | En attendant |
|---|---|---|
| frênes couchés à abattre à la hache forgée (`tw3`, V2b) | ressource « coupe » qui exige un outil de niveau 1 (le chêne accepte la hache de base, `minTier` 0) | aujourd'hui: y revenir avec la hache forgée |
| vanne à ouvrir (`vn`) | meuble à brique « manœuvrer » qui pose un fait (la roue tourne) | aujourd'hui: y arriver (`v1`) |
| légumes de la ferme (carotte, poireau, pomme de terre) au potager de la ferme | cultures `carotte`, `poireau`, `pomme-de-terre` (seuls `radis` et `tomate` existent) | point `legumes-ferme` posé, parcelle « potager de la ferme » dessinée |
| bœuf chez Odette (`pl-o`) | article du commerce d'Odette (lot commerce, pas la carte) | rien à poser sur la carte |
| coins de pêche `i2` et `ponton` | champ `fishing` de `lieu.json` (fiche de l'écriture) | proposition calculée par l'assembleur, à recopier |
| réchaud puis cuisinière | un meuble qui apparaît avec un fait (`aubrune.maison.rechaud`) | les deux sont posés dans la cuisine dès le début |
| comptoirs, tableau noir, autel, cloche, leviers, meules du moulin | modèles et types de meubles (`comptoir-buvette` exige un commerce) | posés dans les plans des intérieurs, listés « à créer » |
<!-- genere:manques:fin -->

### Pour le rendu des grands lieux

`outils/plan-vers-lieu.ts` exporte maintenant: la nature de chaque parcelle dans le terrain (`place`, `cimetiere`, `pre`, `labour`, `cour`, `potager`, `verger`, codes ajoutés après les 14 premiers, plus aucun `champ`), les tracés des voies ferrées (`rails`: ligne entière depuis le bord ouest, tunnel, voie de garage du poste, voie de la remise) et la nature des repères (`kind`: `arbre` pour le Vieux Chêne et le Gros Noyer, `clocher`, `chateau-d-eau`, `signal`, `roue`, `portail`, `pigeonnier`). Deux champs facultatifs ajoutés au schéma de la carte (`rails`, `kind` d'un repère). L'assembleur ne remplace plus la nature des parcelles par un sol: seules l'herbe des zones et les surfaces particulières (lande, galets, vase, friche) reçoivent un sol détaillé. Le rendu doit encore associer un aspect à ces nouveaux noms (`GROUND_LOOKS`) et lire `rails` et `kind`.

### Lisibilité des images

Étiquettes de verrou jamais plus petites qu'à 0,6 de l'échelle du plan d'ensemble (zone 5); pastilles des trajets de quête posées après tous les tracés, écartées de leur nœud avec un trait quand elles en chevauchent une autre ou une étiquette de verrou (acte 2); noms des repères placés au-dessus, au-dessous ou à côté, là où ils ne couvrent ni numéro ni pastille (le clocher et le numéro 20); « l'éperon (rocher) » descendu sous le portail du tunnel; flèche du nord à gauche de l'échelle dans le bandeau.

## 14. Règle d'accès: tout ce que l'histoire utilise s'atteint à pied

### La règle

Pour le dehors et les 19 fichiers d'intérieurs (13 bâtiments, leurs étages, la cave et la cabine), dans chacun des 16 états d'ouverture que l'histoire permet (les 15 ordres des verrous relus dans les fiches, plus « tous levés »): toute porte, tout escalier, tout meuble à brique (lit, siège, coffre, comptoir, réchaud, établi, poulailler...), tout point nommé par une quête, une scène, un planning d'habitant ou la fiche du lieu, et tout point d'un intérieur s'atteint à pied depuis le quai. Un élément n'est attendu dans un état que si le graphe des chemins y atteint son nœud le plus proche (dans la même salle, ou dehors): ce qui est derrière un verrou fermé attend son ouverture.

La marche suit le jeu: quatre voisins, murs, cloisons et meubles solides bloquent (emprise réelle du meuble: centre, taille du type, rotation); passer une porte ou un escalier fait arriver 1 m devant sa jumelle, ou sur la case libre la plus proche (`passDoor`); la case d'une porte ne se traverse pas (y entrer, c'est la passer). Trois règles de gabarit s'y ajoutent dans les intérieurs: chaque porte et chaque escalier font arriver dans la salle qu'ils desservent; aucun meuble n'est posé à cheval sur des cases (un meuble de 1 x 1 posé sur un coin de case en bloque quatre); de l'arrivée de chaque salle à chaque escalier et à chaque lit des joueurs, un passage de 2 cases (deux corps de 0,6 m s'y croisent; 1,41 m en diagonale entre deux coins de meubles suffit). Les lits des habitants (celui d'Odette) en sont dispensés.

Deux contrôles disent la même chose: `controler_plan.py` (section « accès », liste de ce qui manque avec sa position, et cinq casses de plus dans `--eprouver`, dont les deux signalements) et `tests/points-de-quete.test.ts` du jeu (`unreachableStoryElements` de `tests/aides-acces.ts`, pour tout lieu, avec les mêmes casses rejouées sur une copie des fiches).

### Avant: 33 éléments inaccessibles, dans 6 intérieurs

| Intérieur | Inaccessible | Cause |
|---|---|---|
| épicerie, rez-de-chaussée | l'escalier, la cuisinière, le point `odette-cuisine` | la table (2 x 1) posée en y 7 bloquait deux rangées, juste sous la baie de 1 m: la cuisine était coupée de la boutique (signalement 1) |
| pension, étage | l'escalier, les trois lits, les points `pension-lit-a`, `-b`, `odette-lit-p` | rien n'y menait (l'escalier du bas inaccessible); de plus on traversait la chambre d'Odette pour aller à la pension |
| maison, rez-de-chaussée | les deux escaliers, la cuisinière, le plan de travail, le réchaud, une chaise, l'armoire, les points `maison-lit-g`, `-d`, `maison-cuisine` | la table et les deux chaises posées sur des coins de case faisaient un mur de 2 x 4 m du nord à la cloison de la cuisine: la porte d'entrée ne menait qu'à 4 cases et au lit (signalement 2: escaliers non reliés, ce n'était pas voulu) |
| maison, étage et cave | l'escalier de chacun, le coffre et le point `cave-lanterne` de la cave, le point `maison-etage-milieu` | par le rez-de-chaussée; la cave sert pourtant à la fin de l'acte 2 et à l'acte 3 (la lanterne) |
| moulin, grenier | l'escalier, les deux coffres de grain, le point `moulin-grenier` | les deux escaliers faisaient arriver « vers le sud », dans le mur: on se retrouvait hors du moulin, sous l'annexe |
| café | la cuisinière, une chaise | la cuisinière enfermée derrière le plan de travail et sa cloison; une chaise dans un coin que seule la case de la porte desservait |
| logis de la ferme | l'armoire, le point `paulin-table` | chaise, table, chaise et porte en diagonale coupaient la salle en deux, une chaise devant l'entrée |

À quoi s'ajoutaient (52 erreurs du contrôle en tout): 6 meubles à cheval (la table et les deux chaises de la maison, la table de l'épicerie, causes des deux signalements; le banc et le bureau de la halte, qui bloquaient 3 cases au lieu de 2), 2 escaliers qui faisaient arriver hors de leur salle (moulin) et 11 passages de moins de 2 m vers un escalier ou un lit (baie de l'épicerie, palier de la pension, arc du clocher de l'église, salle de la maison, et le moulin par son arrivée dans le mur). L'ancienne règle du test ne voyait rien: elle ne suivait que les cibles des étapes, dont `pl-o` (devant l'épicerie) pour la nuit à la pension.

### Après: 0

| Intérieur | Correction | Pourquoi là |
|---|---|---|
| épicerie, rez-de-chaussée | baie de 2 m (x 3-4); table en (2; 7,5), à l'ouest de la cuisine; `odette-cuisine` en (1,5; 8,5) | les pensionnaires traversent la cuisine pour monter: la table près du fourneau, hors du trajet de la baie à l'escalier |
| pension, étage | palier de 2 m (x 5-6) de l'escalier à la pension; chambre d'Odette (4 x 3) ouverte sur le palier; points de lit au chevet de chaque lit | on ne traverse plus la chambre de la logeuse |
| maison, rez-de-chaussée | salle et cuisine en une salle commune; table contre le mur nord près de la porte, une chaise au bout et une devant; lit double contre le mur est, tête au mur; refend ouvert en y 2-3; escalier de l'étage qui fait arriver face à la salle, celui de la cave face à la chambre | 2 m libres de la porte au refend, aux escaliers et aux feux; on dort toujours dans la salle (la seule pièce couverte au début) |
| maison, cave | escalier en (0,5; 3,5), à l'aplomb de celui de la chambre | un escalier descend sur place |
| moulin et grenier | escaliers qui font arriver vers le nord, dans la salle | le coin sud-ouest est contre deux murs |
| café | plus de cloison: le coin cuisine s'ouvre derrière le comptoir; tables contre les murs est et ouest, chaises tournées vers elles; allée de 2 m de la porte au comptoir | un café de village cuisine derrière son comptoir; on entre face au comptoir |
| logis de la ferme | table et chaises à l'est de l'allée de la porte | l'entrée et la cuisine restent dégagées, la table reste au cœur de la salle commune |
| halte | banc en x 1, bureau en x 8 (centres entiers pour les meubles de 2 m) | chaque meuble bloque ses deux cases, pas trois |
| église et chambre des cloches | arc du clocher de 2 m (y 5-6); échelle du sonneur en (0,5; 2,5), à l'aplomb du pied de l'échelle | on y monte à deux |

Aucune porte de bâtiment n'a bougé: toutes les portes d'entrée restent au droit de la porte du plan (et des fiches de bâtiments). Seuls les escaliers intérieurs ont changé de sens d'arrivée ou de place.

Défaut vu hors de la règle, pas corrigé ici: 49 objets du dehors sont posés à cheval (chênes, cailloux, bancs, pompe, tas de bois, poulailler, potager), centres entiers pour un meuble de 1 m ou demi-entiers pour un meuble de 2 m; aucun ne coupe un passage (la règle d'accès passe), mais chacun bloque 2 à 6 cases de plus que son emprise. Proposition: arrondir les centres dans l'assembleur, après vérification des tests qui citent ces positions.

## 15. Manques relevés la nuit du 2026-11-11

Tout passe par `construire_plan.py` (bloc « version 4 »), puis l'outil du paquet et l'assembleur; `controler_plan.py`: 0 erreur, 255 éléments accessibles dans 20 intérieurs et le dehors (243 dans 19 avant).

| Élément | Où | Pourquoi là, dans ce sens |
|---|---|---|
| Grue à eau (repère `grue_eau`, nature `grue-a-eau`, modèle `water-crane`) | x 189, y 95,3 | en face du château d'eau (x 189, y 87), qui la remplit par une conduite enterrée de 8 m droit vers le sud; au bord nord de la voie, colonne à 2,2 m de l'axe des rails: le bras tourne au-dessus de la locomotive à l'arrêt devant le quai. Le rendu l'oriente vers la voie (entrée de données dans `LANDMARK_LOOKS`) |
| Maison de Marthe (`interieurs/marthe.json`, 5 x 5 m) | porte à l'est, au droit de la porte du plan | une salle: le lit au fond contre le mur ouest, loin de la rue; la table au midi, sous la fenêtre au soleil; 1,5 m libres devant la porte. Ni cuisinière ni armoire: on ne cuisine ni ne range chez une voisine |
| Lit de Berthe (grenier du moulin) | coin nord-ouest | le meunier dort au moulin, au-dessus des meules: il entend la meule et la vanne la nuit; loin de l'escalier (sud-ouest) et des sacs de grain (est) |
| Plannings de nuit | `habitants/marthe.json`, `berthe.json` | de 21 h à 7 h, `{ "bed": "marthe-lit" }` et `{ "bed": "berthe-lit" }`; chez soi: le point au chevet (`marthe-lit-p`, `berthe-lit-p`), comme Odette |
| Pommier (`pommier-verger`, type `pommier-d-automne`, pommes en automne seulement) | verger communal, x 309,5, y 118,5 | le coin de cueillette `pommes-verger` est 1,5 m au sud-est, côté caméra, hors du houppier |
| Coquelicots (`coquelicots-verger`, `coquelicots-champs`) | herbe haute du verger (acte 1); tournière des champs des Delmas, entre le chemin des Champs et le labour (acte 3) | le coquelicot pousse dans l'herbe qu'on ne fauche qu'en juillet et au bord des blés |
| Enclume (`enclume-forge`, type `enclume`) | x 262,5, y 103,5 | contre le mur ouest de la forge, sous l'auvent, au bord de la rue de l'Église; Mado se tient côté rue (`mado-enclume`), le foyer est derrière le mur. L'amélioration d'outil a enfin son meuble |
| Râtelier de Basile | x 176,5, y 90,5, façade à l'est | dos au mur est de l'atelier, à côté de la porte (il flottait à 1,2 m du mur) |
| Poulailler du jardin | x 161,5, y 120 | posé sur ses 3 x 2 cases (il en bloquait 4 x 2), en haut de son parc; la rampe du modèle descend au sud dans le parc |
| Quai | 27 m au lieu de 30 | la traversée de service coupait le bout est du quai (cases 212 à 214, rang 99): le quai s'arrête maintenant 3 m avant la halte, la traversée passe entre les deux au niveau des rails, on monte sur le quai d'une marche. Lanterne du bout est ramenée en x 210,5 |

Revenu possible ajouté, tirages à leur moyenne, sans besoin du jour ni amitié (méthode de `economie-aubrune.md`, section 3): pommier, 2 tirages de 1 à 2 pommes par jour, 3 x 0,70 = 2,10 €; coquelicots, 1 à 2 fleurs par touffe et par jour au printemps et en été, 1,5 x 0,60 = 0,90 € par touffe. Actes 1 et 2: 3,00 € par jour (2,10 € en automne et en hiver); acte 3: 3,90 €. Au plus haut tirage: 5,20 €. La fiche commune `fruitier` donne des pommes toute l'année; le plan les voulait à l'automne (`pommes-verger`): à trancher par le game designer dans `donnees/commun/ressources/fruitier.json`.

### Natures du sol sans aspect ou sans arbres

Le rendu ne connaît pas l'aspect de neuf natures écrites par le plan et l'outil (peintes en herbe par repli, `DEFAULT_LOOK`), et ne sème d'arbres que sur `herbe`, `hors-jeu` et `pre` (`tileDecor`):

| Nature | Cases | D'où elle vient | Aspect | Arbres semés |
|---|---|---|---|---|
| `sous-bois` | 13 532 | la Côte (zone) | non | non: la Côte, bois de 4 arbres pour 100 m² dans le plan, n'en a aucun hors des arbres posés |
| `friche-rocheuse` | 4 041 | le tunnel (zone) | non | non (plan: 1,2 pour 100 m²) |
| `herbe-rase` | 3 786 | le bourg (zone) | non | non (plan: 0,2 pour 100 m²) |
| `friche` | 1 422 | la voie (zone), la clairière du poste | non | non (plan: 0,6 sur les talus) |
| `prairie-humide` | 1 156 | la rivière (zone) | non | non (plan: 1,5, ripisylve) |
| `lande` | 482 | la crête aux myrtilles | non | non (voulu) |
| `cimetiere` | 186 | parcelle | non | non (voulu) |
| `verger` | 182 | parcelle | non | non (le pommier est posé) |
| `place` | 148 | place et parvis | non (pavés attendus) | non (voulu) |

Corrigé par le plan: `prairie` (clairières de la Côte, prairie du milieu, prés du Haut) était un second nom de `pre`, que le rendu connaît; ces cases prennent l'aspect du pré et ses arbres isolés. Le reste relève du rendu, sans code moteur: une ligne par nature dans `GROUND_LOOKS` (`reglages-tuiles.ts`), et un semis d'arbres par nature au lieu des trois noms écrits dans `tileDecor` (densités du tableau « Végétation par zones », section 12, déjà dans `plan.json`, champ `vegetation`). Renommer `sous-bois` en `herbe` rendrait les arbres tout de suite, mais tous en pleine version (seul `hors-jeu` est allégé): le budget du bois est à mesurer d'abord.

### Les six points des suites secondaires remis à leur place

Les essais des grands lieux chargent maintenant les points, meubles et portes de la carte assemblée (`withAssembly`): les étapes qui visaient un nœud du dehors visent leur point.

| Suite, étape | Avant | Maintenant |
|---|---|---|
| Les lettres, le sac postal | `gr2`, devant la halte | `halte-p-guichet`, dans la halte (Firmin y marche; répliques du seuil ajustées: casier tiré jusqu'au guichet, Lucie passe la tête par la porte) |
| La robe, le clocher | `pv`, le parvis | `clocher-vue`, la chambre des cloches |
| La robe, la coulée | `gr6`, le carrefour | `mado-enclume`, l'enclume (les deux sœurs restent au carrefour) |
| Le fantôme, les deux guets | `mc`, la porte du moulin | `guet-moulin`, la cachette de Léon dans la cour |
| La Baronne, l'affût; la fanfare, le trombone | `i2`, le sentier de l'Île | `peche-fosse`, le coin de pêche sous la roue |
| La soupe, le guet du sel | `pl-o`, devant l'épicerie | `siege-tonnelle`, sous la tonnelle |

### Hors du plan

Train de nuit: les deux joueurs s'assoient en diagonale (mesuré: (2,33; 3,75) et (4,67; 3,25)), parce que chacun prend la première place libre de sa banquette et que deux banquettes face à face numérotent leurs places en miroir. Les données du lieu n'y peuvent rien sans poser une banquette à cheval sur le couloir. Correctif de code proposé: prendre la place libre la plus proche du joueur (`freeSeat` de `simulation/briques/postures.ts`).

## 16. Intérieurs habités et vues du dehors (revue visuelle du 2026-11-11, corrections 2 et 5)

Source: `construire_plan.py`, section « version 5 » (`HABITE`, `DECOR_VUES`); chaque objet porte son `pourquoi` dans `plan.json`. Contrôle: `controler_habillage` de `controler_plan.py`.

### Règles de pose

- **Pas d'objet de plateau** (levé par la version 6, section 17: le champ `on` existe). Le rendu pose tout objet de la carte au sol (`base: 0` dans `rendu/lieu/description.ts`) et le schéma des pièces n'a ni hauteur ni « posé sur »: seuls les objets de sol, les tapis et les objets muraux sont posés. Les objets de plateau attendent ce moyen (liste plus bas).
- **Murs debout seulement.** La caméra regarde du sud-ouest (lacet 45): les murs nord et est restent debout, les murs sud et ouest sont coupés. Un objet mural va au mur nord (rotation 0) ou au mur est (rotation 3), jamais sur une cloison (le rendu ne la dessine pas).
- **Fenêtres intactes.** Un objet de 1,3 m et plus collé à un mur fait glisser ou supprime la fenêtre derrière lui (`roomPlan`, `tallObject`); le balai (1,4 m) compte. Relevé du rendu avant et après: les 89 fenêtres des 20 pièces sont aux mêmes places. C'est ce qui a retiré l'affiche du café, la carte et l'horloge de l'école, la gravure et le portrait de mariage de la ferme, la patère et l'étagère du moulin: leurs seuls pans de mur sont entre deux fenêtres trop proches.
- **Noms.** Un identifiant qui finit par `-tapis` est réservé au paillasson d'une porte (`doorVolumes`, `tests/rendu/chargement.test.ts`): les tapis posés s'appellent `<pièce>-tapis-de-sol`.
- **Passages.** 1,5 m libres devant chaque porte et chaque escalier (deux cases; un tapis y est permis: c'est un paillasson); rien sur un point; rien dans l'emprise prévue d'un meuble sans modèle (guichet, tableau, meules, autel, leviers, cloche). Le contrôle d'accès (section 14) a fait retirer les bûches du café et de la maison (elles enfermaient la cuisinière ou la place de Colette) et déplacer celles de la ferme et de l'atelier.

### Choix qui ne vont pas de soi

- **La maison du garde reste légère** (8 objets): c'est la maison des joueurs, qu'ils meublent eux-mêmes (stock et décoration du logement). On n'y pose que ce qu'une salle commune a toujours (patère à la porte, horloge, portrait au-dessus du lit, seau près de la cuisinière, panier au pied du lit, tapis de passage) et, dans la moitié en ruine, le balai et le seau du déblayage. L'étage (absent au départ) reste vide; la cave a ses conserves, ses pommes de terre et un tonnelet oublié.
- **Halte**: l'horloge est au coin du bureau de Firmin, au mur est, vue par le guichet: le mur nord de la salle n'a pas un pan qui ne masque une fenêtre. Le poêle est au milieu de la salle d'attente, à 1 m du mur, comme dans les salles d'attente de gare: les deux cases devant le guichet restent aux voyageurs.
- **Café**: la case (3; 0) reste vide: c'est le seul passage vers la place de Colette derrière le comptoir. Le tabouret du bout du comptoir (« le tabouret du bout devient le tien ») attend un comptoir de deux cases: devant le comptoir d'une case, il prend la place du client (`tests/postes-habitants.test.ts`).
- **Épicerie**: le vaisselier est dos à la cloison de la boutique, une case à l'est du mur ouest (collé au mur, il masquait une fenêtre); le portrait de la cuisine est celui de la mère d'Odette (le bocal de cerises).
- **Fournil**: le tabouret près de la fenêtre ouest, pour Achille « à moitié endormi »; le bois du four est à côté de lui, jamais devant sa gueule.
- **Moulin**: le portrait de la mère de Berthe face aux meules, qui portent son nom (Marguerite).
- **Église**: trois tapis dans l'allée centrale, de l'arc du clocher au chœur; Marthe range seau et balai dans la base du clocher. La chambre des cloches reste vide (la cloche n'a pas de modèle).

### Nombre d'objets ajoutés par pièce

| Pièce | Objets ajoutés | Objets de plateau en attente (posés sur) |
|---|---|---|
| maison-rdc | 8 | lampe à pétrole, corbeille de pain, journal (table) |
| maison-cave | 3 | bocaux de confiture, pots de grès (étagère) |
| halte | 9 | lampe de table, journal (bureau de Firmin) |
| café | 8 | pendule, bocaux (comptoir); bouquet, corbeille de pain (tables); boîtes à provisions (plan de travail) |
| épicerie, boutique et cuisine | 16 | bocaux de confiture, boîtes à provisions, pots de grès (étal, comptoir); corbeille de pain, lampe à pétrole (table du souper) |
| pension (étage) | 9 | lampe de table, pile de livres (tabouret de nuit) |
| fournil | 11 | corbeilles de pain (comptoir) |
| mercerie | 8 | boîtes à provisions (comptoir), bouquet |
| forge | 7 | aucun |
| atelier de Basile | 9 | pile de livres (établi) |
| école | 5 | pile de livres, lampe de table (table de la mairie) |
| ferme, salle commune | 10 | lampe à pétrole, corbeille de pain (table); pots de grès (plan de travail) |
| Marthe | 5 | lampe à pétrole, journal, bouquet (table) |
| moulin, meules | 4 | lampe à pétrole (coffre) |
| moulin, grenier | 2 | lampe à pétrole (coffre à grain) |
| église | 5 | bouquet (autel, à créer) |
| poste, cabine | 4, 3 | lampe de table, journal (coffre, chaise: à revoir avec la tablette) |
| étage de la maison, chambre des cloches | 0, 0 | |

Total: 126 objets. Une pièce de vie en a de 8 à 16 posés, plus 2 à 5 de plateau en attente: le seuil de 12 n'est tenu aujourd'hui que par l'épicerie; avec les objets de plateau, le café, le fournil et la ferme l'atteignent; la maison (les joueurs la meublent), la halte et la pension restent à 11.

### Vues de jour du dehors

30 objets, des types sans brique de récolte (seau, tonnelet, cageot, panier, bûches, banc, banc de table): rien de récoltable n'est ajouté, rien n'est déplacé.

| Vue | Objets | Où et pourquoi |
|---|---|---|
| ferme (220; 162) | 8 | cageots de récolte et seau au bord du potager de la ferme, banc et panier du casse-croûte face aux champs, tonnelet et seau au coin du labour |
| talus (196; 141,5) | 6 | bois et tonnelet contre le mur nord du logis, banc face à la rivière avec son panier, seau en haut de la berge |
| clôture (151; 101,5) | 5 | banc des cheminots face à la voie, bois fendu au pied de la clôture, cageot et seau de leur jardin |
| berge (195,5; 127,2) | 5 | tonnelet contre le mur sud de la pension, panier et seau de lessive, bois flotté qui sèche au-dessus de la grève |
| rue du bourg (204; 124) | 4 | seau sous la pompe, tonnelet de la tonnelle, panier et seau de lessive en haut de la berge |
| orée (104; 90) | 2 | tonnelet et seau de graisse oubliés au bord de la plaine du garage |

Ces vues ne tiendront pas la règle « aucune zone vide de plus de 4 x 4 m » sans ce qui leur revient vraiment, qui a un modèle livré mais aucun type de meuble (`donnees/commun/meubles`, hors du plan): rochers et blocs (`rock`, `boulder`, moussus), buissons (`berry-bush`), herbes sauvages (`wild-herbs`), tonneau (`barrel`), caisse (`crate`), banc de ferme (`bench-farm`), tas de bûches (`log-pile`), puits (`well`), auge de pierre (`sink-stone`, l'abreuvoir), baquet (`tub`), clôture (`fence`). Il faut pour chacun un type de décor sans brique (non récoltable). Modèles qui manquent tout à fait: brouette, piquets de champ à ruban rouge (ceux de Paulin), fourche et râteau, corde à linge et son linge, meule de foin, tas de traverses et de ballast (orée), barque retournée et nasse (berge).

### Fouilles à fiche propre

`fouille-roche`, `fouille-ballast` et `fouille-pierre-levee` portent `fiche` dans `RESSOURCES`; l'assembleur l'écrit en `resource` sur l'objet du même nom.

## 17. Objets posés sur les meubles et décor du dehors (version 6, 2026-11-11)

Source: `construire_plan.py`, section « version 6 » (`SUR`, `HABITE_6`, `DECOR_6`). L'assembleur écrit `on` sur l'objet; `controler_poses` de `controler_plan.py` le contrôle (le banc d'épreuve casse quatre poses de plus: hors du plateau, sur une chaise, contre une fenêtre, l'un dans l'autre).

### Règles de pose sur un meuble

- **Sur le plateau libre.** La place se donne dans le repère du modèle du porteur (le long du meuble, vers sa façade), sur la partie que le modèle laisse libre: les sommets au-dessus du plateau ont été relevés dans les GLB. Le comptoir d'Odette garde sa balance et ses bocaux à gauche, celui de Colette sa cafetière et ses tasses au milieu, celui d'Achille ses miches à gauche, celui de Solange ses coupons; les objets ajoutés vont sur le bord côté client ou sur le bout resté nu.
- **Dans la boîte du modèle**, pas seulement dans la case: un comptoir déborde de 0,25 m vers le client et recule de 0,43 m; une table de 1,40 x 0,80 m laisse 0,30 m vide à chaque bout de ses deux cases. Le contrôle lit les bornes dans le GLB.
- **Fenêtres.** Le rendu décale une fenêtre derrière tout volume de 1,3 m et plus à 0,75 m d'un mur, plateau compris: la pendule du café (1,41 m sur le zinc) et le bouquet de Solange (1,51 m) sont à plus de 0,75 m des murs; rien n'est posé sur une étagère murale ni sur le vaisselier.
- **Usage intact.** Rien sur un tabouret ni une chaise (on s'y assoit); le journal va devant la chaise, la lampe au bout côté mur. Les objets posés ne bloquent pas et ne se visent pas: on s'assoit à la table et le comptoir sert comme avant.
- **Une caisse sert de chevet** là où il n'y avait pas de meuble à plateau (pension, Odette, Marthe, école): c'est une vraie caisse (fiche `caisse`, plateau à 0,60 m), pas un tabouret détourné.

### Petits objets par pièce (sol, mur et plateau)

| Pièce | Avant | Après | Posés sur un meuble |
|---|---|---|---|
| maison-rdc | 8 | 12 | lampe à pétrole, corbeille de pain, journal (table); pots de grès (plan de travail) |
| maison-cave | 3 | 5 | bocaux, pots de grès (coffre) |
| halte | 9 | 12 | lampe de table, registres, journal (bureau de Firmin) |
| café | 8 | 15 | pendule (zinc); boîtes, bocaux (plan de travail); bouquet et corbeille (table 1); journal et bouquet (table 2) |
| épicerie | 16 | 20 | bocaux, boîtes (comptoir); corbeille de pain, lampe à pétrole (table du souper) |
| pension | 9 | 14 | lampe de table (caisse entre les lits); cahiers et lampe d'Odette (sa caisse de chevet) |
| fournil | 11 | 13 | corbeille de pain (comptoir); boîtes (pétrin) |
| mercerie | 8 | 12 | boîtes de boutons, bouquet, catalogues (comptoir); seau du shampoing au sol |
| forge | 7 | 12 | lampe, boîtes de clous (coffre); caisse de fers, tonneau d'eau, tabouret au sol |
| atelier de Basile | 9 | 12 | carnet, lampe (établi); caisse de chevilles au sol |
| école | 5 | 12 | registres, lampe, journal, bouquet (table de la mairie); cahiers (caisse des ardoises); tabouret du maître |
| ferme, salle commune | 10 | 13 | lampe, corbeille (table); pots de grès (plan de travail) |
| Marthe | 5 | 12 | lampe, journal, bouquet (table); missel (caisse de chevet); seau, tapis |
| moulin, meules | 4 | 8 | lampe, livre des moutures (coffre aux sacs); caisse, tonneau |
| moulin, grenier | 2 | 5 | lampe (coffre à grain); caisse, tonneau |
| poste | 4 | 6 | lampe, registre (coffre) |
| église, cabine, étage de la maison, chambre des cloches | 5, 3, 0, 0 | inchangé | l'autel et la cloche n'ont pas de modèle; la cabine n'a pas de plateau |

Total: 191 petits objets (126 avant), dont 55 posés sur un meuble. Les pièces de vie ont toutes 12 objets ou plus, sauf le moulin (8) et son grenier (5): les meules et leur emprise prennent le milieu de la salle, le grenier est une réserve. La maison du garde reste à 12 et sans rien de plus: les joueurs la meublent eux-mêmes.

### Types de décor du dehors (sans récolte)

Fiches créées dans `donnees/commun/meubles/`, sur des modèles déjà livrés; emprise lue sur la boîte du manifeste (une case tant que le modèle y tient à 7 cm près de chaque côté); non posables par les joueurs (pas de vignette).

| Fiche | Modèle | Boîte (m) | Emprise | Solide | Remarque |
|---|---|---|---|---|---|
| `rocher`, `rocher-moussu` | `rock`, `rock-mossy` | 0,93 x 0,70; 0,96 x 0,88 | 1 x 1 | oui | |
| `gros-rocher`, `gros-rocher-moussu` | `boulder`, `boulder-mossy` | 1,42 x 1,42; 1,45 x 1,43 | 2 x 2 | oui | |
| `buisson` | `berry-bush-bare` | 1,00 x 1,14 | 1 x 1 | oui | le buisson sans baies: un buisson à baies qu'on ne cueille pas tromperait |
| `herbes-hautes` | `wild-herbs` | 0,73 x 0,70 | 1 x 1 | non | |
| `tonneau` | `barrel` | 0,62 x 0,62 | 1 x 1 | oui | plateau 0,85 m |
| `caisse` | `crate` | 0,60 x 0,61 | 1 x 1 | oui | plateau 0,60 m |
| `banc-de-ferme` | `bench-farm` | 1,40 x 0,39 | 2 x 1 | oui | on s'y assoit (deux places), comme les autres bancs |
| `tas-de-buches` | `log-pile` | 0,91 x 0,87 | 1 x 1 | oui | `tas-de-bois` reste la réserve où l'on prend des bûches |
| `puits` | `well` | 2,10 x 1,80 | 2 x 2 | oui | non posé: la pompe de la place est sur l'ancien puits |
| `abreuvoir-de-pierre` | `sink-stone` | 1,00 x 0,56 | 1 x 1 | oui | plateau 0,85 m; non posé (à regarder en jeu avant: le modèle est un évier) |
| `baquet` | `tub` | 1,50 x 0,72 | 2 x 1 | oui | |
| `cloture` | `fence` | 2,02 x 0,16 | 2 x 1 | oui | |

### Vues du dehors

Mesure: cadre de chaque capture (lacet 0: largeur donnée, profondeur 0,97 fois la largeur; rue du bourg: lacet 45, 18 m), plus grand carré de cases sans objet, bâtiment ni case bloquée. Ne comptent pas comme vides l'eau, la voie, le hors-jeu (forêt semée), les cultures et la circulation (route, rue, chemin, quai), où l'on ne pose rien. La végétation semée par le rendu (arbres et touffes sur l'herbe et le pré) n'est pas comptée: la mesure est prudente.

| Vue | Ajoutés (version 6) | Plus grand vide restant | Ce qui a été posé, et pourquoi |
|---|---|---|---|
| ferme (220; 162) | 27 | 4 x 4 | clôture du potager sur trois côtés (les bêtes n'y entrent pas, le côté du chemin reste ouvert pour les cageots); tas d'épierrage au coin du potager et au bord du labour; bloc que la charrue contourne; herbes hautes de la tournière; buissons de la haie vive |
| talus (196; 141,5) | 14 | 4 x 4 | buisson et herbes hautes en haut de la berge; bloc moussu à mi-pente; tas de bûches contre le pignon ouest du logis; baquet de lessive de Margot; les tonneaux de cidre du plan, enfin posés |
| clôture (151; 101,5) | 10 | 3 x 3 | herbes hautes au pied de la clôture de la voie (la faux n'y passe pas); tonneau d'eau de pluie et caisse du jardin des cheminots; borne de pierre; buisson qui ferme le pré |
| berge (195,5; 127,2) | 3 | 3 x 3 | joncs au bord de l'eau, sureau au coin de la tonnelle |
| orée (104; 90) | 22 | 4 x 4 | buissons, herbes hautes et pierres moussues du sous-bois (la forêt gagne par l'orée), bûches d'une ancienne coupe; herbes et buissons de la friche du garage |
| rue du bourg (204; 124) | 1 | 4 x 4 | les cageots du plan devant la vitrine d'Odette, enfin posés |

Rien n'est posé sur un chemin, une route, un seuil, un nœud ni contre un point; rien de récoltable. Le tonneau de la terrasse du café a trouvé sa place en version 9, de l'autre côté de la Grand-Route (section 20). La rue du bourg tient la mesure, mais la critique du directeur artistique porte sur le cadrage (aucune façade): c'est la vue qui est à recadrer.

### Le comptoir du café reste d'une case

Le modèle `comptoir-cafe` mesure 0,92 x 0,63 m: une fiche de deux cases laisserait 1 m de vide bloqué à côté du zinc. Le tabouret de Colette attend un comptoir de café de deux cases (1,90 m, comme ceux de l'épicerie, du fournil et de la mercerie), à demander à l'artiste.

### Modèles qui manquent pour ces vues (pour l'artiste)

| Modèle | Taille visée | Où |
|---|---|---|
| brouette | 1,4 x 0,6 m, 0,6 m de haut (1 x 2 cases) | ferme: au bord du chemin des Champs, à côté des cageots du potager (vers 216; 157,5) |
| fourche et râteau appuyés | 0,4 x 0,2 m, 1,6 m de haut (1 case) | ferme: contre la clôture du potager, côté est (223,5; 153,5) |
| corde à linge et son linge | 4 m entre deux piquets de 1,8 m (1 x 4 cases, non solide entre les piquets) | berge: au sud de la pension, entre le panier et le seau de lessive et la grève (vers 189 à 193; 123,5) |
| meule de foin | 2,5 m de diamètre, 3 m de haut (3 x 3 cases) | ferme: dans le pré à l'est du potager (vers 230; 156) ou au coin du pré sud (211; 162) |
| tas de traverses et de ballast | 2,6 x 1,2 m, 0,6 m de haut (3 x 2 cases) | orée: friche du garage, au bord de la plaine (vers 95; 93) |
| barque retournée et nasse | barque 3,5 x 1,2 m (4 x 2 cases), nasse 0,6 m (1 case) | berge: sur la grève, à l'ouest des bois flottés (vers 186; 128,5) |
| piquets à ruban rouge (Paulin) | piquet de 1,2 m, ruban; une file de 4 à 6 piquets espacés de 3 m | ferme: au bord du labour, la limite que Paulin dispute (le long de x 214, y 165 à 175) |
| comptoir de café de deux cases | 1,90 x 0,63 m, zinc à 1 m | café: à la place du comptoir actuel (4,5; 1,5), pour rendre son tabouret à Colette |

## 18. Le décor des fêtes et des veillées (version 7, 2026-11-11)

Les quatre fêtes et la veillée du quai (`../ecriture-fetes.md`) se voient maintenant le jour où elles ont lieu. 62 objets de carte (63 avant que l'estrade devienne permanente, section 20), tous posés par le plan (`construire_plan.py`, section « version 7 »), chacun avec sa condition `when`, que l'assembleur écrit dans `carte.json` (le plan l'emporte sur une retouche à la main; les `when` ajoutés à la main dans les intérieurs restent conservés).

### Quand le décor paraît

- **Toute la fête**: `event_is` sur la fête, en `begun`. Le décor paraît quand la fête commence (10 h, ou 18 h 30 pour une veillée) et disparaît à l'aube suivante, quand l'agenda ne dit plus « commencée aujourd'hui »: le bourg a rangé avant le matin (`le-bourg-range-la-fete`, 6 h à 10 h, ne fait plus que relever les lisses).
- **Les lisses fleuries** demandent en plus `aubrune.barrieres.lisses` = `baissees`: c'est la scène d'ouverture qui les baisse, la clôture qui les relève. Relevées, elles ne se dessinent pas: aucun jour ordinaire ne montre de lisse (le modèle levé n'existe pas; les lisses du plan, `level-crossing-gate`, n'ont pas de type), la fête ne fait pas exception.
- **Les lumignons**: de 10 h à 20 h 30, les 21 lumignons coulés refroidissent en rangs sur le parvis; de 20 h 30 à l'aube, chacun est posé là où son habitant le veille (`time_is`). Celui de Rosalie s'éteint à 22 h, quand son train repart.
- **Le quai** porte un décor commun à toutes les veillées (les cinq fiches de veillée du quai) et à la Veillée du premier train: brasero, deux bancs, trois guirlandes. Les guirlandes servent aussi à la fête des barrières (le bout ouest du quai accueille Ambroise, Martial et Rosalie, et Achille sur le banc).

### Où, et pourquoi là

```text
Passage à niveau et quai (x 172 à 215, y 94 à 105): F décor solide, f décor non solide, * point, = voie, q bord du quai
             8         9         0         1
     23456789012345678901234567890123456789012345
  95 ,,,,,,,,FFFFF,,,,,,,,,,,,,,,,,,,========cccc   lisse nord (barrières)
  96 ========RRRRR===========================cccc
  97 ========RR*RR===========================cc*c
  98 ========RRRRR===========================ccc=
  99 ,,,,,,,,fFFFfrrqqqqqqqqqqqqqqqqqqqqqqqqqcccB   lisse sud (barrières); lumignons de Firmin et Jeanne
 100 ,,FFF,,,RRRR*rrrrrOOrrrrrrrOOrrrrrrrrrrrrrrB   bord du quai libre (rangées 99 et 100)
 101 ,,FFF,,,RR*RRrr*rrrrrrrrrrrr*rr*rrrrrrrrfrrB
 102 ,,FFF,,,RRRRRrroorrrrrFFFrrrrroo*OrrrroFr*rB   table de la tourte (hiver), brasero
 103 ,,FFF,,,RRRRRrrrrrrrrrrrrrrrrrrrfrrrrrrrrrrB   rue du quai libre
 104 ,,,,,F,offfff,F,,fffffffffffffffff,,FF,FF,,B   estrade, tonneaux, banderoles, guirlandes, bancs
 105 ,,,,,,,,RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR   Grand-Route

La place (x 194 à 213, y 110 à 122), concours de la soupe
           0         1
     45678901234567890123
 111 ,OOppppprrrrFppppOO,   ardoise du palmarès
 112 ,pppFFpprrrrpppFFpp,   marmite des mères (ouest), panade du moulin (est)
 113 OpppFFpprrrrpOOFFpp,
 116 D*r*rrrrrr*rcccccccc   pl-o, pl
 118 ,fOOpppprrrrpOO*ppp,   banc d'Honorine et sa place
 119 ,pOOOppprrropOOpFFp,   banc nord
 120 ,pOOOppprrroppppFFF,   grande table
 121 ,ppOOppprrrrppppFFp,   banc sud
```

- **Barrières fleuries.** Les deux lisses barrent la route du Gué en travers (bras est-ouest), une de chaque côté de la voie, jamais sur la voie: c'est ce que dit la scène (« la route du Gué est fermée, pour la plus belle raison de l'année »). On passe à pied par l'accotement, une case d'herbe libre à chaque bout (contrôlé). Firmin se tient contre la lisse sud, c'est son poste; Jeanne, Léon et Solange à 2 m au sud. La banderole est tendue au-dessus de la route, entre le carrefour et la lisse sud, face au sud: on la lit en venant du bourg. Le tonneau du café est sur l'herbe au coin du passage, à 5 m du carrefour où se tient Colette, hors de la route.
- **Nuit des lumignons.** Le jour, trois rangs de sept sur le parvis, à l'est du portail (deux cases libres devant la porte), au pied de la façade et près de Marthe, qui coule la cire. La nuit, un lumignon par habitant à un ou deux mètres de son poste de nuit, à l'endroit que l'écriture lui donne (`fete-lumignon-<habitant>`): Firmin et Jeanne aux deux coins de la route au bord de la voie, Odette sous la tonnelle, Basile à l'établi, Achille sous la fenêtre du fournil, Solange au seuil de la mercerie (hors des deux cases devant la porte), Mado au pied de l'enclume (rien ne se pose sur l'enclume), Barnabé devant la forge, Ambroise sur le quai côté bourg, Honorine deux à son seuil, Marthe au pied du clocher (à l'ouest du portail: le clocher est à l'ouest de la nef), Lucie à la boîte aux lettres, Colette sur la terrasse du café, Armand contre le lavoir, Paulin et Margot au gué, Léon en haut de la grève, Berthe au bout du ponton, Martial au cimetière, Rosalie sur le quai face à sa locomotive. Le lumignon n'est pas solide: il ne barre rien, même posé sur une route.
- **Concours de la soupe.** Les deux marmites se font face de part et d'autre de la rue du Bourg, au nord de la place, à 2 et 3 m de la rue: la soupe des mères côté épicerie (Odette et Colette se tiennent devant, `pl-o`), la panade du moulin à l'est de la pompe, que l'on atteint toujours par l'ouest et le sud. Chacun goûte une marmite différente: elles sont à 11 m l'une de l'autre, on se décrit ce qu'on a goûté. La grande table et ses deux bancs au sud-est, à côté du banc où Honorine préside (sa place et le devant du banc restent libres). L'ardoise du palmarès au coin nord-est, face au sud, lisible depuis le carrefour.
- **Veillée du premier train.** Le quai fait 5 m et le train du samedi reste à quai jusqu'à 22 h: les deux rangées du bord restent vides, la rue qui longe le quai au sud aussi. La table de la tourte va sur la troisième rangée, entre les deux bancs du quai, son long côté vers la voie (« la place du voyageur »): on passe au nord sur 3 m. L'estrade (4 x 3 m) n'a pas sa place sur le quai: elle est sur l'herbe à l'ouest de la route du Gué, face au quai, à 1 m du bord de la voie, et son ombre de caméra ne tombe que sur l'herbe et la voie. Depuis la version 9, c'est l'estrade permanente de la fanfare (`estrade-fanfare`, section 20), à la même place: la veillée n'en pose plus de seconde. Le tonneau au pied du bout ouest, près de Jeanne, Solange, Lucie et Armand. La banderole au-dessus du passage qui monte de la Grand-Route au quai, face au sud.
- **Veillées du quai.** Le brasero de Mado au bout est, sur la troisième rangée, à 1,5 m du poste `quai-e` (Mado, Barnabé, Basile, Berthe), à côté de la lanterne; deux bancs de ferme sur l'herbe au sud de la rue, face au feu et à la voie. Trois guirlandes sur l'herbe au sud du quai, du banc ouest au passage vers la Grand-Route (poteau de chaque guirlande à l'ouest, poteau de bout à l'est, à l'ouest du passage qu'il laisse libre): le quai est éclairé sans que rien n'y soit posé.

### Lumières

Le rendu pose une flaque de lumière pour les 6 lampes allumées les plus proches du point visé, à 26 m au plus (`MAX_LAMPS` de `src/rendu/encre/matiere.ts`, `INK_SETTINGS.lights.reach`); au-delà, une lampe garde son verre allumé sans flaque. Une fête ajoute (relevé de `controler_plan.py`, lampes de modèle seulement, sans les fenêtres):

| Fête | Lampes ajoutées | Au pire, à 26 m d'un poste | Dont lampes de fête | Où |
|---|---|---|---|---|
| Barrières fleuries | 3 guirlandes | 9 | 3 | `quai-o` |
| Nuit des lumignons, de 20 h 30 à l'aube | 21 lumignons | 18 | 10 | `pl-o` |
| Nuit des lumignons, de 10 h à 20 h 30 | 21 lumignons (sur le parvis, éteints de jour) | 26 | 21 | `mado-enclume` |
| Concours de la soupe | 2 feux de marmite | 11 | 2 | `gr1` |
| Veillée du premier train | 3 guirlandes, 1 brasero | 13 | 4 | `quai` |
| Veillées du quai (cinq fiches) | 3 guirlandes, 1 brasero | 13 | 4 | `quai` |

Répartition: sur le quai, trois guirlandes au lieu de quatre, le brasero à l'autre bout, et les trois lanternes du quai déjà là: depuis le milieu du quai, les 6 flaques sont la lanterne du milieu (1 m), la guirlande est (4,9 m), la lanterne est (6,5 m), le brasero (7,5 m), la guirlande du milieu (8,7 m) et le premier réverbère de la Grand-Route (12 m); la guirlande ouest (12,7 m) prend la place du réverbère dès qu'on fait trois pas vers l'ouest. La nuit des lumignons est faite de petites flaques (1,8 m de rayon), à un ou deux mètres de chaque habitant: au passage à niveau, les flaques sont celles de Firmin et de Jeanne (2,8 m), du réverbère du gué et de la lanterne ouest du quai; aucun poste n'a plus de dix lumignons à 26 m. Le seul amas est le parvis de jour, quand les lumignons ne brûlent pas encore; à la tombée du jour, avant 20 h 30, six seulement y posent leur flaque.

### Contrôles (`controler_fetes`)

Rien sur la voie (sol `voie`, ou à moins de 1,6 m des rails: au passage à niveau, le sol est celui de la route) ni sur les deux rangées du bord du quai; rien sur un point, un nœud, une porte ni les deux cases devant elle; rien de solide sur une route, une rue, un chemin ou un sentier (sauf les lisses, qui barrent par nature et se contournent par leurs deux bouts), ni à moins de 1 m d'un poste d'habitant de sa fête (0,4 m pour la lisse et le garde qui la manœuvre); pour chaque fête, son décor posé et celui des autres absent, tous ses postes s'atteignent à pied depuis le quai. La règle d'accès (section 14) est aussi tenue avec tout le décor posé à la fois. Test court: `tests/meubles-conditionnes.test.ts` (aucun décor un jour ordinaire, le concours seul le jour du concours, rangé le lendemain, lisses après la scène d'ouverture, lumignons du parvis puis du bourg, celui de Rosalie éteint à 22 h). Banc d'épreuve (`--eprouver`): lisse posée sur les rails, marmite au milieu de la rue, table au bord du quai, brasero sur le poste de Mado, poste muré par le décor, fête inconnue: six casses, six vues.

Coût mesuré: relire la présence des 63 objets (plus les 3 de la maison) prend 40 µs par appel sur la machine de travail chargée (charge 18 sur 4 cœurs); le moteur la relit à chaque pas de simulation. Si la cible (i3 de 2018) en souffre, un cache dans `presents.ts`, relu à chaque minute de jeu et à chaque fait retenu, suffirait (les `when` du lieu ne lisent que l'heure, l'agenda et des faits).

### Ce qui manque encore

- Une lisse fleurie levée (et une lisse ordinaire, baissée ou levée, avec son type): aujourd'hui, hors de la fête, le passage à niveau n'a pas de lisse dessinée. Positions préparées pour la lisse ordinaire: section 20.
- Le tonneau de la terrasse du café: posé en version 9 sur l'herbe rase en face du café (section 20); le lumignon de Colette reste au seuil du café.
- La lumière qui dérive au ponton (Berthe), la table de cire du parvis, la cloche du quai, le tableau des horaires et sa devise, les treillis et les pétales des barrières: pas de modèle.

<!-- genere:fetes:debut -->
| Objet | Type du jeu | Fête | Où (x, y) | Face au | En plus de la fête | Lampe | Pourquoi |
|---|---|---|---|---|---|---|---|
| fete-lisse-nord | lisse-fleurie | barrières | 182.5, 95.5 | sud | `aubrune.barrieres.lisses` = `baissees` |  | la lisse nord baissée en travers de la route, sur la rangée d'herbe au nord de la voie, jamais sur la voie |
| fete-lisse-sud | lisse-fleurie | barrières | 182.5, 99.5 | sud | `aubrune.barrieres.lisses` = `baissees` |  | la lisse sud baissée en travers de la route, juste au sud de la voie: Jeanne, Léon et Solange se tiennent à son pied (pn-s, 2 m au sud) |
| fete-barrieres-banderole | banderole | barrières | 182.5, 104.5 | sud | toute la fête |  | au-dessus de la route du Gué, entre le carrefour et la lisse sud, face au sud: on la lit en venant du bourg; non solide, elle ne barre rien |
| fete-barrieres-tonneau | tonneau-en-perce | barrières | 177.5, 104.5 | sud | toute la fête |  | le tonneau du café mis en perce par Colette, sur l'herbe au coin du passage à niveau: à 5 m du carrefour où elle se tient (gr0), hors de la route |
| fete-lumignon-parvis-01 | lumignon | lumignons (jour) | 261.5, 79.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-02 | lumignon | lumignons (jour) | 262.5, 79.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-03 | lumignon | lumignons (jour) | 263.5, 79.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-04 | lumignon | lumignons (jour) | 264.5, 79.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-05 | lumignon | lumignons (jour) | 265.5, 79.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-06 | lumignon | lumignons (jour) | 266.5, 79.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-07 | lumignon | lumignons (jour) | 267.5, 79.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-08 | lumignon | lumignons (jour) | 261.5, 80.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-09 | lumignon | lumignons (jour) | 262.5, 80.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-10 | lumignon | lumignons (jour) | 263.5, 80.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-11 | lumignon | lumignons (jour) | 264.5, 80.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-12 | lumignon | lumignons (jour) | 265.5, 80.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-13 | lumignon | lumignons (jour) | 266.5, 80.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-14 | lumignon | lumignons (jour) | 267.5, 80.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-15 | lumignon | lumignons (jour) | 262.5, 84.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-16 | lumignon | lumignons (jour) | 263.5, 84.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-17 | lumignon | lumignons (jour) | 264.5, 84.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-18 | lumignon | lumignons (jour) | 265.5, 84.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-19 | lumignon | lumignons (jour) | 266.5, 84.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-20 | lumignon | lumignons (jour) | 267.5, 84.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-parvis-21 | lumignon | lumignons (jour) | 268.5, 84.5 | sud | de 10 h 00 à 20 h 30 | oui | un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail |
| fete-lumignon-firmin | lumignon | lumignons (nuit) | 184.5, 99.5 | sud | de 20 h 30 à 6 h 00 | oui | à la barrière, coin est de la route au bord de la voie, à côté de son poste (pour son oncle) |
| fete-lumignon-jeanne | lumignon | lumignons (nuit) | 180.5, 99.5 | sud | de 20 h 30 à 6 h 00 | oui | à côté, coin ouest de la route au bord de la voie, en face de Firmin (pour le train de 5 h 12) |
| fete-lumignon-odette | lumignon | lumignons (nuit) | 195.5, 118.5 | sud | de 20 h 30 à 6 h 00 | oui | sous la tonnelle, au coin de la pension, près de la table du souper |
| fete-lumignon-basile | lumignon | lumignons (nuit) | 177.5, 91.5 | sud | de 20 h 30 à 6 h 00 | oui | au pied de l'établi, sous l'auvent de l'atelier |
| fete-lumignon-achille | lumignon | lumignons (nuit) | 230.5, 106.5 | sud | de 20 h 30 à 6 h 00 | oui | sous la fenêtre du fournil, à l'ouest de la porte |
| fete-lumignon-solange | lumignon | lumignons (nuit) | 234.5, 110.5 | sud | de 20 h 30 à 6 h 00 | oui | devant la mercerie, à côté du seuil (hors des deux cases devant la porte) |
| fete-lumignon-mado | lumignon | lumignons (nuit) | 262.5, 102.5 | sud | de 20 h 30 à 6 h 00 | oui | au pied de l'enclume, côté nord: le lumignon ne se pose pas sur l'enclume, il se pose contre |
| fete-lumignon-barnabe | lumignon | lumignons (nuit) | 264.5, 106.5 | sud | de 20 h 30 à 6 h 00 | oui | devant la forge, à l'ouest de la porte, côté rue de l'Église |
| fete-lumignon-ambroise | lumignon | lumignons (nuit) | 204.5, 103.5 | sud | de 20 h 30 à 6 h 00 | oui | sur le quai, côté bourg, sous la pendule de la halte (pour la minute) |
| fete-lumignon-honorine-1 | lumignon | lumignons (nuit) | 283.5, 106.5 | sud | de 20 h 30 à 6 h 00 | oui | sur son seuil, à gauche de la porte (pour sa marraine) |
| fete-lumignon-honorine-2 | lumignon | lumignons (nuit) | 286.5, 106.5 | sud | de 20 h 30 à 6 h 00 | oui | sur son seuil, à droite de la porte (« pour le plaisir ») |
| fete-lumignon-marthe | lumignon | lumignons (nuit) | 251.5, 79.5 | sud | de 20 h 30 à 6 h 00 | oui | au pied du clocher, à l'ouest du portail |
| fete-lumignon-lucie | lumignon | lumignons (nuit) | 249.5, 110.5 | sud | de 20 h 30 à 6 h 00 | oui | au pied de la boîte aux lettres du bourg, à sa grille |
| fete-lumignon-colette | lumignon | lumignons (nuit) | 252.5, 106.5 | sud | de 20 h 30 à 6 h 00 | oui | sur la terrasse du café, entre la porte et le coin de la vitrine |
| fete-lumignon-armand | lumignon | lumignons (nuit) | 220.5, 117.5 | sud | de 20 h 30 à 6 h 00 | oui | contre le lavoir, à côté de son ouverture |
| fete-lumignon-paulin | lumignon | lumignons (nuit) | 181.5, 129.5 | sud | de 20 h 30 à 6 h 00 | oui | au gué, sur la route qui descend à l'eau |
| fete-lumignon-margot | lumignon | lumignons (nuit) | 180.5, 129.5 | sud | de 20 h 30 à 6 h 00 | oui | au gué, à côté de celui de Paulin |
| fete-lumignon-leon | lumignon | lumignons (nuit) | 185.5, 127.5 | sud | de 20 h 30 à 6 h 00 | oui | en haut de la grève, au bord du chemin de la berge |
| fete-lumignon-berthe | lumignon | lumignons (nuit) | 202.5, 129.5 | sud | de 20 h 30 à 6 h 00 | oui | au bout du ponton (le sien part sur l'eau: la lumière qui dérive n'existe pas encore) |
| fete-lumignon-martial | lumignon | lumignons (nuit) | 282.5, 74.5 | sud | de 20 h 30 à 6 h 00 | oui | au cimetière, au bord de l'allée, entre les tombes: un seul, pour tous |
| fete-lumignon-rosalie | lumignon | lumignons (nuit) | 212.5, 101.5 | sud | de 20 h 30 à 22 h 00 | oui | sur le quai, au bout est, face à la locomotive à l'arrêt, jusqu'au départ de 22 h |
| fete-soupe-marmite-meres | grande-marmite | soupe | 199, 113 | sud | toute la fête | oui | la soupe des mères (Odette et Colette), côté épicerie, à 2 m de la rue: on y goûte depuis la place |
| fete-soupe-marmite-moulin | grande-marmite | soupe | 210, 113 | sud | toute la fête | oui | la panade du moulin (Berthe), en face, à l'est de la pompe: la pompe s'atteint toujours par l'ouest et le sud |
| fete-soupe-table | table-de-banquet | soupe | 211.5, 120.5 | sud | toute la fête |  | la grande table du concours, au sud-est de la place, à côté du banc où Honorine préside |
| fete-soupe-banc-nord | banc-de-table | soupe | 211, 119.5 | sud | toute la fête |  | le banc nord de la grande table, face à elle; le devant du banc d'Honorine reste libre |
| fete-soupe-banc-sud | banc-de-table | soupe | 211, 121.5 | nord | toute la fête |  | le banc sud de la grande table, face à elle |
| fete-soupe-ardoise | ardoise-a-craie | soupe | 206.5, 111.5 | sud | toute la fête |  | l'ardoise du palmarès, au coin nord-est de la place, face au sud: on la lit depuis le carrefour |
| fete-quai-guirlande-1 | guirlande-de-lampions | quai | 191.5, 104.5 | sud | toute la fête | oui | guirlande de lampions sur l'herbe au sud du quai, entre le quai et la Grand-Route: elle éclaire le quai sans rien poser dessus |
| fete-quai-guirlande-2 | guirlande-de-lampions | quai | 195.5, 104.5 | sud | toute la fête | oui | guirlande de lampions sur l'herbe au sud du quai, entre le quai et la Grand-Route: elle éclaire le quai sans rien poser dessus |
| fete-quai-guirlande-3 | guirlande-de-lampions | quai | 199.5, 104.5 | sud | toute la fête | oui | guirlande de lampions sur l'herbe au sud du quai, entre le quai et la Grand-Route: elle éclaire le quai sans rien poser dessus |
| fete-quai-poteau | poteau-de-guirlande | quai | 201.5, 104.5 | sud | toute la fête |  | le poteau du bout de la file, à l'ouest du passage vers la Grand-Route, qu'il laisse libre |
| fete-quai-brasero | brasero | quai | 211.5, 102.5 | sud | toute la fête | oui | le brasero de Mado au bout est du quai, sur la troisième rangée (hors du bord), à côté de la lanterne: Mado, Barnabé, Basile et Berthe se tiennent autour (quai-e, à 1,5 m); la rue qui longe le quai au sud reste libre |
| fete-quai-banc-1 | banc-de-ferme | quai | 212, 104.5 | nord | toute la fête |  | un banc sur l'herbe au sud de la rue du quai, face au brasero et à la voie |
| fete-quai-banc-2 | banc-de-ferme | quai | 209, 104.5 | nord | toute la fête |  | un second banc à côté, face au quai: les vieux s'assoient, les autres restent debout autour du feu |
| fete-hiver-table | table-de-banquet | hiver | 195.5, 102.5 | sud | toute la fête |  | la table de la tourte sur la dernière rangée du quai, entre les deux bancs, son long côté vers la voie (« côté voie, c'est la place du voyageur »): on passe au nord (3 m) et par la rue du quai au sud |
| fete-hiver-banderole | banderole | hiver | 204, 104.5 | sud | toute la fête |  | au-dessus du passage qui monte de la Grand-Route au quai, face au sud: on la lit en arrivant |
| fete-hiver-tonneau | tonneau-en-perce | hiver | 186.5, 104.5 | sud | toute la fête |  | le tonneau en perce sur l'herbe au pied du bout ouest du quai, près de Jeanne, Solange, Lucie et Armand (quai-o) |
<!-- genere:fetes:fin -->

## 19. Coquillages et rivière (version 8, 2026-11-11)

Activité cochée par le client (cahier 4.7, R28; audit du 11 novembre, B.7): « ramassage au bord de l'eau, selon l'heure et la pluie ». Aubrune est dans les terres: pas de coquillage de mer, mais ce qu'une rivière de campagne, un bief et un étang laissent sur leurs rives. Tout est en données (`donnees/commun/objets`, `ressources`, `meubles`, lignes de rachat des commerces) et posé par le plan (`construire_plan.py`, section « version 8 »), sans une ligne de moteur.

### Intention

- **Ce qu'elle enseigne**: regarder le bord de l'eau. Le matin tôt et après la pluie, la rive change; le joueur apprend qu'Aubrune vit avec son temps.
- **Ce qu'elle met à l'épreuve**: rien de difficile. Une promenade, des gestes d'une demi-seconde, des surprises rares (une plume bleue, une perle).
- **Émotion visée**: la flânerie à deux, les poches pleines de petites choses, le « regarde ce que j'ai trouvé ». Le revenu reste modeste (voir plus bas): on y va pour la balade, pas pour la bourse.
- **À deux**: rien n'exige les deux joueurs (activité de détente), mais la tournée se partage naturellement: l'un prend la grève du gué, l'autre le lavoir; chaque point donne à celui qui le ramasse, et chacun revient le lendemain.

### Les trouvailles

Description d'une phrase (ton du jeu): le schéma des objets n'a pas de champ de description (seules les pièces de tenue en ont un). Les phrases sont prêtes ici pour le jour où il existera (demande au développeur, via le manager), ou pour des entrées de carnet si le manager en décide.

| Objet (`id`) | Pile | Description | Rachat | Ressource, conditions | Rareté | Repousse |
|---|---|---|---|---|---|---|
| Coquille de rivière (`coquille-de-riviere`) | 10 | La maison vide d'une mulette, nacrée dedans comme un dimanche. | Solange 1,20 (boutons de nacre), Café 0,60 (pots de la terrasse) | `coquilles-de-greve`: 1 par temps sec, 2 ou 3 sous la pluie, la brume, l'orage ou la neige; `mulettes-du-bief`: 1 ou 2 | commune | 1 jour (grèves), 2 jours (anse) |
| Coquille d'escargot d'eau (`coquille-de-limnee`) | 10 | Une spirale grande comme un ongle: l'escargot est parti sans laisser d'adresse. | Solange 0,40 (le bord de ses boîtes à boutons) | `limnees-de-l-etang`: 1 ou 2 par temps sec, 2 ou 3 par temps mouillé; printemps, été, automne | commune | 1 jour |
| Galet veiné (`galet-veine`) | 5 | Un galet zébré de quartz blanc: Solange jure qu'il tient un patron mieux qu'un poids en fonte. | Solange 0,90 (poids à patron) | `galets-veines`: 1 | commune | 2 jours |
| Bois flotté (`bois-flotte`) | 10 | Une branche que la rivière a polie, blanchie, puis rendue un peu plus loin. | Solange 0,70 (sa vitrine), Café 0,50 (allume le poêle) | `laisse-de-crue`: 1 par temps sec, 2 ou 3 par temps mouillé | commune | 1 jour |
| Tesson de faïence (`tesson-de-faience`) | 10 | Un éclat d'assiette à fleurs bleues, adouci par l'eau: quelqu'un, au lavoir, n'a rien dit. | Café 1,00 (Colette recolle le service du café, lavé au lavoir) | `tessons-du-lavoir`: 1 | commune | 2 jours |
| Plume de héron (`plume-de-heron`) | 10 | Longue, grise et légère: le héron l'a perdue en faisant semblant de ne pas te voir. | Solange 0,80 (chapeaux) | `plumes-de-heron`: 1, de 6 h à 9 h seulement | commune | 1 jour |
| Plume de martin-pêcheur (`plume-de-martin-pecheur`) | 10 | Un éclat de bleu tombé d'un oiseau trop pressé. | Solange 2,40 (chapeaux du dimanche) | `plumes-de-heron`, même heure, poids 0,12 contre 1 (une plume sur neuf) | rare (chance des besoins) | 1 jour |
| Perle de rivière (`perle-de-riviere`, trésor) | 1 | Une perle d'eau douce, pas tout à fait ronde, comme les meilleures choses. | Solange 6,00 | `mulettes-du-bief`, poids 0,05 contre 1 (une fois sur vingt et une à l'anse) | rare (chance des besoins) | 2 jours |
| Girolle (`girolle`) | 10 | Un champignon couleur d'abricot qui sent la forêt et le beurre à venir. | Café 1,60, Épicerie 1,00 (prix du cahier, 4.6) | `girolles`: 1 ou 2 par temps sec, 2 ou 3 par temps mouillé, de 6 h à 12 h, été et automne | commune | 2 jours |

Hors saison, hors de l'heure ou par un temps qui n'ouvre aucune ligne, la touche d'action répond « rien pour l'instant » (`nothing-now`) au lieu de ramasser.

**Condition qui manque au moteur: « il a plu hier »**. Le cahier dit « après la pluie »; le butin ne lit que le temps du moment (`lootAvailable`, `outils/butin.ts`). En attendant, « plus après la pluie » s'écrit « plus quand il pleut, bruine ou neige » (`rain`, `mist`, `storm`, `snow`). Ce qu'il faudrait (une brique, pas un contenu): un champ facultatif d'une ligne de butin, `"rainedYesterday": true`, vrai si le temps du lieu, la veille, a été au moins une heure dans `wateringWeathers` entre `dayStart` et `nightStart`. `weatherAt(content, seed, place, day - 1, minute)` est déterministe: aucun état nouveau à sauvegarder ni à transmettre. Les fiches passeraient alors de `weathers` à `rainedYesterday` sans autre retouche.

### Où (raison d'être de chaque point)

Dix-neuf points, chacun sur une case au bord de l'eau (une case d'eau parmi les huit voisines; sauf les girolles, en sous-bois), jamais sur une route, une rue, un chemin, un sentier, un ouvrage ni un seuil, seul sur sa case (décor des fêtes compris). Leur « pourquoi » est dans le tableau du mobilier (section 12, généré) et dans `carte.json`.

Lettres: C coquilles, G galets, L laisse de crue (bois flotté), T tessons, P plumes, M mulettes, E escargots d'eau, R girolles. Sols: `~` eau, `g` galets, `v` vase, `'` herbe rase, `"` prairie humide, `s` sous-bois, `:` chemin, `,` sentier, `=` route ou rue, `O` ouvrage, `B` bâtiment, `X` bloqué, `*` autre objet.

La grève du gué et le lavoir (acte 1), x 176 à 235, y 112 à 132:

```text
         8         9         0         1         2         3
     678901234567890123456789012345678901234567890123456789012345
 118 BBB,====='BBBBBBBB'pp*pppp====ppppppp'''':::''''''~~~'''''''
 119 *,,,====='BBBBBBBB'ppppppp====pp*pppp'''':::'''''T~~~'''''''
 120 PP''====='BBBBBBBB'pp*pppp===*ppppppp'''':::'''''''~~'''''''
 124 ''''====='''''''''''''''''====:::::::::::::::::::::OO:::::::
 127 ::::=====:::::::::::::::::====:::::::::::::::::::::OO:::::::
 128 ''''=====ggggggg'**''''''*====''''''''''''''''''''T~*'''''''
 129 ''''====***C**C*G'*''L*'''==OO~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 130 XXXX==OOO~~~~~~~~~~~~~~~~~OOOO~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

La rive aval (acte 1), x 258 à 277, y 128 à 131: le saule têtard (`*`, x 262) et ses plumes au sud-est, la laisse de crue où la rive s'avance:

```text
       6         7
     89012345678901234567
 129 ''''*'''''''''''::::
 130 ~~~'''P'''''''L'''''
 131 ~~~~~~~~~~~~~~~~''''
```

L'Île (acte 2), x 30 à 75, y 139 à 147: l'anse du bief au nord, la grève de la vanne au sud-ouest, la pointe de crue au sud-est:

```text
     3         4         5         6         7
     0123456789012345678901234567890123456789012345
 140 ,,,,O~~~~~~~~~~~~~~~~~~~~~~"""""""""""""""",,,
 141 ,"~OO~~~~~~~~~~~""M"""M"""P""""""",,,,,,,,,,,,
 142 ~~~OOO""""""""""""""""""",,,,,,,,,,,,,,,,,,"""
 145 ~""""",,,,,,,,,,""""""""""""""""""""""""L"""~~
 146 """"""gCg*g*g*g*Gg"""""""~~~~~~~~~~~~~~~~~~~~~
 147 """"""~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

L'étang de la Côte (acte 3), bord de vase côté digue, x 222 à 251, y 45 à 49; les girolles au carrefour du haut (c6), de part et d'autre du chemin forestier (x 174 et 180, y 26 et 29):

```text
             3         4         5
     234567890123456789012345678901
  45 s,,,ssss~~~~~~~~~~~~ssssssss,,
  46 s,,,,vvvEv~~~~~~~vvvEvvsssss,,
  47 s,,,,vvvv~~vPvvvvvvvvvvsss,,,,
  48 s,,s,,vvv~~vvvvvvvv,,,,,,,,,,,
  49 s,,s,,,,OOO,,,,,,,,,,,,,,,,sss
```

### Déroulé et promenade

Tournée du plus proche voisin depuis la porte de la maison du garde-barrière, et retour, verrous des actes suivants fermés (`controler_trouvailles.py`, parcours sur la grille sans traverser l'eau), à la marche du plan (1,5 m/s):

| Acte | Points | Nouveauté | Promenade | À la marche | Avec les gestes | Difficulté (1 à 5) |
|---|---|---|---|---|---|---|
| 1 | 8: grève du gué, joncs, lavoir et sa rigole, saule de l'aval | coquilles, galets, bois flotté, tessons, plumes à l'aube | 218 m | 2,4 min | 3 min | 1 |
| 2 | 14: plus la grève de la vanne, l'anse du bief, la pointe de l'Île | mulettes et la perle | 524 m | 5,8 min | 7 min | 1 |
| 3 | 19: plus la vase de l'étang et les girolles du haut | escargots d'eau, girolles | 715 m | 7,9 min | 9 à 10 min | 1 |

Temps forts d'une tournée complète: la grève au pied de la maison (on y descend en dix secondes), le lavoir et la bouche de sa rigole, le saule de l'aval (à l'aube, la plume), puis la montée à l'étang par le bourg et le bois (la vase, le héron), le détour des girolles, et la longue descente vers l'Île pour finir à la vanne, au bruit du déversoir. Ordre réel: grève du gué, rigole, lavoir, saule de l'aval, pointe aval, étang, girolles, pointe de l'Île, anse, grève de la vanne.

### Ce que ça rapporte (comparé aux autres revenus)

Moyenne par jour avec les 19 points, en automne, au meilleur rachat (calcul sur les fiches):

| Moment | Total | Solange | Café |
|---|---|---|---|
| Journée, temps sec | 10,80 € | 9,80 € | 1,00 € |
| Aube, temps sec | 16,11 € | 12,71 € | 3,40 € |
| Journée, pluie | 20,15 € | 19,15 € | 1,00 € |
| Aube, pluie | 27,06 € | 22,06 € | 5,00 € |

Le plafond de Solange (10 € par jour, `dailyBuyCap`) borne le tout: au-delà, le bois flotté et les coquilles vont au café à moitié prix, le reste attend le lendemain. Une tournée de dix minutes rapporte donc 11 à 20 € au duo, soit 1 à 2 € par minute; la pêche en rapporte 5,90 (11 poissons, 48,40 € en huit minutes, section 3 de `../economie-aubrune.md`), les bûches et le potager restent au-dessus aussi. À l'acte 1, les 8 points donnent environ 6 € (12 % des 49,90 € de la journée bornée par la carte). L'activité complète le reste sans le rendre inutile; elle ne passe pas devant la pêche, même sous la pluie.

### Modèles et vignettes à faire (pour les artistes)

Les meubles se dessinent en attendant avec un modèle existant du manifeste des décors (aucune caisse rayée):

| Meuble (`id`) | Repli actuel | Modèle à faire | Taille | Description |
|---|---|---|---|---|
| `coquilles-de-greve` | `stone-b` | `river-shells` | 0,5 x 0,5 m, 5 cm de haut | trois ou quatre valves de mulette, nacre en dedans, sur un lit de gravier |
| `mulettes-du-bief` | `stone-b` | `mussel-bed` | 0,6 x 0,4 m, 6 cm | mulettes entrouvertes plantées dans le sable clair, au ras de l'eau |
| `galets-veines` | `stone-c` | `veined-pebbles` | 0,4 x 0,4 m, 6 cm | deux ou trois galets gris zébrés de blanc |
| `laisse-de-crue` | `dead-branches-b` | `driftwood` | 1,0 x 0,3 m, 12 cm | branche blanchie et lisse, quelques brindilles et une touffe d'herbe sèche prises dedans |
| `tessons-du-lavoir` | `stone-b` | `faience-shards` | 0,3 x 0,3 m, 3 cm | éclats de faïence blanche à fleurs bleues parmi des cailloux |
| `plumes-de-heron` | `wild-herbs` | `heron-feathers` | 0,4 x 0,3 m, 10 cm | une longue plume grise piquée dans la vase, une autre couchée; se lit à 10 m |
| `limnees-de-l-etang` | `stone-b` | `pond-snail-shells` | 0,3 x 0,3 m, 4 cm | coquilles brunes en spirale pointue dans la vase |
| `girolles` | `wild-herbs` | `chanterelles` | 0,5 x 0,5 m, 8 cm | un rond de cinq ou six girolles orangées dans la mousse |

Vignettes d'objets (artiste 2D, à la plume, grille 96, PNG 96 et 48 px; inscrites en attendant dans les exceptions provisoires de `tests/interface-plume.test.ts`): `coquille-de-riviere` (valve ovale, nacre visible), `coquille-de-limnee` (spirale pointue brune), `galet-veine` (galet plat gris à veine blanche), `bois-flotte` (branche blanchie, nœud), `tesson-de-faience` (éclat blanc, fleur bleue coupée), `plume-de-heron` (longue plume grise), `plume-de-martin-pecheur` (petite plume bleu vif à base orangée), `perle-de-riviere` (perle irrégulière, reflet rosé), `girolle` (girolle orangée, lames qui descendent sur le pied). Modèles 3D d'objets (sac): `galet-veine` réutilise `pierre`; les huit autres sont à ajouter à `assets-src/objets/gabarits.toml`.

### Contrôles

- `python3 -I controler_trouvailles.py`: 0 erreur (sol, case seule, bord de l'eau, zone de l'acte, atteint à pied à son acte), et la promenade par acte.
- `controler_plan.py`: 0 erreur après la chaîne (outil, assembleur, copie du plan).
- `tests/trouvailles-berge.test.ts`: coquille par temps sec, rien de plus le jour même, retour le lendemain; deux ou trois sous la pluie; plume refusée à midi, ramassée à l'aube.
- Les rachats sont tenus par `tests/commerces-aubrune.test.ts` (chaque ligne s'achète, rien en rayon, aucun besoin du jour en rayon).

### Collections (décision au manager)

Rien n'entre au carnet: le cahier (4.8) ne prévoit pas de collection de coquillages, et la famille « Fossiles et trésors » est comptée à 12 (`tests/collections-aubrune.test.ts`). La perle de rivière et la plume de martin-pêcheur feraient de belles entrées « trésor » rares; c'est une modification du contrat (compte du cahier) à décider avec le client.

## 20. Ce que les lots du 2026-11-11 laissaient à poser (version 9)

Tout passe par `construire_plan.py` (section « version 9 »), l'outil, l'assembleur et la copie du plan dans le jeu; `controler_plan.py`: 0 erreur.

### L'estrade de la fanfare, permanente (`estrade-fanfare`, 175,5; 102, face à l'est)

- **Où un bourg la mettrait.** Le kiosque d'un bourg va d'ordinaire sur sa place. Mais la fanfare d'Aubrune est « la fanfare de la halte » (suites secondaires, section 6): elle naît pour accueillir les trains, son concert se joue au quai et le chef dirige « face au train ». Sa place est donc à la gare, pas sur la place, qui garde ses fêtes (concours de la soupe: deux marmites, la grande table et ses bancs; l'est de la place reste libre).
- **Pourquoi pas sur le quai (proposition du développeur, à l'ouest du banc 191; 100,5).** Le quai a 4 rangées utiles (99 à 102), dont les deux du bord restent vides: le train du samedi y ouvre ses portes. Une estrade de 4 x 3 m à l'ouest du banc couvrirait la rangée 100, le poste `quai-o` (187; 101,5) et la lanterne ouest du quai (188; 102,5). Refusée.
- **Où.** Sur l'herbe à l'ouest de la route du Gué, au bout du quai: la place que la Veillée du premier train donnait déjà à son estrade. Elle devient permanente et la veillée ne pose plus la sienne (une seule estrade, aucun doublon). Face à l'est: les marches regardent la route, le carrefour de la Grand-Route et le quai où le train s'arrête; derrière elle, l'herbe, rien à cacher. À 1 m du bord de la voie (rangée 99 libre).
- **Qui l'entend (habitants à moins de 9 m).** La Grand-Route passe à 2 à 6 m (tous ceux qui vont du bourg au gué ou à la maison des joueurs), le carrefour `gr0` à 7 m, le pied de la lisse sud `pn-s` à 5,5 m, Firmin à sa barrière (`firmin-barriere`) à 7,6 m. Le bout ouest du quai (`quai-o`, 10 m) est juste au-delà: on y joue sur le banc du quai (brique « jouer ici » du banc).
- **Fêtes.** Barrières fleuries: la lisse sud garde son accotement libre à l'ouest (179; 99), le tonneau en perce (177,5; 104,5) est hors de l'estrade. Le contrôle des fêtes passe avec l'estrade posée à toute heure.

### Le panneau de la commande du samedi (`panneau-commande`, 207,5; 102,5, face au sud)

- **Proposition corrigée.** (218,5; 104,5) tombe dans l'emprise de la halte (x 215 à 224, y 99 à 104), et sa porte donne au sud sur la Grand-Route, pas sur la voie: contre la façade, le panneau serait sur la route.
- **Où.** Sur la troisième rangée du quai (hors du bord), entre le poteau où l'on monte (205,5; 102,5) et la lanterne est: Rosalie, qui reçoit la commande, se tient à `quai` (204; 102,5), à 3 m. Face au sud: on le lit en montant de la Grand-Route par le passage (x 202 à 205), puis le long de la rue du quai. Il ne gêne ni le brasero des veillées (211,5) ni la table de la tourte (195,5).
- **Fiche.** Aucun meuble « panneau d'affichage » n'existait: fiche `panneau-d-affichage` créée sur le modèle de l'ardoise (`chalk-board`), solide, non posable, sans brique (la commande se lit au carnet et se livre à Rosalie). Modèle à faire: `notice-board`, un panneau d'affichage de la Compagnie (cadre de bois sous un petit auvent, sur deux poteaux, une feuille épinglée et une ligne à la craie), 1 x 1 m, environ 1,8 m de haut.

### Le miroir de la cabine de la mercerie (`mercerie-miroir`, intérieur 5,5; 4,5, face au nord)

La cabine est la colonne est du salon (x 5, rangées 3 et 4), fermée à l'ouest par la cloison et ouverte sur la boutique au nord; l'armoire en ferme le fond. La psyché (brique « se changer », comme celle de la maison) va au fond de la cabine, face au nord: on y entre depuis la boutique et on se voit en face. Le point `mercerie-cabine`, qui tombait sur sa case (5; 4,5, au bord de la cloison), passe devant elle (5,5; 3,5): le chargeur refuse un point sur une case pleine. Aucune fiche d'habitant ni de quête ne cite ce point. Règle d'accès tenue.

### Les lisses ordinaires du passage à niveau (posées)

`lisse-nord` et `lisse-sud` ont leur type (`lisse-de-passage-a-niveau`, modèle `crossing-gate`), aux places préparées. Mesures prises sur le modèle livré (`decors.json`, README de `recoltables-aubrune`): largeur 4,4 m centrée, poteau et lanterne à l'ouest en rotation 0 (pivot du nœud `lisse` à -1,95 m du centre), bras de 4 m rayé rouge et blanc qui part du pivot vers l'est et finit sur une fourche d'appui à +2,2 m; hauteur 1,68 m; profondeur 0,46 m, bras à 0,19 m du centre.

- **Quels passages.** Seul le passage gardé (`pn_garde`, route du Gué) a des lisses: Firmin les manœuvre depuis la maison du garde. Le passage de l'Église est non gardé (croix de Saint-André) et celui des Hameaux est un accès de service fermé par la grille de la Compagnie: sans garde pour les baisser, des lisses n'y auraient pas de raison d'être.
- **En travers de la route, bras de 4 m contre chaussée de 4 m.** Axe de la route en x = 182,5, chaussée de 180,5 à 184,5. Centre de la lisse en 182,5: pivot à 180,55 (poteau sur le bord de la chaussée, à 0,05 m), pointe du bras à 184,55, fourche à 184,7. La lisse couvre donc toute la chaussée et ne mord pas de 0,2 m sur l'accotement d'en face. La fiche est à 5 x 1 (cases 180 à 184 en x): les bouts libres du contrôle (179 et 185) sont de l'herbe, on passe à pied par l'accotement (la fiche est non solide: la lisse ne bloque pas le pas, comme une lisse baissée qu'on contourne).
- **Orientation.** Rotation 0: socle à l'ouest, bras vers l'est. Lisse nord (182,5; 95,5) en rotation 0: pour qui descend vers le sud, l'ouest est à droite, le socle est à sa droite. Lisse sud (182,5; 99,5) en rotation 2: socle à l'est, bras vers l'ouest, socle à droite de qui monte vers le nord (côté maison de Firmin). Dans les deux cas le bras est parallèle à l'axe est-ouest, donc perpendiculaire à la route (nord-sud) et parallèle à la voie: la lisse barre la route, pas la voie.
- **Distance à la voie.** Axe du bras à y 95,69 (nord) et 99,31 (sud), soit 1,8 m de l'axe des rails (y 97,5, demi-écartement 0,72 m): le bras et son poteau (0,46 m de profondeur) laissent 0,3 m au bout des traverses. C'est serré pour une vraie barrière (3 m seraient mieux) mais la place est tenue des deux côtés: la rangée du bord du quai (99) au sud, les places des lisses fleuries, de Firmin et de la scène (Jeanne et Léon à 2 m au sud) au nord. Reculer le bras d'une case déplacerait aussi la lisse fleurie, hors de ce lot: à confirmer par le game designer si l'écart paraît trop court en jeu.
- **Firmin.** Son poste `firmin-barriere` (184,5; 100,5) est à 1 m au sud du poteau de la lisse sud (socle à l'est, x 184,45): contre le socle qu'il manœuvre, jamais dans le bras (qui part vers l'ouest à y 99,3). Le contrôle des postes l'accepte (écart de 0,5 m à l'emprise de la fiche, seuil de 0,4 m pour ce qui barre par nature, `BARRENT`).
- **Avec la fête.** Les lisses fleuries prennent la place des lisses ordinaires: chaque lisse ordinaire porte `when` = non(fête des barrières commencée et `aubrune.barrieres.lisses` = `baissees`), la condition inverse exacte de la lisse fleurie (`not` de `all`, que le jeu sait évaluer). Avant la scène d'ouverture et après la clôture, la lisse ordinaire est là; entre les deux, seule la fleurie. Le tableau des fêtes ne liste que les objets nommés d'une fête (`fete`), les lisses ordinaires sont au tableau du mobilier. `controler_plan.py` les range pourtant parmi les décors conditionnés par cet événement (il lit les `event_is` au travers de `not`): il passe, mais une lisse ordinaire n'est pas un décor de fête.
- **Reste à voir.** Deux lumignons de la Nuit des lumignons tombent sur la lisse sud: `fete-lumignon-firmin` (184,5; 99,5) sur le poteau et `fete-lumignon-jeanne` (180,5; 99,5) sous la pointe du bras. Non déplacés (hors de cette mission), à reprendre avec le décor des fêtes. Le modèle ne fait pas encore bouger le nœud `lisse` (la lisse est toujours baissée en jeu): la lisse levée de la nuit du dénouement attend le rendu.

### Le tonneau du café (`tonneau-cafe`, 256,5; 111,5)

La porte du café donne directement sur la Grand-Route: devant la façade, le tonneau barrait la route. Le plan disait déjà du café « terrasse et jeu de quilles au sud, côté soleil »: la bande d'herbe rase en face (x 249 à 257, y 111 et 112), de l'autre côté de la route. Le tonneau-table y va, au bout est de la bande, à 2 m de l'axe de la porte et à côté de la venelle: on pose son verre en attendant son tour aux quilles. Les deux autres poses signalées par le décor des fêtes: la lisse ordinaire (ci-dessus, en attente de son meuble) et la lumière qui dérive, la table de cire, la cloche, le tableau des horaires, les treillis et les pétales (aucun modèle: rien à poser).

### Ménage des modèles retirés le 2026-11-11

| Ancien modèle | Ce qu'il désignait | Devenu |
|---|---|---|
| `house-town`, `shop-front`, `shed` | base des gabarits de 25 bâtiments | la fiche du bâtiment (`batiments/<id>.json`), dont sort aujourd'hui le modèle encré |
| `bench-park` | six bancs publics (place, ponton, berge, Crêtes, étang, belvédère) | le meuble `banc` (`bench-platform`, celui que le rendu dessinait déjà) |
| `chair-bedroom` | le fauteuil de coiffure de la mercerie | le meuble `chaise` (`chair-farm`) |
| `log-pile` | tas de bois du jardin et de l'atelier; bûches du décor de la ferme | le meuble `tas-de-bois` (`woodpile`); les bûches gardent `tas-de-buches`, dont la fiche pointe encore vers `log-pile` (ci-dessous) |
| `signpost` | six poteaux indicateurs de carrefour | à faire: `fingerpost` (poteau de bois, deux à quatre flèches peintes) |
| `mailbox` | la boîte aux lettres du bourg (grille de Lucie) et celle de la maison | à faire: `letter-box` (boîte de tôle sur pied ou au mur) |
| `level-crossing-gate` | les lisses du passage à niveau | à faire: `crossing-gate` (lot en cours de l'artiste) |
| `stool`, `street-lamp`, `lamp-floor`, `table-round`, `rug-oval`, `shelf` | rien | absents du plan |

Tout objet typé du plan prend désormais le modèle de sa fiche (celui que le rendu dessine). Restent des fiches de meubles qui pointent vers des modèles retirés (le rendu les dessine en forme provisoire): `tonneau` (`barrel`), `caisse` (`crate`), `banc-de-ferme` (`bench-farm`), `tas-de-buches` (`log-pile`), `puits` (`well`), `abreuvoir-de-pierre` (`sink-stone`): modèles à refaire par l'artiste, fiches non touchées ici. `controler_plan.py` mesure leur forme provisoire sur l'emprise de leur fiche (il échouait sur la caisse qui porte une lampe).

### Les ardoises du chantier de la maison, versées au plan

Les six ardoises de chantier (`maison-chantier-*`) avaient été ajoutées à la main dans `interieurs/maison-rdc.json`: l'assembleur efface tout objet absent du plan, la première passe de la chaîne les a donc effacées. Elles entrent dans le plan avec leur condition (leurs raisons, écrites dans le fichier, sont conservées). Celle de la salle était au milieu de la pièce (7,5; 3,5): avant que la salle soit faite, elle coupait le passage de 2 m de la porte au lit et aux deux escaliers. Elle passe contre la cloison ouest, au sud de l'escalier de l'étage (5,5; 5,5), face à l'est: lue depuis toute la salle, sans rien barrer. `controler_plan.py` juge maintenant ce passage dans chaque combinaison des faits que citent les meubles conditionnés d'un intérieur (l'ardoise de la cuisine et le plan de travail qui la remplace ne sont jamais posés ensemble); banc d'épreuve: 36 casses vues sur 36.
