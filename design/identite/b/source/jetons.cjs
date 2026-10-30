'use strict';
// Source unique des jetons de l'identité visuelle de Duo (piste B, Étoile double).
// `npm run jetons` en tire jetons.css et jetons.json (mêmes noms, mêmes valeurs), puis les compare.
// Règle de nommage: le chemin dans cet objet donne le nom de la variable CSS
// (couleur.surface-haute devient --couleur-surface-haute). Valeurs écrites telles qu'en CSS,
// sans var(): un jeu qui lit le JSON n'a aucune référence à résoudre.
// Contrastes, écarts entre joueurs et simulations du daltonisme: `npm run controler`.

const TITRE = "'Jost Variable', 'Jost', system-ui, sans-serif";
const TEXTE = "'DM Sans Variable', 'DM Sans', system-ui, sans-serif";

const jetons = {
  couleur: {
    // fonds et surfaces, du plus profond au plus haut
    fond: '#0E1126',
    'fond-lueur': '#1A1F48',
    surface: '#1A1F3D',
    'surface-haute': '#252B52',
    // lignes: le filet et le trait décorent, le contour délimite un composant (3:1 au moins)
    filet: '#2A3060',
    trait: '#3B4380',
    contour: '#7178BB',
    // textes
    texte: '#F3F1FA',
    'texte-2': '#A7ABD6',
    'texte-inactif': '#6F74A3',
    // action principale
    accent: '#FFC857',
    'accent-survol': '#FFD47A',
    'accent-presse': '#F0B440',
    'sur-accent': '#0E1126',
    // états, toujours accompagnés d'une icône et d'un texte
    succes: '#6BD69A',
    erreur: '#FF6B81',
    // focus clavier
    focus: '#F3F1FA',
    // superpositions sur un jeu: voile sur le jeu figé, panneau opaque par-dessus
    voile: '#0E1126B8',
    'ombre-1': '#090B1B',
    'ombre-2': '#070915',
    'ombre-3': '#05060F',
  },
  // six couleurs de joueur, chacune liée à un symbole (identifiant = nom du symbole)
  joueur: {
    astre: '#5CE1E6',
    croissant: '#8D6CFF',
    etoile: '#D4F27A',
    soleil: '#FC663F',
    planete: '#E787B1',
    comete: '#22B07D',
    // texte ou symbole posé sur une couleur de joueur
    sur: '#0E1126',
    'halo-opacite': '0.45',
  },
  police: {
    titre: TITRE,
    texte: TEXTE,
  },
  // échelle typographique, en pixels CSS à la taille d'interface 100 %
  type: {
    affiche: { police: TITRE, taille: '56px', interligne: '60px', graisse: '300', approche: '-0.01em' },
    'titre-1': { police: TITRE, taille: '40px', interligne: '48px', graisse: '300', approche: '0' },
    'titre-2': { police: TITRE, taille: '30px', interligne: '36px', graisse: '400', approche: '0' },
    'titre-3': { police: TITRE, taille: '22px', interligne: '28px', graisse: '500', approche: '0.01em' },
    surtitre: { police: TITRE, taille: '14px', interligne: '18px', graisse: '500', approche: '0.24em' },
    'corps-grand': { police: TEXTE, taille: '18px', interligne: '28px', graisse: '400', approche: '0' },
    corps: { police: TEXTE, taille: '16px', interligne: '24px', graisse: '400', approche: '0' },
    libelle: { police: TEXTE, taille: '16px', interligne: '20px', graisse: '600', approche: '0' },
    petit: { police: TEXTE, taille: '14px', interligne: '20px', graisse: '500', approche: '0.01em' },
    chiffre: { police: TITRE, taille: '56px', interligne: '56px', graisse: '300', approche: '0.02em' },
    decompte: { police: TITRE, taille: '160px', interligne: '160px', graisse: '300', approche: '0' },
  },
  // espacements: le numéro vaut des multiples de 4 px
  espace: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    20: '80px',
  },
  rayon: {
    petit: '8px',
    moyen: '14px',
    grand: '22px',
    capsule: '999px',
  },
  trait: {
    filet: '1px',
    composant: '1.5px',
    focus: '3px',
    'focus-decalage': '3px',
  },
  // élévations sans flou: une surface plus claire, un liseré, une ombre pleine décalée
  elevation: {
    1: '0 0 0 1px #2A3060, 0 2px 0 0 #090B1B',
    2: '0 0 0 1px #3B4380, 0 4px 0 0 #070915',
    3: '0 0 0 1px #3B4380, 0 8px 0 0 #05060F',
  },
  icone: {
    taille: '24px',
    'taille-grande': '32px',
    'taille-petite': '20px',
    // épaisseur en unités de la grille de 24: 1,75 à 24 et 32 px, 1,8 à 20 px (1,5 px affiché)
    trait: '1.75',
    'trait-petite': '1.8',
  },
  duree: {
    rapide: '150ms',
    moyenne: '300ms',
    lente: '600ms',
    orbite: '4000ms',
    scintillement: '3600ms',
  },
  courbe: {
    standard: 'cubic-bezier(0.45, 0, 0.25, 1)',
    entree: 'cubic-bezier(0.2, 0, 0.2, 1)',
    sortie: 'cubic-bezier(0.45, 0, 0.85, 0.5)',
  },
  // boucles décoratives (orbite d'attente, scintillement): figées quand on réduit les animations
  boucles: {
    etat: 'running',
  },
};

// Variante appliquée par l'application quand la case « Réduire les animations » est cochée
// (au premier démarrage, la case suit le réglage du système, lu par prefers-reduced-motion).
const variantes = {
  'mouvement-reduit': {
    selecteur: ':root[data-mouvement="reduit"]',
    jetons: {
      duree: { rapide: '0ms', moyenne: '0ms', lente: '0ms', orbite: '0ms', scintillement: '0ms' },
      boucles: { etat: 'paused' },
    },
  },
};

// Profils de joueur: ordre du choix de couleur (E02, Réglages > Profil) et noms affichés.
// « tu passes en <symbole> », « Comète jade » pour les lecteurs d'écran.
const joueurs = [
  { id: 'astre', symbole: 'astre', nomSymbole: 'astre', nomCouleur: 'aqua', clarte: 'claire' },
  { id: 'croissant', symbole: 'croissant', nomSymbole: 'croissant', nomCouleur: 'mauve', clarte: 'soutenue' },
  { id: 'etoile', symbole: 'etoile', nomSymbole: 'étoile', nomCouleur: 'anis', clarte: 'claire' },
  { id: 'soleil', symbole: 'soleil', nomSymbole: 'soleil', nomCouleur: 'corail', clarte: 'moyenne' },
  { id: 'planete', symbole: 'planete', nomSymbole: 'planète', nomCouleur: 'rose', clarte: 'moyenne' },
  { id: 'comete', symbole: 'comete', nomSymbole: 'comète', nomCouleur: 'jade', clarte: 'moyenne' },
];

module.exports = { jetons, variantes, joueurs };
