/**
 * La scène d'un lieu: son sol, ses volumes fixes (carte) et dynamiques (meubles posés, objets au
 * sol), ses volumes occultants. Tout ce qu'elle crée passe par son `ResourceTracker`: `dispose()`
 * rend la mémoire vidéo du lieu en entier (ADR 0018), le commun (matériaux, personnages) reste.
 */
import { Color, Group, type Material, Mesh, type Object3D } from 'three';
import type { Aimable } from '../cible';
import { Fadable, isMesh } from '../fondu';
import { Occlusion } from '../occultation';
import { RENDER_SETTINGS } from '../reglages';
import { ResourceTracker } from '../ressources';
import { boxOf, type PlaceDescription, type SceneVolume } from './description';
import { groundGeometry, standInGeometry } from './formes';

/**
 * D'où viennent les modèles livrés. `instantiate` rend un objet neuf pour ce nom de modèle, ou
 * `null` s'il n'est pas livré (une forme provisoire le remplace). Les géométries et matériaux de
 * l'objet restent à la source: le lieu ne les libère pas.
 */
export interface ModelSource {
  instantiate(model: string): Object3D | null;
}

/** Matériaux communs à tous les lieux, créés et libérés par le moteur. */
export interface PlaceMaterials {
  readonly ground: Material;
  readonly standIn: Material;
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

  constructor(
    readonly description: PlaceDescription,
    private readonly materials: PlaceMaterials,
    private readonly models: ModelSource | null,
  ) {
    this.root.name = 'lieu';
    const ground = new Mesh(
      this.tracker.track(groundGeometry(description.width, description.height)),
      materials.ground,
    );
    ground.receiveShadow = true;
    ground.name = 'sol';
    this.root.add(ground);
    for (const volume of description.volumes) this.fixed.set(volume.id, this.build(volume));
  }

  private build(volume: SceneVolume): VolumeView {
    const model = volume.model === null ? null : (this.models?.instantiate(volume.model) ?? null);
    let object: Object3D;
    if (model !== null) {
      object = model;
    } else {
      const mesh = new Mesh(this.tracker.track(standInGeometry(volume)), this.materials.standIn);
      object = mesh;
    }
    object.traverse((child) => {
      if (isMesh(child)) {
        child.castShadow = volume.shape !== 'slab';
        child.receiveShadow = true;
      }
    });
    object.name = volume.id;
    object.position.set(volume.x, volume.base, volume.y);
    object.rotation.y = (volume.rotation * Math.PI) / 2;
    this.root.add(object);
    const view = new VolumeView(volume, object, model !== null, this.glowColor);
    if (volume.occludes) this.occlusion.add(boxOf(volume));
    return view;
  }

  private drop(view: VolumeView): void {
    view.fadable.dispose();
    view.object.removeFromParent();
    this.occlusion.remove(view.volume.id);
    if (!view.modelled && isMesh(view.object)) this.tracker.release(view.object.geometry);
  }

  /** Remplace les volumes dynamiques (meubles posés, objets au sol): appelé quand l'état change. */
  setDynamic(volumes: readonly SceneVolume[]): void {
    for (const view of this.dynamic.values()) this.drop(view);
    this.dynamic.clear();
    for (const volume of volumes) {
      // Un identifiant de la carte gagne: les instances posées ne les croisent jamais (`pose-<n>`).
      if (this.fixed.has(volume.id)) continue;
      this.dynamic.set(volume.id, this.build(volume));
    }
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
    return { volumes: this.fixed.size + this.dynamic.size, standIns, fading };
  }

  dispose(): void {
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
