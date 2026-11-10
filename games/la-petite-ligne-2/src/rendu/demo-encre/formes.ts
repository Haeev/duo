/**
 * Essai « encre »: l'atelier des formes. Tout volume de la scène passe par `Sculpt`, qui pose des
 * solides simples (boîte, prisme, fût, galet), les tord un peu (le style veut des objets trapus et
 * de travers), leur donne des normales à plat (un ton par face), une couleur en aplat, une couche
 * de traits peints, un numéro d'objet et un numéro de morceau. Ces numéros servent au contour:
 * deux objets sont séparés par un trait de silhouette, deux morceaux d'un même objet par un trait
 * intérieur. Chaque numéro porte aussi une classe de taille (mesurée ici, sans rien déclarer):
 * c'est elle qui décide, selon le zoom, si le trait est épais, fin ou effacé.
 */
import * as THREE from 'three';

export type Rgb = readonly [number, number, number];

/** Couleur d'affichage (sRGB, de 0 à 1) telle qu'écrite: l'essai peint directement en valeurs d'écran. */
export function hex(color: string): Rgb {
  const value = Number.parseInt(color.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** Couches de la texture de traits (voir `textures.ts`), dans l'ordre du tableau de textures. */
export const LAYER = {
  plain: 0,
  wood: 1,
  wall: 2,
  slab: 3,
  roof: 4,
  leaf: 5,
  bark: 6,
  hatch: 7,
  grass: 8,
  dirt: 9,
  ballast: 10,
  /** Une seule planche: veines et noeuds, sans joints (les planches sont alors des volumes). */
  grain: 11,
  /** Une seule pierre ou dalle: éclats, fissures, piqûres, sans appareil. */
  face: 12,
} as const;
export const LAYER_COUNT = 13;

/** Côté d'un carreau de texture, en mètres: 512 points pour 4 m, un trait de 3 points fait 2,3 cm. */
export const TILE_METRES = 4;

/**
 * Nature d'une face, lue par le nuanceur: vitre (éclairée de l'intérieur ou par le ciel), flamme,
 * feuillage (bord d'ombre dentelé, noir plein dessous, vent) ou tige souple (vent seulement).
 */
export const GLOW = { none: 0, window: 1, flame: 2, leaf: 3, stem: 4 } as const;

export interface PartOptions {
  readonly color: Rgb;
  readonly layer?: number;
  /** Couleur des faces tournées vers le haut (dessus d'un mur coupé, assise). */
  readonly topColor?: Rgb;
  /** Couleur des faces tournées vers le bas (dessous d'un feuillage: un noir plein). */
  readonly bottomColor?: Rgb;
  readonly glow?: number;
  /** Écart maximal des sommets, en mètres: ce qui rend la pièce un peu tordue. */
  readonly wobble?: number;
  /** Axe local le long duquel courent les traits de la couche (fil du bois, rangs de tuiles). */
  readonly grain?: 'x' | 'y' | 'z';
  /**
   * Centre d'une masse ronde, dans le repère de la pièce: les normales rayonnent de ce point au
   * lieu d'être à plat, et l'ombre dessine une masse au lieu de facettes (feuillages).
   */
  readonly round?: readonly [number, number, number];
}

/** Classe de taille d'un objet ou d'un morceau, d'après la diagonale de sa boîte (m). */
export function sizeClass(diagonal: number): number {
  if (diagonal >= 2.5) return 0;
  if (diagonal >= 1) return 1;
  return diagonal >= 0.4 ? 2 : 3;
}

const AXES = ['x', 'y', 'z'] as const;

function hash(x: number, y: number, z: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 53.3) * 43758.5453;
  return s - Math.floor(s);
}

/** Matrice rigide: position, puis rotations d'Euler (radians, ordre YXZ). */
export function at(x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    new THREE.Vector3(1, 1, 1),
  );
}

export class Sculpt {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly uvs: number[] = [];
  private readonly metas: number[] = [];
  private readonly feet: number[] = [];
  private base = new THREE.Matrix4();
  private foot = 0;
  private currentId = 1;
  private partCount = 0;
  private depth = 0;
  private objectStart = 0;

  /** `firstId`: les numéros d'objet vont de 1 à 63 (0 est le sol) et bouclent. */
  constructor(firstId = 1) {
    this.currentId = firstId;
  }

  /**
   * Ferme l'objet en cours: sa taille est mesurée, et tous ses sommets reçoivent son numéro
   * (6 bits) et sa classe de taille (2 bits) dans une même valeur de 0 à 255.
   */
  private closeObject(): void {
    const end = this.positions.length / 3;
    if (end > this.objectStart) {
      const box = new THREE.Box3();
      const v = new THREE.Vector3();
      for (let i = this.objectStart; i < end; i += 1) {
        box.expandByPoint(
          v.set(
            this.positions[i * 3] ?? 0,
            this.positions[i * 3 + 1] ?? 0,
            this.positions[i * 3 + 2] ?? 0,
          ),
        );
      }
      const code = (this.currentId % 63) + 1 + 64 * sizeClass(box.getSize(v).length());
      for (let i = this.objectStart; i < end; i += 1) this.metas[i * 4 + 1] = code;
      this.currentId += 1;
    }
    this.objectStart = end;
  }

  /**
   * Hors d'un groupe: ouvre un nouvel objet. Dans un groupe: sans effet sur le numéro d'objet
   * (les morceaux ont déjà chacun le leur); l'appel reste pour marquer les sous-ensembles.
   */
  newId(): void {
    if (this.depth === 0) this.closeObject();
  }

  get triangles(): number {
    return this.positions.length / 9;
  }

  /**
   * Pose tout ce que `build` ajoute dans le repère `matrix`: un objet décrit autour de son pied.
   * La hauteur de ce pied est gardée: la matière encre le bas de l'objet (contact avec le sol).
   */
  group(matrix: THREE.Matrix4, build: () => void): void {
    if (this.depth > 0) {
      this.inside(matrix, build);
      return;
    }
    const previous = this.base;
    const previousFoot = this.foot;
    this.base = previous.clone().multiply(matrix);
    this.foot = new THREE.Vector3().setFromMatrixPosition(this.base).y;
    this.closeObject();
    this.depth += 1;
    build();
    this.depth -= 1;
    this.closeObject();
    this.base = previous;
    this.foot = previousFoot;
  }

  /** Repère intermédiaire dans un même objet (le tronc d'un personnage): ni nouveau numéro ni nouveau pied. */
  inside(matrix: THREE.Matrix4, build: () => void): void {
    const previous = this.base;
    this.base = previous.clone().multiply(matrix);
    build();
    this.base = previous;
  }

  add(source: THREE.BufferGeometry, matrix: THREE.Matrix4, options: PartOptions): void {
    const geometry = source.index ? source.toNonIndexed() : source;
    const local = geometry.getAttribute('position');
    const world = this.base.clone().multiply(matrix);
    const seed = (this.partCount += 1);
    const wobble = options.wobble ?? 0.012;
    const partStart = this.positions.length / 3;
    const partBox = new THREE.Box3();
    const offsetU = hash(seed, 1, 2, 3);
    const offsetV = hash(seed, 4, 5, 6);
    const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] as const;
    const w = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] as const;
    const edgeA = new THREE.Vector3();
    const edgeB = new THREE.Vector3();
    const localNormal = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    const roundNormal = new THREE.Vector3();
    const centre = options.round ? new THREE.Vector3(...options.round).applyMatrix4(world) : null;
    for (let i = 0; i < local.count; i += 3) {
      for (let k = 0; k < 3; k += 1) {
        const v = p[k as 0 | 1 | 2];
        v.fromBufferAttribute(local, i + k);
        // Décalage tiré sur la position arrondie: deux faces qui partagent un coin restent jointes.
        const qx = Math.round(v.x * 1000);
        const qy = Math.round(v.y * 1000);
        const qz = Math.round(v.z * 1000);
        v.x += (hash(qx, qy, qz, seed) - 0.5) * 2 * wobble;
        v.y += (hash(qy, qz, qx, seed + 0.5) - 0.5) * 2 * wobble;
        v.z += (hash(qz, qx, qy, seed + 0.25) - 0.5) * 2 * wobble;
        w[k as 0 | 1 | 2].copy(v).applyMatrix4(world);
      }
      localNormal.crossVectors(edgeA.subVectors(p[1], p[0]), edgeB.subVectors(p[2], p[0]));
      worldNormal.crossVectors(edgeA.subVectors(w[1], w[0]), edgeB.subVectors(w[2], w[0]));
      if (worldNormal.lengthSq() < 1e-14) continue;
      worldNormal.normalize();
      const ax = Math.abs(localNormal.x);
      const ay = Math.abs(localNormal.y);
      const az = Math.abs(localNormal.z);
      const dominant = ay >= ax && ay >= az ? 'y' : ax >= az ? 'x' : 'z';
      const plane = AXES.filter((axis) => axis !== dominant);
      let uAxis = plane[0] ?? 'x';
      let vAxis = plane[1] ?? 'z';
      if (options.grain !== undefined && options.grain === vAxis) [uAxis, vAxis] = [vAxis, uAxis];
      const color =
        options.topColor && worldNormal.y > 0.9
          ? options.topColor
          : options.bottomColor && worldNormal.y < -0.3
            ? options.bottomColor
            : options.color;
      for (let k = 0; k < 3; k += 1) {
        const v = p[k as 0 | 1 | 2];
        const q = w[k as 0 | 1 | 2];
        this.positions.push(q.x, q.y, q.z);
        partBox.expandByPoint(q);
        if (centre) {
          roundNormal.subVectors(q, centre).normalize();
          this.normals.push(roundNormal.x, roundNormal.y, roundNormal.z);
        } else {
          this.normals.push(worldNormal.x, worldNormal.y, worldNormal.z);
        }
        this.colors.push(color[0], color[1], color[2]);
        this.uvs.push(v[uAxis] / TILE_METRES + offsetU, v[vAxis] / TILE_METRES + offsetV);
        // Deuxième valeur: l'objet (posée à sa fermeture). Quatrième: le morceau; deux planches
        // d'un plancher sont séparées par un trait fin même si elles sont dans le même plan.
        this.metas.push(options.layer ?? LAYER.plain, 0, options.glow ?? GLOW.none, 0);
        this.feet.push(this.foot);
      }
    }
    // Numéros de morceau de 1 à 62: le 63 est réservé à la peau lisse des personnages.
    const partCode = (seed % 62) + 1 + 64 * sizeClass(partBox.getSize(edgeA).length());
    for (let i = partStart; i < this.positions.length / 3; i += 1) this.metas[i * 4 + 3] = partCode;
    if (geometry !== source) geometry.dispose();
    source.dispose();
  }

  box(w: number, h: number, d: number, matrix: THREE.Matrix4, options: PartOptions): void {
    this.add(new THREE.BoxGeometry(w, h, d), matrix, options);
  }

  /** Fût à pans, d'axe y, centré: `top` et `bottom` sont les rayons. */
  cyl(
    top: number,
    bottom: number,
    h: number,
    sides: number,
    matrix: THREE.Matrix4,
    options: PartOptions,
  ): void {
    this.add(new THREE.CylinderGeometry(top, bottom, h, sides, 1), matrix, options);
  }

  /** Galet à facettes (icosaèdre étiré): feuillages, têtes, sacs. */
  blob(
    rx: number,
    ry: number,
    rz: number,
    matrix: THREE.Matrix4,
    options: PartOptions,
    detail = 1,
  ): void {
    const geometry = new THREE.IcosahedronGeometry(1, detail);
    geometry.scale(rx, ry, rz);
    this.add(geometry, matrix, options);
  }

  /** Polygone convexe du plan xy (sens trigonométrique), épais de `depth` le long de z, centré. */
  prism(
    points: readonly (readonly [number, number])[],
    depth: number,
    matrix: THREE.Matrix4,
    options: PartOptions,
  ): void {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geometry.translate(0, 0, -depth / 2);
    this.add(geometry, matrix, options);
  }

  /** Membre: fût effilé tendu entre deux points du repère courant. */
  limb(
    from: THREE.Vector3,
    to: THREE.Vector3,
    radiusFrom: number,
    radiusTo: number,
    sides: number,
    options: PartOptions,
  ): void {
    const axis = new THREE.Vector3().subVectors(to, from);
    const length = axis.length();
    if (length < 1e-5) return;
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()),
      new THREE.Vector3(1, 1, 1),
    );
    this.add(new THREE.CylinderGeometry(radiusTo, radiusFrom, length, sides, 1), matrix, {
      grain: 'y',
      ...options,
    });
  }

  build(): THREE.BufferGeometry {
    this.closeObject();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('aMeta', new THREE.Float32BufferAttribute(this.metas, 4));
    geometry.setAttribute('aFoot', new THREE.Float32BufferAttribute(this.feet, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }
}
