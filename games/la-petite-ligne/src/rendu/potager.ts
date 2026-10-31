/**
 * Le potager: herbe, terre bêchée, terre arrosée (plus sombre et brillante,
 * matériau de l'artiste), et les cultures à leurs stades (`<culture>_stage_<stade>`).
 * Un stade qui change fait un petit « pop »; une culture mûre ondule un peu.
 * Les arbres de la lisière tremblent sous la hache, tombent, laissent une souche.
 */
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { GardenCell, DeepReadonly, Tree } from '../etat/types';
import type { FrameContext, PickRegistry, PickTarget } from './contexte';
import { setStandingBox } from './contexte';
import { InstancedBatches } from './lots';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';
import type { WorldEvent } from '../etat/types';

const SETTINGS = RENDER_SETTINGS.garden;
const GARDEN_CAPACITY = 16;
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
  private time = 0;

  constructor(
    library: ModelLibrary,
    materials: SharedMaterials,
    private readonly terrain: Terrain,
    resources: ResourceTracker,
    private readonly picks: PickRegistry,
  ) {
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
    );
    this.library = library;
  }

  private readonly library: ModelLibrary;

  handleEvent(event: WorldEvent, context: FrameContext): void {
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
    this.updateTrees(context.world.trees, context);
  }

  private updateGarden(cells: readonly DeepReadonly<GardenCell>[], context: FrameContext): void {
    this.batches.begin();
    cells.forEach((cell, index) => {
      const x = cell.cell.cx + 0.5;
      const y = cell.cell.cy + 0.5;
      const ground = this.terrain.heightAt(x, y);
      const soil =
        cell.soil === 'grass'
          ? 'garden_cell_grass'
          : cell.wet
            ? 'garden_cell_tilled_wet'
            : 'garden_cell_tilled';
      this.matrix.makeTranslation(x, ground, y);
      this.batches.add(soil, this.matrix);
      const key = cellKey(cell.cell);
      const crop = cell.crop;
      const stage = crop === null ? '' : `${crop.crop}_stage_${crop.stage}`;
      if (this.lastStage.get(key) !== stage) {
        if (this.lastStage.has(key) && stage !== '' && !context.reducedMotion) {
          this.popStart.set(key, context.time);
        }
        this.lastStage.set(key, stage);
      }
      if (crop === null) {
        return;
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
    });
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
        this.matrix.makeTranslation(tree.pos.x, ground, tree.pos.y);
        this.trees.add('stump', this.matrix);
        pick.enabled = false;
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
      if (tree.felled && sinkT * FALL_SECONDS > FALL_SINK_SECONDS) {
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
}
