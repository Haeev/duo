/**
 * La scène d'un lieu: son sol, ses volumes fixes (carte) et dynamiques (meubles posés, objets au
 * sol), ses volumes occultants. Tout ce qu'elle crée passe par son `ResourceTracker`: `dispose()`
 * rend la mémoire vidéo du lieu en entier (ADR 0018), le commun (matériaux, personnages) reste.
 */
import {
  Box3,
  type BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  type Object3D,
  Quaternion,
  type Texture,
  Vector3,
} from 'three';
import type { Aimable } from '../cible';
import { inkifyModel, inkTag } from '../encre/conversion';
import { KIND, LAYER } from '../encre/couches';
import { createFloorMap } from '../encre/sol';
import { Fadable, isMesh } from '../fondu';
import { Occlusion, type OccluderBox } from '../occultation';
import { RENDER_SETTINGS } from '../reglages';
import { ResourceTracker } from '../ressources';
import { bundleGeometry } from './ballot';
import { boxOf, footprint, type PlaceDescription, type SceneVolume } from './description';
import { groundGeometry, standInGeometry } from './formes';
import { HARVEST_LOOK } from './reglages-recoltes';
import { floorGeometry } from './sol';

/**
 * D'où viennent les modèles livrés. `instantiate` rend un objet neuf pour ce nom de modèle, ou
 * `null` s'il n'est pas livré (une forme provisoire le remplace). `key`: l'identifiant de
 * l'exemplaire (sa forme, son cap et sa taille en sont tirés: les mêmes chez les deux joueurs et à
 * chaque visite); `state`: l'état à montrer (`stump`, `bare`...). Les géométries et matériaux de
 * l'objet restent à la source: le lieu ne les libère pas.
 */
export interface ModelSource {
  instantiate(model: string, key?: string, state?: string | null): Object3D | null;
  /** Géométrie fusionnée d'un modèle, à poser en instances (végétation semée des grands lieux). */
  geometryOf?(model: string): BufferGeometry | null;
}

const bounds = new Box3();
const matrix = new Matrix4();
const turn = new Quaternion();
const at = new Vector3();
const size = new Vector3();
const up = new Vector3(0, 1, 0);
const white = new Color('#ffffff');

/** Volumes d'un même modèle posés en un seul maillage instancié (cases et plants du potager). */
interface Batch {
  readonly mesh: InstancedMesh;
  readonly volumes: readonly SceneVolume[];
}

/** Matériaux communs à tous les lieux, créés et libérés par le moteur. */
export interface PlaceMaterials {
  readonly ground: Material;
  readonly standIn: Material;
  /**
   * Rendu encré (ADR 0023): le matériau que reçoivent les modèles livrés, convertis à leur
   * arrivée; `null` dans l'ancien rendu (ils gardent leurs matériaux).
   */
  readonly ink?: Material | null;
  /** Rendu encré: teinte du dehors d'un lieu clos (cases `vide` du sol), `null`: l'encre. */
  readonly outside?: string | null;
}

class VolumeView implements Aimable {
  readonly fadable: Fadable;
  private opacity = 1;
  private glow = 0;

  constructor(
    readonly volume: SceneVolume,
    readonly object: Object3D,
    /** Vrai si un modèle livré l'affiche, faux pour une forme provisoire. */
    readonly modelled: boolean,
    glowColor: Color,
    /** État montré (`null`: l'état de base). */
    readonly state: string | null,
  ) {
    this.fadable = new Fadable(object, glowColor);
  }

  setOpacity(opacity: number): void {
    this.opacity = opacity;
    this.fadable.apply(this.opacity, this.glow);
  }

  setGlow(glow: number): void {
    this.glow = glow;
    this.fadable.apply(this.opacity, this.glow);
  }
}

export class PlaceScene {
  readonly root = new Group();
  readonly occlusion = new Occlusion();
  private readonly tracker = new ResourceTracker();
  private readonly fixed = new Map<string, VolumeView>();
  private readonly dynamic = new Map<string, VolumeView>();
  private readonly glowColor = new Color(RENDER_SETTINGS.target.rimColor);
  private readonly inked: Material | null;
  /** Rendu encré: carte du sol d'un petit lieu à sol déclaré (`floor`), `null` sinon. */
  groundMap: Texture | null = null;
  /** Ce volume est-il dans l'espace affiché ? `null`: tout est affiché. */
  private shown: ((volume: SceneVolume) => boolean) | null = null;
  /** États montrés des volumes qui ne sont pas à leur état de base (`setStates`). */
  private states: ReadonlyMap<string, string> = new Map();
  /** Ballot commun des objets au sol sans modèle, créé à la première demande. */
  private bundle: BufferGeometry | null = null;
  /** Volumes dynamiques groupés par modèle (`batch`): un appel de dessin par modèle. */
  private batches: Batch[] = [];

  constructor(
    readonly description: PlaceDescription,
    private readonly materials: PlaceMaterials,
    private readonly models: ModelSource | null,
    /** Faux pour un grand lieu: son sol est dessiné tuile par tuile (`grand-lieu.ts`). */
    withGround = true,
    /** Sol en relief d'un grand lieu: hauteur sous un point de la carte; absent: sol plan. */
    private readonly heightAt: ((x: number, y: number) => number) | null = null,
  ) {
    this.inked = materials.ink ?? null;
    this.root.name = 'lieu';
    if (withGround) {
      const { width, height, floor } = description;
      const geometry = this.tracker.track(
        floor === undefined ? groundGeometry(width, height) : floorGeometry(floor, width, height),
      );
      if (this.inked !== null) {
        // Encre: teinte et matière du sol lues dans la carte du sol (plancher lame par lame, tapis).
        inkTag(geometry, { layer: LAYER.grass, kind: KIND.ground });
        if (floor !== undefined)
          this.groundMap = this.tracker.track(
            createFloorMap(floor, width, height, materials.outside ?? null),
          );
      }
      const ground = new Mesh(geometry, materials.ground);
      ground.receiveShadow = true;
      ground.name = 'sol';
      this.root.add(ground);
    }
    for (const volume of description.volumes) this.fixed.set(volume.id, this.build(volume));
  }

  private build(volume: SceneVolume): VolumeView {
    const state = this.states.get(volume.id) ?? null;
    // Il ne reste rien (ressource prise, pas encore revenue): un objet vide garde sa place.
    const gone = state === HARVEST_LOOK.gone;
    const model =
      volume.model === null || gone
        ? null
        : (this.models?.instantiate(volume.model, volume.id, state) ?? null);
    let object: Object3D;
    if (gone) object = new Group();
    else if (model !== null) {
      object = this.inked === null ? model : inkifyModel(model, this.inked);
    } else if (volume.standIn === 'bundle') {
      this.bundle ??= this.tracker.track(bundleGeometry());
      if (this.inked !== null) inkTag(this.bundle, { layer: LAYER.plain });
      object = new Mesh(this.bundle, this.materials.standIn);
    } else {
      const geometry = this.tracker.track(standInGeometry(volume));
      if (this.inked !== null) inkTag(geometry, { layer: LAYER.plain });
      object = new Mesh(geometry, this.materials.standIn);
    }
    object.traverse((child) => {
      if (isMesh(child)) {
        child.castShadow = volume.shape !== 'slab';
        child.receiveShadow = true;
      }
    });
    object.name = volume.id;
    // Posé sur le sol tel qu'il est affiché: rien ne flotte ni ne s'enfonce sur un sol en relief.
    const foot = volume.foot ?? volume;
    const ground = this.heightAt?.(foot.x, foot.y) ?? 0;
    object.position.set(volume.x, volume.base + ground, volume.y);
    object.rotation.y = (volume.rotation * Math.PI) / 2;
    if (volume.scale !== undefined) object.scale.multiplyScalar(volume.scale);
    this.root.add(object);
    const view = new VolumeView(volume, object, model !== null || gone, this.glowColor, state);
    if (volume.occludes && !gone)
      this.occlusion.add(model === null ? boxOf(volume) : modelBox(volume, object));
    object.visible = this.shown?.(volume) ?? true;
    return view;
  }

  /**
   * États montrés (`recoltes.ts`: souche, buisson cueilli, stock vide...), par identifiant de
   * volume; absent: l'état de base. Seuls les volumes dont l'état change sont refaits.
   */
  setStates(states: ReadonlyMap<string, string>): void {
    this.states = states;
    for (const map of [this.fixed, this.dynamic])
      for (const [id, view] of map) {
        if (view.state === (states.get(id) ?? null)) continue;
        this.drop(view);
        map.set(id, this.build(view.volume));
      }
  }

  private drop(view: VolumeView): void {
    view.fadable.dispose();
    view.object.removeFromParent();
    this.occlusion.remove(view.volume.id);
    if (!view.modelled && isMesh(view.object) && view.object.geometry !== this.bundle)
      this.tracker.release(view.object.geometry);
  }

  /** Remplace les volumes dynamiques (meubles posés, objets au sol): appelé quand l'état change. */
  setDynamic(volumes: readonly SceneVolume[]): void {
    for (const view of this.dynamic.values()) this.drop(view);
    this.dynamic.clear();
    this.dropBatches();
    const grouped = new Map<string, SceneVolume[]>();
    for (const volume of volumes) {
      // Un identifiant de la carte gagne: les instances posées ne les croisent jamais (`pose-<n>`).
      if (this.fixed.has(volume.id)) continue;
      if (volume.batch === true && volume.model !== null) {
        const list = grouped.get(volume.model) ?? [];
        list.push(volume);
        grouped.set(volume.model, list);
        continue;
      }
      this.dynamic.set(volume.id, this.build(volume));
    }
    for (const [model, list] of grouped) {
      const batch = this.batch(model, list);
      // Modèle absent ou en plusieurs morceaux: chaque volume garde son objet.
      if (batch === null)
        for (const volume of list) this.dynamic.set(volume.id, this.build(volume));
      else this.batches.push(batch);
    }
  }

  /**
   * Un maillage instancié pour tous les volumes de ce modèle (sans variante ni écart de pose):
   * la géométrie et le matériau du modèle, une instance par volume, posée sur le sol affiché.
   */
  private batch(model: string, volumes: readonly SceneVolume[]): Batch | null {
    const first = volumes[0];
    const sample = first === undefined ? null : (this.models?.instantiate(model, first.id) ?? null);
    if (sample === null || !isMesh(sample)) return null;
    if (this.inked !== null) inkifyModel(sample, this.inked);
    const mesh = new InstancedMesh(sample.geometry, sample.material, volumes.length);
    mesh.name = `lot-${model}`;
    volumes.forEach((volume, i) => {
      const foot = volume.foot ?? volume;
      const ground = this.heightAt?.(foot.x, foot.y) ?? 0;
      turn.setFromAxisAngle(up, (volume.rotation * Math.PI) / 2);
      matrix.compose(
        at.set(volume.x, volume.base + ground, volume.y),
        turn,
        size.setScalar(volume.scale ?? 1),
      );
      mesh.setMatrixAt(i, matrix);
      // Teinte d'instance blanche: les couleurs du modèle, et le programme des autres instanciés.
      mesh.setColorAt(i, white);
    });
    mesh.computeBoundingSphere();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = this.shown === null || volumes.some(this.shown);
    this.root.add(mesh);
    return { mesh, volumes };
  }

  private dropBatches(): void {
    for (const batch of this.batches) {
      batch.mesh.removeFromParent();
      // Libère les tampons d'instances; la géométrie et le matériau restent à la source.
      batch.mesh.dispose();
    }
    this.batches = [];
  }

  /**
   * Ne dessine que les volumes de l'espace affiché (le dehors, ou la pièce du joueur local);
   * `null`: tout. Les volumes posés ensuite suivent la même règle.
   */
  showWhere(test: ((volume: SceneVolume) => boolean) | null): void {
    this.shown = test;
    for (const map of [this.fixed, this.dynamic])
      for (const view of map.values()) view.object.visible = test?.(view.volume) ?? true;
    for (const batch of this.batches)
      batch.mesh.visible = test === null || batch.volumes.some(test);
  }

  /** Tous les volumes affichés, fixes puis dynamiques (lampes du rendu encré). */
  *volumes(): Generator<SceneVolume> {
    for (const view of this.fixed.values()) yield view.volume;
    for (const view of this.dynamic.values()) yield view.volume;
  }

  /** L'objet de la scène qui porte cet identifiant, s'il peut être visé. */
  aimable(id: string): Aimable | null {
    const view = this.fixed.get(id) ?? this.dynamic.get(id);
    return view?.volume.aimable === true ? view : null;
  }

  /** Applique les opacités que l'occultation vient de changer. */
  applyOcclusion(changed: readonly string[]): void {
    for (const id of changed) {
      const view = this.fixed.get(id) ?? this.dynamic.get(id);
      view?.setOpacity(this.occlusion.opacity(id));
    }
  }

  /** Volumes affichés, et combien le sont par une forme provisoire. */
  counts(): { volumes: number; standIns: number; fading: number } {
    let standIns = 0;
    let fading = 0;
    for (const map of [this.fixed, this.dynamic]) {
      for (const view of map.values()) {
        if (!view.modelled) standIns += 1;
        if (view.fadable.copies > 0) fading += 1;
      }
    }
    let batched = 0;
    for (const batch of this.batches) batched += batch.volumes.length;
    return { volumes: this.fixed.size + this.dynamic.size + batched, standIns, fading };
  }

  dispose(): void {
    this.dropBatches();
    for (const view of this.fixed.values()) view.fadable.dispose();
    for (const view of this.dynamic.values()) view.fadable.dispose();
    this.fixed.clear();
    this.dynamic.clear();
    this.occlusion.clear();
    this.root.removeFromParent();
    this.root.clear();
    this.tracker.dispose();
  }
}

/**
 * Boîte d'occultation d'un volume à modèle: celle du modèle montré, tel qu'il est posé (variante,
 * cap, échelle, état), élargie à l'emprise du volume. Le houppier d'un arbre s'efface donc sur sa
 * largeur réelle, pas sur la seule case du tronc; une souche ne cache plus rien.
 */
function modelBox(volume: SceneVolume, object: Object3D): OccluderBox {
  bounds.setFromObject(object);
  const size = footprint(volume);
  return {
    id: volume.id,
    min: {
      x: Math.min(bounds.min.x, volume.x - size.w / 2),
      y: bounds.min.y,
      z: Math.min(bounds.min.z, volume.y - size.h / 2),
    },
    max: {
      x: Math.max(bounds.max.x, volume.x + size.w / 2),
      y: bounds.max.y,
      z: Math.max(bounds.max.z, volume.y + size.h / 2),
    },
  };
}
