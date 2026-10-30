# Carnet du directeur artistique

Apprentissages durables (pièges, conventions, astuces vérifiées). Pas d'avancement ici.

## Contrôles de couleur (vérifiés le 2026-10-30)

- ImageMagick 6 de l'environnement: `-colorspace RGB` veut dire RGB linéaire. Simulation correcte d'un daltonisme sur une capture: `convert in.png -colorspace RGB -color-matrix "<9 coefficients>" -colorspace sRGB out.png`. Avec les matrices de Machado 2009 (sévérité 1), le résultat égale au pixel près le calcul fait à la main.
  - deutéranopie: `0.367322 0.860646 -0.227968 0.280085 0.672501 0.047413 -0.011820 0.042940 0.968881`
  - protanopie: `0.152286 1.052583 -0.204868 0.114503 0.786281 0.099216 -0.003882 -0.048116 1.051998`
- `convert -colorspace Gray` calcule une luma Rec. 709 sur les valeurs encodées, pas la luminance WCAG: reporter les deux mesures (niveau de gris ImageMagick et L* CIELAB) sans les confondre.
- Script réutilisable qui lit une palette dans un bloc CSS balisé et sort les tableaux Markdown (contrastes WCAG, L*, ΔE2000, simulations): `design/identite/controler.cjs`. Rendu Playwright avec refus des requêtes hors disque: `design/identite/rendre.cjs`.
- Succès vert et erreur rouge se confondent toujours en deutéranopie (ΔE2000 de 6 à 10 quelle que soit la palette essayée): exiger l'icône sur chaque message plutôt que chercher la teinte miracle.
- Un jaune ou une moutarde sur fond clair reste sous 3:1: contour sombre obligatoire pour le signe du joueur.
- Une surimpression (multiplication) par un jaune très clair ne fonce presque pas: rose x jaune donne un vermillon de même clarté que le rose (L* 56 contre 58). Ne pas compter sur elle pour la lecture en niveaux de gris.

## Production des planches

- Playwright préinstallé: le charger par `require('playwright')` dans un fichier `.cjs` (résolu par `NODE_PATH`); un `import` ESM ne le trouve pas.
- Paquets `@fontsource-variable/*`: la famille s'appelle « Nom Variable ». Fraunces a ses axes SOFT et WONK dans `full.css`; Bricolage Grotesque et Archivo ont l'axe de chasse dans `standard.css` (sélection par `font-stretch: 75%`); Jost et Nunito n'ont que `wght.css`. Les CSS se lient en relatif vers `node_modules`, installé dans le dossier de la planche.
- Surimpression d'encres: calculer la couleur à l'avance (a x b / 255 par canal) et la poser par `clip-path`, plutôt que `mix-blend-mode` (coût d'affichage, couleur qui dépend du fond).
- Pièges CSS rencontrés: une règle `.parent > * { position: relative }` écrase le `position: absolute` d'un calque décoratif (ciel étoilé) qui pousse alors toute la mise en page; un sélecteur descendant (`.bloc svg`) attrape aussi les icônes imbriquées: préférer `.bloc > svg`.
- Typographie française dans le HTML: espace insécable (`&nbsp;`) avant « : » et dans les guillemets, espace fine insécable (`&#8239;`) avant « ! ? ; ». Avec des espaces ordinaires, un guillemet fermant se retrouve seul en début de ligne.

## Repères de la plateforme

- Les écrans de la plateforme superposés au jeu vivent dans une vue web séparée (`docs/plateforme/architecture.md`): un `backdrop-filter` n'y verrait pas le jeu. Menus communs sur voile opaque ou semi-opaque.
- Convention UX (`docs/plateforme/ux/parcours.md`): six couleurs de profil, chacune liée à un symbole (rond, carré, triangle, losange, étoile, hexagone), jamais deux joueurs avec la même. L'identité fournit les six teintes et dessine les symboles.
- Vignettes de jeux fictives (2D en pixels, 3D en facettes, isométrique) identiques d'une planche à l'autre: bon moyen de comparer comment chaque piste encadre les jeux.
