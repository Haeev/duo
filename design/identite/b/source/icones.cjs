'use strict';
// Icônes d'interface de l'identité B: grille de 24, trait de 1,75 à bouts et jonctions ronds,
// un point plein en signature quand l'objet s'y prête. Aucune icône ne dépend de la couleur du fond
// (pas de forme « creusée » par une couleur de remplissage).
// Notation: chaînes SVG internes; `P(...)` marque un élément plein (fill currentColor, sans trait).
// Toute retouche se fait ici, puis `npm run formes`.

const P = (balise) => balise.replace(/^<(\w+)/, '<$1 data-plein');

const ICONES = {
  // actions principales et navigation
  heberger: [P('<circle cx="12" cy="12" r="2.4"/>'), '<path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"/>'],
  rejoindre: ['<circle cx="13.5" cy="13.5" r="7.5"/>', P('<circle cx="8.2" cy="8.2" r="2.6"/>'), '<path d="M2.5 5.2l2 2M5.2 2.5l2 2"/>'],
  bibliotheque: ['<circle cx="6.5" cy="6.5" r="2.2"/><circle cx="17.5" cy="6.5" r="2.2"/><circle cx="6.5" cy="17.5" r="2.2"/>', P('<circle cx="17.5" cy="17.5" r="2.4"/>'), '<path d="M8.7 6.5h6.6M6.5 8.7v6.6M17.5 8.7v6.4M8.7 17.5h6.4"/>'],
  historique: ['<path d="M19.5 12A7.5 7.5 0 1 1 12 4.5"/>', '<path d="M12 8.5V12l2.5 2"/>', P('<circle cx="12" cy="4.5" r="2"/>')],
  reglages: ['<path d="M4 8h2.4M11.6 8H20M4 16h8.4M17.6 16H20"/>', '<circle cx="9" cy="8" r="2.6"/><circle cx="15" cy="16" r="2.6"/>'],
  score: ['<path d="M12 3.8l2.17 5.81 6.2.27-4.85 3.86 1.65 5.98L12 16.3l-5.17 3.42 1.65-5.98-4.85-3.86 6.2-.27z"/>'],
  profil: ['<circle cx="12" cy="8.5" r="3.6"/>', '<path d="M5 20a7 7 0 0 1 14 0"/>'],
  retour: ['<path d="M14.5 5.5L8 12l6.5 6.5"/>'],
  fermer: ['<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'],
  'plein-ecran': ['<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'],
  // états (toujours avec un texte)
  pret: ['<path d="M5 12.5l4.5 4.5L19 7.5"/>'],
  succes: ['<circle cx="12" cy="12" r="9"/>', '<path d="M8 12.3l2.8 2.8L16.2 9.6"/>'],
  'pas-encore': ['<path d="M7 3.75h10M7 20.25h10M8.25 3.75v2.1c0 1.2.55 2.3 1.5 3.05L12 10.8l2.25-1.9c.95-.75 1.5-1.85 1.5-3.05v-2.1M8.25 20.25v-2.1c0-1.2.55-2.3 1.5-3.05L12 13.2l2.25 1.9c.95.75 1.5 1.85 1.5 3.05v2.1"/>', P('<circle cx="12" cy="18" r="1.3"/>')],
  alerte: ['<path d="M12 3.8L21 19.5H3z"/>', '<path d="M12 9.5v4.3"/>', P('<circle cx="12" cy="16.7" r="1.15"/>')],
  erreur: ['<circle cx="12" cy="12" r="9"/>', '<path d="M12 7.3v5.6"/>', P('<circle cx="12" cy="16.2" r="1.15"/>')],
  info: ['<circle cx="12" cy="12" r="9"/>', '<path d="M12 11v5.7"/>', P('<circle cx="12" cy="7.8" r="1.15"/>')],
  // partie
  pause: ['<path d="M9 5.5v13M15 5.5v13"/>'],
  reprendre: ['<path d="M8 5.2v13.6L19 12z"/>'],
  enregistrer: ['<path d="M7 3.75h10v16.5l-5-3.6-5 3.6z"/>', P('<circle cx="12" cy="9.2" r="1.7"/>')],
  secours: ['<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/>', '<path d="M4.5 3.9v3.6h3.6"/>', P('<circle cx="12" cy="12" r="1.8"/>')],
  supprimer: ['<path d="M4.5 7h15M9.5 7V4.75h5V7M6.8 7l.85 12.1c.06.9.8 1.6 1.7 1.6h5.3c.9 0 1.64-.7 1.7-1.6L17.2 7"/>'],
  cooperation: ['<ellipse cx="12" cy="12" rx="8.5" ry="4.5"/>', P('<circle cx="3.5" cy="12" r="2.2"/>'), P('<circle cx="20.5" cy="12" r="2.2"/>')],
  affrontement: [P('<circle cx="4.5" cy="12" r="2.4"/>'), P('<circle cx="19.5" cy="12" r="2.4"/>'), '<path d="M12 7.5v9M8.4 9.6l7.2 4.8M15.6 9.6l-7.2 4.8"/>'],
  nouveau: ['<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/>', P('<circle cx="19" cy="19" r="1.6"/>')],
  telecharger: ['<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>'],
  // réglages et réseau
  son: ['<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/>', '<path d="M15.5 9a4 4 0 0 1 0 6M18.2 6.5a7.6 7.6 0 0 1 0 11"/>'],
  clavier: ['<rect x="3" y="6.5" width="18" height="11" rx="2.5"/>', P('<circle cx="7" cy="10.2" r="0.95"/><circle cx="10.33" cy="10.2" r="0.95"/><circle cx="13.67" cy="10.2" r="0.95"/><circle cx="17" cy="10.2" r="0.95"/>'), '<path d="M8 14h8"/>'],
  affichage: ['<rect x="3" y="4.5" width="18" height="12" rx="2"/>', '<path d="M9 20h6M12 16.5V20"/>'],
  ordinateur: ['<rect x="5" y="5" width="14" height="10" rx="1.6"/>', '<path d="M3 18.5h18"/>'],
  reseau: [P('<circle cx="4.5" cy="12" r="2.2"/>'), P('<circle cx="19.5" cy="12" r="2.2"/>'), '<path d="M8 9.2a6.2 6.2 0 0 1 8 0M8 14.8a6.2 6.2 0 0 0 8 0"/>'],
  // touches absentes des deux polices (⌘ et flèches): dessinées
  'touche-cmd': ['<path d="M9 9V6.5a2.5 2.5 0 1 0-2.5 2.5h11a2.5 2.5 0 1 0-2.5-2.5v11a2.5 2.5 0 1 0 2.5-2.5h-11a2.5 2.5 0 1 0 2.5 2.5z"/>'],
  'fleche-gauche': ['<path d="M19 12H5M10.5 6.5L5 12l5.5 5.5"/>'],
  'fleche-droite': ['<path d="M5 12h14M13.5 6.5L19 12l-5.5 5.5"/>'],
  'fleche-haut': ['<path d="M12 19V5M6.5 10.5L12 5l5.5 5.5"/>'],
  'fleche-bas': ['<path d="M12 5v14M6.5 13.5L12 19l5.5-5.5"/>'],
};

module.exports = { ICONES };
