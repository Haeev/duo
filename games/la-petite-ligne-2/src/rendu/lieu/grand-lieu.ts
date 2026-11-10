/**
 * Un grand lieu rendu par tuiles (ADR 0022, technique 3.2.1): chaque machine ne construit que les
 * tuiles autour de SON joueur (`TileRing`), étalées sur plusieurs images (4 ms par image, sauf une
 * tuile déjà dans la vue), et libère les autres. Hors des tuiles chargées: un sol simplifié (une
 * case de 4 m) et les repères, toujours affichés. Occultation des murs, toits et houppiers devant
 * le joueur local; lueur des fenêtres la nuit; eau animée.
 */
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  type InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { tileGrid } from '../../donnees/carte';
import type { MapDef } from '../../donnees/schemas/lieu';
import { Occlusion, rayHitsBox, type Vec3 } from '../occultation';
import { RENDER_SETTINGS } from '../reglages';
import { ResourceTracker } from '../ressources';
import { GeometryBuilder } from './geometrie';
import { type SurfaceKind, TILE_SETTINGS, type TileSettings } from './reglages-tuiles';
import { buildingsByTile, type GroundField, groundField, kindAt, surfaceAt } from './terrain-rendu';
import { buildTile, crownBlob, type TileKit, TileView } from './tuile';
import { TileRing, tileDistance, tileRect } from './tuiles';

/** Compteurs du rendu par tuiles (construits, pas dessinés: la vue n'en montre qu'une partie). */
export interface TileStats {
  readonly loaded: number;
  readonly pending: number;
  /** Triangles et appels de dessin par passe, sommés sur les tuiles chargées, et la pire tuile. */
  readonly triangles: number;
  readonly calls: number;
  readonly worstTriangles: number;
  readonly worstCalls: number;
  /** Lointain et repères: triangles et appels. */
  readonly farTriangles: number;
  readonly farCalls: number;
  readonly fading: number;
  readonly tiles: readonly { tile: number; triangles: number; calls: number }[];
  /** Temps de construction de la dernière image (ms), et la plus longue étape (ms) depuis le chargement. */
  readonly buildMs: number;
  readonly maxStepMs: number;
  /** Géométries tenues par les tuiles chargées (contrôle de fuite: le reste doit rester constant). */
  readonly geometries: number;
}

const matrix = new Matrix4();
const hidden = new Matrix4().makeScale(0, 0, 0);
const rotation = new Quaternion();
const position = new Vector3();
const scale = new Vector3();

/** Géométrie unité à couleurs de sommets blanches (la couleur vient de l'instance). */
function white(geometry: BufferGeometry): BufferGeometry {
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute(
    'color',
    new Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3),
  );
  return geometry;
}

interface CrownFade {
  readonly view: TileView;
  readonly index: number;
  readonly mesh: Mesh;
  readonly material: MeshStandardMaterial;
  opacity: number;
  hidden: boolean;
}

export class TiledPlace {
  readonly root = new Group();
  readonly occlusion = new Occlusion();
  readonly field: GroundField;
  private readonly tracker = new ResourceTracker();
  private readonly ring: TileRing;
  private readonly kit: TileKit;
  private readonly views = new Map<number, TileView>();
  private readonly pending = new Map<number, Generator<void, TileView>>();
  private queue: number[] = [];
  /** Tuile de chaque partie effaçable (murs, toit) pour appliquer l'occultation. */
  private readonly partTile = new Map<string, number>();
  private readonly far: Mesh | null;
  private readonly farRanges = new Map<number, { start: number; count: number }>();
  private farTriangles = 0;
  private landmarkTriangles = 0;
  private farDirty = true;
  private readonly shadowed = new Map<number, boolean>();
  private readonly crownFades = new Map<string, CrownFade>();
  private readonly time = { value: 0 };
  private readonly glass: MeshStandardMaterial;
  private readonly fadeBase: MeshStandardMaterial;
  private readonly probe = { x: 0, y: 0, z: 0 };
  private buildMs = 0;
  private maxStepMs = 0;

  constructor(
    readonly map: MapDef,
    private readonly settings: TileSettings = TILE_SETTINGS,
  ) {
    this.root.name = 'grand-lieu';
    this.field = groundField(map, settings);
    this.ring = new TileRing(map, settings.ring);
    const t = this.tracker;
    const ground = t.track(new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    this.fadeBase = ground;
    this.glass = t.track(
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.4,
        emissive: new Color(settings.building.glowColor),
        emissiveIntensity: 0,
      }),
    );
    const water = t.track(
      new MeshStandardMaterial({
        color: settings.water.color,
        roughness: settings.water.roughness,
        metalness: 0,
      }),
    );
    this.animateWater(water);
    const blob = mergeVertices(new IcosahedronGeometry(1, 1));
    blob.computeVertexNormals();
    this.kit = {
      map,
      field: this.field,
      settings,
      buildings: buildingsByTile(map, settings),
      materials: {
        ground,
        water,
        instanced: t.track(new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })),
        glass: this.glass,
      },
      shapes: {
        box: t.track(white(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0))),
        trunk: t.track(white(new CylinderGeometry(1, 1, 1, 6, 1).translate(0, 0.5, 0))),
        blob: t.track(white(blob)),
      },
    };
    this.far = this.buildFar();
    this.buildLandmarks();
  }

  /** Surface de l'eau: ondulation par la normale, calculée dans le nuanceur (aucun coût au processeur). */
  private animateWater(material: MeshStandardMaterial): void {
    const { ripple, speed } = this.settings.water;
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms): void => {
      shader.uniforms.uWaterTime = this.time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWaterPos;')
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nvWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vWaterPos;\nuniform float uWaterTime;',
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          float wt = uWaterTime * ${speed.toFixed(3)};
          float wa = sin(vWaterPos.x * 1.3 + wt * 1.7) + sin(vWaterPos.z * 1.7 - wt * 1.3);
          float wb = cos(vWaterPos.x * 0.9 - vWaterPos.z * 1.1 + wt);
          vec3 wn = normalize(vec3(wa * ${ripple.toFixed(3)}, 1.0, wb * ${ripple.toFixed(3)}));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
          diffuseColor.rgb *= 0.94 + 0.06 * wa;`,
        );
    };
    material.customProgramCacheKey = (): string => 'eau-tuiles';
  }

  /** Sol lointain: une case de `far.cell` m par nature majoritaire, une plage d'index par tuile. */
  private buildFar(): Mesh | null {
    const { field, settings, map } = this;
    const step = settings.far.cell;
    const builder = new GeometryBuilder();
    const { cols, rows } = tileGrid(map);
    const counts = new Map<number, number>();
    const c = new Color();
    for (let tile = 0; tile < cols * rows; tile++) {
      builder.begin(String(tile));
      const { x0, y0, x1, y1 } = tileRect(map, tile);
      for (let y = y0; y < y1; y += step)
        for (let x = x0; x < x1; x += step) {
          counts.clear();
          let wild = 0;
          for (let dy = 0; dy < step && y + dy < y1; dy++)
            for (let dx = 0; dx < step && x + dx < x1; dx++) {
              const i = (y + dy) * field.width + x + dx;
              const code = field.cells[i] ?? 0;
              counts.set(code, (counts.get(code) ?? 0) + 1);
              wild += Math.min(12, field.wild[i] ?? 0);
            }
          let best = 0;
          let most = -1;
          for (const [code, n] of counts)
            if (n > most) {
              most = n;
              best = code;
            }
          const look = field.looks[best];
          if (look === undefined || look.hidden === true) continue;
          const name = field.names[best] ?? '';
          c.set(look.water === true ? settings.water.color : look.color);
          const dense = name === 'hors-jeu' || wild / (step * step) > settings.decor.wildFull - 3;
          if (dense) c.multiplyScalar(settings.far.woodShade);
          const level = look.water === true ? settings.ground.waterLevel : 0;
          const xe = Math.min(x1, x + step);
          const ye = Math.min(y1, y + step);
          builder.quad(
            [
              [x, level, y],
              [x, level, ye],
              [xe, level, ye],
              [xe, level, y],
            ],
            [0, 1, 0],
            [c],
          );
        }
      builder.end();
    }
    for (const [id, range] of builder.ranges) this.farRanges.set(Number(id), range);
    const geometry = builder.build();
    if (geometry === null) return null;
    const mesh = new Mesh(this.tracker.track(geometry), [this.kit.materials.ground]);
    mesh.name = 'lointain';
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  /** Repères (`landmarks`), toujours affichés: tour carrée à toit en pointe, ou grand arbre s'il est en pleine nature. */
  private buildLandmarks(): void {
    const s = this.settings;
    const builder = new GeometryBuilder();
    for (const mark of Object.values(this.map.landmarks ?? {})) {
      const i = Math.floor(mark.y) * this.field.width + Math.floor(mark.x);
      const wild = this.field.wild[i] ?? 0;
      if (wild >= s.landmark.treeWildCells) {
        builder.box({
          x: mark.x,
          z: mark.y,
          base: 0,
          w: 0.9,
          h: mark.height * 0.55,
          d: 0.9,
          yaw: 0.4,
          color: s.decor.trunkColor,
        });
        // Houppier en trois masses, plus large que tout le bois alentour.
        for (const [dx, dz, k] of [
          [0, 0, 1],
          [1.2, 0.6, 0.75],
          [-1, -0.8, 0.7],
        ] as const)
          this.blobInto(
            builder,
            mark.x + dx,
            mark.height * (0.62 + 0.1 * k),
            mark.y + dz,
            mark.height * 0.28 * k,
            mark.height * 0.24 * k,
            s.decor.crownColors[0],
          );
      } else {
        const side = Math.max(2, Math.min(4, mark.height / 4));
        const shaft = mark.height * 0.78;
        builder.box({
          x: mark.x,
          z: mark.y,
          base: 0,
          w: side,
          h: shaft,
          d: side,
          yaw: 0,
          color: s.landmark.towerColor,
        });
        builder.gable({
          cx: mark.x,
          cz: mark.y,
          w: side + 0.5,
          d: side + 0.5,
          base: shaft,
          ridge: mark.height - shaft,
          alongX: true,
          color: s.landmark.towerRoofColor,
        });
        builder.gable({
          cx: mark.x,
          cz: mark.y,
          w: side + 0.5,
          d: side + 0.5,
          base: shaft,
          ridge: mark.height - shaft,
          alongX: false,
          color: s.landmark.towerRoofColor,
        });
      }
    }
    const geometry = builder.build();
    if (geometry === null) return;
    const mesh = new Mesh(this.tracker.track(geometry), this.kit.materials.ground);
    mesh.name = 'reperes';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.landmarkTriangles = (geometry.index?.count ?? 0) / 3;
  }

  private blobInto(
    builder: GeometryBuilder,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    colorHex: string,
  ): void {
    // Boule basse en facettes (8 côtés, 4 étages): moins de 100 triangles.
    const c = new Color(colorHex);
    const ring = (k: number): [number, number] => {
      const a = (k / 4) * Math.PI - Math.PI / 2;
      return [Math.cos(a) * r, Math.sin(a) * h];
    };
    for (let k = 0; k < 4; k++) {
      const [r0, y0] = ring(k);
      const [r1, y1] = ring(k + 1);
      for (let j = 0; j < 8; j++) {
        const a0 = (j / 8) * Math.PI * 2;
        const a1 = ((j + 1) / 8) * Math.PI * 2;
        const mid = (a0 + a1) / 2;
        const ny = (y0 + y1) / 2 / Math.max(0.01, h);
        builder.quad(
          [
            [x + Math.cos(a0) * r1, y + y1, z + Math.sin(a0) * r1],
            [x + Math.cos(a0) * r0, y + y0, z + Math.sin(a0) * r0],
            [x + Math.cos(a1) * r0, y + y0, z + Math.sin(a1) * r0],
            [x + Math.cos(a1) * r1, y + y1, z + Math.sin(a1) * r1],
          ],
          [Math.cos(mid), ny, Math.sin(mid)],
          [c],
        );
      }
    }
  }

  /** Nature dessinée et surface entendue sous un point (son des pas). */
  surfaceAt(x: number, y: number): SurfaceKind {
    return surfaceAt(this.field, x, y);
  }

  kindAt(x: number, y: number): string | null {
    return kindAt(this.field, x, y);
  }

  /**
   * Une image: position du joueur local (m), rayon de vue, part de nuit (0 à 1), personnages à
   * garder visibles et direction vers la caméra.
   */
  update(
    dt: number,
    x: number,
    y: number,
    viewRadius: number,
    night: number,
    subjects: readonly Vec3[],
    toCamera: Vec3,
  ): void {
    const change = this.ring.update(x, y, viewRadius);
    for (const tile of change.unload) this.unload(tile);
    for (const tile of change.load) {
      this.pending.set(tile, buildTile(this.kit, tile));
      this.queue.push(tile);
    }
    if (this.queue.length > 1)
      this.queue.sort((a, b) => tileDistance(this.map, a, x, y) - tileDistance(this.map, b, x, y));
    this.build(x, y, viewRadius);
    if (this.farDirty) this.regroupFar();
    for (const [tile, view] of this.views) {
      const cast =
        tileDistance(this.map, tile, x, y) <= viewRadius + this.settings.ring.shadowMargin;
      if (this.shadowed.get(tile) !== cast) {
        this.shadowed.set(tile, cast);
        view.setShadows(cast);
      }
    }
    this.time.value += dt;
    this.glass.emissiveIntensity = night * this.settings.building.glowNight;
    for (const id of this.occlusion.update(dt, subjects, toCamera)) {
      const view = this.views.get(this.partTile.get(id) ?? -1);
      const opacity = this.occlusion.opacity(id);
      if (view === undefined) continue;
      for (const mesh of view.fading) mesh.setOpacity(id, opacity);
    }
    this.updateCrowns(dt, subjects, toCamera);
  }

  private build(x: number, y: number, viewRadius: number): void {
    const started = performance.now();
    while (this.queue.length > 0) {
      const tile = this.queue[0] ?? -1;
      const urgent = tileDistance(this.map, tile, x, y) <= viewRadius;
      if (!urgent && performance.now() - started > this.settings.ring.buildMsPerFrame) break;
      const work = this.pending.get(tile);
      if (work === undefined) {
        this.queue.shift();
        continue;
      }
      const before = performance.now();
      const step = work.next();
      this.maxStepMs = Math.max(this.maxStepMs, performance.now() - before);
      if (step.done !== true) continue;
      this.queue.shift();
      this.pending.delete(tile);
      this.attach(step.value);
    }
    this.buildMs = performance.now() - started;
  }

  private attach(view: TileView): void {
    this.views.set(view.tile, view);
    this.root.add(view.group);
    for (const box of view.occluders) {
      if (this.occlusion.add(box)) this.partTile.set(box.id, view.tile);
    }
    this.farDirty = true;
  }

  private unload(tile: number): void {
    const work = this.pending.get(tile);
    if (work !== undefined) {
      work.return(new TileView(tile));
      this.pending.delete(tile);
      this.queue = this.queue.filter((t) => t !== tile);
    }
    const view = this.views.get(tile);
    if (view === undefined) return;
    for (const box of view.occluders) {
      this.occlusion.remove(box.id);
      this.partTile.delete(box.id);
    }
    for (const [key, fade] of this.crownFades)
      if (fade.view === view) this.dropCrownFade(key, fade);
    view.dispose();
    this.views.delete(tile);
    this.shadowed.delete(tile);
    this.farDirty = true;
  }

  /** Le sol lointain ne se dessine que sous les tuiles non construites (groupes d'index). */
  private regroupFar(): void {
    this.farDirty = false;
    const far = this.far;
    if (far === null) return;
    const geometry = far.geometry;
    geometry.clearGroups();
    let open: { start: number; count: number } | null = null;
    let triangles = 0;
    const { cols, rows } = tileGrid(this.map);
    for (let tile = 0; tile < cols * rows; tile++) {
      const range = this.farRanges.get(tile);
      if (range === undefined || this.views.has(tile)) continue;
      triangles += range.count / 3;
      if (open !== null && open.start + open.count === range.start) open.count += range.count;
      else {
        if (open !== null) geometry.addGroup(open.start, open.count, 0);
        open = { ...range };
      }
    }
    if (open !== null) geometry.addGroup(open.start, open.count, 0);
    this.farTriangles = triangles;
  }

  /** Houppiers entre la caméra et le joueur: l'instance se cache, une copie transparente la remplace. */
  private updateCrowns(dt: number, subjects: readonly Vec3[], toCamera: Vec3): void {
    const s = RENDER_SETTINGS.occlusion;
    const reach = 10;
    const seen = new Set<string>();
    for (const feet of subjects) {
      for (const view of this.views.values()) {
        const crowns = view.crowns;
        if (crowns === null) continue;
        const { x0, y0, x1, y1 } = tileRect(this.map, view.tile);
        if (
          feet.x < x0 - reach ||
          feet.x > x1 + reach ||
          feet.z < y0 - reach ||
          feet.z > y1 + reach
        )
          continue;
        view.crownBoxes.forEach((box, index) => {
          if (Math.abs(box.min.x - feet.x) > reach || Math.abs(box.min.z - feet.z) > reach) return;
          const key = `${String(view.tile)}:${String(index)}`;
          const fade = this.crownFades.get(key);
          const margin = fade?.hidden === true ? s.margin + s.hysteresis : s.margin;
          let hit = false;
          for (const height of s.probeHeights) {
            this.probe.x = feet.x;
            this.probe.y = feet.y + height;
            this.probe.z = feet.z;
            if (box.max.y > this.probe.y && rayHitsBox(this.probe, toCamera, box, margin)) {
              hit = true;
              break;
            }
          }
          if (!hit && fade === undefined) return;
          seen.add(key);
          if (fade === undefined) this.startCrownFade(key, view, crowns, index);
          else fade.hidden = hit;
        });
      }
    }
    for (const [key, fade] of this.crownFades) {
      if (!seen.has(key)) fade.hidden = false;
      const goal = fade.hidden ? s.fadedOpacity : 1;
      const seconds = fade.hidden ? s.fadeOutSeconds : s.fadeInSeconds;
      const stepSize = ((1 - s.fadedOpacity) * dt) / Math.max(0.01, seconds);
      fade.opacity =
        goal < fade.opacity
          ? Math.max(goal, fade.opacity - stepSize)
          : Math.min(goal, fade.opacity + stepSize);
      fade.material.opacity = fade.opacity;
      if (fade.opacity >= 1 && !fade.hidden) this.dropCrownFade(key, fade);
    }
  }

  private startCrownFade(key: string, view: TileView, crowns: InstancedMesh, index: number): void {
    const tree = view.trees[index];
    if (tree === undefined) return;
    const blob = crownBlob(tree);
    const material = this.fadeBase.clone();
    material.color.set(blob.color);
    material.transparent = true;
    material.depthWrite = false;
    material.opacity = 1;
    const mesh = new Mesh(this.kit.shapes.blob, material);
    mesh.position.set(blob.x, blob.y, blob.z);
    mesh.scale.set(blob.rx, blob.ry, blob.rz);
    mesh.name = 'houppier-fondu';
    view.group.add(mesh);
    crowns.setMatrixAt(index, hidden);
    crowns.instanceMatrix.needsUpdate = true;
    this.crownFades.set(key, { view, index, mesh, material, opacity: 1, hidden: true });
  }

  private dropCrownFade(key: string, fade: CrownFade): void {
    const tree = fade.view.trees[fade.index];
    const crowns = fade.view.crowns;
    if (tree !== undefined && crowns !== null) {
      const blob = crownBlob(tree);
      rotation.identity();
      matrix.compose(
        position.set(blob.x, blob.y, blob.z),
        rotation,
        scale.set(blob.rx, blob.ry, blob.rz),
      );
      crowns.setMatrixAt(fade.index, matrix);
      crowns.instanceMatrix.needsUpdate = true;
    }
    fade.mesh.removeFromParent();
    fade.material.dispose();
    this.crownFades.delete(key);
  }

  /** Tuiles construites (index) et tuiles tenues par l'anneau. */
  loadedTiles(): number[] {
    return [...this.views.keys()].sort((a, b) => a - b);
  }

  stats(): TileStats {
    let triangles = 0;
    let calls = 0;
    let worstTriangles = 0;
    let worstCalls = 0;
    let fading = this.crownFades.size;
    let geometries = 0;
    const tiles: { tile: number; triangles: number; calls: number }[] = [];
    for (const view of this.views.values()) {
      triangles += view.triangles;
      calls += view.calls;
      worstTriangles = Math.max(worstTriangles, view.triangles);
      worstCalls = Math.max(worstCalls, view.calls);
      fading += view.fadedCount();
      geometries += view.tracker.size;
      tiles.push({ tile: view.tile, triangles: Math.round(view.triangles), calls: view.calls });
    }
    tiles.sort((a, b) => a.tile - b.tile);
    return {
      loaded: this.views.size,
      pending: this.pending.size,
      triangles: Math.round(triangles),
      calls,
      worstTriangles: Math.round(worstTriangles),
      worstCalls,
      farTriangles: Math.round(this.farTriangles + this.landmarkTriangles),
      farCalls: (this.far?.geometry.groups.length ?? 0) + (this.landmarkTriangles > 0 ? 1 : 0),
      fading,
      tiles,
      buildMs: this.buildMs,
      maxStepMs: this.maxStepMs,
      geometries,
    };
  }

  dispose(): void {
    for (const tile of [...this.views.keys()]) this.unload(tile);
    for (const tile of [...this.pending.keys()]) this.unload(tile);
    this.ring.clear();
    this.occlusion.clear();
    this.root.removeFromParent();
    this.root.clear();
    this.tracker.dispose();
  }
}
