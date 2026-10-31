/**
 * Signes entre les deux joueurs (P1):
 * - le repère (touche G): une épingle à la couleur et au symbole du profil
 *   Duo de celui qui l'a plantée, visible des deux et à travers les murs, qui
 *   tombe du ciel en rebondissant, avec une onde au sol qui se répète, et
 *   s'efface à la fin de ses 15 secondes;
 * - l'absence: le personnage s'assoit (animation `sit` de la simulation) et
 *   une auréole douce, à sa couleur, respire lentement au sol autour de lui.
 *   Aucun symbole au-dessus de la tête.
 */
import {
  Color,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Shape,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { CharacterId, DeepReadonly, Character } from '../etat/types';
import { SCARF_SYMBOLS, safeColor, scarfMeshFor } from './apparence';
import { interpolate, type FrameContext } from './contexte';
import { ShapeBuilder, paintGeometry } from './geometrie';
import type { SharedMaterials } from './materiaux';
import type { EventfulPart } from './monde';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const POLE_HEIGHT = 1.25;
const POLE_RADIUS = 0.025;
const HEAD_LIFT = POLE_HEIGHT + 0.14;
const DROP_HEIGHT = 1.4;
const DROP_SECONDS = 0.45;
const BOUNCE = 0.18;
const FADE_SHARE = 0.08;
const WAVE_EVERY = 1.4;
const WAVE_GROWTH = 2.2;
const WAVE_OPACITY = 0.7;
const RING_INNER = 0.32;
const RING_OUTER = 0.42;
const RING_SEGMENTS = 32;
const GROUND_LIFT = 0.03;
const HALO_INNER = 0.42;
const HALO_OUTER = 0.62;
const HALO_SPEED = 2.2;
const HALO_MIN = 0.14;
const HALO_RANGE = 0.16;
const STAR_POINTS = 5;
const STAR_OUTER = 0.17;
const STAR_INNER = 0.075;
const EXTRUDE_DEPTH = 0.05;
const HALF = 0.5;
const SUN_RAYS = 8;
const SUN_RAY_REACH = 0.15;

/** Têtes d'épingle par symbole du profil (astre, croissant, étoile, soleil, planète, comète). */
function symbolGeometry(mesh: string): BufferGeometry {
  const b = new ShapeBuilder();
  switch (mesh) {
    case 'player_scarf_crescent': {
      const torus = new TorusGeometry(0.13, 0.045, 6, 14, Math.PI * 1.25);
      torus.rotateZ(Math.PI * 0.35);
      b.add(torus, 'white_paint', [0, 0, 0]);
      break;
    }
    case 'player_scarf_star': {
      const shape = new Shape();
      for (let i = 0; i < STAR_POINTS * 2; i += 1) {
        const angle = (i / (STAR_POINTS * 2)) * Math.PI * 2 + Math.PI / 2;
        const radius = i % 2 === 0 ? STAR_OUTER : STAR_INNER;
        if (i === 0) {
          shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        } else {
          shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
      }
      const star = new ExtrudeGeometry(shape, { depth: EXTRUDE_DEPTH, bevelEnabled: false });
      star.translate(0, 0, -EXTRUDE_DEPTH / 2);
      b.add(star, 'white_paint', [0, 0, 0]);
      break;
    }
    case 'player_scarf_sun':
      b.cylinder(0.1, 0.1, 0.05, [0, 0, 0], 'white_paint', { rotation: [90, 0, 0], segments: 12 });
      for (let i = 0; i < SUN_RAYS; i += 1) {
        const angle = (i / SUN_RAYS) * Math.PI * 2;
        b.box(
          [0.03, 0.06, 0.03],
          [Math.sin(angle) * SUN_RAY_REACH, Math.cos(angle) * SUN_RAY_REACH, 0],
          'white_paint',
          {
            rotation: [0, 0, (-angle * 180) / Math.PI],
          },
        );
      }
      break;
    case 'player_scarf_planet': {
      b.ball(0.1, [0, 0, 0], 'white_paint', { detail: 1 });
      const ring = new TorusGeometry(0.17, 0.018, 4, 20);
      ring.rotateX(Math.PI * 0.42);
      b.add(ring, 'white_paint', [0, 0, 0]);
      break;
    }
    case 'player_scarf_comet':
      b.ball(0.095, [0.04, 0.03, 0], 'white_paint', { detail: 1 });
      b.cone(0.07, 0.22, [-0.09, -0.06, 0], 'white_paint', { rotation: [0, 0, 125], segments: 6 });
      break;
    default:
      b.ball(0.13, [0, 0, 0], 'white_paint', { detail: 1 });
      break;
  }
  return b.build();
}

interface PinView {
  group: Group;
  head: Mesh;
  material: MeshBasicMaterial;
  wave: Mesh;
  waveMaterial: MeshBasicMaterial;
  symbol: string;
  since: number;
  shownAt: number;
}

interface HaloView {
  mesh: Mesh;
  material: MeshBasicMaterial;
}

export class SignsPart implements EventfulPart {
  readonly group = new Group();
  private readonly pins = new Map<CharacterId, PinView>();
  private readonly halos = new Map<CharacterId, HaloView>();
  private readonly symbols = new Map<string, BufferGeometry>();
  private readonly pole: BufferGeometry;
  private readonly ring: BufferGeometry;
  private readonly halo: BufferGeometry;
  private readonly point = { x: 0, y: 0 };

  constructor(
    private readonly materials: SharedMaterials,
    private readonly terrain: Terrain,
    private readonly resources: ResourceTracker,
  ) {
    this.group.name = 'signes';
    this.pole = resources.track(
      new ShapeBuilder()
        .cylinder(POLE_RADIUS, POLE_RADIUS, POLE_HEIGHT, [0, 0, 0], 'white_paint', {
          base: true,
          segments: 5,
        })
        .build(),
    );
    this.ring = resources.track(this.flatRing(RING_INNER, RING_OUTER));
    this.halo = resources.track(this.flatRing(HALO_INNER, HALO_OUTER));
    for (const symbol of SCARF_SYMBOLS) {
      this.symbols.set(symbol.mesh, resources.track(symbolGeometry(symbol.mesh)));
    }
  }

  private flatRing(inner: number, outer: number): BufferGeometry {
    const ring = new RingGeometry(inner, outer, RING_SEGMENTS).toNonIndexed();
    ring.rotateX(-Math.PI / 2);
    paintGeometry(ring, 'white_paint');
    return ring;
  }

  /** Matériau sans lumière sur la case blanche de la palette: même programme que les fantômes. */
  private tinted(color: string, seeThrough: boolean): MeshBasicMaterial {
    return this.resources.track(
      new MeshBasicMaterial({
        map: this.materials.paletteTexture,
        color: new Color(color),
        transparent: true,
        depthWrite: false,
        // L'épingle se voit à travers les murs: c'est un signal pour l'autre joueur.
        depthTest: !seeThrough,
      }),
    );
  }

  private pinView(character: DeepReadonly<Character>): PinView {
    const symbol = scarfMeshFor(character.appearance.scarf);
    const existing = this.pins.get(character.id);
    if (existing?.symbol === symbol) {
      return existing;
    }
    existing?.group.removeFromParent();
    const color = safeColor(character.appearance.scarf);
    const material = this.tinted(color, true);
    const group = new Group();
    group.name = `repere ${character.id}`;
    const pole = new Mesh(this.pole, material);
    const head = new Mesh(this.symbols.get(symbol) ?? this.pole, material);
    head.position.y = HEAD_LIFT;
    const waveMaterial = this.tinted(color, false);
    const wave = new Mesh(this.ring, waveMaterial);
    wave.position.y = GROUND_LIFT;
    for (const mesh of [pole, head]) {
      mesh.renderOrder = 4;
    }
    wave.renderOrder = 3;
    group.add(pole, head, wave);
    this.group.add(group);
    const view: PinView = {
      group,
      head,
      material,
      wave,
      waveMaterial,
      symbol,
      since: -1,
      shownAt: 0,
    };
    this.pins.set(character.id, view);
    return view;
  }

  update(context: FrameContext): void {
    for (const character of context.world.characters) {
      this.updatePin(character, context);
      this.updateHalo(character, context);
    }
  }

  private updatePin(character: DeepReadonly<Character>, context: FrameContext): void {
    const pin = character.pin;
    if (pin === null) {
      const view = this.pins.get(character.id);
      if (view !== undefined) {
        view.group.visible = false;
      }
      return;
    }
    const view = this.pinView(character);
    if (view.since !== pin.since) {
      view.since = pin.since;
      view.shownAt = context.time;
    }
    const ground = this.terrain.heightAt(pin.pos.x, pin.pos.y);
    view.group.visible = true;
    view.group.position.set(pin.pos.x, ground, pin.pos.y);
    // Chute avec un petit rebond à l'apparition (instantanée si les animations sont réduites).
    const t = context.reducedMotion ? 1 : Math.min(1, (context.time - view.shownAt) / DROP_SECONDS);
    const fall = (1 - t) * (1 - t) * DROP_HEIGHT;
    const bounce = t < 1 ? Math.sin(t * Math.PI) * BOUNCE * (1 - t) : 0;
    view.group.position.y += fall + bounce;
    // La tête fait face à la caméra.
    view.head.rotation.y = Math.atan2(-Math.cos(context.shownYaw), -Math.sin(context.shownYaw));
    // Fondu sur la fin de la durée (part de la durée totale, sans dépendre de la cadence de la simulation).
    const span = Math.max(1, pin.until - pin.since);
    const progress = (context.world.tick - pin.since) / span;
    const fade = Math.min(1, Math.max(0, (1 - progress) / FADE_SHARE));
    view.material.opacity = fade;
    const wave = ((context.time - view.shownAt) % WAVE_EVERY) / WAVE_EVERY;
    view.wave.scale.setScalar(1 + wave * WAVE_GROWTH);
    view.wave.position.y = GROUND_LIFT - (fall + bounce);
    view.waveMaterial.opacity = (1 - wave) * WAVE_OPACITY * fade;
  }

  private updateHalo(character: DeepReadonly<Character>, context: FrameContext): void {
    let halo = this.halos.get(character.id);
    if (!character.absent) {
      if (halo !== undefined) {
        halo.mesh.visible = false;
      }
      return;
    }
    if (halo === undefined) {
      const material = this.tinted(safeColor(character.appearance.scarf), false);
      const mesh = new Mesh(this.halo, material);
      mesh.name = `absence ${character.id}`;
      mesh.renderOrder = 3;
      this.group.add(mesh);
      halo = { mesh, material };
      this.halos.set(character.id, halo);
    }
    const at = interpolate(character.prev, character.pos, context.alpha, this.point);
    halo.mesh.visible = true;
    halo.mesh.position.set(at.x, this.terrain.heightAt(at.x, at.y) + GROUND_LIFT, at.y);
    halo.material.color.set(safeColor(character.appearance.scarf));
    const breath = context.reducedMotion ? HALF : (Math.sin(context.time * HALO_SPEED) + 1) * HALF;
    halo.material.opacity = HALO_MIN + HALO_RANGE * breath;
  }

  dispose(): void {
    this.pins.clear();
    this.halos.clear();
    this.group.removeFromParent();
  }
}
