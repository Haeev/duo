# La Petite Ligne: audit de détail des modèles 3D

| Champ | Valeur |
|---|---|
| Relecteur | directeur-artistique |
| Date | 2026-10-31, de 13 h 47 à 14 h 10 UTC |
| Déclencheur | remarque du client sur l'établi: « des poutres qui dépassent, des escaliers qui ne ressemblent pas à des escaliers, etc. Il faudrait vraiment faire attention aux détails ! » Nos revues précédentes l'avaient manqué: elles jugeaient les plans de jeu, jamais chaque modèle de près. |
| Version auditée | branche de l'artiste 3D (`.claude/worktrees/agent-ae47cd43e0e645a0e/games/la-petite-ligne/assets/modeles/`), low poly arrondi, après les étapes 1 à 3 |
| Périmètre | les 163 nœuds racines de `index.json`: bourg (70), ferme (41), maison (30), personnages (19), train (3) |
| Suite | liste envoyée à l'artiste 3D (`ae47cd43e0e645a0e`) en deux messages, l'établi d'abord; points de placement envoyés au level designer (`ac055c30696f59bb8`); liste de contrôle ajoutée à la bible (section 8.10) |

## Méthode

- Rendu Blender 5.2 (moteur Workbench, couleurs de la palette, ombres et cavités, contour des faces arrière masqué) de chaque nœud racine, isolé, posé sur un sol, sous quatre angles: **a** la vue de jeu (iso, 45°, 35° de hauteur), **b** la vue opposée, **c** une vue basse de côté (8°), **d** une vue rapprochée en perspective. 360 px pour tout, 800 px pour les modèles à structure (bâtiments, mobilier, train), et des gros plans ciblés (bouts du quai, escalier du ponton, deux états de la maisonnette).
- Contrôle automatique par nœud: point le plus bas, îles de géométrie (sommets soudés à 0,2 mm près) au-dessus du sol qui ne touchent aucune autre pièce à 1,2 cm près (« îles isolées »). Le contrôle des faces inversées n'est pas fiable sur des maillages ouverts à facettes: je ne l'ai pas retenu comme preuve.
- Chaque planche relue à l'œil, avec la liste de la bible (section 8.10): rien ne flotte, rien ne traverse, rien ne dépasse sans raison, structure lisible, escaliers crédibles, échelle humaine, objets qui tiennent debout, surfaces propres, rien de provisoire, au bon endroit, dans le bon sens.

Limites: les personnages ne sont importés que sous la forme de leur armature (toutes les pièces superposées): je m'appuie sur les planches de l'artiste (`arrondi-habitants.png`, `arrondi-planche-joueur.png`) déjà relues. Le placement sur la carte (rotation, position) n'est pas vérifié en jeu ici: il est confié au level designer. Les outils (hache, bêche, scie, marteau, canne, arrosoir) ont leur origine dans la main: leur « point bas » sous le sol est normal.

## Synthèse

| Gravité | Nombre | Modèles |
|---|---|---|
| Grave (se voit au zoom de jeu ou casse la crédibilité d'un lieu clé) | 7 | établi, ponton, marquise du quai, épicerie, vélo, table, poêles |
| Moyen (se voit de près, à l'intérieur ou au détour d'une action) | 8 | tonnelle, charrette, heurtoir, rideaux, pain, maisonnette réparée, panneau de gare et plaque de la voiture, poule |
| Léger (finition) | 5 | bol de soupe, traits parasites des pignons, marchepieds de la voiture, barrière, tas de bois en double |

Les deux défauts cités par le client sont identifiés: les **poutres qui dépassent** sont les couvre-joints et le poteau de l'établi (et, au même titre, les poteaux qui percent la marquise du quai); les **escaliers qui ne ressemblent pas à des escaliers** sont les marches du ponton, trois planches qui flottent en l'air.

Ce que l'audit ne trouve pas: aucun modèle sans face visible, aucun objet à une échelle aberrante (portes, fenêtres et assises entre 0,45 m et 2,1 m comme il faut), aucune île isolée sur les bâtiments principaux.

## Défauts par modèle, du plus visible au moins visible

### Établi (`workbench`, bourg), capture `audit-01-etabli.png`

| Défaut | Gravité | Correction attendue |
|---|---|---|
| Les 5 couvre-joints du toit dépassent du bord haut et du bord bas de la tôle et passent au-dessus de la rive | grave | Les couper à la longueur du pan (ou 2 cm en retrait), posés sur la tôle |
| La tête du poteau arrière droit perce le toit (visible en vue de jeu) | grave | Poteau arrêté sous la tôle, sur une sablière |
| La tôle repose sur la tête des quatre poteaux, sans sablière ni chevron: le toit « flotte » | grave | Deux sablières qui relient les poteaux en tête, trois chevrons dans la pente |
| Le plateau et l'étagère de l'établi traversent le panneau du fond (vue arrière) | moyen | Panneau reculé ou établi avancé, 2 cm de jeu |
| Le panneau du fond s'arrête à mi-hauteur, accroché à rien en bas, loin de la tôle en haut | moyen | Bardage du sol à la sablière, ou panneau plus petit cloué sur deux traverses visibles |
| Trait fin rectangulaire et petits triangles sombres sur la tôle | léger | Faces en double supprimées, décalage de 3 mm |

### Ponton (`pontoon`, bourg), capture `audit-02-ponton-marquise.png`, en bas

| Défaut | Gravité | Correction attendue |
|---|---|---|
| L'« escalier » est fait de trois planches grises qui flottent en l'air au bout du ponton, en escalier, sans limon ni appui (vue de côté: elles pendent dans le vide); d'autres planches flottent sous le pont à l'autre bout | grave | Un vrai escalier vers l'eau: deux limons posés sur le pont et sur un poteau ou le fond, trois marches égales de 18 à 20 cm de haut et 30 cm de profondeur posées sur les limons; ou pas d'escalier |
| Îles isolées à 0,11, 0,22 et 0,33 m (les mêmes planches) | grave | Disparaissent avec la correction ci-dessus |

### Marquise du quai (`platform`, nœud `platform_canopy`, bourg), capture `audit-02-ponton-marquise.png`, en haut à droite

| Défaut | Gravité | Correction attendue |
|---|---|---|
| Les têtes des poteaux percent la tôle (pastilles noires au-dessus du toit) | grave | Poteaux arrêtés sous la tôle |
| La tôle, plate, de 3 m de profondeur, ne repose que sur une rangée de poteaux au bord, sans poutre ni console: elle ne tiendrait pas | grave | Poutre longitudinale en tête des poteaux, aisseliers ou fermes légères qui portent le porte-à-faux; tôle bombée à bord ondulé (bible 8.3) |
| Les bouts du quai sont des rampes lisses (pas d'escalier): acceptable | aucun | Rien, sauf si le level designer veut des marches |

### Épicerie (`ferrand_shop`, bourg), capture `audit-03-epicerie.png`

| Défaut | Gravité | Correction attendue |
|---|---|---|
| Le store traverse le pignon et ressort à l'arrière (pointe rouge visible en vue opposée) | grave | Store à la longueur exacte de la façade |
| Le store dépasse la façade côté gauche (une planche sort du mur en vue de côté) | grave | Idem |
| Les bras du store se voient au travers de la toile (vue rapprochée) | moyen | Bras sous la toile, fixés au mur |
| Fins traits qui traversent le pignon (pièces intérieures qui affleurent ou faces coplanaires) | léger | Nettoyer les faces qui affleurent |

### Vélo (`bicycle`, bourg), capture `audit-04-velo-tonnelle-cloche.png`, au milieu

| Défaut | Gravité | Correction attendue |
|---|---|---|
| La selle et le guidon flottent au-dessus du cadre (îles isolées à 0,88 et 0,94 m): ni tige de selle, ni potence | grave | Tige de selle, potence, fourche visible |
| Les deux caisses flottent au-dessus des roues, sans porte-bagages | grave | Un porte-bagages sous chaque caisse |
| Ni pédalier ni chaîne | moyen | Plateau et deux manivelles simples |
| Le vélo tient debout seul | moyen | Béquille, ou vélo modélisé incliné pour s'appuyer contre un mur |

### Table (`table`, maison), capture `audit-07-meubles-2.png`

| Défaut | Gravité | Correction attendue |
|---|---|---|
| L'entretoise flotte (île isolée à 12,5 cm du sol) et sort de l'emprise de la table | grave (meuble central de la pièce, vu à chaque repas) | Deux entretoises reliées aux pieds, ou une entretoise en H |

### Poêles (`stove`, `wood_stove`, maison), capture `audit-07-meubles-2.png`

| Défaut | Gravité | Correction attendue |
|---|---|---|
| Le tuyau monte de 1,5 m et s'arrête dans le vide; dans la pièce, un tuyau noir qui ne va nulle part (déjà visible sur les captures du soir des tours 1 et 3) | grave | Coude vers le mur ou tuyau jusqu'au plafond avec collerette; position du poêle contre le mur du conduit (level designer) |

### Tonnelle (`arbor`, bourg), capture `audit-04-velo-tonnelle-cloche.png`, en haut

| Défaut | Gravité | Correction attendue |
|---|---|---|
| Les feuilles de vigne des poteaux sont des losanges posés à côté des poteaux, qui flottent | moyen | Tiges en spirale autour des poteaux qui portent les feuilles |
| Le feuillage du dessus est fait de galettes posées en l'air au-dessus des lattes | moyen | Feuillage qui repose sur les lattes et retombe un peu sur les bords |

### Charrette à bras (`cart`, bourg), captures `audit-08-barriere-charrette-puits.png`, `audit-09-accessoires.png`

| Défaut | Gravité | Correction attendue |
|---|---|---|
| Caisse horizontale sur deux roues, brancards en l'air, sans béquille: elle basculerait | moyen | Béquille sous l'avant, ou brancards au sol et caisse inclinée de 10 à 15° |

### Heurtoir (`buffer_stop`, bourg), capture `audit-09-accessoires.png`

| Défaut | Gravité | Correction attendue |
|---|---|---|
| Les jambes ne touchent pas la poutre (jour en vue de côté) et les contrefiches la traversent | moyen | Jambes et contrefiches arrêtées sur la poutre et sur la semelle, avec platines |

### Rideaux (`curtains`, maison), capture `audit-06-meubles-1.png`

| Défaut | Gravité | Correction attendue |
|---|---|---|
| La tringle coupe les rideaux à mi-hauteur (forme en H) | moyen | Tringle en haut, rideaux qui pendent dessous; embrasses éventuelles plus basses et plus fines |

### Pain (`bread`, maison), capture `audit-06-meubles-1.png`

| Défaut | Gravité | Correction attendue |
|---|---|---|
| Les trois grignes sont des bâtons posés sur la miche, qui dépassent du bord | moyen | Grignes en creux ou en relief de moins de 1 cm, dans le contour |

### Maisonnette réparée (`gatekeeper_house_repaired`, bourg), capture `audit-05-maisonnette.png`

| Défaut | Gravité | Correction attendue |
|---|---|---|
| La lanterne murale chevauche le chambranle de la porte | moyen | Lanterne décalée de 15 cm |
| La penture du bas dépasse du vantail sur le mur | léger | Pentures arrêtées au bord du vantail |
| L'état ruiné (toit ouvert, ardoises tombées, porte condamnée) est cohérent | aucun | Rien |

### Panneau de gare (`station_sign`) et plaque de la voiture (`coach`), captures `audit-09-accessoires.png`, `audit-10-train.png`

| Défaut | Gravité | Correction attendue |
|---|---|---|
| Le nom est une suite de carrés: on lit un provisoire | moyen | Lettres simples (« AUBRUNE ») en relief ou en aplat, ou panneau uni |

### Poule (`hen`, ferme), capture `audit-11-ferme.png`

| Défaut | Gravité | Correction attendue |
|---|---|---|
| La queue est un pavé noir plat | moyen | Éventail de trois à cinq plumes facettées, un peu relevé |

### Défauts légers

| Modèle | Défaut | Correction attendue |
|---|---|---|
| `dish_soup` (maison) | Le manche de la cuillère traverse le bord du bol | Cuillère posée contre le bord |
| `firmin_house`, `station`, `ferrand_shop` (bourg) | Fins traits parasites sur les pignons (`audit-12-maisons-remise.png`) | Faces coplanaires ou intérieures supprimées |
| `coach` (train) | Marchepieds qui flottent sous les plateformes (îles isolées à 0,93 m) | Étriers qui les relient au châssis |
| `level_crossing_gate` (bourg) | La tige pendante au bout de la lisse s'arrête à 20 cm du sol | Béquille qui pose sur un support, ou tige plus courte clairement suspendue |
| `log_pile` et `woodpile` (bourg) | Modèles identiques | En garder un, ou les différencier |

### Modèles relus sans défaut notable

Gare (`station`, hors traits parasites), maison de Firmin, scierie, remise de la draisine (voir le placement des rails), puits, poteau de la cloche, bancs, lampadaire, boîte aux lettres, tableau d'affichage, caisse de la coopérative, piles de caisses, planches empilées, sacs, barrière et portillon, arbres et buissons, tonneau d'eau, mangeoire, cases du potager, cultures, chaise, coffre, poste à galène, lit, pot de fleurs, boîte en fer, plume, éléments de kit (porte, sol, murs, fenêtre), matelas roulé, lampe à pétrole, photo, colis, cadre, carte de l'énigme, tapis, clé, étagère, paillasse, locomotive, fourgon.

## Placement (transmis au level designer)

À vérifier sur la carte, avec la question « au bon endroit, dans le bon sens, à la bonne taille ? Pourquoi ? »:

- Barrières du passage à niveau (rotations 0 et 2): baissée, la lisse doit barrer la route, donc rester parallèle aux rails. Sur la capture en jeu à 19 h (`arrondi-bourg-en-jeu-19h.png`), la lisse nord semble suivre la route.
- Remise de la draisine: deux bouts de rails sortent sous les portes et s'arrêtent dans le vide.
- Panneau de gare face au quai, ponton qui part de la berge, côté ouvert de l'établi vers la cour, poêle contre le mur du conduit, rideaux sur une fenêtre, bancs face à ce qu'on regarde, fente de la boîte aux lettres côté chemin.

## Ce qui change pour la suite

- La bible porte désormais une liste de contrôle « détails de construction » (section 8.10), à cocher pour chaque modèle livré sur des rendus de près sous quatre angles, avec la question du placement.
- Mes revues visuelles ajoutent ce passage modèle par modèle à chaque livraison d'assets, en plus des plans de jeu.

## Annexe: rendu d'audit

Script lancé par `duo-python rendre.py -- <fichier sans .glb>`; il rend quatre vues par nœud racine et écrit le contrôle des îles dans un JSON. Copie de travail: `/tmp/lpl-audit/rendre.py` (hors dépôt).

- Il importe le GLB.
- Pour chaque matériau, il rend active l'image de la couleur de base, sinon Workbench rend tout en noir à cause de l'image d'émission.
- Il ajoute un sol à z = 0 et isole chaque nœud racine avec ses enfants.
- Il soude les sommets à 0,2 mm (l'export à facettes sépare chaque face) avant de chercher les îles.
- Quatre caméras: iso 45°/35°, iso 225°/35°, côté 110°/8° (orthographiques), perspective 315°/45°.

Proposition: verser ce script dans `games/la-petite-ligne/outils/` pour que l'artiste 3D le lance avant chaque livraison (décision du manager).
