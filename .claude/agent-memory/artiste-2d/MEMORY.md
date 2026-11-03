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
