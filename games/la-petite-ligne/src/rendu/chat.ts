/**
 * Le chat du bourg (0.13, section 7.4 de `v0-13-habitants.md`): le nœud `cat` de `faune.glb`, ses
 * clips `cat_idle`, `cat_walk`, `cat_sleep` et `cat_roll`, posé et animé d'après une vue minimale
 * (`CatView`). La simulation n'a pas encore de chat: le lot H7 la remplira (champ de l'état lu
 * par une `CatSource` passée au moteur, `EngineOptions.cat`); d'ici là, la page de démonstration
 * fournit la sienne et le jeu n'en montre aucun.
 *
 * Tout se lit dans la vue: mêmes images chez l'hôte et chez l'invité. Sans modèle, le substitut
 * `cat` de `substituts.ts` prend la place (posé, tourné, sans animation).
 */
import {
  AnimationMixer,
  Group,
  LoopOnce,
  LoopRepeat,
  SkinnedMesh,
  Sphere,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three';
import { SIM_HZ, type ReadonlyWorld, type Vec2 } from '../etat/types';
import { smoothFactor } from './camera';
import { dampAngle, interpolate, yawFromFacing, type FrameContext } from './contexte';
import type { ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { CAT_SETTINGS, type CatSettings } from './reglages-faune';
import type { Terrain } from './terrain';

const FAUNA_FILE = 'faune.glb';

/** Ce que fait le chat: assis, en marche, endormi en rond, roulé sur le dos (caresse à deux). */
export type CatPose = 'idle' | 'walk' | 'sleep' | 'roll';

/** Vue du chat que le rendu lit à chaque image (remplie par la simulation au lot H7). */
export interface CatView {
  /** Position au pas courant et au pas d'avant (m, plan de la carte), pour l'interpolation. */
  readonly pos: Readonly<Vec2>;
  readonly prev: Readonly<Vec2>;
  /** Cap (radians, convention des personnages: 0 vers l'est). */
  readonly facing: number;
  /** Vitesse (m/s): rythme de `cat_walk`. */
  readonly speed: number;
  readonly pose: CatPose;
  /** Pas de la simulation où la pose a commencé: `cat_roll` se joue une fois depuis là, le même chez les deux. */
  readonly since: number;
  /** Bâtiment visitable où il est (comme les habitants), `null` dehors. */
  readonly inside: string | null;
}

/** D'où vient le chat à cette image: `null`, pas de chat (la nuit, il chasse hors de la carte). */
export type CatSource = (world: ReadonlyWorld) => CatView | null;

/** Pas encore de chat dans l'état (avant le lot H7). */
export const NO_CAT: CatSource = () => null;

/** Clip de chaque pose. */
export function catClip(pose: CatPose, settings: CatSettings = CAT_SETTINGS): string {
  return settings.clips[pose];
}

/** Rythme de la marche pour que les pattes ne glissent pas. */
export function catWalkScale(speed: number, settings: CatSettings = CAT_SETTINGS): number {
  return Math.min(
    settings.walkScaleMax,
    Math.max(settings.walkScaleMin, speed / settings.walkReference),
  );
}

export class CatPart implements EventfulPart {
  readonly group = new Group();
  private root: Object3D | null = null;
  private mixer: AnimationMixer | null = null;
  private readonly clips = new Map<string, AnimationClip>();
  private readonly actions = new Map<string, AnimationAction>();
  private current = '';
  private facing: number | null = null;
  private readonly point = { x: 0, y: 0 };
  /** Début de la roulade en cours (pas de la simulation), pour la relancer à chaque nouvelle caresse. */
  private rollSince = Number.NaN;
  private interiorProbe: () => string | null = () => null;

  constructor(
    private readonly library: ModelLibrary,
    private readonly terrain: Terrain,
    private readonly source: CatSource,
    private readonly settings: CatSettings = CAT_SETTINGS,
  ) {
    this.group.name = 'chat';
    for (const clip of library.animations(FAUNA_FILE)) this.clips.set(clip.name, clip);
  }

  /** Bâtiment visitable où est le joueur local: un chat dans un autre bâtiment est caché par ses murs. */
  setInteriorProbe(probe: () => string | null): void {
    this.interiorProbe = probe;
  }

  /** Modèle créé à la première apparition (aucun coût tant qu'il n'y a pas de chat). */
  private model(): Object3D {
    if (this.root !== null) return this.root;
    const rigged = this.library.cloneAnimal(this.settings.model);
    const root = rigged ?? this.library.instantiate(this.settings.model);
    root.traverse((object) => {
      object.castShadow = true;
      object.receiveShadow = true;
      // Élimination hors champ: une sphère fixe (la pose du moment ne compte pas).
      if (object instanceof SkinnedMesh) {
        object.boundingSphere = new Sphere(new Vector3(0, 0.2, 0), this.settings.boundsRadius);
      }
    });
    this.mixer = rigged !== null && this.clips.size > 0 ? new AnimationMixer(root) : null;
    this.group.add(root);
    this.root = root;
    return root;
  }

  private play(name: string, timeScale: number, once: boolean): AnimationAction | null {
    const clip = this.clips.get(name);
    if (this.mixer === null || clip === undefined) return null;
    let action = this.actions.get(name);
    if (action === undefined) {
      action = this.mixer.clipAction(clip);
      this.actions.set(name, action);
    }
    action.timeScale = timeScale;
    if (this.current === name) return action;
    action.reset();
    action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.fadeIn(this.settings.crossFadeSeconds).play();
    this.actions.get(this.current)?.fadeOut(this.settings.crossFadeSeconds);
    this.current = name;
    return action;
  }

  update(context: FrameContext): void {
    const cat = this.source(context.world);
    const inside = cat?.inside ?? null;
    if (cat === null || (inside !== null && inside !== this.interiorProbe())) {
      if (this.root !== null) this.root.visible = false;
      return;
    }
    const root = this.model();
    root.visible = true;
    const at = interpolate(cat.prev, cat.pos, context.alpha, this.point);
    root.position.set(at.x, this.terrain.heightAt(at.x, at.y), at.y);
    const yaw = yawFromFacing(cat.facing);
    this.facing =
      this.facing === null
        ? yaw
        : dampAngle(this.facing, yaw, smoothFactor(context.dt, this.settings.turnHalfLife));
    root.rotation.y = this.facing;
    const name = catClip(cat.pose, this.settings);
    if (cat.pose === 'roll') {
      // Joué une fois depuis le pas de la caresse, puis figé sur sa dernière pose (il revient assis).
      const rolling = this.current === name;
      const action = this.play(name, 0, true);
      if (cat.since !== this.rollSince) {
        // Nouvelle caresse pendant la roulade: elle repart du début (temps imposé juste après).
        this.rollSince = cat.since;
        if (rolling) action?.reset().play();
      }
      const clip = this.clips.get(name);
      if (action !== null && clip !== undefined) {
        const t = (context.world.tick - cat.since + context.alpha) / SIM_HZ;
        action.time = Math.min(clip.duration - 1e-3, Math.max(0, t));
      }
    } else {
      this.play(name, cat.pose === 'walk' ? catWalkScale(cat.speed, this.settings) : 1, false);
    }
    this.mixer?.update(context.dt);
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    this.root?.removeFromParent();
    this.root = null;
    this.actions.clear();
  }
}
