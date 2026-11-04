/**
 * Le potager: herbe, terre bêchée, terre arrosée (plus sombre et brillante,
 * matériau de l'artiste), et les cultures à leurs stades (`<culture>_stage_<stade>`).
 * Un stade qui change fait un petit « pop »; une culture mûre ondule un peu.
 * Les arbres de la lisière tremblent sous la hache, tombent, laissent une souche; après la démo,
 * la souche rejette (chêne) ou Basile replante (sapin), jusqu'à l'arbre adulte (tour 8).
 */
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Cell, GardenCell, DeepReadonly, Tree } from '../etat/types';
import type { GameMap } from '../etat/carte';
import { fricheCells } from '../etat/parcelles';
import type { Content } from '../donnees/types';

import type { FrameContext, PickRegistry, PickTarget } from './contexte';
import { setStandingBox } from './contexte';
import { InstancedBatches } from './lots';
import { hash2 } from './bruit';
import type { SharedMaterials } from './materiaux';
import { textHash, type ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';
import type { WorldEvent } from '../etat/types';
import type { Settings } from '../donnees/types';
import { treeGrowth } from '../etat/repousse';

const SETTINGS = RENDER_SETTINGS.garden;
/**
 * Instances par modèle du potager (0.13, PL-22): 40 parcelles à soi et 40 louées au plus, avec
 * une marge (une sauvegarde d'avant le plafond, un tracé qui arrive pendant une reprise).
 */
export const GARDEN_CAPACITY = 96;
/** Ronciers de la friche (0.13): une case de friche au plus chacun. */
const FRICHE_CAPACITY = 64;
const FRICHE_MODEL = 'bush_bramble';
const BRAMBLE_SEED = 41;
const RIPE_SWAY = 0.06;
const RIPE_SWAY_SPEED = 1.7;
const POP_START_SCALE = 0.55;
const TREE_CAPACITY = 16;
const SHAKE_SECONDS = 0.45;
const SHAKE_ANGLE = 0.07;
const SHAKE_SPEED = 38;
const FALL_SECONDS = 1.3;
const FALL_SINK_SECONDS = 0.6;
const TREE_PICK_RADIUS = 0.55;
const TREE_PICK_HEIGHT = 3;
/** Tour 8 (section 5.1): repère d'une souche ou d'un rejet visé à la souris (m). */
const STUMP_PICK_RADIUS = 0.4;
const STUMP_PICK_HEIGHT = 0.6;
/** Le refus de la hache sur un rejet: un petit tremblement (part de celui d'un coup). */
const REFUSED_SHAKE = 0.5;
/**
 * Brins du rejet de chêne (`grow_nodes` du nœud `oak_sapling_shoots`): chacun mis à l'échelle
 * autour de son pied, sur le flanc de la souche, de 0,4 à 1 (fiche du modèle, tour 8).
 */
const OAK_SHOOTS_MODEL = 'oak_sapling_shoots';
const OAK_SHOOT_MODELS: readonly string[] = [
  'oak_sapling_shoot_a',
  'oak_sapling_shoot_b',
  'oak_sapling_shoot_c',
  'oak_sapling_shoot_d',
];
const OAK_SHOOTS_SCALE: readonly [number, number] = [0.4, 1];
/** Hauteur du nœud des brins au-dessus du sol (dessus de la souche) quand le modèle ne la donne pas (m). */
const OAK_SHOOTS_LIFT = 0.42;
const OAK_SHOOTS_TOP = 1.68;
/** Jeune sapin replanté par Basile: agrandi d'un bloc, de 0,7 à 1,3 (fiche du modèle). */
const FIR_SAPLING_MODEL = 'fir_sapling';
const FIR_SAPLING_SCALE: readonly [number, number] = [0.7, 1.3];
const FIR_SAPLING_TOP = 1.24;
/** Place du plant à côté de la souche (`beside_stump`, repère glTF, sans rotation) si le modèle ne la donne pas. */
const FIR_BESIDE_STUMP: readonly [number, number, number] = [0, 0, 0.6];

/** Noms des brins lus dans les `extras` du modèle, sinon la liste connue. */
function growNodes(extras: Readonly<Record<string, unknown>>): readonly string[] {
  const names = extras.grow_nodes;
  return Array.isArray(names) &&
    names.length > 0 &&
    names.every((n): n is string => typeof n === 'string')
    ? names
    : OAK_SHOOT_MODELS;
}

/** Décalage `beside_stump` validé (trois nombres), sinon la valeur de la fiche. */
function besideStump(extras: Readonly<Record<string, unknown>>): readonly number[] {
  const offset = extras.beside_stump;
  return Array.isArray(offset) &&
    offset.length === 3 &&
    offset.every((n): n is number => typeof n === 'number' && Number.isFinite(n))
    ? offset
    : FIR_BESIDE_STUMP;
}

function cellKey(cell: { cx: number; cy: number }): string {
  return `${cell.cx}:${cell.cy}`;
}

/** Courbe qui dépasse un peu sa cible avant de s'y poser. */
function easeOutBack(t: number, overshoot: number): number {
  const c = 1 + overshoot * 10;
  const u = t - 1;
  return 1 + c * u * u * u + overshoot * 10 * u * u;
}

export class GardenPart implements EventfulPart {
  readonly batches: InstancedBatches;
  readonly trees: InstancedBatches;
  /** 0.13: les ronciers des cases de friche pas encore défrichées. */
  readonly friche: InstancedBatches;
  /** 0.13: instant où chaque parcelle posée commence à sortir de terre (vague d'un rectangle). */
  private readonly appearAt = new Map<string, number>();
  private readonly fricheCells: readonly Cell[];
  private readonly fricheMatrices: Matrix4[];
  private readonly lastStage = new Map<string, string>();
  private readonly popStart = new Map<string, number>();
  private readonly shakeStart = new Map<string, number>();
  private readonly fallStart = new Map<string, { time: number; direction: number }>();
  private readonly treePicks = new Map<string, PickTarget>();
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly euler = new Euler();
  private readonly scale = new Vector3();
  private readonly shootMatrix = new Matrix4();
  private readonly localMatrix = new Matrix4();
  /** Pied de ce qui pousse sur la case (plant ou souche), pour la cible de clic. */
  private readonly youngFoot = new Vector3();
  private time = 0;

  constructor(
    library: ModelLibrary,
    materials: SharedMaterials,
    private readonly terrain: Terrain,
    resources: ResourceTracker,
    private readonly picks: PickRegistry,
    private readonly treeRules: Settings['trees'] | null = null,
    plots: { content: Content; map: GameMap } | null = null,
  ) {
    this.fricheCells = plots === null ? [] : fricheCells(plots.content, plots.map);
    this.friche = new InstancedBatches('friche', library, materials, resources, FRICHE_CAPACITY, false);
    // Cultures et mottes restent basses: leur ombre ne se verrait pas, on l'économise.
    this.batches = new InstancedBatches(
      'potager',
      library,
      materials,
      resources,
      GARDEN_CAPACITY,
      false,
    );
    this.trees = new InstancedBatches(
      'arbres de la lisiere',
      library,
      materials,
      resources,
      TREE_CAPACITY,
      true,
      // Par morceaux: hors du cadre, ni triangles ni ombre (ADR 0016).
      RENDER_SETTINGS.terrain.edgeTreeChunk,
    );
    this.library = library;
    this.fricheMatrices = this.fricheCells.map((cell) => this.brambleMatrix(cell));
  }


  private readonly library: ModelLibrary;

  handleEvent(event: WorldEvent, context: FrameContext): void {
    if (event.type === 'plot_placed') {
      if (context.reducedMotion) return;
      // Rangée par rangée, dans l'ordre du tracé: la première rangée tout de suite.
      const rows: number[] = [];
      for (const cell of event.cells) {
        if (!rows.includes(cell.cy)) rows.push(cell.cy);
        this.appearAt.set(cellKey(cell), this.time + rows.indexOf(cell.cy) * SETTINGS.waveSeconds);
      }
      return;
    }
    if (event.type === 'chop_refused') {
      if (event.reason === 'young') {
        this.shakeStart.set(event.tree, this.time);
      }
      return;
    }
    if (event.type === 'tree_regrown') {
      this.fallStart.delete(event.tree);
      this.shakeStart.delete(event.tree);
      return;
    }
    if (event.type !== 'chop') {
      return;
    }
    this.shakeStart.set(event.tree, this.time);
    if (event.felled) {
      const tree = context.world.trees.find((candidate) => candidate.id === event.tree);
      const chopper = context.world.characters.find((character) => character.id === event.by);
      const direction =
        tree !== undefined && chopper !== undefined
          ? Math.atan2(tree.pos.y - chopper.pos.y, tree.pos.x - chopper.pos.x)
          : 0;
      this.fallStart.set(event.tree, { time: this.time, direction });
    }
  }

  update(context: FrameContext): void {
    this.time = context.time;
    this.updateGarden(context.world.garden, context);
    this.updateFriche(context);
    this.updateTrees(context.world.trees, context);
  }

  /** Un roncier bas sur chaque case de friche encore à défricher (taille et cap tirés de la case). */
  private updateFriche(context: FrameContext): void {
    this.friche.begin();
    const cleared = context.world.plots.clearedCells;
    this.fricheCells.forEach((cell, i) => {
      const placed = this.fricheMatrices[i];
      if (placed === undefined || cleared.some(([cx, cy]) => cx === cell.cx && cy === cell.cy)) return;
      this.friche.add(FRICHE_MODEL, placed);
    });
    this.friche.end();
  }

  /** Place de chaque roncier, tirée de sa case une fois pour toutes (rien d'alloué par image). */
  private brambleMatrix(cell: Cell): Matrix4 {
    // Un roncier bas et étalé, jamais deux pareils: écart, cap, taille et allongement tirés de la case.
    const jx = hash2(cell.cx, cell.cy, BRAMBLE_SEED) - 0.5;
    const jy = hash2(cell.cx, cell.cy, BRAMBLE_SEED + 1) - 0.5;
    const size = hash2(cell.cx, cell.cy, BRAMBLE_SEED + 2);
    const stretch = hash2(cell.cx, cell.cy, BRAMBLE_SEED + 3);
    const x = cell.cx + 0.5 + jx * SETTINGS.brambleJitter;
    const y = cell.cy + 0.5 + jy * SETTINGS.brambleJitter;
    const [low, high] = SETTINGS.brambleScale;
    const s = low + size * (high - low);
    this.position.set(x, this.terrain.heightAt(x, y), y);
    this.rotation.setFromEuler(this.euler.set(0, hash2(cell.cx, cell.cy, BRAMBLE_SEED + 4) * Math.PI * 2, 0));
    this.scale.set(s * (1 + 0.45 * stretch), s * (0.65 + 0.3 * (1 - stretch)), s * (1 + 0.25 * size));
    return new Matrix4().compose(this.position, this.rotation, this.scale);
  }

  private updateGarden(cells: readonly DeepReadonly<GardenCell>[], context: FrameContext): void {
    this.batches.begin();
    for (const cell of cells) {
      // Numéro stable de la parcelle (0.13): le cap des plants ne change pas quand une voisine part.
      const index = cell.index;
      const x = cell.cell.cx + 0.5;
      const y = cell.cell.cy + 0.5;
      const ground = this.terrain.heightAt(x, y);
      const soil =
        cell.soil === 'grass'
          ? 'garden_cell_grass'
          : cell.wet
            ? 'garden_cell_tilled_wet'
            : 'garden_cell_tilled';
      const key = cellKey(cell.cell);
      // Une parcelle qui vient d'être posée sort de terre (vague du rectangle).
      const appear = this.appearAt.get(key);
      const u = appear === undefined ? 1 : (context.time - appear) / SETTINGS.plotAppearSeconds;
      if (u >= 1 && appear !== undefined) this.appearAt.delete(key);
      if (u < 1) {
        const grow = u <= 0 ? 0.001 : Math.max(0.001, easeOutBack(u, SETTINGS.growPopOvershoot));
        this.position.set(x, ground, y);
        this.rotation.identity();
        this.scale.set(grow, grow, grow);
        this.matrix.compose(this.position, this.rotation, this.scale);
      } else {
        this.matrix.makeTranslation(x, ground, y);
      }
      this.batches.add(soil, this.matrix);
      const crop = cell.crop;
      const stage = crop === null ? '' : `${crop.crop}_stage_${crop.stage}`;
      if (this.lastStage.get(key) !== stage) {
        if (this.lastStage.has(key) && stage !== '' && !context.reducedMotion) {
          this.popStart.set(key, context.time);
        }
        this.lastStage.set(key, stage);
      }
      if (crop === null) {
        continue;
      }
      const popAt = this.popStart.get(key);
      const t =
        popAt === undefined ? 1 : Math.min(1, (context.time - popAt) / SETTINGS.growPopSeconds);
      const size =
        t >= 1
          ? 1
          : POP_START_SCALE + (1 - POP_START_SCALE) * easeOutBack(t, SETTINGS.growPopOvershoot);
      const sway = crop.ripe ? Math.sin(context.time * RIPE_SWAY_SPEED + index) * RIPE_SWAY : 0;
      this.position.set(x, ground, y);
      this.rotation.setFromEuler(this.euler.set(sway, (index * Math.PI) / 2, sway / 2));
      this.scale.setScalar(size);
      this.batches.add(stage, this.matrix.compose(this.position, this.rotation, this.scale));
    }
    this.batches.end();
  }

  private updateTrees(trees: readonly DeepReadonly<Tree>[], context: FrameContext): void {
    this.trees.begin();
    for (const tree of trees) {
      const ground = this.terrain.heightAt(tree.pos.x, tree.pos.y);
      const model = this.library.resolve(tree.kind === 'fir' ? 'tree_fir' : 'tree_oak', 'lisiere');
      let pick = this.treePicks.get(tree.id);
      if (pick === undefined) {
        pick = this.picks.add({ kind: 'tree', tree: tree.id });
        this.treePicks.set(tree.id, pick);
      }
      const fall = this.fallStart.get(tree.id);
      const fallT =
        fall === undefined ? (tree.felled ? 1 : 0) : (context.time - fall.time) / FALL_SECONDS;
      if (tree.felled) {
        const height = this.drawYoung(tree, ground, context);
        // Visée à la souris: la hache refuse et dit pourquoi (tour 8, section 9).
        setStandingBox(
          pick.box,
          this.youngFoot.x,
          this.youngFoot.y,
          this.youngFoot.z,
          STUMP_PICK_RADIUS,
          Math.max(STUMP_PICK_HEIGHT, height),
        );
        pick.enabled = this.treeRules?.regrow === true;
      } else {
        setStandingBox(
          pick.box,
          tree.pos.x,
          ground,
          tree.pos.y,
          TREE_PICK_RADIUS,
          TREE_PICK_HEIGHT,
        );
        pick.enabled = true;
      }
      const sinkT = fallT - 1;
      // Abattu sans chute en cours (partie reprise, page de démonstration): plus de tronc debout.
      if (tree.felled && (fall === undefined || sinkT * FALL_SECONDS > FALL_SINK_SECONDS)) {
        continue;
      }
      const shakeAt = this.shakeStart.get(tree.id);
      const shakeT = shakeAt === undefined ? 1 : (context.time - shakeAt) / SHAKE_SECONDS;
      const shake = shakeT < 1 ? Math.sin(shakeT * SHAKE_SPEED) * SHAKE_ANGLE * (1 - shakeT) : 0;
      let tilt = shake;
      let sink = 0;
      if (tree.felled && fall !== undefined) {
        const t = Math.min(1, fallT);
        tilt = (t * t * Math.PI) / 2;
        sink = sinkT > 0 ? sinkT * FALL_SECONDS : 0;
      }
      const direction = fall?.direction ?? 0;
      // L'arbre bascule autour de sa base, dans le sens opposé au bûcheron.
      this.euler.set(Math.sin(direction) * tilt, 0, -Math.cos(direction) * tilt, 'XYZ');
      this.rotation.setFromEuler(this.euler);
      this.position.set(tree.pos.x, ground - sink, tree.pos.y);
      this.scale.setScalar(1);
      this.trees.add(model, this.matrix.compose(this.position, this.rotation, this.scale));
    }
    this.trees.end();
  }

  /**
   * Souche, rejet de chêne (la souche et ses brins, chacun mis à l'échelle autour de son pied) ou
   * jeune sapin replanté à côté de la souche (tour 8, section 5.1), d'après `etat/repousse.ts`.
   * Rend la hauteur dessinée (m) et place `youngFoot` au pied de ce qu'il faut viser.
   */
  private drawYoung(tree: DeepReadonly<Tree>, ground: number, context: FrameContext): number {
    const growth =
      this.treeRules === null
        ? { stage: 'stump' as const, scale: 0 }
        : treeGrowth(this.treeRules, tree, context.world.clock.day);
    const young = growth.stage === 'sapling';
    const rules = this.treeRules?.saplingScale;
    const t =
      !young || rules === undefined || rules.max <= rules.first
        ? 1
        : Math.min(1, Math.max(0, (growth.scale - rules.first) / (rules.max - rules.first)));
    const shakeAt = this.shakeStart.get(tree.id);
    const shakeT = shakeAt === undefined ? 1 : (context.time - shakeAt) / SHAKE_SECONDS;
    const shake =
      young && shakeT < 1 && !context.reducedMotion
        ? Math.sin(shakeT * SHAKE_SPEED) * SHAKE_ANGLE * REFUSED_SHAKE * (1 - shakeT)
        : 0;
    this.euler.set(shake, (textHash(tree.id) % 4) * (Math.PI / 2), shake / 2, 'XYZ');
    this.rotation.setFromEuler(this.euler);
    // La souche de l'abattage reste au centre de la case dans tous les cas.
    this.matrix.makeTranslation(tree.pos.x, ground, tree.pos.y);
    this.trees.add('stump', this.matrix);
    this.youngFoot.set(tree.pos.x, ground, tree.pos.y);
    if (!young) {
      return STUMP_PICK_HEIGHT;
    }
    if (tree.kind === 'fir') {
      // On ne dessouche pas pour replanter: Basile pose le plant à côté, au sud de la souche.
      // Le décalage ne tourne pas avec le lacet; le plant tourne et grandit autour de son pied.
      const offset = besideStump(this.library.extras(FIR_SAPLING_MODEL));
      const px = tree.pos.x + (offset[0] ?? 0);
      const pz = tree.pos.y + (offset[2] ?? 0);
      // Sol pris sous le plant lui-même: sur une pente, sa cuvette ne flotte pas.
      const py = this.terrain.heightAt(px, pz) + (offset[1] ?? 0);
      const size = FIR_SAPLING_SCALE[0] + (FIR_SAPLING_SCALE[1] - FIR_SAPLING_SCALE[0]) * t;
      this.position.set(px, py, pz);
      this.scale.setScalar(size);
      this.trees.add(
        FIR_SAPLING_MODEL,
        this.matrix.compose(this.position, this.rotation, this.scale),
      );
      this.youngFoot.set(px, py, pz);
      return FIR_SAPLING_TOP * size;
    }
    // Le chêne rejette du flanc de sa souche: chaque brin grandit seul autour de son pied,
    // T(arbre, sol + nœud des brins) x R(lacet) x T(pied du brin) x S(taille).
    const shoots = this.library.node(OAK_SHOOTS_MODEL);
    const lift = shoots?.position.y ?? OAK_SHOOTS_LIFT;
    const size = OAK_SHOOTS_SCALE[0] + (OAK_SHOOTS_SCALE[1] - OAK_SHOOTS_SCALE[0]) * t;
    this.position.set(tree.pos.x, ground + lift, tree.pos.y);
    this.scale.setScalar(1);
    this.shootMatrix.compose(this.position, this.rotation, this.scale);
    let footY = 0;
    for (const name of growNodes(shoots?.userData ?? {})) {
      const foot = this.library.node(name)?.position;
      if (foot === undefined) {
        continue;
      }
      footY = foot.y;
      this.localMatrix.makeScale(size, size, size).setPosition(foot.x, foot.y, foot.z);
      this.trees.add(name, this.matrix.multiplyMatrices(this.shootMatrix, this.localMatrix));
    }
    const footHeight = lift + footY;
    return footHeight + (OAK_SHOOTS_TOP - footHeight) * size;
  }
}
