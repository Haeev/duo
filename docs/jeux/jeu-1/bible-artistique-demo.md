# La Petite Ligne: bible artistique de la démo

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne (démo d'une heure, printemps à la Halte d'Aubrune) |
| Statut | proposition de l'artiste 3D, à relire par le directeur artistique |
| Version | 0.1, 2026-10-31 |
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
