/**
 * Barrières de passage à niveau à l'écran (brique `barrier`, `simulation/monde/barrieres.ts`): la
 * partie mobile du modèle (`node` de la brique, angles `baissee` et `levee` du manifeste des
 * décors) va vers la position que dit la simulation, à vitesse constante, en `seconds` pour toute
 * sa course. L'état se déduit de l'heure et des trains de l'état reçu: le même chez l'hôte et chez
 * l'invité, et le mouvement est calculé image par image des deux côtés. À l'entrée d'un lieu (ou
 * à la reprise d'une partie), la lisse est posée d'un coup à sa place. Aucune ressource à libérer:
 * les objets sont ceux de la scène du lieu.
 */
import type { Object3D } from 'three';
import type { Content, PlaceContent } from '../../donnees/charger';
import type { ReadonlyWorld } from '../../etat/monde';
import { barrierClosed, barriersOf, type Barrier } from '../../simulation/monde/barrieres';
import { DECOR_MANIFEST, type DecorManifest } from './decors-manifeste';

type Axis = 'x' | 'y' | 'z';

interface Moving {
  readonly barrier: Barrier;
  readonly axis: Axis;
  /** Angles baissé et levé (rad), vitesse de la course (rad/s). */
  readonly down: number;
  readonly up: number;
  readonly speed: number;
  /** Angle affiché (`null`: pas encore posé). */
  angle: number | null;
  /** L'objet de la scène et sa partie mobile, retrouvée quand la scène refait l'objet. */
  object: Object3D | null;
  part: Object3D | null;
}

/** Ce que la couche demande à la scène du lieu: l'objet posé pour un identifiant de la carte. */
export interface BarrierObjects {
  objectOf(id: string): Object3D | null;
}

export class BarrierLayer {
  private readonly items: Moving[] = [];
  /** Regard de la simulation, gardé d'une image à l'autre (aucune allocation par image). */
  private look: { content: Content; world: ReadonlyWorld } | null = null;

  constructor(
    private readonly content: Content,
    private readonly place: PlaceContent,
    manifest: DecorManifest = DECOR_MANIFEST,
  ) {
    for (const barrier of barriersOf({ content }, place)) {
      const model = content.props[barrier.object.type]?.model;
      const node = model === undefined ? undefined : manifest.models[model]?.nodes?.[barrier.node];
      if (node === undefined) continue;
      const down = ((node.baissee ?? 0) * Math.PI) / 180;
      const up = ((node.levee ?? 0) * Math.PI) / 180;
      this.items.push({
        barrier,
        axis: node.axe ?? 'z',
        down,
        up,
        speed: Math.abs(up - down) / barrier.seconds,
        angle: null,
        object: null,
        part: null,
      });
    }
  }

  /** Nombre de barrières animées du lieu (0: la couche est inutile). */
  get size(): number {
    return this.items.length;
  }

  /** Une image: chaque lisse va vers sa position (baissée tant que le passage sonne). */
  update(dt: number, world: ReadonlyWorld, objects: BarrierObjects): void {
    const look = (this.look ??= { content: this.content, world });
    look.world = world;
    for (const item of this.items) {
      const target = barrierClosed(look, this.place, item.barrier) ? item.down : item.up;
      if (item.angle === null) item.angle = target;
      else {
        const step = item.speed * dt;
        const gap = target - item.angle;
        item.angle = Math.abs(gap) <= step ? target : item.angle + Math.sign(gap) * step;
      }
      const object = objects.objectOf(item.barrier.object.id);
      if (object !== item.object) {
        item.object = object;
        item.part = object?.getObjectByName(item.barrier.node) ?? null;
      }
      if (item.part !== null) item.part.rotation[item.axis] = item.angle;
    }
  }

  /** Angle affiché d'une barrière (rad), `null` si inconnue ou pas encore posée (contrôle). */
  angleOf(id: string): number | null {
    return this.items.find((item) => item.barrier.object.id === id)?.angle ?? null;
  }
}
