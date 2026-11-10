# Aubrune: le plan vu du dessus (refonte)

| Champ | Valeur |
|---|---|
| Statut | proposition du level-designer, version 0.1, à relire puis à montrer au client avant toute 3D |
| Date | 2026-11-10 |
| Source unique | `construire_plan.py` (composition en code), qui écrit `plan.json`, les SVG, les PNG et les tableaux marqués « généré » de ce document |
| Contrôle | `controler_plan.py` (0 erreur), `controler_plan.py --eprouver` (12 casses vues sur 12) |
| Règle suivie | « le plan avant le volume » (CLAUDE.md): la carte 3D sera générée à partir de `plan.json`, jamais l'inverse |

Images: `plan-ensemble.png`, `zone-1-bourg.png` à `zone-7-tunnel.png`, `quetes-acte-1.png` à `quetes-acte-3.png` (SVG de même nom à côté).

## En bref

- **320 x 208 m** (66 560 m²), contre 164 x 78 m en 0.13: 5,2 fois plus grand. Sept zones, 28 bâtiments, 66 points d'intérêt, 2 km de chemins.
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
- Métriques du cahier (4.12): marche 3 m/s, course 5 m/s, vue large de 28 m au plus. Traverser toute la carte en courant d'ouest en est prend 64 s; la vue ne montre qu'un onzième de la largeur: d'où les repères hauts.

<!-- genere:zones:debut -->
| Zone | Ouverte à | Surface | Bâtiments | Points d’intérêt |
|---|---|---|---|---|
| Le bourg et le passage à niveau | acte 1 | 8748 m² | 23 | 25 |
| La rivière et le bief | acte 2 | 4028 m² | 0 | 5 |
| La voie jusqu'au poste d'aiguillage | acte 2 | 2876 m² | 1 | 5 |
| La Côte | acte 3 | 19710 m² | 1 | 13 |
| Le moulin | acte 3 | 828 m² | 1 | 2 |
| La ferme | acte 3 | 12715 m² | 2 | 10 |
| Le tunnel | acte 3 | 7666 m² | 0 | 6 |
| **Total jouable** | | **56571 m²** sur 66560 m² de carte (320 x 208 m) | 28 | 66 |
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
- **Composition**: une ligne droite dans une tranchée, sans embranchement. Au bout, la clairière du poste, le sémaphore, et le portillon qui descend vers la vanne.
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
| V1 (acte 2) | x 110, y 127 | le saule couché en travers du chemin de la berge | Achille le fait débiter le jour de la leçon de pêche (acte 2) |
| V2 (acte 2) | x 106, y 97.5 | les ronces de la tranchée, sur la voie | Firmin donne le but « voie dégagée » (acte 2); hache de base |
| V2b (acte 2) | x 58, y 97.5 | trois frênes couchés sur la voie, trop gros pour la hache de base | hache améliorée par Mado (acte 2): on bute, on revient avec l'outil |
| V3 (acte 3) | x 118.5, y 135 | le gué emporté par la dernière crue (trois dalles manquent) | Paulin Delmas remet les dalles en arrivant par le train (acte 3) |
| V4 (acte 3) | x 80, y 110 | le portail de la cour du moulin, cadenassé, et le portillon de la berge | Berthe arrive avec la clé (acte 3) |
| V5 (acte 3) | x 118.5, y 83 | la barrière forestière de Basile (« coupe en cours ») | Basile vous envoie au bois pour la chambre (acte 3) |
| V6 (acte 3) | x 156, y 79 | le raidillon du ru, raviné | Basile y pose trois rondins en marches (acte 3) |
| V7 (acte 3) | x 217, y 63.5 | la porte haute du cimetière, fermée à clé | Marthe prête la clé (acte 3, la coutume) |
| V8 (acte 3) | x 234, y 97.5 | la grille de la Compagnie en travers de la voie (« Ligne fermée ») | Firmin sort enfin la clé avec la lettre (acte 3); Jeanne connaît un trou, trop petit pour vous |
| V9 (acte 3, raccourci) | x 252, y 142.8 | la passerelle des Jardins, sans tablier | les planches viennent de la ferme: raccourci ouvert depuis la rive sud (acte 3) |
| V10 (acte 3, raccourci) | x 292, y 30 | l'escalier de service du tunnel, verrouillé de l'intérieur | on tire le verrou depuis le tunnel: raccourci vers le belvédère (acte 3) |
| V11 (acte 2, raccourci) | x 31.2, y 104.5 | le portillon du poste, fermé d'un loquet côté voie | on l'ouvre depuis le poste: raccourci vers la vanne et le retour par la berge (acte 2) |
<!-- genere:verrous:fin -->

Les obstacles et ce qui les lève sont des propositions au game-designer: le plan n'a besoin que de leur place et de leur acte.

<!-- genere:batiments:debut -->
| Bâtiment | Emprise | Qui | Porte | Pourquoi là, pourquoi dans ce sens |
|---|---|---|---|---|
| le quai | 30 x 4 m | tous | (pas de porte: plateforme) | le coeur: le train s'arrête là, la caisse de la commande, le tableau, la cloche et la pendule y sont |
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

Dijkstra sur le graphe des chemins, tous verrous ouverts. Temps: distance divisée par 3 m/s (marche) et 5 m/s (course).

<!-- genere:distances:debut -->
| De | À | Distance | Marche (3 m/s) | Course (5 m/s) |
|---|---|---|---|---|
| le quai | la maison | 34 m | 11 s | 7 s |
| le quai | la place (pompe) | 14 m | 5 s | 3 s |
| le quai | l'épicerie | 20 m | 7 s | 4 s |
| le quai | l'atelier de Basile | 36 m | 12 s | 7 s |
| le quai | le fournil et la mercerie | 36 m | 12 s | 7 s |
| le quai | le carrefour de l'Église (café, forge) | 61 m | 20 s | 12 s |
| le quai | l'église | 75 m | 25 s | 15 s |
| le quai | le lavoir | 28 m | 9 s | 6 s |
| le quai | le ponton | 27 m | 9 s | 5 s |
| le quai | le gué (rive nord) | 45 m | 15 s | 9 s |
| le quai | l'arrêt du car | 116 m | 39 s | 23 s |
| le quai | la fosse du bief | 97 m | 32 s | 19 s |
| le quai | la vanne | 147 m | 49 s | 29 s |
| le quai | le poste d'aiguillage | 106 m | 35 s | 21 s |
| le quai | le moulin | 73 m | 24 s | 15 s |
| le quai | la ferme | 86 m | 29 s | 17 s |
| le quai | le Gros Noyer | 112 m | 37 s | 22 s |
| le quai | la clairière du Vieux Chêne | 74 m | 25 s | 15 s |
| le quai | l'étang | 73 m | 24 s | 15 s |
| le quai | la source | 103 m | 34 s | 21 s |
| le quai | le belvédère | 188 m | 1 min 03 | 38 s |
| le quai | le portail du tunnel | 184 m | 1 min 01 | 37 s |
| le quai | la cachette d'Émile | 216 m | 1 min 12 | 43 s |
| la maison | l'épicerie | 44 m | 15 s | 9 s |
| la maison | le fournil et la mercerie | 58 m | 19 s | 12 s |
| la maison | le carrefour de l'Église (café, forge) | 84 m | 28 s | 17 s |
| la maison | le poste d'aiguillage | 98 m | 33 s | 20 s |
| la maison | le moulin | 53 m | 18 s | 11 s |
| la maison | la ferme | 53 m | 18 s | 11 s |
| la maison | l'étang | 105 m | 35 s | 21 s |
| la maison | la cachette d'Émile | 250 m | 1 min 23 | 50 s |
| le poste d'aiguillage | le moulin | 123 m | 41 s | 25 s |
| le moulin | la ferme | 95 m | 32 s | 19 s |
| la ferme | l'arrêt du car | 162 m | 54 s | 32 s |
| le belvédère | l'église | 114 m | 38 s | 23 s |
| l'étang | l'église | 104 m | 35 s | 21 s |
| la clairière du Vieux Chêne | l'atelier de Basile | 38 m | 13 s | 8 s |
<!-- genere:distances:fin -->

Densité d'intérêt (plafond visé: jamais plus de 25 s de marche, soit 75 m, sans rien à faire):

<!-- genere:densite:debut -->
- Réseau de chemins: 2001 m; 94 points d’intérêt et bâtiments, soit un tous les 21,3 m de chemin en moyenne.
- Distance moyenne, depuis un point quelconque du réseau, au point d’intérêt le plus proche: 6,6 m (2 s à la marche).
- Pire cas: 28,0 m (9 s à la marche, 6 s à la course), sur le tronçon trav - pne.
<!-- genere:densite:fin -->

## 7. Les sentiers de quête

<!-- genere:quetes:debut -->
| Sentier | Forme | Aller | Retour | Total à la marche | Total à la course |
|---|---|---|---|---|---|
| Acte 1, « Logement fourni »: le tour du propriétaire | étoile autour de la place | 336 m | sur place | 1 min 52 | 1 min 07 |
| Acte 2, « La minute d’écart »: la voie jusqu’au signal | sentier linéaire, retour en boucle | 127 m | 148 m | 1 min 32 | 55 s |
| Acte 2: la pendule et la leçon de pêche | deux allers courts depuis le centre | 270 m | sur place | 1 min 30 | 54 s |
| Acte 3, « Ceux qui partent »: le verre de la lanterne | sentier linéaire, retour par le haut | 253 m | 250 m | 2 min 48 | 1 min 41 |
| Suite « Le fantôme du moulin »: les pas blancs | piste de traces, linéaire | 218 m | sur place | 1 min 13 | 44 s |
| Suite « Les lettres en retard »: la ligne de la draisine | raccourci sur rail | 277 m | sur place | 1 min 32 | 55 s |
<!-- genere:quetes:fin -->

Ces durées sont du déplacement pur; les obstacles, scènes et activités s'y ajoutent.

### Acte 1, « Logement fourni »: une étoile, pas une ligne (`quetes-acte-1.png`)

L'acte apprend le centre. Du banc du quai, chaque étape se voit depuis la précédente: la halte au bout du quai, la maison au passage à niveau, l'enseigne d'Odette sur la place, la pompe au milieu, l'auvent de Basile de l'autre côté de la barrière, la lisière derrière le château d'eau, le fournil après le pont. Rien n'est à plus de 40 m du quai. **Sans flèche**: les habitants montrent du doigt le lieu suivant, qui est en vue.

### Acte 2, « La minute d'écart »: la voie jusqu'au signal (`quetes-acte-2.png`)

- **Départ**: Firmin, à la halte. **Étapes**: le passage à niveau; les ronces (V2); le wagon oublié; les frênes couchés (V2b), qui renvoient chez Mado pour la hache améliorée: on bute, on revient avec l'outil, la moitié du chemin est déjà connue. **Point culminant**: le poste, la scène des leviers, le sémaphore qui s'incline.
- **Retour par raccourci**: le portillon (V11), la descente à la fontaine des cheminots, la passerelle de la vanne, l'île, la fosse du bief (où Achille donnera la leçon de pêche), les planches, la berge, le gué, la maison. On revient par l'eau après être parti par le fer.
- **Sans flèche**: deux talus et deux rails à l'aller; au retour le sentier descend toujours et suit l'eau vers l'aval; la roue du moulin puis le château d'eau sont en vue.
- **Limite connue**: l'aller ne fait que 80 m de voie entre le passage à niveau et le poste. Si le client le veut plus long, agrandir de 64 m vers l'ouest (question 2).
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
- `python3 -I controler_plan.py --eprouver`: casse une copie du plan de douze façons (dont les quatre retours du client) et vérifie que chaque casse est vue.
- Ajouter un lieu: copier `construire_plan.py`, remplacer les listes (zones, eaux, noeuds, arêtes, bâtiments, points, quêtes); le contrôle et le dessin ne changent pas.

## 11. Hypothèses et questions

Hypothèses à faire confirmer par le game-designer: le train du samedi vient de l'ouest (Hautefonte) et le tunnel mène à l'est vers Combe-Veilleuse; Émile est parti à pied par le tunnel; Ambroise loge dans l'ancienne menuiserie, Honorine au bout de la Grand-Route, Marthe au pied du parvis, Barnabé chez Mado; les obstacles des verrous; la vitesse de la draisine.

Questions pour le client, dans le compte rendu du level-designer.
