'use strict';
// Paramètres des six symboles de joueur, dessinés sur une grille de 24 unités (centre 12, 12).
// Zone utile: un cercle de rayon 10,5; les masses sont équilibrées à l'oeil (le disque plein, plus lourd,
// est le plus petit). Toute retouche se fait ici, puis `npm run formes`.
const g = require('../outils/geometrie.cjs');

const SYMBOLES = {
  astre: () => g.cercle(12, 12, 7.6, 2),
  // ouverture en haut à droite, comme le croissant du logo
  croissant: () => g.croissant(12, 12, 9.2, 7.4, 4.1, -4.1, 2),
  etoile: () => g.etoile4(12, 12, 10.9, 3.2, 2),
  soleil: () => g.soleil(12, 12, 5.3, 7.5, 11.0, 2.4, 8, 0, 2),
  planete: () => g.planete(12, 12, 6.4, 11.4, 4.3, 2.1, -24, 1.0, 2),
  comete: () => g.comete(8.6, 15.4, 6.1, 21.4, 2.6, 0.2, 2),
};

module.exports = { SYMBOLES };
