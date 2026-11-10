# Carnet de l'artiste 2D

## La Petite Ligne: sprite d'icônes

- Le sprite `games/la-petite-ligne/ui-maquettes/icones.svg` est généré: modifier la source `ui-maquettes/outils/icones-source.svg`, puis lancer `node games/la-petite-ligne/ui-maquettes/outils/generer-icones.mjs` (réécrit aussi `support/icones.js`). Le générateur relancé sur une source intacte ne change rien: s'en servir pour vérifier l'absence de dérive.
- Dans ce sprite, les règles CSS des classes `lpl-ik`, `lpl-ikf` et `lpl-iu` l'emportent sur les attributs `stroke` et `stroke-width` du même élément: un détail d'une autre couleur ou d'une autre épaisseur se dessine sans classe.
- Style: viewBox 0 0 24 24, trait d'encre #2a2522 de 1,5, lumière en haut à gauche, couleurs tirées de `palette.py`; contrôle sur une planche Chromium à 24 et 48 px, sur fond papier, gris et bois.

- Familles par paramètres (0.12.2): `outils/familles-icones.mjs` réécrit le bloc « Familles générées » de `icones-source.svg` (poissons `fish-*`, raretés `rarity-*`, robes `hen-*`); le relancer avant `generer-icones.mjs`, ne jamais retoucher ce bloc à la main. Pas de `clipPath` ni de dégradé dans le sprite (il est inséré caché): le dos et le ventre d'un poisson se peignent avec des tracés qui suivent le contour.
- Une icône par chose: `src/interface/tests/icones.test.ts` exige une entrée de `ITEM_ICONS` pour chaque objet de `objets.json`, aucun symbole partagé, aucun repli générique (`parcel`, `plank`, `bread`, `fish`, `gift`, `hen`) hors exceptions, et les couleurs de `palette.py`. Un nouvel objet sans icône casse ce test.
- `planche-icones.cjs [sortie] [préfixes]` (ZOOM=2 pour agrandir) contrôle la palette et fait la planche 24/48 sur papier et bois sombre; pour juger une forme, rendre aussi en 96 px. Petites formes (fanions, champignons dans une poêle): un trait de 0,8 à 1 sans classe, sinon l'encre de 1,5 les noie.
- Composition poisson sur fond de rareté: les ornements d'angle du fond mythique occupent les coins, donc les éclats et la lune des mythiques se placent en haut au centre.

## La Petite Ligne: vignettes du carnet (memory-*)

- Grille de 40, disque `r=18` centré d'un ton opaque de `palette.py`; contour extérieur du sujet en classe `lpl-vo` (encre 2), détails en `lpl-ik`/`lpl-ikf` (1,5). Les très petits détails colorés (crêtes, becs, calottes) se dessinent sans trait: un contour de 1,5 les noie à 40 px.
- Contrôle: `node games/la-petite-ligne/ui-maquettes/outils/planche-vignettes.cjs [sortie.png]` (palette, L* disque et sujet, planche 40/60/190 px en couleur et en gris). Onglet en jeu: `capturer-souvenirs.cjs <url> "" tour-NN vignettes`, serveur Vite du jeu sur un port libre (5197 est souvent pris par une autre copie: `--strictPort` le signale).
- Lisibilité à 40 px: un oiseau en vol se lit par des ailes larges en M aplati, pas par une croix; un poisson tenu au bec se lit en biais avec queue fourchue et oeil; une échelle se lit par ses barreaux (montants espacés d'au moins 4 unités).
- Les scénarios de démo `souvenirs-*` ne montrent que héron, oies, échelle, mésanges, renard, vers luisants, poules et mot de Lucie: les autres vignettes ne se vérifient que sur la planche.

## La Petite Ligne 2: images « à la plume » (interface encrée, thème sombre)

- Moteur `games/la-petite-ligne-2/assets-src/interface-encre/encrer.mjs`: source SVG simple (aplats, traits `fill="none"`), contour calculé dans Chromium (`getPointAtLength`), rubans pleins et déliés orientés pareil en règle nonzero (un ruban par morceau entre deux coins, un disque au coin; anneau en « trou de serrure » sans coin). Pas de `stroke` en sortie: rendu identique dans Chromium, rsvg-convert et `<img>`.
- Liseré clair par `<use href="#d" stroke=...>` derrière le groupe dessiné: les enfants sans `stroke` l'héritent. Les calques d'expression restent hors de ce groupe (le CSS du document ne voit pas l'intérieur d'un `<use>`).
- Portraits inline: identifiants préfixés `__P__`, remplacés à l'affichage par un compteur (deux portraits dans la page). Une `class="bouche"` = un seul groupe par calque (le moteur regroupe les éléments consécutifs).
- Pictos du sprite: `currentColor`, ombre en `fill-opacity`, aucun `clipPath`; un décimal et `minSeg` 0,32 tiennent le sprite à 85 Ko. Le générateur repasse Prettier sur `pictos-encre.ts`.
- Outil Bash refusé dans ce worktree pour les heredocs Python avec `>`, les `cat > fichier <<EOF` multiples et les commandes qui contiennent « git » ou « source »: écrire les fichiers avec Write, remplacer par `rep.py` (JSON de paires) dans le scratchpad.
## La Petite Ligne 2: traits du visage et plis 3D (essai de style 4)

- Moteur de plume de l'interface réutilisé par `essai-style-4/scripts/encrer-lot.mjs` (lot JSON, une page Chromium). Calques séparés par `data-expr`, extraits par regex puis rendus un à un avec rsvg-convert (couverture = alpha). Lancer Node depuis Python avec `env={**os.environ, "NODE_PATH": ...}`: sans HOME, Playwright ne trouve pas son Chromium.
- Cellule des traits: yeux à y 0,2, bouche à y 0,8, demi-écart 0,235; largeur et hauteur réelles diffèrent selon le corps (enfant et âgée: 1,45): étirer les pièces en hauteur, plafonné pour que les sourcils levés restent dans la cellule. Front, menton et barbe sortent de la cellule: les peindre dans l'atlas du corps.
- Le point « nez » mesuré par le conformateur est souvent la lèvre (le plus avancé du profil): poser le nez dessiné par une fraction yeux-bouche (0,62).
- Réduire un atlas RGBA en alpha prémultiplié, puis étendre les couleurs sous les texels vides, sinon franges sombres au filtrage.
- Juger les visages à `?vue=expressions&zoom=5`: le modelé à facettes et la coque d'encre autour des orbites dominent les traits; c'est la limite de la note, pas le dessin.
- Bash refuse les commandes jugées complexes (heredoc, `git` dans une boucle): écrire les scripts avec Write dans le scratchpad, une commande git par appel.

## La Petite Ligne 2: série des vignettes d'objets (2026-11-10)

- Détail intérieur sans noircir à 48 px: `data-teinte="#ton"` (moteur `encrer.mjs`) peint le trait de plume dans un ton du nuancier (ombre de la matière pour les veines, ton clair pour les reflets), `data-w` 0,26 à 0,35. L'encre noire reste au contour, au pli principal et aux hachures.
- Lots: `generer-images.mjs vignettes id,id,...`; `planche-serie.cjs <dossier> <famille|id,id> [--grand]` (familles tirées des données: outils, poissons, potager, cuisine, provisions, meubles). Les meubles sont générés par `generer-meubles.py` (projection commune, séries miel et sauge par trio de tons): modifier le script, pas les SVG.
- Pièges de lecture vus à la planche: un œuf trop brun et moucheté se lit pomme de terre (garder un ton clair, points minuscules); un tas de grain lisse se lit miche de pain (grains détachés, en relief, plus une plume); une tranche de pain dessinée de face « debout » paraît étrange (la coucher en trois quarts sur sa planchette); un paquet qui couvre la moitié d'un sandwich le cache.
- Familles qui tiennent à 48 px: outils dessinés tête en haut puis tournés de 38 degrés (ombre peinte à droite avant rotation); poissons de profil tête à gauche, tournés de -10 à -16; plats dans l'assiette crème à liseré de couleur, le bol de trois quarts, le moule à bord festonné.
- Bash refuse toute commande qui mêle `git` à un `cd` calculé ou à un sous-shell: lancer `git status` seul, depuis la racine du worktree.

