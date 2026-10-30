'use strict';
// Source unique des jetons de l'identité visuelle de Duo (piste B, Étoile double).
// `npm run jetons` en tire jetons.css et jetons.json (mêmes noms, mêmes valeurs), puis les compare.
// Nommage: le chemin dans cet objet donne le nom de la variable CSS (color.surface-raised devient
// --color-surface-raised). Identifiants en anglais (règle du studio), rôles expliqués en français
// dans docs/plateforme/identite-visuelle.md. Valeurs écrites telles qu'en CSS, sans var():
// un jeu qui lit le JSON n'a aucune référence à résoudre.
// Tailles en rem (ADR 0012: la taille de l'interface agit sur la police de la racine);
// 1rem vaut 16 px à 100 %. Seul le filet reste en px: il reste fin à toutes les tailles.
// Contrastes, écarts entre joueurs et simulations du daltonisme: `npm run controler`.

const DISPLAY = "'Jost Variable', 'Jost', system-ui, sans-serif";
const TEXT = "'DM Sans Variable', 'DM Sans', system-ui, sans-serif";

const tokens = {
  color: {
    // fonds et surfaces, du plus profond au plus haut
    bg: '#0E1126',
    'bg-glow': '#1A1F48',
    surface: '#1A1F3D',
    'surface-raised': '#252B52',
    // lignes: le filet et le trait décorent; le contour délimite un composant (3:1 au moins)
    hairline: '#2A3060',
    line: '#3B4380',
    outline: '#7178BB',
    // textes
    text: '#F3F1FA',
    'text-muted': '#A7ABD6',
    'text-disabled': '#6F74A3',
    // action principale
    accent: '#FFC857',
    'accent-hover': '#FFD47A',
    'accent-pressed': '#F0B440',
    'on-accent': '#0E1126',
    // états, toujours accompagnés d'une icône et d'un texte
    success: '#6BD69A',
    error: '#FF6B81',
    // focus clavier
    focus: '#F3F1FA',
    // superpositions sur un jeu: voile sur le jeu figé, panneau opaque par-dessus
    scrim: '#0E1126B8',
    'shadow-1': '#090B1B',
    'shadow-2': '#070915',
    'shadow-3': '#05060F',
  },
  // six couleurs de joueur, chacune liée à un symbole (identifiant = symbole)
  player: {
    orb: '#5CE1E6',
    crescent: '#8D6CFF',
    star: '#D4F27A',
    sun: '#FC663F',
    planet: '#E787B1',
    comet: '#22B07D',
    // texte ou symbole posé sur une couleur de joueur
    on: '#0E1126',
    'halo-opacity': '0.45',
  },
  font: {
    display: DISPLAY,
    text: TEXT,
  },
  // échelle typographique (équivalent à 100 %: taille / interligne)
  type: {
    display: { family: DISPLAY, size: '3.5rem', 'line-height': '3.75rem', weight: '300', tracking: '-0.01em' }, // 56/60
    'title-1': { family: DISPLAY, size: '2.5rem', 'line-height': '3rem', weight: '300', tracking: '0' }, // 40/48
    'title-2': { family: DISPLAY, size: '1.875rem', 'line-height': '2.25rem', weight: '400', tracking: '0' }, // 30/36
    'title-3': { family: DISPLAY, size: '1.375rem', 'line-height': '1.75rem', weight: '500', tracking: '0.01em' }, // 22/28
    overline: { family: DISPLAY, size: '0.875rem', 'line-height': '1.125rem', weight: '500', tracking: '0.24em' }, // 14/18
    'body-large': { family: TEXT, size: '1.125rem', 'line-height': '1.75rem', weight: '400', tracking: '0' }, // 18/28
    body: { family: TEXT, size: '1rem', 'line-height': '1.5rem', weight: '400', tracking: '0' }, // 16/24
    label: { family: TEXT, size: '1rem', 'line-height': '1.25rem', weight: '600', tracking: '0' }, // 16/20
    small: { family: TEXT, size: '0.875rem', 'line-height': '1.25rem', weight: '500', tracking: '0.01em' }, // 14/20
    figure: { family: DISPLAY, size: '3.5rem', 'line-height': '3.5rem', weight: '300', tracking: '0.02em' }, // 56/56
    countdown: { family: DISPLAY, size: '10rem', 'line-height': '10rem', weight: '300', tracking: '0' }, // 160/160
  },
  // espacements: le numéro compte des pas de 4 px
  space: {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
  },
  radius: {
    small: '0.5rem', // 8
    medium: '0.875rem', // 14
    large: '1.375rem', // 22
    pill: '999px',
  },
  stroke: {
    hairline: '1px',
    // 2 px et non 1,5: Chromium arrondit les bordures au pixel inférieur (1,5 px deviendrait 1 px à 100 %)
    component: '0.125rem',
    focus: '0.1875rem', // 3
    'focus-offset': '0.1875rem', // 3
  },
  // élévations sans flou: surface plus claire, liseré, ombre pleine décalée
  elevation: {
    1: '0 0 0 1px #2A3060, 0 0.125rem 0 0 #090B1B',
    2: '0 0 0 1px #3B4380, 0 0.25rem 0 0 #070915',
    3: '0 0 0 1px #3B4380, 0 0.5rem 0 0 #05060F',
  },
  icon: {
    size: '1.5rem', // 24
    'size-large': '2rem', // 32
    'size-small': '1.25rem', // 20
    // épaisseur en unités de la grille de 24: 1,75 à 24 et 32 px; 1,8 à 20 px (1,5 px affichés)
    stroke: '1.75',
    'stroke-small': '1.8',
  },
  duration: {
    fast: '150ms',
    medium: '300ms',
    slow: '600ms',
    orbit: '4000ms',
    twinkle: '3600ms',
  },
  easing: {
    standard: 'cubic-bezier(0.45, 0, 0.25, 1)',
    enter: 'cubic-bezier(0.2, 0, 0.2, 1)',
    exit: 'cubic-bezier(0.45, 0, 0.85, 0.5)',
  },
  // boucles décoratives (orbite d'attente, scintillement): figées quand on réduit les animations
  loops: {
    state: 'running',
  },
};

// Variante posée par l'application quand la case « Réduire les animations » est cochée
// (au premier démarrage, la case suit le réglage du système, lu par prefers-reduced-motion).
const variants = {
  'reduced-motion': {
    selector: ':root[data-motion="reduced"]',
    tokens: {
      duration: { fast: '0ms', medium: '0ms', slow: '0ms', orbit: '0ms', twinkle: '0ms' },
      loops: { state: 'paused' },
    },
  },
};

// Profils de joueur, dans l'ordre du choix de couleur (E02, Réglages > Profil).
// symbolName sert aux phrases (« tu passes en comète »), label aux lecteurs d'écran (« Comète jade »).
const players = [
  { id: 'orb', symbolName: 'astre', colorName: 'aqua', lightness: 'claire' },
  { id: 'crescent', symbolName: 'croissant', colorName: 'mauve', lightness: 'soutenue' },
  { id: 'star', symbolName: 'étoile', colorName: 'anis', lightness: 'claire' },
  { id: 'sun', symbolName: 'soleil', colorName: 'corail', lightness: 'moyenne' },
  { id: 'planet', symbolName: 'planète', colorName: 'rose', lightness: 'moyenne' },
  { id: 'comet', symbolName: 'comète', colorName: 'jade', lightness: 'moyenne' },
];

module.exports = { tokens, variants, players };
