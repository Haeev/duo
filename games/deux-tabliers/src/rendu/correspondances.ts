/**
 * Modèle livré (`assets/modeles/<nom>.glb`) de chaque meuble et objet des données du cœur.
 * `null`: l'élément fait partie de la coque cuite (`shell_village.glb`: comptoir, arrière-comptoir,
 * frigo sous le plan) ou d'un autre modèle (groupes et buse de la machine): rien à poser, il reste
 * visable par les règles. Absent de la table: le modèle des données, sinon un substitut.
 */
export const FURNITURE_MODEL: Readonly<Record<string, string | null>> = {
  comptoir: null,
  'arriere-comptoir': null,
  'frigo-sous-plan': null,
  passe: null,
  'groupe-espresso': null,
  'buse-vapeur': null,
  'machine-espresso': 'station_espresso_2g',
  moulin: 'station_grinder',
  'moulin-dose': 'moulin_dose',
  caisse: 'station_caisse',
  plonge: 'station_sink',
  'lave-vaisselle': 'station_dishwasher',
  'pile-tasses': 'station_cup_shelf',
  'rail-tickets': 'station_ticket_rail',
  vitrine: 'station_vitrine',
  bouilloire: 'station_bouilloire',
  'bouilloire-temperature': 'bouilloire_temperature',
  crepiere: 'creperie',
  'caisses-patronne': 'crate_box_m',
  gueridon: 'gueridon_marbre',
  'table-carree': 'table_bistrot_quatre',
  chaise: 'chaise_paillee',
  banc: 'banc_ferme',
  'ardoise-trottoir': 'ardoise_trottoir',
};

export const OBJECT_MODEL: Readonly<Record<string, string>> = {
  tasse: 'ware_cup_cappuccino',
  'tasse-sale': 'ware_cup_cappuccino',
  'tasse-espresso': 'ware_cup_espresso',
  'tasse-cafe': 'ware_cup_espresso',
  espresso: 'ware_cup_espresso',
  allonge: 'ware_cup_espresso',
  noisette: 'ware_cup_espresso',
  creme: 'ware_cup_cappuccino',
  cappuccino: 'ware_cup_cappuccino',
  chocolat: 'ware_cup_cappuccino',
  'the-noir': 'ware_teapot',
  'the-vert': 'ware_teapot',
  infusion: 'ware_teapot',
  plateau: 'ware_tray',
  verre: 'ware_glass',
  'verre-sale': 'ware_glass',
  citronnade: 'ware_glass',
  'jus-orange': 'ware_glass',
  limonade: 'ware_glass',
  assiette: 'ware_plate',
  'assiette-sale': 'ware_plate',
  croissant: 'food_croissant',
  'pain-chocolat': 'food_pain_chocolat',
  tartine: 'food_tartine',
  'tarte-fruits': 'food_tarte_fruits',
  crepe: 'food_crepe',
  carton: 'crate_box_s',
  'carton-lourd': 'crate_box_m',
};

/** Avatars des joueurs: l'hôte, puis l'invité. */
export const AVATAR_MODEL = ['char_avatar_1', 'char_avatar_2'] as const;
