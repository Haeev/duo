'use strict';
// Paramètres des six symboles de joueur, sur une grille de 24 unités (centre 12, 12).
// Zone utile: un cercle de rayon 11; masses équilibrées à l'oeil (le disque plein, plus lourd, est le plus
// petit). Lisibles dès 16 px. Toute retouche se fait ici, puis `npm run formes`.
const g = require('../outils/geometrie.cjs');

const SYMBOLS = {
  orb: () => g.circle(12, 12, 7.6, 2),
  // ouverture en haut à droite, comme le croissant du logo
  crescent: () => g.crescent(12, 12, 9.2, 7.4, 4.1, -4.1, 2),
  star: () => g.star4(12, 12, 10.9, 3.0, 2),
  sun: () => g.sun(12, 12, 5.3, 7.5, 11.0, 2.4, 8, 0, 2),
  planet: () => g.planet(12, 12, 6.4, 11.4, 4.3, 2.1, -24, 1.0, 2),
  comet: () => g.comet(8.6, 15.4, 6.1, 21.4, 2.6, 0.2, 2),
};

module.exports = { SYMBOLS };
