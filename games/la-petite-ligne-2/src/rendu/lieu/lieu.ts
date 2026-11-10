/**
 * La scène d'un lieu: son sol, ses volumes fixes (carte) et dynamiques (meubles posés, objets au
 * sol), ses volumes occultants. Tout ce qu'elle crée passe par son `ResourceTracker`: `dispose()`
 * rend la mémoire vidéo du lieu en entier (ADR 0018), le commun (matériaux, personnages) reste.
 */
import { Color, Group, type Material, Mesh, type Object3D, type Texture } from 'three';
import type { Aimable } from '../cible';
import { inkifyModel, inkTag } from '../encre/conversion';
import { KIND, LAYER } from '../encre/couches';
import { createFloorMap } from '../encre/sol';
import { Fadable, isMesh } from '../fondu';
import { Occlusion } from '../occultation';
import { RENDER_SETTINGS } from '../reglages';
import { ResourceTracker } from '../ressources';
import { boxOf, type PlaceDescription, type SceneVolume } from './description';
import { groundGeometry, standInGeometry } from './formes';
import { floorGeometry } from './sol';

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
    const model = volume.model === null ? null : (this.models?.instantiate(volume.model) ?? null);
    let object: Object3D;
    if (model !== null) {
      object = this.inked === null ? model : inkifyModel(model, this.inked);
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
    const ground = this.heightAt?.(volume.x, volume.y) ?? 0;
    object.position.set(volume.x, volume.base + ground, volume.y);
    object.rotation.y = (volume.rotation * Math.PI) / 2;
    this.root.add(object);
    const view = new VolumeView(volume, object, model !== null, this.glowColor);
    if (volume.occludes) this.occlusion.add(boxOf(volume));
    object.visible = this.shown?.(volume) ?? true;
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

  /**
   * Ne dessine que les volumes de l'espace affiché (le dehors, ou la pièce du joueur local);
   * `null`: tout. Les volumes posés ensuite suivent la même règle.
   */
  showWhere(test: ((volume: SceneVolume) => boolean) | null): void {
    this.shown = test;
    for (const map of [this.fixed, this.dynamic])
      for (const view of map.values()) view.object.visible = test?.(view.volume) ?? true;
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
