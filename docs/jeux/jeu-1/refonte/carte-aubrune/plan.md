# Aubrune: le plan vu du dessus (refonte)

| Champ | Valeur |
|---|---|
| Statut | version 3: plan validé par le client le 2026-11-10 (taille, ouest allongé de 64 m, ferme sur la rive sud derrière le gué, rive du bourg ouverte dès l'acte 1), complété pour la 3D (section 12), raccordé à l'histoire écrite des actes 1 à 3 (section 13); manques de la nuit du 2026-11-11 comblés (section 15) |
| Date | 2026-11-10 |
| Source unique | `construire_plan.py` (composition en code), qui écrit `plan.json`, les SVG, les PNG et les tableaux marqués « généré » de ce document |
| Contrôle | `controler_plan.py` (0 erreur, dont l'ordre réel de l'histoire relu dans les fiches et rejoué sur la grille du lieu), `controler_plan.py --eprouver` (26 casses vues sur 26), `assembler_lieu.py` (aucun verrou contournable sur la grille); règle d'accès des intérieurs et du dehors (section 14), aussi tenue par `tests/points-de-quete.test.ts` du jeu |
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
| la halte | `house-town` | 10 x 6 m | 1 | croupe | sud 0.50 | murs pierre_claire, toit lauze, menuiseries rouge_cheminot, volets rouge_cheminot, porte rouge_cheminot |
| la maison du garde-barrière | `house-town` | 11 x 8 m | 2 | deux-pans | est 0.50 | murs enduit, toit tuile, menuiseries creme, volets sauge, porte sauge |
| l'épicerie-pension Ferrand | `shop-front` | 8 x 10 m | 2 | croupe | est 0.50 | murs enduit_ocre, toit lauze, volets vert_sombre, porte vert_sombre, menuiseries vert_sombre, enseigne vert_sombre |
| l'atelier de Basile | `shed` | 10 x 8 m | 1 | deux-pans | est 0.50 | murs bois_brut, toit lauze, menuiseries bois_sombre, porte bois_sombre |
| la maison de Firmin | `house-town` | 7 x 6 m | 2 | deux-pans | sud 0.50 | murs pierre, toit tuile, volets rouge_cheminot, porte rouge_cheminot |
| la remise de la draisine | `shed` | 6 x 5 m | (modèle) | (modèle) | ouest 0.50 | porte charretière de 3 m dans l'axe des rails |
| le fournil d'Achille | `shop-front` | 7 x 6 m | 2 | deux-pans | sud 0.50 | murs enduit, toit tuile, menuiseries miel, porte miel, enseigne bois_sombre |
| la mercerie-coiffure | `shop-front` | 7 x 7 m | 2 | deux-pans | nord 0.50 | murs enduit_rose, toit tuile, menuiseries creme, volets fleur_rose, porte creme |
| l'école-mairie | `house-town` | 7 x 6 m | 2 | croupe | sud 0.50 | murs pierre_claire, toit lauze, volets bleu, porte bleu |
| la maison de Lucie | `house-town` | 6 x 6 m | 2 | (modèle) | nord 0.50 | murs enduit, toit tuile, volets bleu, porte bleu |
| le café de la Halte | `shop-front` | 7 x 6 m | 2 | deux-pans | sud 0.50 | murs enduit_ocre, toit tuile, menuiseries rouge_cheminot, porte rouge_cheminot, enseigne rouge_cheminot |
| la forge | `shed` | 6 x 6 m | 1 | deux-pans | sud 0.50 | murs pierre, toit lauze, porte bois_sombre |
| l'atelier d'Ambroise | `shop-front` | 7 x 6 m | 2 | (modèle) | sud 0.50 | murs pierre_claire, toit tuile, menuiseries bois_sombre, enseigne laiton |
| la maison d'Honorine | `house-town` | 6 x 6 m | 2 | (modèle) | sud 0.50 | murs enduit_rose, toit tuile, volets sauge, porte sauge |
| la maison aux volets clos | `house-town` | 6 x 6 m | 2 | (modèle) | sud 0.50 | murs enduit, toit tuile, volets bois_gris, porte bois_gris |
| la maison du bout | `house-town` | 6 x 6 m | 1 | (modèle) | nord 0.50 | murs pierre, toit lauze, volets rouge_cheminot, porte rouge_cheminot |
| l'église Saint-Aubin | `eglise` | 21 x 12 m | (modèle) | (modèle) | sud 0.50 | modèle à part: nef de 21 x 12 m, clocher carré de 6 m à l'ouest (22 m de haut), portail au sud |
| le presbytère | `house-town` | 7 x 7 m | 2 | (modèle) | est 0.50 | murs pierre, toit lauze, volets vert_sombre, porte vert_sombre |
| la maison de Marthe | `house-town` | 6 x 6 m | 2 | (modèle) | est 0.50 | murs enduit, toit tuile, volets bleu, porte bleu |
| la maison de cheminot (ouest) | `house-town` | 6 x 6 m | 2 | (modèle) | nord 0.50 | murs pierre_claire, toit tuile, volets rouge_cheminot, porte rouge_cheminot |
| la maison de cheminot (est) | `house-town` | 6 x 6 m | 2 | (modèle) | nord 0.50 | murs pierre_claire, toit tuile, volets rouge_cheminot, porte rouge_cheminot |
| le lavoir | `lavoir` | 5 x 4 m | (modèle) | (modèle) | ouest 0.50 | toit en appentis sur quatre poteaux, ouvert à l'ouest, bassin de pierre à l'est |
| le poste d'aiguillage | `house-town` | 6 x 4 m | 2 | croupe | nord 0.50 | murs pierre, toit lauze, menuiseries rouge_cheminot, porte rouge_cheminot |
| le moulin de la Vanne | `house-town` | 8 x 8 m | 2 | deux-pans | nord 0.50 | murs pierre, toit tuile, menuiseries bois_sombre, porte bois_sombre |
| le logis de la ferme Delmas | `house-town` | 9 x 6 m | 2 | deux-pans | sud 0.50 | murs enduit_ocre, toit tuile, volets sauge, porte sauge |
| la grange | `shed` | 8 x 10 m | 1 | deux-pans | est 0.50 | murs bois_gris, toit tuile, porte bois_brut |
| la maison forestière | `house-town` | 6 x 6 m | 1 | (modèle) | est 0.50 | murs pierre, toit lauze, volets vert_sombre, porte vert_sombre |
<!-- genere:gabarits:fin -->

### Mobilier de lieu

<!-- genere:mobilier:debut -->
| Objet | Type du jeu | Modèle | Où (x, y) | Face au | Pourquoi |
|---|---|---|---|---|---|
| banc-du-quai | banc | `bench-platform` | 200, 100.5 | nord | le banc du réveil: on attend le train face à la voie |
| banc-quai-ouest | banc | `bench-platform` | 191, 100.5 | nord | second banc du quai, face à la voie |
| poteau-quai | poteau-de-quai | `poteau-de-quai` | 205.5, 102.5 | sud | là où l'on monte à deux: le point du quai |
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
| lisse-nord | (à créer) | `level-crossing-gate` | 182.5, 95.4 | sud | la lisse barre la route (bras est-ouest) au nord de la voie, jamais la voie |
| lisse-sud | (à créer) | `level-crossing-gate` | 182.5, 99.6 | sud | la lisse barre la route au sud de la voie |
| croix-pn-eglise | (à créer) | `crossing-sign` | 256.8, 95 | sud | passage à niveau non gardé: croix de Saint-André au bord de la rue |
| pompe-de-la-place | pompe | `water-pump` | 208, 113.5 | sud | la pompe de la place, sur l'ancien puits: l'eau de tous et la toilette du matin (acte 1) |
| banc-place | banc | `bench-park` | 208, 119.4 | nord | face au puits et à la halte: on y voit qui descend du train |
| ronces-maison-1 | ronces | `buisson` | 167.5, 112.5 | sud | les ronces qui ont envahi la ruine, contre le pignon ouest: on les arrache à l'acte 1 |
| ronces-maison-2 | ronces | `buisson` | 176, 119.6 | sud | les ronces du jardin, devant le futur potager |
| table-tonnelle | table-a-manger | `table-farm` | 197.5, 120 | sud | la tonnelle d'Odette: le souper des pensionnaires |
| chaise-tonnelle-n | chaise | `chair-farm` | 197, 118.9 | sud | autour de la table de la tonnelle |
| chaise-tonnelle-s | chaise | `chair-farm` | 198, 121.1 | nord | autour de la table de la tonnelle |
| banc-ponton | banc | `bench-park` | 201.5, 128.2 | sud | au pied du ponton, face à la rivière et au pigeonnier de l'autre rive |
| banc-berge | banc | `bench-park` | 248, 124.4 | sud | face à la rivière, à l'ombre des saules |
| panneau-1 | (à créer) | `signpost` | 179.4, 105 | sud | panneau de carrefour: passage à niveau, Grand-Route, chemin du Moulin, le Gué |
| panneau-2 | (à créer) | `signpost` | 256.4, 111.5 | sud | panneau de carrefour: rue de l'Église, venelle des Jardins |
| panneau-3 | (à créer) | `signpost` | 185.6, 85 | sud | panneau de carrefour: chemin forestier, chemin de la Lisière |
| panneau-4 | (à créer) | `signpost` | 185.6, 123.6 | sud | panneau de carrefour: chemin de la Berge, le Gué |
| panneau-5 | (à créer) | `signpost` | 317, 111.6 | sud | panneau de carrefour: bout de la Grand-Route, chemin des Jardins, l'arrêt du car |
| panneau-6 | (à créer) | `signpost` | 150, 105.4 | sud | panneau de carrefour: chemin du Moulin, portail du moulin |
| boite-lucie | (à créer) | `mailbox` | 248.4, 110.6 | nord | la boîte aux lettres du bourg, à la grille de Lucie, tournée vers la rue |
| boite-maison | (à créer) | `mailbox` | 179.6, 113.4 | est | la boîte de la maison du garde, à côté de la porte, tournée vers la route: les lettres des habitants |
| pompe-jardin | pompe | `water-pump` | 179.5, 121.5 | sud | la pompe du jardin: l'eau de l'arrosoir à deux pas du potager |
| bois-maison | tas-de-bois | `log-pile` | 167.4, 116.5 | sud | bois de chauffage contre le pignon ouest, à l'abri du vent de pluie |
| bois-atelier | tas-de-bois | `log-pile` | 171, 93 | sud | les grumes refendues de Basile, au sud de l'atelier |
| haches-basile | etal-de-haches | `ratelier` | 176.5, 90.5 | est | sous l'auvent est, dos au mur de l'atelier, à côté de la porte: Basile prête ses outils (acte 1) |
| potager | terre-cultivable | `terre` | 174, 122.5 | sud | le potager de 6 x 4 cases au bout de l'allée du jardin (24 cases) |
| banc-cretes | banc | `bench-park` | 304, 47.6 | sud | le banc des Crêtes: le bourg entier en contrebas |
| banc-etang | banc | `bench-park` | 225.5, 39.5 | est | face à l'étang, au coin de pêche |
| tronc-clairiere | banc | `stump` | 183, 52.4 | nord | un tronc couché sert de banc face au Vieux Chêne |
| banc-belvedere | banc | `bench-park` | 345, 27.6 | ouest | le belvédère regarde le bourg et le clocher, à l'ouest |
| abreuvoir | pompe | `water-pump` | 201, 185.6 | sud | la pompe et l'abreuvoir des bêtes, au bout de la cour |
| tonneaux-ferme | tonneau | `barrel` | 196.5, 154.5 | sud | tonneaux de cidre contre le logis |
| caisses-epicerie | caisse | `crate` | 194.5, 113.5 | sud | cageots de légumes devant la vitrine d'Odette |
| tonneau-cafe | (à créer) | `barrel` | 251.6, 106.6 | sud | le tonneau qui sert de table à la terrasse du café |
| caillou-greve-1 | caillou | `caillou` | 185, 129.4 | sud | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-2 | caillou | `caillou` | 186.6, 129.4 | sud | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-3 | caillou | `caillou` | 188.2, 129.4 | sud | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-4 | caillou | `caillou` | 189.8, 129.4 | sud | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-5 | caillou | `caillou` | 191.4, 129.4 | sud | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-greve-6 | caillou | `caillou` | 184, 129.6 | sud | pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres) |
| caillou-ile-1 | caillou | `caillou` | 39, 146.4 | sud | pierres plates de la grève de l'Île, au pied de la vanne (i4) |
| caillou-ile-2 | caillou | `caillou` | 41, 146.4 | sud | pierres plates de la grève de l'Île, au pied de la vanne (i4) |
| caillou-ile-3 | caillou | `caillou` | 43, 146.4 | sud | pierres plates de la grève de l'Île, au pied de la vanne (i4) |
| caillou-ile-4 | caillou | `caillou` | 45, 146.4 | sud | pierres plates de la grève de l'Île, au pied de la vanne (i4) |
| ronces-tranchee-1 | ronces | `buisson` | 144.5, 95.5 | sud | les ronces des talus de la tranchée (tw2): mûres de l'été et de l'automne, sans barrer la voie |
| ronces-tranchee-2 | ronces | `buisson` | 148.5, 95.5 | sud | les ronces des talus de la tranchée (tw2): mûres de l'été et de l'automne, sans barrer la voie |
| ronces-tranchee-3 | ronces | `buisson` | 146.5, 99.5 | sud | les ronces des talus de la tranchée (tw2): mûres de l'été et de l'automne, sans barrer la voie |
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
| baquet-margot | baquet | `tub` | 202, 143.5 | sud | le baquet de lessive de Margot, en haut de la berge: elle rince à la rivière |
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
| champignons | cueillette | x 176, y 25 | 3 | matin | automne | sous-bois humide, le matin après la pluie |
| myrtilles | cueillette | x 152, y 17 | 3 | jour | été | la lande de la crête |
| noix | cueillette | x 162, y 184 | 3 | jour | automne | sous le Gros Noyer |
| pommes-verger | cueillette | x 310, y 120 | 1 | jour | automne | le verger communal |
| legumes-jardins | cueillette | x 256.5, y 121.5 | 1 | jour | printemps, été | les jardins de la Rive: ce qu'on vous laisse prendre |
| coquillages-greve | cueillette | x 187, y 128.6 | 1 | matin | toutes | la grève au pied de la berge, eaux basses du matin |
| coquillages-ile | cueillette | x 42, y 146.6 | 2 | matin | toutes | la grève de l'Île |
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
. . S . A # T T H P
. . . B . # C . . P
. . . . . . T T * P
E . . . . . . . L C
. . . . . E . . L L
. . . . . . . * * S
. . . . . # R P P C
```

Pièces: salle commune et cuisine (5 x 7); chambre (5 x 4); troisième pièce (5 x 3). Meubles: maison-cuisiniere (cuisiniere), maison-plan (plan-de-travail), maison-table (table-a-manger), maison-chaise-1 (chaise), maison-chaise-2 (chaise), lit-de-la-maison (lit-double), maison-armoire (armoire), maison-rechaud (rechaud), maison-rdc-patere (patere), maison-rdc-horloge (horloge-murale), maison-rdc-portrait (cadre-ovale), maison-rdc-panier (panier-a-linge), maison-rdc-seau (seau), maison-rdc-tapis-de-sol (tapis-long), maison-rdc-balai (balai), maison-rdc-seau-gravats (seau), maison-rdc-lampe (lampe-a-petrole, sur maison-table), maison-rdc-pain (corbeille-de-pain, sur maison-table), maison-rdc-journal (journal, sur maison-table), maison-rdc-pots (pots-de-gres, sur maison-plan). Points: maison-lit-g (lit), maison-lit-d (lit), maison-cuisine (poste).

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
E C . E C E E
. . . . . . .
. * C . . . P
. . C . . . B
T . . . . . H
# # # . . # #
. V V . . P C
B T T . . . .
C * T . C T E
```

Pièces: boutique (7 x 5); cuisine (7 x 4). Meubles: epicerie-comptoir (comptoir-epicerie), epicerie-etal (etal-de-tourte), epicerie-cuisiniere (cuisiniere), epicerie-table (table-a-manger), epicerie-rdc-etagere-1 (etagere-murale), epicerie-rdc-etagere-2 (etagere-murale), epicerie-rdc-etagere-3 (etagere-murale), epicerie-rdc-caisse-1 (caisse-de-legumes), epicerie-rdc-caisse-2 (caisse-de-legumes), epicerie-rdc-tonnelet (tonnelet), epicerie-rdc-horloge (horloge-murale), epicerie-rdc-balai (balai), epicerie-rdc-portrait (cadre-portrait), epicerie-rdc-buches (buches-d-interieur), epicerie-rdc-seau (seau), epicerie-rdc-vaisselier (vaisselier), epicerie-rdc-panier (panier-a-linge), epicerie-rdc-tonnelet-2 (tonnelet), epicerie-rdc-caisse-3 (caisse-de-legumes), epicerie-rdc-tapis-de-sol (tapis-rond), epicerie-rdc-bocaux (bocaux-de-confiture, sur epicerie-comptoir), epicerie-rdc-boites (boites-a-provisions, sur epicerie-comptoir), epicerie-rdc-pain (corbeille-de-pain, sur epicerie-table), epicerie-rdc-lampe (lampe-a-petrole, sur epicerie-table). Points: odette-comptoir (comptoir, Odette), odette-cuisine (poste, Odette).

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
P T T T # .
S T * . # *
B . . . . A
```

Pièces: boutique (6 x 3); salon de coiffure (4 x 3); cabine (2 x 3). Meubles: mercerie-comptoir (comptoir-mercerie), mercerie-fauteuil (chaise), mercerie-armoire (armoire), mercerie-rubans (etagere-murale), mercerie-boutons (etagere-murale), mercerie-patere (patere), mercerie-affiche (cadre-portrait), mercerie-panier (panier-a-linge), mercerie-balai (balai), mercerie-tapis-de-sol (tapis-rond), mercerie-tabouret (tabouret-de-ferme), mercerie-seau (seau), mercerie-boites-boutons (boites-a-provisions, sur mercerie-comptoir), mercerie-bouquet (bouquet, sur mercerie-comptoir), mercerie-patrons (pile-de-livres, sur mercerie-comptoir). Points: solange-comptoir (comptoir, Solange), jeanne-fauteuil (poste, Jeanne), mercerie-cabine (poste).

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

Rien n'est posé sur un chemin, une route, un seuil, un nœud ni contre un point; rien de récoltable. Le tonneau de la terrasse du café garde son attente: posé, il barrerait la Grand-Route. La rue du bourg tient la mesure, mais la critique du directeur artistique porte sur le cadrage (aucune façade): c'est la vue qui est à recadrer.

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
