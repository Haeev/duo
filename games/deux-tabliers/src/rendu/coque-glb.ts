/**
 * Coque cuite du village (`shell_village.glb` et ses extensions): posée sans transformation
 * (x et z du plan), éclairée par sa carte de lumière (occlusion sur TEXCOORD_1 dans le GLB,
 * rebranchée en `lightMap`, intensité `lightmap_scale` × π, × 0,42 pour la rue et la cour). La place du
 * Tilleul (`shell_village_place.glb`) a sa propre carte et son propre `lightmap_scale`; son ciel et son
 * lointain (`dt_ciel`) et le feuillage découpé des arbres (`dt_feuillage`) sont sans lumière.
 * Les matériaux de la coque passent en `MeshBasicMaterial`: la lumière est déjà cuite, les
 * lumières de la scène n'éclairent que meubles et personnages (moins de programmes, rien de
 * surexposé). Une fois la coque là, une capture de la salle sert d'environnement aux métaux.
 */
import {
  Color,
  DoubleSide,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PMREMGenerator,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { GameView } from '../reseau/vue';
import { BAKED_DOOR_LEAF, PLACE_RUELLE_COPING } from './arriere-cotes';
import { createBackRooms, type BackRooms } from './arriere';
import { textureUrl, type ModelLibrary } from './modeles';

/**
 * Revêtements de la coque cuite (`variantes_coque` de `modeles.json`): une peinture garde
 * l'enduit et prend sa teinte (sRGB, divisée par 0,70 en linéaire comme à l'export); un papier
 * peint remplace la texture du mur, en blanc; un sol remplace la texture du sol (mêmes UV,
 * 1 m par tuile). Le modèle de l'article du catalogue est le nom de la variante.
 */
const WALL_VARIANTS: Readonly<Record<string, { readonly file: string; readonly tint: string }>> = {
  peinture_chaux: { file: 'mur_enduit.jpg', tint: '#D5C4A5' },
  peinture_lin: { file: 'mur_enduit.jpg', tint: '#D4C7AE' },
  peinture_vert_eau: { file: 'mur_enduit.jpg', tint: '#A9BDB1' },
  peinture_lie_de_vin: { file: 'mur_enduit.jpg', tint: '#6E3A40' },
  papier_fleurs_champs: { file: 'papier_fleurs_champs.jpg', tint: '#FFFFFF' },
  papier_feuillage: { file: 'papier_feuillage.jpg', tint: '#FFFFFF' },
  papier_rayures_creme: { file: 'papier_rayures_creme.jpg', tint: '#FFFFFF' },
};
const FLOOR_VARIANTS: Readonly<Record<string, string>> = {
  sol_plancher: 'sol_plancher.jpg',
  sol_tomettes: 'sol_tomettes.jpg',
  sol_carreaux_ciment: 'sol_carreaux_ciment.jpg',
  sol_damier: 'sol_damier.jpg',
};
/** Matériaux de la coque par pièce: murs, sol (la pièce du fond a son sol de tomettes). */
const ROOM_MATERIALS: Readonly<Record<string, { readonly wall: string; readonly floor: string }>> =
  {
    salle: { wall: 'shell_wall_paint', floor: 'shell_floor' },
    fond: { wall: 'shell_wall_paint', floor: 'shell_floor_fond' },
  };
const PAINT_EXPORT_FACTOR = 0.7;

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
    if (m.name === 'dt_ciel' && m instanceof MeshStandardMaterial) {
      // Ciel et lointain de la place: sans lumière (couleurs de l'image et des sommets).
      const sky = new MeshBasicMaterial({ name: m.name, map: m.map, vertexColors: true, fog: false });
      owned.push(sky);
      o.material = sky;
      o.frustumCulled = false;
      return;
    }
    if (m.name === 'dt_feuillage' && m instanceof MeshStandardMaterial) {
      // Feuillage découpé des arbres de la place: lumière dans les couleurs de sommets, alpha en
      // découpe (alphaMode MASK du GLB), sans tri ni transparence.
      const leaves = new MeshBasicMaterial({
        name: m.name,
        map: m.map,
        vertexColors: true,
        alphaTest: m.alphaTest > 0 ? m.alphaTest : 0.5,
      });
      owned.push(leaves);
      o.material = leaves;
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
      // Teintes de la place (pierre, enduits, volets) en couleurs de sommets; blanches ailleurs.
      vertexColors: m.vertexColors,
    });
    owned.push(basic);
    o.material = basic;
  });
}

interface Box3Like {
  readonly min: readonly number[];
  readonly max: readonly number[];
}

/**
 * Déplace les sommets d'un modèle cuit compris dans une boîte (repère du monde): `move` reçoit le
 * point du monde et le modifie. Une fois au chargement; la géométrie du GLB n'est pas partagée.
 */
function moveVertices(root: Object3D, box: Box3Like, move: (p: Vector3) => void): void {
  const p = new Vector3();
  const inverse = new Matrix4();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const geometry = o.geometry as BufferGeometry;
    const pos = geometry.getAttribute('position');
    inverse.copy(o.matrixWorld).invert();
    let changed = false;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const [x0 = 0, y0 = 0, z0 = 0] = box.min;
      const [x1 = 0, y1 = 0, z1 = 0] = box.max;
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1 || p.z < z0 || p.z > z1) continue;
      move(p);
      p.applyMatrix4(inverse);
      pos.setXYZ(i, p.x, p.y, p.z);
      changed = true;
    }
    if (changed) pos.needsUpdate = true;
  });
}

/**
 * Vantail de la porte de l'arrière-comptoir, cuit fermé alors qu'on passe: ses sommets sont
 * repliés en un point (triangles vides), la réserve dessine le vantail ouvert.
 */
function foldBakedDoorLeaf(root: Object3D): void {
  const [x, y, z] = BAKED_DOOR_LEAF.min;
  moveVertices(root, BAKED_DOOR_LEAF, (p) => p.set(x, y, z));
}

/** Chaperon du mur de la ruelle (place): son débord au-dessus de la cour est ramené au nu du mur. */
function trimRuelleCoping(root: Object3D): void {
  moveVertices(root, PLACE_RUELLE_COPING, (p) => {
    p.x = PLACE_RUELLE_COPING.x;
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
  // Réserve et cour, hors de la coque cuite (posées avec elle, jamais avec la coque en blocs).
  let backRooms: BackRooms | null = null;

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
    foldBakedDoorLeaf(src.scene);
    base = src.scene;
    scene.add(src.scene);
    backRooms = createBackRooms(scene);
    key = '';
    capture();
  });
  // La place du Tilleul (décor de fond cuit, sa propre carte de lumière), le ciel et le lointain.
  let place: Object3D | null = null;
  void models.gltf('shell_village_place').then((src) => {
    if (src === null || disposed) return;
    trimRuelleCoping(src.scene);
    bake(src.scene, lightmapScale(src.scene), owned);
    place = src.scene;
    scene.add(src.scene);
  });

  // Textures des revêtements, chargées à la première pose (une fois chacune).
  const loader = new TextureLoader();
  const textures = new Map<string, Texture>();
  const texture = (file: string): Texture | null => {
    const known = textures.get(file);
    if (known !== undefined) return known;
    const url = textureUrl(file);
    if (url === undefined) return null;
    const t = loader.load(url);
    // Comme les textures du GLB: pas de retournement, répétée (1 m par tuile), sRGB.
    t.flipY = false;
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    textures.set(file, t);
    owned.push(t);
    return t;
  };
  const tint = new Color();
  /** Applique murs et sol d'une pièce sur une partie de la coque (salle: la coque, fond: l'extension). */
  const cover = (root: Object3D, room: string): void => {
    const names = ROOM_MATERIALS[room];
    if (names === undefined) return;
    const a = view.world().arrangement;
    const wallModel = view.content.arrangement.items.get(a.walls[room] ?? '')?.model;
    const floorModel = view.content.arrangement.items.get(a.floors[room] ?? '')?.model;
    const wall = wallModel === undefined ? undefined : WALL_VARIANTS[wallModel];
    const floor = floorModel === undefined ? undefined : FLOOR_VARIANTS[floorModel];
    root.traverse((o) => {
      if (!(o instanceof Mesh) || !(o.material instanceof MeshBasicMaterial)) return;
      const m = o.material;
      const ud = m.userData as { origMap?: Texture | null; origColor?: Color };
      if (m.name !== names.wall && m.name !== names.floor) return;
      if (!('origMap' in ud)) {
        ud.origMap = m.map;
        ud.origColor = m.color.clone();
      }
      const variant = m.name === names.wall ? wall : undefined;
      const file = m.name === names.wall ? variant?.file : floor;
      const map = file === undefined ? null : texture(file);
      m.map = map ?? ud.origMap ?? null;
      if (variant !== undefined && map !== null) {
        tint.set(variant.tint).multiplyScalar(1 / PAINT_EXPORT_FACTOR);
        m.color.copy(tint);
      } else if (m.name === names.floor && map !== null) m.color.set('#ffffff');
      else if (ud.origColor !== undefined) m.color.copy(ud.origColor);
      m.needsUpdate = true;
    });
  };

  let covers = '';
  const sync = (): void => {
    const a = view.world().arrangement;
    const nextCovers = `${JSON.stringify(a.walls)}|${JSON.stringify(a.floors)}|${String(parts.size)}`;
    if (nextCovers !== covers && base !== null) {
      covers = nextCovers;
      cover(base, 'salle');
      const fond = parts.get('village-fond');
      if (fond !== undefined && fond !== base) cover(fond, 'fond');
    }
    const open = view.world().arrangement.extensions;
    const next = open.join(',');
    if (next === key || base === null) return;
    key = next;
    backRooms?.setFondOpen(open.includes('village-fond'));
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
        // La pièce du fond arrive avec ses revêtements (le prochain `sync` les pose).
        covers = '';
      });
    }
  };

  return {
    failed: () => failed,
    update: sync,
    dispose() {
      disposed = true;
      if (base !== null) scene.remove(base);
      if (place !== null) scene.remove(place);
      for (const p of parts.values()) if (p !== base) scene.remove(p);
      backRooms?.dispose();
      scene.environment = null;
      for (const d of owned) d.dispose();
    },
  };
}
