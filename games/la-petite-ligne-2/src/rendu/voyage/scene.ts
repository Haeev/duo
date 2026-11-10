/**
 * Diorama du trajet en formes simples (aucun modèle de train n'est encore livré): voie en
 * contrebas, deux quais avec abri et panneau, arbres en boules de mousse, poteaux, collines, et un
 * petit train (locomotive et wagon à fenêtres ouvertes, pour voir les deux personnages à bord).
 * Tout partage le matériau à couleurs de sommets des formes provisoires: un seul programme, trois
 * maillages fusionnés (décor, train, fumée). Construit à l'entrée dans le train, libéré à la sortie.
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
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { inkTag } from '../encre/conversion';
import { LAYER } from '../encre/couches';
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

/** Locomotive (avant à x = 0, vers +x) et wagon derrière elle, au niveau du quai. */
function trainGeometry(s: TripSettings): BufferGeometry {
  const p = new Parts();
  const c = s.colors;
  const w = s.wagon;
  const hw = w.halfWidth;
  const wheelY = -s.ground.trench + 0.1 + s.rails.height + 0.4;
  // Wagon de x = -length à 0: châssis, plancher, parois à fenêtres, toit.
  const x0 = -w.length;
  const x1 = -0.25;
  p.box(x0, x1, -0.32, 0, -hw, hw, c.chassis);
  p.box(x0 + 0.1, x1 - 0.1, 0, 0.02, -hw + 0.08, hw - 0.08, c.interior);
  const door = doorX(s);
  const doorHalf = w.door / 2;
  for (const side of [-1, 1]) {
    const z0 = side * hw - (side > 0 ? 0.08 : 0);
    const z1 = z0 + 0.08;
    // Bas de caisse (coupé par la portière côté quai), bandeau et haut de caisse.
    if (side > 0) {
      p.box(x0, door - doorHalf, 0, w.sill, z0, z1, c.livery);
      p.box(door + doorHalf, x1, 0, w.sill, z0, z1, c.livery);
      p.box(door - doorHalf, door + doorHalf, w.lintel + 0.15, w.top, z0, z1, c.livery);
    } else p.box(x0, x1, 0, w.sill, z0, z1, c.livery);
    p.box(x0, x1, w.sill, w.sill + 0.06, z0 - 0.01, z1 + 0.01, c.band);
    p.box(x0, x1, w.lintel, w.top, z0, z1, c.livery);
    // Montants entre les fenêtres (et de part et d'autre de la portière).
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 6) {
      if (side > 0 && Math.abs(x - door) < doorHalf + 0.05) continue;
      p.box(x - 0.12, x + 0.12, w.sill, w.lintel, z0, z1, c.band);
    }
    if (side > 0)
      for (const dx of [-doorHalf, doorHalf])
        p.box(door + dx - 0.08, door + dx + 0.08, 0, w.lintel + 0.15, z0, z1, c.band);
  }
  // Bouts du wagon et toit bombé.
  p.box(x0, x0 + 0.08, 0, w.top, -hw, hw, c.livery);
  p.box(x1 - 0.08, x1, 0, w.top, -hw, hw, c.livery);
  p.box(x0 - 0.05, x1 + 0.05, w.top, w.top + 0.08, -hw - 0.1, hw + 0.1, c.roof);
  // Bombé écrasé: rien ne descend sous le haut de caisse (on verrait sa courbe par les fenêtres).
  p.cylinder(hw * 0.95, x1 - x0, (x0 + x1) / 2, w.top - 0.02, 0, 'x', c.roof, 14, 0.22);
  // Banquettes intérieures, le long de la paroi nord.
  p.box(x0 + 0.6, x1 - 0.6, 0, 0.45, -hw + 0.1, -hw + 0.6, c.chassis);
  p.box(x0 + 0.6, x1 - 0.6, 0.45, 1.0, -hw + 0.1, -hw + 0.25, c.chassis);
  // Bogies et roues du wagon.
  for (const bx of [x0 + 1.6, x1 - 1.6])
    for (const dx of [-0.55, 0.55])
      for (const side of [-1, 1])
        p.cylinder(0.4, 0.1, bx + dx, wheelY, side * (s.rails.gauge / 2), 'z', c.wheel, 14);

  // Locomotive de x = 0,25 à 6,6: cabine à l'arrière, chaudière, cheminée, tampons.
  const l0 = 0.25;
  const l1 = 6.6;
  p.box(l0, l1, -0.32, 0.25, -hw + 0.1, hw - 0.1, c.chassis);
  p.box(l0, l0 + 2.1, 0.25, w.top - 0.1, -hw + 0.05, hw - 0.05, c.livery);
  p.box(l0 + 0.4, l0 + 1.7, 1.2, 1.9, hw - 0.06, hw - 0.04, c.wheel);
  p.box(l0 - 0.1, l0 + 2.3, w.top - 0.1, w.top + 0.02, -hw - 0.05, hw + 0.05, c.roof);
  p.cylinder(0.85, l1 - l0 - 2.3, (l0 + 2.1 + l1 - 0.2) / 2, 1.1, 0, 'x', c.livery, 16);
  p.cylinder(0.87, 0.12, l0 + 3.3, 1.1, 0, 'x', c.brass, 16);
  p.cylinder(0.87, 0.12, l0 + 4.8, 1.1, 0, 'x', c.brass, 16);
  p.cylinder(0.86, 0.3, l1 - 0.3, 1.1, 0, 'x', c.wheel, 16);
  p.cylinder(0.22, 0.9, l1 - 0.9, 2.3, 0, 'y', c.wheel, 10);
  p.cylinder(0.3, 0.12, l1 - 0.9, 2.75, 0, 'y', c.wheel, 10);
  p.ball(0.3, l0 + 3.9, 2.0, 0, c.brass, 0.8);
  for (const side of [-1, 1]) {
    p.cylinder(0.1, 0.3, l1 + 0.1, 0.1, side * 0.75, 'x', c.wheel, 8);
    p.cylinder(0.16, 0.06, l1 + 0.27, 0.1, side * 0.75, 'x', c.chassis, 10);
    for (const wx of [l0 + 1.2, l0 + 2.9, l0 + 4.6])
      p.cylinder(
        0.55,
        0.12,
        wx,
        wheelY + 0.15,
        side * (s.rails.gauge / 2 + 0.02),
        'z',
        c.chassis,
        16,
      );
  }
  // Attelage entre la locomotive et le wagon.
  p.box(x1, l0, -0.15, 0.0, -0.15, 0.15, c.wheel);
  return p.merge();
}

/** La scène du trajet, posée dans la scène du moteur le temps du voyage. */
export class TripScene {
  readonly root = new Group();
  private readonly world: Mesh;
  private readonly train: Mesh;
  private readonly puffGeometry: BufferGeometry;
  private readonly puffs: Mesh[] = [];

  constructor(
    material: Material,
    private readonly settings: TripSettings = TRIP_SETTINGS,
    /** Rendu encré (ADR 0023): les géométries reçoivent leurs morceaux et leurs couches de traits. */
    inked = false,
  ) {
    this.root.name = 'trajet';
    const tag = (geometry: BufferGeometry, layer?: number): BufferGeometry =>
      inked ? inkTag(geometry, layer === undefined ? {} : { layer }) : geometry;
    this.world = new Mesh(tag(sceneryGeometry(settings)), material);
    this.world.castShadow = true;
    this.world.receiveShadow = true;
    this.train = new Mesh(tag(trainGeometry(settings)), material);
    this.train.castShadow = true;
    this.train.receiveShadow = true;
    this.puffGeometry = tag(
      paint(new SphereGeometry(1, 10, 8), settings.colors.smoke),
      LAYER.plain,
    );
    for (let i = 0; i < settings.smoke.puffs; i += 1) {
      const puff = new Mesh(this.puffGeometry, material);
      puff.visible = false;
      this.puffs.push(puff);
      this.root.add(puff);
    }
    this.root.add(this.world, this.train);
  }

  /** Place le train, le décor et la fumée pour cette image. `seconds`: temps de la scène. */
  apply(frame: TripFrame, seconds: number): void {
    this.world.position.x = frame.worldX;
    this.train.position.x = frame.trainX;
    // Fumée: des bouffées en boucle au-dessus de la cheminée, plus nombreuses quand le train roule.
    const smoke = this.settings.smoke;
    const chimneyX = frame.trainX + 6.6 - 0.9;
    const pace = Math.min(1, Math.abs(frame.trainSpeed) / 12);
    for (let i = 0; i < this.puffs.length; i += 1) {
      const puff = this.puffs[i];
      if (puff === undefined) continue;
      const age = (seconds / smoke.life + i / this.puffs.length) % 1;
      puff.visible = pace > 0.05 || frame.stage === 'arrive' || frame.stage === 'board';
      puff.position.set(
        chimneyX - age * smoke.drift * (0.3 + pace),
        2.9 + age * smoke.rise,
        -age * 0.4,
      );
      puff.scale.setScalar(smoke.size * (0.6 + age * 1.6) * (1 - age * 0.5));
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.world.geometry.dispose();
    this.train.geometry.dispose();
    this.puffGeometry.dispose();
  }
}
