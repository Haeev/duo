/**
 * Habillage des joueurs (0.12, contrat `docs/jeux/jeu-1/garde-robe-0-12.md`, section 5): corps,
 * coiffure, barbe, écusson du profil et vêtements portés (`wear_<slot>_<style>` de
 * `personnages.glb`) fusionnés en une géométrie animée, un appel de dessin par joueur. Partagé par
 * la scène et l'aperçu de la boutique.
 *
 * Couleurs: chaque joueur a sa copie de la texture des personnages. La rangée 0 garde le corps et
 * la couleur du profil Duo (cases `scarf` et `scarf_mark`, l'écusson); la rangée 1 reçoit les
 * couleurs des vêtements portés dans l'ordre de l'artiste (`WEAR_SLOTS` de
 * `assets-src/modeles/garde_robe.py`): `top_p`, `top_s`, `top_m`, `bottom_p`, `bottom_s`,
 * `bottom_m`, `shoes_p`, `shoes_s`, `outer_p`, `outer_s`, `outer_m`, `hat_p`, `hat_s`, `hat_m`,
 * puis `wear_metal` et `wear_under`, fixes. Un motif absent prend la secondaire.
 */
import {
  CanvasTexture,
  CylinderGeometry,
  Float32BufferAttribute,
  SkinnedMesh,
  type BufferAttribute,
  type BufferGeometry,
  type Object3D,
  type TypedArray,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { REQUIRED_SLOTS, type ClothesContent, type ClothingDef } from '../donnees/vetements';
import { visiblePieces } from '../etat/garde-robe';
import type { Appearance, CharacterId, ClothingSlot, DeepReadonly } from '../etat/types';
import {
  BEARD_MESHES,
  BODY_COLORS,
  HAIR_COLORS,
  HAIR_FLATTENED_ASLEEP,
  HAIR_MESHES,
  SCARF_MARK,
  SCARF_SYMBOLS,
  safeColor,
  scarfMeshFor,
} from './apparence';
import { preparePaletteTexture } from './materiaux';
import { CHARACTER_SLOTS, PALETTE_CELL_PIXELS, characterGridRows, characterSlotColumn, type CharacterSlot } from './palette';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';

const VECTOR_SIZE = 3;
const SKIN_SIZE = 4;
const BODY = 'player_base';
/** Cases par rangée de la texture des personnages (ses rangées se comptent sur la texture, `characterGridRows`). */
const COLUMNS = CHARACTER_SLOTS.length;
const BODY_ROW = 0;
const WEAR_ROW = 1;
/** Rôles de couleur d'un vêtement. */
export type Role = 'principale' | 'secondaire' | 'motif';
/** Colonnes de la rangée 1 par emplacement (les chaussures n'ont pas de motif). */
const WEAR_COLUMNS: Readonly<Record<ClothingSlot, Partial<Record<Role, number>>>> = {
  top: { principale: 0, secondaire: 1, motif: 2 },
  bottom: { principale: 3, secondaire: 4, motif: 5 },
  shoes: { principale: 6, secondaire: 7 },
  outer: { principale: 8, secondaire: 9, motif: 10 },
  hat: { principale: 11, secondaire: 12, motif: 13 },
};
/** Cases fixes de la rangée 1 (`WEAR_FIXED` de l'artiste): boutons et boucles, sous-vêtement du corps. */
const WEAR_FIXED: readonly { column: number; color: string }[] = [
  { column: 14, color: '#c8a150' },
  { column: 15, color: '#e4dccb' },
];
/** Écusson du profil (symbole de `scarfMeshFor`), et sa variante posée sur un par-dessus. */
const BADGE_PREFIX = 'player_badge_';
const BADGE_OUTER_SUFFIX = '_outer';
const SCARF_PREFIX = 'player_scarf_';
/** Tenues d'avant la 0.12 (haut, bas et chaussures d'un seul tenant): substitut si un vêtement manque au modèle. */
const LEGACY_OUTFIT = 'player_outfit_work';
const LEGACY_OVERALLS = 'player_outfit_overalls';
/** Variante de coupe de l'artiste sous un chapeau (`<coupe>_hat`), sinon aplatie ici. */
const HAT_HAIR_SUFFIX = '_hat';
/** Sous un chapeau, rien de la coupe ne dépasse le bas du chapeau plus cette marge (m). */
const HAT_HAIR_MARGIN = 0.02;
const HEAD_BONE = 'head';
/** Chapeau de substitut: son bord sous le sommet du crâne (au-dessus des sourcils). */
const HAT_BRIM_BELOW_TOP = 0.075;
/** Gilet de substitut: torse de l'ancienne tenue au-dessus de la taille, gonflé, ourlet en secondaire. */
const VEST_BONES = ['spine', 'chest'];
const VEST_FROM_Y = 0.92;
const VEST_LIFT = 0.018;
const VEST_HEM = 0.05;
const HALF = 0.5;
const BYTE_MAX = 255;

function cellColumn(slot: ClothingSlot, role: Role): number {
  const columns = WEAR_COLUMNS[slot];
  return columns[role] ?? columns.secondaire ?? 0;
}

/**
 * Centre de la case d'un vêtement (rangée 1) dans la texture des personnages, en UV: `rows`
 * rangées de cases (64 pour `personnages.png` de 256 px de haut, pas 16 comme les colonnes).
 */
export function wearCellUv(slot: ClothingSlot, role: Role, rows: number): { u: number; v: number } {
  return { u: (cellColumn(slot, role) + HALF) / COLUMNS, v: (WEAR_ROW + HALF) / rows };
}

/**
 * Couleurs de sommets blanches sur `geometry`, au format de celles de `like` (même tableau, même
 * taille, même normalisation): Three.js multiplie la texture par elles, donc un maillage du
 * matériau des personnages qui n'en a pas sort noir, et la fusion avec le corps exige les mêmes
 * attributs. Sans couleurs sur `like` (ancien GLB), on retire les siennes.
 */
export function whiteColorsLike(geometry: BufferGeometry, like: BufferGeometry): void {
  const reference = like.getAttribute('color') as BufferAttribute | undefined;
  if (reference === undefined) {
    geometry.deleteAttribute('color');
    return;
  }
  const count = geometry.getAttribute('position').count;
  const ArrayType = reference.array.constructor as new (length: number) => TypedArray;
  const data = new ArrayType(count * reference.itemSize);
  data.fill(reference.normalized ? normalizedMax(data) : 1);
  geometry.setAttribute('color', new (reference.constructor as typeof BufferAttribute)(data, reference.itemSize, reference.normalized));
}

/** Valeur de 1 dans un tableau d'entiers normalisés (255, 65 535...). */
function normalizedMax(array: TypedArray): number {
  return array instanceof Uint8Array || array instanceof Uint8ClampedArray
    ? 0xff
    : array instanceof Uint16Array
      ? 0xffff
      : array instanceof Int8Array
        ? 0x7f
        : array instanceof Int16Array
          ? 0x7fff
          : 1;
}

/** Nom du nœud de l'écusson pour cette couleur de profil (`player_badge_<symbole>`). */
function badgeMesh(scarf: string, outer: boolean): string {
  const symbol = scarfMeshFor(safeColor(scarf)).slice(SCARF_PREFIX.length);
  return `${BADGE_PREFIX}${symbol}${outer ? BADGE_OUTER_SUFFIX : ''}`;
}

/** Les nœuds de `personnages.glb` qu'un joueur peut montrer (les foulards n'en sont plus). */
export function playerMeshNames(clothes: ClothesContent): string[] {
  const hairs = HAIR_MESHES.flatMap((name) => [name, `${name}${HAT_HAIR_SUFFIX}`]);
  const beards = BEARD_MESHES.filter((name): name is NonNullable<typeof name> => name !== null);
  const badges = SCARF_SYMBOLS.flatMap((s) => [badgeMesh(s.color, false), badgeMesh(s.color, true)]);
  return [...new Set([BODY, ...hairs, ...beards, ...badges, LEGACY_OUTFIT, LEGACY_OVERALLS, ...clothes.list.map((d) => d.modele)])];
}

/**
 * Fusionne le corps et les pièces choisies en une seule géométrie animée: un appel de dessin par
 * joueur et un seul programme de shader pour tous les personnages. Les pièces sans cibles de
 * morphose en reçoivent des nulles, pour avoir les mêmes attributs que le corps. `null` si c'est
 * impossible.
 */
export function mergeOutfit(base: BufferGeometry, parts: readonly BufferGeometry[]): BufferGeometry | null {
  const morphs = base.morphAttributes.position ?? [];
  const prepared = parts.map((part) => {
    const copy = part.clone();
    const count = copy.getAttribute('position').count;
    if (copy.morphAttributes.position === undefined && morphs.length > 0) {
      copy.morphAttributes.position = morphs.map(
        () => new Float32BufferAttribute(new Float32Array(count * VECTOR_SIZE), VECTOR_SIZE),
      );
    }
    copy.morphTargetsRelative = base.morphTargetsRelative;
    return copy;
  });
  const merged = mergeGeometries([base, ...prepared], false);
  for (const copy of prepared) {
    copy.dispose();
  }
  return merged;
}

/** Ce que l'habillage lit d'un joueur. */
export interface DressLook {
  id: CharacterId;
  appearance: DeepReadonly<Pick<Appearance, 'hair' | 'hairColor' | 'beard' | 'wear' | 'scarf'>>;
  /** Couché: coupes longues aplaties, chapeau ôté. */
  asleep: boolean;
}

/** Texture d'un joueur: celle des personnages, rangées 0 et 1 réécrites à ses couleurs. */
export class PlayerTexture {
  readonly canvas = document.createElement('canvas');
  readonly texture: CanvasTexture;
  private key = '';

  constructor(private readonly source: CanvasImageSource & { width: number; height: number }) {
    this.canvas.width = source.width;
    this.canvas.height = source.height;
    this.texture = new CanvasTexture(this.canvas);
    preparePaletteTexture(this.texture, true);
  }

  paint(key: string, body: Partial<Record<CharacterSlot, string>>, wear: readonly { column: number; color: string }[]): void {
    if (key === this.key) return;
    this.key = key;
    const context = this.canvas.getContext('2d');
    if (context === null) return;
    context.drawImage(this.source, 0, 0);
    const cell = (column: number, row: number, color: string): void => {
      context.fillStyle = color;
      context.fillRect(column * PALETTE_CELL_PIXELS, row * PALETTE_CELL_PIXELS, PALETTE_CELL_PIXELS, PALETTE_CELL_PIXELS);
    };
    for (const [slot, color] of Object.entries(body) as [CharacterSlot, string][]) cell(characterSlotColumn(slot), BODY_ROW, color);
    for (const w of wear) cell(w.column, WEAR_ROW, w.color);
    this.texture.needsUpdate = true;
  }
}

/** Un joueur habillé: pièces de son modèle cloné, corps d'origine et fusion du moment. */
export interface DressedFigure {
  meshes: Map<string, Object3D>;
  baseGeometry: BufferGeometry | null;
  merged: BufferGeometry | null;
  texture: PlayerTexture | null;
  look: string;
}

function isSkinned(object: Object3D | undefined): object is SkinnedMesh {
  return object instanceof SkinnedMesh;
}

/** Repère de la tête dans la pose de liaison (m), et son os. */
interface HeadFrame {
  x: number;
  z: number;
  top: number;
  radius: number;
  center: number;
  bone: number;
}

/**
 * Habille les joueurs; garde en cache ce qui se partage d'un joueur à l'autre (pièces aux couleurs
 * renvoyées, coupes aplaties, substituts), libéré avec les ressources du rendu.
 */
export class PlayerDresser {
  private readonly flatHair = new Map<string, BufferGeometry>();
  private readonly substitutes = new Map<string, BufferGeometry>();
  private frame: HeadFrame | null = null;

  constructor(
    private readonly clothes: ClothesContent,
    private readonly resources: ResourceTracker,
  ) {}

  /** Prépare un modèle cloné (`cloneRig`): pièces sorties de la scène, corps d'origine gardé. */
  prepare(model: Object3D, texture: PlayerTexture | null): DressedFigure {
    const meshes = new Map<string, Object3D>();
    model.traverse((object) => {
      if (object instanceof SkinnedMesh) meshes.set(object.name, object);
    });
    const base = meshes.get(BODY);
    const baseGeometry = isSkinned(base) ? (base.geometry) : null;
    if (baseGeometry !== null) {
      // Les pièces sont fusionnées dans le corps: leurs maillages sortent de la scène (ni dessin ni programme).
      for (const [name, mesh] of meshes) if (name !== BODY) mesh.removeFromParent();
    }
    return { meshes, baseGeometry, merged: null, texture, look: '' };
  }

  dress(figure: DressedFigure, look: DressLook): void {
    const a = look.appearance;
    const w = a.wear;
    // Appelé à chaque image: une chaîne courte comparée, la fusion seulement si elle change.
    const key = `${look.id}|${a.hair}|${a.hairColor}|${a.beard}|${w.top}|${w.bottom}|${w.shoes}|${w.outer ?? ''}|${w.hat ?? ''}|${a.scarf}|${look.asleep ? 1 : 0}`;
    if (key === figure.look) return;
    figure.look = key;
    const base = figure.meshes.get(BODY);
    const geometryOf = (name: string): BufferGeometry | null => {
      const mesh = figure.meshes.get(name);
      return isSkinned(mesh) ? (mesh.geometry) : null;
    };
    const shown = visiblePieces(this.clothes, a.wear).filter((def) => !look.asleep || def.slot !== 'hat');
    const hat = shown.find((def) => def.slot === 'hat') ?? null;
    const parts: BufferGeometry[] = [];
    const body: Partial<Record<CharacterSlot, string>> = {
      ...BODY_COLORS[look.id],
      ...(HAIR_COLORS[a.hairColor] ?? {}),
      scarf: safeColor(a.scarf),
      scarf_mark: SCARF_MARK,
    };
    // Haut, bas et chaussures: les pièces de l'artiste si toutes existent, sinon l'ancienne tenue d'un tenant.
    const covered = new Set(shown.flatMap((def) => def.couvre));
    const complete = REQUIRED_SLOTS.filter((slot) => !covered.has(slot)).every((slot) =>
      shown.some((def) => def.slot === slot && geometryOf(def.modele) !== null),
    );
    for (const def of shown) {
      const source = geometryOf(def.modele);
      if (source !== null && (complete || def.slot === 'outer' || def.slot === 'hat')) parts.push(source);
      else if (def.slot === 'outer' || def.slot === 'hat') {
        const rows = characterGridRows(figure.texture?.canvas.height);
        const substitute = isSkinned(base) ? this.substitute(def.slot, base, geometryOf(LEGACY_OUTFIT), rows) : null;
        if (substitute !== null) parts.push(substitute);
      }
    }
    if (!complete) {
      const overalls = shown.find((def) => def.slot === 'bottom' && def.couvre.includes('top'));
      const legacy = geometryOf(overalls === undefined ? LEGACY_OUTFIT : LEGACY_OVERALLS) ?? geometryOf(LEGACY_OUTFIT);
      if (legacy !== null) parts.push(legacy);
      const torso = shown.find((def) => def.slot === 'top') ?? overalls;
      const bottom = shown.find((def) => def.slot === 'bottom');
      const shoes = shown.find((def) => def.slot === 'shoes');
      if (torso !== undefined) Object.assign(body, { top: torso.couleurs.principale, top_trim: torso.couleurs.secondaire });
      if (bottom !== undefined) body.bottom = bottom.couleurs.principale;
      if (shoes !== undefined) body.shoes = shoes.couleurs.principale;
    }
    const hairMesh = HAIR_MESHES[a.hair] ?? HAIR_MESHES[0];
    const hair = this.hairFor(hairMesh, look.asleep, hat, geometryOf);
    if (hair !== null) parts.push(hair);
    const beardMesh = BEARD_MESHES[a.beard] ?? null;
    const beard = beardMesh === null ? null : geometryOf(beardMesh);
    if (beard !== null) parts.push(beard);
    // L'écusson du profil, sur le par-dessus s'il y en a un (seulement avec les pièces de l'artiste).
    const badge = complete ? geometryOf(badgeMesh(a.scarf, shown.some((def) => def.slot === 'outer'))) : null;
    if (badge !== null) parts.push(badge);
    const merged = isSkinned(base) && figure.baseGeometry !== null ? mergeOutfit(figure.baseGeometry, parts) : null;
    if (merged !== null && isSkinned(base)) {
      figure.merged?.dispose();
      figure.merged = merged;
      base.geometry = merged;
      for (const [name, mesh] of figure.meshes) mesh.visible = name === BODY;
    }
    const wearCells: { column: number; color: string }[] = [...WEAR_FIXED];
    for (const def of shown) {
      const c = def.couleurs;
      wearCells.push(
        { column: cellColumn(def.slot, 'principale'), color: c.principale },
        { column: cellColumn(def.slot, 'secondaire'), color: c.secondaire },
        { column: cellColumn(def.slot, 'motif'), color: c.motif ?? c.secondaire },
      );
    }
    figure.texture?.paint(key, body, wearCells);
  }

  private hairFor(
    name: string,
    asleep: boolean,
    hat: ClothingDef | null,
    geometryOf: (name: string) => BufferGeometry | null,
  ): BufferGeometry | null {
    const source = geometryOf(name);
    if (source === null) return null;
    if (asleep) return HAIR_FLATTENED_ASLEEP.has(name) ? this.asleepHair(name, source) : source;
    if (hat === null) return source;
    const variant = geometryOf(`${name}${HAT_HAIR_SUFFIX}`);
    if (variant !== null) return variant;
    const hatGeometry = geometryOf(hat.modele);
    hatGeometry?.computeBoundingBox();
    const frame = this.frame;
    const below = hatGeometry?.boundingBox?.min.y ?? (frame === null ? null : frame.top - HAT_BRIM_BELOW_TOP);
    return below === null ? source : this.hatHair(name, source, below + HAT_HAIR_MARGIN);
  }

  /** Coupe longue couchée: rien ne dépasse derrière la tête plus loin que le chignon, ni dans le dos. */
  private asleepHair(name: string, source: BufferGeometry): BufferGeometry {
    const key = `${name}|couche`;
    const known = this.flatHair.get(key);
    if (known !== undefined) return known;
    const settings = RENDER_SETTINGS.characters.asleepHair;
    const copy = this.resources.track(source.clone());
    const position = copy.getAttribute('position');
    for (let i = 0; i < position.count; i += 1) {
      const limit = position.getY(i) > settings.headFromY ? settings.headDepth : settings.backDepth;
      if (position.getZ(i) < limit) position.setZ(i, limit);
    }
    position.needsUpdate = true;
    copy.computeBoundingSphere();
    this.flatHair.set(key, copy);
    return copy;
  }

  /** Coupe sous un chapeau: tout ce qui dépasse le bas du chapeau est ramené dessous (aplatie). */
  private hatHair(name: string, source: BufferGeometry, ceiling: number): BufferGeometry {
    const key = `${name}|${ceiling.toFixed(3)}`;
    const known = this.flatHair.get(key);
    if (known !== undefined) return known;
    const copy = this.resources.track(source.clone());
    const position = copy.getAttribute('position');
    for (let i = 0; i < position.count; i += 1) {
      if (position.getY(i) > ceiling) position.setY(i, ceiling);
    }
    position.needsUpdate = true;
    copy.computeBoundingSphere();
    this.flatHair.set(key, copy);
    return copy;
  }

  /** L'os qui pèse le plus sur ce sommet (les poids du GLB ne sont pas triés). */
  private static mainBone(joints: BufferAttribute, weights: BufferAttribute, i: number): number {
    let bone = joints.getX(i);
    let weight = weights.getX(i);
    for (let k = 1; k < SKIN_SIZE; k += 1) {
      if (weights.getComponent(i, k) > weight) {
        weight = weights.getComponent(i, k);
        bone = joints.getComponent(i, k);
      }
    }
    return bone;
  }

  /** Repère de la tête dans la pose de liaison, lu une fois dans le corps (sommets de l'os `head`). */
  private headFrame(body: SkinnedMesh): HeadFrame | null {
    if (this.frame !== null) return this.frame;
    const bone = body.skeleton.bones.findIndex((b) => b.name === HEAD_BONE);
    const geometry = body.geometry;
    const position = geometry.getAttribute('position');
    const joints = geometry.getAttribute('skinIndex') as BufferAttribute | undefined;
    const weights = geometry.getAttribute('skinWeight') as BufferAttribute | undefined;
    if (bone < 0 || joints === undefined || weights === undefined) return null;
    let [minX, maxX, maxY, minZ, maxZ] = [Infinity, -Infinity, -Infinity, Infinity, -Infinity];
    for (let i = 0; i < position.count; i += 1) {
      if (PlayerDresser.mainBone(joints, weights, i) !== bone) continue;
      minX = Math.min(minX, position.getX(i));
      maxX = Math.max(maxX, position.getX(i));
      maxY = Math.max(maxY, position.getY(i));
      minZ = Math.min(minZ, position.getZ(i));
      maxZ = Math.max(maxZ, position.getZ(i));
    }
    if (!Number.isFinite(maxY)) return null;
    const radius = Math.max(maxX - minX, maxZ - minZ) / 2;
    this.frame = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, top: maxY, radius, center: maxY - radius, bone };
    return this.frame;
  }

  /**
   * Substitut d'un chapeau ou d'un par-dessus absent du modèle, aux mêmes attributs que le corps,
   * peint aux cases de l'emplacement: un chapeau rond lié à la tête, ou un gilet sans manches tiré
   * du torse de l'ancienne tenue (mêmes poids: il suit le corps), légèrement gonflé.
   */
  private substitute(slot: 'outer' | 'hat', body: SkinnedMesh, clothed: BufferGeometry | null, rows: number): BufferGeometry | null {
    const key = `${slot}|${rows}`;
    const known = this.substitutes.get(key);
    if (known !== undefined) return known;
    const made = slot === 'hat' ? this.hatSubstitute(body, rows) : clothed === null ? null : this.vestSubstitute(body, clothed, rows);
    if (made !== null) {
      // Blanc: ni occlusion ni pli peints sur une pièce de secours (la couleur vient de sa case).
      whiteColorsLike(made, body.geometry);
      this.resources.track(made);
      this.substitutes.set(key, made);
    }
    return made;
  }

  private hatSubstitute(body: SkinnedMesh, rows: number): BufferGeometry | null {
    const h = this.headFrame(body);
    const bodyGeometry = body.geometry;
    const joints = bodyGeometry.getAttribute('skinIndex') as BufferAttribute | undefined;
    const weights = bodyGeometry.getAttribute('skinWeight') as BufferAttribute | undefined;
    if (h === null || joints === undefined || weights === undefined) return null;
    // Le bord au-dessus des sourcils, la calotte au-dessus des cheveux.
    const brimY = h.top - HAT_BRIM_BELOW_TOP;
    const crown = new CylinderGeometry(h.radius * 0.96, h.radius * 1.04, 0.15, 10);
    crown.translate(h.x, brimY + 0.075, h.z);
    const band = new CylinderGeometry(h.radius * 1.06, h.radius * 1.06, 0.035, 10);
    band.translate(h.x, brimY + 0.025, h.z);
    const brim = new CylinderGeometry(h.radius * 1.6, h.radius * 1.6, 0.016, 12);
    brim.translate(h.x, brimY, h.z);
    const shapes: [BufferGeometry, Role][] = [
      [crown, 'principale'],
      [band, 'secondaire'],
      [brim, 'principale'],
    ];
    for (const [geometry, role] of shapes) {
      const uv = geometry.getAttribute('uv');
      const cell = wearCellUv('hat', role, rows);
      for (let i = 0; i < uv.count; i += 1) uv.setXY(i, cell.u, cell.v);
    }
    // Trois cylindres aux mêmes attributs: la fusion ne peut pas échouer.
    const merged = mergeGeometries(shapes.map(([geometry]) => geometry), false);
    for (const [geometry] of shapes) geometry.dispose();
    const count = merged.getAttribute('position').count;
    const JointArray = joints.array.constructor as new (length: number) => TypedArray;
    const WeightArray = weights.array.constructor as new (length: number) => TypedArray;
    const jointData = new JointArray(count * SKIN_SIZE);
    const weightData = new WeightArray(count * SKIN_SIZE);
    for (let i = 0; i < count; i += 1) {
      jointData[i * SKIN_SIZE] = h.bone;
      weightData[i * SKIN_SIZE] = weights.normalized ? BYTE_MAX : 1;
    }
    merged.setAttribute('skinIndex', new (joints.constructor as typeof BufferAttribute)(jointData, SKIN_SIZE, joints.normalized));
    merged.setAttribute('skinWeight', new (weights.constructor as typeof BufferAttribute)(weightData, SKIN_SIZE, weights.normalized));
    return merged;
  }

  private vestSubstitute(body: SkinnedMesh, clothed: BufferGeometry, rows: number): BufferGeometry | null {
    const bones = body.skeleton.bones.map((b) => b.name);
    const torso = new Set(VEST_BONES.map((name) => bones.indexOf(name)));
    const copy = clothed.clone();
    const position = copy.getAttribute('position');
    const uv = copy.getAttribute('uv');
    const joints = copy.getAttribute('skinIndex') as BufferAttribute | undefined;
    const weights = copy.getAttribute('skinWeight') as BufferAttribute | undefined;
    const index = copy.getIndex();
    if (joints === undefined || weights === undefined || index === null) {
      copy.dispose();
      return null;
    }
    const keep = (i: number): boolean => position.getY(i) >= VEST_FROM_Y && torso.has(PlayerDresser.mainBone(joints, weights, i));
    const triangles: number[] = [];
    for (let f = 0; f < index.count; f += 3) {
      const [a, b, c] = [index.getX(f), index.getX(f + 1), index.getX(f + 2)];
      if (keep(a) && keep(b) && keep(c)) triangles.push(a, b, c);
    }
    // Gonflé à l'horizontale depuis l'axe du torse: les sommets d'une même arête bougent ensemble
    // (les faces à plat ont chacune leurs sommets, gonflées selon leur normale elles s'ouvriraient).
    let [minX, maxX, minZ, maxZ] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const i of triangles) {
      minX = Math.min(minX, position.getX(i));
      maxX = Math.max(maxX, position.getX(i));
      minZ = Math.min(minZ, position.getZ(i));
      maxZ = Math.max(maxZ, position.getZ(i));
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    for (let i = 0; i < position.count; i += 1) {
      const dx = position.getX(i) - cx;
      const dz = position.getZ(i) - cz;
      const length = Math.hypot(dx, dz) || 1;
      position.setXYZ(i, position.getX(i) + (dx / length) * VEST_LIFT, position.getY(i), position.getZ(i) + (dz / length) * VEST_LIFT);
      const role: Role = position.getY(i) < VEST_FROM_Y + VEST_HEM ? 'secondaire' : 'principale';
      const cell = wearCellUv('outer', role, rows);
      uv.setXY(i, cell.u, cell.v);
    }
    copy.setIndex(triangles);
    return triangles.length === 0 ? null : copy;
  }
}
