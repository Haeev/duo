/**
 * Contour coloré des personnages, style `lisse` (étape A du plan de qualité visuelle, chantier 3).
 *
 * Pourquoi une coque inversée plutôt qu'une passe d'écran: la passe demanderait une cible de
 * profondeur et une passe plein écran de plus (coût fixe sur l'UHD 620, même sans personnage), et
 * ne connaîtrait pas la couleur de la pièce; la coque coûte un appel et les triangles de chaque
 * personnage contouré, seulement pour ceux qu'on choisit, et lit la texture du personnage: le
 * contour prend la couleur de la pièce qu'il borde, assombrie, jamais un noir pur.
 *
 * La coque est le maillage du personnage (mêmes tampons, même squelette) redessiné par ses faces
 * arrière, chaque sommet poussé vers l'extérieur à l'écran d'une épaisseur fixe en pixels, le long
 * d'une normale moyenne sans arête (`lisse.ts`): elle reste fermée aux arêtes vives. Un seul
 * programme pour toutes les coques. Budget: au plus `maxCount` personnages et `maxTriangles`
 * triangles de coque, les plus proches du centre de la vue, à moins de `maxDistance` m.
 */
import {
  BackSide,
  Color,
  MeshBasicMaterial,
  SkinnedMesh,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { FrameContext } from './contexte';
import type { ExtensionPart, RenderHooks } from './extensions';
import { OUTLINE_NORMAL, buildOutlineGeometry } from './lisse';
import { RENDER_SETTINGS } from './reglages';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';

const SETTINGS = RENDER_SETTINGS.characters.outline;
/** Nom des matériaux de personnages (habitants et copies des joueurs). */
const CHARACTER_MATERIAL = 'character';
/** Hauteur du point visé sur le personnage (m, avant son échelle): le milieu du corps. */
const BODY_MIDDLE = 0.9;
/** Nouvelle recherche des personnages arrivés ou partis (s). */
const SCAN_SECONDS = 1;
const TRIANGLE = 3;
const LUMA = [0.2126, 0.7152, 0.0722] as const;

/** Coque d'un maillage de corps. */
interface Hull {
  body: SkinnedMesh;
  mesh: SkinnedMesh | null;
}

/** Un personnage de la scène et ses coques. */
interface Figure {
  root: Object3D;
  hulls: Hull[];
  distance: number;
  triangles: number;
  /** Contouré à l'image d'avant (l'hystérésis évite qu'un contour clignote à la limite). */
  outlined: boolean;
}

const VERTEX_PARS = /* glsl */ `
attribute vec3 ${OUTLINE_NORMAL};
uniform float uOutlineWidth;
uniform vec2 uOutlineViewport;
`;

/**
 * Après la position projetée: le sommet glisse à l'écran, le long de sa normale de gonflement
 * vue par la caméra, de `uOutlineWidth` pixels (épaisseur constante, quel que soit le zoom).
 */
const VERTEX_PUSH = /* glsl */ `
{
  vec3 outlineView = normalMatrix * objectNormal;
  vec2 outlineDir = (projectionMatrix * vec4(outlineView, 0.0)).xy * uOutlineViewport;
  float outlineLength = length(outlineDir);
  if (outlineLength > 1e-6) {
    gl_Position.xy += outlineDir / outlineLength * (2.0 * uOutlineWidth) / uOutlineViewport * gl_Position.w;
  }
}
`;

const FRAGMENT_PARS = /* glsl */ `
uniform vec2 uOutlineLook; // assombrissement (linéaire), saturation
uniform vec3 uOutlineLight;
`;

/** Après la texture: la couleur de la pièce, assombrie et un peu saturée, à la lumière du moment. */
const FRAGMENT_COLOR = /* glsl */ `
{
  float outlineLuma = dot(diffuseColor.rgb, vec3(${LUMA.join(', ')}));
  vec3 outlineColor = max(mix(vec3(outlineLuma), diffuseColor.rgb, uOutlineLook.y), 0.0);
  diffuseColor.rgb = outlineColor * uOutlineLook.x * uOutlineLight;
}
`;

function inject(source: string, anchor: string, code: string): string {
  if (!source.includes(anchor)) {
    throw new Error(`Contour: repère « ${anchor} » absent du shader.`);
  }
  return source.replace(anchor, `${anchor}\n${code}`);
}

/** Le contour, en style `lisse` seulement. */
export function createCharacterOutline(hooks: RenderHooks): ExtensionPart | null {
  if (hooks.characterStyle !== 'lisse' || hooks.characters === null) return null;
  return new CharacterOutline(hooks, hooks.characters);
}

class CharacterOutline implements ExtensionPart {
  private readonly figures = new Map<Object3D, Figure>();
  /** Géométrie de coque de chaque géométrie de corps (habits changés: une de plus). */
  private readonly geometries = new WeakMap<BufferGeometry, BufferGeometry>();
  /** Matériau de coque de chaque matériau de personnage (texture des habitants, copie de chaque joueur). */
  private readonly materials = new Map<Material, MeshBasicMaterial>();
  private readonly uniforms = {
    uOutlineWidth: { value: 1 },
    uOutlineViewport: { value: new Vector2(1, 1) },
    uOutlineLook: { value: new Vector2(SETTINGS.darken, SETTINGS.saturation) },
    uOutlineLight: { value: new Color(1, 1, 1) },
  };
  private readonly buffer = new Vector2();
  private readonly eye = new Vector3();
  private readonly forward = new Vector3();
  private readonly at = new Vector3();
  private readonly order: Figure[] = [];
  /** Lumière de midi (soleil pour sa part, plus le ciel): la couleur du contour y vaut la sienne. */
  private readonly noonLight: number;
  private scanClock = 0;
  private knownChildren = -1;

  constructor(
    private readonly hooks: RenderHooks,
    private readonly group: Object3D,
  ) {
    const daylight = AMBIANCE_SETTINGS.daylight;
    this.noonLight =
      Math.max(...daylight.map((key) => key.sunIntensity)) * SETTINGS.sunShare +
      Math.max(...daylight.map((key) => key.hemiIntensity));
  }

  update(context: FrameContext): void {
    this.scanClock -= context.dt;
    if (this.scanClock <= 0 || this.group.children.length !== this.knownChildren) {
      this.scanClock = SCAN_SECONDS;
      this.scan();
    }
    this.updateUniforms();
    const camera = this.hooks.camera;
    camera.getWorldPosition(this.eye);
    camera.getWorldDirection(this.forward);
    const order = this.order;
    order.length = 0;
    for (const figure of this.figures.values()) {
      figure.triangles = 0;
      if (!visibleInScene(figure.root)) {
        figure.distance = Infinity;
        continue;
      }
      // Distance au sol entre le personnage et l'axe de la caméra pris à sa hauteur (le centre de la vue).
      figure.root.getWorldPosition(this.at);
      const height = this.at.y + BODY_MIDDLE * figure.root.scale.y;
      const along = Math.abs(this.forward.y) > 1e-6 ? (height - this.eye.y) / this.forward.y : 0;
      figure.distance =
        Math.hypot(this.eye.x + this.forward.x * along - this.at.x, this.eye.z + this.forward.z * along - this.at.z) -
        (figure.outlined ? SETTINGS.hysteresis : 0);
      for (const hull of figure.hulls) {
        if (visibleInScene(hull.body)) {
          figure.triangles += Math.floor((this.geometryFor(hull.body.geometry).getIndex()?.count ?? 0) / TRIANGLE);
        }
      }
      if (figure.distance <= SETTINGS.maxDistance && figure.triangles > 0) order.push(figure);
    }
    order.sort((a, b) => a.distance - b.distance);
    const light = !this.hooks.renderer.shadowMap.enabled;
    const maxCount = light ? SETTINGS.lightMaxCount : SETTINGS.maxCount;
    let count = 0;
    let triangles = 0;
    const chosen = new Set<Figure>();
    for (const figure of order) {
      if (count >= maxCount || triangles + figure.triangles > SETTINGS.maxTriangles) continue;
      chosen.add(figure);
      count += 1;
      triangles += figure.triangles;
    }
    for (const figure of this.figures.values()) {
      const on = chosen.has(figure);
      figure.outlined = on;
      for (const hull of figure.hulls) this.show(hull, on && visibleInScene(hull.body));
    }
  }

  /** Personnages du groupe: nouveaux suivis, partis oubliés (coques retirées). */
  private scan(): void {
    this.knownChildren = this.group.children.length;
    const present = new Set(this.group.children);
    for (const [root, figure] of this.figures) {
      if (present.has(root)) continue;
      for (const hull of figure.hulls) hull.mesh?.removeFromParent();
      this.figures.delete(root);
    }
    for (const root of this.group.children) {
      if (this.figures.has(root)) continue;
      const hulls: Hull[] = [];
      root.traverse((object) => {
        if (!(object instanceof SkinnedMesh)) return;
        const body = object as SkinnedMesh;
        if (isCharacterMaterial(body.material)) hulls.push({ body, mesh: null });
      });
      this.figures.set(root, { root, hulls, distance: Infinity, triangles: 0, outlined: false });
    }
  }

  private show(hull: Hull, on: boolean): void {
    if (!on) {
      if (hull.mesh !== null) hull.mesh.visible = false;
      return;
    }
    const body = hull.body;
    const geometry = this.geometryFor(body.geometry);
    const material = this.materialFor(body.material as Material);
    if (hull.mesh === null) {
      const mesh = new SkinnedMesh(geometry, material);
      mesh.name = `${body.name} (contour)`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.bindMode = body.bindMode;
      mesh.bind(body.skeleton, body.bindMatrix);
      // Le corps garde une sphère fixe (`personnages.ts`): même élimination hors champ.
      mesh.boundingSphere = body.boundingSphere;
      body.add(mesh);
      hull.mesh = mesh;
    }
    // Les vêtements des joueurs et les pièces portées des habitants changent la géométrie du corps.
    hull.mesh.geometry = geometry;
    hull.mesh.material = material;
    hull.mesh.visible = true;
  }

  private geometryFor(source: BufferGeometry): BufferGeometry {
    let hull = this.geometries.get(source);
    if (hull === undefined) {
      const made = this.hooks.resources.track(buildOutlineGeometry(source, SETTINGS.skipIslandsBelow));
      // Corps libéré (habits changés): sa coque aussi.
      source.addEventListener('dispose', () => {
        made.dispose();
      });
      this.geometries.set(source, made);
      hull = made;
    }
    return hull;
  }

  private materialFor(source: Material): MeshBasicMaterial {
    let material = this.materials.get(source);
    if (material === undefined) {
      const map = 'map' in source && isTextureLike(source.map) ? source.map : null;
      const made = this.hooks.resources.track(
        new MeshBasicMaterial({ name: 'lpl_contour', map, side: BackSide }),
      );
      made.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms): void => {
        Object.assign(shader.uniforms, this.uniforms);
        shader.vertexShader = inject(shader.vertexShader, '#include <common>', VERTEX_PARS);
        // La normale de la coque (sans arête) remplace celle du corps; la peau l'anime ensuite.
        shader.vertexShader = shader.vertexShader.replace(
          '#include <beginnormal_vertex>',
          `vec3 objectNormal = ${OUTLINE_NORMAL};`,
        );
        shader.vertexShader = inject(shader.vertexShader, '#include <project_vertex>', VERTEX_PUSH);
        shader.fragmentShader = inject(shader.fragmentShader, '#include <common>', FRAGMENT_PARS);
        shader.fragmentShader = inject(shader.fragmentShader, '#include <map_fragment>', FRAGMENT_COLOR);
      };
      made.customProgramCacheKey = (): string => 'lpl_contour';
      this.materials.set(source, made);
      material = made;
    }
    // Texture d'un joueur recréée (habillage): la coque suit.
    if ('map' in source && isTextureLike(source.map) && material.map !== source.map) material.map = source.map;
    return material;
  }

  private updateUniforms(): void {
    this.hooks.renderer.getDrawingBufferSize(this.buffer);
    this.uniforms.uOutlineViewport.value.set(Math.max(1, this.buffer.x), Math.max(1, this.buffer.y));
    this.uniforms.uOutlineWidth.value = Math.max(SETTINGS.minWidth, this.buffer.y * SETTINGS.widthPerHeight);
    // Le contour suit la lumière (soir doré, nuit bleue) sans jamais être plus clair que le corps.
    const day = this.hooks.daylight;
    const light = this.uniforms.uOutlineLight.value;
    light.copy(day.sun.color).multiplyScalar(day.sun.intensity * SETTINGS.sunShare);
    light.r += day.hemi.color.r * day.hemi.intensity;
    light.g += day.hemi.color.g * day.hemi.intensity;
    light.b += day.hemi.color.b * day.hemi.intensity;
    light.multiplyScalar(1 / this.noonLight);
    const luma = light.r * LUMA[0] + light.g * LUMA[1] + light.b * LUMA[2];
    if (luma < SETTINGS.minLight) light.multiplyScalar(SETTINGS.minLight / Math.max(luma, 1e-4));
  }

  dispose(): void {
    for (const figure of this.figures.values()) {
      for (const hull of figure.hulls) hull.mesh?.removeFromParent();
    }
    this.figures.clear();
    this.materials.clear();
  }
}

function isCharacterMaterial(material: Material | Material[]): boolean {
  return !Array.isArray(material) && material.name.includes(CHARACTER_MATERIAL);
}

function isTextureLike(value: unknown): value is MeshBasicMaterial['map'] & object {
  return typeof value === 'object' && value !== null && (value as { isTexture?: unknown }).isTexture === true;
}

/** Visible avec tous ses parents (un personnage caché dans une maison, un vêtement ôté). */
function visibleInScene(object: Object3D): boolean {
  for (let node: Object3D | null = object; node !== null; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}
