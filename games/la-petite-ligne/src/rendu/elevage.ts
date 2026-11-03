/**
 * L'élevage à l'écran (0.12, conception section 4): les chèvres (squelette `goat` de l'artiste,
 * robes `goat_chamois` et `goat_white`, clips de `elevage.glb`), leur piquet `goat_stake` et la corde
 * tendue de son `rope_anchor` au collier `socket_goat_neck` (ou à la main de qui la mène), la
 * litière du poulailler (jaune pâle, puis dorée une fois changée) et l'herbe rase des pâtures
 * broutées la veille. Le coq et les poussines sont dessinés avec les poules (`vie.ts`).
 *
 * Tout se lit dans l'état: mêmes images chez l'hôte et chez l'invité, et après une reprise. Sans
 * modèle, les substituts de `substituts.ts` prennent la place (même nom).
 */
import {
  AnimationMixer,
  Group,
  Mesh,
  SkinnedMesh,
  Sphere,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three';
import type { Content } from '../donnees/types';
import type { GameMap } from '../etat/carte';
import { spotShorn } from '../etat/elevage';
import { SIM_HZ } from '../etat/types';
import { dampAngle, interpolate, yawFromFacing, type FrameContext } from './contexte';
import { smoothFactor } from './camera';
import { ShapeBuilder } from './geometrie';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const FILE = 'elevage.glb';
const GOAT_RIG = 'goat';
const GOAT_ROBES = ['goat_chamois', 'goat_white'] as const;
const NECK_SOCKET = 'socket_goat_neck';
const STAKE_MODEL = 'goat_stake';
const COOP_POINT = 'chicken_coop';
/** Repères par défaut si le modèle n'a pas ses extras: nœud de la corde au piquet, collier. */
const STAKE_KNOT = 0.405;
const COLLAR_HEIGHT = 0.64;
const COLLAR_FORWARD = 0.4;
/** Main de qui mène la chèvre (m au-dessus du sol). */
const HAND_HEIGHT = 0.95;
const TURN_HALF_LIFE = 0.15;
/** Vitesses de référence des clips (m/s, fiche de l'artiste): marche et trot. */
const WALK_REFERENCE = 0.78;
const TROT_REFERENCE = 2.8;
const TROT_FROM = 1.2;
const MOVING_SPEED = 0.05;
/** Part du temps où une chèvre au piquet broute (le reste: elle rumine). */
const GRAZE_SHARE = 0.6;
const GRAZE_CYCLE = 9;
const GOAT_RADIUS = 0.45;
/** Litière au seuil du poulailler (m): devant la porte, au sud du point `chicken_coop`. */
const LITTER = { dx: 0, dy: -0.25, w: 1.1, d: 0.45 };
const SHORN_RADIUS = 0.7;

interface GoatView {
  root: Object3D;
  socket: Object3D | null;
  mixer: AnimationMixer | null;
  actions: Map<string, AnimationAction>;
  current: string;
  facing: number | null;
  phase: number;
}

export class BreedingPart implements EventfulPart {
  readonly group = new Group();
  private readonly goats = new Map<string, GoatView>();
  private readonly clips = new Map<string, AnimationClip>();
  private readonly stakes = new Map<string, Object3D>();
  private readonly ropes = new Map<string, Mesh>();
  private readonly ropeGeometry;
  private readonly litterOld: Mesh;
  private readonly litterFresh: Mesh;
  private readonly shorn = new Map<string, Mesh>();
  private readonly point = { x: 0, y: 0 };
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private readonly seen = new Set<string>();
  private readonly stakeKnot: number;

  constructor(
    private readonly map: GameMap,
    private readonly content: Content,
    private readonly library: ModelLibrary,
    private readonly materials: SharedMaterials,
    private readonly terrain: Terrain,
    resources: ResourceTracker,
  ) {
    this.group.name = 'elevage';
    for (const clip of library.animations(FILE)) this.clips.set(clip.name, clip);
    const anchor = library.extras(STAKE_MODEL).rope_anchor;
    const knot = Array.isArray(anchor) ? (anchor as unknown[])[1] : undefined;
    this.stakeKnot = typeof knot === 'number' ? knot : STAKE_KNOT;
    // Corde: un brin d'une unité de long le long de +Z, étiré et orienté à chaque image.
    this.ropeGeometry = resources.track(
      new ShapeBuilder().box([0.022, 0.022, 1], [0, 0, 0.5], 'rope', {}).build(),
    );
    const litter = (paint: 'sand' | 'straw'): Mesh => {
      const mesh = new Mesh(
        resources.track(
          new ShapeBuilder()
            .box([LITTER.w, 0.02, LITTER.d], [0, 0, 0], paint, { base: true })
            .build(),
        ),
        materials.palette,
      );
      mesh.receiveShadow = true;
      mesh.visible = false;
      this.group.add(mesh);
      return mesh;
    };
    this.litterOld = litter('sand');
    this.litterFresh = litter('straw');
    const coop = map.points[COOP_POINT];
    if (coop !== undefined) {
      for (const mesh of [this.litterOld, this.litterFresh])
        mesh.position.set(
          coop.x + LITTER.dx,
          terrain.heightAt(coop.x, coop.y + LITTER.dy) + 0.005,
          coop.y + LITTER.dy,
        );
    }
    const goats = content.settings.goats;
    for (const id of goats?.spots ?? []) {
      const at = map.points[id];
      if (at === undefined) continue;
      const mesh = new Mesh(
        resources.track(
          new ShapeBuilder()
            .cylinder(SHORN_RADIUS, SHORN_RADIUS, 0.012, [0, 0, 0], 'path', {
              base: true,
              segments: 14,
            })
            .build(),
        ),
        materials.palette,
      );
      mesh.position.set(at.x, terrain.heightAt(at.x, at.y) + 0.004, at.y);
      mesh.receiveShadow = true;
      mesh.visible = false;
      this.shorn.set(id, mesh);
      this.group.add(mesh);
    }
  }

  /** La chèvre n° `index` de l'état: première chamoisée, deuxième blanche. */
  private goatView(id: string, index: number): GoatView {
    let view = this.goats.get(id);
    if (view !== undefined) return view;
    const robe = GOAT_ROBES[index % GOAT_ROBES.length] ?? GOAT_ROBES[0];
    const rigged =
      this.library.node(robe) === null ? null : this.library.cloneRig(GOAT_RIG, [robe]);
    const root = rigged ?? this.library.instantiate(GOAT_RIG);
    root.traverse((o) => {
      o.castShadow = true;
      // Élimination hors champ: une sphère fixe autour du corps (la pose du moment ne compte pas).
      if (o instanceof SkinnedMesh)
        o.boundingSphere = new Sphere(new Vector3(0, 0.5, 0), GOAT_RADIUS * 2);
    });
    this.group.add(root);
    view = {
      root,
      socket: root.getObjectByName(NECK_SOCKET) ?? null,
      mixer: rigged !== null && this.clips.size > 0 ? new AnimationMixer(root) : null,
      actions: new Map(),
      current: '',
      facing: null,
      phase: (index * 0.37) % 1,
    };
    this.goats.set(id, view);
    return view;
  }

  private play(view: GoatView, name: string, timeScale = 1): void {
    const clip = this.clips.get(name);
    if (view.mixer === null || clip === undefined) return;
    let action = view.actions.get(name);
    if (action === undefined) {
      action = view.mixer.clipAction(clip);
      view.actions.set(name, action);
    }
    action.timeScale = timeScale;
    if (view.current === name) return;
    action.reset().fadeIn(RENDER_SETTINGS.characters.crossFadeSeconds).play();
    view.actions.get(view.current)?.fadeOut(RENDER_SETTINGS.characters.crossFadeSeconds);
    view.current = name;
  }

  update(context: FrameContext): void {
    const world = context.world;
    const b = world.breeding;
    this.seen.clear();
    const goats = this.content.settings.goats;
    const night = goats !== null && world.clock.minutes >= goats.homeAt;
    b.goats.forEach((g, index) => {
      this.seen.add(g.id);
      const view = this.goatView(g.id, index);
      // La nuit, elle dort à la chevrerie (rentrée); à l'aube elle attend devant la porte.
      const inside = g.home && night;
      view.root.visible = !inside;
      const stakeAt = this.map.points[g.stake];
      const stake = this.stake(g.id);
      // Menée, le piquet est dans la main de qui la mène.
      stake.visible = stakeAt !== undefined && g.led === null;
      if (stakeAt !== undefined)
        stake.position.set(stakeAt.x, this.terrain.heightAt(stakeAt.x, stakeAt.y), stakeAt.y);
      const rope = this.rope(g.id);
      rope.visible = false;
      if (inside) return;
      const at = interpolate(g.prev, g.pos, context.alpha, this.point);
      view.root.position.set(at.x, this.terrain.heightAt(at.x, at.y), at.y);
      const yaw = yawFromFacing(g.facing);
      view.facing =
        view.facing === null
          ? yaw
          : dampAngle(view.facing, yaw, smoothFactor(context.dt, TURN_HALF_LIFE));
      view.root.rotation.y = view.facing;
      const speed = Math.hypot(g.pos.x - g.prev.x, g.pos.y - g.prev.y) * SIM_HZ;
      if (g.milking !== null) this.play(view, 'goat_milk_stand');
      else if (speed > TROT_FROM) this.play(view, 'goat_trot', speed / TROT_REFERENCE);
      else if (speed > MOVING_SPEED) this.play(view, 'goat_walk', speed / WALK_REFERENCE);
      else {
        const cycle = (context.time / GRAZE_CYCLE + view.phase) % 1;
        this.play(
          view,
          !g.home && g.led === null && cycle < GRAZE_SHARE ? 'goat_graze' : 'goat_idle',
        );
      }
      view.mixer?.update(context.dt);
      const leader = g.led === null ? null : (world.characters.find((c) => c.id === g.led) ?? null);
      if (g.home || (leader === null && stakeAt === undefined)) return;
      rope.visible = true;
      if (view.socket !== null) {
        view.root.updateMatrixWorld(true);
        view.socket.getWorldPosition(this.to);
      } else {
        this.to.set(
          view.root.position.x + Math.sin(view.facing) * COLLAR_FORWARD,
          view.root.position.y + COLLAR_HEIGHT,
          view.root.position.z + Math.cos(view.facing) * COLLAR_FORWARD,
        );
      }
      if (leader !== null) {
        const hand = interpolate(leader.prev, leader.pos, context.alpha, this.point);
        this.from.set(hand.x, this.terrain.heightAt(hand.x, hand.y) + HAND_HEIGHT, hand.y);
      } else if (stakeAt !== undefined) {
        this.from.set(
          stakeAt.x,
          this.terrain.heightAt(stakeAt.x, stakeAt.y) + this.stakeKnot,
          stakeAt.y,
        );
      }
      rope.position.copy(this.from);
      rope.scale.set(1, 1, Math.max(0.01, this.from.distanceTo(this.to)));
      rope.lookAt(this.to);
    });
    for (const [id, view] of this.goats) {
      if (this.seen.has(id)) continue;
      view.root.visible = false;
      const stake = this.stakes.get(id);
      if (stake !== undefined) stake.visible = false;
      const rope = this.ropes.get(id);
      if (rope !== undefined) rope.visible = false;
    }
    // Litière: jaune pâle, dorée trois jours après qu'on l'a changée.
    const care = this.content.settings.hens.care;
    const hasHens = world.hens.length > 0 && care !== null;
    const fresh =
      hasHens && b.strawDay !== null && world.clock.day - b.strawDay <= care.happiness.strawDays;
    this.litterFresh.visible = fresh;
    this.litterOld.visible = hasHens && !fresh;
    // Herbe rase aux places broutées hier ou avant-hier (et aujourd'hui).
    for (const [id, mesh] of this.shorn)
      mesh.visible =
        goats !== null &&
        b.goats.length > 0 &&
        spotShorn(b.grazed, id, world.clock.day, goats.happiness.freshDays);
  }

  private stake(id: string): Object3D {
    let s = this.stakes.get(id);
    if (s === undefined) {
      s = this.library.instantiate(STAKE_MODEL);
      s.traverse((o) => {
        o.castShadow = true;
      });
      this.group.add(s);
      this.stakes.set(id, s);
    }
    return s;
  }

  private rope(id: string): Mesh {
    let r = this.ropes.get(id);
    if (r === undefined) {
      r = new Mesh(this.ropeGeometry, this.materials.palette);
      r.castShadow = false;
      this.group.add(r);
      this.ropes.set(id, r);
    }
    return r;
  }

  dispose(): void {
    for (const view of this.goats.values()) view.mixer?.stopAllAction();
    this.goats.clear();
    this.stakes.clear();
    this.ropes.clear();
    this.group.removeFromParent();
  }
}
