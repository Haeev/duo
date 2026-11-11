/**
 * Les trains des événements à l'écran (`simulation/monde/trains.ts` dit où est chaque véhicule):
 * un exemplaire du modèle livré par véhicule (manifeste des décors), posé sur le sol affiché, au
 * cap de sa voie. Aucun train nommé ici: la rame, la voie et l'horaire sont dans les données.
 *
 * - Heure: celle de l'état, lissée d'une image à l'autre (la simulation avance par pas de 1/30 s);
 *   l'hôte et l'invité calculent la même pose.
 * - Nuit: un véhicule dont le modèle déclare sa lumière (`light` du manifeste) porte une lampe qui
 *   suit sa caisse; son verre (`vitrage`, `flamme`) s'allume avec elle. Les autres feux (`flamme`
 *   sans lumière déclarée) s'allument avec l'ambiance, comme toute lampe.
 * - Ombre: portée par chaque caisse (`castShadow`); occultation: la caisse qui cache un joueur
 *   se fond devant lui, comme un bâtiment (choix du client: le fondu, pas la découpe).
 */
import { BoxGeometry, Color, Group, type Material, Mesh, type Object3D, Vector4 } from 'three';
import type { Content, PlaceContent } from '../../donnees/charger';
import type { CalendarEventDef } from '../../donnees/schemas/temps';
import type { ReadonlyWorld } from '../../etat/monde';
import { MINUTES_PER_DAY } from '../../simulation/noyau/constantes';
import { TRAINS } from '../../simulation/monde/reglages-trains';
import {
  trainEvents,
  trainPoses,
  type TrainPose,
  type VehiclePose,
} from '../../simulation/monde/trains';
import { inkifyModel, inkTag } from '../encre/conversion';
import { LAYER } from '../encre/couches';
import { INK_INNER, type Lamp } from '../encre/matiere';
import { INK_SETTINGS } from '../encre/reglages';
import { Fadable, isMesh } from '../fondu';
import { Occlusion, type Vec3 } from '../occultation';
import { RENDER_SETTINGS } from '../reglages';
import { ResourceTracker } from '../ressources';
import { DECOR_MANIFEST, type DecorManifest } from './decors-manifeste';
import type { ModelSource } from './lieu';

/** Réglages du rendu des trains. */
export const TRAIN_LOOK = {
  /** Écart (minutes de jeu) au-delà duquel l'horloge affichée se recale d'un coup sur l'état. */
  snapMinutes: 0.5,
  /** Part de l'écart rattrapée à chaque image. */
  catchUp: 0.1,
  /** Hauteur d'une caisse sans modèle livré (m), et sa largeur (celle des caisses livrées). */
  standInHeight: 3.4,
  standInWidth: 2.93,
} as const;

/** Lampe d'un véhicule: elle suit sa caisse (position réécrite à chaque image). */
interface TrainLamp extends Lamp {
  x: number;
  y: number;
  z: number;
  share: number;
}

interface VehicleView {
  readonly key: string;
  readonly object: Object3D;
  readonly fadable: Fadable;
  /** Inscrit à l'occultation: une caisse devant un joueur se fond, comme un bâtiment. */
  occluding: boolean;
  readonly height: number;
  readonly light: DecorManifest['models'][string]['light'] | undefined;
  readonly lamp: TrainLamp | null;
  readonly min: { x: number; y: number; z: number };
  readonly max: { x: number; y: number; z: number };
  shown: boolean;
}

export interface TrainStats {
  /** Véhicules à l'écran (posés et visibles). */
  vehicles: number;
  /** Triangles des véhicules posés, d'après le manifeste. */
  triangles: number;
}

/** Clé d'un véhicule: l'événement et son rang dans la rame. */
function vehicleKey(event: string, index: number): string {
  return `${event}#${String(index)}`;
}

export class TrainLayer {
  readonly root = new Group();
  /** Lampes de tous les véhicules éclairants du lieu, éteintes (`share` 0) hors de la vue. */
  readonly lamps: Lamp[] = [];
  private readonly views = new Map<string, VehicleView>();
  private readonly tracker = new ResourceTracker();
  private readonly occlusion = new Occlusion();
  private readonly pool: TrainPose[] = [];
  private events: CalendarEventDef[] = [];
  private eventsKey = Number.NaN;
  private shownMinutes = Number.NaN;
  private readonly glowColor = new Color(RENDER_SETTINGS.target.rimColor);
  private readonly look: { content: Content; world: ReadonlyWorld | null };
  readonly stats: TrainStats = { vehicles: 0, triangles: 0 };

  constructor(
    private readonly place: PlaceContent,
    content: Content,
    private readonly models: ModelSource | null,
    private readonly materials: { readonly standIn: Material; readonly ink: Material | null },
    private readonly heightAt: (x: number, y: number) => number,
    private readonly manifest: DecorManifest = DECOR_MANIFEST,
  ) {
    this.root.name = 'trains';
    this.look = { content, world: null };
    // Les véhicules se créent tous à l'entrée du lieu (cachés): les lampes ont leur place dans
    // la liste du lieu, et aucun modèle ne se clone pendant le jeu.
    for (const event of content.time.events[place.def.id] ?? [])
      event.train?.consist.forEach((vehicle, i) => {
        this.build(vehicleKey(event.id, i), vehicle);
      });
  }

  /** Lieu dont un événement amène un train. */
  static wanted(content: Content, placeId: string): boolean {
    return (content.time.events[placeId] ?? []).some((event) => event.train !== undefined);
  }

  private build(key: string, vehicle: { model: string; front: number; back: number }): void {
    const model = this.models?.instantiate(vehicle.model, key) ?? null;
    const sheet = this.manifest.models[vehicle.model];
    let object: Object3D;
    if (model !== null) {
      object = this.materials.ink === null ? model : inkifyModel(model, this.materials.ink);
    } else {
      // Sans modèle livré: une caisse provisoire aux mesures de la rame, jamais un trou.
      const length = vehicle.front + vehicle.back;
      const geometry = this.tracker.track(
        new BoxGeometry(TRAIN_LOOK.standInWidth, TRAIN_LOOK.standInHeight, length),
      );
      geometry.translate(0, TRAIN_LOOK.standInHeight / 2, (vehicle.front - vehicle.back) / 2);
      if (this.materials.ink !== null) inkTag(geometry, { layer: LAYER.plain });
      object = new Mesh(geometry, this.materials.standIn);
    }
    const light = model === null ? undefined : sheet?.light;
    const glass =
      light === undefined || this.materials.ink === null ? null : new Vector4(2, 0, 0, 0);
    object.traverse((child) => {
      if (!isMesh(child)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      if (glass !== null) child.userData[INK_INNER] = glass;
    });
    object.name = `train-${key}`;
    object.visible = false;
    this.root.add(object);
    const lamp: TrainLamp | null =
      light === undefined
        ? null
        : {
            x: 0,
            y: 0,
            z: 0,
            // Au milieu de la caisse: force et rayon accordés à ceux des lampes du dehors.
            radius: light.radius * INK_SETTINGS.lamps.vehicle.radius,
            shadow: false,
            share: 0,
            // Allumée avec les premières lampes du dehors (à la nuit tombante), pas au moindre soupçon.
            phase: 0,
            gain: (light.gain ?? 1) * INK_SETTINGS.lamps.vehicle.gain,
            ...(glass === null ? {} : { glass }),
          };
    if (lamp !== null) this.lamps.push(lamp);
    const height = sheet?.size.h ?? TRAIN_LOOK.standInHeight;
    const view: VehicleView = {
      key,
      object,
      fadable: new Fadable(object, this.glowColor),
      occluding: false,
      height,
      light,
      lamp,
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      shown: false,
    };
    this.views.set(key, view);
  }

  /**
   * Une image: pose les trains à l'heure de `world` (lissée), allume leurs lampes et ouvre ceux
   * qui cachent un joueur. `subjects`: pieds des personnages à garder visibles.
   */
  update(dt: number, world: ReadonlyWorld, subjects: readonly Vec3[], toCamera: Vec3): void {
    const content = this.look.content;
    const minutes = this.clock(dt, world.minutes, content.settings.clock.secondsPerHour);
    const key = world.common.day * MINUTES_PER_DAY + Math.floor(world.minutes);
    this.look.world = world;
    if (key !== this.eventsKey) {
      // Les conditions des événements (la progression) se relisent à chaque minute de jeu.
      this.eventsKey = key;
      this.events = trainEvents({ content, world }, this.place.def.id, world.common.day);
    }
    const count = trainPoses(
      { content, world },
      this.place.def.id,
      minutes,
      this.pool,
      this.events,
    );
    for (const view of this.views.values()) view.shown = false;
    this.stats.vehicles = 0;
    this.stats.triangles = 0;
    for (let i = 0; i < count; i++) {
      const pose = this.pool[i];
      if (pose === undefined) continue;
      pose.vehicles.forEach((vehicle, index) => {
        const view = this.views.get(vehicleKey(pose.event, index));
        if (view !== undefined) this.poseVehicle(view, vehicle);
      });
    }
    for (const view of this.views.values()) {
      view.object.visible = view.shown;
      if (view.lamp !== null) view.lamp.share = view.shown ? 1 : 0;
      if (view.shown || !view.occluding) continue;
      // Parti: il reviendra plein, sans le fondu d'avant.
      this.occlusion.remove(view.key);
      view.occluding = false;
      view.fadable.apply(1, 0);
    }
    for (const id of this.occlusion.update(dt, subjects, toCamera)) {
      const view = this.views.get(id);
      if (view !== undefined) this.applyOcclusion(view);
    }
  }

  /** Horloge affichée: elle avance à l'image et se recale doucement sur celle de l'état. */
  private clock(dt: number, minutes: number, secondsPerHour: number): number {
    if (Number.isNaN(this.shownMinutes)) this.shownMinutes = minutes;
    else this.shownMinutes += (dt * 60) / secondsPerHour;
    let gap = minutes - this.shownMinutes;
    if (gap > MINUTES_PER_DAY / 2) gap -= MINUTES_PER_DAY;
    if (gap < -MINUTES_PER_DAY / 2) gap += MINUTES_PER_DAY;
    if (Math.abs(gap) > TRAIN_LOOK.snapMinutes) this.shownMinutes = minutes;
    else this.shownMinutes += gap * TRAIN_LOOK.catchUp;
    this.shownMinutes = ((this.shownMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return this.shownMinutes;
  }

  private poseVehicle(view: VehicleView, vehicle: VehiclePose): void {
    const ground = this.heightAt(vehicle.x, vehicle.y);
    const object = view.object;
    object.position.set(vehicle.x, ground, vehicle.y);
    object.rotation.y = vehicle.yaw;
    view.shown = true;
    this.stats.vehicles += 1;
    this.stats.triangles += this.manifest.models[vehicle.model]?.triangles ?? 12;
    const sin = Math.sin(vehicle.yaw);
    const cos = Math.cos(vehicle.yaw);
    if (view.lamp !== null && view.light !== undefined) {
      const [ax, ay, az] = view.light.at;
      view.lamp.x = vehicle.x + ax * cos + az * sin;
      view.lamp.y = ground + ay;
      view.lamp.z = vehicle.y + az * cos - ax * sin;
    }
    // Boîte d'occultation: l'emprise tournée de la caisse, de la voie au toit.
    const half = TRAINS.halfWidth;
    let x0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let z0 = Number.POSITIVE_INFINITY;
    let z1 = Number.NEGATIVE_INFINITY;
    for (const along of [vehicle.front, -vehicle.back])
      for (const side of [half, -half]) {
        const x = vehicle.x + sin * along + cos * side;
        const z = vehicle.y + cos * along - sin * side;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        z0 = Math.min(z0, z);
        z1 = Math.max(z1, z);
      }
    view.min.x = x0;
    view.min.y = ground;
    view.min.z = z0;
    view.max.x = x1;
    view.max.y = ground + view.height;
    view.max.z = z1;
    if (!view.occluding) {
      this.occlusion.add({ id: view.key, min: view.min, max: view.max });
      view.occluding = true;
    }
  }

  private applyOcclusion(view: VehicleView): void {
    view.fadable.apply(this.occlusion.opacity(view.key), 0);
  }

  dispose(): void {
    for (const view of this.views.values()) {
      view.fadable.dispose();
    }
    this.views.clear();
    this.tracker.dispose();
    this.root.removeFromParent();
    this.lamps.length = 0;
  }
}
