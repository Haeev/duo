/**
 * Visionneuse des objets (technique 3.9, interface 8): UNE scène et UN contexte WebGL pour tout
 * le jeu. Elle rend (a) les vignettes fixes, une fois par objet et par taille, mises en cache
 * (fond transparent), et (b) les vues vivantes de l'objet survolé, qui tourne doucement (un tour
 * en 8 s), recopiées image par image dans un canevas 2D posé dans l'élément du HTML.
 * Deux vues vivantes au plus (budget de l'interface); sans WebGL, tout passe en images fixes.
 */
import {
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  type Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import {
  type ModelResolver,
  type ObjectIndex,
  type ObjectModel,
  GRIP_SUFFIX,
  modelOf,
} from './catalogue';
import { fallbackThumbnail, provisionalThumbnail } from './provisoire';

/** Réglages de cadrage et d'animation (valeurs de rendu, pas de gameplay). */
export const VIEWER_SETTINGS = {
  /** Côté du rendu WebGL, en pixels (une vignette de 256 px sert les écrans à facteur 2). */
  renderSize: 256,
  /** Vues de trois quarts: hauteur et azimut de la caméra, en degrés. */
  elevationDeg: 24,
  azimuthDeg: 35,
  fovDeg: 28,
  /** Marge autour de l'objet (1 = la sphère englobante touche le bord). */
  margin: 1.08,
  /** Un objet plus haut que ce rapport (outils) est penché en diagonale pour remplir la case. */
  tallRatio: 2.2,
  tiltDeg: 38,
  /** Un tour complet en 8 s (interface 5.3); 30 images par seconde suffisent. */
  turnSeconds: 8,
  fps: 30,
  maxLiveViews: 2,
} as const;

export type ThumbnailKind = 'model' | 'provisional' | 'fallback';
export interface Thumbnail {
  readonly url: string;
  readonly kind: ThumbnailKind;
}

export interface LiveView {
  /** Tourne l'objet à la main (W et X), en radians. */
  turn(delta: number): void;
  /** Retire la vue (le canevas quitte l'élément). */
  stop(): void;
}

export interface ObjectViewer {
  /** Vignette fixe de l'objet du jeu `itemId` (`size` en pixels CSS, 64 par défaut). */
  thumbnail(itemId: string, size?: number): Promise<Thumbnail>;
  /** Vignette déjà prête, ou `null` (pour un rendu HTML synchrone). */
  cachedThumbnail(itemId: string, size?: number): Thumbnail | null;
  /** Vue vivante qui tourne dans `element` (la plus ancienne s'arrête au-delà du budget). */
  live(element: HTMLElement, itemId: string): LiveView;
  readonly hasWebGL: boolean;
  dispose(): void;
}

export interface ViewerOptions {
  index: ObjectIndex;
  resolve: ModelResolver;
  /** Charge un fichier GLB de `assets/commun/objets/` (injectable pour les tests). */
  load: (file: string) => Promise<GLTF>;
  /** Animations réduites: l'objet ne tourne que par `turn` (interface 6, règle 7). */
  reducedMotion?: boolean;
  /** Fabrique du moteur WebGL; `null` ou une exception: pas de WebGL, repli en images fixes. */
  createRenderer?: () => WebGLRenderer | null;
  devicePixelRatio?: number;
}

interface Live {
  readonly canvas: HTMLCanvasElement;
  readonly holder: Group;
  angle: number;
  stopped: boolean;
}

function defaultRenderer(): WebGLRenderer | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  if (canvas.getContext('webgl2') === null) return null;
  return new WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: false });
}

export function createObjectViewer(options: ViewerOptions): ObjectViewer {
  const S = VIEWER_SETTINGS;
  let renderer: WebGLRenderer | null = null;
  try {
    renderer = (options.createRenderer ?? defaultRenderer)();
  } catch {
    renderer = null;
  }
  const dpr = Math.min(
    2,
    options.devicePixelRatio ?? (typeof window === 'undefined' ? 1 : window.devicePixelRatio),
  );
  const scene = new Scene();
  const camera = new PerspectiveCamera(S.fovDeg, 1, 0.005, 50);
  // Trois lampes fixes, sans ombre portée (interface 8): ciel doux, clé chaude, contre-jour.
  scene.add(new HemisphereLight(0xfff4e2, 0x8a7a66, 1.6));
  const key = new DirectionalLight(0xfff0dc, 2.0);
  key.position.set(-1.2, 2.0, 2.2);
  const rim = new DirectionalLight(0xdfe8ff, 1.1);
  rim.position.set(1.5, 1.2, -2.0);
  scene.add(key, rim);
  if (renderer !== null) {
    renderer.setPixelRatio(1);
    renderer.setSize(S.renderSize, S.renderSize, false);
    renderer.setClearColor(0x000000, 0);
  }

  const files = new Map<string, Promise<GLTF>>();
  const thumbs = new Map<string, Thumbnail>();
  const pending = new Map<string, Promise<Thumbnail>>();
  const lives: Live[] = [];
  let frame = 0;
  let last = 0;

  function gltfOf(file: string): Promise<GLTF> {
    let p = files.get(file);
    if (p === undefined) {
      p = options.load(file);
      files.set(file, p);
    }
    return p;
  }

  /** Copie du nœud du modèle, centrée, penchée si elle est haute, dans un pivot qui tourne. */
  async function staged(model: ObjectModel): Promise<{ holder: Group; radius: number }> {
    const gltf = await gltfOf(model.file);
    const source = gltf.scene.getObjectByName(model.node);
    if (source === undefined) throw new Error(`objets: nœud ${model.node} absent de ${model.file}`);
    const copy = source.clone(true);
    copy.position.set(0, 0, 0);
    copy.traverse((o: Object3D) => {
      if (o.name.endsWith(GRIP_SUFFIX)) o.visible = false;
    });
    const tilt = new Group();
    tilt.add(copy);
    const [w, h, d] = model.size;
    if (h > S.tallRatio * Math.max(w, d)) tilt.rotation.z = (-S.tiltDeg * Math.PI) / 180;
    tilt.updateMatrixWorld(true);
    const box = new Box3().setFromObject(tilt);
    const center = box.getCenter(new Vector3());
    tilt.position.sub(center);
    const holder = new Group();
    holder.add(tilt);
    const radius = box.getSize(new Vector3()).length() / 2;
    return { holder, radius };
  }

  function aim(radius: number): void {
    const dist = (radius * S.margin) / Math.sin(((S.fovDeg / 2) * Math.PI) / 180);
    const el = (S.elevationDeg * Math.PI) / 180;
    const az = (S.azimuthDeg * Math.PI) / 180;
    camera.position.set(
      dist * Math.cos(el) * Math.sin(az),
      dist * Math.sin(el),
      dist * Math.cos(el) * Math.cos(az),
    );
    camera.near = Math.max(0.001, dist - radius * 2);
    camera.far = dist + radius * 2;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function draw(holder: Group, radius: number, target: HTMLCanvasElement): void {
    if (renderer === null) return;
    scene.add(holder);
    aim(radius);
    renderer.render(scene, camera);
    scene.remove(holder);
    const ctx = target.getContext('2d');
    if (ctx === null) return;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(renderer.domElement, 0, 0, target.width, target.height);
  }

  const radii = new WeakMap<Group, number>();

  async function render(itemId: string, size: number): Promise<Thumbnail> {
    const model = modelOf(options.index, options.resolve, itemId);
    if (model === null) return { url: provisionalThumbnail(), kind: 'provisional' };
    if (renderer === null || typeof document === 'undefined')
      return { url: fallbackThumbnail(), kind: 'fallback' };
    const { holder, radius } = await staged(model);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(S.renderSize, Math.round(size * dpr));
    draw(holder, radius, canvas);
    return { url: canvas.toDataURL('image/png'), kind: 'model' };
  }

  function keyOf(itemId: string, size: number): string {
    return `${itemId}@${size}`;
  }

  function tick(now: number): void {
    frame = 0;
    if (lives.length === 0) return;
    frame = requestAnimationFrame(tick);
    if (now - last < 1000 / S.fps - 2) return;
    const dt = last === 0 ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const view of lives) {
      if (options.reducedMotion !== true) view.angle += (dt * 2 * Math.PI) / S.turnSeconds;
      view.holder.rotation.y = view.angle;
      draw(view.holder, radii.get(view.holder) ?? 1, view.canvas);
    }
  }

  function startLoop(): void {
    if (frame === 0 && typeof requestAnimationFrame !== 'undefined') {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  }

  return {
    hasWebGL: renderer !== null,

    cachedThumbnail(itemId, size = 64) {
      return thumbs.get(keyOf(itemId, size)) ?? null;
    },

    thumbnail(itemId, size = 64) {
      const k = keyOf(itemId, size);
      const done = thumbs.get(k);
      if (done !== undefined) return Promise.resolve(done);
      let p = pending.get(k);
      if (p === undefined) {
        p = render(itemId, size)
          .catch((): Thumbnail => ({ url: fallbackThumbnail(), kind: 'fallback' }))
          .then((t) => {
            thumbs.set(k, t);
            pending.delete(k);
            return t;
          });
        pending.set(k, p);
      }
      return p;
    },

    live(element, itemId) {
      const canvas = document.createElement('canvas');
      canvas.className = 'obj-live';
      const side = Math.min(
        S.renderSize,
        Math.round(Math.max(element.clientWidth, element.clientHeight, 64) * dpr),
      );
      canvas.width = canvas.height = side;
      canvas.style.width = canvas.style.height = '100%';
      const view: Live = { canvas, holder: new Group(), angle: 0, stopped: false };
      let shown: HTMLElement = canvas;
      const model = modelOf(options.index, options.resolve, itemId);
      const fixed = (t: Thumbnail): void => {
        const img = document.createElement('img');
        img.src = t.url;
        img.alt = '';
        img.className = 'obj-live';
        canvas.replaceWith(img);
        shown = img;
      };
      element.append(canvas);
      if (model === null || renderer === null) {
        fixed(
          model === null
            ? { url: provisionalThumbnail(), kind: 'provisional' }
            : { url: fallbackThumbnail(), kind: 'fallback' },
        );
      } else {
        void staged(model).then(
          ({ holder, radius }) => {
            if (view.stopped) return;
            view.holder.add(holder);
            radii.set(view.holder, radius);
            while (lives.length >= S.maxLiveViews) lives.shift()?.canvas.remove();
            lives.push(view);
            draw(view.holder, radius, canvas);
            startLoop();
          },
          () => {
            fixed({ url: fallbackThumbnail(), kind: 'fallback' });
          },
        );
      }
      return {
        turn(delta) {
          view.angle += delta;
          view.holder.rotation.y = view.angle;
          if (!view.stopped) draw(view.holder, radii.get(view.holder) ?? 1, canvas);
        },
        stop() {
          view.stopped = true;
          const i = lives.indexOf(view);
          if (i >= 0) lives.splice(i, 1);
          shown.remove();
        },
      };
    },

    dispose() {
      lives.length = 0;
      if (frame !== 0) cancelAnimationFrame(frame);
      renderer?.dispose();
      renderer = null;
    },
  };
}
