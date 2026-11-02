/**
 * Substituts des modèles qui manquent encore: formes simples aux couleurs de
 * la palette, reconnaissables, à la bonne échelle (1 m par case, personnage de
 * 1,7 m). Ils servent tant que l'artiste n'a pas livré le nœud du même nom;
 * un nom inconnu donne une caisse rayée jaune et noir, visible exprès.
 *
 * Les nombres des fonctions de construction sont les cotes des objets, en
 * mètres (origine au centre de l'emprise, au sol; l'avant regarde +Z), comme
 * une fiche de modèle: ce ne sont pas des réglages.
 */
import type { BufferGeometry } from 'three';
import { ShapeBuilder, type Paint, type Triple } from './geometrie';
import type { PaletteCell } from './palette';

export interface SubstituteHints {
  /** Emprise au sol en cases (bâtiments, meubles), si la carte ou les données la donnent. */
  width?: number;
  depth?: number;
}

export interface SubstitutePart {
  name: string;
  geometry: BufferGeometry;
  castShadow: boolean;
}

type Builder = (b: ShapeBuilder, w: number, d: number) => void;

/** Emprise par défaut d'un bâtiment sans rectangle (cases). */
const DEFAULT_BUILDING_SIZE = 4;
const DEFAULT_PROP_SIZE = 1;
/** Rayures du substitut inconnu: une sur deux. */
const STRIPE_COUNT = 5;

// ---------------------------------------------------------------------------
// Potager et cultures

function mound(b: ShapeBuilder, soil: PaletteCell, ridge: PaletteCell): void {
  b.box([0.92, 0.05, 0.92], [0, 0, 0], soil, { base: true });
  for (const z of [-0.28, 0, 0.28]) {
    b.box([0.84, 0.06, 0.14], [0, 0.05, z], ridge, { base: true });
  }
}

function leaves(
  b: ShapeBuilder,
  count: number,
  length: number,
  cell: PaletteCell,
  tilt: number,
  lift = 0,
): void {
  for (let i = 0; i < count; i += 1) {
    const angle = (360 / count) * i + 17;
    const rad = (angle * Math.PI) / 180;
    const reach = length * 0.35;
    b.box([0.06, length, 0.02], [Math.cos(rad) * reach, lift, Math.sin(rad) * reach], cell, {
      base: true,
      rotation: [Math.sin(rad) * tilt, 0, -Math.cos(rad) * tilt],
    });
  }
}

const CROPS: Record<string, Builder> = {
  seed: (b) => {
    b.box([0.34, 0.05, 0.34], [0, 0, 0], 'soil_tilled_light', { base: true });
    for (const [x, z] of [
      [-0.08, 0.05],
      [0.07, -0.06],
      [0.02, 0.09],
    ] as const) {
      b.box([0.04, 0.03, 0.04], [x, 0.05, z], 'seed', { base: true });
    }
  },
  radish_stage_sprout: (b) => {
    leaves(b, 2, 0.12, 'sprout', 25);
  },
  radish_stage_young: (b) => {
    leaves(b, 4, 0.2, 'leaf_crop', 30);
  },
  radish_stage_ripe: (b) => {
    b.ball(0.09, [0, 0.05, 0], 'radish', { scale: [1, 0.9, 1] });
    leaves(b, 6, 0.26, 'leaf_crop', 32, 0.08);
  },
  lettuce_stage_sprout: (b) => {
    leaves(b, 3, 0.1, 'sprout', 40);
  },
  lettuce_stage_young: (b) => {
    b.blob(0.13, [0, 0.1, 0], 'lettuce', { scale: [1, 0.7, 1] });
  },
  lettuce_stage_ripe: (b) => {
    b.blob(0.22, [0, 0.15, 0], 'lettuce', { scale: [1, 0.72, 1] });
    b.blob(0.14, [0, 0.25, 0], 'lettuce_light', { scale: [1, 0.7, 1], rotation: [0, 30, 0] });
  },
  carrot_stage_sprout: (b) => {
    leaves(b, 3, 0.14, 'leaf_carrot', 15);
  },
  carrot_stage_young: (b) => {
    leaves(b, 5, 0.26, 'leaf_carrot', 18);
  },
  carrot_stage_ripe: (b) => {
    b.cylinder(0.06, 0.05, 0.05, [0, 0, 0], 'carrot', { base: true });
    leaves(b, 7, 0.36, 'leaf_carrot', 20, 0.04);
  },
};

// ---------------------------------------------------------------------------
// Arbres

const TREES: Record<string, Builder> = {
  oak: (b) => {
    b.cylinder(0.16, 0.24, 1.6, [0, 0, 0], 'bark', { base: true, segments: 6 });
    b.blob(1.05, [0, 2.3, 0], 'leaf_oak');
    b.blob(0.75, [0.65, 1.95, 0.25], 'leaf_oak_light', { rotation: [20, 40, 0] });
    b.blob(0.7, [-0.55, 2.0, -0.35], 'leaf_oak', { rotation: [0, 70, 15] });
    b.blob(0.6, [0.1, 2.85, -0.2], 'leaf_oak_light', { rotation: [10, 10, 30] });
  },
  fir: (b) => {
    b.cylinder(0.12, 0.18, 0.9, [0, 0, 0], 'bark_dark', { base: true, segments: 6 });
    b.cone(0.95, 1.4, [0, 0.7, 0], 'leaf_fir', { base: true, segments: 7 });
    b.cone(0.75, 1.25, [0, 1.45, 0], 'leaf_fir_light', {
      base: true,
      segments: 7,
      rotation: [0, 25, 0],
    });
    b.cone(0.5, 1.1, [0, 2.2, 0], 'leaf_fir', { base: true, segments: 7, rotation: [0, 50, 0] });
  },
  stump: (b) => {
    b.cylinder(
      0.22,
      0.27,
      0.32,
      [0, 0, 0],
      { top: 'log_end', side: 'bark' },
      { base: true, segments: 7 },
    );
  },
  bush: (b) => {
    b.blob(0.42, [0, 0.32, 0], 'leaf_bush');
    b.blob(0.3, [0.3, 0.24, 0.12], 'leaf_hazel', { rotation: [0, 40, 0] });
  },
  // Lisière du tour 8: roncier bas (1,2 x 0,8 m, 0,7 m), brins du rejet de chêne, jeune sapin.
  bramble: (b) => {
    b.blob(0.4, [-0.3, 0.3, 0], 'leaf_bush', { scale: [1, 0.85, 0.9] });
    b.blob(0.38, [0.3, 0.28, 0.05], 'leaf_bush', { scale: [1, 0.85, 0.9] });
  },
  oak_sapling_shoots: (b) => {
    b.cylinder(0.03, 0.04, 1.2, [0, 0, 0], 'bark', { base: true, segments: 5 });
    b.blob(0.35, [0, 1.3, 0], 'leaf_oak_light');
  },
  fir_sapling: (b) => {
    b.cylinder(0.04, 0.05, 0.3, [0, 0, 0], 'bark_dark', { base: true, segments: 5 });
    b.cone(0.4, 0.7, [0, 0.25, 0], 'leaf_fir', { base: true, segments: 7 });
    b.cone(0.28, 0.55, [0, 0.65, 0], 'leaf_fir_light', { base: true, segments: 7 });
  },
};

// ---------------------------------------------------------------------------
// Objets tenus et récoltés

const ITEMS: Record<string, Builder> = {
  radish: (b) => {
    b.ball(0.08, [0, 0.08, 0], 'radish');
    leaves(b, 3, 0.12, 'leaf_crop', 20, 0.14);
  },
  lettuce: (b) => b.blob(0.13, [0, 0.11, 0], 'lettuce', { scale: [1, 0.8, 1] }),
  carrot: (b) => {
    b.cone(0.05, 0.24, [0, 0.03, 0], 'carrot', { rotation: [90, 0, 0], segments: 6 });
    leaves(b, 3, 0.1, 'leaf_carrot', 70, 0.03);
  },
  dandelion: (b) => {
    b.cylinder(0.01, 0.01, 0.18, [0, 0, 0], 'leaf_crop', { base: true });
    b.ball(0.05, [0, 0.2, 0], 'flower_yellow');
  },
  // Cueillettes de la lisière (tour 8): à la taille des modèles de l'artiste, grossies pour se lire.
  wild_garlic: (b) => {
    leaves(b, 6, 0.3, 'leaf_crop', 35);
    b.ball(0.04, [0.04, 0.31, 0.02], 'flower_white');
    b.ball(0.04, [-0.05, 0.28, -0.03], 'flower_white');
  },
  chanterelle: (b) => {
    for (const [x, z, h] of [
      [0, 0, 0.15],
      [0.08, 0.05, 0.11],
      [-0.07, 0.06, 0.09],
      [0.02, -0.08, 0.12],
    ] as const) {
      b.cylinder(0.015, 0.025, h, [x, 0, z], 'fabric_yellow', { base: true, segments: 5 });
      b.cylinder(0.055, 0.03, 0.035, [x, h, z], 'flower_center', { base: true, segments: 7 });
    }
  },
  blackberry: (b) => {
    b.box([0.28, 0.02, 0.05], [0, 0, 0], 'leaf_bush', { base: true });
    for (const x of [-0.1, -0.05, 0, 0.05, 0.1]) b.ball(0.03, [x, 0.04, 0.02], 'blackberry');
  },
  hazelnut: (b) => {
    b.box([0.3, 0.01, 0.2], [0, 0, 0], 'leaf_hazel', { base: true, rotation: [0, 25, 0] });
    for (const [x, z] of [
      [0, 0],
      [0.06, 0.03],
      [-0.05, 0.04],
      [0.02, -0.06],
      [-0.07, -0.03],
    ] as const) {
      b.ball(0.03, [x, 0.035, z], 'wood', { scale: [1, 0.9, 1] });
    }
  },
  egg: (b) => b.ball(0.045, [0, 0.055, 0], 'egg', { scale: [0.85, 1.1, 0.85], detail: 1 }),
  log: (b) =>
    b.cylinder(
      0.13,
      0.13,
      0.8,
      [0, 0.13, 0],
      { top: 'log_end', side: 'bark' },
      { rotation: [0, 0, 90], segments: 7 },
    ),
  plank: (b) => b.box([0.9, 0.04, 0.18], [0, 0, 0], 'wood_new', { base: true }),
  beam: (b) =>
    b.box([4.2, 0.2, 0.22], [0, 0, 0], { top: 'wood', side: 'wood_dark' }, { base: true }),
  nail_box: (b) => b.box([0.16, 0.08, 0.1], [0, 0, 0], 'tin_paint', { base: true }),
  mattress: (b) => b.box([0.9, 0.12, 1.8], [0, 0, 0], 'fabric_cream', { base: true }),
  hoe: (b) => {
    b.cylinder(0.02, 0.02, 1.2, [0, 0, 0], 'wood', { base: true, segments: 5 });
    b.box([0.16, 0.12, 0.02], [0, 1.18, 0.05], 'iron', { rotation: [70, 0, 0] });
  },
  watering_can: (b) => {
    b.cylinder(0.11, 0.12, 0.2, [0, 0, 0], 'tin', { base: true });
    b.cylinder(0.015, 0.02, 0.22, [0, 0.16, 0.14], 'tin', { rotation: [55, 0, 0], segments: 5 });
    b.box([0.02, 0.12, 0.12], [0, 0.24, -0.02], 'tin', {});
  },
  axe: (b) => {
    b.cylinder(0.02, 0.02, 0.8, [0, 0, 0], 'wood', { base: true, segments: 5 });
    b.box([0.04, 0.12, 0.16], [0, 0.74, 0.06], 'iron_light', {});
  },
  fishing_rod: (b) =>
    b.cylinder(0.01, 0.02, 1.6, [0, 0, 0], 'wood_new', { base: true, segments: 4 }),
  // Tour 9: outils améliorés, cadeaux, cueillettes d'automne (substituts en attendant l'artiste).
  watering_can_copper: (b) => {
    b.cylinder(0.12, 0.13, 0.22, [0, 0, 0], 'brass', { base: true });
    b.cylinder(0.015, 0.02, 0.24, [0, 0.17, 0.15], 'brass', { rotation: [55, 0, 0], segments: 5 });
    b.box([0.02, 0.13, 0.13], [0, 0.26, -0.02], 'brass', {});
  },
  axe_forged: (b) => {
    b.cylinder(0.02, 0.02, 0.82, [0, 0, 0], 'wood_dark', { base: true, segments: 5 });
    b.box([0.04, 0.14, 0.19], [0, 0.75, 0.07], 'iron', {});
  },
  fishing_rod_bamboo: (b) => {
    b.cylinder(0.01, 0.022, 1.7, [0, 0, 0], 'straw', { base: true, segments: 4 });
    for (const y of [0.4, 0.8, 1.2]) b.cylinder(0.026, 0.026, 0.03, [0, y, 0], 'wood_dark', { base: true, segments: 4 });
  },
  hen_crate: (b) => {
    b.box([0.6, 0.45, 0.45], [0, 0, 0], 'wood_new', { base: true });
    b.box([0.5, 0.3, 0.02], [0, 0.08, 0.23], 'straw', { base: true });
  },
  chalk_box: (b) => {
    b.box([0.2, 0.05, 0.12], [0, 0, 0], 'paper', { base: true });
    for (const [x, c] of [[-0.06, 'flower_red'], [0, 'flower_yellow'], [0.06, 'flower_blue']] as const) b.box([0.02, 0.02, 0.1], [x, 0.05, 0], c, { base: true });
  },
  coffee_mill: (b) => {
    b.box([0.16, 0.16, 0.16], [0, 0, 0], 'wood_dark', { base: true });
    b.cylinder(0.06, 0.08, 0.08, [0, 0.16, 0], 'brass', { base: true, segments: 8 });
    b.box([0.02, 0.02, 0.14], [0.04, 0.26, 0], 'iron', { base: true });
  },
  leather_apron: (b) => b.box([0.4, 0.02, 0.5], [0, 0, 0], 'wood_old_dark', { base: true }),
  wool_scarf: (b) => {
    b.box([0.12, 0.03, 0.5], [0, 0, 0], 'fabric_red', { base: true });
    b.box([0.12, 0.031, 0.06], [0, 0, 0.1], 'fabric_cream', { base: true });
  },
  elder_jelly: (b) => {
    b.cylinder(0.05, 0.05, 0.1, [0, 0, 0], 'glass', { base: true, segments: 8 });
    b.cylinder(0.045, 0.045, 0.08, [0, 0.005, 0], 'blackberry', { base: true, segments: 8 });
    b.cylinder(0.055, 0.055, 0.02, [0, 0.1, 0], 'fabric_red', { base: true, segments: 8 });
  },
  cep: (b) => {
    for (const [x, z, h] of [
      [0, 0, 0.2],
      [0.09, 0.04, 0.15],
      [-0.07, 0.06, 0.12],
    ] as const) {
      b.cylinder(0.035, 0.045, h, [x, 0, z], 'fabric_cream', { base: true, segments: 6 });
      b.ball(0.07, [x, h, z], 'wood', { scale: [1, 0.55, 1] });
    }
  },
  elderberry: (b) => {
    b.cylinder(0.008, 0.008, 0.25, [0, 0, 0], 'paint_red', { base: true, segments: 4 });
    for (const [x, z] of [
      [0, 0],
      [0.04, 0.02],
      [-0.03, 0.03],
      [0.02, -0.04],
      [-0.04, -0.02],
    ] as const) {
      b.ball(0.025, [x, 0.25, z], 'black');
    }
  },
  bread: (b) =>
    b.ball(0.12, [0, 0.08, 0], { top: 'bread', side: 'bread_crust' }, { scale: [1.5, 0.7, 1] }),
  // Tour 10 (lot L3, en attendant les modèles de l'artiste): rue Haute.
  warm_bread: (b) =>
    b.ball(0.12, [0, 0.08, 0], { top: 'bread', side: 'bread_crust' }, { scale: [1.5, 0.75, 1] }),
  brioche: (b) => {
    b.ball(0.1, [0, 0.07, 0], { top: 'bread', side: 'bread_crust' }, { scale: [1, 0.8, 1] });
    b.ball(0.05, [0, 0.16, 0], { top: 'bread', side: 'bread_crust' });
  },
  cup: (b) => b.cylinder(0.04, 0.035, 0.08, [0, 0, 0], 'ceramic', { base: true, segments: 8 }),
  bread_basket: (b) => {
    b.box([0.7, 0.3, 0.45], [0, 0, 0], 'straw', { base: true });
    b.ball(0.12, [0, 0.32, 0], { top: 'bread', side: 'bread_crust' }, { scale: [1.5, 0.7, 1] });
  },
  hourglass: (b) => {
    b.cylinder(0.06, 0.06, 0.02, [0, 0, 0], 'wood_dark', { base: true, segments: 6 });
    b.cylinder(0.05, 0.015, 0.08, [0, 0.02, 0], 'glass', { base: true, segments: 6 });
    b.cylinder(0.015, 0.05, 0.08, [0, 0.1, 0], 'glass', { base: true, segments: 6 });
    b.cylinder(0.06, 0.06, 0.02, [0, 0.18, 0], 'wood_dark', { base: true, segments: 6 });
  },
  horn_comb: (b) => b.box([0.16, 0.01, 0.05], [0, 0, 0], 'fabric_cream', { base: true }),
  dish_radishes: (b) => {
    b.cylinder(0.14, 0.1, 0.04, [0, 0, 0], 'ceramic', { base: true, segments: 10 });
    b.ball(0.04, [0.04, 0.06, 0], 'radish');
    b.ball(0.04, [-0.04, 0.06, 0.03], 'radish');
  },
  dish_omelette: (b) => {
    b.cylinder(0.14, 0.1, 0.04, [0, 0, 0], 'ceramic', { base: true, segments: 10 });
    b.cylinder(0.1, 0.1, 0.02, [0, 0.04, 0], 'paint_yellow', { base: true, segments: 10 });
  },
  dish_soup: (b) => {
    b.cylinder(0.12, 0.08, 0.09, [0, 0, 0], 'ceramic_blue', { base: true, segments: 10 });
    b.cylinder(0.105, 0.105, 0.01, [0, 0.085, 0], 'soup', { base: true, segments: 10 });
  },
  iron_box: (b) =>
    b.box([0.3, 0.16, 0.2], [0, 0, 0], { top: 'rust', side: 'iron' }, { base: true }),
  riddle_card: (b) => b.box([0.16, 0.01, 0.11], [0, 0, 0], 'paper', { base: true }),
  shed_key: (b) => {
    b.box([0.12, 0.015, 0.025], [0, 0, 0], 'brass', { base: true });
    b.cylinder(0.035, 0.035, 0.015, [-0.07, 0, 0], 'brass', { base: true, segments: 6 });
  },
  old_photo: (b) => b.box([0.14, 0.01, 0.1], [0, 0, 0], 'paper_dark', { base: true }),
  fish_gudgeon: (b) => b.ball(0.08, [0, 0.04, 0], 'rock_light', { scale: [1.6, 0.5, 0.6] }),
  fish_chub: (b) => b.ball(0.1, [0, 0.05, 0], 'stone_dark', { scale: [1.7, 0.55, 0.65] }),
  fish_trout: (b) => b.ball(0.11, [0, 0.05, 0], 'rock', { scale: [1.8, 0.55, 0.6] }),
  jay_feather: (b) => b.box([0.03, 0.01, 0.26], [0, 0, 0], 'paint_blue', { base: true }),
};

function seedPacket(crop: PaletteCell): Builder {
  return (b) => {
    b.box([0.12, 0.16, 0.02], [0, 0, 0], 'paper', { base: true });
    b.box([0.08, 0.06, 0.005], [0, 0.07, 0.012], crop, {});
  };
}
ITEMS.seed_packet_radish = seedPacket('radish');
ITEMS.seed_packet_lettuce = seedPacket('lettuce');
ITEMS.seed_packet_carrot = seedPacket('carrot');

// ---------------------------------------------------------------------------
// Meubles (empreinte en cases, avant +Z)

const FURNITURE: Record<string, Builder> = {
  straw_mattress: (b, w, d) => {
    b.box(
      [w * 0.85, 0.16, d * 0.9],
      [0, 0, 0],
      { top: 'straw', side: 'straw_dark' },
      { base: true },
    );
    b.box([w * 0.6, 0.1, 0.3], [0, 0.16, -d * 0.32], 'fabric_cream', { base: true });
  },
  double_bed: (b, w, d) => {
    b.box([w * 0.92, 0.32, d * 0.95], [0, 0, 0], 'wood', { base: true });
    b.box([w * 0.88, 0.14, d * 0.9], [0, 0.32, 0.02], 'fabric_cream', { base: true });
    b.box([w * 0.86, 0.06, d * 0.55], [0, 0.46, d * 0.17], 'fabric_blue', { base: true });
    b.box([w * 0.92, 0.75, 0.08], [0, 0, -d * 0.45], 'wood_dark', { base: true });
    b.box([w * 0.32, 0.1, 0.26], [-w * 0.2, 0.46, -d * 0.3], 'fabric_cream', { base: true });
    b.box([w * 0.32, 0.1, 0.26], [w * 0.2, 0.46, -d * 0.3], 'fabric_cream', { base: true });
  },
  table: (b, w, d) => {
    b.box([w * 0.92, 0.06, d * 0.82], [0, 0.72, 0], 'wood_new', { base: true });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.box([0.07, 0.72, 0.07], [sx * w * 0.4, 0, sz * d * 0.33], 'wood', { base: true });
      }
    }
  },
  chair: (b) => {
    b.box([0.42, 0.05, 0.42], [0, 0.44, 0], 'wood_new', { base: true });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.box([0.05, 0.44, 0.05], [sx * 0.18, 0, sz * 0.18], 'wood', { base: true });
      }
    }
    b.box([0.42, 0.48, 0.05], [0, 0.49, -0.19], 'wood', { base: true });
  },
  chest: (b) => {
    b.box([0.8, 0.45, 0.5], [0, 0, 0], { top: 'wood', side: 'wood_dark' }, { base: true });
    b.box([0.82, 0.06, 0.52], [0, 0.45, 0], 'iron', { base: true });
    b.box([0.08, 0.1, 0.02], [0, 0.32, 0.26], 'brass', { base: true });
  },
  // Tour 10 (lot L4, en attendant les modèles de l'artiste): grand coffre et étagère haute du cellier.
  oak_chest: (b) => {
    b.box([0.85, 0.8, 0.55], [0, 0, 0], { top: 'wood', side: 'wood_dark' }, { base: true });
    b.box([0.08, 0.1, 0.02], [0, 0.6, 0.28], 'brass', { base: true });
  },
  tool_rack: (b) => {
    b.box([0.9, 0.08, 0.04], [0, 1.4, -0.45], 'wood_dark', { base: true });
    for (const x of [-0.3, 0, 0.3]) b.box([0.03, 0.03, 0.1], [x, 1.35, -0.4], 'iron', { base: true });
  },
  cellar_rack: (b) => {
    for (const y of [0, 0.6, 1.2, 1.8]) b.box([0.9, 0.04, 1.8], [0, y + 0.1, 0], 'wood_new', { base: true });
    b.box([0.05, 2.2, 1.8], [-0.43, 0, 0], 'wood', { base: true });
    b.box([0.05, 2.2, 1.8], [0.43, 0, 0], 'wood', { base: true });
  },
  shelf: (b, w) => {
    for (const y of [0, 0.55, 1.1]) {
      b.box([w * 0.9, 0.04, 0.32], [0, y + 0.1, -0.3], 'wood_new', { base: true });
    }
    b.box([0.05, 1.4, 0.32], [-w * 0.44, 0, -0.3], 'wood', { base: true });
    b.box([0.05, 1.4, 0.32], [w * 0.44, 0, -0.3], 'wood', { base: true });
    b.ball(0.08, [-0.3, 0.75, -0.3], 'ceramic_blue');
    b.box([0.2, 0.18, 0.15], [0.35, 0.68, -0.3], 'burlap', { base: true });
  },
  stove: (b) => {
    b.box([0.6, 0.7, 0.55], [0, 0, 0], 'black', { base: true });
    b.box([0.64, 0.05, 0.6], [0, 0.7, 0], 'iron_light', { base: true });
    b.cylinder(0.07, 0.07, 1.5, [0.15, 0.7, -0.15], 'black', { base: true, segments: 6 });
    b.box([0.3, 0.16, 0.02], [0, 0.18, 0.28], 'flame', {});
  },
  flower_pot: (b) => {
    b.cylinder(0.14, 0.1, 0.22, [0, 0, 0], 'brick', { base: true, segments: 8 });
    b.blob(0.14, [0, 0.32, 0], 'leaf_bush');
    b.ball(0.05, [0.06, 0.42, 0.04], 'flower_red');
    b.ball(0.05, [-0.06, 0.4, -0.03], 'flower_pink');
  },
  oil_lamp: (b) => {
    b.cylinder(0.1, 0.12, 0.1, [0, 0, 0], 'brass', { base: true, segments: 8 });
    b.cylinder(0.07, 0.07, 0.22, [0, 0.1, 0], 'glass_lamp', { base: true, segments: 8 });
    b.cylinder(0.02, 0.02, 0.04, [0, 0.32, 0], 'brass', { base: true, segments: 5 });
  },
  rug: (b, w, d) => {
    b.box([w * 0.9, 0.015, d * 0.9], [0, 0, 0], 'fabric_red', { base: true });
    b.box([w * 0.7, 0.017, d * 0.7], [0, 0, 0], 'fabric_yellow', { base: true });
  },
  curtains: (b) => {
    b.box([0.9, 0.04, 0.04], [0, 1.85, -0.42], 'wood', { base: true });
    b.box([0.38, 1.1, 0.03], [-0.25, 0.75, -0.42], 'fabric_rose', { base: true });
    b.box([0.38, 1.1, 0.03], [0.25, 0.75, -0.42], 'fabric_rose', { base: true });
  },
  // Tour 9: objets muraux et fauteuil (au mur: bord arrière de la case, -Z).
  straw_hat: (b) => {
    b.cylinder(0.2, 0.2, 0.02, [0, 1.4, -0.44], 'straw', { rotation: [90, 0, 0], segments: 10 });
    b.cylinder(0.1, 0.1, 0.08, [0, 1.4, -0.42], 'straw_dark', { rotation: [90, 0, 0], segments: 8 });
  },
  pressed_flowers: (b) => {
    b.box([0.4, 0.5, 0.03], [0, 1.15, -0.47], 'wood', { base: true });
    b.box([0.32, 0.42, 0.01], [0, 1.19, -0.45], 'paper', { base: true });
    b.ball(0.03, [-0.06, 1.42, -0.44], 'flower_pink');
    b.ball(0.03, [0.06, 1.32, -0.44], 'flower_blue');
  },
  coop_calendar: (b) => {
    b.box([0.34, 0.48, 0.01], [0, 1.1, -0.47], 'paper', { base: true });
    b.box([0.3, 0.2, 0.012], [0, 1.34, -0.465], 'sepia', { base: true });
  },
  wall_clock: (b) => {
    b.cylinder(0.17, 0.17, 0.05, [0, 1.6, -0.45], 'wood_dark', { rotation: [90, 0, 0], segments: 12 });
    b.cylinder(0.14, 0.14, 0.01, [0, 1.6, -0.42], 'paper', { rotation: [90, 0, 0], segments: 12 });
  },
  autumn_wreath: (b) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.ball(0.06, [Math.cos(a) * 0.15, 1.45 + Math.sin(a) * 0.15, -0.45], i % 2 === 0 ? 'leaf_oak' : 'paint_red');
    }
  },
  jeanne_drawing: (b) => {
    b.box([0.42, 0.3, 0.005], [0, 1.25, -0.47], 'paper', { base: true });
    b.box([0.3, 0.08, 0.006], [0, 1.22, -0.468], 'loco_green', { base: true });
  },
  wicker_armchair: (b) => {
    b.box([0.55, 0.36, 0.55], [0, 0, 0], 'straw', { base: true });
    b.box([0.55, 0.5, 0.08], [0, 0.36, -0.24], 'straw_dark', { base: true });
    for (const sx of [-1, 1]) b.box([0.07, 0.2, 0.5], [sx * 0.26, 0.36, 0], 'straw_dark', { base: true });
  },
  // Cadre au mur: comme le modèle de l'artiste, accroché au bord arrière de la case (-Z), à hauteur d'yeux.
  picture_frame: (b) => {
    b.box([0.6, 0.45, 0.04], [0, 1.23, -0.47], 'wood_dark', { base: true });
    b.box([0.48, 0.33, 0.01], [0, 1.29, -0.445], 'sepia', { base: true });
  },
  wood_stove: (b) => {
    b.cylinder(0.24, 0.26, 0.75, [0, 0, -0.03], 'black', { base: true, segments: 10 });
    b.cylinder(0.27, 0.27, 0.04, [0, 0.75, -0.03], 'iron_light', { base: true, segments: 10 });
    b.box([0.2, 0.16, 0.02], [0, 0.25, 0.23], 'ember', { base: true });
    b.cylinder(0.06, 0.06, 1.56, [0, 0.79, -0.12], 'black', { base: true, segments: 6 });
  },
  crystal_radio: (b) => {
    b.box([0.4, 0.26, 0.25], [0, 0, 0], { top: 'wood_dark', side: 'wood' }, { base: true });
    b.cylinder(0.05, 0.05, 0.03, [-0.1, 0.13, 0.13], 'brass', {
      rotation: [90, 0, 0],
      segments: 8,
    });
    b.cylinder(0.01, 0.01, 0.3, [0.12, 0.26, -0.05], 'iron', { base: true, segments: 4 });
  },
};

// ---------------------------------------------------------------------------
// Bêtes

function hen(feather: PaletteCell): Builder {
  return (b) => {
    b.ball(0.17, [0, 0.24, 0], feather, { scale: [1, 0.85, 1.25] });
    b.ball(0.09, [0, 0.42, 0.14], feather);
    b.box([0.03, 0.07, 0.07], [0, 0.52, 0.14], 'comb_red', {});
    b.cone(0.03, 0.06, [0, 0.42, 0.24], 'beak', { rotation: [90, 0, 0], segments: 4 });
    b.box([0.14, 0.12, 0.05], [0, 0.32, -0.2], feather, { rotation: [-35, 0, 0] });
    b.box([0.02, 0.12, 0.02], [0.06, 0, 0], 'beak', { base: true });
    b.box([0.02, 0.12, 0.02], [-0.06, 0, 0], 'beak', { base: true });
  };
}

const ANIMALS: Record<string, Builder> = {
  hen_white: hen('chicken_white'),
  hen_red: hen('chicken_russet'),
  hen_black: hen('chicken_black'),
  hen: hen('chicken_russet'),
};

// ---------------------------------------------------------------------------
// Train (avant vers l'est, +X, une fois posé sur la voie)

function wheels(b: ShapeBuilder, length: number, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const x = -length / 2 + (length / count) * (i + 0.5);
    for (const z of [-0.62, 0.62]) {
      b.cylinder(0.42, 0.42, 0.1, [x, 0.42, z], 'black', { rotation: [90, 0, 0], segments: 10 });
    }
  }
}

const TRAIN: Record<string, Builder> = {
  locomotive: (b) => {
    b.box([6.2, 0.4, 2.1], [0, 0.55, 0], 'black', { base: true });
    b.cylinder(0.85, 0.85, 4, [0.6, 1.8, 0], 'loco_green', { rotation: [0, 0, 90], segments: 10 });
    b.box([2.0, 2.0, 2.2], [-2.0, 0.95, 0], 'loco_green', { base: true });
    b.box([2.3, 0.15, 2.4], [-2.0, 2.95, 0], 'loco_green_light', { base: true });
    b.box([0.8, 0.6, 0.05], [-2.0, 2.0, 1.12], 'glass', {});
    b.box([0.8, 0.6, 0.05], [-2.0, 2.0, -1.12], 'glass', {});
    b.cylinder(0.24, 0.32, 0.9, [2.2, 2.55, 0], 'black', { base: true, segments: 8 });
    b.cylinder(0.3, 0.3, 0.1, [3.1, 1.8, 0], 'brass', { rotation: [0, 0, 90], segments: 10 });
    b.box([0.3, 0.5, 2.0], [3.15, 0.5, 0], 'loco_red', { base: true });
    wheels(b, 5, 3);
  },
  coach: (b) => {
    b.box([8, 0.35, 2.2], [0, 0.6, 0], 'black', { base: true });
    b.box(
      [7.8, 2.0, 2.3],
      [0, 0.95, 0],
      { top: 'coach_cream', side: 'coach_brown' },
      { base: true },
    );
    b.box([8.0, 0.2, 2.5], [0, 2.95, 0], 'lauze_dark', { base: true });
    for (let i = 0; i < 5; i += 1) {
      const x = -3 + i * 1.5;
      b.box([0.9, 0.7, 0.04], [x, 2.0, 1.16], 'glass', {});
      b.box([0.9, 0.7, 0.04], [x, 2.0, -1.16], 'glass', {});
    }
    b.box([7.82, 0.25, 2.32], [0, 1.55, 0], 'coach_cream', { base: true });
    wheels(b, 6.5, 2);
  },
  van: (b) => {
    b.box([6, 0.35, 2.1], [0, 0.6, 0], 'black', { base: true });
    b.box([5.8, 2.0, 2.2], [0, 0.95, 0], 'van_wood', { base: true });
    b.box([6.0, 0.18, 2.4], [0, 2.95, 0], 'lauze_dark', { base: true });
    b.box([1.4, 1.5, 0.05], [0, 1.1, 1.12], 'wood_dark', {});
    wheels(b, 4.6, 2);
  },
};
for (const [alias, original] of [
  ['loco', 'locomotive'],
  ['train_locomotive', 'locomotive'],
  ['train_coach', 'coach'],
  ['train_van', 'van'],
] as const) {
  const builder = TRAIN[original];
  if (builder !== undefined) {
    TRAIN[alias] = builder;
  }
}

// ---------------------------------------------------------------------------
// Décor du bourg (emprise `w` x `d` cases)

function cottage(wall: PaletteCell, roof: PaletteCell, trim: PaletteCell): Builder {
  return (b, w, d) => {
    const height = 2.6;
    b.box([w * 0.92, height, d * 0.85], [0, 0, 0], { top: wall, side: wall }, { base: true });
    const roofRise = Math.min(w, d) * 0.35;
    const slope = (Math.atan2(roofRise, (d * 0.85) / 2) * 180) / Math.PI;
    const run = Math.hypot(roofRise, (d * 0.85) / 2) + 0.35;
    for (const side of [-1, 1]) {
      b.box(
        [w * 0.98 + 0.3, 0.14, run],
        [0, height + roofRise / 2, side * (d * 0.85) * 0.25],
        roof,
        {
          rotation: [side * slope, 0, 0],
        },
      );
    }
    b.box([0.9, 1.7, 0.08], [0, 0, (d * 0.85) / 2 + 0.03], trim, { base: true });
    for (const x of [-w * 0.28, w * 0.28]) {
      b.box([0.75, 0.8, 0.06], [x, 1.25, (d * 0.85) / 2 + 0.03], 'glass', {});
      b.box([0.85, 0.08, 0.1], [x, 0.82, (d * 0.85) / 2 + 0.05], trim, {});
    }
    b.box([0.45, 0.9, 0.45], [w * 0.3, height + roofRise * 0.4, -d * 0.15], 'brick', {
      base: true,
    });
  };
}

const DECOR: Record<string, Builder> = {
  bench: (b) => {
    b.box([1.5, 0.06, 0.42], [0, 0.42, 0], 'wood', { base: true });
    b.box([1.5, 0.35, 0.05], [0, 0.5, -0.19], 'wood', { base: true });
    for (const x of [-0.62, 0.62]) {
      b.box([0.07, 0.42, 0.36], [x, 0, 0], 'iron', { base: true });
    }
  },
  bell: (b) => {
    b.cylinder(0.07, 0.09, 2.2, [0, 0, 0], 'iron', { base: true, segments: 6 });
    b.box([0.6, 0.06, 0.06], [0.2, 2.15, 0], 'iron', { base: true });
    b.cylinder(0.08, 0.17, 0.28, [0.4, 1.83, 0], 'brass', { base: true, segments: 9 });
  },
  well: (b) => {
    b.cylinder(
      0.7,
      0.75,
      0.75,
      [0, 0, 0],
      { top: 'water_deep', side: 'stone' },
      { base: true, segments: 10 },
    );
    b.cylinder(0.72, 0.72, 0.1, [0, 0.75, 0], 'stone_light', { base: true, segments: 10 });
    for (const x of [-0.62, 0.62]) {
      b.box([0.1, 1.5, 0.1], [x, 0.75, 0], 'wood_dark', { base: true });
    }
    b.cylinder(0.08, 0.08, 1.3, [0, 2.05, 0], 'wood', { rotation: [0, 0, 90], segments: 6 });
    b.box([1.6, 0.08, 1.0], [0, 2.4, 0], 'tile', { base: true, rotation: [0, 0, 0] });
    b.cylinder(0.12, 0.1, 0.18, [0.1, 1.4, 0], 'wood', { base: true, segments: 6 });
  },
  // Draisine (portée ou poussée à deux): plateau sur quatre roues, levier à balancier.
  handcar: (b) => {
    b.box([1.5, 0.12, 1.1], [0, 0.32, 0], { top: 'wood_new', side: 'wood_dark' }, { base: true });
    for (const x of [-0.55, 0.55]) {
      for (const z of [-0.5, 0.5]) {
        b.cylinder(0.22, 0.22, 0.06, [x, 0.22, z], 'iron', { rotation: [90, 0, 0], segments: 8 });
      }
    }
    b.box([0.12, 0.8, 0.12], [0, 0.44, 0], 'iron', { base: true });
    b.box([1.1, 0.06, 0.08], [0, 1.24, 0], 'wood', { rotation: [0, 0, 12] });
  },
  // Gros colis du train, porté à deux: caisse cerclée avec étiquette.
  parcel: (b) => {
    b.box([1.1, 0.6, 0.75], [0, 0, 0], { top: 'wood_new', side: 'wood' }, { base: true });
    for (const x of [-0.4, 0.4]) {
      b.box([0.05, 0.62, 0.77], [x, 0, 0], 'iron', { base: true });
    }
    b.box([0.3, 0.2, 0.01], [0, 0.25, 0.38], 'paper', {});
  },
  crate: (b, w, d) => {
    b.box([w * 0.85, 0.7, d * 0.75], [0, 0, 0], { top: 'wood_new', side: 'wood' }, { base: true });
    b.box([w * 0.87, 0.08, d * 0.77], [0, 0.55, 0], 'wood_dark', { base: true });
    b.box([w * 0.5, 0.2, 0.02], [0, 0.25, d * 0.38], 'paint_cream', {});
  },
  notice_board: (b) => {
    for (const x of [-0.7, 0.7]) {
      b.box([0.1, 2.0, 0.1], [x, 0, 0], 'wood_dark', { base: true });
    }
    b.box([1.6, 1.0, 0.08], [0, 1.0, 0], 'wood', { base: true });
    b.box([0.4, 0.5, 0.01], [-0.4, 1.25, 0.05], 'paper', {});
    b.box([0.35, 0.4, 0.01], [0.15, 1.2, 0.05], 'paper_dark', {});
    b.box([0.3, 0.35, 0.01], [0.55, 1.3, 0.05], 'paper', {});
    b.box([1.8, 0.1, 0.3], [0, 2.0, 0], 'tile_dark', { base: true });
  },
  barrel: (b) => {
    b.cylinder(
      0.3,
      0.34,
      0.9,
      [0, 0, 0],
      { top: 'water', side: 'wood' },
      { base: true, segments: 9 },
    );
    b.cylinder(0.35, 0.35, 0.05, [0, 0.2, 0], 'iron', { base: true, segments: 9 });
    b.cylinder(0.33, 0.33, 0.05, [0, 0.72, 0], 'iron', { base: true, segments: 9 });
  },
  fence: (b, w) => {
    const length = Math.max(1, w);
    for (let i = 0; i <= length; i += 1) {
      b.box([0.08, 0.8, 0.08], [-length / 2 + i, 0, 0], 'wood_old', { base: true });
    }
    b.box([length, 0.07, 0.04], [0, 0.55, 0], 'wood_old', { base: true });
    b.box([length, 0.07, 0.04], [0, 0.25, 0], 'wood_old', { base: true });
  },
  workbench: (b) => {
    b.box([2.0, 0.1, 0.8], [0, 0.85, 0], 'wood', { base: true });
    for (const x of [-0.85, 0.85]) {
      b.box([0.1, 0.85, 0.7], [x, 0, 0], 'wood_dark', { base: true });
    }
    b.box([0.6, 0.02, 0.15], [0.4, 0.95, 0.1], 'iron_light', { base: true });
    b.box([0.9, 0.12, 0.25], [-0.4, 0.95, -0.15], 'wood_new', { base: true });
  },
  woodpile: (b, w) => {
    const length = Math.max(1.5, w * 0.8);
    for (let row = 0; row < 3; row += 1) {
      for (let i = 0; i < 4 - row; i += 1) {
        b.cylinder(
          0.14,
          0.14,
          length,
          [(-1.5 + row * 0.5 + i) * 0.3, 0.14 + row * 0.25, 0],
          { top: 'log_end', side: 'bark' },
          {
            rotation: [0, 0, 90],
            segments: 7,
          },
        );
      }
    }
  },
  rock: (b) => {
    b.ball(0.45, [0, 0.2, 0], { top: 'rock_light', side: 'rock' }, { scale: [1.2, 0.7, 1] });
  },
  flowers: (b) => {
    const cells: PaletteCell[] = [
      'flower_red',
      'flower_yellow',
      'flower_white',
      'flower_blue',
      'flower_pink',
    ];
    b.blob(0.32, [0, 0.12, 0], 'leaf_bush', { scale: [1.3, 0.55, 1.3] });
    cells.forEach((cell, i) => {
      const angle = (i / cells.length) * Math.PI * 2;
      b.ball(0.07, [Math.cos(angle) * 0.25, 0.3, Math.sin(angle) * 0.25], cell);
    });
  },
  lamp_post: (b) => {
    b.cylinder(0.05, 0.08, 2.6, [0, 0, 0], 'iron', { base: true, segments: 6 });
    b.box([0.28, 0.32, 0.28], [0, 2.6, 0], 'glass_lamp', { base: true });
    b.cone(0.24, 0.18, [0, 2.92, 0], 'iron', { base: true, segments: 4, rotation: [0, 45, 0] });
  },
  station: cottage('plaster_cream', 'lauze', 'paint_green'),
  grocery: cottage('plaster_ochre', 'tile', 'paint_red'),
  firmin_house: cottage('plaster_rose', 'tile_dark', 'paint_blue'),
  sawmill: cottage('wood_old', 'lauze_dark', 'wood_dark'),
  shed: (b, w, d) => {
    b.box([w * 0.92, 2.4, d * 0.85], [0, 0, 0], 'wood_old_dark', { base: true });
    b.box([w * 0.98, 0.15, d * 0.95], [0, 2.4, 0], 'lauze_dark', {
      base: true,
      rotation: [0, 0, 4],
    });
    b.box([w * 0.5, 2.0, 0.06], [0, 0, (d * 0.85) / 2 + 0.03], 'wood_dark', { base: true });
  },
  awning: (b, w, d) => {
    for (const x of [-w * 0.42, w * 0.42]) {
      for (const z of [-d * 0.4, d * 0.4]) {
        b.box([0.12, 2.3, 0.12], [x, 0, z], 'wood_dark', { base: true });
      }
    }
    b.box([w * 0.95, 0.1, d * 0.95], [0, 2.3, 0], 'lauze', { base: true, rotation: [5, 0, 0] });
  },
  rails: (b, w) => {
    const length = Math.max(1, w);
    for (let i = 0; i < length; i += 1) {
      b.box([0.25, 0.1, 2.0], [-length / 2 + i + 0.5, 0, 0], 'wood_dark', { base: true });
    }
    for (const z of [-0.6, 0.6]) {
      b.box([length, 0.1, 0.08], [0, 0.1, z], 'rail_steel', { base: true });
    }
  },
  station_sign: (b) => {
    for (const x of [-0.8, 0.8]) {
      b.box([0.1, 2.3, 0.1], [x, 0, 0], 'iron', { base: true });
    }
    b.box([2.0, 0.5, 0.08], [0, 1.9, 0], 'paint_cream', { base: true });
    b.box([2.1, 0.06, 0.1], [0, 2.4, 0], 'paint_green', { base: true });
    b.box([2.1, 0.06, 0.1], [0, 1.88, 0], 'paint_green', { base: true });
  },
  mailbox: (b) => {
    b.box([0.08, 1.0, 0.08], [0, 0, 0], 'wood_dark', { base: true });
    b.box([0.35, 0.3, 0.25], [0, 1.0, 0], 'paint_yellow', { base: true });
    b.box([0.2, 0.03, 0.01], [0, 1.2, 0.13], 'black', {});
  },
  arbor: (b, w, d) => {
    for (const x of [-w * 0.42, w * 0.42]) {
      for (const z of [-d * 0.38, d * 0.38]) {
        b.box([0.12, 2.3, 0.12], [x, 0, z], 'wood', { base: true });
      }
    }
    for (let i = 0; i < 5; i += 1) {
      b.box([0.08, 0.08, d * 0.95], [-w * 0.45 + (i * w * 0.9) / 4, 2.3, 0], 'wood', {
        base: true,
      });
    }
    b.blob(0.5, [-w * 0.3, 2.45, 0.2], 'leaf_bush', { scale: [1.4, 0.5, 1.3] });
    b.blob(0.45, [w * 0.25, 2.45, -0.2], 'leaf_hazel', { scale: [1.5, 0.5, 1.2] });
    b.ball(0.07, [-w * 0.2, 2.6, 0.4], 'flower_pink');
    b.ball(0.07, [w * 0.3, 2.62, -0.1], 'flower_white');
    b.box([w * 0.55, 0.06, 0.9], [0, 0.72, 0], 'wood_new', { base: true });
    for (const x of [-w * 0.2, w * 0.2]) {
      b.box([0.08, 0.72, 0.6], [x, 0, 0], 'wood', { base: true });
    }
  },
  pontoon: (b, w, d) => {
    b.box(
      [w * 0.95, 0.1, d * 0.95],
      [0, 0.4, 0],
      { top: 'wood_old', side: 'wood_old_dark' },
      { base: true },
    );
    for (const x of [-w * 0.4, w * 0.4]) {
      for (const z of [-d * 0.4, 0, d * 0.4]) {
        b.cylinder(0.08, 0.08, 1.0, [x, -0.5, z], 'wood_old_dark', { base: true, segments: 5 });
      }
    }
  },
  platform: (b, w, d) => {
    b.box([w, 0.45, d], [0, 0, 0], { top: 'cobble', side: 'stone_dark' }, { base: true });
    b.box([w, 0.05, 0.25], [0, 0.45, d / 2 - 0.12], 'white_paint', { base: true });
  },
};

// ---------------------------------------------------------------------------
// Choix du substitut

const EXACT: Record<string, Builder> = {
  ...CROPS,
  ...TREES,
  ...ITEMS,
  ...FURNITURE,
  ...ANIMALS,
  ...TRAIN,
  ...DECOR,
  garden_cell_tilled: (b) => {
    mound(b, 'soil_tilled', 'soil_tilled_light');
  },
  garden_cell_tilled_wet: (b) => {
    mound(b, 'soil_wet', 'soil_wet_light');
  },
};

/** Mots-clés reconnus dans un nom inconnu (le premier qui correspond l'emporte). */
const KEYWORDS: readonly (readonly [RegExp, Builder])[] = [
  [/_stage_seed$/, CROPS.seed ?? unknownBuilder],
  [/oak|chene/, TREES.oak ?? unknownBuilder],
  [/fir|sapin|pine/, TREES.fir ?? unknownBuilder],
  [/stump|souche/, TREES.stump ?? unknownBuilder],
  [/bush|hedge|haie|massif/, TREES.bush ?? unknownBuilder],
  [/flower|fleur/, DECOR.flowers ?? unknownBuilder],
  [/bench|banc/, DECOR.bench ?? unknownBuilder],
  [/bell|cloche/, DECOR.bell ?? unknownBuilder],
  [/well|puits/, DECOR.well ?? unknownBuilder],
  [/crate|caisse/, DECOR.crate ?? unknownBuilder],
  [/board|tableau/, DECOR.notice_board ?? unknownBuilder],
  [/barrel|tonneau/, DECOR.barrel ?? unknownBuilder],
  [/fence|barriere|gate/, DECOR.fence ?? unknownBuilder],
  [/workbench|etabli/, DECOR.workbench ?? unknownBuilder],
  [/woodpile|log_pile|bois/, DECOR.woodpile ?? unknownBuilder],
  [/rock|stone|pierre/, DECOR.rock ?? unknownBuilder],
  [/lamp|lanterne|reverbere/, DECOR.lamp_post ?? unknownBuilder],
  [/rail|track|voie/, DECOR.rails ?? unknownBuilder],
  [/platform|quay|quai/, DECOR.platform ?? unknownBuilder],
  [/awning|auvent/, DECOR.awning ?? unknownBuilder],
  [/shed|remise/, DECOR.shed ?? unknownBuilder],
  [/sawmill|scierie/, DECOR.sawmill ?? unknownBuilder],
  [/grocery|epicerie|shop/, DECOR.grocery ?? unknownBuilder],
  [/station|halte/, DECOR.station ?? unknownBuilder],
  [/house|maison/, DECOR.firmin_house ?? unknownBuilder],
  [/hen|poule/, ANIMALS.hen ?? unknownBuilder],
  [/loco/, TRAIN.locomotive ?? unknownBuilder],
  [/coach|voiture/, TRAIN.coach ?? unknownBuilder],
  [/van|fourgon/, TRAIN.van ?? unknownBuilder],
];

/** Caisse rayée jaune et noir: signale un modèle inconnu sans rien casser. */
function unknownBuilder(b: ShapeBuilder, w: number, d: number): void {
  const height = 0.8;
  const stripe = height / STRIPE_COUNT;
  for (let i = 0; i < STRIPE_COUNT; i += 1) {
    const paint: Paint = i % 2 === 0 ? 'paint_yellow' : 'black';
    b.box([w * 0.8, stripe, d * 0.8], [0, i * stripe, 0], paint, { base: true });
  }
}

function sizeOf(name: string, hints: SubstituteHints): { w: number; d: number } {
  const building =
    /house|maison|station|halte|grocery|epicerie|sawmill|scierie|shed|remise|awning|platform|quai/.test(
      name,
    );
  const fallback = building ? DEFAULT_BUILDING_SIZE : DEFAULT_PROP_SIZE;
  return { w: hints.width ?? fallback, d: hints.depth ?? fallback };
}

/** Pièces du substitut d'un modèle (une seule pièce, sauf exceptions). */
export function buildSubstitute(name: string, hints: SubstituteHints = {}): SubstitutePart[] {
  const builder =
    EXACT[name] ?? KEYWORDS.find(([pattern]) => pattern.test(name))?.[1] ?? unknownBuilder;
  const { w, d } = sizeOf(name, hints);
  const shapes = new ShapeBuilder();
  builder(shapes, w, d);
  const smallThings = /_stage_|garden_cell|rug|egg|card|key|photo|seed_packet/.test(name);
  return [{ name, geometry: shapes.build(), castShadow: !smallThings }];
}

/** Vrai si un substitut dédié existe pour ce nom (sinon caisse rayée). */
export function hasDedicatedSubstitute(name: string): boolean {
  return name in EXACT || KEYWORDS.some(([pattern]) => pattern.test(name));
}

export type { Triple };
