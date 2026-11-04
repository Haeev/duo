/**
 * Portraits des habitants tirés de leur modèle 3D (0.13, demande du client): chaque habitant est
 * rendu une seule fois au chargement, en buste de trois quarts, sur fond transparent, dans un
 * petit contexte WebGL à part qui est libéré aussitôt. L'interface reçoit des adresses d'images
 * (`blob:`) et garde le portrait SVG en repli tant qu'une image manque.
 *
 * Rien ne se redessine ensuite: le coût est payé une fois, pendant l'écran de chargement.
 */
import {
  AnimationMixer,
  Bone,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  Scene,
  SkinnedMesh,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type AnimationClip,
  type BufferGeometry,
  type Object3D,
  type ToneMapping,
} from 'three';
import type { Content } from '../donnees/types';
import { chooseProp, villagerScale, type PropSituation } from './accessoires';
import { applyBoneRest, boneRestOf, idleClipOf } from './gabarit';
import { CHARACTERS_FILE, type ModelLibrary } from './modeles';
import { RENDER_SETTINGS } from './reglages';

const RIG_NODE = 'rig';
const SETTINGS = RENDER_SETTINGS.portraits;

export interface PortraitSources {
  library: ModelLibrary;
  content: Content;
  toneMapping: ToneMapping;
  exposure: number;
}

/** Les portraits rendus, par identifiant d'habitant. */
export interface VillagerPortraits {
  /** Adresse de l'image (`blob:`), ou `null` (pas de modèle, image pas encore encodée). */
  url(id: string): string | null;
  /** Durée du rendu au chargement (ms), pour le journal et les mesures. */
  readonly milliseconds: number;
  /** Habitants rendus. */
  readonly count: number;
  dispose(): void;
}

/** Ce que voit un habitant immobile hors de toute habitude: les pièces portées « partout » (loupe relevée d'Ambroise). */
const STILL: PropSituation = { moving: false, activity: 'idle', habit: null, left: null, talking: false };

const scratch = new Vector3();

/** Haut du buste, cou et largeur de la tête dans le repère du monde (la caméra regarde vers -Z). */
interface Bust {
  top: number;
  neck: number;
  minX: number;
  maxX: number;
  centerX: number;
  centerZ: number;
}

/**
 * Mesure le buste posé: le cou (os `neck`), le point le plus haut (chapeau, chignon, loupe
 * relevée) et la largeur de tout ce qui dépasse au-dessus des épaules (bords des chapeaux).
 */
function measureBust(model: Object3D): Bust | null {
  const neck = model.getObjectByName('neck');
  if (!(neck instanceof Bone)) return null;
  const neckPos = neck.getWorldPosition(new Vector3());
  const bust: Bust = { top: neckPos.y, neck: neckPos.y, minX: neckPos.x, maxX: neckPos.x, centerX: neckPos.x, centerZ: neckPos.z };
  const shoulders = neckPos.y - SETTINGS.shoulderDrop;
  model.traverse((object) => {
    if (!(object instanceof SkinnedMesh)) return;
    const geometry = object.geometry as BufferGeometry;
    const count = geometry.getAttribute('position').count;
    for (let i = 0; i < count; i++) {
      object.getVertexPosition(i, scratch);
      scratch.applyMatrix4(object.matrixWorld);
      if (scratch.y > bust.top) bust.top = scratch.y;
      if (scratch.y > shoulders) {
        if (scratch.x < bust.minX) bust.minX = scratch.x;
        if (scratch.x > bust.maxX) bust.maxX = scratch.x;
      }
    }
  });
  return bust;
}

class PortraitSet implements VillagerPortraits {
  private readonly urls = new Map<string, string>();
  private disposed = false;
  count = 0;
  milliseconds = 0;

  set(id: string, url: string): void {
    if (this.disposed) {
      URL.revokeObjectURL(url);
      return;
    }
    this.urls.set(id, url);
  }

  url(id: string): string | null {
    return this.urls.get(id) ?? null;
  }

  dispose(): void {
    this.disposed = true;
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}

/**
 * Rend le buste de chaque habitant qui a son modèle dans `personnages.glb`. `pixelRatio`: celui de
 * l'écran (2 au plus), l'image fait `SETTINGS.size` points CSS de côté.
 */
export function renderVillagerPortraits(sources: PortraitSources, pixelRatio: number): VillagerPortraits {
  const started = performance.now();
  const set = new PortraitSet();
  const { library, content } = sources;
  const side = Math.round(SETTINGS.size * Math.min(Math.max(pixelRatio, 1), 2));
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, stencil: false });
  try {
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = sources.toneMapping;
    renderer.toneMappingExposure = sources.exposure;
    renderer.setPixelRatio(1);
    renderer.setSize(side, side, false);
    renderer.setClearColor(0x000000, 0);
    const scene = new Scene();
    // Lumière douce de portrait: ciel chaud, clé de trois quarts en haut à gauche, contre-jour léger.
    scene.add(new HemisphereLight(0xfff4e0, 0x8a7a66, SETTINGS.light.sky));
    const key = new DirectionalLight(0xfff1dc, SETTINGS.light.key);
    key.position.set(-1.5, 3, 3);
    const rim = new DirectionalLight(0xdfe8ff, SETTINGS.light.rim);
    rim.position.set(2, 2, -2);
    scene.add(key, rim);
    const camera = new PerspectiveCamera(SETTINGS.fov, 1, 0.05, 20);
    const copy = document.createElement('canvas');
    copy.width = side;
    copy.height = side;
    const ctx = copy.getContext('2d');
    const clips: AnimationClip[] = library.animations(CHARACTERS_FILE);
    const clipNames = new Set(clips.map((clip) => clip.name));
    if (ctx === null) return set;
    for (const villager of content.villagers) {
      const modelName = villager.model === '' ? `villager_${villager.id}` : villager.model;
      const node = library.source(modelName)?.node ?? modelName;
      if (!library.has(node)) continue;
      const rules = RENDER_SETTINGS.characters.villagerProps[villager.id] ?? [];
      const worn = chooseProp(rules, STILL, true, null);
      const keep = worn !== null && library.has(worn.model) ? [node, worn.model] : [node];
      const model = library.cloneRig(RIG_NODE, keep);
      if (model === null) continue;
      const extras = library.extras(modelName);
      applyBoneRest(model, boneRestOf(extras));
      model.traverse((object) => {
        if (object instanceof Mesh) {
          object.frustumCulled = false;
          // Visage neutre, yeux ouverts (les poids par défaut du GLB valent 1).
          object.morphTargetInfluences?.fill(0);
        }
      });
      const mixer = new AnimationMixer(model);
      const idle = clips.find((clip) => clip.name === idleClipOf(extras, clipNames));
      if (idle !== undefined) {
        mixer.clipAction(idle).play();
        mixer.setTime(SETTINGS.poseTime);
      }
      model.scale.setScalar(villagerScale(villager.scale, extras));
      model.rotation.y = SETTINGS.yaw;
      scene.add(model);
      model.updateMatrixWorld(true);
      model.traverse((object) => {
        if (object instanceof SkinnedMesh) object.skeleton.update();
      });
      const bust = measureBust(model);
      if (bust !== null) {
        // Cadre carré: de la tête (avec son chapeau) jusqu'aux épaules, assez large pour les bords.
        const height = (bust.top - bust.neck) * SETTINGS.heightOverHead + SETTINGS.margin;
        const width = (bust.maxX - bust.minX) * SETTINGS.widthMargin;
        const span = Math.max(height, width);
        const centerY = bust.top + SETTINGS.margin * 0.5 - span / 2;
        const distance = span / 2 / Math.tan((SETTINGS.fov * Math.PI) / 360);
        const lift = distance * Math.tan(SETTINGS.pitch);
        camera.position.set(bust.centerX, centerY + lift, bust.centerZ + distance);
        camera.lookAt(bust.centerX, centerY, bust.centerZ);
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        ctx.clearRect(0, 0, side, side);
        // Copie dans la même tâche que le rendu: le tampon WebGL est encore là.
        ctx.drawImage(renderer.domElement, 0, 0);
        const id = villager.id;
        copy.toBlob((blob) => {
          if (blob !== null) set.set(id, URL.createObjectURL(blob));
        }, 'image/png');
        set.count++;
      }
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      scene.remove(model);
      // Les géométries et matériaux sont ceux du jeu: seuls les squelettes copiés sont libérés.
      model.traverse((object) => {
        if (object instanceof SkinnedMesh) object.skeleton.dispose();
      });
    }
  } finally {
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    set.milliseconds = performance.now() - started;
  }
  return set;
}
