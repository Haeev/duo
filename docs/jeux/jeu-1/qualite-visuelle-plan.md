# La Petite Ligne: audit visuel et plan de montée en qualité

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne (0.12.1 jouée, 0.13 en cours) |
| Auteur | directeur artistique |
| Date | 2026-11-03 |
| Déclencheur | retour du client du 3 novembre: « Je trouve les graphismes encore un peu trop "vibe coded", surtout sur les personnages. On manque de vrais détails, comme on le verrait sur de vrais jeux indépendants. » |
| Cible | niveau de finition des jeux de vie paisible en 3D stylisée récents, en création originale |
| Budgets | bible 8.8, mise à jour du 2026-11-03: 350 000 triangles et 200 appels par vue, 12 programmes, joueur habillé 4 800 triangles |
| Statut | proposition; les décisions D1 à D3 (section 6) sont à trancher par le client avant production |

Images du diagnostic: `docs/jeux/jeu-1/gauntlet/captures/qualite-visuelle/` (créées pour cet audit) et captures existantes de la 0.12 et de la 0.13, citées par leur chemin.

## 0. En une phrase

Le jeu est propre, cohérent et bien éclairé, mais tout y est construit avec les mêmes primitives géométriques posées à plat (boîtes chanfreinées, boules facettées, cônes), d'une seule couleur par pièce, sans aucune information peinte: c'est cette absence de « main » (traits dessinés, dégradés, usure, irrégularités voulues, poses) qui fait « programmeur », bien plus que le nombre de polygones. Monter les triangles seuls ne changera presque rien; il faut ajouter trois couches qui manquent: **le dessin** (visages, motifs, coutures peints dans une texture), **le modelé** (volumes sculptés, ombrage doux et contour sur les personnages) et **la vie** (poses et animations propres à chacun).

## 1. Diagnostic

### 1.1 Méthode

- Captures existantes examinées: `v0-13/rendu/h6-*.webp` (habitants en jeu), `v0-13/habitants/*.webp` (planches de face, de dos, de profil, bustes, expressions), `v0-13/batiments/`, `v0-13/foret/`, `v0-12/beaute/`, `v0-12/animations/`, `0-12/garde-robe-*`, `assets-src/modeles/planches/personnages-poses.png`.
- Captures faites pour cet audit dans le vrai moteur (`rendu.html`, mode manuel, 1600 x 900): voir 1.6.
- Mesures: silhouettes par seuillage du fond (`diag-silhouettes.webp`), niveaux de gris (`diag-rangee-gris.webp`), répartition de la clarté L* (CIELAB) des captures.
- Lecture du code de construction: `personnages.py` (tête `head_round`, traits `face_features`, mains `hands_round`, membres `arm_round` et `leg_round`, clips `anims` et `walk_keys`), `coiffures.py`, `garde_robe.py`, `habitants_013.py`.

### 1.2 Personnages: ce qui fait « généré »

Classés du plus visible au moins visible au zoom de jeu.

**P1. Les 21 habitants ont la même silhouette.** `diag-silhouettes.webp` (rangée de `v0-13/habitants/rangee-21-habitants.webp` seuillée en noir et blanc): un même rectangle à tête ronde, bras collés au corps, mains au même endroit, pieds joints, seule la hauteur change. Les différences (chapeau, jupe, tablier) sont à l'intérieur du rectangle. Cause dans le code: un seul corps de base pour tous (`torso_rings`, mêmes demi-axes de tête `PHEAD` pour tous, mêmes `arm_round` et `leg_round`), un gabarit obtenu seulement par mise à l'échelle uniforme (`SCALES` de `habitants_013.py`: Léon à 0,78 est un adulte réduit, pas un enfant), et une seule pose de repos (`ARMS_DOWN`: bras écartés de 4 degrés, avant-bras pliés de 10). Dans un jeu indépendant soigné, on reconnaît chaque habitant à sa seule ombre portée.

**P2. Les visages sont des pictogrammes posés sur une boule.** `diag-visage-colette.webp` (buste de `habitant-colette.webp` agrandi): deux octogones noirs pour les yeux, deux barres pour les sourcils, un disque rose par joue, une bouche en losange, le tout projeté sur une tête à 12 pans dont l'arête verticale passe au milieu du visage (`head_round`: le nez se pose sur une arête, une moitié du visage est plus claire que l'autre). Il manque tout ce qui donne un regard: blanc de l'œil, iris, reflet, paupière supérieure épaisse, forme d'œil propre au personnage, sourcils dessinés à la main, ombre sous la frange, rides des aînés. Les 21 visages ne varient que par des facteurs d'échelle (`eye_k`, `brow_k`, `cheek_base`): mêmes yeux pour l'enfant, la cafetière et le vieil instituteur. Les expressions (`happy`, `tired`...) déforment les octogones, ce qui donne des traits anguleux de près.

**P3. Ombrage à facettes sur des formes organiques.** La bible impose « une normale par face » partout. Sur un bâtiment c'est un style; sur une joue, une épaule ou une manche, les facettes de 6 à 12 pans créent des ruptures de lumière qui ressemblent à une géométrie pas finie (bustes de `habitant-colette.webp`: la poitrine est découpée en bandes, la tête en quartiers). C'est le marqueur le plus fort du « low poly de programmeur » pour un œil habitué aux jeux récents, où les personnages sont lisses (ou ombrés en aplats par une rampe, pas par la géométrie).

**P4. Cheveux en boules.** Toutes les coupes sont des ellipsoïdes facettés empilés (`hair_round`, `_lobe` de `coiffures.py`): calotte, nuque, lobes sur les côtés. Comparaison avant et après des mèches (`v0-12/beaute/beaute-coupes-avant-apres.webp`): les « mèches » ajoutées restent des lobes qui dépassent. Pas de mèche effilée, pas de raie, pas de direction de pousse, pas de transition front-cheveux, deux tons au plus. Le constat R01 (nattes qui traversent le haut du corps) vient du même système de boules liées à l'os de la tête.

**P5. Vêtements en tubes d'une seule couleur, sans épaisseur.** Les manches, jambes et torses sont des lofts octogonaux; une robe est un cône (`skirt_fn`), un tablier une plaque. Il n'y a ni bord épais (col, ourlet, revers), ni pli (coude, genou, taille, chute de la jupe), ni couture, ni poche. Les motifs sont faits en coloriant des facettes une sur deux (`checker`, `stripes` de `habitants_013.py`): la robe de Mado (`h6-rangee-4-mado-leon.webp`) montre un damier de pixels géants qui suit les facettes, la signature la plus « générée » de toutes les captures. Les boutons et taches (`stick_dots`) sont des pastilles collées, de même taille partout.

**P6. Mains et pieds de jouet.** Moufles en boule avec un pouce (`hands_round`), toujours fermées en poing dans la pose de repos (`h6-rangee-1-firmin-achille.webp`); chaussures en galets sans semelle ni talon. Les mains et les pieds portent l'essentiel de l'expressivité d'une pose: ici ils n'en ont aucune.

**P7. Proportions de mannequin.** Tête au cinquième de la hauteur (bible 8.5), mais cou absent ou noyé dans le col, épaules au même niveau que le menton, bras droits et fins (6 pans effilés) qui tombent jusqu'à mi-cuisse, jambes en colonnes. Le personnage est raide comme une figurine en bois. L'enfant (Léon) et l'aînée (Honorine) ont les mêmes proportions qu'un adulte, juste plus petites.

**P8. Animation mécanique.** `walk_keys` n'a que quatre clés (contact, passage, symétrique), sans les positions basse et haute, ni décalage entre le bassin, le buste et la tête; tous les habitants partagent la même marche et le même `idle` (trois poses de 30 images, différences de 2 à 5 degrés). Pas de regard vers le joueur, pas de clignement aléatoire visible au zoom de jeu, rien qui suive le mouvement (cheveux, jupe, tablier, sangle). Les gestes sont lisibles mais génériques (`personnages-poses.png`: la houe tenue comme une canne, signalée par le client le 1er novembre, R08; la récolte penchée jambes tendues).

**P8 bis. Objets tenus qui traversent le corps.** Au zoom le plus proche (`jeu-place-zoom-proche-joueur-x3.webp`), le manche tenu par le joueur passe à travers son visage. Une seule traversée de ce genre, au centre de l'écran, suffit à faire « pas fini »: chaque clip doit être contrôlé avec chaque objet tenu (liste 8.10, point 2).

**P9. Palette des costumes plate et sans structure.** Chaque pièce est une seule case de couleur. Les costumes sont tous dans des tons moyens éteints (bleu-gris, brun, vert-de-gris, prune): en niveaux de gris (`diag-rangee-gris.webp`), les habitants forment une file de taches de même valeur, et ceux en clair (boulanger, Berthe) se fondent dans la terre battue. Pas de règle « une couleur dominante, une secondaire, un accent », pas d'écart de valeur imposé entre haut et bas, ombre de la peau grise (`skin_shade`) au lieu d'être chaude.

**P10. Style différent entre la 3D et l'interface.** Les portraits 2D de l'interface (`0-12/garde-robe-creation-p1-100.png`, vignettes de coiffures, retour R22 sur le portrait géant de Solange) sont des vecteurs plats d'un autre dessin que les modèles 3D. Le joueur voit deux personnages différents.

### 1.3 Décor

**D1. Facettes régulières des végétaux.** Les houppiers sont des icosphères déformées (`v0-13/foret/foret013-bosquet-printemps.webp`): des boules à facettes triangulaires toutes de même taille, une couleur par arbre, aucune variation entre le cœur sombre et les pointes éclairées, silhouette ronde sans découpe. C'est l'image type du « low poly de banque d'assets ». Les arbustes de sous-bois (`foret013-sousbois.webp`) le confirment: le houx est un seul galet avec des pastilles rouges, le framboisier trois tiges et quatre feuilles plates, la fougère des triangles épars.

**D1 bis. Feuillages posés, pas poussés.** Mes captures en jeu le montrent mieux que les planches: la vigne de la tonnelle de l'épicerie est faite de grosses icosphères vertes posées sur les traverses, sans tige ni feuille, dont certaines flottent (`jeu-tonnelle-vigne-x2-5.webp`); le fruitier de la place est une seule masse à grandes facettes semée de petits triangles orange collés en surface (`jeu-place-arbre.webp`); la nappe à rayures de la table est une plaque plate sans tombé. Ce sont les éléments qui font le plus « assemblé par un script » à la distance de jeu, parce qu'ils sont grands et au premier plan.

**D2. Bâtiments trop nets.** `v0-13/batiments/batiments-013-scenes.webp`: les murs sont des plans parfaits, les toits des pans tendus (le faîtage fléchi de la bible ne se voit pas à cette distance), les fenêtres collées au nu du mur, aucune usure. Il manque ce qui raconte le temps: pied de mur plus sombre et éclaboussé, coulures sous les appuis, mousse au nord des toits, enduit écaillé qui laisse voir la pierre, gouttières et descentes, fils et poteaux, linteaux et appuis qui débordent. La règle « une couleur par pièce » donne des façades d'un seul ton.

**D3. Intérieurs nus.** `batiments-013-interieurs.webp`: murs crème uniformes, sols en damier ou en lames de deux tons parfaitement alignés, pas de plinthe, pas de poutre au plafond, pas de tapis, d'objets du quotidien, de lumière qui entre par la fenêtre. Les pièces se lisent comme des maquettes.

**D4. Sols.** Les grands aplats de terre battue et d'herbe (`h6-rangee-21-habitants.webp`) ne portent que la variation douce du bruit et des cailloux en pastilles. Les pavés sont un appareillage régulier propre (les joints sont nets, aucune pierre ne manque ni ne bascule). Les bords entre matières sont des courbes parfaites.

**D5. Répétition.** Les mêmes modèles instanciés (bancs, lampadaires, buissons) reviennent à l'identique, même rotation de base; pas de variante d'usure ni de couleur.

### 1.4 Lumière et rendu

**L1. Valeurs compressées sur les personnages et les grands espaces clairs.** Mesure de la clarté L* sur `h6-rangee-21-habitants.webp` (habitants alignés sur la grève): 90 % des pixels entre L* 38 et 76, médiane 60, 2,6 % sous L* 30. Sur `h6-rangee-1-firmin-achille.webp` (de près): 90 % entre 47 et 80, aucun pixel sous 30. Dans le bourg à 15 h (`jeu-quai-zoom-large.webp`, ma capture), l'image entière a pourtant des noirs (17,6 % sous L* 30: toits d'ardoise, forêt, ombres portées): le problème n'est donc pas l'étalonnage global mais **l'intérieur des personnages et des modèles**, qui n'a ni creux sombres ni bords, et les grands aplats de terre battue où tout se tasse entre L* 50 et 75. Les jeux de référence gardent des accents sombres dans les creux de chaque objet (sous le menton, sous un chapeau, dessous d'un toit).

**L2. Pas de contour ni de liseré sur les personnages.** Ils se détachent du sol par la seule différence de couleur; quand elle manque (boulanger en blanc sur terre battue), ils disparaissent. Aucun liseré de lumière (rim) ne dessine le bord éclairé.

**L3. Occlusion ambiante limitée au sol.** `occlusion.ts` assombrit le pied des objets sur le terrain (bon travail du tour 8), mais rien n'assombrit les creux d'un modèle: dessous des toits, entre les bras et le torse, sous le menton, sous les chapeaux, dans les plis. Les modèles paraissent creux et légers.

**L4. Ombres justes mais dures sur les personnages.** L'ombre portée du soleil est correcte; il manque l'ombre de contact douce sous les pieds et le dégradé de hauteur sur le personnage (plus sombre vers les pieds), deux indices peu coûteux qui posent un personnage au sol.

### 1.5 Ce qui marche déjà et qu'on garde

- La palette générale et la lumière du jour, chaudes et cohérentes; les ombres portées du soleil; l'occlusion cuite du sol; l'eau.
- Les bâtiments ont une architecture crédible (chaînes d'angle, encadrements, débords, cheminées) et respectent la liste 8.10.
- L'échelle, la lisibilité en vue isométrique, la règle des 10 cm, les signes des joueurs (foulard et badge).
- Le pipeline par script (Blender, palette, `index.json`, planches de contrôle): on garde la méthode, on change ce qu'elle produit.

### 1.6 Captures faites pour cet audit

Voir l'annexe A (en fin de document): trois captures dans le vrai moteur, aux trois zooms, et ce qu'elles montrent.

## 2. Les 10 chantiers

Classés par rapport effet sur l'image / coût. Effet de 1 à 5 (5: change la perception du jeu en une capture). Coût en journées d'agent, estimation à plus ou moins 50 %. Les triangles s'entendent par instance; les appels, pour la vue la plus chargée (place à 19 h, train à quai, environ 12 personnages visibles).

| Ordre | Chantier | Effet | Coût | Triangles | Appels |
|---|---|---|---|---|---|
| 1 | Ombrage doux et rampe sur les personnages | 5 | 2 j | 0 | 0 |
| 2 | Visages peints | 4 en jeu, 5 dans les aperçus | 3 j | 0 à +200 par personnage | 0 |
| 3 | Contour encré coloré et liseré | 4 | 2 j | x2 sur les personnages contourés | +1 par personnage contouré |
| 4 | Silhouettes et proportions: gabarits et poses de repos | 5 | 5 j | +500 à +1 000 | 0 |
| 5 | Cheveux en mèches sculptées (et coiffes) | 4 | 4 j | +400 à +900 | 0 |
| 6 | Texture des personnages: motifs, coutures, usure peints | 4 | 4 j | 0 | 0 |
| 7 | Vie: poses, marche, regard, mouvements secondaires | 4 | 5 j | 0 | 0 |
| 8 | Végétation: houppiers en touffes et sous-bois | 4 | 4 j | +150 à +300 par arbre | 0 à +2 |
| 9 | Décor: occlusion et usure cuites, valeurs creusées | 4 | 4 j | 0 à +10 % | 0 |
| 10 | Vêtements: épaisseurs, plis, détails | 3 | 5 j | +600 à +1 200 | 0 |

Pourquoi cet ordre: mes captures en jeu (annexe A) montrent qu'à la distance de jeu un personnage fait de 65 à 160 pixels de haut et son œil de 2 à 3 pixels. Ce qui se lit d'abord, c'est la façon dont la lumière tombe sur lui (chantier 1), son bord (chantier 3), sa silhouette et sa pose (chantier 4) et, vue à 35 degrés d'en haut, **le dessus de sa tête** (chantier 5). Le visage (chantier 2) compte surtout de près, dans les aperçus 3D de l'interface (création, garde-robe, salon de Solange, R22) et sur les planches; il reste en tête parce qu'il coûte peu et qu'il est le premier reproche fait à des personnages « générés ». Les plis modelés (chantier 10) coûtent cher pour un effet surtout visible de près: une partie passe par la texture (chantier 6). Les arbres occupent une grande part de l'écran (`jeu-place-arbre.webp`), d'où la végétation avant les façades.

Total personnages: environ 4 000 à 4 800 triangles par personnage habillé (contre 2 200 à 2 600 aujourd'hui). Vue la plus chargée: 12 personnages x 4 500 = 54 000, contour compris 108 000 au pire (voir chantier 3 pour le réduire), plus le décor mesuré (130 000 à 207 000 au tour 1, plus les ajouts de la 0.13): sous les 350 000 à condition que le contour ne vise que les personnages proches (chantier 3). Mesure obligatoire par `detailedStats()` à chaque étape.

Ordre de production conseillé: 1, 2 et 3 d'abord sur trois personnages témoins (quatre à cinq jours, effet immédiat, aucun budget à part le contour), puis 4 (la base sur laquelle 5, 6 et 10 reposent), puis 5, 6 et 10 en parallèle, puis 7; 8 et 9 avancent en parallèle des personnages, confiés à d'autres membres.

### Chantier 1. Ombrage doux et rampe sur les personnages

- **Ce qu'on change**: les personnages quittent l'ombrage à facettes. Normales lissées sur la peau, les cheveux et les tissus, gardées vives aux vraies arêtes (bord de col, ourlet, bord de chapeau, semelle), par un angle de lissage de 40 à 50 degrés et des normales pondérées par la surface des faces. Dans le shader des personnages, une **rampe à trois bandes** douces (lumière, demi-teinte, ombre, transitions de 10 à 15 %) remplace l'éclairage continu, avec une ombre teintée chaude (peau: ombre vers le rouge, pas vers le gris) et un **liseré de lumière** côté soleil (largeur de 15 % au bord, force 0,25, couleur du ciel). Le décor garde ses facettes (décision D1).
- **Qui**: tech-artist (shader, `onBeforeCompile` sur `lpl_characters`), artiste 3D (normales: `mesh.set_sharpen_edges` et modificateur « Weighted Normal » appliqué par script avant l'export, marquage des arêtes vives).
- **Outils**: Blender en script, Three.js; aucune passe d'écran de plus.
- **Coût**: 0 triangle, 0 appel, 0 programme de plus (même matériau, shader modifié); un léger surcoût de calcul par pixel, négligeable sur l'UHD 620.
- **Réussi si**: de près, plus aucune bande de facette visible sur un visage, une épaule ou une manche; en niveaux de gris, un personnage montre trois valeurs nettes (lumière, demi-teinte, ombre) et non un dégradé de facettes; le personnage se détache du sol éclairé par son liseré à 17 h; la cohabitation avec le décor à facettes est jugée cohérente sur une capture de la place (personnages lisses, décor taillé: effet « figurine dans un diorama », à valider par le client sur une capture avant de généraliser).

### Chantier 2. Visages peints

- **Ce qu'on change**: les traits géométriques (`face_features`: octogones, barres, disques) sont remplacés par un **visage dessiné dans une texture**, posé sur une zone du visage dépliée à plat (une seule île UV, projection de face, déformation corrigée sur la tête). Un atlas de visages: pour chaque personnage, yeux, sourcils et bouche dans ses 6 expressions (neutre, contente, ravie, fatiguée, affamée, yeux fermés), plus une base (joues, ombre de frange, taches de rousseur, rides). L'expression change par décalage d'UV (une valeur par personnage passée au shader), plus par clé de forme. Le joueur choisit parmi 6 visages (forme d'yeux et de sourcils), recolorés comme aujourd'hui.
- **Construction de la tête**: la tête n'a plus d'arête au milieu du visage (nombre de pans pair décalé d'un demi-pan, ou tête lisse, voir chantier 1); le visage est légèrement aplati devant pour que le dessin ne se déforme pas; nez en petite forme douce; arcade sourcilière à peine marquée pour accrocher l'ombre.
- **Qui**: directeur artistique (feuille de construction des visages, section 4.3), artiste 2D (dessin de l'atlas en SVG, vectoriel net, rendu par `rsvg-convert`), artiste 3D (UV du visage, retrait des traits géométriques, ancrage), tech-artist (décalage d'UV par personnage, filtrage linéaire et mipmaps pour cette zone seulement).
- **Outils**: SVG et `rsvg-convert`, Blender en script (`uv.project_from_view` ou dépliage par script), `onBeforeCompile` dans `materiaux.ts`. Si le client active la génération d'images (section 3), feuilles de références d'expressions avant le dessin.
- **Coût**: 0 à +200 triangles (tête un peu plus dense devant); 0 appel; une texture de plus (atlas de 1024 x 1024, 4 Mo en mémoire vidéo non compressée, ou intégrée dans une `personnages.png` agrandie: décision du tech-artist, sans nouveau programme).
- **Réussi si**: au zoom 0 (le plus proche), on lit la direction du regard et l'humeur de chaque habitant sans légende; au zoom 1, chaque visage reste un visage (yeux sans papillotement, le reflet visible); aucune déformation du dessin en vue de trois quarts; 21 visages différents posés côte à côte sur une planche, que trois personnes du studio associent sans erreur à leur fiche (âge, caractère).

### Chantier 3. Contour encré coloré et liseré

- **Ce qu'on change**: un **contour fin coloré** (pas noir: la couleur de la pièce assombrie de 55 à 65 % en clarté, teinte gardée) autour des personnages, des animaux et des objets qu'on peut prendre, par coque inversée (le même maillage redessiné, sommets poussés le long des normales lissées, faces avant écartées). Épaisseur constante à l'écran (1,5 px à 1366 x 768, 2 px à 1920 x 1080). Le décor n'a pas de contour (il reste en facettes), ce qui renforce la lecture « personnage contre fond ».
- **Qui**: tech-artist (shader de coque, réglage par distance), artiste 3D (normales lissées stockées pour l'extrusion même là où l'ombrage garde une arête vive).
- **Outils**: Three.js (second rendu du maillage avec un matériau de coque, `side: BackSide`), Blender (normales lissées dans un attribut).
- **Coût**: x2 triangles pour chaque personnage contouré et +1 appel par personnage. Pour tenir le budget: contour pour les joueurs, les habitants à moins de 14 m de la caméra et les objets en main; au-delà, liseré seul (chantier 1). Pire cas mesuré à prévoir: 12 personnages x 4 500 = +54 000 triangles et +12 appels. Repli si la mesure dépasse: contour par détection de bords sur la profondeur des seuls personnages, à demi-résolution (une passe, à mesurer sur l'UHD 620 avant de la retenir).
- **Réussi si**: le boulanger en blanc se détache de la terre battue en niveaux de gris; le contour ne scintille pas en mouvement et ne se casse pas aux arêtes vives; mesure `detailedStats()` du plan le plus chargé sous 350 000 triangles et 200 appels.

### Chantier 4. Silhouettes et proportions: gabarits et poses de repos

- **Ce qu'on change**: un **corps de base sculpté** (et non assemblé de primitives) décliné en **cinq gabarits**: adulte mince, adulte moyen, adulte rond, aîné (dos voûté, tête avancée, genoux un peu fléchis), enfant (3,4 têtes de haut, jambes courtes, ventre en avant). Les os gardent leurs noms; seules leurs longueurs changent selon le gabarit (les clips sont des rotations: ils restent valables, à vérifier un à un). Chaque habitant reçoit en plus une **pose de repos personnelle** (mains dans le dos, poings sur les hanches, bras croisés, appui sur une canne, mains dans les poches, pouces dans les bretelles) jouée par son `idle`. Proportions détaillées en section 4.2.
- **Qui**: artiste 3D (corps, gabarits, poids de peau), directeur artistique (attribution des gabarits et poses aux 21 habitants, contrôle des silhouettes), dev-gameplay-3d (gabarit lu dans `habitants.json`).
- **Outils**: Blender en script; modélisation par lofts de sections soignées puis modificateur de subdivision appliqué une fois et décimation guidée (ou remaillage Quadriflow, intégré à Blender), poids de peau par chaleur (`ARMATURE_AUTO`) puis retouches par script.
- **Coût**: +500 à +1 000 triangles par corps (de 1 200 environ à 2 000 avant vêtements et cheveux); 0 appel.
- **Réussi si**: sur `diag-silhouettes` refait avec les 21 habitants en pose de repos, chaque silhouette noire se distingue de ses voisines (test: on mélange les 21 silhouettes et on les rapproche des fiches sans se tromper de plus de 2); l'enfant se lit comme un enfant et l'aînée comme une aînée sans la hauteur; aucune traversée dans `idle`, `walk`, `hoe`, `water`, `carry_two`, `sit`.

### Chantier 5. Cheveux en mèches sculptées

- **Ce qu'on change**: les coupes ne sont plus des boules mais des **masses découpées en mèches**: une calotte qui épouse le crâne avec une ligne de front irrégulière, puis 7 à 14 mèches effilées en S (pointe fine, section en amande), une raie lisible, deux à quatre mèches folles qui cassent le contour, et une bande de reflet peinte. Les nattes et queues de cheval deviennent des tresses en segments liés à un os de cheveux supplémentaire (ou au cou), avec une garde de collision contre le dos (règle de R01). Les coiffes (casquette, béret, chapeaux) gardent leurs formes mais gagnent une épaisseur de bord, un bandeau, une couture.
- **Qui**: artiste 3D (modélisation par courbes Blender converties en maillage: une courbe par mèche, profil et effilement par script), directeur artistique (fiche de chaque coupe: nombre et sens des mèches), tech-artist (bande de reflet dans la rampe).
- **Outils**: courbes de Blender (`bevel_object`, `taper_object`) en script, conversion en maillage, décimation; planche de contrôle des 15 coupes sous quatre angles.
- **Coût**: +400 à +900 triangles par coupe (de 300 à 600 aujourd'hui vers 800 à 1 400); 0 appel; un ou deux os de cheveux par coupe longue.
- **Réussi si**: de près, chaque coupe montre son sens de pousse et ses pointes; au zoom 1, on distingue les 15 coupes à la silhouette de la tête; aucune mèche ne traverse le corps dans les clips (contrôle automatique des distances mèche-torse sur toutes les images des clips, à ajouter au script d'audit).

### Chantier 6. Texture des personnages: motifs, coutures, usure peints

- **Ce qu'on change**: fin de la règle « une case de couleur par pièce » pour les personnages. Les vêtements reçoivent un **dépliage UV** et une texture peinte (atlas de tissus partagé, 1024 x 1024): carreaux, rayures, pois, tweed, toile, tricot en motif répété proprement (fin du damier par facettes), coutures et surpiqûres en trait, poches, boutonnières, ourlets, et une usure propre au métier (farine du boulanger, cambouis du forgeron, terre aux genoux du jardinier, craie de l'instituteur). Le jeu recolore toujours par la rangée de palette: la texture porte la valeur et le motif en niveaux de gris, la palette donne la teinte (multiplication dans le shader), donc la personnalisation des joueurs continue de marcher.
- **Qui**: artiste 2D (atlas de motifs et de détails en SVG), artiste 3D (UV par script, placement des îles), tech-artist (combinaison texture et palette dans le shader, mipmaps), directeur artistique (choix des motifs par habitant).
- **Outils**: SVG, `rsvg-convert`, Pillow pour l'assemblage de l'atlas, Blender (`smart_project` ou xatlas pour les UV); textures peintes par IA si le client active un générateur (section 3), retouchées et ramenées à la palette.
- **Coût**: 0 triangle, 0 appel, une texture partagée de plus (même matériau).
- **Réussi si**: au zoom 0 (le plus proche), on voit le motif, les coutures et une trace d'usure sur chaque habitant; au zoom 1, aucun moiré ni scintillement du motif (mipmaps vérifiées en mouvement); la recoloration d'une tenue de joueur garde motif et coutures; un habitant se reconnaît à son motif seul (planche de vignettes de tissus).

### Chantier 7. Vie: poses, marche, regard, mouvements secondaires

- **Ce qu'on change**:
  - marche refaite à **8 clés** (contact, basse, passage, haute, de chaque côté), avec décalage du buste et de la tête de 2 images derrière le bassin, rotation des épaules opposée au bassin, et **trois marches** (vive, posée, traînante des aînés);
  - `idle` personnel (chantier 4) avec respiration visible (épaules de 1 cm) et une micro-action toutes les 6 à 12 s tirée au hasard selon le personnage (se gratter la tête, remonter ses lunettes, regarder sa montre, s'essuyer les mains sur le tablier);
  - **regard**: la tête et les yeux suivent un joueur proche dans un rayon de 3 m (rotation de l'os de la tête bornée à 35 degrés, procédurale dans le moteur);
  - clignement aléatoire toutes les 3 à 6 s;
  - mouvements secondaires procéduraux: jupe, tablier, nattes et sacoches suivent le mouvement avec retard (ressort amorti sur un os dédié, calculé dans le moteur, déterministe);
  - reprise des gestes signalés (houe tenue au tiers du manche, récolte genoux fléchis, portage où les mains touchent l'objet: R14).
- **Qui**: artiste 3D (clips dans Blender), dev-gameplay-3d (regard, clignement, ressorts dans `personnages.ts`), tech-artist (budget de calcul).
- **Outils**: Blender en script (clés de Bézier avec poignées réglées, pas de clés linéaires), Three.js (`AnimationMixer`, os pilotés après le mixage).
- **Coût**: 0 triangle, 0 appel; quelques os de plus (ressorts) et un calcul par personnage proche.
- **Réussi si**: sur une vidéo de 20 s de la place, aucun habitant ne bouge en même temps que son voisin; un joueur qui passe devant un habitant est suivi du regard; la marche montre la montée et la descente du bassin et le balancier des épaules; la jupe et les nattes réagissent à l'arrêt.

### Chantier 8. Végétation: houppiers en touffes et sous-bois

- **Ce qu'on change**: les houppiers deviennent des **grappes de touffes** (5 à 9 masses de tailles inégales, chacune bruitée et aplatie dessous), avec un **dégradé de couleur cuit** du cœur (sombre, bleuté) vers les pointes (clair, chaud) et une frange découpée sur le contour (petites pointes de feuillage ou cartes en découpe nette, `alphaTest` sans transparence triée). Troncs avec deux ou trois branches maîtresses qui entrent dans le houppier. Sous-bois refait: houx en plusieurs masses dentelées, framboisier en touffe de cannes arquées avec feuilles composées, fougères en frondes arquées (rubans pliés), champignons à pied et chapeau proportionnés.
- **Qui**: artiste 3D (génération par script), tech-artist (vent sur les nouvelles touffes, instanciation), directeur artistique (fiche des espèces).
- **Outils**: Blender en script (Geometry Nodes pilotés par script ou génération Python), Three.js `InstancedMesh`.
- **Coût**: chêne et bouleau de 450 (plafond actuel) à 600 ou 750 triangles, sapin de 300 à 450, buisson de 160 à 250; sur 51 arbres et 79 buissons de la Halte, environ +20 000 triangles; 0 appel si la frange reste dans `lpl_palette`, +1 à +2 si elle demande un matériau découpé (programme de plus: à compter dans les 12).
- **Réussi si**: on reconnaît chêne, hêtre, bouleau et noisetier à la silhouette seule; plus aucune facette triangulaire de taille régulière visible dans un houppier à distance de jeu; le cœur du houppier est plus sombre que ses bords en niveaux de gris.

### Chantier 9. Décor: occlusion et usure cuites, valeurs creusées

- **Ce qu'on change**:
  - **occlusion ambiante cuite dans les couleurs de sommets** de chaque modèle (dessous des toits et des auvents, angles rentrants, pied des murs, intérieur des fenêtres, entre les planches), calculée par Cycles dans Blender et multipliée à la palette dans le shader; même chose pour les personnages (aisselles, sous le menton, sous les chapeaux, dans les plis);
  - **usure cuite** dans le même attribut: arêtes saillantes éclaircies de 5 à 8 % (bois et pierre patinés), bas des murs assombris et teintés de terre sur 30 à 50 cm, coulures sous les appuis de fenêtres, mousse sur les pans de toit nord;
  - **rupture des lignes**: fenêtres en retrait de 8 à 12 cm avec appui et linteau qui débordent, descentes de gouttière, lignes de faîtage et de rives cassées de quelques centimètres, pierres apparentes sous l'enduit par endroits;
  - intérieurs: plinthes, poutres apparentes, un tapis, trois objets du quotidien par pièce, tache de lumière de la fenêtre au sol en journée;
  - **valeurs creusées** par l'étalonnage: viser 5 à 8 % de pixels sous L* 30 sur les grands espaces clairs à distance de jeu (2,6 % sur la grève des captures h6), en assombrissant l'ombre portée et les creux, sans noircir le sol (règle de la bible).
- **Qui**: artiste 3D (cuisson par script, détails de façades et d'intérieurs), tech-artist (lecture de l'attribut dans `lpl_palette`, réglage `look`), level-designer (objets du quotidien et rupture de la répétition sur la carte), directeur artistique (valeurs).
- **Outils**: Blender en script (`bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')` ou attribut de couleur, Cycles sur processeur), Three.js. Cela demande de **lever l'interdit des couleurs de sommets** de la bible (section 3): une couleur de sommet ne coûte ni texture ni appel.
- **Coût**: 0 appel; +4 octets par sommet; 0 à +10 % de triangles (sommets ajoutés pour porter l'occlusion là où les faces sont trop grandes: murs, sols intérieurs).
- **Réussi si**: en niveaux de gris, chaque bâtiment montre ses creux (dessous de toit, embrasures) sans l'aide de la couleur; de près, un mur raconte son âge (pied sali, appui coulé); la mesure de L* atteint 5 à 8 % sous 30; aucune trace d'escalier de couleur sur les grands plans (densité de sommets suffisante).

### Chantier 10. Vêtements: épaisseurs, plis, détails

- **Ce qu'on change**: chaque bord de vêtement a une **épaisseur** visible (col, revers, ourlet, poignet, bord de tablier: 6 à 10 mm, chanfreinés), chaque vêtement a des **plis modelés** aux endroits où un vrai tissu plisse (section 4.5), les jupes et robes ont 8 à 12 plis de chute et un ourlet ondulé, les pantalons cassent sur la chaussure, les manches s'évasent au poignet. Les détails obligatoires (section 4.8) sont modélisés quand ils changent la silhouette ou accrochent la lumière (col, poche plaquée, ceinture et boucle, boutons en relief, sangles), peints sinon (chantier 6).
- **Qui**: artiste 3D (modèles de vêtements de `garde_robe.py` et des habitants), directeur artistique (revue de près, quatre angles).
- **Outils**: Blender en script; plis modelés par déformation guidée (sommets déplacés le long de courbes de pli, modificateurs « Displace » avec une texture de pli peinte, puis application), ou simulation de tissu de Blender (cloth) figée en pose de repos puis appliquée, pour les jupes et tabliers.
- **Coût**: +600 à +1 200 triangles par personnage habillé; 0 appel.
- **Réussi si**: de près, un vêtement se lit comme du tissu (bords épais, plis aux coudes et à la taille, chute de la jupe) sur les quatre angles; au zoom 1, la silhouette change (évasement, ourlet); chaque personnage habillé reste sous 4 800 triangles; aucune traversée tissu-corps dans les clips de contrôle.

### Ce qu'on ne fait pas

- Pas de flou plein écran, pas d'occlusion ambiante en espace écran (SSAO), pas d'empilement de passes: l'UHD 620 reste la référence et la qualité adaptative le filet.
- Pas de réalisme (pores, textures photo, cheveux en cartes transparentes multiples): on vise la finition d'une figurine peinte, pas un rendu photo.
- Pas de lissage des normales sur le décor tant que le client n'a pas tranché D1: les facettes du décor sont une identité validée le 31 octobre.

## 3. Les outils qui manquent

### 3.1 Ce qu'on a déjà ici, et qui suffit pour la plupart des chantiers

Vérifié dans l'environnement le 2026-11-03.

| Besoin | Outil disponible | Suffisant ? |
|---|---|---|
| Modélisation, courbes, sculpture par script | Blender 5.2 (`duo-python`) | oui pour tous les chantiers; la sculpture « à la main » est remplacée par des déformations scriptées |
| Retopologie | Blender: Quadriflow et remaillage par voxels intégrés, décimation | oui |
| Dépliage UV | Blender (`smart_project`, `lightmap_pack`, projection depuis la vue); xatlas (MIT) téléchargeable depuis PyPI (vérifié: `pip download xatlas` réussit) | oui |
| Cuisson d'occlusion, de courbure, de normales | Cycles sur processeur | oui (lent sous charge: quelques minutes par modèle) |
| Textures peintes | SVG, `rsvg-convert`, Pillow, numpy; projection de texture depuis une caméra dans Blender | oui pour des motifs et des dessins nets; limité pour une vraie peinture « à la main » (coups de pinceau, matière) |
| Simulation de tissu figée | Blender (cloth) | oui |
| Contrôle visuel | Playwright, Chromium, ImageMagick | oui |

Conclusion: **aucun outil n'est indispensable pour les chantiers 1, 2, 3, 4, 7 et 9**. Ce qui manque vraiment, c'est de la **matière de référence** (à quoi doit ressembler le résultat) et de la **peinture** (textures qui ont une main).

### 3.2 Ce que le client pourrait fournir, classé par intérêt

1. **Un générateur d'images (références et textures peintes)**: le plus utile.
   - Ce que ça permettrait: des feuilles de personnages de face, de profil et de dos, dans notre style, pour chaque habitant, avant de modéliser (aujourd'hui l'artiste 3D modélise sans image cible, d'où la ressemblance entre tous); des feuilles d'expressions pour l'atlas des visages; des textures de tissus, de bois, de pierre, d'enduit au rendu peint à la main, à ramener à la palette; des planches d'ambiance pour valider la cible avec le client avant de produire.
   - Moyen le plus simple: **réparer le connecteur SpriteCook** déjà prévu. Il sait faire des images détaillées (« HD ») et pas seulement du pixel art, avec image de référence pour tenir le style. Aujourd'hui il échoue: « Proxy refused to open a tunnel: 403 Forbidden » (`ERR_PROXY_TUNNEL`), c'est la politique réseau de l'environnement qui refuse l'hôte de SpriteCook. À faire par le client: autoriser le domaine de SpriteCook dans les réglages réseau de l'environnement cloud (ou l'utiliser par le connecteur claude.ai si celui-ci passe hors de cette politique), puis relancer une session. À vérifier aussi: les conditions de SpriteCook pour un usage commercial des images produites (règle « Ressources et licences »).
   - Autre générateur d'images par connecteur: même usage, même vérification de licence.
2. **Des bibliothèques CC0 accessibles** (Poly Haven, ambientCG pour les textures; Kenney et Quaternius pour des modèles).
   - Ce que ça permettrait: des textures de base (bois, pierre, tissu) à styliser et à ramener à la palette; des modèles de référence pour les proportions et les objets complexes (vélo, accordéon, outils). Les modèles CC0 ne se poseraient pas tels quels dans le jeu: leur style générique trahirait l'identité et ressemblerait à d'autres jeux.
   - Blocage: ces sites sont refusés par la politique réseau. Deux voies: autoriser leurs domaines, ou déposer les archives voulues dans un dossier du dépôt (provenance et licence inscrites dans `CREDITS.md`). `raw.githubusercontent.com` est accessible: une bibliothèque CC0 publiée sur GitHub serait utilisable sans rien changer (à vérifier au cas par cas).
3. **Un générateur 3D par IA** (connecteur vers un service de type texte ou image vers maillage).
   - Ce que ça permettrait: des ébauches de volumes pour les objets compliqués (sculptures de l'église, accordéon, animaux), à retopologiser et à repeindre ici. Pour les personnages, peu d'intérêt: les maillages produits sont denses, mal découpés pour l'animation, d'un style imprévisible, et ne suivent ni notre squelette ni notre palette; on passerait plus de temps à les reprendre qu'à les modéliser par script à partir d'une bonne feuille de référence.
   - À vérifier: licence commerciale des sorties, absence de ressemblance avec des œuvres existantes.
4. **Outils de retopologie ou de dépliage**: inutiles, Blender et xatlas couvrent le besoin (3.1).

### 3.3 Ce qui n'est pas faisable ici, même avec ces outils

- Sculpture et peinture manuelles au stylet (ZBrush, Substance Painter, peinture dans Blender à la souris): aucun humain à la tablette. Les générateurs d'images en sont le meilleur substitut.
- Rendu sur processeur graphique: Cycles tourne sur le processeur, en minutes; les cuissons de tout le bourg prendront des heures sous charge. Prévoir de les lancer hors des heures chargées.
- Jugement sur les vraies machines: le rendu ici passe par SwiftShader; le contour, les mipmaps des motifs et les performances sont à confirmer sur le PC et le Mac.

## 4. Cible visuelle: fiche de style des personnages

Une fois D1 et D2 tranchées (section 6), cette fiche remplace la section 8.5 de la bible pour tout nouveau personnage et pour la refonte. Les artistes la suivent; le directeur artistique la contrôle sur une planche à quatre angles et en jeu aux zooms 0 (le plus proche) et 1 (distance de jeu habituelle).

### 4.1 Intention

Des **figurines en bois peint et en tissu, douces et un peu tassées**, comme sculptées par un artisan du bourg puis habillées: volumes lisses et ronds, bords de vêtements épais, visages dessinés au pinceau fin. Trois adjectifs: **tendre, tassé, habité**. Chaque personnage doit pouvoir être reconnu à son ombre, à sa démarche et à son visage, séparément.

### 4.2 Proportions (adulte de 1,74 m)

Unité: la tête, cheveux non compris, mesurée du menton au sommet du crâne.

| Partie | Valeur | Remarque |
|---|---|---|
| Tête | 0,36 m (4,6 têtes du sol au sommet du crâne, soit 1,66 m, plus 6 à 8 cm de cheveux) | largeur 1,05 fois la hauteur; menton rond et court |
| Cou | visible, 3 à 4 cm entre le menton et le col | jamais noyé dans le col |
| Épaules | largeur 1,15 tête (mince) à 1,4 tête (rond); tombantes de 10 à 15 degrés | jamais au niveau du menton |
| Torse et bassin | 1,6 tête du col à l'entrejambe | taille marquée selon le gabarit |
| Jambes | 1,9 tête de l'entrejambe au sol | ne jamais raccourcir les jambes pour loger une tête plus grosse |
| Bras | bout des doigts à mi-cuisse, coude au niveau de la taille | coude fléchi de 12 à 18 degrés au repos, bras écartés de 8 à 12 degrés |
| Main | 0,55 tête de long (un peu grande) | voir 4.6 |
| Pied | 0,75 tête de long, chaussure comprise | semelle et talon visibles |

Gabarits (chantier 4):

| Gabarit | Différences |
|---|---|
| Mince | épaules 1,15 tête, taille fine, membres effilés |
| Moyen | épaules 1,25 tête |
| Rond | épaules 1,4 tête, ventre en avant de 6 à 10 cm, cou plus court, jambes un peu écartées |
| Aîné | dos voûté de 10 à 15 degrés, tête avancée de 4 à 6 cm, genoux fléchis de 5 degrés, épaules plus étroites, pieds en dehors |
| Enfant (Léon, Jeanne) | 3,4 têtes en tout, tête 0,30 m pour 1,02 m (Léon) ou à l'échelle de Jeanne, jambes 1,3 tête, ventre rond, mains et pieds proportionnellement plus grands |

### 4.3 Visage

Construction sur la tête de face (atlas du chantier 2):

- **Ligne des yeux** à 48 % de la hauteur de la tête en partant du menton (un peu sous le milieu: visage tendre). Écart entre les yeux: une largeur d'œil.
- **Yeux**: ovales verticaux, 3,4 x 4,6 cm sur une tête de 36 cm (13 % de sa hauteur: au zoom le plus proche, un œil doit couvrir au moins 4 pixels de haut à 1920 x 1080, et rester le point le plus sombre et le plus clair du visage). Composition obligatoire: blanc cassé chaud (#F3EDE2) visible des deux côtés de l'iris, iris de la couleur du personnage qui occupe 60 % de la hauteur, pupille foncée, **un reflet** blanc rond en haut, du côté du soleil de midi (en haut à gauche, constant pour tous), **paupière supérieure** en trait épais (3 à 4 mm, brun très foncé chaud #3A2A24, pas noir pur) qui déborde à l'extérieur en petite pointe de cil. Pas de paupière inférieure dessinée, sauf aînés (un trait fin) et fatigue.
- **Formes d'yeux par caractère**: rond (jeune, curieux), amande (calme), tombant à l'extérieur (doux, las), mi-clos (malicieux, aîné). Chaque habitant a la sienne; six formes pour les joueurs.
- **Sourcils**: dessinés comme un coup de pinceau (attaque épaisse côté nez, pointe fine à l'extérieur), de la couleur des cheveux assombrie; épaisseur et courbe propres au personnage (droits et épais pour Basile, fins et hauts pour Colette...). Ils portent la moitié de l'expression.
- **Nez**: petite forme 3D douce (pas de pointe), plus une ombre peinte sous le nez du côté opposé au reflet. Trois tailles (petit, rond, long) pour varier les habitants.
- **Bouche**: un trait courbe avec épaississement aux coins; ouverte, une forme sombre chaude (#6B3A35) avec la langue suggérée; jamais de dents détaillées.
- **Joues**: dégradé rose doux (#E59A8A à 30 % d'opacité, bords fondus), pas un disque à bord net.
- **Oreilles**: entre la ligne des sourcils et la base du nez, une forme en C avec un creux.
- **Détails selon l'âge et le caractère** (au moins un par habitant): taches de rousseur, rides du rire (2 traits au coin des yeux), sillon du nez à la bouche pour les plus de 50 ans, grain de beauté, cernes légers, barbe de trois jours en pointillé tonal.
- **Ombre de frange**: bande assombrie sous la ligne des cheveux sur le front (peinte, 1 cm).

### 4.4 Cheveux

- **Trois niveaux**: masse de base (épouse le crâne, ligne de front irrégulière en 3 à 5 ondes, jamais une ligne droite), **mèches principales** (7 à 14 selon la coupe: 7 pour une coupe ras ou courte, 10 à 12 pour un carré ou un mi-long, 14 pour des cheveux longs ou bouclés), **mèches folles** (2 à 4, plus fines, qui cassent le contour, dont au moins une sur le dessus).
- Chaque mèche: section en amande (pas ronde), effilée en pointe, courbée en S léger, épaisseur 1,5 à 3 cm à la base; les mèches se chevauchent et partent toutes d'un **épi** (sommet du crâne) ou d'une **raie** lisible.
- Couleur: deux tons (base, ombre dans les creux entre mèches) plus **une bande de reflet** claire en arc sur le dessus (peinte ou dans la rampe), coupée par les mèches.
- Nattes et queues: tresse en 5 à 8 segments alternés, attache visible (ruban, élastique), pointe en pinceau.
- **Le dessus compte plus que la face**: la caméra regarde à 35 degrés d'en haut, et à la distance de jeu le dessus de la tête et le haut du chapeau sont la partie du personnage la plus visible (`jeu-quai-zoom-moyen-personnages-x2-5.webp`: la casquette de Firmin cache presque tout son visage). Épi, raie, mèches du dessus et couture de la coiffe sont donc obligatoires et soignés en premier.
- Interdits: boule ou ellipsoïde visible comme tel, mèche plus épaisse qu'un doigt au bout, symétrie parfaite gauche-droite (décaler la raie et au moins deux mèches).

### 4.5 Vêtements et plis

Règles de pli, à modeler quand le pli change la silhouette ou accroche la lumière, à peindre sinon:

- **Plis de tension** (le tissu tiré entre deux appuis): en éventail depuis l'aisselle vers la poitrine, depuis l'entrejambe vers le haut des cuisses, depuis un bouton tiré sur un ventre rond. 2 à 3 plis, en diagonale.
- **Plis de compression** (le tissu tassé): à l'intérieur du coude (2 plis en V), derrière le genou, au-dessus de la ceinture (2 ou 3 bourrelets en Z), sur le cou-de-pied quand le pantalon casse sur la chaussure.
- **Plis de chute** (le tissu qui pend): jupes, robes et tabliers en 8 à 12 tuyaux verticaux, ourlet ondulé qui monte et descend de 2 à 4 cm; manches courtes qui pendent sous l'épaule.
- **Bords**: tout bord libre a une épaisseur de 6 à 10 mm, chanfreinée, et un ourlet peint (ligne de surpiqûre à 1 cm du bord). Cols et revers posés sur le vêtement, avec une ombre dessous.
- **Proportions de vêtement**: épaisseur du tissu sur le corps de 1 à 2 cm (laine et veste 2 à 3 cm), manches et jambes plus larges au poignet et à la cheville qu'au coude et au genou de 10 %.
- Motifs (chantier 6) en texture, alignés sur les coutures, jamais par facettes; échelle d'un carreau de 4 à 6 cm.
- Matières par la valeur: laine mate et sombre en creux, toile claire avec plis nets, cuir avec un reflet et des bords foncés.

### 4.6 Mains et pieds

- Main: paume, **quatre doigts groupés en deux masses** (index séparé, majeur, annulaire et auriculaire ensemble) et pouce, poignet marqué. Trois formes de main par clés de forme: détendue (doigts à demi fléchis, pose de repos), prise (autour d'un manche de 3 cm), ouverte (geste, salut). Plus jamais de poing fermé au repos.
- Pied: chaussure avec semelle plus sombre (8 à 15 mm), talon, empeigne, lacets ou boucle peints, bout arrondi un peu relevé; bottes et sabots selon le métier.

### 4.7 Couleurs du costume

- **Une dominante** (60 % de la surface), **une secondaire** (30 %), **un accent** (10 %, petit et saturé: ruban, boutons, mouchoir, chaussettes), jamais plus de cinq couleurs en tout, peau et cheveux compris.
- **Écart de valeur haut-bas** d'au moins 15 en L*; au moins une grande masse sombre (L* < 40) ou une grande masse claire (L* > 80) par personnage, pour que la silhouette tienne sur la terre battue (L* 75) comme sur l'herbe (L* 69). Un costume tout clair (boulanger) ou tout moyen a obligatoirement un contour (chantier 3) et une pièce sombre (tablier, ceinture, chaussures).
- Ombres teintées: l'ombre de la peau tire vers le rouge brique, celle des tissus vers le bleu violacé de 10 à 15 degrés de teinte, jamais vers le gris.
- Les couleurs vives au cou restent réservées aux foulards des joueurs (bible, section 2).

### 4.8 Détails obligatoires (chaque personnage livré)

Une planche à quatre angles et deux zooms en jeu doit montrer, pour chaque personnage:

1. un visage de l'atlas qui lui est propre (forme d'yeux, sourcils, nez, au moins un détail d'âge ou de caractère);
2. une coupe ou une coiffe conforme à 4.4, sans boule visible;
3. au moins deux bords épais (col, ourlet, revers, poignet) et des plis aux coudes et à la taille;
4. un motif ou une matière lisible (carreaux, rayures, tricot, cuir, toile) peint en texture;
5. des coutures ou surpiqûres sur le vêtement principal, et une fermeture (boutons à trous, boucle, lacets, bretelles);
6. une trace de son métier ou de sa vie (farine, cambouis, terre, craie, tache de café, coude usé, pièce rapiécée);
7. un objet personnel qui modifie la silhouette (outil, sac, lunettes, canne, chapeau, panier);
8. un gabarit et une pose de repos qui lui appartiennent (chantier 4), une marche parmi les trois;
9. mains en forme détendue au repos, chaussures avec semelle;
10. une palette conforme à 4.7, vérifiée en niveaux de gris sur la terre battue et l'herbe;
11. aucune traversée dans les clips de contrôle (`idle`, `walk`, `talk`, `sit`, `carry_two` et son geste de métier), aucun objet qui flotte (liste 8.10 de la bible);
12. triangles sous le budget (habitant 4 800, contour non compté), relevés dans `index.json`.

### 4.9 À éviter

- Toute primitive visible comme telle (boule, cylindre, boîte) sur un personnage.
- Les traits du visage en géométrie anguleuse; le noir pur; les reflets multiples dans les yeux.
- Les motifs par coloriage de facettes; les pastilles collées de taille identique pour figurer des boutons ou des taches.
- Les symétries parfaites (visage dessiné symétrique, mais coiffure, col, plis et pose asymétriques).
- La ressemblance avec un personnage ou un style de jeu existant reconnaissable: on vise une famille de jeux (vie paisible, 3D stylisée) et non un titre.

## 5. Plan de production proposé

| Étape | Contenu | Membres | Jalon de contrôle |
|---|---|---|---|
| A, 4 à 5 jours | Chantiers 1, 2 et 3 sur **trois personnages témoins** (Colette, Firmin, un joueur) | tech-artist, artiste 3D, artiste 2D | planche avant et après, captures en jeu aux zooms 0 et 1, validation du client (D1, D2) |
| B, 5 jours | Chantier 4 (gabarits et poses) et refonte complète des trois témoins (5, 6, 10) | artiste 3D, artiste 2D | planche des trois témoins conforme à la liste 4.8, mesure des triangles |
| C, 2 à 3 semaines | Généralisation aux 21 habitants et aux options des joueurs (15 coupes, tenues), chantier 7 | artiste 3D (deux exemplaires possibles), artiste 2D, dev-gameplay-3d | revue visuelle par lots de 5 habitants |
| B et C en parallèle | Chantiers 8 et 9 | tech-artist, artiste 3D décor, level-designer | mesure `detailedStats()`, captures de la place et de la forêt |
| Fin | Portraits 2D de l'interface redessinés depuis les modèles (même visage que l'atlas, rendus de la 3D retouchés), fin de l'écart P10 | artiste 2D, ux-ui-designer | revue de l'interface |

## 6. Décisions à demander au client

- **D1. Personnages lisses dans un décor à facettes.** Recommandation: oui. Les personnages passent en volumes lisses avec une rampe d'ombrage et un contour coloré, le décor garde ses facettes (identité validée le 31 octobre). C'est le changement qui fera le plus « vrai jeu ». À valider sur la planche des trois témoins avant de généraliser.
- **D2. Fin du « une couleur par pièce » pour les personnages** (visages et tissus peints en texture, couleurs de sommets pour l'occlusion). Recommandation: oui; la personnalisation des joueurs reste possible car la palette continue de donner la teinte.
- **D3. Réparer SpriteCook** (autoriser son domaine dans les réglages réseau de l'environnement) ou fournir un autre générateur d'images. Recommandation: oui, en priorité sur la génération 3D, pour des feuilles de référence par personnage et des textures peintes; vérifier ses conditions d'usage commercial.

## Annexe A. Captures faites pour cet audit

Vrai moteur (`rendu.html?manuel=1&stats=0&vie=0`, 40 images avancées), fenêtre de 1600 x 900, rendu logiciel SwiftShader. Fichiers dans `docs/jeux/jeu-1/gauntlet/captures/qualite-visuelle/`.

| Fichier | Réglages | Ce qu'on y voit |
|---|---|---|
| `jeu-quai-zoom-large.webp` | 15 h, `x=31&y=20.5`, zoom 2 (le plus large), tenue complète | Firmin fait environ 65 pixels de haut, son visage 3 pixels: à ce zoom, seuls la silhouette, la couleur du costume et la casquette se lisent. 17,6 % de l'image sous L* 30 (toits, forêt, ombres). |
| `jeu-quai-zoom-large-firmin-x3.webp` | agrandissement x3 du précédent | bras raides, mains en poing, aucun bord ni creux sombre sur le costume bleu nuit, qui se lit comme un aplat. |
| `jeu-quai-zoom-moyen.webp` et `jeu-quai-zoom-moyen-personnages-x2-5.webp` | même scène, zoom 1 | personnages d'environ 100 pixels; la casquette de Firmin et le bonnet du second personnage (sans doute le joueur 1 en tenue complète) masquent les yeux à 35 degrés; la lecture vient du dessus de la tête, de la silhouette et des bottes jaunes (accent de couleur réussi). |
| `jeu-tonnelle-vigne-x2-5.webp` | extrait du zoom 1 | vigne en icosphères posées et flottantes, nappe plate à rayures (D1 bis). |
| `jeu-place-zoom-proche.webp` et `jeu-place-zoom-proche-joueur-x3.webp` | 17 h 30, `x=41.5&y=22`, zoom 0 (le plus proche) | le joueur fait environ 160 pixels; son œil 2 à 3 pixels; le manche tenu traverse le visage (P8 bis); le soir chaud met en valeur les ombres portées (point fort). |
| `jeu-place-arbre.webp` | extrait du zoom 0 | fruitier en masse unique à grandes facettes, fruits en triangles collés (D1 bis). |
| `diag-silhouettes.webp` | `v0-13/habitants/rangee-21-habitants.webp` seuillée | 21 silhouettes presque identiques (P1). |
| `diag-rangee-gris.webp` | `v0-13/rendu/h6-rangee-21-habitants.webp` en niveaux de gris | habitants en taches de même valeur; costumes clairs fondus dans la terre battue (P9, L2). |
| `diag-visage-colette.webp` | buste de `habitant-colette.webp` agrandi x2 | traits en octogones, arête au milieu du visage, facettes sur la poitrine (P2, P3). |

Non vérifié ici: le rendu sur les vraies cartes graphiques (SwiftShader ne montre ni le filtrage exact ni les performances), et l'aperçu 3D de la création de personnage (non capturé).

## 7. Historique

| Date | Version | Changement | Par |
|---|---|---|---|
| 2026-11-03 | 0.1 | Première version: diagnostic, 10 chantiers, outils, fiche de style des personnages | directeur artistique |
