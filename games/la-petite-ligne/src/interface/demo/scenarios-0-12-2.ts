/**
 * Situations de la page de démonstration pour l'interface imagée du patch 0.12.2
 * (`docs/jeux/jeu-1/interface-imagee-0-12-2.md`): comptoir, mercerie, réchaud, établi,
 * basse-cour et carnet des poissons, partis de la référence d'été du format 13 (jour 25, trois
 * poules, huit poissons au carnet). Outil de captures et de tests seulement.
 */
import type { CharacterId, ItemStack } from '../../etat/types';
import type { Sim } from '../../simulation/contexte';
import { step } from '../../simulation/pas';

/** Référence d'été du format 13: trois poules (noire, blanche, rousse), huit poissons pris. */
export const SUMMER_25_V13 = 'format-13-ete-jour-25.json';

/** Scénarios de ce lot, tous partis de `SUMMER_25_V13`. */
export const PATCH_0122_SCENARIOS: readonly string[] = [
  'comptoir-0122',
  'comptoir-0122-vendre',
  'comptoir-0122-pauvre',
  'mercerie-0122',
  'rechaud-0122',
  'rechaud-0122-vide',
  'etabli-0122',
  'basse-cour-0122',
  'basse-cour-0122-debut',
  'poissons-0122',
  'sac-0122',
  'coffre-0122',
  'coffre-0122-plein',
  'quetes-0122',
  'salon-0122',
  'salon-0122-banc',
];

function character(sim: Sim, id: CharacterId): Sim['world']['characters'][number] {
  const c = sim.world.characters.find((x) => x.id === id);
  if (c === undefined) throw new Error(`personnage ${id}`);
  return c;
}

function stack(item: string, count: number, quality: ItemStack['quality'] = 'ordinary'): ItemStack {
  return { item, quality, count };
}

function bag(sim: Sim, id: CharacterId, items: readonly (ItemStack | null)[]): void {
  const c = character(sim, id);
  c.bag = c.bag.map((_, i) => items[i] ?? null);
  c.selected = 0;
}

function near(sim: Sim, id: CharacterId, point: string, dx = 0.9, dy = 0.4): void {
  const p = sim.map.points[point];
  if (p === undefined) return;
  const c = character(sim, id);
  c.pos = { x: p.x + dx, y: p.y + dy };
  c.prev = { ...c.pos };
  c.destination = null;
  c.inside = null;
}

/** Le menu ouvert dans l'état, même hors de portée (page de démonstration seulement). */
function openMenu(sim: Sim, id: CharacterId, menu: NonNullable<Sim['world']['characters'][number]['menu']>): void {
  step(sim, { controls: {}, intents: [{ by: id, intent: { type: 'menu', menu } }] });
  const c = character(sim, id);
  c.menu = menu;
  c.status = 'menu';
}

const KITCHEN_BAG: readonly (ItemStack | null)[] = [
  stack('hoe', 1),
  stack('watering_can', 1),
  stack('egg', 4),
  stack('radish', 2),
  stack('milk_can', 2),
  stack('blackberry', 3),
  stack('sugar', 1),
  stack('bread', 2),
  stack('omelette', 1),
  null,
  stack('radish', 1, 'fine'),
  stack('log', 3),
  stack('plank', 2),
  stack('nail', 5),
];

/** Le rangement d'un été avancé: 18 cases, dont deux piles qui débordent sur une seconde case. */
const FULL_CELLAR: readonly ItemStack[] = [
  stack('jay_feather', 1),
  stack('crystal_radio', 1),
  stack('vegetable_soup', 4),
  stack('radish', 120),
  stack('radish', 6, 'fine'),
  stack('lettuce', 14),
  stack('carrot', 9),
  stack('egg', 11),
  stack('milk_can', 3),
  stack('blackberry', 22),
  stack('hazelnut', 17),
  stack('log', 130),
  stack('plank', 26),
  stack('nail', 40),
  stack('sugar', 2),
  stack('jar', 5),
];

/** Compteurs posés pour le scénario des quêtes (lignes de base à zéro dans la sauvegarde). */
const QUEST_COUNTERS: readonly (readonly [string, number])[] = [
  ['given:jeanne:hen_feather', 1],
  ['crafted:craft_crate', 2],
  ['stall_kind', 1],
];

/** Une basse-cour fournie: coq, poule au nid, poussine, chèvre, grain entamé, litière d'avant-hier. */
function fullFarm(sim: Sim): void {
  const w = sim.world;
  const b = w.breeding;
  const day = w.clock.day;
  const coop = sim.map.points.chicken_coop ?? { x: 10, y: 10 };
  const pos = { x: coop.x - 0.8, y: coop.y + 0.8 };
  const happiness = [86, 62, 34];
  w.hens.forEach((h, i) => {
    h.happiness = happiness[i] ?? 55;
  });
  const [first, second] = w.hens;
  b.rooster = { id: 'r-demo', name: 'Gaspard', variant: 'rooster_golden', pos, prev: { ...pos }, facing: 0, wander: { ...pos } };
  if (first !== undefined) b.brood = { hen: first.id, eggs: 3, startDay: day - 4, by: 'p1' };
  if (second !== undefined)
    b.chicks = [{ id: 'c-demo', name: 'Praline', variant: 'hen_golden', pos, prev: { ...pos }, facing: 0, wander: { ...pos }, mother: second.id, bornDay: day - 2 }];
  b.goats = [
    {
      id: 'g-demo',
      name: 'Noisette',
      pos,
      prev: { ...pos },
      facing: 0,
      wander: { ...pos },
      happiness: 74,
      stake: 'goat_graze_01',
      led: null,
      home: false,
      milkedDay: day,
      wateredDay: null,
      milking: null,
    },
  ];
  b.grainRations = 12;
  b.strawDay = day - 2;
  w.feederFilled = true;
}

/** Retourne `true` si le scénario est de ce lot (et l'a préparé). */
export function setupPatch0122(sim: Sim, name: string, me: CharacterId): boolean {
  if (!PATCH_0122_SCENARIOS.includes(name)) return false;
  const w = sim.world;
  switch (name) {
    case 'comptoir-0122':
    case 'comptoir-0122-vendre':
    case 'comptoir-0122-pauvre':
      bag(sim, me, KITCHEN_BAG);
      w.purse = name === 'comptoir-0122-pauvre' ? 18 : 214;
      near(sim, me, 'grocery_counter');
      openMenu(sim, me, 'shop');
      return true;
    case 'mercerie-0122':
      w.purse = 60;
      near(sim, me, 'salon_counter', 0, 0);
      character(sim, me).inside = 'salon';
      openMenu(sim, me, 'shop');
      character(sim, me).inside = 'salon';
      return true;
    case 'rechaud-0122':
    case 'rechaud-0122-vide':
      bag(sim, me, name === 'rechaud-0122' ? KITCHEN_BAG : [stack('hoe', 1)]);
      w.cellar = [];
      openMenu(sim, me, 'stove');
      return true;
    case 'etabli-0122':
      bag(sim, me, KITCHEN_BAG);
      near(sim, me, 'sawmill_workbench');
      openMenu(sim, me, 'workbench');
      return true;
    case 'basse-cour-0122':
      fullFarm(sim);
      bag(sim, me, [stack('egg', 3)]);
      openMenu(sim, me, 'farm');
      return true;
    case 'basse-cour-0122-debut':
      // Comme la capture du client (R08): trois poules, pas de coq, rien encore aujourd'hui.
      w.feederFilled = false;
      openMenu(sim, me, 'farm');
      return true;
    case 'poissons-0122':
    case 'sac-0122':
      bag(sim, me, KITCHEN_BAG);
      openMenu(sim, me, 'notebook');
      return true;
    case 'salon-0122':
    case 'salon-0122-banc': {
      // Le fauteuil (chez soi) ou le banc (l'autre au fauteuil): l'état est posé à la main, hors des heures de Solange.
      const other: CharacterId = me === 'p1' ? 'p2' : 'p1';
      const sitter = name === 'salon-0122' ? me : other;
      const chair = sim.map.points.salon_chair;
      for (const id of name === 'salon-0122' ? [me] : [me, other]) {
        near(sim, id, 'salon_chair', id === sitter ? 0 : 1.6, 0);
        const c = character(sim, id);
        c.inside = 'salon';
        c.menu = 'salon';
        c.status = 'menu';
        c.hairOffer = null;
        if (id === sitter) c.action = { kind: 'sit', since: w.tick, duration: 0, target: chair === undefined ? null : { x: chair.x, y: chair.y } };
      }
      w.purse = 60;
      return true;
    }
    case 'coffre-0122':
    case 'coffre-0122-plein':
      bag(sim, me, KITCHEN_BAG);
      if (name === 'coffre-0122-plein') {
        // Un rangement bien rempli: 18 cases sur 26, deux outils au râtelier.
        w.cellar = FULL_CELLAR.map((x) => ({ ...x }));
        w.rack = [stack('axe', 1), stack('fishing_rod', 1)];
      }
      openMenu(sim, me, 'chest');
      return true;
    case 'quetes-0122':
      // Des quêtes en cours avec leurs compteurs entamés: 1 plume sur 4, 2 cagettes sur 4, 1 sorte sur 3.
      for (const [key, count] of QUEST_COUNTERS) w.counters.duo[key] = count;
      openMenu(sim, me, 'notebook');
      return true;
    default:
      return false;
  }
}

/** Onglet du carnet qu'ouvre un scénario de ce lot, ou `null`. */
export function patch0122NotebookTab(name: string): 'fish' | 'bag' | 'quests' | null {
  if (name === 'poissons-0122') return 'fish';
  if (name === 'quetes-0122') return 'quests';
  if (name === 'sac-0122') return 'bag';
  return null;
}
