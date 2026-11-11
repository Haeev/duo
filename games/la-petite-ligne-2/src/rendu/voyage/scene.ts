/**
 * Diorama du trajet: voie en contrebas, deux quais avec abri et panneau, arbres en boules de
 * mousse, poteaux, collines, en formes simples sur le matériau à couleurs de sommets des formes
 * provisoires (un maillage fusionné); et l'autorail livré (manifeste des décors), au rendu encré,
 * vitres allumées la nuit par sa lampe. Les deux personnages montent dans sa salle: la caisse se
 * fond devant eux. Construit à l'entrée dans le train, libéré à la sortie.
 */
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  type Material,
  Mesh,
  type Object3D,
  Vector4,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { inkifyModel, inkTag } from '../encre/conversion';
import { LAYER } from '../encre/couches';
import { INK_INNER, type Lamp } from '../encre/matiere';
import { INK_SETTINGS } from '../encre/reglages';
import { Fadable, isMesh } from '../fondu';
import { DECOR_MANIFEST, type DecorManifest } from '../lieu/decors-manifeste';
import type { ModelSource } from '../lieu/lieu';
import { Occlusion, type Vec3 } from '../occultation';
import { TRIP_SETTINGS, type TripSettings } from './reglages';
import { doorX, type TripFrame } from './sequence';

const color = new Color();

function paint(geometry: BufferGeometry, hex: string): BufferGeometry {
  color.set(hex);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** Pièces d'un maillage fusionné. Repère de la scène: x le long de la voie, y en hauteur, z vers le sud. */
class Parts {
  private readonly list: BufferGeometry[] = [];

  /** Boîte de `x0` à `x1`, de `y0` à `y1` (hauteur), de `z0` à `z1`. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, hex: string): void {
    const g = new BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.list.push(paint(g, hex));
  }

  /** Cylindre couché le long de x (chaudière) ou de z (roue), ou debout (poteau). */
  cylinder(
    radius: number,
    length: number,
    x: number,
    y: number,
    z: number,
    axis: 'x' | 'y' | 'z',
    hex: string,
    segments = 12,
    squash = 1,
  ): void {
    const g = new CylinderGeometry(radius, radius, length, segments);
    // Écrasé en hauteur (toit bombé couché le long de x): x devient la hauteur après la rotation.
    if (squash !== 1) g.scale(squash, 1, 1);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    this.list.push(paint(g, hex));
  }

  cone(radius: number, height: number, x: number, y: number, z: number, hex: string): void {
    const g = new ConeGeometry(radius, height, 8);
    g.translate(x, y + height / 2, z);
    this.list.push(paint(g, hex));
  }

  ball(radius: number, x: number, y: number, z: number, hex: string, sy = 1): void {
    const g = new IcosahedronGeometry(radius, 1);
    g.scale(1, sy, 1);
    g.translate(x, y, z);
    this.list.push(paint(g, hex));
  }

  merge(): BufferGeometry {
    const merged = mergeGeometries(this.list.map((g) => (g.index === null ? g : g.toNonIndexed())));
    for (const g of this.list) g.dispose();
    this.list.length = 0;
    return merged;
  }
}

/** Hasard figé du décor (même diorama chez les deux joueurs, sans `Math.random`). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un quai, son abri, son banc, son panneau et ses lampadaires, centré sur `cx`. */
function quay(p: Parts, cx: number, s: TripSettings): void {
  const c = s.colors;
  const { length, depth, edge } = s.platform;
  const front = s.ground.trackHalfWidth;
  const x0 = cx - length / 2;
  const x1 = cx + length / 2;
  // Le dessus du quai est le sol des personnages (0); il déborde de 2 cm sur le talus.
  p.box(x0, x1, -s.ground.trench, 0, front - 0.02, front + depth, c.stone);
  p.box(x0, x1, 0, 0.01, front - 0.02, front + edge, c.edge);
  // Abri: quatre poteaux et un toit, au fond du quai, ouvert côté voie. Il est décalé vers la
  // queue du train: entre la caméra et la portière, il cacherait ceux qui montent.
  const sx = cx - 9;
  const back = front + depth;
  for (const dx of [-3.2, 3.2])
    for (const z of [back - 1.6, back - 0.2])
      p.cylinder(0.07, 2.4, sx + dx, 1.22, z, 'y', c.pole, 8);
  p.box(sx - 3.6, sx + 3.6, 2.42, 2.56, back - 2.0, back + 0.1, c.shelterRoof);
  // Banc sous l'abri, tourné vers la voie.
  p.box(sx - 1.2, sx + 1.2, 0.42, 0.48, back - 0.9, back - 0.45, c.trunk);
  p.box(sx - 1.2, sx + 1.2, 0.48, 0.9, back - 0.45, back - 0.38, c.trunk);
  for (const dx of [-1.0, 1.0])
    p.box(sx + dx - 0.05, sx + dx + 0.05, 0, 0.42, back - 0.85, back - 0.5, c.wheel);
  // Panneau de la gare sur deux poteaux, lisible depuis le train, vers la tête du train.
  for (const dx of [-0.9, 0.9])
    p.cylinder(0.05, 2.2, cx + 9.5 + dx, 1.1, back - 1.0, 'y', c.pole, 8);
  p.box(cx + 8.4, cx + 10.6, 1.7, 2.2, back - 1.06, back - 0.96, c.sign);
  p.box(cx + 8.5, cx + 10.5, 1.78, 2.12, back - 1.08, back - 1.06, c.edge);
  // Lampadaires aux deux bouts.
  for (const dx of [-length / 2 + 1.5, length / 2 - 1.5]) {
    p.cylinder(0.06, 3, cx + dx, 1.5, front + 1.2, 'y', c.pole, 8);
    p.ball(0.16, cx + dx, 3.05, front + 1.2, c.brass);
  }
}

/** Le décor qui défile: sol, voie, deux quais, arbres, poteaux, collines. */
function sceneryGeometry(s: TripSettings): BufferGeometry {
  const p = new Parts();
  const c = s.colors;
  const g = s.ground;
  const xMin = -g.margin - s.approachDistance;
  const xMax = s.rideDistance + g.margin;
  const trench = -g.trench;
  const half = g.trackHalfWidth;
  // Talus de part et d'autre de la voie, fond de ballast.
  p.box(xMin, xMax, trench - 0.3, -0.02, half, g.halfDepth, c.grass);
  p.box(xMin, xMax, trench - 0.3, -0.02, -g.halfDepth, -half, c.grass);
  p.box(xMin, xMax, trench - 0.3, trench + 0.1, -half, half, c.ballast);
  // Rails et traverses.
  const r = s.rails;
  for (const side of [-1, 1])
    p.box(
      xMin,
      xMax,
      trench + 0.1,
      trench + 0.1 + r.height,
      side * (r.gauge / 2) - 0.04,
      side * (r.gauge / 2) + 0.04,
      c.rail,
    );
  for (let x = xMin; x < xMax; x += r.sleeperStep)
    p.box(x, x + 0.24, trench + 0.06, trench + 0.12, -1.1, 1.1, c.sleeper);
  // Quai de départ (x = porte du wagon) et quai d'arrivée, à la distance du trajet.
  const door = doorX(s);
  quay(p, door, s);
  quay(p, door + s.rideDistance, s);
  // Arbres en boules de mousse, plus serrés loin de la voie, jamais sur les quais.
  const random = seeded(s.scenery.seed);
  const quays = [door, door + s.rideDistance];
  for (let i = 0; i < s.scenery.trees; i += 1) {
    const x = xMin + random() * (xMax - xMin);
    // Côté caméra (sud), seulement loin derrière les quais: rien ne cache le train.
    const north = random() < 0.75;
    const z = north ? -(half + 2.5 + random() * (g.halfDepth - half - 3.5)) : 10 + random() * 5;
    const onQuay = quays.some((q) => Math.abs(x - q) < s.platform.length / 2 + 1.5);
    if (!north && onQuay) continue;
    const height = 1.6 + random() * 1.8;
    const radius = 0.7 + random() * 0.6;
    const tint = c.foliage[Math.floor(random() * c.foliage.length)] ?? c.grassDark;
    p.cylinder(0.12, height * 0.5, x, height * 0.25, z, 'y', c.trunk, 6);
    if (random() < 0.3) p.cone(radius, height * 1.1, x, height * 0.3, z, c.grassDark);
    else p.ball(radius, x, height * 0.55 + radius * 0.6, z, tint, 1.15);
  }
  // Poteaux le long de la voie, côté nord, comme sur une vraie ligne.
  for (let x = xMin + 4; x < xMax; x += s.scenery.poleStep) {
    p.cylinder(0.07, 4, x, 2, -half - 0.8, 'y', c.pole, 6);
    p.box(x - 0.5, x + 0.5, 3.6, 3.7, -half - 0.85, -half - 0.75, c.pole);
  }
  // Collines au loin, au nord.
  for (let i = 0; i < s.scenery.hills; i += 1) {
    const x = xMin + ((i + 0.5) / s.scenery.hills) * (xMax - xMin);
    const radius = 7 + random() * 6;
    p.ball(radius, x, -radius * 0.2, -g.halfDepth - 3, c.hill, 0.6);
  }
  return p.merge();
}

/** Lampe de la caisse: elle suit le train (position réécrite à chaque image). */
interface TripLamp extends Lamp {
  x: number;
  y: number;
  z: number;
}

/** Un pied de personnage, dans le repère de la scène. */
interface Feet {
  x: number;
  y: number;
  z: number;
}

/** La scène du trajet, posée dans la scène du moteur le temps du voyage. */
export class TripScene {
  readonly root = new Group();
  /** La lampe de la salle (`light` du manifeste): vitres allumées et flaque la nuit. */
  readonly lamps: Lamp[] = [];
  private readonly world: Mesh;
  private readonly train: Object3D;
  private readonly owned: BufferGeometry[] = [];
  private readonly fadable: Fadable;
  private readonly occlusion = new Occlusion();
  private readonly box = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  private readonly lamp: TripLamp | null;
  private readonly light: { readonly at: readonly number[] } | null;
  private readonly feet: Feet[] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];

  constructor(
    material: Material,
    private readonly settings: TripSettings = TRIP_SETTINGS,
    /** Rendu encré (ADR 0023): les géométries reçoivent leurs morceaux et leurs couches de traits. */
    inked = false,
    /** Modèles livrés: l'autorail du manifeste; sans lui, une caisse provisoire à ses mesures. */
    models: ModelSource | null = null,
    manifest: DecorManifest = DECOR_MANIFEST,
  ) {
    this.root.name = 'trajet';
    const tag = (geometry: BufferGeometry, layer?: number): BufferGeometry =>
      inked ? inkTag(geometry, layer === undefined ? {} : { layer }) : geometry;
    const scenery = tag(sceneryGeometry(settings));
    this.owned.push(scenery);
    this.world = new Mesh(scenery, material);
    this.world.castShadow = true;
    this.world.receiveShadow = true;
    const t = settings.train;
    const model = models?.instantiate(t.model, 'trajet') ?? null;
    const sheet = manifest.models[t.model];
    if (model !== null) {
      this.train = inked ? inkifyModel(model, material) : model;
    } else {
      // Sans modèle livré: une caisse provisoire aux mesures de l'autorail, jamais un trou.
      const box = paint(
        new BoxGeometry(t.halfWidth * 2, t.height - t.floor + 0.3, t.length),
        settings.colors.standIn,
      );
      box.translate(0, t.floor - 0.3 + (t.height - t.floor + 0.3) / 2, 0);
      this.owned.push(tag(box, LAYER.plain));
      this.train = new Mesh(box, material);
    }
    // La tête de la caisse (+z du modèle) vers la marche du train (+x de la scène).
    this.train.rotation.y = Math.PI / 2;
    this.train.name = 'trajet-autorail';
    const light = model === null ? undefined : sheet?.light;
    const glass = light === undefined || !inked ? null : new Vector4(2, 0, 0, 0);
    this.train.traverse((child) => {
      if (!isMesh(child)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      if (glass !== null) child.userData[INK_INNER] = glass;
    });
    this.light = light ?? null;
    this.lamp =
      light === undefined
        ? null
        : {
            x: 0,
            y: 0,
            z: 0,
            radius: light.radius * INK_SETTINGS.lamps.vehicle.radius,
            shadow: false,
            phase: 0,
            gain: (light.gain ?? 1) * INK_SETTINGS.lamps.vehicle.gain,
            ...(glass === null ? {} : { glass }),
          };
    if (this.lamp !== null) this.lamps.push(this.lamp);
    this.fadable = new Fadable(this.train, new Color(0, 0, 0));
    this.occlusion.add({ id: 'autorail', min: this.box.min, max: this.box.max });
    this.root.add(this.world, this.train);
  }

  /** Place le train et le décor pour cette image. */
  apply(frame: TripFrame): void {
    const t = this.settings.train;
    this.world.position.x = frame.worldX;
    const cx = frame.trainX + t.center;
    this.train.position.set(cx, -t.floor, 0);
    if (this.lamp !== null && this.light !== null) {
      // Le modèle est tourné d'un quart: son z devient le x de la scène, son x le -z.
      const [ax = 0, ay = 0, az = 0] = this.light.at;
      this.lamp.x = cx + az;
      this.lamp.y = -t.floor + ay;
      this.lamp.z = -ax;
    }
    this.box.min.x = cx - t.length / 2;
    this.box.max.x = cx + t.length / 2;
    this.box.min.y = -t.floor;
    this.box.max.y = t.height - t.floor;
    this.box.min.z = -t.halfWidth;
    this.box.max.z = t.halfWidth;
  }

  /**
   * La caisse se fond devant les deux personnages quand elle les cache (à bord, ou derrière elle),
   * comme un bâtiment (choix du client: le fondu, jamais la découpe). `toCamera`: du sol vers la caméra.
   */
  fade(
    dt: number,
    players: readonly { readonly x: number; readonly y: number }[],
    toCamera: Vec3,
  ): void {
    players.forEach((p, i) => {
      const feet = this.feet[i];
      if (feet === undefined) return;
      feet.x = p.x;
      feet.y = 0;
      feet.z = p.y;
    });
    if (this.occlusion.update(dt, this.feet, toCamera).length > 0)
      this.fadable.apply(this.occlusion.opacity('autorail'), 0);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.fadable.dispose();
    for (const geometry of this.owned) geometry.dispose();
    // Le modèle livré partage ses géométries avec la source des modèles: elle les libère.
    this.lamps.length = 0;
  }
}
