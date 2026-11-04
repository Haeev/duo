/**
 * Ce que le tour 9 pose dans le bourg (conception, sections 2.6, 2.7 et 4.4):
 *
 * - les chantiers bâtis par Basile, chacun à sa place de la carte (`map.improvements`), visibles
 *   dès le matin où `builtDay` est posé: le banc du gué, les trois jardinières du quai (fleurs de
 *   la saison), le toit du puits (l'arceau du puits ouvert s'efface), le réverbère du chemin, le
 *   banc du pignon et l'auvent de la porte (dans le repère de la maisonnette);
 * - la marelle à la craie de Jeanne sur la place, une fois les craies offertes, effacée les jours
 *   de pluie;
 * - l'allumage des lampadaires (`lampes.ts`): le réverbère éteint tant qu'il n'est pas bâti, les
 *   lampadaires éteints pendant l'attente des lanternes du quai, la flamme allumée seule qui
 *   vacille et s'éteint, puis la vague de l'apogée; un verre sombre posé sur la lanterne éteinte
 *   (le verre du décor fusionné s'allume avec la nuit, pour tous à la fois).
 *
 * Tout se lit dans l'état (`improvements`, `giftsGiven`, `moments.today`): mêmes images chez
 * l'hôte et chez l'invité, et après une partie reprise.
 */
import { isBuiltByFlag } from '../etat/drapeaux';
import { BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, Vector3, type InstancedMesh, type Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seasonOfDay } from '../donnees/calendrier';
import type { Content, MomentDef } from '../donnees/types';
import type { GameMap, MapImprovement, MapProp } from '../etat/carte';
import { SIM_HZ, type ReadonlyWorld } from '../etat/types';
import type { FrameContext } from './contexte';
import { bakeGeometry, DYNAMIC_PART_NODES, propMatrix } from './decor';
import { ShapeBuilder } from './geometrie';
import { createInstanced, finishInstances } from './instances';
import { LAMP_MODELS, lampIds, type LampBoard } from './lampes';
import { cellAt, GLOWING_CELLS } from './lueurs';
import type { HousePart } from './maison';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { applyShadows } from './ombre-tri';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const SETTINGS = RENDER_SETTINGS.improvements;
const TRIANGLE = 3;
const QUAY_LANTERNS = 'quay_lanterns';
const HOUSE_PROP = 'gatekeeper_house';
const WELL_PROP = 'well';
const GALLOWS = 'well_gallows';
const SEASON_INDEX: Readonly<Record<string, number>> = { spring: 0, summer: 1, autumn: 2, winter: 3 };

/** Un chantier dessiné: ses objets (un par case pour les jardinières) et ses enfants de saison. */
interface ImprovementView {
  improvement: MapImprovement;
  objects: Object3D[];
  /** Enfants à n'afficher qu'en leur saison (`extras.seasons` du modèle), par objet. */
  seasonal: { node: Object3D; season: string }[];
}

function isMesh(object: Object3D): object is Mesh {
  return object instanceof Mesh;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Nombres lus dans `render` d'un moment (données propres au rendu), avec leur valeur par défaut. */
function renderNumber(def: MomentDef, key: string, fallback: number): number {
  const value = def.render[key];
  return typeof value === 'number' ? value : fallback;
}

function renderStrings(def: MomentDef, key: string): string[] {
  const value = def.render[key];
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

/** `[[id, instant], ...]` de `render.lamps` (la vague des lampadaires de l'apogée). */
function renderSchedule(def: MomentDef): [string, number][] {
  const value = def.render.lamps;
  if (!Array.isArray(value)) return [];
  const out: [string, number][] = [];
  for (const entry of value as unknown[]) {
    if (!Array.isArray(entry)) continue;
    const [id, at] = entry as unknown[];
    if (typeof id === 'string' && typeof at === 'number') out.push([id, at]);
  }
  return out;
}

export class ImprovementsPart implements EventfulPart {
  readonly group = new Group();
  private readonly views: ImprovementView[] = [];
  private gallows: Mesh | null = null;
  /**
   * Tout ce qui ne bouge plus, fusionné en un maillage (un appel de dessin et une ombre, quel que
   * soit le nombre de chantiers à l'écran): chantiers bâtis (sauf l'auvent), arceau du puits ouvert,
   * marelle. Refait quand sa signature change (chantier bâti, saison, pluie, toit du puits).
   */
  private merged: Mesh | null = null;
  private mergedSignature = -1;
  private readonly material: SharedMaterials['palette'];
  private readonly lamps: string[];
  /** Verre sombre des lanternes éteintes: une instance par lampadaire, à l'échelle nulle quand il est allumé. */
  private readonly darkGlass: InstancedMesh | null;
  private readonly darkPlacements: Matrix4[] = [];
  private readonly hopscotch: Mesh | null;
  private readonly quayLanterns: LanternPlan | null;
  private readonly hidden = new Matrix4().makeScale(0, 0, 0);
  private readonly canopyFacing = new Vector3(0, 0, 1);
  private canopy: Object3D | null = null;

  constructor(
    private readonly map: GameMap,
    private readonly content: Content,
    private readonly library: ModelLibrary,
    materials: SharedMaterials,
    private readonly terrain: Terrain,
    private readonly resources: ResourceTracker,
    private readonly house: HousePart,
    private readonly board: LampBoard,
  ) {
    this.group.name = 'chantiers';
    this.material = materials.palette;
    this.quayLanterns = lanternPlan(content.moments.find((m) => m.id === QUAY_LANTERNS) ?? null);
    for (const improvement of Object.values(map.improvements ?? {})) {
      this.views.push(this.buildView(improvement));
    }
    this.gallows = this.buildGallows();
    this.lamps = lampIds(map);
    this.darkGlass = this.buildDarkGlass(materials);
    this.hopscotch = this.buildHopscotch(materials);
  }

  /** Nœud dessiné pour un chantier: celui de l'artiste au nom du chantier s'il existe (`ford_bench`), sinon le type de la carte. */
  private modelOf(improvement: MapImprovement): string {
    const own = SETTINGS.models[improvement.id] ?? improvement.id;
    return this.library.has(own) ? own : improvement.model;
  }

  private buildView(improvement: MapImprovement): ImprovementView {
    const model = this.modelOf(improvement);
    const view: ImprovementView = { improvement, objects: [], seasonal: [] };
    // Une jardinière par case; les autres chantiers à leur place, tournés par quarts.
    const places: MapProp[] = SETTINGS.onePerCell.includes(improvement.id)
      ? improvement.cells.map((cell) => ({ ...improvement, rect: null, pos: { x: cell.cx + 0.5, y: cell.cy + 0.5 } }))
      : [improvement];
    for (const place of places) {
      const object = this.library.instantiate(model);
      object.name = `chantier ${improvement.id}`;
      const matrix = this.placement(improvement, place, new Matrix4());
      matrix.decompose(object.position, object.quaternion, object.scale);
      applyShadows(object);
      // Hors de la scène: ses pièces visibles sont fusionnées (`rebuild`).
      object.visible = true;
      const seasons = object.userData.seasons as unknown;
      if (typeof seasons === 'object' && seasons !== null) {
        for (const [season, child] of Object.entries(seasons as Record<string, unknown>)) {
          const node = typeof child === 'string' ? object.getObjectByName(child) : undefined;
          if (node !== undefined) view.seasonal.push({ node, season });
        }
      }
      if (improvement.id === SETTINGS.canopy) this.canopy = object;
      view.objects.push(object);
    }
    return view;
  }

  /**
   * Pose d'un chantier: l'auvent dans le repère de la maisonnette (`canopyOffset` devant son
   * origine, extras de l'artiste), le reste au centre de sa place, au sol, tourné par quarts.
   */
  private placement(improvement: MapImprovement, place: MapProp, out: Matrix4): Matrix4 {
    const house = this.map.props.find((prop) => prop.model === HOUSE_PROP);
    if (improvement.id === SETTINGS.canopy && house !== undefined) {
      const [x, y, z] = SETTINGS.canopyOffset;
      return propMatrix(house, 0, out).multiply(new Matrix4().makeTranslation(x, y, z));
    }
    return propMatrix(place, this.terrain.heightAt(place.pos.x, place.pos.y), out);
  }

  /** L'arceau du puits ouvert (retiré du décor fusionné), à sa place dans le modèle du puits. */
  private buildGallows(): Mesh | null {
    const well = this.map.props.find((prop) => prop.model === WELL_PROP);
    if (well === undefined) return null;
    const part = this.library.parts(well.model, {}, well.id).find((p) => DYNAMIC_PART_NODES.has(p.name) && p.name === GALLOWS);
    if (part === undefined) return null;
    const mesh = new Mesh(part.geometry, part.material);
    mesh.name = GALLOWS;
    mesh.matrixAutoUpdate = false;
    // Hors de la scène: sa pose sert à la fusion (`matrixWorld` = `matrix`).
    propMatrix(well, this.terrain.heightAt(well.pos.x, well.pos.y), mesh.matrix).multiply(part.matrix);
    mesh.matrixWorld.copy(mesh.matrix);
    return mesh;
  }

  /**
   * Verre sombre d'une lanterne éteinte: les faces lumineuses du lampadaire (verre, flamme),
   * repeintes sur une case sans émission et grossies un peu autour de la lanterne pour couvrir
   * le verre du décor. Un appel de dessin pour tous les lampadaires, sans ombre.
   */
  private buildDarkGlass(materials: SharedMaterials): InstancedMesh | null {
    const model = [...LAMP_MODELS][0];
    if (model === undefined || this.lamps.length === 0) return null;
    const kept: BufferGeometry[] = [];
    const identity = new Matrix4();
    for (const part of this.library.parts(model)) {
      const flat = bakeGeometry(part.geometry, identity.copy(part.matrix));
      const position = flat.getAttribute('position');
      const uv = flat.getAttribute('uv');
      const keep: number[] = [];
      for (let i = 0; i + TRIANGLE - 1 < position.count; i += TRIANGLE) {
        const cell = cellAt(uv.getX(i), uv.getY(i));
        if (cell !== undefined && GLOWING_CELLS[cell] !== undefined) keep.push(i);
      }
      if (keep.length > 0) {
        const positions = new Float32Array(keep.length * TRIANGLE * 3);
        keep.forEach((first, k) => {
          for (let c = 0; c < TRIANGLE; c += 1) {
            const o = (k * TRIANGLE + c) * 3;
            positions[o] = position.getX(first + c);
            positions[o + 1] = position.getY(first + c);
            positions[o + 2] = position.getZ(first + c);
          }
        });
        const shard = new BufferGeometry();
        shard.setAttribute('position', new BufferAttribute(positions, 3));
        kept.push(new ShapeBuilder().add(shard, SETTINGS.darkGlassCell, [0, 0, 0]).build());
      }
      flat.dispose();
    }
    if (kept.length === 0) return null;
    const merged = kept.length === 1 ? kept[0] : mergeGeometries(kept, false);
    for (const geometry of kept) if (geometry !== merged) geometry.dispose();
    if (merged === undefined) return null;
    merged.computeBoundingBox();
    const centre = merged.boundingBox?.getCenter(new Vector3()) ?? new Vector3();
    merged.translate(-centre.x, -centre.y, -centre.z);
    merged.scale(SETTINGS.darkGlassGrow, SETTINGS.darkGlassGrow, SETTINGS.darkGlassGrow);
    merged.translate(centre.x, centre.y, centre.z);
    const mesh = createInstanced('verre éteint', this.resources.track(merged), materials.palette, this.lamps.length);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    const placements = new Map<string, MapProp>();
    for (const prop of this.map.props) if (LAMP_MODELS.has(prop.model)) placements.set(prop.id, prop);
    for (const improvement of Object.values(this.map.improvements ?? {})) placements.set(improvement.id, improvement);
    for (const id of this.lamps) {
      const prop = placements.get(id);
      const matrix = new Matrix4();
      if (prop !== undefined) propMatrix(prop, this.terrain.heightAt(prop.pos.x, prop.pos.y), matrix);
      this.darkPlacements.push(matrix);
    }
    mesh.count = this.lamps.length;
    this.group.add(mesh);
    return mesh;
  }

  /**
   * Marelle à la craie (section 2.7): neuf cases et le ciel, tracés en traits fins sur les pavés,
   * 1 x 3 m dans le sens nord-sud (cases 45, y 28 à 30), le ciel au nord.
   */
  private buildHopscotch(materials: SharedMaterials): Mesh | null {
    const at = this.map.points[SETTINGS.hopscotch.point];
    if (at === undefined) return null;
    const h = SETTINGS.hopscotch;
    const lines = new ShapeBuilder();
    const line = (x: number, z: number, w: number, d: number, cell: typeof h.chalk): void => {
      lines.box([w, h.thickness, d], [x, h.thickness / 2, z], cell);
    };
    const s = h.square;
    const half = (h.rows.length * s) / 2;
    let z = half;
    // Du sud (on part du bas) vers le nord: une case, une case, deux cases, une, deux, puis le ciel.
    for (const row of h.rows) {
      const top = z - s;
      const width = row * s;
      line(0, z, width, h.line, h.chalk);
      line(0, top, width, h.line, h.chalk);
      for (let k = 0; k <= row; k += 1) line(-width / 2 + k * s, z - s / 2, h.line, s, h.chalk);
      z = top;
    }
    // Le ciel: un demi-cercle en segments, à la craie de couleur.
    const radius = s;
    for (let k = 0; k < h.skySegments; k += 1) {
      const a = (Math.PI * (k + 0.5)) / h.skySegments;
      const length = (Math.PI * radius) / h.skySegments + h.line;
      lines.box([length, h.thickness, h.line], [Math.cos(a) * radius, h.thickness / 2, z - Math.sin(a) * radius], h.sky, {
        rotation: [0, (a * 180) / Math.PI - 90, 0],
      });
    }
    const mesh = new Mesh(this.resources.track(lines.build()), materials.palette);
    mesh.name = 'marelle';
    mesh.position.set(at.x, this.terrain.heightAt(at.x, at.y) + h.lift, at.y);
    mesh.updateMatrix();
    mesh.matrixWorld.copy(mesh.matrix);
    return mesh;
  }

  private built(world: ReadonlyWorld, id: string): boolean {
    return (world.improvements[id]?.builtDay ?? null) !== null || isBuiltByFlag(this.content.settings.flagEffects, world.flags, id);
  }

  update(context: FrameContext): void {
    const world = context.world;
    const season = seasonOfDay(this.content.settings, world.clock.day);
    const seasonIndex = SEASON_INDEX[season] ?? 0;
    const given = world.giftsGiven.jeanne ?? null;
    const chalk = given !== null && given < world.clock.day && world.weather !== 'rain';
    const roofed = this.built(world, SETTINGS.wellRoof);
    // L'auvent, posé sur la façade de la maisonnette réparée (jamais sur la ruine), part avec la
    // façade quand la coupe de la maisonnette l'efface.
    let canopy = false;
    if (this.canopy !== null) {
      this.canopyFacing.set(0, 0, 1).applyQuaternion(this.canopy.quaternion);
      canopy = this.built(world, SETTINGS.canopy) && this.house.isRepaired() && !this.house.wallCut(this.canopyFacing);
    }
    let signature = seasonIndex + (chalk ? 4 : 0) + (roofed ? 8 : 0) + (canopy ? 1 << 30 : 0);
    for (let index = 0; index < this.views.length; index += 1) {
      const view = this.views[index];
      if (view !== undefined && this.built(world, view.improvement.id)) signature += 16 << index;
    }
    if (signature !== this.mergedSignature) {
      this.mergedSignature = signature;
      this.rebuild(world, season, chalk, roofed, canopy);
    }
    this.updateLamps(world, context);
  }

  /** Refait la fusion de ce qui est posé (chantiers bâtis, arceau du puits ouvert, marelle). */
  private rebuild(world: ReadonlyWorld, season: string, chalk: boolean, roofed: boolean, canopy: boolean): void {
    if (this.merged !== null) {
      this.merged.removeFromParent();
      this.merged.geometry.dispose();
      this.merged = null;
    }
    const meshes: Mesh[] = [];
    for (const view of this.views) {
      if (view.improvement.id === SETTINGS.canopy ? !canopy : !this.built(world, view.improvement.id)) continue;
      for (const entry of view.seasonal) entry.node.visible = entry.season === season;
      for (const object of view.objects) {
        object.updateMatrixWorld(true);
        object.traverseVisible((child) => {
          if (isMesh(child)) meshes.push(child);
        });
      }
    }
    if (this.gallows !== null && !roofed) meshes.push(this.gallows);
    if (this.hopscotch !== null && chalk) meshes.push(this.hopscotch);
    if (meshes.length === 0) return;
    const parts = meshes.map((mesh) => bakeGeometry(mesh.geometry, mesh.matrixWorld));
    const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
    for (const part of parts) if (part !== merged) part.dispose();
    if (merged === undefined) return;
    merged.computeBoundingSphere();
    const mesh = new Mesh(merged, this.material);
    mesh.name = 'chantiers fusionnés';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    this.merged = mesh;
  }

  /** Allumage de chaque lampadaire à cette image, puis le verre sombre des lanternes éteintes. */
  private updateLamps(world: ReadonlyWorld, context: FrameContext): void {
    for (const id of this.lamps) {
      const improvement = this.map.improvements?.[id];
      this.board.set(id, improvement !== undefined && !this.built(world, id) ? 0 : lanternLevel(this.quayLanterns, world, id, context.alpha));
    }
    const glass = this.darkGlass;
    if (glass === null) return;
    const night = context.night > 0;
    let any = false;
    this.lamps.forEach((id, index) => {
      const improvement = this.map.improvements?.[id];
      const exists = improvement === undefined || this.built(world, id);
      const dark = night && exists && this.board.factor(id) < SETTINGS.darkGlassBelow;
      any ||= dark;
      glass.setMatrixAt(index, dark ? (this.darkPlacements[index] ?? this.hidden) : this.hidden);
    });
    finishInstances(glass);
    // Aucun appel de dessin tant que toutes les lanternes sont allumées (presque tous les soirs).
    glass.visible = any;
  }

  dispose(): void {
    this.merged?.geometry.dispose();
    this.views.length = 0;
    this.group.removeFromParent();
  }
}

/** Ce que le rendu lit des lanternes du quai (`render` du moment), lu une fois au chargement. */
export interface LanternPlan {
  def: MomentDef;
  grow: number;
  lanterns: readonly string[];
  schedule: ReadonlyMap<string, number>;
  places: readonly string[];
  out: number;
}

export function lanternPlan(def: MomentDef | null): LanternPlan | null {
  if (def?.render.lampsOffUntilClimax !== true) return null;
  return {
    def,
    grow: renderNumber(def, 'flameGrowSeconds', SETTINGS.flameGrowSeconds),
    lanterns: renderStrings(def, 'lanterns'),
    schedule: new Map(renderSchedule(def)),
    places: def.watch.syncPress?.places ?? [],
    out: renderNumber(def, 'aloneOutSeconds', SETTINGS.flameGrowSeconds),
  };
}

/**
 * Les lanternes du quai (section 4.4): éteintes pendant l'attente jusqu'à la fin de la fenêtre
 * (Firmin allume ensuite lui-même), la flamme allumée seule qui grandit puis vacille et
 * s'éteint (`presses`), à l'apogée les deux lanternes puis la vague des lampadaires.
 */
export function lanternLevel(plan: LanternPlan | null, world: ReadonlyWorld, id: string, alpha: number): number {
  const today = world.moments.today;
  if (plan === null || today?.id !== plan.def.id) return 1;
  if (today.phase === 'climax') {
    const t = today.elapsed + (today.paused ? 0 : alpha / SIM_HZ);
    if (plan.lanterns.includes(id)) return clamp01(t / plan.grow);
    const at = plan.schedule.get(id) ?? SETTINGS.unscheduledLampAt;
    return clamp01((t - at) / plan.grow);
  }
  const before = (today.phase === 'waiting' || today.phase === 'absent') && world.clock.minutes < plan.def.window.to;
  if (!before) return 1;
  // Une flamme allumée seule: elle prend, vacille, puis s'éteint au bout de `aloneOutSeconds`.
  let flame = 0;
  const presses = today.presses;
  for (let k = 0; k < 2; k += 1) {
    const press = (k === 0 ? presses?.p1 : presses?.p2) ?? null;
    if (press === null || plan.lanterns[plan.places.indexOf(press.place)] !== id) continue;
    const s = (world.tick - press.tick + alpha) / SIM_HZ;
    if (s < 0 || s > plan.out + SETTINGS.flameOutSeconds) continue;
    const rise = clamp01(s / SETTINGS.flameCatchSeconds) * SETTINGS.aloneFlame;
    const flicker = 1 - SETTINGS.aloneFlicker * (0.5 + 0.5 * Math.sin(s * SETTINGS.aloneFlickerHz * Math.PI * 2));
    const fade = s <= plan.out ? 1 : 1 - (s - plan.out) / SETTINGS.flameOutSeconds;
    flame = Math.max(flame, rise * flicker * fade);
  }
  return flame;
}
