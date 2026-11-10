/**
 * Fabrique de géométries fusionnées à couleurs de sommets (sol d'une tuile, murs, toits) et
 * maillage fusionné dont on peut effacer une partie (un bâtiment) sans rien recréer: les parties
 * pleines se dessinent par groupes, la partie effacée par une copie transparente qui partage la
 * géométrie. Un appel de dessin tant que rien ne s'efface.
 */
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  type Material,
  Uint32BufferAttribute,
} from 'three';
import type { BoxItem } from './terrain-rendu';

const scratch = new Color();

export class GeometryBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];
  /** Parties nommées: début et nombre d'index. */
  readonly ranges = new Map<string, { start: number; count: number }>();
  private open: { id: string; start: number } | null = null;

  get indexCount(): number {
    return this.indices.length;
  }

  begin(id: string): void {
    this.open = { id, start: this.indices.length };
  }

  end(): void {
    if (this.open === null) return;
    const count = this.indices.length - this.open.start;
    if (count > 0) this.ranges.set(this.open.id, { start: this.open.start, count });
    this.open = null;
  }

  /** Quadrilatère (quatre coins dans l'ordre trigonométrique vu de la face), une couleur par coin. */
  quad(
    corners: readonly (readonly [number, number, number])[],
    normal: readonly [number, number, number],
    colors: readonly Color[],
  ): void {
    const start = this.positions.length / 3;
    corners.forEach((corner, k) => {
      this.positions.push(corner[0], corner[1], corner[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      const color = colors[k] ?? colors[0] ?? scratch.set('#ffffff');
      this.colors.push(color.r, color.g, color.b);
    });
    this.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }

  triangle(
    corners: readonly (readonly [number, number, number])[],
    normal: readonly [number, number, number],
    color: Color,
  ): void {
    const start = this.positions.length / 3;
    for (const corner of corners) {
      this.positions.push(corner[0], corner[1], corner[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.colors.push(color.r, color.g, color.b);
    }
    this.indices.push(start, start + 1, start + 2);
  }

  /** Boîte (centre au sol x, z; bas `base`), tournée de `yaw` autour de Y; sans face du dessous. */
  box(item: BoxItem, color?: Color): void {
    const c = color ?? scratch.set(item.color);
    const cos = Math.cos(item.yaw);
    const sin = Math.sin(item.yaw);
    const hw = item.w / 2;
    const hd = item.d / 2;
    const y0 = item.base;
    const y1 = item.base + item.h;
    // Coin local (u le long de w, v le long de d) vers le monde: rotation de lacet (Y vers le haut).
    const at = (u: number, v: number, y: number): [number, number, number] => [
      item.x + u * cos + v * sin,
      y,
      item.z - u * sin + v * cos,
    ];
    const n = (u: number, v: number): [number, number, number] => [
      u * cos + v * sin,
      0,
      -u * sin + v * cos,
    ];
    const cs = [c];
    this.quad([at(-hw, -hd, y1), at(-hw, hd, y1), at(hw, hd, y1), at(hw, -hd, y1)], [0, 1, 0], cs);
    this.quad([at(-hw, hd, y1), at(-hw, hd, y0), at(hw, hd, y0), at(hw, hd, y1)], n(0, 1), cs);
    this.quad([at(hw, -hd, y1), at(hw, -hd, y0), at(-hw, -hd, y0), at(-hw, -hd, y1)], n(0, -1), cs);
    this.quad([at(hw, hd, y1), at(hw, hd, y0), at(hw, -hd, y0), at(hw, -hd, y1)], n(1, 0), cs);
    this.quad([at(-hw, -hd, y1), at(-hw, -hd, y0), at(-hw, hd, y0), at(-hw, hd, y1)], n(-1, 0), cs);
  }

  /** Toit à deux pans: faîtage le long de X (`alongX`) ou de Z, pignons compris. */
  gable(roof: {
    cx: number;
    cz: number;
    w: number;
    d: number;
    base: number;
    ridge: number;
    alongX: boolean;
    color: string;
  }): void {
    const c = scratch.set(roof.color);
    const cs = [c];
    const top = roof.base + roof.ridge;
    const y = roof.base;
    const { cx, cz } = roof;
    if (roof.alongX) {
      const hx = roof.w / 2;
      const hz = roof.d / 2;
      const len = Math.hypot(hz, roof.ridge);
      const ny = hz / len;
      const nz = roof.ridge / len;
      this.quad(
        [
          [cx - hx, top, cz],
          [cx - hx, y, cz + hz],
          [cx + hx, y, cz + hz],
          [cx + hx, top, cz],
        ],
        [0, ny, nz],
        cs,
      );
      this.quad(
        [
          [cx + hx, top, cz],
          [cx + hx, y, cz - hz],
          [cx - hx, y, cz - hz],
          [cx - hx, top, cz],
        ],
        [0, ny, -nz],
        cs,
      );
      const g = hx - 0.3;
      this.triangle(
        [
          [cx + g, y, cz + hz - 0.3],
          [cx + g, y, cz - hz + 0.3],
          [cx + g, top - 0.05, cz],
        ],
        [1, 0, 0],
        c,
      );
      this.triangle(
        [
          [cx - g, y, cz - hz + 0.3],
          [cx - g, y, cz + hz - 0.3],
          [cx - g, top - 0.05, cz],
        ],
        [-1, 0, 0],
        c,
      );
    } else {
      const hx = roof.w / 2;
      const hz = roof.d / 2;
      const len = Math.hypot(hx, roof.ridge);
      const ny = hx / len;
      const nx = roof.ridge / len;
      this.quad(
        [
          [cx, top, cz + hz],
          [cx + hx, y, cz + hz],
          [cx + hx, y, cz - hz],
          [cx, top, cz - hz],
        ],
        [nx, ny, 0],
        cs,
      );
      this.quad(
        [
          [cx, top, cz - hz],
          [cx - hx, y, cz - hz],
          [cx - hx, y, cz + hz],
          [cx, top, cz + hz],
        ],
        [-nx, ny, 0],
        cs,
      );
      const g = hz - 0.3;
      this.triangle(
        [
          [cx - hx + 0.3, y, cz + g],
          [cx + hx - 0.3, y, cz + g],
          [cx, top - 0.05, cz + g],
        ],
        [0, 0, 1],
        c,
      );
      this.triangle(
        [
          [cx + hx - 0.3, y, cz - g],
          [cx - hx + 0.3, y, cz - g],
          [cx, top - 0.05, cz - g],
        ],
        [0, 0, -1],
        c,
      );
    }
  }

  /** Géométrie finale, `null` si vide. L'appelant la suit et la libère. */
  build(): BufferGeometry | null {
    if (this.indices.length === 0) return null;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(new Uint32BufferAttribute(this.indices, 1));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }
}

/**
 * Maillage fusionné dont chaque partie nommée peut s'effacer en fondu. Le maillage principal
 * dessine par groupes tout ce qui est plein; chaque partie effacée a sa copie transparente.
 */
export class FadingMesh {
  readonly mesh: Mesh;
  private readonly faded = new Map<string, { mesh: Mesh; material: Material }>();
  private readonly total: number;

  constructor(
    readonly geometry: BufferGeometry,
    private readonly material: Material,
    private readonly ranges: ReadonlyMap<string, { start: number; count: number }>,
  ) {
    this.total = geometry.index?.count ?? 0;
    this.mesh = new Mesh(geometry, [material]);
    this.regroup();
  }

  has(id: string): boolean {
    return this.ranges.has(id);
  }

  /** Opacité d'une partie (1: pleine). */
  setOpacity(id: string, opacity: number): void {
    const range = this.ranges.get(id);
    if (range === undefined) return;
    const current = this.faded.get(id);
    if (opacity >= 1) {
      if (current === undefined) return;
      current.mesh.removeFromParent();
      current.material.dispose();
      this.faded.delete(id);
      this.regroup();
      return;
    }
    if (current !== undefined) {
      (current.material as Material & { opacity: number }).opacity = opacity;
      return;
    }
    const material = this.material.clone();
    material.transparent = true;
    material.depthWrite = false;
    material.opacity = opacity;
    const mesh = new Mesh(this.geometry, material);
    // La copie ne dessine que sa partie: une géométrie partagée, une plage d'index à elle, le
    // temps de son appel (passe principale et passe d'ombre).
    const narrow = (): void => {
      this.geometry.setDrawRange(range.start, range.count);
    };
    const widen = (): void => {
      this.geometry.setDrawRange(0, Infinity);
    };
    mesh.onBeforeRender = narrow;
    mesh.onAfterRender = widen;
    mesh.onBeforeShadow = narrow;
    mesh.onAfterShadow = widen;
    mesh.castShadow = this.mesh.castShadow;
    mesh.receiveShadow = true;
    mesh.name = `${this.mesh.name}-fondu`;
    this.mesh.parent?.add(mesh);
    this.faded.set(id, { mesh, material });
    this.regroup();
  }

  /** Groupes du maillage principal: tout l'index sauf les parties effacées. */
  private regroup(): void {
    const geometry = this.geometry;
    geometry.clearGroups();
    const holes = [...this.faded.keys()]
      .map((id) => this.ranges.get(id))
      .filter((r): r is { start: number; count: number } => r !== undefined)
      .sort((a, b) => a.start - b.start);
    let at = 0;
    for (const hole of holes) {
      if (hole.start > at) geometry.addGroup(at, hole.start - at, 0);
      at = Math.max(at, hole.start + hole.count);
    }
    if (at < this.total) geometry.addGroup(at, this.total - at, 0);
  }

  get fadedCount(): number {
    return this.faded.size;
  }

  dispose(): void {
    for (const { mesh, material } of this.faded.values()) {
      mesh.removeFromParent();
      material.dispose();
    }
    this.faded.clear();
    this.mesh.removeFromParent();
  }
}
