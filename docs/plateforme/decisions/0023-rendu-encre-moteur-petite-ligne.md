# ADR 0023: Rendu encré dans le moteur de La Petite Ligne: matériau partagé, contour par post-traitement, ambiances en données

| Champ | Valeur |
|---|---|
| Statut | proposée (première tranche livrée, en attente de relecture par le manager) |
| Date | 2026-11-10; mise à jour du même jour: points 11 à 14 (résolution interne adaptative, outil de mesure, économies sans effet sur l'image, couleurs), après le premier essai du client sur ses deux machines |
| Rédacteur | tech-artist |
| À relire par | architecte-technique (cible de rendu, budgets), directeur-artistique (écart à la bible 4.1), dev-gameplay-3d (tuiles, personnages), qa-testeur (parcours en rendu logiciel) |
| Jeu | `games/la-petite-ligne-2/src/rendu/encre/`; essai: `docs/jeux/jeu-1/refonte/essai-encre.md`; bible artistique 0.2 (section 4) |
| Liens | s'appuie sur l'ADR 0018 (un lieu actif, ressources par lieu), 0021 (personnages modulaires), 0022 (tuiles, budgets par tuile) |

## Contexte

Le client a validé le style « bande dessinée encrée » sur la scène d'essai (`src/rendu/demo-encre/`), mais le vrai jeu s'affichait encore dans l'ancien rendu en aplats (matériaux standard de Three.js, ombres de Three.js). Ses règles: éviter le plat absolu; la lisibilité avant la quantité d'encre; nuanceurs et ombres très soignés; un seul niveau de rendu pour le Mac et le PC (Intel UHD 620, 1366 x 768, 30 images par seconde au moins); caméra à 50 degrés qui s'abaisse au zoom serré; zoom de jeu de 18 m.

## Options

| | A. Matériau maison partagé et contour en post-traitement | B. Greffe sur les matériaux de Three.js et coque inversée (bible 4.1) |
|---|---|---|
| Contour | silhouettes, arêtes et joints, hiérarchisé selon la taille à l'écran | silhouettes seulement, le double de triangles |
| Couleur | valeurs d'écran, un ton du nuancier ressort tel qu'écrit | éclairage physique à contourner |
| Coût | une cible à deux sorties, une passe plein écran d'une vingtaine de lectures | aucun post-traitement |
| Preuve | scène d'essai, passes 1 à 3 | `encre-contours-compares.png` (passe 1): écartée |

## Décision

**Option A**, en production dans `src/rendu/encre/`.

1. **Un matériau encré partagé** (`InkMaterial`, `matiere.ts`): un seul nuanceur pour le sol, le décor fusionné, le semis instancié, les modèles livrés et les personnages (variantes `CHARACTER` et `ATLAS`). Rampe à trois tons francs, ombre teintée par l'ambiance, hachures ancrées au monde, relief par la carte de hauteur des couches de traits, zone « peau lisse » du visage. Il parle comme un matériau standard là où le moteur en a besoin (`color`, `opacity`, `transparent`, `emissive`, `clone()`): fondu des murs et des toits, houppiers effacés et lueur de la cible marchent sans changement.
2. **Attribut `aInk`** par sommet (couche de traits, code de pièce, nature, code de morceau; 6 bits de numéro et 2 bits de classe de taille). Il est posé à la fabrication par `GeometryBuilder` (tuiles, bâtiments), et par **conversion automatique** pour tout modèle livré (`conversion.ts`: morceaux d'un seul tenant, couche tirée de la teinte par des règles en configuration). Un nouvel objet de `assets/commun/` en profite sans code.
3. **Contour par post-traitement hiérarchisé** (`contour.ts`): cible à deux sorties (couleur; normale, morceau, pièce) et profondeur, puis une passe qui trace le trait. Cinq rangs; un rang n'est tracé que si ce qu'il cerne dépasse 12 à 28 points à l'écran. La même passe pose teinte dominante, vignette et fondus au noir. Écart assumé à la bible 4.1, à faire entériner par le directeur artistique.
4. **Ombres** (`ombres.ts`): carte du soleil de 2 048 cadrée sur la vue et calée sur ses texels; une carte de 512 en cône pour la lampe la plus proche du joueur local; ombre de contact sous les personnages. Les ombres de Three.js sont coupées en encre.
5. **Ambiances en données** (`ambiances.json`, schéma dans `ambiances.ts`): une fiche par identifiant d'ambiance du climat (`climat.json`), sinon `defaut`; cinq heures repères (aube, midi clair, fin d'après-midi dense, crépuscule, nuit) dehors et dedans, interpolées en continu avec l'heure du jeu; météo en facteurs; un lieu clos peut donner la teinte de ses lampes et du dehors (`ambience` de `lieu.json`). Flaques de lampes et rectangles de fenêtres viennent des bâtiments et des familles de modèles éclairantes.
6. **Bâtiments livrés** (`lieu/batiments.ts`): le manifeste `batiments.json` d'un lieu donne un modèle par bâtiment de la carte; fusionné en une géométrie au chargement (un appel), couche de traits d'après le nom du matériau, fenêtres du rez-de-chaussée pour les rectangles de lumière. Sans modèle, les volumes provisoires restent.
7. **Sol sans grille** (`sol.ts`): une texture d'un point par case (teinte, couche, sol posé par l'homme), lue en un point qui ondule; plancher des pièces et sols déclarés (`floor`) compris.
8. **Un seul niveau de rendu**: rien dans `encre/` ne lit les options graphiques. Deux garde-fous de fluidité, sans effet sur l'image: les programmes se compilent un par image à l'arrivée dans un lieu (au lieu d'un gel de plusieurs secondes), et le rendu saute des images s'il sature (rendu logiciel des tests). La résolution interne adaptative du point 11 n'est pas un second niveau: voir ce point.
9. **Interrupteur de transition**: `RenderOptions.style` et `?rendu=aplats` rendent l'ancien rendu; `encre` est le défaut (`INK_SETTINGS.style`).
10. **Caméra** du style encré: 50 degrés à 18 m et au-delà, 35 degrés à 6 m, zoom de jeu 18 m, bornes 6 à 28 m (28 m: budget de tuiles de l'ADR 0022; l'essai allait à 40 m).
11. **Résolution interne adaptative** (`echelle.ts`, `INK_SETTINGS.resolution`). La scène et le contour se calculent à une échelle interne, part du côté du tampon du canevas; l'image finie est ensuite mise à l'échelle du canevas par une passe bicubique bornée de cinq lectures (plus nette qu'un étirement, sans halo le long des traits). Paliers 100, 85, 75 et 70 %, jamais dessous. Descente d'un palier quand la moyenne des images dépasse le budget de 33,4 ms (30 images par seconde) de 4 % pendant 1,5 s; remontée quand le temps prévu au palier du dessus (moyenne fois rapport des surfaces) reste sous 80 % du budget pendant 8 s; une remontée ratée (redescente dans les 20 s) double l'attente de la suivante, jusqu'à 240 s: pas de va-et-vient. Rien n'est jugé pendant la mise en route d'un lieu. **Conforme à la décision du client « un seul niveau de rendu, identique sur les deux machines »**: mêmes passes, mêmes effets, même image; seule la finesse varie, comme entre deux écrans de définitions différentes. Pour que ce soit vrai, tout ce qui se compte en points (seuils de détail, rangs du trait, pas des hachures des personnages, taille des particules) reste compté en points du canevas et non de la cible interne: la composition de l'image ne dépend pas de l'échelle interne. À 100 %, l'image est celle d'avant, au point près. **Option pour la figer**: `mode: 'fixed'` et `fixedScale` dans les réglages, `?echelle=1` dans l'adresse, bouton « Échelle » de l'outil de mesure. En rendu logiciel (tests, banc) l'échelle reste à 100 %. Le gouverneur de qualité de l'ancien rendu (`qualite.ts`) n'est plus consulté en encre.
12. **Outil de mesure dans le jeu** (`mesure.ts`, `panneau-mesure.ts`): `F9`, `Ctrl` + `Maj` + `M` ou `?mesure=1`. Images par seconde en moyenne et au premier centile, temps par image, temps par passe sur le processeur graphique quand `EXT_disjoint_timer_query_webgl2` existe, appels et triangles par passe, programmes, tailles des tampons, rapport de pixels, processeur graphique (`WEBGL_debug_renderer_info`), espace de couleur du canevas et de l'écran, mire de couleurs. Un bouton copie un relevé en texte, sans donnée personnelle. Fermé, il ne mesure rien.
13. **Économies sans effet sur l'image** (comptages au quai d'Aubrune et dans le wagon, tableau plus bas): anticrénelage du canevas coupé en encre (seul un triangle plein écran l'atteint); carte d'ombre du soleil ni dessinée ni lue quand l'ambiance n'a pas d'ombre du soleil (lieux clos); lectures de la carte d'ombre épargnées sur les faces détournées du soleil; clés du tri des maillages gardées d'une image à l'autre (plus de chaîne ni de `JSON.stringify` par maillage et par image). Écartées après examen, avec leur raison: réduire la carte d'ombre du soleil (son texel vaut déjà 1,3 point d'écran au zoom de jeu), ne la redessiner qu'au besoin (le vent et les personnages la changent à chaque image, et la recopier coûterait le même remplissage), fusionner davantage (un bâtiment est déjà un appel, le semis est instancié, les tuiles hors champ sont élaguées par Three.js), précision des nuanceurs (`mediump` est sans effet sur les deux machines), textures compressées (46 Mo sur 64, et le trait fin des couches ne supporte pas la compression par blocs).
14. **Couleurs: mêmes valeurs sRGB sur les deux machines.** Vérifié dans le code et par la mire de l'outil de mesure: le canevas est déclaré en sRGB (`drawingBufferColorSpace`, posé par Three.js, donc pas de P3 implicite sur le Mac); le matériau encré convertit une fois, par sommet, la teinte linéaire en valeur d'écran; la cible intermédiaire de 8 bits garde ces valeurs d'écran, la passe de contour les relit et les écrit telles quelles (ni conversion de sortie ni mappage tonal de Three.js, qui ne touchent pas un `ShaderMaterial` sans leurs inclusions); l'alpha du canevas vaut toujours 1 (aucun mélange avec la page). Un seul défaut trouvé et corrigé, sans lien avec la machine: la couleur de fond passait par une conversion vers le linéaire (elle sortait plus sombre que la donnée; elle est presque toujours cachée par le sol). Piste examinée et écartée: les seuils de détail comptés en points du tampon (un écran plus dense trace un rang de trait de plus). Les compter en points d'un écran de référence a été essayé (`sameOnEveryScreen`, laissé à `false`): sur un écran dense le trait peint, plus fin, pâlissait, alors que l'ancien comptage donne des images très proches d'un écran à l'autre (montage `encre-perf-ecran-dense.png`). Aucune différence d'image venue du jeu n'explique donc des couleurs plus fades sur le PC. Ce qui reste est dû aux écrans: voir « Couleurs d'un écran à l'autre » dans `essai-encre.md`.
15. **Pièces: le relief par la géométrie, la lumière par les fenêtres** (`lieu/pieces.ts`, `lieu/piece-geometrie.ts`, `lieu/reglages-pieces.ts`, 2026-11-10). Une pièce se construit à sa première visite à partir de ses données: plan (portes aux seuils, fenêtres déclarées ou déduites des façades du manifeste des bâtiments, appliques), puis maillages. Les deux murs qui tournent le dos à la caméra sont entiers (enduit, plinthe, lambris, pan de bois, embrasures, menuiseries), les deux autres coupés bas à tranche d'encre, portes comprises; le sol est posé lame par lame (au pas de la couche `wood`) ou carreau par carreau (couche `tile`, sans tache). Une coque jamais dessinée (`SHADOW_ONLY`: plafond et murs pleins) porte l'ombre du soleil: il n'entre que par les fenêtres, et sa nappe suit l'heure (ambiances `piece`, hauteur du soleil bornée par `INK_SETTINGS.roomSun`). Le fond est une nappe sombre et chaude, plus claire au pied des murs, sans dehors ni autres pièces. Le style d'une pièce (matières, hauteurs, sol, fenêtres, lampes) se choisit par le champ `style` de son fichier (`ROOM_STYLES`). Coût mesuré dans la maison de 10 x 7 m (banc de rendu, 1366 x 768, toutes passes): 19 appels et 11 300 triangles avant, 40 appels et 24 700 triangles après, dont l'ombre du soleil que le dedans n'avait pas (une quinzaine d'appels); 11 programmes (un de plus: la nappe), une couche de traits de plus (1,4 Mo). Bien en dessous d'une vue du dehors (111 appels, 230 000 triangles): ce qui pèse sur un graphique intégré reste le nombre de points ombrés, le même que dehors.
16. **Ce que chaque passe dessine vraiment** (`encre/ombres.ts`, `StageSort`, 2026-11-11, après « la version PC rame légèrement »). Ventilée maillage par maillage, la carte d'ombre du quai dessinait d'abord les personnages: Three.js dessine toujours un personnage (`frustumCulled = false`, ses bornes au repos sont fausses une fois animé), donc tous les habitants du lieu, dans la scène comme dans l'ombre (46 maillages, 127 000 triangles par passe). Le tri des maillages écarte maintenant, à chaque image et sans rien recréer: de la scène, un personnage hors du champ (sphère de 1,6 m autour de la racine de son squelette); de l'ombre du soleil, tout volume dont l'ombre ne peut tomber dans le champ (sa sphère englobante étirée le long des rayons du soleil jusque sous le fond de l'eau, testée contre le volume de la caméra: prudent, aucune ombre visible ne manque); la nappe d'eau ne porte plus d'ombre. Le sol, les pavés et le semis n'en portaient déjà pas. Réglages: `INK_SETTINGS.sunShadow.cullFloor`, `cullMinSine`, `characterRadius`. Image inchangée (montage `cout-avant-apres.png`). Les pavés à taille réelle coûtent jusqu'à 16 000 triangles par tuile de 32 m (celle du quai: route, rue, quai et place; 13 500 pour tout le reste de son sol), dans la scène seulement (le sol ne porte pas d'ombre): aucun niveau de détail ajouté (caméra orthographique: un pavé a la même taille à l'écran partout dans la vue). Construction des tuiles: pauses plus fréquentes (sol par lots de 48 cases simples, une case serrée comptant pour ses 16 sous-cases; pierres par 120; arbres, semis et pierres de berge en étapes séparées). Mesures dans le tableau « 2026-11-11 » plus bas.
17. **Le coût par point sur le PC du client** (2026-11-11, premier relevé F9 du PC: Intel UHD par ANGLE et Direct3D 11, canevas de 1920 x 1080 pour une fenêtre de 1536 x 864 points, intérieur à 22 images par seconde avec 25 000 triangles). Le goulot est le remplissage: contour 12,8 ms et scène 10,8 ms sur 2 millions de points. (a) **Contour**: 22 lectures de texture par point (couleur, morceaux et profondeur du point, deux bruits, quatre directions de prise à deux lectures de morceaux et deux de profondeur, vignette), inchangées. Essayé et écarté: ne lire les diagonales courtes que si les prises longues voient un trait (14 lectures loin des traits): les rainures plus étroites que le rayon (lames d'un plancher) perdaient la moitié de leur trait, visible de près. Nuanceur brut (`RawShaderMaterial`): un seul programme quelle que soit la cible (un `ShaderMaterial` en compilait un de plus dès que l'échelle passait sous 1, une fois pour toute la partie: d'où 15 programmes pour un budget de 14). (b) **Scène**: rien de changé dans le nuanceur (lectures par point: volumes 9, sol 16 à 18, plus 5 pour l'ombre du soleil sur une face tournée vers lui et 2 pour la brume); son coût suit le nombre de points. (c) **Départ plafonné** sur un processeur graphique intégré (`resolution.integrated`): au plus 1366 x 768 points internes (71 % du côté à 1920 x 1080), les paliers adaptatifs s'appliquent ensuite (plancher: 70 % de ce départ, soit 50 % du côté du canevas). (d) **Canevas opaque**, sans profondeur ni pochoir (`inkContext`): Three.js demandait un canevas transparent, que le navigateur mêle à la page à chaque image. (e) **Relevé**: somme des passes et reste du temps par image, rythme des images en battements de l'écran, canevas opaque ou non, flous d'arrière-plan CSS affichés, plafond de départ. Mesures plus bas (« Coût par point »).

## Budgets (par vue, toutes passes comprises)

| Poste | Budget | Mesuré au quai d'Aubrune, zoom de jeu |
|---|---|---|
| Triangles | 350 000 | 230 000 de jour, 222 000 de nuit (hôte et invité à 1 000 près); wagon 29 500 |
| Appels de dessin | 200 | 111 de jour, 105 de nuit; wagon 49 |
| Programmes | 14 (technique 3.10) | 11 chez l'hôte, 12 chez l'invité; un ou deux de plus relevés selon le moment sur les deux machines (jusqu'à 14, le budget: une paire de nuanceurs qui dépend du contenu à l'écran, clés dans `mesure.json` du banc, à identifier); la mise à l'échelle n'en ajoute pas (elle vit dans le programme du contour); wagon 7 |
| Mémoire ajoutée par l'encre | 64 Mo | 46 Mo (couches 23, ombres 17, cibles 12 à 1366 x 768 comptées à 12 octets par point); 3 Mo de plus au plus pour l'image finie avant sa mise à l'échelle |

### Par passe, et ce que chaque économie rapporte (1366 x 768, banc à deux vues, mise à jour du 2026-11-10)

| Vue | Ombre du soleil (carte de 2 048: 4,19 millions de points) | Scène | Contour | Total avant | Total après |
|---|---|---|---|---|---|
| Quai, jour | 60 appels, 119 800 triangles | 50 appels, 110 600 triangles | 1 appel | 112 appels, 230 400 triangles | 111 appels, 230 400 triangles |
| Quai, nuit | 53 appels, 111 300 triangles | 51 appels, 110 600 triangles | 1 appel | 105 appels, 221 900 triangles | 105 appels, 221 900 triangles |
| Wagon (lieu clos) | sautée | 48 appels, 29 500 triangles | 1 appel | 92 appels, 58 700 triangles, 10 programmes | 49 appels, 29 500 triangles, 7 programmes |

| Économie | Appels | Triangles | Points ombrés par image |
|---|---|---|---|
| Ombre du soleil sautée sans soleil (lieux clos) | 43 de moins dans le wagon (47 %) | 29 200 de moins (50 %) | 4,19 millions de points de profondeur de moins, cinq lectures de moins sur chaque point de la scène, 3 programmes de moins |
| Lectures d'ombre épargnées sur les faces détournées du soleil | 0 | 0 | cinq lectures de moins sur ces points (murs à l'ombre, pans de toit: part de l'image non comptée, elle dépend de la vue) |
| Anticrénelage du canevas coupé | 0 | 0 | plus de résolution d'un canevas à plusieurs échantillons à chaque image (4,2 millions d'échantillons à 1366 x 768 s'il en a 4 par point, valeur habituelle de Chromium, non vérifiable ici), et sa mémoire rendue (de l'ordre de 30 Mo dans ce cas) |
| Échelle interne à 85 % | 1 de plus (même programme) | 1 de plus | scène et contour: 2,10 millions de points à 1,52 million (28 % de moins), plus 1,05 million de points de mise à l'échelle à cinq lectures; en lectures de texture: environ 15 % de moins |
| Échelle interne à 75 % | 1 de plus | 1 de plus | 2,10 à 1,18 million (44 % de moins); en lectures: environ 31 % de moins |
| Échelle interne à 70 % | 1 de plus | 1 de plus | 2,10 à 1,03 million (51 % de moins); en lectures: environ 39 % de moins |
| Clés du tri gardées | 0 | 0 | aucun; une centaine de chaînes et autant de `JSON.stringify` de moins par image sur le processeur |

Lectures de texture comptées à 18 par point de scène, 22 par point de contour, 5 par point de mise à l'échelle. Au quai, appels et triangles ne bougent pas: la géométrie était déjà fusionnée, instanciée et élaguée, et elle n'est pas ce qui limite un graphique intégré (230 000 triangles par image sont peu pour lui); ce qui pèse est le nombre de points ombrés et de lectures par point, que l'échelle interne réduit. Sur un écran dense (fenêtre de 1 440 x 900 points à un rapport de 2), le tampon est déjà plafonné à 1 821 x 1 138 (rapport effectif de 1,26, budget de 1 920 x 1 080 points de `RENDER_SETTINGS.renderer`): un écran Retina ne calcule pas tout en double.

### 2026-11-11: ce que chaque passe dessine (point 16)

Page de démonstration du rendu, 1366 x 768, toutes passes, compteurs stables (ombre du soleil + scène + contour). Vue large: quai à 28 m de large. Côte: le chemin en (162, 56); avant, le sous-bois n'avait ni aspect ni arbre.

| Vue | Avant | Après | Ombre du soleil avant, après | Scène avant, après |
|---|---|---|---|---|
| Quai (203, 103) | 386 073 tri., 180 appels | 170 875 tri., 77 appels | 180 330, 69 340 | 205 742, 101 534 |
| Rue (204, 124) | 360 454, 167 | 107 699, 53 | 164 660, 34 687 | 195 793, 73 011 |
| Vue large | 459 890, 241 | 238 840, 137 | 216 569, 93 404 | 243 320, 145 435 |
| Orée (104, 90) | 424 975, 219 | 188 296, 146 | 197 719, 75 591 | 227 255, 112 704 |
| Bois dense (48, 16) | 366 661, 170 | 121 713, 82 | 154 678, 32 204 | 211 982, 89 508 |
| Côte (162, 56) | 305 742, 143 | 100 978, 100 (arbres semés compris) | 140 550, 35 975 | 165 191, 65 002 |

Construction des tuiles (même carte, calcul du sol en relief appelé pas à pas en dehors du navigateur, 16 m par morceau): 95e centile des étapes 7,2 ms avant, 0,9 ms après; 99e centile 24 puis 12 ms (pointes du ramasse-miettes, que le découpage ne supprime pas).

### 2026-11-11: coût par point (point 17)

| Poste | Avant | Après | Nature |
|---|---|---|---|
| Lectures de texture par point du contour | 22 | 22 | compté dans le nuanceur |
| Lectures par point de la scène | volumes 9 (+5 ombre au soleil, +2 brume), sol 16 à 18 | inchangé | compté dans le nuanceur |
| Points internes au départ, PC du client (1920 x 1080) | 2 073 600 | 1 049 088 (71 % du côté) | réglage, non mesuré sur le PC |
| Programmes, intérieur et quai (page de démonstration, échelle 0,71 puis 1) | 11 et 13 | 10 et 12 | mesuré |
| Temps par image en rendu logiciel, intérieur, 1920 x 1080, les deux versions en même temps | 5 834 ms | 5 717 ms | mesuré, peu parlant: le rendu logiciel n'est pas limité par les lectures comme un Intel intégré |
| Même mesure à 71 % du côté (le plafond), version d'avant | 3 730 ms à 100 % | 2 083 ms à 71 % | mesuré (-44 %) |
| Canevas | transparent, profondeur et pochoir | opaque, sans profondeur ni pochoir | gain non mesurable ici |

Estimation pour le PC du client à partir de son relevé (non mesurée): scène 10,8 ms et contour 12,8 ms à 2,07 millions de points deviennent environ 5,5 et 6,5 ms à 1,05 million, plus la mise à l'échelle (cinq lectures sur 2,07 millions de points, de l'ordre de 2 à 3 ms) et l'ombre du soleil (1,4 ms): environ 16 ms par image sur le processeur graphique, sous les 33 ms du plancher même si chaque image attend deux battements de l'écran. Plancher de l'échelle adaptative: 70 % du départ, soit 50 % du côté du canevas à 1920 x 1080 (960 x 540): pas besoin de le baisser.

## Ce qui est abandonné de l'ancien rendu

- Matériaux standard, lumières physiques, tone mapping et brume de Three.js: inertes en encre (gardés pour `aplats`).
- Préréglages d'ombres et mode léger des options graphiques: sans effet en encre (un seul niveau).
- Eau à normales animées, lueur émissive des vitres, damier du sol des lieux d'essai, table de maquette: remplacés par leurs équivalents encrés.
- Rails tirés des arêtes `interieur` du graphe: corrigé (les voies du plan font foi).

## Conséquences

- Les personnages actuels (couleurs de sommets) passent au matériau encré; le remplacement par les corps de l'essai 4 (atlas, traits à la plume) reste à faire: la variante `ATLAS` est prête mais non branchée.
- Le relief du terrain, les dalles et les bâtiments en volumes de la scène d'essai ne sont pas dans cette tranche: voir « Portage » dans `essai-encre.md`.
- Tant que l'interrupteur existe, tout nouveau maillage du moteur doit écrire les deux sorties (matériau encré, contact, aplat): un matériau standard dans la cible à deux sorties laisse une image de contour indéfinie.

## À vérifier

- Images par seconde, temps par passe et temps de compilation des programmes sur le PC du client (non mesurables ici: rendu logiciel). L'outil de mesure du point 12 sert à cela: relevés à faire par le client sur ses deux machines (quai d'Aubrune de jour et de nuit, intérieur), échelle adaptative puis figée à 100 %.
- Réglage des seuils de l'échelle adaptative sur ces relevés (budget, marges, durées), et choix des paliers.
- Hausse légère de la saturation et du contraste (`INK_SETTINGS.grade`, proposée et non appliquée): à décider par le directeur artistique sur le montage `encre-perf-proposition-couleurs.jpg`.
- Lectures de texture par point: sol 9 à 16, volumes 8 à 15, contour une vingtaine; versions économes listées dans `essai-encre.md`.
