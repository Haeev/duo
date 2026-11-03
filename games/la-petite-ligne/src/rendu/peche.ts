/**
 * La pêche au gué (P1): ligne tendue du bout de la canne au bouchon, bouchon
 * qui flotte et dodeline, qui plonge à la touche, poisson qui sort de l'eau et
 * saute au sac, ou bouchon qui remonte et s'en va s'il s'échappe. La pose du
 * pêcheur (lancer, attente, touche) est composée dans `personnages.ts`.
 *
 * Prise de la 0.12 (R4): le poisson de l'espèce prise sort de l'eau au bout de la ligne, à sa
 * longueur tirée (`caught.cm`), puis il est tenu en main: à deux mains à l'horizontale pendant le
 * geste `fish_show` s'il est livré, sinon pendu par la tête à la main gauche (la droite tient la
 * canne). Ensuite il saute au sac, ou il est rendu à l'eau (`caught.released`).
 */
import {
  Box3,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import type { Content } from '../donnees/types';
import type { CharacterId, WorldEvent } from '../etat/types';
import type { FrameContext } from './contexte';
import type { EffectsPart } from './effets';
import { ShapeBuilder } from './geometrie';
import type { SharedMaterials } from './materiaux';
import type { EventfulPart } from './monde';
import type { ModelLibrary } from './modeles';
import { FISH_SHOW, type CharactersPart } from './personnages';
import { caughtLength, caughtReleased } from './peche-vue';
import { FISHING_RENDER } from './reglages-peche';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const BOBBER_RADIUS = 0.06;
const BOB_AMPLITUDE = 0.012;
const BOB_SPEED = 2.6;
const BITE_DEPTH = 0.07;
const BITE_SPEED = 22;
const LINE_THICKNESS = 0.012;
const LINE_COLOR = '#f3ebd4';
const LINE_OPACITY = 0.85;
const RIPPLE_COLOR = '#d4eceb';
const CAST_RIPPLE_SECONDS = 1.1;
const BITE_RIPPLE_SECONDS = 0.6;
const BITE_RIPPLE_EVERY = 0.45;
const ESCAPE_SECONDS = 0.7;
const ESCAPE_RISE = 0.35;
const SPLASH_SHARE = 0.6;
const HALF = 0.5;
const FLOAT_MODEL = 'fishing_float';
const FISH_JUMP_SIZE = 3.5;
const Y_AXIS = new Vector3(0, 1, 0);
const CATCH = FISHING_RENDER.catch;

/** Mesures d'un modèle de poisson à l'échelle 1: axe de la longueur, longueur, tête, centre. */
interface FishShape {
  axis: 'x' | 'z';
  length: number;
  /** Prise d'une main (modèles de l'artiste: l'origine, à 38 % de la longueur depuis le museau). */
  grip: Vector3;
  /** Bout du museau: là où la ligne tient le poisson qui pend. */
  mouth: Vector3;
  /** Deuxième main, au pédoncule de la queue (`fish_show`). */
  tail: Vector3;
  center: Vector3;
}

function extraPoint(value: unknown): Vector3 | null {
  return Array.isArray(value) &&
    value.length === 3 &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v))
    ? new Vector3(value[0] as number, value[1] as number, value[2] as number)
    : null;
}

/** Un poisson pris: il sort de l'eau, il est tenu, puis va au sac ou retourne à l'eau. */
interface HeldFish {
  by: CharacterId;
  item: string;
  object: Object3D;
  shape: FishShape;
  scale: number;
  start: number;
  from: Vector3;
  released: boolean;
}

interface Angler {
  bobber: Object3D;
  line: Mesh;
  /** Dernière position du bouchon (le poisson en sort, il remonte de là). */
  last: Vector3;
  escapeAt: number;
  nextBiteRipple: number;
}

export class FishingPart implements EventfulPart {
  readonly group = new Group();
  private readonly anglers = new Map<CharacterId, Angler>();
  private readonly bobberGeometry: BufferGeometry;
  private readonly lineMaterial: MeshBasicMaterial;
  private readonly lineGeometry: BufferGeometry;
  private readonly tip = new Vector3();
  private readonly delta = new Vector3();
  private readonly turn = new Quaternion();
  private readonly held: HeldFish[] = [];
  private readonly shapes = new Map<string, FishShape>();
  private readonly box = new Box3();
  private readonly basis = new Matrix4();
  private readonly hand = new Vector3();
  private readonly otherHand = new Vector3();
  private readonly dir = new Vector3();
  private readonly dorsal = new Vector3();
  private readonly side = new Vector3();
  private readonly anchor = new Vector3();
  private readonly at = new Vector3();
  private readonly up = new Vector3();
  private time = 0;

  constructor(
    private readonly materials: SharedMaterials,
    private readonly terrain: Terrain,
    resources: ResourceTracker,
    private readonly characters: CharactersPart,
    private readonly effects: EffectsPart,
    private readonly library: ModelLibrary,
    private readonly content: Content,
  ) {
    this.group.name = 'peche';
    this.bobberGeometry = resources.track(
      new ShapeBuilder()
        .ball(BOBBER_RADIUS, [0, 0, 0], { top: 'paint_red', side: 'white_paint' }, { detail: 1 })
        .cylinder(0.008, 0.008, 0.08, [0, BOBBER_RADIUS, 0], 'paint_red', {
          base: true,
          segments: 4,
        })
        .build(),
    );
    // Ligne: une baguette d'un mètre étirée entre les deux bouts, sans nouveau programme de shader.
    this.lineGeometry = resources.track(
      new ShapeBuilder()
        .box([LINE_THICKNESS, 1, LINE_THICKNESS], [0, 0.5, 0], 'white_paint')
        .build(),
    );
    this.lineMaterial = resources.track(
      new MeshBasicMaterial({
        map: materials.paletteTexture,
        color: new Color(LINE_COLOR),
        transparent: true,
        opacity: LINE_OPACITY,
        depthWrite: false,
      }),
    );
  }

  private angler(id: CharacterId): Angler {
    let angler = this.anglers.get(id);
    if (angler === undefined) {
      // Bouchon de l'artiste (`fishing_float`, origine au niveau de l'eau), sinon le nôtre.
      const bobber = this.library.has(FLOAT_MODEL)
        ? this.library.instantiate(FLOAT_MODEL)
        : new Mesh(this.bobberGeometry, this.materials.palette);
      bobber.name = 'bouchon';
      const line = new Mesh(this.lineGeometry, this.lineMaterial);
      line.name = 'ligne';
      line.renderOrder = 2;
      this.group.add(bobber, line);
      angler = {
        bobber,
        line,
        last: new Vector3(),
        escapeAt: Number.NEGATIVE_INFINITY,
        nextBiteRipple: 0,
      };
      this.anglers.set(id, angler);
    }
    return angler;
  }

  private surface(x: number, y: number): number {
    return this.terrain.waterLevelAt(x, y) ?? this.terrain.heightAt(x, y);
  }

  handleEvent(event: WorldEvent): void {
    if (event.type === 'cast') {
      const level = this.surface(event.at.x, event.at.y);
      this.effects.ripple(event.at.x, level, event.at.y, RIPPLE_COLOR, CAST_RIPPLE_SECONDS);
      this.effects.particles.emit('water', event.at.x, level, event.at.y, SPLASH_SHARE);
    } else if (event.type === 'caught') {
      const angler = this.angler(event.by);
      const from = angler.last;
      this.effects.particles.emit('water', from.x, from.y, from.z);
      this.effects.ripple(from.x, from.y, from.z, RIPPLE_COLOR, CAST_RIPPLE_SECONDS);
      this.hold(event, from);
    } else if (event.type === 'escaped') {
      const angler = this.angler(event.by);
      angler.escapeAt = this.time;
      this.effects.ripple(
        angler.last.x,
        angler.last.y,
        angler.last.z,
        RIPPLE_COLOR,
        BITE_RIPPLE_SECONDS,
      );
    }
  }

  update(context: FrameContext): void {
    this.time = context.time;
    for (const character of context.world.characters) {
      const line = character.fishing;
      const angler =
        line === null && !this.anglers.has(character.id) ? null : this.angler(character.id);
      if (angler === null) {
        continue;
      }
      if (line !== null) {
        const level = this.surface(line.bobber.x, line.bobber.y);
        const bite = line.phase === 'bite';
        const bob = context.reducedMotion ? 0 : Math.sin(context.time * BOB_SPEED) * BOB_AMPLITUDE;
        const plunge = bite ? BITE_DEPTH * (1 + Math.sin(context.time * BITE_SPEED)) * HALF : 0;
        angler.last.set(line.bobber.x, level, line.bobber.y);
        angler.bobber.position.set(line.bobber.x, level + bob - plunge, line.bobber.y);
        angler.bobber.visible = true;
        angler.escapeAt = Number.NEGATIVE_INFINITY;
        if (bite && context.time >= angler.nextBiteRipple) {
          angler.nextBiteRipple = context.time + BITE_RIPPLE_EVERY;
          this.effects.ripple(
            line.bobber.x,
            level,
            line.bobber.y,
            RIPPLE_COLOR,
            BITE_RIPPLE_SECONDS,
          );
        }
      } else {
        // Le poisson s'est échappé: le bouchon remonte et s'efface; sinon il disparaît avec la ligne.
        const t = (context.time - angler.escapeAt) / ESCAPE_SECONDS;
        angler.bobber.visible = t >= 0 && t < 1;
        if (angler.bobber.visible) {
          angler.bobber.position.set(angler.last.x, angler.last.y + t * ESCAPE_RISE, angler.last.z);
          angler.bobber.scale.setScalar(1 - t);
        } else {
          angler.bobber.scale.setScalar(1);
        }
      }
      const tight = line !== null && this.characters.rodTip(character.id, this.tip);
      angler.line.visible = tight;
      if (tight) {
        this.delta.copy(angler.bobber.position).sub(this.tip);
        const length = this.delta.length();
        angler.line.position.copy(this.tip);
        angler.line.quaternion.copy(this.turn.setFromUnitVectors(Y_AXIS, this.delta.normalize()));
        angler.line.scale.set(1, length, 1);
      }
    }
    this.updateHeld(context);
  }

  /** Mesures du modèle à l'échelle 1 (une fois par modèle). */
  private shapeOf(model: string, object: Object3D): FishShape {
    const known = this.shapes.get(model);
    if (known !== undefined) return known;
    object.updateMatrixWorld(true);
    this.box.setFromObject(object);
    const size = this.box.getSize(new Vector3());
    const center = this.box.getCenter(new Vector3());
    // Modèles de l'artiste: tête vers +Z, dos vers +Y, longueur `length_m`, points `mouth` et
    // `hold_tail` (extras). Substituts: la longueur le long du plus grand côté, la tête au bout.
    const extras = this.library.extras(model);
    const axis = typeof extras.length_m === 'number' || size.z > size.x ? 'z' : 'x';
    const length =
      typeof extras.length_m === 'number' && extras.length_m > 0
        ? extras.length_m
        : Math.max(1e-3, axis === 'x' ? size.x : size.z);
    const along = (share: number): Vector3 => {
      const point = center.clone();
      if (axis === 'x') point.x = this.box.min.x + size.x * share;
      else point.z = this.box.min.z + size.z * share;
      return point;
    };
    const mouth = extraPoint(extras.mouth) ?? along(1);
    const tail = extraPoint(extras.hold_tail) ?? along(CATCH.tailShare);
    const grip = typeof extras.length_m === 'number' ? new Vector3() : along(1 - CATCH.gripShare);
    const shape: FishShape = { axis, length, grip, mouth, tail, center };
    this.shapes.set(model, shape);
    return shape;
  }

  private hold(event: Extract<WorldEvent, { type: 'caught' }>, from: Vector3): void {
    const model = this.content.items[event.item]?.model ?? event.item;
    const object = this.library.instantiate(model);
    const shape = this.shapeOf(model, object);
    const cm = caughtLength(event);
    this.group.add(object);
    this.held.push({
      by: event.by,
      item: event.item,
      object,
      shape,
      scale: cm === null ? 1 : cm / 100 / shape.length,
      start: this.time,
      from: from.clone(),
      released: caughtReleased(event),
    });
  }

  /**
   * Pose le poisson: la direction de sa longueur (`dir`, vers la tête) et de son dos (`dorsal`),
   * le point du modèle (`point`, échelle 1) posé sur `at`.
   */
  private pose(fish: HeldFish, dir: Vector3, dorsal: Vector3, point: Vector3, at: Vector3): void {
    dorsal.addScaledVector(dir, -dorsal.dot(dir)).normalize();
    if (fish.shape.axis === 'x') {
      this.side.crossVectors(dir, dorsal);
      this.basis.makeBasis(dir, dorsal, this.side);
    } else {
      this.side.crossVectors(dorsal, dir);
      this.basis.makeBasis(this.side, dorsal, dir);
    }
    const o = fish.object;
    o.quaternion.setFromRotationMatrix(this.basis);
    o.scale.setScalar(fish.scale);
    this.anchor.copy(point).multiplyScalar(fish.scale).applyQuaternion(o.quaternion);
    o.position.copy(at).sub(this.anchor);
  }

  /** Main qui tient le poisson pendu par la tête: la gauche, sinon la droite, sinon le scion. */
  private grip(fish: HeldFish, out: Vector3): boolean {
    return (
      this.characters.handPoint(fish.by, 'left', out) ||
      this.characters.handPoint(fish.by, 'right', out) ||
      this.characters.rodTip(fish.by, out)
    );
  }

  private updateHeld(context: FrameContext): void {
    for (let i = this.held.length - 1; i >= 0; i -= 1) {
      const fish = this.held[i];
      if (fish === undefined) continue;
      const t = this.time - fish.start;
      const shown = CATCH.liftSeconds + CATCH.showSeconds;
      const character = context.world.characters.find((c) => c.id === fish.by);
      const facing = character?.facing ?? 0;
      const hasHand = this.grip(fish, this.hand);
      // Le dos tourné vers l'eau (devant le pêcheur): de profil pour les deux caméras.
      this.dorsal.set(Math.cos(facing), 0, Math.sin(facing));
      if (t < CATCH.liftSeconds) {
        // Sortie de l'eau: pendu à la ligne par le museau, il monte en arc du bouchon vers la main.
        const k = t / CATCH.liftSeconds;
        const ease = k * k * (3 - 2 * k);
        if (!hasHand) this.hand.copy(fish.from);
        this.anchor.copy(fish.from).lerp(this.hand, ease);
        this.anchor.y += Math.sin(k * Math.PI) * CATCH.liftArc;
        this.at.copy(this.anchor);
        this.pose(fish, this.dir.copy(Y_AXIS), this.dorsal, fish.shape.mouth, this.at);
        this.drawLineTo(fish.by, this.at);
      } else if (t < shown) {
        const twoHands =
          this.characters.hasClip(FISH_SHOW) &&
          this.characters.handPoint(fish.by, 'right', this.hand) &&
          this.characters.handPoint(fish.by, 'left', this.otherHand);
        if (twoHands) {
          // Montré à deux mains (`fish_show`): la prise dans la main droite, la queue dans la gauche.
          this.dir.copy(this.hand).sub(this.otherHand).normalize();
          this.pose(fish, this.dir, this.up.copy(Y_AXIS), fish.shape.grip, this.hand);
        } else if (hasHand) {
          // Sans le geste: tenu derrière les ouïes, la tête en haut, comme on montre une prise.
          this.pose(fish, this.dir.copy(Y_AXIS), this.dorsal, fish.shape.grip, this.hand);
        }
      } else if (fish.released && t < shown + CATCH.releaseSeconds) {
        // Rendu à l'eau: il glisse de la main vers l'eau devant le pêcheur, à plat.
        const k = (t - shown) / CATCH.releaseSeconds;
        if (!hasHand) this.hand.copy(fish.from);
        this.at.copy(this.hand).lerp(fish.from, k * k);
        this.pose(fish, this.dir.copy(this.dorsal), this.up.copy(Y_AXIS), fish.shape.grip, this.at);
      } else {
        if (fish.released) {
          this.effects.ripple(
            fish.from.x,
            fish.from.y,
            fish.from.z,
            RIPPLE_COLOR,
            CAST_RIPPLE_SECONDS,
          );
          this.effects.particles.emit('water', fish.from.x, fish.from.y, fish.from.z, SPLASH_SHARE);
        } else {
          this.effects.jump(
            fish.item,
            hasHand ? this.hand : fish.from,
            fish.by,
            true,
            context.reducedMotion,
            FISH_JUMP_SIZE,
          );
        }
        fish.object.removeFromParent();
        this.held.splice(i, 1);
      }
    }
  }

  /** Pendant la sortie de l'eau, la ligne va du scion au poisson. */
  private drawLineTo(id: CharacterId, at: Vector3): void {
    const angler = this.anglers.get(id);
    if (angler === undefined || !this.characters.rodTip(id, this.tip)) return;
    this.delta.copy(at).sub(this.tip);
    const length = this.delta.length();
    angler.line.visible = length > 1e-3;
    angler.line.position.copy(this.tip);
    angler.line.quaternion.copy(this.turn.setFromUnitVectors(Y_AXIS, this.delta.normalize()));
    angler.line.scale.set(1, length, 1);
  }

  dispose(): void {
    for (const fish of this.held) fish.object.removeFromParent();
    this.held.length = 0;
    this.anglers.clear();
    this.group.removeFromParent();
  }
}
