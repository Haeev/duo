/**
 * Rendu encré: conversion automatique d'une géométrie ou d'un modèle livré (ADR 0023). Elle pose
 * l'attribut `aInk` que lit le nuanceur: la pièce (l'objet entier) et ses morceaux (chaque partie
 * d'un seul tenant: un pied de chaise, une planche, un houppier) avec leur classe de taille, et la
 * couche de traits de chaque morceau, tirée de sa teinte (`INK_SETTINGS.models.rules`). Aucun
 * modèle n'est nommé: un nouvel objet livré dans `assets/commun/` passe par ici sans une ligne de
 * code. Faite une fois par géométrie; l'ancien rendu ignore l'attribut.
 */
import {
  type BufferAttribute,
  type BufferGeometry,
  Float32BufferAttribute,
  type InterleavedBufferAttribute,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';
import { inkCode, KIND, LAYER } from './couches';
import { INK_SETTINGS, type LayerRule } from './reglages';

type Attribute = BufferAttribute | InterleavedBufferAttribute;

export interface InkTagOptions {
  /** Couche imposée à toute la géométrie; absente: tirée de la teinte de chaque morceau. */
  readonly layer?: number;
  /** Nature imposée (`KIND`); absente: feuillage si la règle de teinte le dit, sinon rien. */
  readonly kind?: number;
  /** Rang de la pièce parmi ses voisines fusionnées (le nuanceur le fait tourner selon la place). */
  readonly piece?: number;
  /**
   * Premier numéro de morceau: des géométries qu'on fusionnera ensuite (un maillage par
   * matériau) gardent ainsi des morceaux distincts de l'une à l'autre.
   */
  readonly partStart?: number;
  /**
   * Le modèle a des vitres (famille de `INK_SETTINGS.models.glass`): ses morceaux à la teinte
   * d'un verre sont des vitres (`KIND.window`), qui suivent l'heure comme celles des façades.
   */
  readonly glass?: boolean;
}

const tagged = new WeakSet<BufferGeometry>();

/** Un modèle de cette famille a-t-il des vitres à reconnaître ? */
export function glassFamily(family: string | undefined): boolean {
  return family !== undefined && INK_SETTINGS.models.glass.families.includes(family);
}

function toScreen(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Teinte (degrés), saturation et clarté (0 à 1) d'une couleur d'écran. */
function hsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1) + 1e-6);
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s: Math.min(1, s), l };
}

/** Règle de couche d'une couleur linéaire (celle des sommets): la première qui convient. */
export function layerRuleOf(
  r: number,
  g: number,
  b: number,
  rules: readonly LayerRule[] = INK_SETTINGS.models.rules,
): LayerRule | null {
  const { h, s, l } = hsl(toScreen(r), toScreen(g), toScreen(b));
  for (const rule of rules) {
    const [from, to] = rule.hue;
    const inHue = from <= to ? h >= from && h <= to : h >= from || h <= to;
    if (inHue && s >= rule.minSaturation && l <= rule.maxLightness) return rule;
  }
  return null;
}

/**
 * Morceaux d'un seul tenant: deux triangles qui partagent un point (à `weld` près) sont du même
 * morceau. Rend le numéro de morceau de chaque sommet et le nombre de morceaux.
 */
export function connectedParts(
  position: Attribute,
  index: BufferAttribute | null,
  weld: number = INK_SETTINGS.models.weld,
): { part: Uint32Array; count: number } {
  const count = position.count;
  const parent = new Uint32Array(count);
  for (let i = 0; i < count; i++) parent[i] = i;
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root] ?? root;
    while (parent[i] !== root) {
      const next = parent[i] ?? root;
      parent[i] = root;
      i = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  // Sommets au même endroit (faces à normales séparées): un seul point.
  const seen = new Map<string, number>();
  const q = 1 / weld;
  for (let i = 0; i < count; i++) {
    const key = `${String(Math.round(position.getX(i) * q))},${String(Math.round(position.getY(i) * q))},${String(Math.round(position.getZ(i) * q))}`;
    const first = seen.get(key);
    if (first === undefined) seen.set(key, i);
    else union(first, i);
  }
  const corners = index === null ? count : index.count;
  const at = (k: number): number => (index === null ? k : index.getX(k));
  for (let k = 0; k + 2 < corners; k += 3) {
    union(at(k), at(k + 1));
    union(at(k), at(k + 2));
  }
  const ids = new Map<number, number>();
  const part = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const root = find(i);
    let id = ids.get(root);
    if (id === undefined) {
      id = ids.size;
      ids.set(root, id);
    }
    part[i] = id;
  }
  return { part, count: ids.size };
}

/**
 * Pose `aInk` sur une géométrie (une fois: un second appel ne fait rien). Rend la géométrie.
 */
export function inkTag(geometry: BufferGeometry, options: InkTagOptions = {}): BufferGeometry {
  if (tagged.has(geometry)) return geometry;
  tagged.add(geometry);
  const position = geometry.getAttribute('position') as Attribute | undefined;
  if (position === undefined) return geometry;
  const color = geometry.getAttribute('color') as Attribute | undefined;
  const { part, count } = connectedParts(position, geometry.index);
  // Boîte et teinte moyenne de chaque morceau.
  const min = new Float32Array(count * 3).fill(Infinity);
  const max = new Float32Array(count * 3).fill(-Infinity);
  const sum = new Float32Array(count * 4);
  const all = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < position.count; i++) {
    const p = (part[i] ?? 0) * 3;
    const xyz = [position.getX(i), position.getY(i), position.getZ(i)];
    for (let a = 0; a < 3; a++) {
      const value = xyz[a] ?? 0;
      min[p + a] = Math.min(min[p + a] ?? value, value);
      max[p + a] = Math.max(max[p + a] ?? value, value);
      all[a] = Math.min(all[a] ?? value, value);
      all[a + 3] = Math.max(all[a + 3] ?? value, value);
    }
    const c = (part[i] ?? 0) * 4;
    sum[c] = (sum[c] ?? 0) + (color?.getX(i) ?? 1);
    sum[c + 1] = (sum[c + 1] ?? 0) + (color?.getY(i) ?? 1);
    sum[c + 2] = (sum[c + 2] ?? 0) + (color?.getZ(i) ?? 1);
    sum[c + 3] = (sum[c + 3] ?? 0) + 1;
  }
  const diagonalOf = (lo: ArrayLike<number>, hi: ArrayLike<number>, o: number, p: number): number =>
    Math.hypot(
      (hi[p] ?? 0) - (lo[o] ?? 0),
      (hi[p + 1] ?? 0) - (lo[o + 1] ?? 0),
      (hi[p + 2] ?? 0) - (lo[o + 2] ?? 0),
    );
  const pieceCode = inkCode(options.piece ?? 0, diagonalOf(all, all, 0, 3));
  const codes = new Float32Array(count);
  const layers = new Float32Array(count);
  const kinds = new Float32Array(count);
  for (let p = 0; p < count; p++) {
    codes[p] = inkCode(
      (p + (options.partStart ?? 0)) % INK_SETTINGS.models.maxParts,
      diagonalOf(min, max, p * 3, p * 3),
    );
    const n = Math.max(1, sum[p * 4 + 3] ?? 1);
    const mean = [
      (sum[p * 4] ?? 0) / n,
      (sum[p * 4 + 1] ?? 0) / n,
      (sum[p * 4 + 2] ?? 0) / n,
    ] as const;
    const found = color === undefined ? null : layerRuleOf(...mean);
    // Un objet manufacturé (à vitres) n'a pas de feuillage: une caisse verte reste une caisse,
    // sans bord d'ombre dentelé ni noir plein dessous.
    const glazed = options.glass === true;
    const rule = glazed && found?.leafy === true ? INK_SETTINGS.models.glass.body : found;
    layers[p] = options.layer ?? LAYER[rule?.layer ?? INK_SETTINGS.models.fallback];
    const pane =
      glazed &&
      color !== undefined &&
      layerRuleOf(...mean, [INK_SETTINGS.models.glass.rule]) !== null;
    kinds[p] = options.kind ?? (pane ? KIND.window : rule?.leafy === true ? KIND.leaf : KIND.none);
    if (pane) layers[p] = LAYER.plain;
  }
  const ink = new Float32Array(position.count * 4);
  for (let i = 0; i < position.count; i++) {
    const p = part[i] ?? 0;
    ink[i * 4] = layers[p] ?? 0;
    ink[i * 4 + 1] = pieceCode;
    ink[i * 4 + 2] = kinds[p] ?? 0;
    ink[i * 4 + 3] = codes[p] ?? 1;
  }
  geometry.setAttribute('aInk', new Float32BufferAttribute(ink, 4));
  return geometry;
}

/**
 * Forme unité instanciée (boîte, tronc, houppier): une couche et une nature pour toute la forme;
 * la pièce et sa classe de taille se lisent dans l'instance (code 0), rien d'autre à déclarer.
 */
export function inkUnit(geometry: BufferGeometry, layer: number, kind = 0): BufferGeometry {
  const count = geometry.getAttribute('position').count;
  const ink = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    ink[i * 4] = layer;
    ink[i * 4 + 2] = kind;
  }
  geometry.setAttribute('aInk', new Float32BufferAttribute(ink, 4));
  tagged.add(geometry);
  return geometry;
}

function isMesh(object: Object3D): object is Mesh {
  return (object as Partial<Mesh>).isMesh === true;
}

/**
 * Passe un modèle livré au matériau encré: chaque maillage reçoit `aInk` (une fois par
 * géométrie) et le matériau commun. Les matériaux d'origine restent à leur source.
 */
export function inkifyModel(
  root: Object3D,
  material: Material,
  options: Pick<InkTagOptions, 'glass'> = {},
): Object3D {
  root.traverse((object) => {
    if (!isMesh(object)) return;
    inkTag(object.geometry, options);
    object.material = material;
  });
  return root;
}
