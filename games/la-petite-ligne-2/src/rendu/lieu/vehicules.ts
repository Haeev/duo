/**
 * Les véhicules de voie des joueurs à l'écran (`simulation/vehicules/`: la draisine): posés sur
 * les rails comme les trains (`trains.ts`: même corps, même pose, même fondu), dans leur remise
 * tant qu'ils dorment. Aucun véhicule nommé ici: tout vient de la fiche du lieu.
 *
 * - Mouvement: l'état donne la position et la vitesse (à chaque pas chez l'hôte, cinq fois par
 *   seconde chez l'invité). L'affichage avance à l'estime entre deux états et se recale en
 *   douceur: même code des deux côtés, aucun à-coup pour la caméra.
 * - À bord: `riders` dit où est assis chaque joueur sur le véhicule affiché; la couche des
 *   personnages les y pose sans lissage (ils ne traînent pas derrière leur banc).
 * - Parties mobiles, lues dans le manifeste des décors (`nodes` du modèle): un nœud à débattement
 *   (le balancier) bascule de son débattement vers la place qui vient de pomper, un nœud à rayon
 *   (une roue) tourne avec le chemin parcouru. Aucun nom de nœud ici.
 * - Sans modèle livré: le modèle de repli de la fiche ramené au gabarit du plancher (sinon une
 *   dalle), deux bancs et un balancier provisoires aux mesures de la fiche.
 * - Occultation: un véhicule qui passe devant un joueur à pied se fond (choix du client), jamais
 *   devant ceux qu'il porte.
 */
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PlaceContent } from '../../donnees/charger';
import type { RailVehicleDef } from '../../donnees/schemas/vehicule';
import type { ReadonlyWorld } from '../../etat/monde';
import type { VehiclePose } from '../../simulation/monde/trains';
import { vehicleAimId } from '../../simulation/vehicules/cible';
import { poseVehicle, seatPlace, type Place2 } from '../../simulation/vehicules/voie';
import { approach } from '../camera';
import type { Aimable } from '../cible';
import { inkTag } from '../encre/conversion';
import { LAYER } from '../encre/couches';
import { Fadable, isMesh } from '../fondu';
import { Occlusion, type Vec3 } from '../occultation';
import { RENDER_SETTINGS } from '../reglages';
import { ResourceTracker } from '../ressources';
import { DECOR_MANIFEST, type DecorManifest } from './decors-manifeste';
import type { ModelSource } from './lieu';
import { buildVehicleBody, vehicleBox, type VehicleMaterials } from './trains';

/** Réglages du rendu des véhicules de voie. */
export const RAIL_VEHICLE_LOOK = {
  /** Écart (m) au-delà duquel le véhicule affiché se pose d'un coup (sortie, rangement, reprise). */
  snapMeters: 4,
  /** Demi-vie du recalage sur la position de l'état (s). */
  catchHalfLife: 0.1,
  /** Estime: l'état est prolongé à sa vitesse pendant ce temps au plus (s). */
  aheadSeconds: 0.4,
  /**
   * Balancier provisoire (sans modèle livré): angle de chaque côté de l'horizontale (rad); le
   * modèle livré donne le sien (`debattement` du manifeste). Demi-vie de la bascule (s).
   */
  leverAngle: 0.24,
  leverHalfLife: 0.06,
  /** Nom du balancier provisoire. */
  standInLever: 'balancier',
  /** Formes provisoires, tant que le modèle n'est pas livré (m, couleurs de sommets). */
  standIn: {
    deck: '#7a6248',
    bench: '#8d7353',
    iron: '#3d3b3c',
    benchWidth: 1,
    benchDepth: 0.34,
    benchThick: 0.07,
    legThick: 0.07,
    /**
     * Pivot du balancier au-dessus du plancher, demi-longueur du fléau, poignées en travers. À
     * 0,5 m du pivot, la poignée s'arrête à une vingtaine de centimètres du buste de l'assis
     * (place à 0,85 m): à 0,6 m elle lui entrait dans le ventre en descendant.
     */
    pivot: 0.72,
    leverHalf: 0.5,
    beam: 0.07,
    handle: 0.7,
    post: 0.11,
  },
} as const;

/** Où est assis un joueur à bord, sur le véhicule tel qu'il est affiché. */
export interface RiderPose extends Place2 {
  /** Hauteur du plancher (m, repère de la scène): les pieds s'y posent. */
  floor: number;
  /** Dessus de l'assise au-dessus du plancher, et son bord avant depuis son centre (m). */
  height: number;
  front: number;
}

type Axis = 'x' | 'y' | 'z';

/** Une partie mobile du modèle affiché: le balancier (`angle`, rad) ou une roue (`radius`, m). */
interface MovingPart {
  readonly object: Object3D;
  readonly axis: Axis;
  readonly angle: number;
  readonly radius: number;
}

interface View {
  readonly def: RailVehicleDef;
  /** Identifiant de cible (`vehicule-<id>`), aussi clé d'occultation. */
  readonly key: string;
  readonly object: Object3D;
  readonly fadable: Fadable;
  readonly levers: readonly MovingPart[];
  readonly wheels: readonly MovingPart[];
  readonly pose: VehiclePose;
  readonly min: { x: number; y: number; z: number };
  readonly max: { x: number; y: number; z: number };
  occluding: boolean;
  /** Sorti à la dernière image (`null`: pas encore affiché). */
  out: boolean | null;
  /** Position affichée sur la voie (m), dernier état vu et son âge (s). */
  shown: number;
  lastS: number;
  lastSpeed: number;
  age: number;
  /** Vitesse affichée, signée le long de la voie (m/s). */
  run: number;
  /** Bascule affichée du balancier, de -1 (vers la place 1) à 1 (vers la place 0). */
  angle: number;
  /** Côté où penche le balancier (place du dernier coup), et le pas du dernier coup lu dans l'état. */
  side: 0 | 1 | null;
  leverTick: number;
  /** Qui tient chaque place, à la dernière image. */
  readonly riders: [0 | 1 | null, 0 | 1 | null];
  ground: number;
  glow: number;
}

function paint(geometry: BufferGeometry, hex: string): BufferGeometry {
  const color = new Color(hex);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  const geometry = new BoxGeometry(w, h, d);
  geometry.deleteAttribute('uv');
  geometry.translate(x, y, z);
  return geometry;
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geometry;
}

const seat: Place2 = { x: 0, y: 0, facing: 0 };

export class RailVehicleLayer {
  readonly root = new Group();
  /** Pose à bord de chaque joueur pour cette image (`null`: à pied). */
  readonly riders: [RiderPose | null, RiderPose | null] = [null, null];
  private readonly pool: [RiderPose, RiderPose] = [
    { x: 0, y: 0, facing: 0, floor: 0, height: 0, front: 0 },
    { x: 0, y: 0, facing: 0, floor: 0, height: 0, front: 0 },
  ];
  private readonly carriers: [View | null, View | null] = [null, null];
  private readonly views = new Map<string, View>();
  private readonly byKey = new Map<string, View>();
  private readonly tracker = new ResourceTracker();
  private readonly occlusion = new Occlusion();
  private readonly glowColor = new Color(RENDER_SETTINGS.target.rimColor);

  constructor(
    private readonly place: PlaceContent,
    private readonly models: ModelSource | null,
    private readonly materials: VehicleMaterials,
    private readonly heightAt: (x: number, y: number) => number,
    private readonly manifest: DecorManifest = DECOR_MANIFEST,
  ) {
    this.root.name = 'vehicules';
    // Créés à l'entrée du lieu: aucun modèle ne se clone pendant le jeu.
    for (const def of Object.values(place.vehicles)) this.build(def);
  }

  /** Lieu qui a un véhicule de voie. */
  static wanted(place: PlaceContent): boolean {
    return Object.keys(place.vehicles).length > 0;
  }

  private build(def: RailVehicleDef): void {
    const key = vehicleAimId('board', def.id);
    const { front, back, halfWidth, deck } = def.body;
    const deckBox = { width: halfWidth * 2, height: Math.max(0.05, deck) };
    const object = new Group();
    let body = buildVehicleBody(
      this.models,
      this.materials,
      this.tracker,
      key,
      { model: def.model, front, back },
      deckBox,
    );
    const delivered = body.delivered;
    const sheet = def.fallback === undefined ? undefined : this.manifest.models[def.fallback];
    if (!delivered && def.fallback !== undefined && sheet !== undefined) {
      // Repli: un modèle existant, ramené au gabarit du plancher.
      const other = buildVehicleBody(
        this.models,
        this.materials,
        this.tracker,
        key,
        { model: def.fallback, front, back },
        deckBox,
      );
      if (other.delivered) {
        other.object.scale.set(
          deckBox.width / sheet.size.w,
          deckBox.height / sheet.size.h,
          (front + back) / sheet.size.d,
        );
        body = other;
      }
    }
    if (!body.delivered && isMesh(body.object))
      paint(body.object.geometry, RAIL_VEHICLE_LOOK.standIn.deck);
    object.add(body.object);
    const levers: MovingPart[] = [];
    const wheels: MovingPart[] = [];
    if (delivered)
      for (const [name, node] of Object.entries(this.manifest.models[def.model]?.nodes ?? {})) {
        const part = object.getObjectByName(name);
        if (part === undefined) continue;
        const axis = node.axe ?? 'x';
        if (node.rayon !== undefined)
          wheels.push({ object: part, axis, angle: 0, radius: node.rayon });
        else if (node.debattement !== undefined)
          levers.push({ object: part, axis, angle: (node.debattement * Math.PI) / 180, radius: 0 });
      }
    else
      levers.push({
        object: this.standIn(def, object),
        axis: 'x',
        angle: RAIL_VEHICLE_LOOK.leverAngle,
        radius: 0,
      });
    object.traverse((child) => {
      if (!isMesh(child)) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    object.name = key;
    this.root.add(object);
    const view: View = {
      def,
      key,
      object,
      fadable: new Fadable(object, this.glowColor),
      levers,
      wheels,
      pose: { model: def.model, x: 0, y: 0, yaw: 0, front, back },
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      occluding: false,
      out: null,
      shown: 0,
      lastS: Number.NaN,
      lastSpeed: 0,
      age: 0,
      run: 0,
      angle: 0,
      side: null,
      leverTick: -1,
      riders: [null, null],
      ground: 0,
      glow: 0,
    };
    this.views.set(def.id, view);
    this.byKey.set(key, view);
  }

  /** Bancs et balancier provisoires, aux mesures de la fiche; rend le nœud du balancier. */
  private standIn(def: RailVehicleDef, object: Group): Object3D {
    const look = RAIL_VEHICLE_LOOK.standIn;
    const deck = def.body.deck;
    const fixed: BufferGeometry[] = [];
    for (const place of def.seats) {
      const top = deck + place.height;
      fixed.push(
        paint(
          box(
            look.benchWidth,
            look.benchThick,
            look.benchDepth,
            place.side,
            top - look.benchThick / 2,
            place.along,
          ),
          look.bench,
        ),
      );
      for (const side of [-1, 1])
        fixed.push(
          paint(
            box(
              look.legThick,
              place.height - look.benchThick,
              look.benchDepth * 0.8,
              place.side + side * (look.benchWidth / 2 - look.legThick),
              deck + (place.height - look.benchThick) / 2,
              place.along,
            ),
            look.bench,
          ),
        );
    }
    fixed.push(
      paint(box(look.post, look.pivot, look.post, 0, deck + look.pivot / 2, 0), look.iron),
    );
    const lever = new Group();
    lever.name = RAIL_VEHICLE_LOOK.standInLever;
    lever.position.set(0, deck + look.pivot, 0);
    const moving = merged([
      paint(box(look.beam, look.beam, look.leverHalf * 2, 0, 0, 0), look.iron),
      paint(box(look.handle, look.beam, look.beam, 0, 0, look.leverHalf), look.iron),
      paint(box(look.handle, look.beam, look.beam, 0, 0, -look.leverHalf), look.iron),
    ]);
    const still = this.tracker.track(merged(fixed));
    this.tracker.track(moving);
    if (this.materials.ink !== null)
      for (const geometry of [still, moving]) inkTag(geometry, { layer: LAYER.plain });
    lever.add(new Mesh(moving, this.materials.standIn));
    object.add(new Mesh(still, this.materials.standIn), lever);
    return lever;
  }

  /**
   * Avant les personnages: pose chaque véhicule (position de l'état, lissée), anime balancier et
   * roues, et dit où est assis chaque joueur à bord (`riders`).
   */
  advance(dt: number, world: ReadonlyWorld): void {
    this.riders[0] = null;
    this.riders[1] = null;
    this.carriers[0] = null;
    this.carriers[1] = null;
    const states = world.places[this.place.def.id]?.vehicles;
    const look = RAIL_VEHICLE_LOOK;
    for (const view of this.views.values()) {
      const state = states?.[view.def.id];
      const out = state?.out === true;
      const before = view.shown;
      if (state !== undefined && out) {
        const fresh = view.out !== true || state.s !== view.lastS || state.speed !== view.lastSpeed;
        view.age = fresh ? 0 : Math.min(look.aheadSeconds, view.age + dt);
        view.lastS = state.s;
        view.lastSpeed = state.speed;
        view.run = state.dir * state.speed;
        const target = state.s + view.run * view.age;
        if (view.out !== true || Math.abs(target - view.shown) > look.snapMeters)
          view.shown = target;
        else {
          view.shown += view.run * dt;
          view.shown += (target - view.shown) * approach(dt, look.catchHalfLife);
        }
      } else view.run = 0;
      const rolled = view.out === true && out ? view.shown - before : 0;
      view.out = out;
      if (!poseVehicle(this.place, view.def, state, view.pose, view.shown)) {
        view.object.visible = false;
        continue;
      }
      const pose = view.pose;
      view.ground = this.heightAt(pose.x, pose.y);
      view.object.visible = true;
      view.object.position.set(pose.x, view.ground, pose.y);
      view.object.rotation.y = pose.yaw;
      // Balancier: il descend du côté de qui vient de pomper (place 0: l'avant). L'état fait
      // foi; entre deux états, l'événement du coup l'a déjà fait basculer (`stroke`).
      if (state === undefined || !out) {
        view.side = null;
        view.leverTick = -1;
        view.riders[0] = null;
        view.riders[1] = null;
      } else {
        if (state.lever.tick !== view.leverTick) {
          view.leverTick = state.lever.tick;
          view.side = state.lever.seat;
        }
        view.riders[0] = state.riders[0];
        view.riders[1] = state.riders[1];
      }
      // `angle`: part de la bascule (-1 à 1), chaque balancier la fait à son propre débattement.
      const side = view.side;
      const wanted = side === null ? 0 : side === 0 ? 1 : -1;
      view.angle += (wanted - view.angle) * approach(dt, look.leverHalfLife);
      for (const lever of view.levers) lever.object.rotation[lever.axis] = view.angle * lever.angle;
      for (const wheel of view.wheels) wheel.object.rotation[wheel.axis] += rolled / wheel.radius;
      if (state === undefined || !out) continue;
      for (const index of [0, 1] as const) {
        const player = state.riders[index];
        if (player === null) continue;
        const place = view.def.seats[index];
        seatPlace(pose, place, seat);
        const rider = this.pool[player];
        rider.x = seat.x;
        rider.y = seat.y;
        rider.facing = seat.facing;
        rider.floor = view.ground + view.def.body.deck;
        rider.height = place.height;
        rider.front = place.front;
        this.riders[player] = rider;
        this.carriers[player] = view;
      }
    }
  }

  /**
   * Un coup de balancier vient d'être donné (événement `vehicle_stroke` qui pousse ou bloque):
   * le balancier bascule tout de suite du côté de ce joueur, sans attendre l'état suivant.
   */
  stroke(vehicle: string, player: 0 | 1): void {
    const view = this.views.get(vehicle);
    if (view === undefined) return;
    if (view.riders[0] === player) view.side = 0;
    else if (view.riders[1] === player) view.side = 1;
  }

  /** Vitesse et cap (0 vers l'est, PI/2 vers le sud) du véhicule qui porte ce joueur, pour la caméra. */
  motion(player: 0 | 1, out: { speed: number; facing: number }): boolean {
    const view = this.carriers[player];
    if (view === null) return false;
    const forward = Math.PI / 2 - view.pose.yaw;
    out.speed = Math.abs(view.run);
    out.facing = view.run >= 0 ? forward : forward + Math.PI;
    return true;
  }

  /** Le véhicule qui porte ce joueur à cette image (identifiant de fiche), `null` s'il est à pied. */
  carrying(player: 0 | 1): string | null {
    return this.carriers[player]?.def.id ?? null;
  }

  /**
   * Après la caméra: un véhicule sorti qui cache un joueur à pied se fond devant lui. `aboard`:
   * le véhicule qui porte le joueur local (il ne se fond pas devant ceux qu'il porte).
   */
  occlude(dt: number, subjects: readonly Vec3[], toCamera: Vec3, aboard: string | null): void {
    for (const view of this.views.values()) {
      const wanted = view.out === true && view.object.visible && view.def.id !== aboard;
      if (wanted) {
        const { halfWidth, height } = view.def.body;
        vehicleBox(view.pose, halfWidth, view.ground, height, view.min, view.max);
        if (!view.occluding)
          view.occluding = this.occlusion.add({ id: view.key, min: view.min, max: view.max });
      } else if (view.occluding) {
        this.occlusion.remove(view.key);
        view.occluding = false;
        view.fadable.apply(1, view.glow);
      }
    }
    for (const id of this.occlusion.update(dt, subjects, toCamera)) {
      const view = this.byKey.get(id);
      if (view !== undefined) view.fadable.apply(this.occlusion.opacity(id), view.glow);
    }
  }

  /** Le véhicule visé par la touche d'action (`vehicule-<id>`), pour sa lueur de cible. */
  aimable(id: string): Aimable | null {
    const view = this.byKey.get(id);
    if (view === undefined) return null;
    return {
      object: view.object,
      setGlow: (glow: number): void => {
        view.glow = glow;
        view.fadable.apply(view.occluding ? this.occlusion.opacity(view.key) : 1, glow);
      },
    };
  }

  dispose(): void {
    for (const view of this.views.values()) view.fadable.dispose();
    this.views.clear();
    this.byKey.clear();
    this.tracker.dispose();
    this.root.removeFromParent();
    this.riders[0] = null;
    this.riders[1] = null;
    this.carriers[0] = null;
    this.carriers[1] = null;
  }
}
