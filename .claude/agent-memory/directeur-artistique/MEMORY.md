# Carnet du directeur artistique

Apprentissages durables (pièges, conventions, astuces vérifiées). Pas d'avancement ici.

## Contrôles de couleur (vérifiés le 2026-10-30)

- ImageMagick 6 de l'environnement: `-colorspace RGB` veut dire RGB linéaire. Simulation correcte d'un daltonisme sur une capture: `convert in.png -colorspace RGB -color-matrix "<9 coefficients>" -colorspace sRGB out.png`. Avec les matrices de Machado 2009 (sévérité 1), le résultat égale à 1/255 près le calcul fait à la main.
  - deutéranopie: `0.367322 0.860646 -0.227968 0.280085 0.672501 0.047413 -0.011820 0.042940 0.968881`
  - protanopie: `0.152286 1.052583 -0.204868 0.114503 0.786281 0.099216 -0.003882 -0.048116 1.051998`
  - tritanopie: `1.255528 -0.076749 -0.178779 -0.078411 0.930809 0.147602 0.004733 0.691367 0.303900`
- `convert -colorspace Gray` calcule une luma Rec. 709 sur les valeurs encodées, pas la luminance WCAG: reporter les deux mesures (niveau de gris ImageMagick et L* CIELAB) sans les confondre.
- Calculs partagés (contraste WCAG, Lab, ΔE2000, simulations, couleur semi-transparente sur un fond): `design/identite/b/outils/couleur.cjs`. Contrôle complet sur les jetons livrés: `design/identite/b/outils/controler.cjs`.
- Succès vert et erreur rouge se confondent toujours en deutéranopie (ΔE2000 de 6 à 10 quelle que soit la palette essayée): exiger l'icône sur chaque message plutôt que chercher la teinte miracle.
- Un jaune ou une moutarde sur fond clair reste sous 3:1: contour sombre obligatoire pour le signe du joueur.
- Une surimpression (multiplication) par un jaune très clair ne fonce presque pas: ne pas compter sur elle pour la lecture en niveaux de gris.
- Six couleurs de joueur sur fond sombre (CA-PF-109: ΔE2000 de 20 en vision normale, 10 sous protanopie, deutéranopie et tritanopie): faisable avec 15 à 30 % de marge, mais pas avec en plus six gris distincts (toutes doivent dépasser 4,5:1 sur la nuit, donc L* de 52 à 93). Les paires qui coincent: un rose contre un aqua (deutéranopie), un orange contre un vert (protanopie), un orange contre un rose (tritanopie). Méthode qui marche: fixer les teintes voulues, puis optimiser au plus près d'elles sous contrainte de marge (recherche par coordonnées sur une grille sRGB), et non maximiser la marge, qui ternit tout.

## Production des planches et des assets

- Playwright préinstallé: le charger par `require('playwright')` dans un fichier `.cjs` (résolu par `NODE_PATH`); un `import` ESM ne le trouve pas.
- Servir une planche par `page.route` sous une adresse fictive (`http://duo.local/`) qui lit les fichiers du disque: `fetch` et les `<use href="fichier.svg#id">` externes marchent (même origine), et toute autre requête est refusée et comptée. En `file://`, Chromium bloque les deux. Script modèle: `design/identite/b/outils/rendre-planches.cjs` (signale aussi tout débordement horizontal).
- Un `<use>` n'hérite pas des attributs de la racine d'une planche de `<symbol>`: mettre `fill`, `stroke`, `stroke-linecap`... sur chaque `<symbol>`, et laisser `stroke-width` venir de l'élément qui affiche l'icône. Les variables CSS, elles, traversent.
- Les attributs de présentation SVG n'acceptent pas `var()`: écrire `style="opacity: var(--x)"`.
- Chromium arrondit les épaisseurs de bordure CSS à l'entier inférieur: 1,5 px s'affiche à 1 px (mesuré par `getComputedStyle` à 100, 125, 150 et 200 %). Bordures de composant à 2 px; les traits SVG ne sont pas arrondis.
- Paquets `@fontsource-variable/*`: la famille s'appelle « Nom Variable ». DM Sans a la taille optique dans `standard.css`; Jost et Nunito n'ont que `wght.css`. Jost a des chiffres tabulaires (`tnum`), DM Sans non.
- Ni Jost ni DM Sans n'ont U+202F, U+2011, U+2010, ⌘ ni ← →. Chromium compose U+202F avec l'espace de la police (moteur HarfBuzz, vérifié par `CSS.getPlatformFontsForNode` en CDP), mais prend U+2011 et ⌘ dans une police du système.
- fontkit 2: `getVariation` plante sur un WOFF2; pour vectoriser des lettres, lire une instance statique (`@fontsource/<police>/files/*-300-normal.woff2`), puis `glyph.path.mapPoints((x, y) => ...)` (deux arguments, pas un tableau) et `toSVG()`.
- polygon-clipping échoue parfois (« Unable to complete output ring ») sur des sommets flottants presque alignés: aligner chaque sommet sur une grille de 1e-5 avant l'opération.
- Icônes d'application sans outil dédié: ICNS = en-tête `icns` puis blocs `type + longueur + PNG` (icp4, icp5, icp6, ic07 à ic14); ICO = répertoire, BMP 32 bits (BGRA de bas en haut, hauteur doublée, masque ET à zéro) sous 256 px, PNG à 256. ImageMagick relit l'ICO au pixel près. Script: `design/identite/b/outils/generer-icones-app.cjs`. Petites tailles: dessin simplifié calé sur la grille de 16; sur macOS, la plaque garde sa marge à toutes les tailles (sinon le Dock mélange deux tailles de plaque).
- Surimpression d'encres: calculer la couleur à l'avance et la poser par `clip-path`, plutôt que `mix-blend-mode`.
- Pièges CSS rencontrés: une règle `.parent > * { position: relative }` écrase le `position: absolute` d'un calque décoratif; un sélecteur descendant (`.bloc svg`) attrape aussi les icônes imbriquées.
- Typographie française dans le HTML: `&nbsp;` avant « : » et dans les guillemets, `&#8239;` avant « ! ? ; ».

## Captures de La Petite Ligne (vérifié le 2026-10-31)

- Scène sans interface: `rendu.html?stats=0&vie=0&heure=8:30&x=..&y=..&orientation=0..3&zoom=0..2` (vrai moteur, vraie carte; `vie=0` fige la promenade, sinon `x`/`y` sont écrasés). Avec interface et vraie simulation: `src/interface/demo/index.html?scenario=titre|scene|jour|carnet|coffre|veillee|nuit|petit-dejeuner` (attendre `window.lplInterface.ready`). Lancer son propre Vite (config avec `hmr: false`, port libre): les autres membres écrivent dans l'arbre.
- La caméra suit le joueur 1, et tout ce qui est devant lui dans un rayon de 1,7 m s'efface en tramage (`materiaux.ts`): pour une capture propre, le poser à découvert, prendre `zoom=2` et recadrer.
- Le moteur plafonne à 1920 x 1080 pixels physiques (`maxPhysicalPixels`): un `deviceScaleFactor` de 2 n'ajoute aucun détail, prendre une fenêtre de 1920 x 1080. La résolution dynamique n'agit qu'après 5 s de temps moteur, jamais atteintes en SwiftShader avant la capture. Compter 30 s à 2 min par capture (machine partagée).
- Bibliothèque de Duo sans Electron: servir `apps/duo/out/renderer` par `page.route`, cliquer « Bibliothèque », remplacer le `src` des `.vignette-image`. Vignette affichée en 299 x 168 (bibliothèque, fenêtre de 1366) et 144 x 81 (salon): le titre doit se lire à 144 px.
- `pkill -f motif` tue aussi le shell qui le lance si le motif figure dans sa propre ligne de commande (code 144): viser un PID.

## Conventions du studio qui touchent l'identité

- Identifiants de code en anglais, y compris les noms de jetons (`--color-bg`, `player.orb`) et les identifiants d'icônes; commentaires, documentation et noms de fichiers en français.
- ADR 0012: la taille de l'interface agit sur la police de la racine, donc jetons de taille en `rem` (1 rem = 16 px à 100 %); seul le filet reste en px.
- Source unique des jetons: `design/identite/b/source/jetons.cjs`; `npm run tout` régénère et contrôle tout (jetons, formes, icônes d'application, contrôles, planches).

## Repères de la plateforme

- Les écrans superposés au jeu vivent dans une vue web séparée: un `backdrop-filter` n'y verrait pas le jeu. Retenu: voile `--color-scrim` (72 %) sur le jeu figé, panneau opaque.
- Profils de joueur de l'identité B: astre aqua, croissant mauve, étoile anis, soleil corail, planète rose, comète jade (identifiants `orb`, `crescent`, `star`, `sun`, `planet`, `comet`). Le cahier (F01) citait encore « rond, carré, triangle, losange, étoile, hexagone » au 2026-10-30.
- Vignettes de jeux fictives (2D en pixels, 3D en facettes, isométrique): `design/identite/b/planches/vignettes.svg`, identiques aux planches des pistes.

## Captures sous charge (gauntlet, 2026-10-31)

- Sous charge (rendu logiciel, plusieurs relecteurs en parallèle), le délai par défaut de 30 s de `page.screenshot` ne suffit pas: passer `timeout` explicitement.
- Réduire les couleurs d'une capture sans tramage crée de faux anneaux sur les halos de nuit: utiliser `-dither FloydSteinberg` avec ImageMagick.

## Contrôles géométriques en jeu (La Petite Ligne, 2026-10-31)

- Les lisses du passage à niveau partent levées et se baissent avec une demi-vie de 0,35 s: en rendu logiciel, une capture à 1,5 s les montre en mouvement. Attendre 12 s avant la capture.
- Une lisse baissée est parallèle aux rails (elle barre la route). En vue 0, la lisse sud se projette sur le ballast et semble suivre la voie: vérifier avec une autre vue ou des mesures avant de conclure.
- La page de rendu ne place pas les habitants selon l'heure (Firmin à `quay_bell`, Jeanne au point `quay_bench`, au centre du banc, quelle que soit l'heure). Masquer un personnage: `scene.traverse` et `visible = false` sur le maillage `villager_<id>` (masquer le groupe `personnage <id>` ne marche pas, le rendu le réaffiche).
- Avec la config Vite du dev (`window.dgEngine` exposé), on retrouve la scène et la caméra orthographique en parcourant l'objet; `vecteur.project(camera)` donne la position à l'écran d'un point du monde (marquer une ombre calculée sur une capture). Dans `page.evaluate`, `await import('/src/rendu/lumiere.ts')` charge un module du jeu par Vite (soleil de `DaylightRig` à une heure donnée).
- Le décor est fusionné en morceaux (`decor x:y`): impossible de masquer un objet seul. La géométrie d'un modèle se lit dans le JSON de `bourg.glb` (nœuds, `min`/`max` des accesseurs).

## Mise en scène face à la caméra par défaut (La Petite Ligne, 2026-10-31)

- Caméra par défaut: regard vers le nord-ouest, élévation 35,26°. Deux points du sol sont sur la même colonne de l'écran quand leur `x - y` (repère de `halte.json`, y vers le sud) est égal; écart horizontal à l'écran = `Δ(x - y) / √2` m. Contrôle en une ligne avant toute capture: deux personnages côte à côte doivent différer d'au moins 0,6 m sur `x - y`. Un objet penché vers le nord-est ou le sud-ouest se voit de profil.
- Rien d'important au nord-ouest d'un bâtiment haut à moins de 3 m (règle `camera.regle` de la carte): il passe derrière son toit.
- Page de rendu d'un moment: `rendu.html?vie=0&manuel=1&moment=<id>&t=<s>`, puis `lplRendu.advance(1/30)` 40 fois. Sans `vie=0`, la promenade déplace le joueur 1 et la caméra quitte le moment.
- Essayer une mise en scène sans toucher au dépôt: copier `games/la-petite-ligne` (sans `node_modules`, avec des liens vers `node_modules` du jeu, de la racine et vers `packages`) dans `/tmp`, modifier `halte.json`, `moments.json` et `MOMENT_SPOTS` de `etat-exemple.ts`, servir par un Vite à part (autre port). Sous charge, deux captures en parallèle au plus, `timeout` de capture à 480 s.

## Contrôle d'un moment dans les quatre orientations (La Petite Ligne, 2026-11-01)

- Le trou tramé d'un moment (`RENDER_SETTINGS.momentSeeThrough`) est centré sur une accroche: un objet sur une face du tronc passe derrière lui dans deux orientations, et le trou ne sert plus. Vérifier les quatre orientations, pas seulement la vue par défaut, et demander un centre sur le personnage qui agit.
- Repère pour savoir qui est le joueur 1 sur une capture: c'est celui qui a le trou tramé autour de lui (le joueur 2 n'en a pas).
- Vérifier la portée d'un geste (`reach_up`) au zoom 0: au zoom 1 un écart main-objet de 0,3 m ne fait que quelques pixels.

## Captures en mode manuel et lecture des effets (La Petite Ligne, 2026-11-01)

- Avec `manuel=1`, `lplRendu.frames` reste à 0: attendre `lplRendu.ready`, puis `advance(1/30)` 40 fois, puis capturer. Attendre `frames > 3` bloque jusqu'au délai.
- Une brume ou une nappe se juge d'abord en valeur: mesurer L* (ImageMagick `-colorspace Lab`, moyenne du canal L) de la nappe, de l'eau claire et des berges. Une brume plus sombre que ses berges se lit comme de la fumée.
- Une bouffée de particules face à la caméra plus grande que deux fois sa hauteur au-dessus du sol est coupée par le sol en ligne droite (bancs de brume du matin de `ciel.ts`): demander des sprites posés à plat ou un fondu du bas.
- Oreilles d'une bête vues de profil: une oreille étroite et dressée devient une pointe qui se lit comme un bois. Toujours contrôler une silhouette de profil strict au zoom de jeu.

## Étalonnage et passe de rendu (La Petite Ligne, 2026-11-01)

- Une saturation d'étalonnage qui « agit plus sur les teintes ternes » (`look.saturation`) resature d'abord les ombres: c'est elle, plus que la teinte d'ombre, qui fait virer une ombre froide au mauve le soir. Baisser la saturation avant de toucher à la teinte.
- Un pan de toit entièrement à l'ombre sur une case déjà froide (lauzes) ne se règle pas par les valeurs globales de `look` (essais à 3 variantes: b\* -25 à -17 seulement): demander une part de teinte réduite sur les cases froides.
- Essais de réglages sans toucher au dépôt: copie du jeu sans `node_modules` dans `/tmp` avec un lien vers le `node_modules` du jeu suffit (Vite résout les liens pnpm); donner à ce Vite son propre `cacheDir` et passer un `timeout` explicite à `page.goto` (30 s ne suffisent pas sous charge).

## Captures sous forte charge et échelle des personnages (La Petite Ligne, 2026-11-03)

- Charge de 20 sur 4 cœurs: une capture de `rendu.html` en mode continu a dépassé 480 s sur `page.screenshot`. Le mode `manuel=1` (attendre `lplRendu.ready`, `advance(1/30)` 40 fois, puis capturer) passe en 3 à 8 min par image en 1600 x 900: le préférer dès que la machine est chargée.
- Zooms de la page de rendu: `zoom=0` est le plus proche, `zoom=2` le plus large. En 1600 x 900, un personnage adulte fait environ 160, 100 et 65 pixels de haut aux zooms 0, 1 et 2, son œil 2 à 3 pixels au zoom 0. À la distance de jeu, on lit d'abord la lumière sur le personnage, son bord, sa silhouette et le dessus de sa tête (caméra à 35 degrés): juger un visage dans les aperçus 3D et au zoom 0, pas au zoom 1.
- Valeurs: une planche de personnages alignés sur la grève (L* 2,6 % sous 30) ne représente pas le bourg (17,6 % sous 30 à 15 h avec toits et forêt). Mesurer L* sur une capture du bourg avant de conclure à un étalonnage voilé.

## Planches en vue subjective et polices (Cosy Café, 2026-11-07)

- `rsvg-convert` lit les polices par fontconfig: `fc-list` voit les WOFF2 des paquets @fontsource, mais le rendu sort des carrés vides. Rendre les SVG par Chromium (SVG en ligne dans une page HTML qui charge les CSS @fontsource, servie par `page.route`); un SVG en `<img>` ne voit pas les polices de la page.
- Polices manuscrites OFL vérifiées par fontkit (fichiers latin et latin-ext): Caveat (variable), Kalam, Patrick Hand couvrent tout le français (accents, œ, « », ’, …, €); U+202F absente de toutes.
- Petit moteur de perspective réutilisable pour dessiner une vue à la vraie caméra du jeu: `docs/jeux/cosy-cafe/bible/source/scene3d.cjs` (+ `mobilier.cjs`, `figures.cjs`, `adresses.cjs`). Pièges rencontrés: un point près du plan de la caméra fait exploser une projection (découper ou ignorer sous 0,3 m); l'ordre des pièces d'un objet l'emporte sur la profondeur, donc une pièce « posée devant » se dessine même vue de dos (mettre groupes et façade au même ordre); une source de lumière placée sur une face donne une distance nulle et une couleur NaN (noir); un texte projeté par transformation affine sur un panneau vu de l'autre côté sort en miroir (coin haut gauche du côté des x croissants vu depuis +z); une personne assise dessinée à plat se pose au bord avant de l'assise et se dessine après le siège.
- Liseré de silhouette en SVG: épaisseur à convertir en pixels d'écran selon la profondeur (sinon un liseré de 2 cm devient un contour d'autocollant au premier plan).

## Couleurs de jeu face aux couleurs de joueur de Duo (2026-11-07)

- Les gris bleutés moyens (L* 50 à 60, C* 10 à 15, teinte 240 à 265) tombent à moins de 15 (CIEDE2000) du mauve de Duo: les pousser vers le bleu-vert (teinte 210 à 230), plus clair (L* 66 et plus) ou plus sombre (L* 50 et moins). Terre cuite et cuivre clairs frôlent le corail: assombrir (L* 48 à 50).
- Sous deutéranopie et protanopie, cuivre, laiton, ocre et sauge rejoignent le corail ou le jade (écart jusqu'à 0,3): inévitable dans une palette chaude; un joueur ne doit jamais se reconnaître à sa teinte seule.
- Distinguer deux joueurs quelle que soit la paire de Duo (15 paires): le plus clair des deux porte un haut sombre (L* 26 et moins), l'autre un haut clair (87 et plus); les bandes à la couleur du joueur bordées d'un liseré sombre (aqua sur crème ne fait que 9 de L*). Vérifié sur les 15 paires en gris et sous simulations (`docs/jeux/cosy-cafe/bible/controles/silhouettes-controles.png`).
- En silhouette noire, des profils debout sans accessoire saillant se confondent: grossir l'accessoire signature d'un quart et donner une posture propre.

## Travail en parallèle

- Le manager fait des commits de sauvegarde du travail en cours de l'équipe (« non relu »): mes fichiers peuvent apparaître suivis par git pendant la mission. Les plans du level designer bougent aussi pendant ce temps: relire `plans.json` juste avant de figer une vue calée sur un plan.
- `docs/jeux/cosy-cafe/plans/plans.json`: x vers la droite, y vers le bas (rue en bas du dessin); pour une vue face à la rue, x de la vue = abscisse du mur de droite du plan moins x du plan, z = y du plan moins y du mur du fond.

## Planches et catalogue de personnages (La Petite Ligne, refonte, 2026-11-10)

- `rsvg-convert` rend bien les textes en « DejaVu Sans » (police du système): suffisant pour une planche de cotes, sans passer par Chromium. Les signes ♪ et ♥ y sont présents.
- Un libellé ancré à droite (`text-anchor="end"`) près du bord gauche sort de la planche sans erreur: toujours regarder le PNG.
- Visage en traits d'encre sur peau sombre (L* sous 35): illisible. Prévoir le blanc de l'œil visible et des lèvres claires; règle d'au moins 25 points de L* entre peau et sourcils ou bouche.
- CIEDE2000 pardonne beaucoup la saturation: un rouge coquelicot, un rose ancien et un gris-bleu moyen tombent à moins de 15 du corail, du rose et du mauve de Duo. Contrôle: `docs/jeux/jeu-1/refonte/planches/source/controle_nuancier.py`.
- Liste de catalogue longue: la tenir en données (une ligne par pièce) et générer les tableaux, puis vérifier par script les totaux par vague et que les exemples n'emploient que des pièces de la vague annoncée.
