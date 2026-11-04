/**
 * Objets de la carte animés en boucle par un clip de l'artiste (0.13: la roue du moulin,
 * `mill_wheel_turn`). Le modèle le dit dans ses extras (`animation`); seules les pièces que le
 * clip fait bouger sont dessinées ici (rotor, lanterne), le reste du modèle (pile, palier) reste
 * dans le décor fusionné (`decor.ts`). Le clip est calé sur le temps du rendu: même pose à la même
 * heure, et rien n'avance quand le rendu est figé (captures).
 */
import { AnimationMixer, Group, Mesh, type AnimationAction, type Object3D } from 'three';
import type { GameMap } from '../etat/carte';
import type { FrameContext } from './contexte';
import { propHints, propMatrix } from './decor';
import { animatedNodes, loopClip, type ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { applyShadows } from './ombre-tri';
import type { Terrain } from './terrain';

/** Pièces qui ne portent pas d'ombre: celles qui tournent à l'intérieur d'un bâtiment (lanterne du moulin). */
const INDOOR_SUFFIX = '_lantern';

interface Looping {
  mixer: AnimationMixer;
  action: AnimationAction;
  duration: number;
  /** Drapeau qui met la boucle en marche, `null`: toujours. */
  flag: string | null;
  /** Temps de marche cumulé (s): la roue ne vieillit pas à l'arrêt, elle repart de sa pose. */
  clock: number;
}

export class AnimatedPropsPart implements EventfulPart {
  readonly group = new Group();
  private readonly loops: Looping[] = [];

  /** `spins`: modèle animé -> drapeau qui le met en marche (`reglages.flagEffects.spins`); sans entrée, il tourne toujours. */
  constructor(map: GameMap, library: ModelLibrary, terrain: Terrain, spins: ReadonlyMap<string, string> = new Map()) {
    this.group.name = 'objets animes';
    for (const prop of map.props) {
      const clip = loopClip(library, prop.model);
      if (clip === null) continue;
      const moving = animatedNodes(library, prop.model);
      const root = library.instantiate(prop.model, propHints(prop), prop.id);
      // Seules les pièces animées restent (le reste est fusionné dans le décor).
      const drop: Object3D[] = [];
      for (const child of root.children) if (!moving.has(child.name)) drop.push(child);
      for (const child of drop) child.removeFromParent();
      applyShadows(root);
      root.traverse((object) => {
        if (object instanceof Mesh && object.name.endsWith(INDOOR_SUFFIX)) object.castShadow = false;
      });
      const holder = new Group();
      holder.name = prop.id;
      propMatrix(prop, terrain.heightAt(prop.pos.x, prop.pos.y), holder.matrix);
      holder.matrix.decompose(holder.position, holder.quaternion, holder.scale);
      holder.add(root);
      this.group.add(holder);
      const mixer = new AnimationMixer(root);
      const action = mixer.clipAction(clip);
      action.play();
      this.loops.push({ mixer, action, duration: Math.max(clip.duration, 1e-3), flag: spins.get(prop.model) ?? null, clock: 0 });
    }
  }

  update(context: FrameContext): void {
    for (const loop of this.loops) {
      if (loop.flag === null) {
        loop.mixer.setTime(context.time % loop.duration);
      } else if (context.world.flags.includes(loop.flag)) {
        loop.clock += context.dt;
        loop.mixer.setTime(loop.clock % loop.duration);
      }
    }
  }

  dispose(): void {
    for (const loop of this.loops) loop.mixer.stopAllAction();
    this.loops.length = 0;
    this.group.removeFromParent();
  }
}
