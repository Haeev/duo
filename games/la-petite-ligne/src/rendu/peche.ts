/**
 * La pêche au gué (P1): ligne tendue du bout de la canne au bouchon, bouchon
 * qui flotte et dodeline, qui plonge à la touche, poisson qui sort de l'eau et
 * saute au sac, ou bouchon qui remonte et s'en va s'il s'échappe. La pose du
 * pêcheur (lancer, attente, touche) est composée dans `personnages.ts`.
 */
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import type { CharacterId, WorldEvent } from '../etat/types';
import type { FrameContext } from './contexte';
import type { EffectsPart } from './effets';
import { ShapeBuilder } from './geometrie';
import type { SharedMaterials } from './materiaux';
import type { EventfulPart } from './monde';
import type { ModelLibrary } from './modeles';
import type { CharactersPart } from './personnages';
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
  private time = 0;

  constructor(
    private readonly materials: SharedMaterials,
    private readonly terrain: Terrain,
    resources: ResourceTracker,
    private readonly characters: CharactersPart,
    private readonly effects: EffectsPart,
    private readonly library: ModelLibrary,
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

  handleEvent(event: WorldEvent, context: FrameContext): void {
    if (event.type === 'cast') {
      const level = this.surface(event.at.x, event.at.y);
      this.effects.ripple(event.at.x, level, event.at.y, RIPPLE_COLOR, CAST_RIPPLE_SECONDS);
      this.effects.particles.emit('water', event.at.x, level, event.at.y, SPLASH_SHARE);
    } else if (event.type === 'caught') {
      const angler = this.angler(event.by);
      const from = angler.last;
      this.effects.particles.emit('water', from.x, from.y, from.z);
      this.effects.ripple(from.x, from.y, from.z, RIPPLE_COLOR, CAST_RIPPLE_SECONDS);
      this.effects.jump(event.item, from, event.by, true, context.reducedMotion, FISH_JUMP_SIZE);
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
  }

  dispose(): void {
    this.anglers.clear();
    this.group.removeFromParent();
  }
}
