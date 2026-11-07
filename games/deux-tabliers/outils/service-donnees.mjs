// Convertit les données de la démo du game designer (docs/jeux/cosy-cafe/demo/donnees/) au
// schéma du jeu (donnees/SCHEMA.md, section « Service »), et tient à jour les objets, meubles et
// postes du service dans les fichiers communs (remplacés par identifiant, le reste intact).
// Relançable sans risque: node games/deux-tabliers/outils/service-donnees.mjs
// puis npx prettier --write games/deux-tabliers/donnees
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const game = join(here, '..');
const demo = join(game, '..', '..', 'docs', 'jeux', 'cosy-cafe', 'demo', 'donnees');
const out = join(game, 'donnees');

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const write = (path, data) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
};
/** Identifiants du game designer (snake_case) vers ceux du jeu (traits d'union). */
const id = (s) => s.replaceAll('_', '-');

const recipesFile = read(join(demo, 'recettes.json'));
const ingredientsFile = read(join(demo, 'ingredients-fournisseurs.json'));
const equipmentFile = read(join(demo, 'postes-equipements.json'));

// Vaisselle par famille: boissons chaudes en tasse, froides en verre, le reste à l'assiette.
const VESSEL = {
  black_coffee: 'tasse',
  milk_coffee: 'tasse',
  tea: 'tasse',
  chocolate: 'tasse',
  cold_drink: 'verre',
  pastry_bread: 'assiette',
  cake: 'assiette',
};
const COLOR = {
  black_coffee: '#4a2a14',
  milk_coffee: '#c89a64',
  tea: '#b5651d',
  chocolate: '#5a3320',
  cold_drink: '#f3d36b',
  pastry_bread: '#d9a441',
  cake: '#c0504d',
};
// Température de l'eau du thé (CO-05): vert à 80 °C, noir et infusions à 95 °C.
const TEA_TARGET = { the_vert: 80 };

const recipes = recipesFile.recipes.map((r) => ({
  id: id(r.id),
  label: r.name,
  family: id(r.family),
  price: r.basePrice,
  cost: r.costMaterials,
  vessel: VESSEL[r.family],
  dishes: r.dishes,
  ingredients: r.ingredients.map((i) => ({ id: id(i.id), qty: i.qty })),
  steps: r.steps.map((s) => ({
    station: s.station,
    activeSeconds: s.activeSeconds,
    passiveSeconds: s.passiveSeconds,
    finishSeconds: s.finishSeconds,
    ...(s.station === 'bouilloire' ? { waterC: TEA_TARGET[r.id] ?? 95 } : {}),
  })),
  unlock:
    r.unlock.kind === 'purchase'
      ? { kind: 'purchase', item: id(r.unlock.item) }
      : r.unlock.kind === 'regular'
        ? { kind: 'regular', regular: id(r.unlock.regular), level: r.unlock.level }
        : { kind: 'start' },
  options: r.options.map(id),
}));

const ingredients = ingredientsFile.ingredients.map((i) => ({
  id: id(i.id),
  label: i.name,
  unit: i.unit,
  unitCost: i.unitCost,
  supplier: id(i.supplier),
  storage: i.storage,
  shelfDays: i.shelfDays,
  cartonUnits: i.cartonUnits,
  heavy: i.cartonHeavy,
}));

// Équipements du service: effets du game designer découpés, et meuble posé s'il y en a un.
const FURNITURE_OF = {
  moulin_dose: 'moulin-dose',
  presse_levier: 'presse-agrumes',
  creperie: 'crepiere',
  bouilloire_temperature: 'bouilloire-temperature',
  lave_vaisselle: 'lave-vaisselle',
};
const effects = (text) =>
  text.split(';').map((e) => {
    const [kind, a, b] = e.split(':');
    if (kind === 'poste') return { kind: 'station-level', station: a, level: Number(b) };
    if (kind === 'recette') return { kind: 'recipe', recipe: id(a) };
    if (kind === 'vaisselle') return { kind: 'dishes', count: Number(a) };
    if (kind === 'equip') return { kind: 'equip', equip: id(a) };
    return { kind: 'other', text: e };
  });
const purchases = equipmentFile.purchases.map((p) => ({
  id: id(p.id),
  label: p.name,
  price: p.price,
  tier: p.tier,
  effects: effects(p.effect),
  furniture: FURNITURE_OF[p.id] ?? null,
  text: p.text,
}));

write(join(out, 'service', 'recettes.json'), { recipes });
write(join(out, 'service', 'ingredients.json'), { ingredients });
write(join(out, 'service', 'equipements.json'), { purchases });

// Objets du service: vaisselle propre et sale, étapes intermédiaires, un objet par recette.
const CUP = [0.09, 0.09, 0.07];
const GLASS = [0.07, 0.07, 0.12];
const PLATE = [0.18, 0.18, 0.03];
const SIZE = { tasse: CUP, verre: GLASS, assiette: PLATE };
const serviceObjects = [
  { id: 'verre', label: 'Verre', size: GLASS, color: '#d8e8ec', tray: null },
  { id: 'verre-sale', label: 'Verre sale', size: GLASS, color: '#a9b4a8', tray: null },
  { id: 'assiette', label: 'Assiette', size: PLATE, color: '#f4efe6', tray: null },
  { id: 'assiette-sale', label: 'Assiette sale', size: PLATE, color: '#b5a68a', tray: null },
  { id: 'tasse-cafe', label: 'Tasse de café', size: CUP, color: '#6b3e1f', tray: null },
  { id: 'carton', label: 'Carton', size: [0.4, 0.3, 0.25], color: '#b88a55', tray: null },
  {
    id: 'carton-lourd',
    label: 'Gros carton',
    size: [0.5, 0.35, 0.35],
    color: '#9c7040',
    tray: null,
  },
  ...recipes.map((r) => ({
    id: r.id,
    label: r.label,
    size: SIZE[r.vessel],
    color: COLOR[recipesFile.recipes.find((g) => id(g.id) === r.id).family],
    tray: null,
  })),
];

// Meubles du service. Les pièces de la machine (groupes, buse) sont de petits meubles posés sur
// elle: chacun est sa propre cible, avec sa tasse dessous (la machine entière volerait la visée).
const base = { kind: 'other', blocks: false, fixed: true, carry: 'none', price: 0, source: null };
const serviceFurniture = [
  {
    ...base,
    id: 'groupe-espresso',
    label: 'Groupe de la machine',
    color: '#9aa0a6',
    footprint: [0.1, 0.1],
    height: 0.1,
    slots: [{ id: 'bec', x: 0, y: -0.13, z: -0.04 }],
    station: 'groupe',
  },
  {
    ...base,
    id: 'buse-vapeur',
    label: 'Buse vapeur',
    color: '#c7ccd1',
    footprint: [0.08, 0.08],
    height: 0.14,
    slots: [{ id: 'bec', x: 0, y: -0.13, z: -0.04 }],
    station: 'vapeur',
  },
  {
    ...base,
    id: 'bouilloire',
    label: 'Bouilloire',
    color: '#d7d2c8',
    footprint: [0.2, 0.2],
    height: 0.28,
    slots: [{ id: 'tasse', x: 0.17, y: 0, z: 0 }],
    station: 'bouilloire',
  },
  {
    ...base,
    id: 'bouilloire-temperature',
    label: 'Bouilloire à température',
    color: '#a9b8c0',
    footprint: [0.2, 0.2],
    height: 0.3,
    slots: [{ id: 'tasse', x: 0.17, y: 0, z: 0 }],
    station: 'bouilloire',
    price: 90,
  },
  {
    ...base,
    id: 'vitrine',
    label: 'Cloche à viennoiseries',
    color: '#e8e2d0',
    footprint: [0.28, 0.28],
    height: 0.32,
    slots: [{ id: 'assiette', x: 0, y: 0, z: 0.2 }],
    station: 'vitrine',
  },
  {
    ...base,
    id: 'moulin-dose',
    label: 'Moulin à dose',
    color: '#5b5f63',
    footprint: [0.22, 0.35],
    height: 0.55,
    blocks: true,
    slots: [{ id: 'bac', x: 0, y: 0.02, z: -0.1 }],
    station: 'moulin-dose',
    price: 380,
  },
  {
    ...base,
    id: 'presse-agrumes',
    label: 'Presse-agrumes à levier',
    color: '#e3a33b',
    footprint: [0.25, 0.25],
    height: 0.45,
    slots: [{ id: 'verre', x: 0, y: 0.02, z: -0.06 }],
    station: 'presse-agrumes',
    price: 120,
  },
  {
    ...base,
    id: 'crepiere',
    label: 'Crêpière',
    color: '#3a3a3a',
    footprint: [0.45, 0.45],
    height: 0.2,
    slots: [{ id: 'assiette', x: 0, y: 0.2, z: 0 }],
    station: 'crepiere',
    price: 180,
  },
  {
    ...base,
    id: 'lave-vaisselle',
    label: 'Lave-vaisselle',
    color: '#c9cfd2',
    footprint: [0.6, 0.55],
    height: 0.85,
    blocks: true,
    // Le panier tiré, porte ouverte devant la machine (elle est sous l'arrière-comptoir).
    slots: [{ id: 'panier', x: 0, y: 0.45, z: 0.4 }],
    station: 'lave-vaisselle',
  },
  {
    ...base,
    id: 'rail-tickets',
    label: 'Rail à tickets',
    color: '#8a8f94',
    footprint: [0.6, 0.03],
    height: 0.05,
    slots: [{ id: 'pince', x: 0, y: 0.05, z: 0 }],
    station: 'rail',
  },
  {
    ...base,
    id: 'palette-livraison',
    label: 'Palette des livraisons',
    color: '#a88a5c',
    footprint: [0.8, 0.6],
    height: 0.15,
    blocks: true,
    slots: [
      { id: 's1', x: -0.2, y: 0.15, z: -0.15 },
      { id: 's2', x: 0.2, y: 0.15, z: -0.15 },
      { id: 's3', x: -0.2, y: 0.15, z: 0.15 },
      { id: 's4', x: 0.2, y: 0.15, z: 0.15 },
    ],
    station: null,
  },
];

// Meubles du plan qui deviennent des postes du service (champs remplacés, le reste gardé).
const furniturePatches = {
  'machine-espresso': { station: null, slots: [] },
  moulin: { station: 'moulin', slots: [{ id: 'bac', x: 0, y: 0.02, z: -0.12 }] },
  caisse: { station: 'caisse', slots: [{ id: 'terminal', x: 0, y: 0.15, z: 0 }] },
  'frigo-sous-plan': { station: 'frigo', slots: [{ id: 'plan', x: 0.05, y: 0.91, z: 0 }] },
  'pile-tasses': {
    label: 'Vaisselle propre',
    station: 'vaisselle',
    source: null,
    slots: [{ id: 'dessus', x: 0, y: 0.25, z: 0 }],
  },
  plonge: { station: 'plonge' },
  passe: {
    slots: [
      { id: 'p1', x: -0.15, y: 1.105, z: -0.12 },
      { id: 'p2', x: 0.15, y: 1.105, z: -0.12 },
      { id: 'p3', x: -0.15, y: 1.105, z: 0.12 },
      { id: 'p4', x: 0.15, y: 1.105, z: 0.12 },
    ],
  },
  // Un carton se pose au pied de son rangement, côté pièce, puis se range d'un geste. Les côtés
  // viennent du plan: l'étagère du nord ouvre au sud, la grande étagère (contre le mur est) et
  // l'armoire froide (contre la cloison sud) ouvrent vers l'intérieur de la réserve.
  'frigo-armoire': { station: 'rangement', slots: [{ id: 'pied', x: 0, y: 0, z: -0.6 }] },
  etagere: { station: 'rangement', slots: [{ id: 'pied', x: 0, y: 0, z: 0.4 }] },
  'etagere-longue': { station: 'rangement', slots: [{ id: 'pied', x: 0, y: 0, z: -0.4 }] },
};

// Postes: tous au clic, le service mène lui-même les gestes (maintien, fenêtres, qualité).
// `seconds` (600) ne sert qu'à l'anneau de maintien du HUD: le service y écrit l'avancement de
// son geste (`players[].use`), le poste ne se termine jamais seul par le cœur.
// `transforms` à l'identique: le poste n'est une cible que si le bon récipient est posé dessus,
// sinon la visée préfère l'objet voisin (et l'invite dit quoi poser).
const keep = (...types) => types.map((t) => ({ from: t, to: t }));
const station = (sid, label, verb, slot, transforms = []) => ({
  id: sid,
  label,
  verb,
  use: 'click',
  seconds: 600,
  slot,
  transforms,
});
const serviceStations = [
  station('groupe', 'Groupe de la machine', 'Lancer ou arrêter l’extraction', 'bec', keep('tasse')),
  station(
    'vapeur',
    'Buse vapeur',
    'Mousser le lait (maintenir)',
    'bec',
    keep('tasse', 'tasse-cafe'),
  ),
  station('moulin', 'Moulin', 'Moudre une dose (maintenir)', 'bac'),
  station('moulin-dose', 'Moulin à dose', 'Tirer deux doses', 'bac'),
  station('caisse', 'Caisse', 'Prendre la commande (maintenir)', 'terminal'),
  station(
    'frigo',
    'Réfrigérateur et plan',
    'Préparer (maintenir)',
    'plan',
    keep('verre', 'assiette'),
  ),
  station('vaisselle', 'Vaisselle propre', 'Prendre de la vaisselle', 'dessus'),
  station('plonge', 'Plonge', 'Laver (maintenir)', 'bac'),
  station('bouilloire', 'Bouilloire', 'Chauffer l’eau, puis verser', 'tasse', keep('tasse')),
  station(
    'vitrine',
    'Cloche à viennoiseries',
    'Servir une part (maintenir)',
    'assiette',
    keep('assiette', 'carton'),
  ),
  station('presse-agrumes', 'Presse-agrumes', 'Presser (maintenir)', 'verre', keep('verre')),
  station(
    'crepiere',
    'Crêpière',
    'Verser la pâte (maintenir), puis sortir',
    'assiette',
    keep('assiette'),
  ),
  station('lave-vaisselle', 'Lave-vaisselle', 'Charger, lancer ou vider', 'panier'),
  station('rail', 'Rail à tickets', 'Prendre un ticket', 'pince'),
  station('rangement', 'Rangement', 'Ranger le carton', 'pied', keep('carton', 'carton-lourd')),
];

/** JSON au format de prettier: un objet sans conteneur imbriqué tient sur une ligne. */
const format = (value, indent) => {
  const inner = `${indent}  `;
  const leaf = (v) => v === null || typeof v !== 'object';
  if (Array.isArray(value)) {
    if (value.every(leaf)) return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
    return `[\n${value.map((v) => `${inner}${format(v, inner)}`).join(',\n')}\n${indent}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (indent.length > 4 && entries.every(([, v]) => leaf(v)))
      return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`;
    const lines = entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${format(v, inner)}`);
    return `{\n${lines.join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
};

/**
 * Fusion dans un fichier commun sans le réécrire: chaque élément de la liste `key` garde son texte
 * d'origine, sauf ceux que le service remplace; les nouveaux s'ajoutent à la fin. Un autre
 * chantier qui modifie un autre élément du même fichier ne se heurte donc à rien.
 */
const mergeFile = (path, key, replace, additions, removed = []) => {
  const text = readFileSync(path, 'utf8');
  const open = text.indexOf('[', text.indexOf(`"${key}"`));
  // Découpe des éléments de premier niveau de la liste, chaînes comprises.
  const spans = [];
  let depth = 0;
  let inString = false;
  let begin = -1;
  let close = -1;
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') {
      if (depth === 0) begin = i;
      depth++;
    } else if (c === '}' || c === ']') {
      if (depth === 0) {
        close = i;
        break;
      }
      depth--;
      if (depth === 0) spans.push([begin, i + 1]);
    }
  }
  const items = spans.map(([a, b]) => {
    const raw = text.slice(a, b);
    const data = JSON.parse(raw);
    const next = replace(data);
    return { id: data.id, raw: next === data ? raw : format(next, '    ') };
  });
  const kept = items.filter((item) => !removed.includes(item.id));
  for (const a of additions) {
    const formatted = format(a, '    ');
    const at = kept.findIndex((item) => item.id === a.id);
    if (at >= 0) kept[at] = { id: a.id, raw: formatted };
    else kept.push({ id: a.id, raw: formatted });
  }
  const body = kept.map((item) => `    ${item.raw}`).join(',\n');
  writeFileSync(path, `${text.slice(0, open + 1)}\n${body}\n  ${text.slice(close)}`);
};

const same = (data) => data;
mergeFile(join(out, 'objets.json'), 'objects', same, serviceObjects);
mergeFile(
  join(out, 'meubles.json'),
  'furniture',
  (f) => (f.id in furniturePatches ? { ...f, ...furniturePatches[f.id] } : f),
  serviceFurniture,
);
mergeFile(join(out, 'postes.json'), 'stations', same, serviceStations, ['machine']);

process.stdout.write(
  `service: ${recipes.length} recettes, ${ingredients.length} ingrédients, ${purchases.length} achats, ` +
    `${serviceObjects.length} objets, ${serviceFurniture.length} meubles, ${serviceStations.length} postes\n`,
);
