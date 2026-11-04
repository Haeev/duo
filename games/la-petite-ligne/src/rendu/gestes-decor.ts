/**
 * Ce qui reste du décor après les gestes des joueurs (0.13, lot H7, section 7.1), vu pareil chez
 * l'hôte et chez l'invité parce qu'il se lit dans les drapeaux du monde:
 * - les flammes des cierges allumés dans l'église (un par joueur, jusqu'au soir);
 * - les initiales gravées dans le banc du belvédère, pour toujours;
 * - la fleur posée sur une tombe, trois jours;
 * - les ronds dans l'eau des rebonds d'un galet, et le souffle des aigrettes (événements ponctuels).
 * Formes simples et matériaux partagés; la flamme vacille, sauf mouvement réduit.
 */
import {
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
} from 'three';
import type { WorldEvent } from '../etat/types';
import { decorFlagNames } from '../simulation/decor';
import type { FrameContext } from './contexte';
import type { EventfulPart } from './monde';
import type { ResourceTracker } from './ressources';
import type { GameMap } from '../etat/carte';
import type { Terrain } from './terrain';

/** Écart des deux flammes sur le présentoir (m) et hauteur des cierges. */
const CANDLE_GAP = 0.22;
const CANDLE_HEIGHT = 0.5;
const FLAME_HEIGHT = 0.16;
const FLICKER_HZ = 7;
const FLICKER_AMOUNT = 0.18;
/** Les ronds dans l'eau: durée (s), rayon final (m). */
const RIPPLE_SECONDS = 0.9;
const RIPPLE_RADIUS = 0.55;
const MAX_RIPPLES = 12;
const MAX_PUFFS = 6;
const PUFF_SECONDS = 1.6;
/** Couleurs des fleurs sur les tombes. */
const PETALS = ['#f2d24b', '#f4f1e8', '#d8588a'];
const BENCH_POINT = 'lookout';

interface Ripple {
  mesh: Mesh;
  born: number;
}

interface Puff {
  group: Group;
  born: number;
}

export class DecorGesturesPart implements EventfulPart {
  readonly group = new Group();
  private readonly flameGeometry: ConeGeometry;
  private readonly stemGeometry: CylinderGeometry;
  private readonly flowerGeometry: SphereGeometry;
  private readonly rippleGeometry: RingGeometry;
  private readonly seedGeometry: SphereGeometry;
  private readonly flameMaterial: MeshBasicMaterial;
  private readonly candleMaterial: MeshBasicMaterial;
  private readonly petalMaterials: MeshBasicMaterial[];
  private readonly seedMaterial: MeshBasicMaterial;
  private readonly flames = new Map<string, Group>();
  private readonly flowers = new Map<string, Group>();
  private readonly ripples: Ripple[] = [];
  private readonly puffs: Puff[] = [];
  private initials: Mesh | null = null;
  private initialsKey = '';

  constructor(
    private readonly map: GameMap,
    private readonly terrain: Terrain,
    private readonly resources: ResourceTracker,
  ) {
    this.group.name = 'decor-gestes';
    this.flameGeometry = resources.track(new ConeGeometry(0.045, FLAME_HEIGHT, 8));
    this.stemGeometry = resources.track(new CylinderGeometry(0.03, 0.03, CANDLE_HEIGHT, 8));
    this.flowerGeometry = resources.track(new SphereGeometry(0.06, 8, 6));
    this.rippleGeometry = resources.track(new RingGeometry(0.85, 1, 24));
    this.seedGeometry = resources.track(new SphereGeometry(0.025, 6, 4));
    this.flameMaterial = resources.track(new MeshBasicMaterial({ color: new Color('#ffb347') }));
    this.candleMaterial = resources.track(new MeshBasicMaterial({ color: new Color('#f3ead2') }));
    this.seedMaterial = resources.track(
      new MeshBasicMaterial({ color: new Color('#f7f4ea'), transparent: true }),
    );
    this.petalMaterials = PETALS.map((color) =>
      resources.track(new MeshBasicMaterial({ color: new Color(color) })),
    );
  }

  handleEvent(event: WorldEvent, context: FrameContext): void {
    if (event.type === 'skim_stone') this.addRipple(event.at.x, event.at.y, context.time);
    else if (event.type === 'decor_gesture' && event.gesture === 'dandelion_blow')
      this.addPuff(event.at.x, event.at.y, context.time);
  }

  private addRipple(x: number, y: number, time: number): void {
    if (this.ripples.length >= MAX_RIPPLES) {
      const old = this.ripples.shift();
      if (old !== undefined) {
        this.group.remove(old.mesh);
        this.resources.release(old.mesh.material as MeshBasicMaterial);
      }
    }
    const material = this.resources.track(
      new MeshBasicMaterial({
        color: new Color('#e8f4ff'),
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    const mesh = new Mesh(this.rippleGeometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, this.terrain.heightAt(x, y) + 0.04, y);
    this.group.add(mesh);
    this.ripples.push({ mesh, born: time });
  }

  private addPuff(x: number, y: number, time: number): void {
    if (this.puffs.length >= MAX_PUFFS) {
      const old = this.puffs.shift();
      if (old !== undefined) this.group.remove(old.group);
    }
    const puff = new Group();
    for (let i = 0; i < 7; i++) {
      const seed = new Mesh(this.seedGeometry, this.seedMaterial);
      seed.userData.angle = (i / 7) * Math.PI * 2;
      puff.add(seed);
    }
    puff.position.set(x, this.terrain.heightAt(x, y) + 0.3, y);
    this.group.add(puff);
    this.puffs.push({ group: puff, born: time });
  }

  update(context: FrameContext): void {
    const world = context.world;
    const day = world.clock.day;
    this.updateCandles(world.flags, day, context);
    this.updateFlowers(world.flags, day);
    this.updateInitials(
      world.flags,
      world.characters.map((c) => c.name),
    );
    this.updateRipples(context.time);
    this.updatePuffs(context.time);
  }

  private pointOf(id: string): { x: number; y: number } | null {
    const p = this.map.points[id];
    return p === undefined ? null : { x: p.x, y: p.y };
  }

  private updateCandles(flags: readonly string[], day: number, context: FrameContext): void {
    const lit = new Set(decorFlagNames(flags, day, 'decor:candle:'));
    const at = this.pointOf('church_candles');
    for (const [who, group] of this.flames) {
      group.visible = lit.has(who);
    }
    if (at === null) return;
    for (const who of lit) {
      let group = this.flames.get(who);
      if (group === undefined) {
        group = new Group();
        const stem = new Mesh(this.stemGeometry, this.candleMaterial);
        stem.position.y = CANDLE_HEIGHT / 2;
        const flame = new Mesh(this.flameGeometry, this.flameMaterial);
        flame.name = 'flame';
        flame.position.y = CANDLE_HEIGHT + FLAME_HEIGHT / 2;
        group.add(stem, flame);
        const side = who === 'p1' ? -1 : 1;
        // Le présentoir est au bas du choeur, côté sud: les cierges sont posés au nord du point.
        group.position.set(
          at.x + side * CANDLE_GAP,
          this.terrain.heightAt(at.x, at.y - 0.4) + 0.75,
          at.y - 0.4,
        );
        this.group.add(group);
        this.flames.set(who, group);
      }
      const flame = group.getObjectByName('flame');
      if (flame !== undefined) {
        const wobble = context.reducedMotion
          ? 0
          : Math.sin(context.time * FLICKER_HZ + (who === 'p1' ? 0 : 2)) * FLICKER_AMOUNT;
        flame.scale.set(1 - wobble * 0.5, 1 + wobble, 1 - wobble * 0.5);
      }
    }
  }

  private updateFlowers(flags: readonly string[], day: number): void {
    const present = new Set(decorFlagNames(flags, day, 'decor:flower:'));
    for (const [name, group] of this.flowers) group.visible = present.has(name);
    for (const name of present) {
      if (this.flowers.has(name)) continue;
      const at = this.pointOf(`grave_${name}`);
      if (at === null) continue;
      const group = new Group();
      PETALS.forEach((_, i) => {
        const flower = new Mesh(
          this.flowerGeometry,
          this.petalMaterials[i % this.petalMaterials.length],
        );
        flower.position.set((i - 1) * 0.12, 0.08 + (i % 2) * 0.03, (i % 2) * 0.05);
        group.add(flower);
      });
      group.position.set(at.x, this.terrain.heightAt(at.x, at.y), at.y);
      this.group.add(group);
      this.flowers.set(name, group);
    }
  }

  /** Les initiales des deux prénoms, gravées sur le banc du belvédère (plaque sombre au dossier). */
  private updateInitials(flags: readonly string[], names: readonly string[]): void {
    if (!flags.includes('decor:carved')) {
      if (this.initials !== null) this.initials.visible = false;
      return;
    }
    const letters = names.map((n) => Array.from(n.trim())[0]?.toUpperCase() ?? '?').join(' + ');
    if (this.initials !== null && this.initialsKey === letters) {
      this.initials.visible = true;
      return;
    }
    const bench =
      this.map.props.find((p) => p.id === 'lookout_bench')?.pos ?? this.pointOf(BENCH_POINT);
    if (bench === null) return;
    if (this.initials !== null) {
      this.group.remove(this.initials);
      this.resources.release(this.initials.material as MeshBasicMaterial);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 48;
    const g = canvas.getContext('2d');
    if (g !== null) {
      g.fillStyle = '#6b4a2b';
      g.fillRect(0, 0, 128, 48);
      g.fillStyle = '#2d1c0c';
      g.font = 'bold 30px serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(letters, 64, 26);
    }
    const texture = this.resources.track(new CanvasTexture(canvas));
    texture.colorSpace = SRGBColorSpace;
    const material = this.resources.track(new MeshBasicMaterial({ map: texture }));
    const plate = new Mesh(this.resources.track(new PlaneGeometry(0.42, 0.16)), material);
    // Sur le montant sud du banc, face au point d'où l'on regarde (le banc est au nord du point).
    plate.position.set(bench.x, this.terrain.heightAt(bench.x, bench.y) + 0.62, bench.y + 0.26);
    this.group.add(plate);
    this.initials = plate;
    this.initialsKey = letters;
  }

  private updateRipples(time: number): void {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const ripple = this.ripples[i];
      if (ripple === undefined) continue;
      const t = (time - ripple.born) / RIPPLE_SECONDS;
      const material = ripple.mesh.material as MeshBasicMaterial;
      if (t >= 1 || t < 0) {
        this.group.remove(ripple.mesh);
        this.resources.release(material);
        this.ripples.splice(i, 1);
        continue;
      }
      ripple.mesh.scale.setScalar(0.1 + RIPPLE_RADIUS * t);
      material.opacity = 0.8 * (1 - t);
    }
  }

  private updatePuffs(time: number): void {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const puff = this.puffs[i];
      if (puff === undefined) continue;
      const t = (time - puff.born) / PUFF_SECONDS;
      if (t >= 1 || t < 0) {
        this.group.remove(puff.group);
        this.puffs.splice(i, 1);
        continue;
      }
      for (const seed of puff.group.children) {
        const angle = Number(seed.userData.angle);
        seed.position.set(
          Math.cos(angle) * t * 1.2,
          t * 0.8 + Math.sin(angle * 3) * 0.05,
          Math.sin(angle) * t * 0.9,
        );
      }
    }
  }

  dispose(): void {
    this.flames.clear();
    this.flowers.clear();
    this.ripples.length = 0;
    this.puffs.length = 0;
    this.initials = null;
    this.group.removeFromParent();
  }
}
