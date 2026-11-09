'use strict';
// Palette de Cosy Café: source unique des couleurs de la bible artistique (docs/jeux/cosy-cafe/bible-artistique.md).
// Valeurs sRGB. Identifiants en anglais (règle du studio), noms et rôles en français.
// « bande » sert aux contrôles de mesurer.cjs (structure des valeurs, section 3 de la bible):
//   jeu       objets qui se prennent ou se servent (clairs) et leurs contenus sombres
//   travail   surfaces où l'on pose les objets de jeu (moyennes à sombres)
//   decor     murs, sols, meubles, à hauteur de travail ou derrière les objets
//   haut      décor au-dessus de la bande de travail (plafonds, moulures, abat-jour): peut être plus clair
//   dehors    rue vue par les vitrines (jamais à portée de main)
//   lumiere   couleurs de lumière et d'émission (pas des matières)
//   tenue     vêtements des clients, des employés et des habitués
//   clair, sombre  hauts des avatars des joueurs
//   maison    couleurs de la maison (tabliers des employés, store, enseigne, liseré des tasses)
//   touche    petites touches vives du décor (fleurs, fruits): moins de 2 % de l'image
//   ui        interface (HUD et interfaces dans le monde)

const c = (id, hex, fr, bande, role) => ({ id, hex, fr, bande, role });

const common = [
  // objets de jeu: ce qui se prend, se sert, se lit
  c('porcelain', '#F5F0E6', 'porcelaine', 'jeu', 'tasses, soucoupes, assiettes, théières'),
  c('paper', '#FBF6EA', 'papier', 'jeu', 'tickets, cartes de menu, étiquettes, sacs de pâtisserie'),
  c('milk', '#FAF4EA', 'lait et mousse', 'jeu', 'mousse de lait, crème fouettée, lait versé'),
  c('ink', '#2B2622', 'encre', 'jeu', 'écriture des tickets et du livre d\'or, pictogrammes'),
  c('espresso', '#3B2318', 'café', 'jeu', 'café dans la tasse, grains torréfiés, marc'),
  c('crema', '#B57844', 'crème du café', 'jeu', 'surface d\'un expresso, café au lait'),
  c('chocolate', '#5A3426', 'chocolat', 'jeu', 'chocolat chaud, gâteau au chocolat'),
  c('tea', '#A65A2C', 'thé infusé', 'jeu', 'thé dans la tasse ou la théière en verre'),
  c('crust', '#C68845', 'croûte dorée', 'jeu', 'viennoiseries, tartes, pain'),
  c('crumb', '#EBD5A2', 'mie et pâte', 'jeu', 'mie, crème pâtissière, pâte crue'),
  c('berry', '#9E3647', 'fruits rouges', 'touche', 'tartes, confitures, coulis'),
  c('citrus', '#E5AE38', 'agrumes', 'touche', 'citrons, jus d\'orange (petites surfaces)'),
  c('kraft', '#B48C5E', 'kraft', 'jeu', 'sacs de grains, gobelets à emporter, cartons (avec étiquette papier)'),
  // surfaces de travail: là où les objets de jeu se posent
  c('walnut', '#5E4130', 'noyer', 'travail', 'dessus de comptoir, plateaux, tablettes'),
  c('oak_dark', '#7A5A3E', 'chêne foncé', 'travail', 'tables, étagères à tasses, plan de travail'),
  c('slate', '#343938', 'ardoise', 'travail', 'ardoises, dessous de plats, plan de dégustation'),
  c('zinc', '#858C91', 'zinc', 'travail', 'comptoir de bistrot, égouttoir, plan inox'),
  c('marble_dark', '#4F5A55', 'marbre vert-gris', 'travail', 'guéridons et plateaux de marbre (jamais blanc)'),
  c('tray', '#4A3A31', 'plateau', 'travail', 'plateaux de service, planches'),
  // matières communes du décor
  c('oak_honey', '#B3834F', 'chêne miel', 'decor', 'meubles, huisseries, parquet clair'),
  c('plaster', '#D5C4A5', 'enduit crème', 'decor', 'murs (jamais au-dessus de L* 82)'),
  c('linen', '#CBBEA6', 'lin', 'decor', 'coussins, rideaux, nappes (jamais blanc)'),
  c('leaf', '#5D7D47', 'feuillage', 'decor', 'plantes d\'intérieur'),
  c('leaf_light', '#8A9C5E', 'feuillage clair', 'decor', 'jeunes pousses, herbes aromatiques'),
  c('pot', '#A5603F', 'terre cuite', 'decor', 'pots de fleurs, tomettes, céramiques'),
  c('copper', '#A2643D', 'cuivre', 'decor', 'machine à expresso, casseroles, torréfacteur'),
  c('brass', '#C2A05A', 'laiton', 'decor', 'robinets, rampes, pieds de lampe, poignées'),
  c('steel', '#A3A8AC', 'inox', 'decor', 'machines, éviers, réfrigérateurs'),
  c('steel_dark', '#4C5156', 'acier sombre', 'decor', 'pieds de tabourets, porte-filtres, grilles'),
  c('glass', '#C9D6D3', 'verre', 'jeu', 'verres, carafes, vitrines à gâteaux'),
  c('glass_tint', '#DCE6E4', 'voile des vitres', 'jeu', 'voile des vitres de la coque, à 12 à 18 % (reflet peint)'),
  c('shadow_contact', '#2A1E18', 'ombre de contact', 'decor', 'décalques sous les meubles et les personnages (multiplication)'),
  // lumière
  c('lamp_warm', '#FFC27A', 'lampe chaude', 'lumiere', 'ampoules et lampes (2 700 K environ)'),
  c('lamp_shade', '#FFE0B0', 'abat-jour allumé', 'lumiere', 'émission des abat-jour et des globes'),
  c('sun_patch', '#FFD9A0', 'tache de soleil', 'lumiere', 'soleil à travers les vitres, fin d\'après-midi'),
  // alerte douce: jamais seule, toujours avec son pictogramme (sablier, thermomètre)
  c('alert', '#E0A030', 'ambre', 'ui', 'alerte douce: ticket qui attend, lait trop chaud, stock bas'),
  c('alert_ink', '#5A3A10', 'ambre foncé', 'ui', 'pictogramme posé sur l\'ambre'),
];

// saisons de la rue (décor de fond et plantes extérieures seulement)
const seasons = [
  c('season_autumn_leaf', '#A86F3E', 'feuillage d\'automne', 'dehors', 'arbres d\'alignement et feuilles au sol en automne'),
  c('season_autumn_ochre', '#C08A4A', 'feuillage ocre', 'dehors', 'second ton d\'automne'),
  c('season_snow', '#EEF1F3', 'neige', 'dehors', 'toits, chaussée et rebords en hiver'),
];

// hauts des avatars: deux familles de clarté (section 7.1 de la bible)
const topsLight = [
  c('top_light_cream', '#EEE6D6', 'crème', 'clair', 'haut clair'),
  c('top_light_sky', '#DDE6EC', 'ciel pâle', 'clair', 'haut clair'),
  c('top_light_rose', '#EEDCD6', 'rose pâle', 'clair', 'haut clair'),
  c('top_light_sage', '#DDE6D4', 'sauge pâle', 'clair', 'haut clair'),
];
const topsDark = [
  c('top_dark_indigo', '#2B2F45', 'indigo', 'sombre', 'haut sombre'),
  c('top_dark_wine', '#43262D', 'lie-de-vin', 'sombre', 'haut sombre'),
  c('top_dark_bottle', '#23372E', 'vert bouteille', 'sombre', 'haut sombre'),
  c('top_dark_coffee', '#3A2C25', 'brun expresso', 'sombre', 'haut sombre'),
];
const playerPiping = c('player_piping', '#1C1A26', 'liseré sombre', 'jeu', 'bord des bretelles, de l\'écusson et du foulard des joueurs');
const playerOn = c('player_on', '#0E1126', 'nuit de Duo', 'jeu', 'symbole posé sur la couleur du joueur (jeton --player-on)');

const skins = ['#F2D3BC', '#E4B897', '#CC9871', '#AD7852', '#87583A', '#5C3C29'];
const hair = ['#2B2320', '#4A3324', '#6E4A30', '#A3663A', '#CDAA6E', '#B9B4AE', '#E0DCD4'];

// couleurs de la maison: choisies par le duo (tabliers des employés, store, enseigne, liseré des tasses, livre d'or)
const house = [
  c('house_bordeaux', '#6E2E35', 'bordeaux', 'maison', ''),
  c('house_bottle', '#2F4F3E', 'vert bouteille', 'maison', ''),
  c('house_duck', '#2F5560', 'bleu canard', 'maison', ''),
  c('house_navy', '#313D5B', 'bleu nuit', 'maison', ''),
  c('house_terracotta', '#934B33', 'terre de Sienne', 'maison', ''),
  c('house_mustard', '#94742A', 'moutarde', 'maison', ''),
  c('house_plum', '#5A3450', 'prune', 'maison', ''),
  c('house_olive', '#5E6234', 'olive', 'maison', ''),
];

// tenues des profils de clients: L* de 28 à 76, chroma modéré, jamais une couleur de joueur
const profiles = {
  presses: { fr: 'les pressés', colors: [c('presses_coat', '#A6927A', 'manteau mastic', 'tenue', ''), c('presses_charcoal', '#4E5258', 'anthracite', 'tenue', ''), c('presses_navy', '#3E4A66', 'marine', 'tenue', ''), c('presses_bag', '#8A5A38', 'sacoche cognac', 'tenue', 'accessoire')] },
  flaneurs: { fr: 'les flâneurs', colors: [c('flaneurs_scarf', '#B39656', 'écharpe moutarde douce', 'tenue', ''), c('flaneurs_cord', '#7A5A44', 'velours brun', 'tenue', ''), c('flaneurs_knit', '#707A86', 'pull gris bleuté', 'tenue', ''), c('flaneurs_paper', '#D9D0BE', 'journal', 'tenue', 'accessoire')] },
  familles: { fr: 'les familles', colors: [c('familles_raincoat', '#BE9F55', 'ciré moutarde', 'tenue', ''), c('familles_tomato', '#B0574D', 'rouge tomate doux', 'tenue', ''), c('familles_sky', '#7E9CC0', 'bleu ciel moyen', 'tenue', ''), c('familles_apple', '#97A866', 'vert pomme doux', 'tenue', '')] },
  gourmands: { fr: 'les gourmands', colors: [c('gourmands_raspberry', '#9E4E63', 'framboise douce', 'tenue', ''), c('gourmands_caramel', '#AF7A4D', 'caramel', 'tenue', ''), c('gourmands_cream', '#C9B897', 'crème pâtissière', 'tenue', ''), c('gourmands_box', '#C9A8A0', 'boîte à gâteaux', 'tenue', 'accessoire')] },
  promeneurs: { fr: 'les promeneurs', colors: [c('promeneurs_forest', '#3F5E4A', 'vert forêt', 'tenue', ''), c('promeneurs_rust', '#A15A3B', 'sac rouille', 'tenue', ''), c('promeneurs_beige', '#C9B794', 'casquette beige', 'tenue', ''), c('promeneurs_khaki', '#8A8463', 'kaki', 'tenue', '')] },
  etudiants: { fr: 'les étudiants', colors: [c('etudiants_burgundy', '#6E3238', 'sweat bordeaux', 'tenue', ''), c('etudiants_denim', '#4D5F7D', 'jean', 'tenue', ''), c('etudiants_canvas', '#B3A887', 'toile kaki clair', 'tenue', ''), c('etudiants_headset', '#2E2E33', 'casque audio', 'tenue', 'accessoire')] },
  teletravail: { fr: 'les télétravailleurs', colors: [c('teletravail_grey', '#8E8B86', 'gris chiné', 'tenue', ''), c('teletravail_shirt', '#A6B6C8', 'chemise bleu pâle', 'tenue', ''), c('teletravail_laptop', '#6F7379', 'ordinateur', 'tenue', ''), c('teletravail_bag', '#34343A', 'sacoche noire', 'tenue', 'accessoire')] },
  brunch: { fr: 'les bruncheurs', colors: [c('brunch_linen', '#CF9A80', 'lin terracotta clair', 'tenue', ''), c('brunch_sage', '#8E9F7B', 'robe sauge', 'tenue', ''), c('brunch_denim', '#5B6E86', 'veste en jean', 'tenue', ''), c('brunch_shades', '#2A2A2E', 'lunettes de soleil', 'tenue', 'accessoire')] },
  connaisseurs: { fr: 'les connaisseurs', colors: [c('connaisseurs_roll', '#414449', 'col roulé anthracite', 'tenue', ''), c('connaisseurs_cord', '#6E6A45', 'velours olive', 'tenue', ''), c('connaisseurs_notebook', '#6B4430', 'carnet de cuir', 'tenue', 'accessoire'), c('connaisseurs_tote', '#B48F60', 'sac kraft', 'tenue', 'accessoire')] },
};
// chemises neutres des employés, sous le tablier à la couleur de la maison
const staffShirts = [
  c('staff_chambray', '#93A3B5', 'chambray', 'tenue', ''),
  c('staff_linen', '#C2B39A', 'lin naturel', 'tenue', ''),
  c('staff_stone', '#9C978C', 'gris pierre', 'tenue', ''),
  c('staff_pastry', '#C6B9A0', 'veste de pâtisserie lin', 'tenue', 'jamais blanche: reste sous L* 76'),
];

const addresses = {
  village: {
    fr: 'Village: le café de la place',
    accent: '#8DA287',
    interior: [
      c('village_lime', '#D5C4A5', 'chaux crème', 'decor', 'murs'),
      c('village_beam', '#6B4B35', 'poutres de chêne', 'haut', 'solives et poutre maîtresse'),
      c('village_ceiling', '#C7B597', 'plafond entre solives', 'haut', 'plafond'),
      c('village_tomette', '#A65A3E', 'tomettes', 'decor', 'sol de la salle'),
      c('village_tomette_joint', '#C8B393', 'joints', 'decor', 'joints des tomettes'),
      c('village_counter', '#7E937B', 'bois peint sauge', 'decor', 'façade du comptoir, buffet'),
      c('village_shelf', '#8B6544', 'chêne ciré', 'decor', 'étagères et vaisselier'),
      c('village_backbar', '#4A5249', 'carreaux vert sombre', 'travail', 'mur derrière le comptoir (fond des tasses rangées)'),
    ],
    exterior: [
      c('village_stone', '#CDB892', 'pierre blonde', 'dehors', 'façades de la place'),
      c('village_stone_shade', '#A8946F', 'pierre à l\'ombre', 'dehors', 'soubassements, encadrements'),
      c('village_shutter', '#7F979B', 'volets gris-bleu', 'dehors', 'volets et portes'),
      c('village_roof', '#A9674A', 'tuiles', 'dehors', 'toits'),
      c('village_tree', '#6E8A4C', 'tilleul', 'dehors', 'feuillage du tilleul de la place (été)'),
      c('village_bark', '#9E9580', 'écorce du tilleul', 'dehors', 'tronc'),
      c('village_paving', '#A49B8A', 'pavés de la place', 'dehors', 'sol de la place'),
      c('village_water', '#7FA0A6', 'eau de la fontaine', 'dehors', 'fontaine'),
    ],
  },
  bourg: {
    fr: 'Bourg: la boutique de la grand-rue',
    accent: '#C69A4A',
    interior: [
      c('bourg_parquet', '#97683F', 'parquet de chêne', 'decor', 'sol'),
      c('bourg_wall', '#D2BC97', 'enduit ocre pâle', 'decor', 'murs'),
      c('bourg_panelling', '#5B6B62', 'lambris vert-de-gris', 'decor', 'soubassements, comptoir, arrière-salle'),
      c('bourg_moulding', '#E3D6BF', 'moulures', 'haut', 'corniches, plafond'),
      c('bourg_kitchen_tile', '#A9BDB1', 'faïence vert d\'eau', 'decor', 'cuisine, autour du four'),
      c('bourg_oven', '#3F3A36', 'fonte du four', 'travail', 'four à sole et sa porte'),
    ],
    exterior: [
      c('bourg_shopfront', '#2F4F55', 'devanture bleu-vert', 'dehors', 'devanture en bois peint'),
      c('bourg_render_ochre', '#D5AE78', 'enduit ocre', 'dehors', 'façades de la grand-rue'),
      c('bourg_render_rose', '#D6A794', 'enduit rose', 'dehors', 'façades de la grand-rue'),
      c('bourg_cobble', '#8E877B', 'pavés', 'dehors', 'grand-rue'),
      c('bourg_hall_timber', '#7A5538', 'charpente de la halle', 'dehors', 'halle'),
      c('bourg_hall_roof', '#9C5E45', 'tuiles de la halle', 'dehors', 'halle'),
      c('bourg_awning', '#B7A27E', 'toile des étals', 'dehors', 'jour de marché'),
    ],
  },
  ville: {
    fr: 'Ville: l\'ancien atelier',
    accent: '#5B7489',
    interior: [
      c('ville_brick', '#985842', 'brique', 'decor', 'murs porteurs'),
      c('ville_mortar', '#C4B49C', 'joints de brique', 'decor', 'joints'),
      c('ville_steel', '#3D4346', 'acier noirci', 'decor', 'poteaux, menuiseries, verrière'),
      c('ville_concrete', '#A29D94', 'béton ciré', 'decor', 'sol'),
      c('ville_wood', '#A6825E', 'bois brut', 'decor', 'comptoir, étagères, tables d\'atelier'),
      c('ville_paint', '#CFC9BD', 'blanc d\'atelier', 'haut', 'sheds, plafond'),
    ],
    exterior: [
      c('ville_facade_brick', '#A5684F', 'brique des façades', 'dehors', 'rue de l\'université'),
      c('ville_facade_render', '#CEC4B2', 'enduit clair', 'dehors', 'immeubles'),
      c('ville_tram', '#3E6B7A', 'tramway', 'dehors', 'livrée inventée, bleu pétrole et crème'),
      c('ville_asphalt', '#5D5E60', 'chaussée', 'dehors', 'rue'),
      c('ville_sidewalk', '#A8A39A', 'trottoir', 'dehors', 'trottoirs'),
      c('ville_tree', '#5F7F4A', 'tilleuls', 'dehors', 'arbres d\'alignement'),
    ],
  },
  'paris-quartier': {
    fr: 'Paris, quartier: le café d\'angle',
    accent: '#2F4A3C',
    interior: [
      c('pq_mosaic', '#CDBDA0', 'mosaïque crème', 'decor', 'sol'),
      c('pq_mosaic_motif', '#7A4034', 'mosaïque brique', 'decor', 'frise du sol'),
      c('pq_woodwork', '#4E3A2D', 'boiseries sombres', 'travail', 'arrière-bar, lambris'),
      c('pq_ceiling', '#E2D5BB', 'plafond mouluré', 'haut', 'plafond'),
      c('pq_mirror', '#8E9A9C', 'miroir peint', 'decor', 'miroirs (reflet peint, jamais réel)'),
      c('pq_banquette', '#6E2E35', 'moleskine', 'decor', 'banquettes (couleur de la maison par défaut)'),
    ],
    exterior: [
      c('pq_stone', '#DBCBAE', 'pierre de taille', 'dehors', 'immeubles en face'),
      c('pq_stone_shade', '#B9A688', 'pierre à l\'ombre', 'dehors', 'corniches, soubassements'),
      c('pq_roof', '#8A949B', 'toits de zinc', 'dehors', 'toits, lucarnes'),
      c('pq_ironwork', '#2B3230', 'fer forgé', 'dehors', 'balcons filants, potelets'),
      c('pq_asphalt', '#545659', 'chaussée', 'dehors', 'rue'),
      c('pq_sidewalk', '#A8A297', 'trottoir', 'dehors', 'trottoir, terrasse'),
      c('pq_plane', '#708D50', 'platanes', 'dehors', 'arbres d\'alignement'),
      c('pq_kiosk', '#3E5B4A', 'kiosque', 'dehors', 'kiosque à journaux inventé'),
    ],
  },
  'paris-maison': {
    fr: 'Paris, la maison: sous la verrière',
    accent: '#C2A05A',
    interior: [
      c('pm_iron', '#5E7A71', 'fer peint vert-de-gris', 'decor', 'structure de la verrière, garde-corps de la mezzanine'),
      c('pm_parquet', '#8A5A38', 'parquet en point de Hongrie', 'decor', 'sol'),
      c('pm_wall', '#D3C2A3', 'stuc clair', 'decor', 'murs'),
      c('pm_roaster', '#2F3E3A', 'émail vert sombre', 'travail', 'torréfacteur, grands meubles'),
      c('pm_lab_tile', '#C1CAC2', 'faïence du laboratoire', 'decor', 'laboratoire de pâtisserie (derrière la vitre)'),
      c('pm_stair', '#6F4A33', 'noyer des marches', 'decor', 'escalier, rampe'),
    ],
    exterior: [
      c('pm_sky_glass', '#BCCBD0', 'ciel à travers la verrière', 'dehors', 'verrière (teinte du moment)'),
      c('pm_gallery_wood', '#5A3F2E', 'devantures de la galerie', 'dehors', 'boutiques voisines'),
      c('pm_gallery_stone', '#D9CCB2', 'pierre de la galerie', 'dehors', 'piliers, arcades'),
      c('pm_gallery_floor', '#B8AA90', 'dallage de la galerie', 'dehors', 'sol de la galerie'),
    ],
  },
};

// moments: lumière du soleil (absent: null), ciel (haut, horizon), part de lumière des lampes (0 à 1), teinte de la rue
const moments = {
  morning: { fr: 'matin', heures: '7 h à 10 h', sun: '#FFD9AE', sunElevation: 18, sky: ['#B9D3E8', '#EAD9C4'], lamps: 0.6, ambient: 0.8, street: '#E6EEF2', mood: 'frais et calme: longues taches de soleil basses, lampes encore allumées, rue bleutée' },
  noon: { fr: 'midi', heures: '11 h à 14 h', sun: '#FFF3DE', sunElevation: 58, sky: ['#A9CBE6', '#DCE8F0'], lamps: 0.25, ambient: 1.0, street: '#FFFFFF', mood: 'net et clair: lumière du jour partout, taches de soleil courtes près des vitres' },
  afternoon: { fr: 'fin d\'après-midi', heures: '15 h à 18 h', sun: '#FFC788', sunElevation: 16, sky: ['#C9C9D6', '#F5D3A8'], lamps: 0.5, ambient: 0.85, street: '#FFE7C8', mood: 'doré: le soleil rase les tables, les ombres s\'allongent, c\'est le moment signature' },
  evening: { fr: 'soir', heures: 'fermeture', sun: null, sunElevation: 0, sky: ['#26304F', '#55607F'], lamps: 1.0, ambient: 0.35, street: '#6F7FA8', mood: 'heure bleue: dedans chaud, dehors bleu, fenêtres allumées en face' },
  rain: { fr: 'pluie', heures: 'toute la journée', sun: null, sunElevation: 0, sky: ['#8E9AA4', '#B7C0C6'], lamps: 0.8, ambient: 0.6, street: '#AEB8C2', mood: 'abri: gouttes sur la vitre, rue mouillée et foncée, lampes allumées en plein jour' },
  winter: { fr: 'hiver', heures: 'journées courtes', sun: '#FFE8CC', sunElevation: 12, sky: ['#C3CFDA', '#E7EBEE'], lamps: 0.8, ambient: 0.75, street: '#EEF3F7', mood: 'foyer: neige dehors, buée aux coins des vitres, vapeur plus visible, lumière pâle et basse' },
};

const styles = {
  campagne: {
    fr: 'campagne',
    colors: [c('campagne_oak', '#B3834F', 'chêne miel', 'decor', ''), c('campagne_linen', '#D4C7AE', 'lin écru', 'decor', ''), c('campagne_clay', '#A65A3D', 'terre cuite', 'decor', ''), c('campagne_sage', '#8C9F84', 'sauge', 'decor', ''), c('campagne_faience', '#93A9BC', 'bleu faïence', 'decor', ''), c('campagne_straw', '#C9AE76', 'paille', 'decor', '')],
  },
  bistrot: {
    fr: 'bistrot',
    colors: [c('bistrot_moleskine', '#6B2E33', 'moleskine bordeaux', 'decor', ''), c('bistrot_wood', '#4F3426', 'bois foncé', 'travail', ''), c('bistrot_brass', '#C2A05A', 'laiton', 'decor', ''), c('bistrot_zinc', '#858C91', 'zinc', 'travail', ''), c('bistrot_tile_dark', '#2E2C2B', 'carreau noir', 'decor', ''), c('bistrot_tile_light', '#D3C7B0', 'carreau crème', 'decor', ''), c('bistrot_marble', '#4F5A55', 'marbre vert-gris', 'travail', '')],
  },
  nordique: {
    fr: 'nordique',
    colors: [c('nordique_ash', '#C4A77E', 'frêne miel', 'decor', ''), c('nordique_white', '#DDD6C9', 'blanc cassé', 'haut', ''), c('nordique_wool', '#A7A39C', 'laine grise', 'decor', ''), c('nordique_blue', '#97A9B5', 'bleu gris', 'decor', ''), c('nordique_rose', '#C9AAA0', 'rose poudré', 'decor', ''), c('nordique_fir', '#4E6656', 'vert sapin', 'decor', '')],
  },
  jardin: {
    fr: 'jardin',
    colors: [c('jardin_rattan', '#C9A26C', 'rotin', 'decor', ''), c('jardin_leaf', '#5D7D47', 'vert feuille', 'decor', ''), c('jardin_water', '#A9BDB1', 'vert d\'eau', 'decor', ''), c('jardin_pot', '#A5603F', 'terre cuite', 'decor', ''), c('jardin_iron', '#3E5A4C', 'fer peint vert', 'travail', ''), c('jardin_tile', '#C9B79A', 'carreau de ciment', 'decor', '')],
  },
  atelier: {
    fr: 'atelier',
    colors: [c('atelier_steel', '#3D4346', 'acier', 'decor', ''), c('atelier_brick', '#985842', 'brique', 'decor', ''), c('atelier_wood', '#A6825E', 'bois brut', 'decor', ''), c('atelier_concrete', '#A29D94', 'béton', 'decor', ''), c('atelier_leather', '#7A4E33', 'cuir', 'decor', ''), c('atelier_workblue', '#4F6A8A', 'bleu de travail', 'decor', '')],
  },
  retro: {
    fr: 'rétro',
    colors: [c('retro_teak', '#93603A', 'teck', 'decor', ''), c('retro_mustard', '#BC9E52', 'formica moutarde', 'decor', ''), c('retro_orange', '#A8693A', 'orange brûlé', 'decor', ''), c('retro_brown', '#5B3B2A', 'brun chocolat', 'travail', ''), c('retro_cream', '#E3D6BA', 'crème', 'haut', ''), c('retro_olive', '#7D7F45', 'vert olive', 'decor', ''), c('retro_petrol', '#3F6670', 'bleu pétrole', 'decor', '')],
  },
};

// interface: HUD du jeu (formes, polices et règles de Duo, teintes chaudes) et interfaces dans le monde
const ui = [
  c('hud_bg', '#2B211C', 'expresso', 'ui', 'fond opaque des capsules et panneaux du HUD'),
  c('hud_line', '#5C4A3E', 'filet', 'ui', 'liseré d\'un pixel des capsules'),
  c('hud_text', '#F6EEDF', 'crème', 'ui', 'texte principal du HUD'),
  c('hud_text_muted', '#CDBBA6', 'crème second', 'ui', 'aides, libellés de touches'),
  c('hud_accent', '#FFC857', 'or de Duo', 'ui', 'action principale (une par écran), jeton --color-accent'),
  c('hud_success', '#6BD69A', 'vert d\'eau de Duo', 'ui', 'succès, toujours avec son icône'),
  c('hud_error', '#FF6B81', 'rouge rosé de Duo', 'ui', 'erreur technique seulement (jamais pour le jeu), avec son icône'),
  c('chalk', '#F1EDE3', 'craie', 'ui', 'écriture sur l\'ardoise'),
  c('chalk_color', '#E9C98A', 'craie jaune', 'ui', 'prix et titres sur l\'ardoise'),
  c('slate_board', '#2F3634', 'ardoise', 'ui', 'ardoise murale et ardoise de trottoir'),
  c('guestbook_page', '#F2E8D2', 'papier du livre d\'or', 'ui', 'pages du livre d\'or'),
  c('ticket_rail', '#8E9499', 'rail à tickets', 'ui', 'rail en inox au-dessus du passe'),
];

module.exports = { common, seasons, topsLight, topsDark, playerPiping, playerOn, skins, hair, house, profiles, staffShirts, addresses, moments, styles, ui };
