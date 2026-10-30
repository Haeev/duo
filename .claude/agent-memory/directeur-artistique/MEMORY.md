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

## Conventions du studio qui touchent l'identité

- Identifiants de code en anglais, y compris les noms de jetons (`--color-bg`, `player.orb`) et les identifiants d'icônes; commentaires, documentation et noms de fichiers en français.
- ADR 0012: la taille de l'interface agit sur la police de la racine, donc jetons de taille en `rem` (1 rem = 16 px à 100 %); seul le filet reste en px.
- Source unique des jetons: `design/identite/b/source/jetons.cjs`; `npm run tout` régénère et contrôle tout (jetons, formes, icônes d'application, contrôles, planches).

## Repères de la plateforme

- Les écrans superposés au jeu vivent dans une vue web séparée: un `backdrop-filter` n'y verrait pas le jeu. Retenu: voile `--color-scrim` (72 %) sur le jeu figé, panneau opaque.
- Profils de joueur de l'identité B: astre aqua, croissant mauve, étoile anis, soleil corail, planète rose, comète jade (identifiants `orb`, `crescent`, `star`, `sun`, `planet`, `comet`). Le cahier (F01) citait encore « rond, carré, triangle, losange, étoile, hexagone » au 2026-10-30.
- Vignettes de jeux fictives (2D en pixels, 3D en facettes, isométrique): `design/identite/b/planches/vignettes.svg`, identiques aux planches des pistes.
