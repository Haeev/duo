# La Petite Ligne: bible artistique de la démo

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne (démo d'une heure, printemps à la Halte d'Aubrune) |
| Statut | proposition de l'artiste 3D, à relire par le directeur artistique |
| Version | 0.4, 2026-10-31 (formes: low poly arrondi, section 8; liste de contrôle des détails de construction, 8.10) |
| Sources des couleurs | `games/la-petite-ligne/assets-src/modeles/palette.py` (seule source; ce document en est l'extrait) |
| Planches | `games/la-petite-ligne/assets-src/modeles/planches/` (scène assemblée de jour et de nuit, personnages, poses, bâtiments, ferme, train, maison) |

## 1. Intention

- Une vallée tendre et un peu passée, comme un livre d'images des années cinquante: formes simples et rondes, couleurs douces et chaudes, rien de criard sauf les foulards des deux joueurs.
- 3D aux formes simples, ombrage en aplats (une normale par face): le volume se lit par les facettes, pas par des textures.
- À la Halte, pierre et bois: murs de moellons crème et gris chaud, lauzes bleu ardoise, tuiles canal pour la halte et la maison de Firmin, bois patiné pour la scierie et la remise, volets peints (rouge cheminot, bleu, sauge).
- Lisible en vue isométrique de 16 à 36 m de large: tout détail utile au jeu fait au moins 10 cm, les têtes sont un peu grosses (un sixième de la hauteur), chaque habitant a une silhouette à lui (casquette de Firmin, chignon et tablier d'Odette, barbe et béret de Basile, tresses et salopette de Jeanne).

## 2. Palette par rôle (printemps)

Valeurs sRGB. L* (CIELAB) donné quand la lisibilité en dépend.

| Rôle | Cases et couleurs |
|---|---|
| Herbe | `grass` #93B45E (L* 69), `grass_light` #AEC874, `grass_dark` #6F9148 (L* 56), herbes sèches `grass_dry` #C9BE78, mousse `moss` #809B4F |
| Terre nue | `soil` #A9835B (L* 57) |
| Terre bêchée | dessus des sillons `soil_tilled_light` #957150 (L* 50), fond `soil_tilled` #7C5A3C (L* 41) |
| Terre arrosée | `soil_wet_light` #614835 (L* 33), `soil_wet` #4E3A2A (L* 26), rugosité 0,32 (brillante), flaques `water` |
| Terre fatiguée (regard du métier) | `soil_tired` #958B7D (L* 58, grise) |
| Chemins | terre battue `path` #CFB489 (L* 75), `path_dark` #B69B73; pavés `cobble` #ABA498 et #8E877C; sable des berges `sand` #DCCAA2; berge `bank` #8C7558 |
| Voie | ballast `ballast` #9D968B et #7F786E, traverses `wood_dark` #765130, rails `rust` #8F5C40 et tête `rail_steel` #8C8E91 (métal) |
| Eau | `water` #6CAAB9 (rugosité 0,08), profond `water_deep` #4C899A, écume `water_foam` #D4ECEB |
| Pierre | murs `stone` #C0B4A1, encadrements et chaînes d'angle `stone_light` #DAD0BE, soubassements `stone_dark` #9B907F, rochers `rock` #A09C92, #BEB9AD, #7F7B73 |
| Lauzes | `lauze` #737B86, `lauze_light` #8B939C, `lauze_dark` #5D646F |
| Tuiles | `tile` #B86B4F, `tile_dark` #985541, briques `brick` #A95F49 |
| Enduits | crème `plaster_cream` #EBDCBF (halte, intérieurs), ocre `plaster_ochre` #DEBA80 (épicerie), rose `plaster_rose` #DEAF9D (réserve), ombre `plaster_shade` #CDBB9C |
| Bois | neuf `wood_new` #D3A66D, bois `wood` #A97749, sombre `wood_dark` #765130, vieux bois grisé `wood_old` #908879 et #6F685E, écorce `bark` #6E5743 et #554230, bouleau `birch_bark` #EAE4D7, coupe `log_end` #E3C18A |
| Peintures | rouge cheminot `paint_red` #9B4C3B, sauge `paint_green` #7F9C79, bleu `paint_blue` #7090A5, crème `paint_cream` #E8DDC4, jaune poste `paint_yellow` #D9B65B |
| Feuillages | chêne `leaf_oak` #6C9944 et #8DB556, sapin `leaf_fir` #3F6C4D et #52845B, bouleau `leaf_birch` #A6C35E et #C4D877, buissons #5E8B45, noisetier #7EA24C |
| Cultures | feuilles `leaf_crop` #6FAA47 et #A3CF63, fanes de carotte #5E9A3E, radis #D44B5D (pointe #F2DCDF), carotte #E98A3B, laitue #98C95D et #C6E17F, graines #D9C69B, pousses #A7D569 |
| Fleurs | coquelicot #D9584F, bouton d'or #F2C74E, pâquerette #F6F2E7, bleuet #7191D9, rose #E89CB6, violette #A685D0 |
| Train | vert loco `loco_green` #3F6453 et #507B65, traverse rouge `loco_red` #A4463B, noir `black` #2C2E31, laiton `brass` #C8A150; voiture brun `coach_brown` #7B4636 et crème `coach_cream` #E7D8B6; fourgon `van_wood` #8B6F56 |
| Tissus du décor | store `awning_red` #C65B4B et `awning_cream` #F1E5C9, linge #F0E4CA, édredon #6B87B1, tapis #BA554C, rideaux #DA9BA4 |
| Lueurs de nuit (émission) | vitres #FFC874, verre des lanternes #FFC264, flamme #FFB347, abat-jour #FFD89A, cadran du poste #FFCF7A, braises #FF7A2E |

### Personnages (une rangée de 16 cases par personnage)

Rôles des cases, identiques pour tous: peau, ombre de peau, cheveux, cheveux sombres (sourcils), yeux, bouche, haut, liseré, bas, chaussures, foulard, symbole du foulard, accessoire A, accessoire B, métal, joues.

| Personnage | Couleurs principales |
|---|---|
| Joueurs, tenues proposées | bleu de travail #5C7FA6 et #4A5D78; rouille #B5663F et #6B5541; sauge #8BA37B et #5E6A55; moutarde #D4A746 et #6E5B48 (liseré crème #EDE6D3) |
| Joueurs, peaux et cheveux | peaux #F2CDB0, #E8BE9A, #D29E78, #B9825C, #8E5C3E, #6A4430; cheveux #2E2622, #4F3626, #6B4A33, #A0663A, #C9A267, #B8B2AA |
| Foulards des joueurs | couleur du profil Duo (aqua #5CE1E6, mauve #8D6CFF, anis #D4F27A, corail #FC663F, rose #E787B1, vert #22B07D), symbole en #0E1126 |
| Firmin | veste de cheminot #2F3F5C, pantalon #4D5258, casquette #28344C à bandeau #B33A33, boutons laiton #D2AA55, moustache grise #B9B4AC |
| Odette | robe prune #9C4F67 et #7E3F55, tablier #F4EEE2, bas #D7C7B0, chignon gris #8D7F78, joues roses |
| Basile | chemise vert-de-gris #A8B6A0, tablier de cuir #8E5B37, béret #6E4428, barbe blanche #E4E0D8 |
| Jeanne | chemise jaune #F2D46B, salopette bleue #557FB0, tresses rousses #B5652F à rubans #D9584F, chaussures rouges #B53F3A |
| Lucie (hors démo) | veste de la poste #4E6F8F à galon #E0C25A, képi #3D5874, sacoche #8C5A35 |

Les foulards sont les seules couleurs vives des personnages: aucun habitant n'en porte, pour qu'un joueur se repère d'un coup d'œil.

## 3. Matériaux

- Décor, ferme, train, maison: un seul matériau `lpl_palette`. Texture `palette.png` de 64 x 64 (16 x 16 cases de 4 px), filtrage au plus proche; chaque face pointe au centre d'une case. Deux compagnes de même disposition: `palette-mr.png` (rugosité dans le vert, métal dans le bleu) et `palette-emission.png` (lueurs de nuit).
- Personnages: un seul matériau `lpl_characters`, texture `personnages.png` (une rangée par personnage). Le jeu personnalise un joueur en repeignant sa rangée (CanvasTexture), sans toucher aux maillages.
- Saisons: `palette-ete.png`, `palette-automne.png`, `palette-hiver.png` ne changent que les herbes et les feuillages; on remplace la texture, rien d'autre.
- Pas de texture détaillée, pas de couleurs de sommets, pas de transparence. Les ombres de contact et l'éclairage restent au technical artist.

## 4. Lumière voulue (consignes pour le technical artist)

Une lumière directionnelle avec ombre, une hémisphérique, quatre ponctuelles au plus (budgets de la plateforme). Valeurs de départ, à régler sur le PC de référence.

| Moment | Soleil (direction, couleur, force relative) | Ciel et sol (hémisphérique) | Émission de la palette | Ambiance |
|---|---|---|---|---|
| Matin (6 h à 10 h) | à l'est, bas (15 à 30 degrés), #FFD9A8, 0,8 | ciel #CFE0EE, sol #9DAA7A | 0 | rosée, ombres longues et douces, couleurs fraîches |
| Midi (11 h à 15 h) | au sud, haut (55 à 65 degrés), #FFF4E0, 1,0 | ciel #D9E8F2, sol #A2B07E | 0 | net et clair, les cultures et les cases se lisent le mieux |
| Soir (16 h à 19 h 30) | à l'ouest, bas (10 à 20 degrés), #FFB577, 0,7 | ciel #F2C9A0, sol #8F8A6A | de 0 à 0,4 après 19 h | doré; entre 17 h et 17 h 30 l'ombre de la cloche du quai doit toucher le banc (énigme S4): caler l'azimut sur la carte |
| Nuit (20 h à 6 h) | lune froide, haute, #9FB4FF, 0,15 | ciel #1E2A44, sol #2A3326 | 1 (fenêtres, lanternes, lampadaires, flamme, cadran) | bleu nuit et îlots chauds; lampadaires et lampe à pétrole en ponctuelles chaudes (#FFC070) |

- Le matériau exporté porte l'émission à 1: le jeu doit mettre `material.emissiveIntensity` à 0 le jour et la remonter à la tombée de la nuit (planche `scene-bourg-nuit.png`).
- Ombres légères: densité modérée (le sol ne doit jamais devenir noir), carte de 1024 à 2048.
- Pluie (jour 4): soleil voilé à 0,4, ciel gris doux #B9C4CC, sol arrosé partout (le jeu pose la case `garden_cell_tilled_wet`).

## 5. Lisibilité de la grille et des cultures

- La case du potager est une butte de 0,92 m: entre deux cases, un sillon de 8 cm laisse voir l'herbe. La grille se lit sans quadrillage dessiné.
- Trois états très éloignés en clarté, donc lisibles aussi en vision daltonienne et en niveaux de gris: herbe (L* 69), bêchée (L* 41 à 50, trois billons), arrosée (L* 26 à 33, brillante, petites flaques). La terre fatiguée est grise (L* 58), réservée au regard du métier.
- Chaque culture a sa silhouette: radis en rosette basse, carottes en fanes hautes et fines, laitue en pomme ronde. Aux stades semis et pousse, un petit piquet porte une étiquette à la couleur de la culture (rouge, vert, orange). Au stade mûr, le produit se voit (radis rouge, collet orange, pomme claire).
- Récoltes et objets « sautent au sac » à l'échelle de jeu, un peu grossis (un radis fait 10 cm) pour rester lisibles.
- La qualité « belle » se signale par un effet (technical artist), pas par un autre modèle.

## 6. Personnages

- Squelette commun de 18 os, hauteur 1,74 m avec les cheveux (gabarits de 1,6 à 1,8 m par mise à l'échelle), Jeanne à 0,75.
- Les joueurs: silhouette neutre, sans choix de genre; trois coiffures (courte, carré, chignon), trois coupes de tenue (chemise et pantalon, blouse longue, salopette), quatre couleurs de tenue, six peaux, six couleurs de cheveux; le foulard noué porte la couleur et le symbole du profil.
- Expressions par la forme des yeux, des sourcils et de la bouche (clés de forme): neutre, contente, ravie (yeux en arc, joues roses), fatiguée (paupières basses, sourcils tombants), affamée (bouche ronde, sourcils inquiets), plus le clignement pour dormir.

## 7. Conventions de production

1 unité = 1 m, Y en haut, façade et regard vers +Z, origine au centre de l'emprise au sol, emprises en mètres entiers, noms anglais en `snake_case`. Les noms de nœuds suivent les données du jeu (`games/la-petite-ligne/donnees/`) et la carte (`donnees/cartes/halte.json`). Détail par modèle: `games/la-petite-ligne/assets/modeles/README.md`.

## 8. Formes: low poly arrondi

Décision du client (2026-10-31): le jeu est trop « angle droit », il demande de la courbure. Le style devient un **low poly arrondi**: les mêmes facettes visibles, mais plus aucune arête vive ni aucun coin à 90° là où l'œil s'arrête. On arrondit par des chanfreins à facettes et des volumes gonflés, jamais par un lissage des normales.

État au 2026-10-31: le client a validé vers 13 h l'application de la règle à tout le bourg, après les trois modèles témoins.

### 8.1 Ce qu'on garde

- Les facettes visibles: une normale par face (ombrage en aplats), pas de lissage, pas de normales moyennées sur les chanfreins. Un chanfrein se voit comme une ou deux bandes de lumière, c'est voulu.
- La palette (section 2, `palette.py`), le matériau unique `lpl_palette` et `lpl_characters`, les textures de 64 x 64, les lueurs de nuit.
- La lumière (section 4 et réglages du technical artist), l'échelle (1 unité = 1 m), les emprises en mètres entiers, les noms de nœuds, les douilles (`socket_*`) et les hauteurs utiles (`walk_height`, `seat_height`, `sleep_height`).
- Le squelette commun de 18 os et tous les clips: les personnages changent de peau, pas d'os.
- La règle des 10 cm: tout détail utile au jeu reste d'au moins 10 cm.

### 8.2 Chanfreins (biseaux à facettes)

| Taille de l'objet (plus grande dimension) | Largeur du chanfrein | Segments | Exemples |
|---|---|---|---|
| Moins de 0,5 m | 1,5 à 2 cm | 1 | outils, pots, gamelles, œufs, cadre |
| 0,5 à 2 m | 3 à 4 cm | 2 | meubles, caisses, bancs, tonneaux, puits, tableau |
| 2 à 6 m | 6 à 8 cm | 2 | remise, poulailler, marquise, wagons |
| Plus de 6 m | 8 à 12 cm | 2 | murs et angles des bâtiments, quai |

- Chanfreiner les arêtes vues par la caméra (angles verticaux des murs, bords des toits, dessus des meubles et des marches). Les arêtes posées au sol ou cachées restent vives.
- Pas plus de 2 segments: au-delà, la facette disparaît et le coût monte sans gain lisible à 16 à 36 m de champ.
- Pierres, moellons et pierres d'angle: coins abattus irréguliers (pas de cube ni de rectangle parfait), décalés de 1 à 3 cm d'un bloc à l'autre.

### 8.3 Toits

- Débords: 30 à 40 cm au pignon, 25 à 35 cm à l'égout; rive épaisse de 12 à 15 cm, chanfreinée (2 segments).
- Faîtage fléchi de 6 à 10 cm au milieu et pans bombés (une rangée de sommets intermédiaire décalée de 4 à 6 cm): le toit doit paraître posé et mou, pas tiré à la règle. En dessous de 6 cm, la courbure ne se voit pas à 24 m de champ (constaté sur le témoin `firmin_house`).
- Lauzes et tuiles: rangs suggérés par des bandes de facettes, pas par des tuiles modélisées une à une. Cheminées chanfreinées, chapeau débordant de 5 cm.
- Auvents, store et marquise: bord libre ondulé ou arrondi, jamais une dalle plate.

### 8.4 Cylindres: nombre de pans

| Objet | Diamètre | Pans |
|---|---|---|
| Troncs de chêne et de bouleau | 25 à 45 cm | 8 (tronc légèrement évasé au pied, 3 racines) |
| Troncs de sapin | 15 à 30 cm | 7 |
| Poteaux de clôture, pieds de banc, poteau de la cloche | 8 à 15 cm | 6 |
| Lampadaires (fût) | 10 à 12 cm | 6, socle et lanterne chanfreinés |
| Tonneaux, seaux, puits (margelle) | 40 cm à 1,2 m | 10 à 12 |
| Tiges, manches d'outils, cannes | moins de 5 cm | 5 |
| Roues du train | 60 cm à 1,2 m | 14 à 16 |

Jamais moins de 5 pans pour une pièce ronde vue, jamais plus de 16.

### 8.5 Personnages

- Hauteur inchangée (1,74 m avec les cheveux, Jeanne à 0,75), positions des os inchangées, clips inchangés.
- Tête plus grosse: un cinquième de la hauteur (environ 34 cm, contre un sixième), boule facettée de 10 à 12 pans, plus large que haute de 5 %, menton arrondi; nez et oreilles en petites formes à 1 segment. Si la hauteur de 1,74 m coince, prendre la place sur le cou et le haut du torse, jamais sur les jambes.
- Torse en tonneau: section octogonale, épaules arrondies (pas de carré d'épaule), ventre et dos légèrement bombés, taille à peine marquée, épaisseur du corps +15 %; silhouette gonflée, douce, sans coin. Le changement doit se voir au zoom de jeu: un joueur arrondi qui garde la silhouette d'avant n'est pas accepté.
- Membres: cylindres de 6 pans effilés et un peu renflés au milieu, coudes et genoux sans pointe; mains en moufles arrondies (pouce seul détaché), pieds et chaussures en galets arrondis.
- Cheveux et coiffes en masses arrondies, mèches en lobes (jamais un casque cubique): casquette de Firmin, béret de Basile, chignon d'Odette, tresses de Jeanne gardent leurs silhouettes distinctes, en plus rondes.
- Le foulard des joueurs grossit d'un tiers, avec un pan qui dépasse de la silhouette: c'est le signe du profil Duo, il doit se lire de loin.
- Repeindre la rangée du personnage (`personnages.png`) doit continuer de marcher: mêmes cases de palette, mêmes rôles (section 2).
- Poids de peau recalculés pour le volume gonflé, ou peau rigide par pièce tant qu'aucune traversée ne se voit; vérifier au moins `idle`, `walk`, `hoe`, `water` et `carry_two` (bras devant le torse plus gros: écarter l'épaule de 1 à 2 cm si besoin, sans bouger l'os). Le budget du joueur (3 200) est là pour arrondir: ne pas finir sous le compte d'avant.

### 8.6 Feuillages

- Chênes, bouleaux, noisetiers: houppier en 2 à 4 boules facettées (icosphère subdivisée une fois, 80 faces, déformée de 10 à 20 % pour casser la symétrie), qui se chevauchent; deux tons de la palette par arbre.
- Sapins: 3 ou 4 cônes empilés de 7 pans, bords inférieurs arrondis (1 segment de chanfrein), pointe un peu molle.
- Buissons: 1 à 3 boules aplaties (icosphère de 20 à 80 faces), posées au sol, sans pied visible.
- Le vent (section 4, technical artist) agit déjà sur ces cases de palette: garder les feuillages sur les cases `leaf_*` pour qu'ils bougent.

### 8.7 Sol et terrain

La grille de la simulation (cases d'un mètre franchissables ou non) ne change pas; seule sa forme visible change.

- Chemins: bords en courbes (rayon d'au moins 0,75 m, un segment tous les 25 cm environ), coins arrondis d'au moins 0,5 m de rayon, plus aucun escalier de cases.
- Herbe: teinte continue (mélange des trois verts par un bruit doux en coordonnées du monde), plus de carrés à bords francs.
- Berges de la rivière: contour courbe et irrégulier, deux niveaux de pierres arrondies, quelques roseaux; plus de canal rectangulaire ni d'angle droit.
- Place du bourg: pavés en appareillage (rangs décalés ou éventails), joints plus sombres, écart de gris entre pavés de 8 niveaux au plus (contre environ 30 aujourd'hui); le dallage au hasard case par case est retiré.
- Gué: pierres plates irrégulières de 5 à 7 côtés, de 30 à 60 cm, espacées de 10 à 20 cm, avec l'eau qui passe entre elles; plus de dalle continue.
- Quai et ballast: bords chanfreinés, rives du ballast en talus arrondi.

### 8.8 Budgets pour le PC de référence (Intel UHD 620)

Plafond de la plateforme: 250 000 triangles et 150 appels de dessin à l'écran. Mesure du tour 1 du gauntlet: 130 000 à 207 000 triangles selon le plan, dont environ 70 000 pour les modèles de la carte et le reste pour le terrain et la végétation semée par le rendu. La marge est donc mince: le low poly arrondi doit tenir **225 000 triangles au plus dans le plan le plus chargé** (10 % de réserve).

| Élément | Aujourd'hui | Plafond arrondi |
|---|---|---|
| Bâtiment principal (épicerie, halte, maison de Firmin) | 2 000 à 3 300 | 5 000 |
| Petit bâtiment (maisonnette, remise, scierie, poulailler) | 1 000 à 2 000 | 3 000 |
| Marquise du quai | 1 730 | 2 500 |
| Meuble ou accessoire | 40 à 650 | 900 |
| Chêne, bouleau (instancié, 51 arbres sur la carte) | variable | 450 |
| Sapin | variable | 300 |
| Buisson (instancié, 79 sur la carte) | variable | 160 |
| Joueur complet (base, tenue, coiffure, foulard) | 2 190 | 3 200 |
| Habitant | 2 160 à 2 590 | 3 600 |
| Poule | 450 | 500 |
| Corps de locomotive, de voiture, de fourgon | 1 130 à 1 650 | 2 400 |
| Décor de toute la carte (modèles, sans terrain ni semis) | environ 43 000 | 65 000 |
| Terrain et végétation semée par le rendu | environ 130 000 | pas plus qu'aujourd'hui (les courbes du sol se paient en réduisant les touffes si besoin) |

- Aucun nouveau matériau, aucune nouvelle texture: le budget de programmes (12) ne bouge pas.
- `index.json` donne les triangles de chaque nœud: tout dépassement de plafond est signalé dans le README des modèles avec sa raison.
- Contrôle de réception: le plan le plus chargé (place à 19 h, train à quai) mesuré par `detailedStats()` sous 225 000 triangles et 150 appels.

### 8.9 À faire et à éviter

- À faire: arrondir là où la lumière accroche (bords de toits, angles de murs, dessus des meubles); exagérer un peu les volumes (toits gonflés, troncs évasés, têtes rondes); casser les symétries parfaites de quelques centimètres.
- À éviter: le lissage des normales (on perdrait le style à facettes), les biseaux de plus de 2 segments, les sphères parfaites lisses, les arêtes vives au premier plan, et toute forme qui imite un jeu existant.

### 8.10 Liste de contrôle « détails de construction » (chaque modèle livré)

Ajoutée le 2026-10-31 après la remarque du client sur l'établi (« des poutres qui dépassent, des escaliers qui ne ressemblent pas à des escaliers »). À cocher pour chaque modèle, sur des rendus de près sous quatre angles (vue de jeu, vue opposée, vue basse de côté, vue rapprochée), avant toute livraison. Un seul « non », et le modèle n'est pas livré.

1. **Rien ne flotte**: chaque pièce touche ce qui la porte (sol, mur, poutre, plateau). Pieds, roues, poteaux et socles posent au sol; pas de jour entre une jambe et ce qu'elle soutient. Contrôle par script: aucune île de géométrie au-dessus du sol qui ne touche aucune autre pièce (tolérance 1 cm).
2. **Rien ne traverse**: aucune pièce ne passe au travers d'une autre (store à travers un mur, établi à travers un panneau, cuillère à travers un bol, poteau qui perce un toit). Une pièce s'arrête sur ce qui la porte.
3. **Rien ne dépasse sans raison**: lattes, couvre-joints, chevrons et planches coupés à la bonne longueur; un débord se justifie (toit, rive, about de poutre de 5 à 15 cm au plus).
4. **Structure lisible**: un toit repose sur des poutres, des sablières ou des consoles visibles; un porte-à-faux a ses aisseliers; un poteau porte quelque chose; une étagère, une table et un banc ont des assemblages qui tiendraient (traverses, entretoises reliées aux pieds).
5. **Escaliers crédibles**: marches de 15 à 20 cm de haut et de 25 à 30 cm de profondeur, toutes égales; marches posées sur des limons ou sur un massif; marche et contremarche lisibles par deux tons ou un nez de marche; pas de dalles qui flottent en escalier.
6. **Échelle humaine**: portes de 2 à 2,10 m de haut et 0,8 à 0,9 m de large; poignées vers 1 m; fenêtres avec appui vers 0,9 m; plateaux de table vers 0,75 m; assises vers 0,45 m; marches comme au point 5. Comparer à un personnage de 1,74 m posé à côté.
7. **Objets qui tiennent debout**: un vélo a sa béquille ou s'appuie contre un mur, une charrette à deux roues a sa béquille ou ses brancards au sol, un objet empilé repose à plat.
8. **Surfaces propres**: aucune face manquante, inversée ou en double (traits fins, papillotement, triangles sombres sur une surface plane); rien d'intérieur qui affleure à travers un mur.
9. **Rien de provisoire**: pas de texte remplacé par des carrés, pas de pavé à la place d'une forme (queue de poule, grignes de pain), pas de doublon inutile entre deux modèles.
10. **Au bon endroit, dans le bon sens, à la bonne taille, et pourquoi** (règle du studio « Cohérence du monde et sens du détail »): une barrière de passage à niveau barre la route, une enseigne fait face à la rue ou au quai, une porte donne sur un chemin, un banc regarde ce qu'on contemple, un tuyau de poêle rejoint un conduit, des rails mènent quelque part. Ce qui relève du modèle (orientation de son axe, pièces qui le relient au reste) est à l'artiste 3D; ce qui relève de la carte (position, rotation) est au level designer.

Piège connu: les ombres du moteur Workbench de Blender dessinent de faux traits fins sur les grands murs plats; un trait suspect se confirme avec les ombres coupées, ou dans Cycles ou Three.js, avant d'être signalé.

Outils: le script de rendu d'audit (quatre vues par nœud racine dans Blender, contrôle des îles qui flottent) décrit dans `docs/jeux/jeu-1/gauntlet/revues/audit-modeles.md`.

## 9. Historique

| Date | Version | Changement | Par |
|---|---|---|---|
| 2026-10-31 | 0.1 | Première version (palette, matériaux, lumière, lisibilité, personnages) | artiste 3D |
| 2026-10-31 | 0.2 | Section 8 « Formes: low poly arrondi » (décision du client: plus de courbure), budgets du PC de référence; section 9 | directeur artistique |
| 2026-10-31 | 0.3 | Réglages après la planche des témoins de l'artiste 3D: flèche du faîtage de 6 à 10 cm et bombé des pans de 4 à 6 cm (3 à 5 et 2 à 4 cm invisibles à 24 m), pierres d'angle irrégulières, tête de 10 à 12 pans, coiffures en lobes, torse bombé, clips à vérifier, budget du joueur à employer. Style appliqué aux seuls témoins jusqu'à l'accord du client | directeur artistique |
| 2026-10-31 | 0.4 | Le client valide l'arrondi pour tout le bourg (vers 13 h); section 8.10, liste de contrôle « détails de construction » après sa remarque sur l'établi, avec la question « au bon endroit, dans le bon sens, à la bonne taille » | directeur artistique |
