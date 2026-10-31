# Carnet de l'artiste 2D

## La Petite Ligne: sprite d'icônes

- Le sprite `games/la-petite-ligne/ui-maquettes/icones.svg` est généré: modifier la source `ui-maquettes/outils/icones-source.svg`, puis lancer `node games/la-petite-ligne/ui-maquettes/outils/generer-icones.mjs` (réécrit aussi `support/icones.js`). Le générateur relancé sur une source intacte ne change rien: s'en servir pour vérifier l'absence de dérive.
- Dans ce sprite, les règles CSS des classes `lpl-ik`, `lpl-ikf` et `lpl-iu` l'emportent sur les attributs `stroke` et `stroke-width` du même élément: un détail d'une autre couleur ou d'une autre épaisseur se dessine sans classe.
- Style: viewBox 0 0 24 24, trait d'encre #2a2522 de 1,5, lumière en haut à gauche, couleurs tirées de `palette.py`; contrôle sur une planche Chromium à 24 et 48 px, sur fond papier, gris et bois.
