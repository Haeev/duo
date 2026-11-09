/**
 * Moteur de rendu: WebGL2, caméra subjective (champ vertical 60°, plans 0,05 à 80 m), tampon au
 * pixel physique (leçon R07 de La Petite Ligne: jamais sous le pixel physique sur le PC; rapport
 * plafonné à 2 sur le Mac). Aucune ombre calculée (C10), lumières en nombre fixe (C9).
 */
import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import type { Settings } from '../donnees/schemas';

export interface Stage {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  render(): void;
  dispose(): void;
}

const MAX_PIXEL_RATIO = 2;

export function createStage(canvas: HTMLCanvasElement, settings: Settings): Stage {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.shadowMap.enabled = false;
  const scene = new Scene();
  scene.background = new Color('#cfd8dc');
  const camera = new PerspectiveCamera(settings.player.fovDeg, 16 / 9, 0.05, 80);
  camera.rotation.order = 'YXZ';

  scene.add(new HemisphereLight('#fff6e8', '#6b5a4a', 1.4));
  scene.add(new AmbientLight('#ffffff', 0.35));
  const sun = new DirectionalLight('#fff1d6', 1.2);
  sun.position.set(3, 8, 12);
  scene.add(sun);

  let width = 1;
  let height = 1;
  const resize = (cssW: number, cssH: number, physW: number, physH: number): void => {
    const ratio = Math.min(physW / Math.max(1, cssW), MAX_PIXEL_RATIO);
    // Sous le plafond, la taille physique exacte (aucun flou à 125 ou 150 % sous Windows).
    const capped = ratio >= MAX_PIXEL_RATIO;
    width = Math.max(1, capped ? Math.round(cssW * ratio) : Math.round(physW));
    height = Math.max(1, capped ? Math.round(cssH * ratio) : Math.round(physH));
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry === undefined) return;
    const css = entry.contentBoxSize[0];
    const phys = entry.devicePixelContentBoxSize[0];
    if (css === undefined) return;
    resize(
      css.inlineSize,
      css.blockSize,
      phys?.inlineSize ?? css.inlineSize * window.devicePixelRatio,
      phys?.blockSize ?? css.blockSize * window.devicePixelRatio,
    );
  });
  try {
    observer.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    observer.observe(canvas);
  }

  return {
    renderer,
    scene,
    camera,
    render() {
      renderer.render(scene, camera);
    },
    dispose() {
      observer.disconnect();
      renderer.dispose();
    },
  };
}
