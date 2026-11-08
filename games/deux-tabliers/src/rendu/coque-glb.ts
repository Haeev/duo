/**
 * Coque cuite du village (`shell_village.glb` et ses extensions): posée sans transformation
 * (x et z du plan), éclairée par sa carte de lumière (occlusion sur TEXCOORD_1 dans le GLB,
 * rebranchée en `lightMap`, intensité `lightmap_scale` × π, × 0,42 pour la rue et la cour).
 * Les matériaux de la coque passent en `MeshBasicMaterial`: la lumière est déjà cuite, les
 * lumières de la scène n'éclairent que meubles et personnages (moins de programmes, rien de
 * surexposé). Une fois la coque là, une capture de la salle sert d'environnement aux métaux.
 */
import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PMREMGenerator,
  SRGBColorSpace,
  type Material,
  type Object3D,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { GameView } from '../reseau/vue';
import type { ModelLibrary } from './modeles';

export interface BakedShell {
  /** Vrai si la coque cuite n'a pas pu se charger: la coque en blocs prend le relais. */
  failed(): boolean;
  update(): void;
  dispose(): void;
}

const EXTENSIONS: readonly { readonly id: string; readonly model: string }[] = [
  { id: 'village-fond', model: 'shell_village_ext_fond' },
  { id: 'village-terrasse', model: 'shell_village_ext_terrasse' },
];

function bake(root: Object3D, scale: number, owned: { dispose(): void }[]): void {
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const m = o.material as Material;
    if (m.name === 'dt_verre') {
      const glass = new MeshBasicMaterial({
        color: '#c9d6d3',
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: DoubleSide,
        // Une passe, un programme (voir `singlePassGlass`).
        forceSinglePass: true,
      });
      owned.push(glass);
      o.material = glass;
      o.renderOrder = 2;
      return;
    }
    if (m.name === 'dt_lampe') {
      const lamp = new MeshBasicMaterial({ color: '#ffe6be' });
      owned.push(lamp);
      o.material = lamp;
      return;
    }
    if (!(m instanceof MeshStandardMaterial) || m.aoMap === null) return;
    const light: Texture = m.aoMap;
    light.colorSpace = SRGBColorSpace;
    light.channel = 1;
    light.needsUpdate = true;
    const basic = new MeshBasicMaterial({
      name: m.name,
      color: m.color,
      map: m.map,
      lightMap: light,
      lightMapIntensity: (m.name.startsWith('street_') ? 0.42 : 1) * scale * Math.PI,
    });
    owned.push(basic);
    o.material = basic;
  });
}

function lightmapScale(root: Object3D): number {
  let scale = 1;
  root.traverse((o) => {
    const k = (o.userData as { lightmap_scale?: unknown }).lightmap_scale;
    if (typeof k === 'number') scale = k;
  });
  return scale;
}

export function createBakedShell(
  scene: Scene,
  renderer: WebGLRenderer,
  models: ModelLibrary,
  view: GameView,
): BakedShell {
  const owned: { dispose(): void }[] = [];
  const parts = new Map<string, Object3D>();
  let base: Object3D | null = null;
  let scale = 1;
  let disposed = false;
  let failed = false;
  let key = '';

  // Environnement des métaux: une pièce neutre calculée une fois au chargement, comme l'essai
  // de style (une capture de la salle par six vues compilerait une variante de chaque
  // programme pour la cible cubique: le budget de 12 programmes ne le permet pas).
  const capture = (): void => {
    const room = new RoomEnvironment();
    const pmrem = new PMREMGenerator(renderer);
    const env = pmrem.fromScene(room, 0.04);
    pmrem.dispose();
    room.dispose();
    owned.push(env);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.45;
  };

  void models.gltf('shell_village').then((src) => {
    if (src === null) failed = true;
    if (src === null || disposed) return;
    scale = lightmapScale(src.scene);
    bake(src.scene, scale, owned);
    base = src.scene;
    scene.add(src.scene);
    key = '';
    capture();
  });

  let paint = '';
  const sync = (): void => {
    const wall = view.world().arrangement.walls.salle ?? '';
    if (wall !== paint && base !== null) {
      paint = wall;
      const color = view.content.arrangement.items.get(wall)?.color;
      base.traverse((o) => {
        if (
          o instanceof Mesh &&
          o.material instanceof MeshBasicMaterial &&
          o.material.name === 'shell_wall_paint'
        )
          o.material.color.set(color ?? '#ffffff');
      });
    }
    const open = view.world().arrangement.extensions;
    const next = open.join(',');
    if (next === key || base === null) return;
    key = next;
    const closing = base.getObjectByName('shell_village_fond_ferme');
    if (closing !== undefined) closing.visible = !open.includes('village-fond');
    for (const ext of EXTENSIONS) {
      if (!open.includes(ext.id) || parts.has(ext.id)) continue;
      parts.set(ext.id, base);
      void models.gltf(ext.model).then((src) => {
        if (src === null || disposed) return;
        bake(src.scene, scale, owned);
        parts.set(ext.id, src.scene);
        scene.add(src.scene);
      });
    }
  };

  return {
    failed: () => failed,
    update: sync,
    dispose() {
      disposed = true;
      if (base !== null) scene.remove(base);
      for (const p of parts.values()) if (p !== base) scene.remove(p);
      scene.environment = null;
      for (const d of owned) d.dispose();
    },
  };
}
