/**
 * Les géométries d'une pièce (rendu encré, ADR 0023), tirées de son plan (`pieces.ts`) et de son
 * style: le relief vient d'abord de la géométrie (lames et carreaux posés un à un, lambris de
 * planches, plinthes, embrasures, huisseries), le nuanceur n'y ajoute que la matière et la
 * lumière. Chaque mur existe en deux formes: entière (mur du fond: enduit, lambris, pan de bois,
 * fenêtres, appliques) et coupée (mur du devant: un soubassement bas à tranche pleine).
 * `grand-lieu.ts` montre l'une ou l'autre selon la caméra. Une coque jamais dessinée (plafond et
 * murs pleins percés des seules fenêtres) porte l'ombre: le soleil n'entre que par les fenêtres.
 * Tout est en boîtes droites, dans le repère du lieu.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Uint32BufferAttribute } from 'three';
import { inkCode, KIND, LAYER, type LayerName, SWAP, TILE_METRES } from '../encre/couches';
import {
  type RoomOpening,
  type RoomPlan,
  type RoomSide,
  type RoomWallPlan,
  wallPoint,
} from './pieces';
import { ROOM_SETTINGS, type RoomSettings } from './reglages-pieces';

type Axis = 'x' | 'y' | 'z';

interface BoxLook {
  readonly layer?: number;
  /** Nature de la face (`KIND`): vitre, flamme. */
  readonly kind?: number;
  /** Teinte des faces du dessus (tranche d'un mur coupé). */
  readonly top?: Color;
  /** Axe du fil du bois ou des rangs de la couche de traits. */
  readonly grain?: Axis;
  /** Garde le morceau en cours: aucun trait entre cette boîte et la précédente. */
  readonly joined?: boolean;
  /** Classe de taille imposée au morceau (3: trait le plus fin, visible de près seulement). */
  readonly rank?: number;
}

/** Nombre pseudo-aléatoire stable (0 à 1) tiré d'une graine. */
function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Fabrique de boîtes droites à couleurs de sommets, avec l'attribut `aInk` du matériau encré. */
class Carver {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly inks: number[] = [];
  private readonly indices: number[] = [];
  private pieceCode = 0;
  private partCode = 0;
  private parts = 0;

  /** `pieceStart`: premier numéro de pièce de contour (deux maillages voisins ne le partagent pas). */
  constructor(private pieces: number) {}

  /** Ouvre une pièce de contour: sa classe de taille vient de `diagonal` (m). */
  piece(diagonal: number): void {
    this.pieceCode = inkCode(this.pieces++, diagonal);
  }

  private quad(
    corners: readonly (readonly [number, number, number])[],
    normal: readonly [number, number, number],
    color: Color,
    layer: number,
    kind: number,
  ): void {
    const start = this.positions.length / 3;
    for (const corner of corners) {
      this.positions.push(corner[0], corner[1], corner[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.colors.push(color.r, color.g, color.b);
      this.inks.push(layer, this.pieceCode, kind, this.partCode);
    }
    this.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }

  /** Boîte droite entre deux coins, sans face du dessous. */
  box(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    color: Color,
    look: BoxLook = {},
  ): void {
    if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return;
    if (look.joined !== true) {
      const code = inkCode(this.parts++, Math.hypot(x1 - x0, y1 - y0, z1 - z0));
      this.partCode = look.rank === undefined ? code : (code % 64) + 64 * look.rank;
    }
    const layer = look.layer ?? LAYER.plain;
    const kind = look.kind ?? KIND.none;
    // Le nuanceur projette la couche de traits selon la face: dessus (x, z), face est ou ouest
    // (z, y), face nord ou sud (x, y), traits le long du premier axe. `SWAP` les tourne.
    const swap = (first: Axis, second: Axis): number =>
      look.grain !== undefined && look.grain === second && look.grain !== first
        ? kind + SWAP
        : kind;
    const top = look.top ?? color;
    this.quad(
      [
        [x0, y1, z0],
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
      ],
      [0, 1, 0],
      top,
      layer,
      swap('x', 'z'),
    );
    this.quad(
      [
        [x0, y1, z1],
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
      ],
      [0, 0, 1],
      color,
      layer,
      swap('x', 'y'),
    );
    this.quad(
      [
        [x1, y1, z0],
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
      ],
      [0, 0, -1],
      color,
      layer,
      swap('x', 'y'),
    );
    this.quad(
      [
        [x1, y1, z1],
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
      ],
      [1, 0, 0],
      color,
      layer,
      swap('z', 'y'),
    );
    this.quad(
      [
        [x0, y1, z0],
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
      ],
      [-1, 0, 0],
      color,
      layer,
      swap('z', 'y'),
    );
  }

  /** Quadrilatère à plat (y constant), une teinte par coin: la nappe du fond. */
  flat(corners: readonly (readonly [number, number])[], y: number, colors: readonly Color[]): void {
    const start = this.positions.length / 3;
    corners.forEach((corner, i) => {
      const color = colors[i] ?? colors[0] ?? new Color();
      this.positions.push(corner[0], y, corner[1]);
      this.normals.push(0, 1, 0);
      this.colors.push(color.r, color.g, color.b);
      this.inks.push(LAYER.plain, 0, KIND.none, 0);
    });
    this.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }

  get triangles(): number {
    return this.indices.length / 3;
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('aInk', new Float32BufferAttribute(this.inks, 4));
    geometry.setIndex(new Uint32BufferAttribute(this.indices, 1));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }
}

const layerOf = (name: LayerName): number => LAYER[name];

/** Pas des lames d'un plancher (m): celui des planches de la couche de traits `wood` (16 par carreau). */
const PLANK_PITCH = TILE_METRES / 16;

/** Boîte donnée dans le repère d'un mur: `u` le long, `y` en hauteur, `v` vers le dehors. */
function wallBox(
  c: Carver,
  plan: RoomPlan,
  side: RoomSide,
  u0: number,
  u1: number,
  y0: number,
  y1: number,
  v0: number,
  v1: number,
  color: Color,
  look: BoxLook & { readonly along?: boolean } = {},
): void {
  const a = wallPoint(plan, side, u0, v0);
  const b = wallPoint(plan, side, u1, v1);
  const alongX = side === 'nord' || side === 'sud';
  // `along`: le fil suit le mur; sinon `grain` est donné dans le repère du lieu (`y`: debout).
  const grain = look.along === true ? (alongX ? 'x' : 'z') : look.grain;
  c.box(
    Math.min(a.x, b.x),
    y0,
    Math.min(a.z, b.z),
    Math.max(a.x, b.x),
    y1,
    Math.max(a.z, b.z),
    color,
    grain === undefined ? look : { ...look, grain },
  );
}

/** Étendue d'un mur le long de `u`: les murs nord et sud portent les angles. */
function wallReach(plan: RoomPlan, wall: RoomWallPlan): readonly [number, number] {
  const corners = wall.side === 'nord' || wall.side === 'sud';
  return corners ? [-plan.thickness, wall.length + plan.thickness] : [0, wall.length];
}

/** Pans pleins d'un mur entre ses vides, sous `top`: [u0, u1, y0, y1]. */
function solids(
  from: number,
  to: number,
  top: number,
  openings: readonly RoomOpening[],
): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  let cursor = from;
  for (const o of openings) {
    if (o.y0 >= top) continue;
    if (o.u0 > cursor) out.push([cursor, o.u0, 0, top]);
    if (o.y0 > 0) out.push([o.u0, o.u1, 0, Math.min(o.y0, top)]);
    if (o.y1 < top) out.push([o.u0, o.u1, o.y1, top]);
    cursor = Math.max(cursor, o.u1);
  }
  if (cursor < to) out.push([cursor, to, 0, top]);
  return out;
}

/** Mur coupé (mur du devant): soubassement bas, tranche pleine, pierre de seuil aux portes. */
function stubWall(plan: RoomPlan, wall: RoomWallPlan, index: number): BufferGeometry {
  const st = plan.style;
  const t = plan.thickness;
  const c = new Carver(10 + index * 7);
  const [from, to] = wallReach(plan, wall);
  c.piece(Math.hypot(to - from, st.cut + st.footing.drop, t));
  const stone = new Color(st.footing.color);
  const cap = new Color(st.capColor);
  const doors = wall.openings.filter((o) => o.kind === 'door');
  let first = true;
  for (const [u0, u1, y0, y1] of solids(from, to, st.cut, doors)) {
    wallBox(c, plan, wall.side, u0, u1, y0 - st.footing.drop, y1, 0, t, stone, {
      layer: layerOf(st.footing.layer),
      top: cap,
      joined: !first,
    });
    first = false;
  }
  // Pierre de seuil: elle porte la porte et ferme le plancher au droit du vide.
  for (const door of doors)
    wallBox(c, plan, wall.side, door.u0, door.u1, -st.footing.drop, 0.012, 0, t + 0.06, stone, {
      layer: LAYER.face,
      rank: 2,
    });
  return c.build();
}

/** Fenêtre: dormant, petits bois, vitre, tablette d'appui, rideaux sur leur tringle. */
function windowUnit(
  c: Carver,
  plan: RoomPlan,
  wall: RoomWallPlan,
  o: RoomOpening,
  index: number,
  settings: RoomSettings,
): void {
  const st = plan.style;
  const ws = settings.window;
  const t = plan.thickness;
  const side = wall.side;
  const frame = new Color(st.windows.frameColor);
  const width = o.u1 - o.u0;
  const height = o.y1 - o.y0;
  c.piece(Math.hypot(width, height));
  // La menuiserie est posée au nu extérieur: l'embrasure se voit de la pièce sur 20 cm.
  const v0 = t - 0.11;
  const v1 = t - 0.05;
  const f = ws.frame;
  const wood = { layer: LAYER.plain, rank: 2 } as const;
  wallBox(c, plan, side, o.u0, o.u0 + f, o.y0, o.y1, v0, v1, frame, wood);
  wallBox(c, plan, side, o.u1 - f, o.u1, o.y0, o.y1, v0, v1, frame, { ...wood, joined: true });
  wallBox(c, plan, side, o.u0 + f, o.u1 - f, o.y0, o.y0 + f, v0, v1, frame, {
    ...wood,
    joined: true,
  });
  wallBox(c, plan, side, o.u0 + f, o.u1 - f, o.y1 - f, o.y1, v0, v1, frame, {
    ...wood,
    joined: true,
  });
  const mid = (o.u0 + o.u1) / 2;
  const cross = o.y0 + height * 0.55;
  const b = ws.bar / 2;
  wallBox(c, plan, side, mid - b, mid + b, o.y0 + f, o.y1 - f, v0 + 0.01, v1 - 0.01, frame, {
    ...wood,
    joined: true,
  });
  wallBox(c, plan, side, o.u0 + f, o.u1 - f, cross - b, cross + b, v0 + 0.01, v1 - 0.01, frame, {
    ...wood,
    joined: true,
  });
  wallBox(
    c,
    plan,
    side,
    o.u0 + f,
    o.u1 - f,
    o.y0 + f,
    o.y1 - f,
    v0 + 0.025,
    v0 + 0.04,
    new Color(st.windows.glassColor),
    {
      kind: KIND.window,
      rank: 3,
    },
  );
  // Tablette: une planche qui déborde dans la pièce, sous l'embrasure.
  wallBox(c, plan, side, o.u0 - 0.05, o.u1 + 0.05, o.y0 - ws.ledge, o.y0, -ws.ledgeOut, v0, frame, {
    layer: LAYER.grain,
    along: true,
    rank: 2,
  });
  const curtains = st.windows.curtains;
  if (curtains === null || curtains.length === 0) return;
  const cloth = new Color(curtains[index % curtains.length] ?? '#ffffff');
  const rod = new Color(st.plinth.color);
  const out = ws.curtainOut;
  const top = Math.min(o.y1 + 0.1, st.height - 0.22);
  c.piece(height);
  wallBox(
    c,
    plan,
    side,
    o.u0 - out - 0.04,
    o.u1 + out + 0.04,
    top,
    top + 0.03,
    -0.085,
    -0.055,
    rod,
    { rank: 3 },
  );
  for (const [a, e] of [
    [o.u0 - out, o.u0 - out + ws.curtainWidth],
    [o.u1 + out - ws.curtainWidth, o.u1 + out],
  ] as const) {
    // Deux plis par pan: le tissu n'est pas une planche.
    const half = (a + e) / 2;
    wallBox(c, plan, side, a, half, o.y0 - 0.16, top, -ws.curtainDepth - 0.035, -0.035, cloth, {
      rank: 3,
    });
    wallBox(c, plan, side, half, e, o.y0 - 0.16, top, -ws.curtainDepth - 0.015, -0.015, cloth, {
      rank: 3,
    });
  }
}

/** Mur entier (mur du fond): enduit, plinthe, lambris, pan de bois, fenêtres, appliques. */
function fullWall(
  plan: RoomPlan,
  wall: RoomWallPlan,
  index: number,
  settings: RoomSettings,
): BufferGeometry {
  const st = plan.style;
  const t = plan.thickness;
  const side = wall.side;
  const c = new Carver(10 + index * 7);
  const [from, to] = wallReach(plan, wall);
  const h = st.height;
  c.piece(Math.hypot(to - from, h, t));
  const plaster = new Color(st.wall.color);
  const cap = new Color(st.capColor);
  const stone = new Color(st.footing.color);
  const pans = solids(from, to, h, wall.openings);
  pans.forEach(([u0, u1, y0, y1], i) => {
    wallBox(c, plan, side, u0, u1, y0, y1, 0, t, plaster, {
      layer: layerOf(st.wall.layer),
      top: y1 >= h - 1e-3 ? cap : plaster,
      joined: i > 0,
    });
  });
  for (const door of wall.openings)
    if (door.kind === 'door')
      wallBox(c, plan, side, door.u0, door.u1, -st.footing.drop, 0.012, 0, t, stone, {
        layer: LAYER.face,
        rank: 2,
      });

  // Les bouts du mur: à l'encre comme sa tranche. On les voit quand le mur voisin est coupé
  // (c'est la coupe du bâtiment), jamais quand il est entier (ils sont dans son épaisseur).
  for (const [a, b] of [
    [from - 0.012, from],
    [to, to + 0.012],
  ] as const)
    wallBox(c, plan, side, a, b, st.cut, h, 0, t, cap, { joined: true });

  // Le dedans du mur ne s'habille que sur le nu intérieur (`u` de 0 à la longueur).
  const inner = solids(0, wall.length, h, wall.openings).filter(([, , y0]) => y0 === 0);
  const plinth = new Color(st.plinth.color);
  const dado = st.wainscot;
  const low = dado === null ? st.plinth.height : dado.height;
  for (const [u0, u1, , y1] of inner) {
    wallBox(c, plan, side, u0, u1, 0, Math.min(st.plinth.height, y1), -st.plinth.out, 0, plinth, {
      layer: LAYER.grain,
      along: true,
      rank: 2,
    });
    if (dado === null) continue;
    // Lambris: des planches debout, chacune un peu plus ou moins enfoncée et teintée.
    const top = Math.min(dado.height, y1);
    const count = Math.max(1, Math.round((u1 - u0) / dado.board));
    const step = (u1 - u0) / count;
    const base = new Color(dado.color);
    for (let i = 0; i < count; i += 1) {
      const seed = index * 131 + Math.round((u0 + i * step) * 97);
      const depth = 0.012 + rand(seed) * 0.008;
      const tone = base.clone().multiplyScalar(0.94 + rand(seed + 5) * 0.12);
      wallBox(
        c,
        plan,
        side,
        u0 + i * step + 0.003,
        u0 + (i + 1) * step - 0.003,
        st.plinth.height,
        top - 0.03,
        -depth,
        0,
        tone,
        {
          rank: 2,
        },
      );
    }
    if (top >= dado.height - 1e-3)
      wallBox(c, plan, side, u0, u1, top - 0.05, top, -0.04, 0, new Color(dado.railColor), {
        layer: LAYER.grain,
        along: true,
        rank: 2,
      });
  }
  if (st.timber !== null) {
    // Pan de bois: sablière sous le plafond, poteaux en saillie, jamais devant une ouverture.
    const timber = new Color(st.timber.color);
    c.piece(wall.length);
    wallBox(c, plan, side, 0, wall.length, h - 0.2, h - 0.04, -0.055, 0, timber, {
      layer: LAYER.grain,
      along: true,
      rank: 1,
    });
    const posts = Math.max(1, Math.round(wall.length / st.timber.every));
    for (let i = 0; i <= posts; i += 1) {
      const u = 0.09 + (i * (wall.length - 0.18)) / posts;
      if (wall.openings.some((o) => u > o.u0 - 0.22 && u < o.u1 + 0.22)) continue;
      if (wall.lamps.some((l) => Math.abs(l - u) < 0.3)) continue;
      wallBox(c, plan, side, u - 0.065, u + 0.065, low, h - 0.2, -0.04, 0, timber, {
        layer: LAYER.grain,
        grain: 'y',
        rank: 2,
      });
    }
  }
  wall.openings
    .filter((o) => o.kind === 'window')
    .forEach((o, i) => {
      windowUnit(c, plan, wall, o, index + i, settings);
    });
  if (st.lamps !== null) {
    const lm = settings.lamp;
    const iron = new Color(lm.ironColor);
    const y = st.lamps.height;
    for (const u of wall.lamps) {
      // Applique: platine au mur, bras, coupelle, et le globe (il luit quand les lampes s'allument).
      c.piece(0.3);
      wallBox(c, plan, side, u - 0.05, u + 0.05, y - 0.2, y + 0.02, -0.02, 0, iron, { rank: 3 });
      wallBox(c, plan, side, u - 0.015, u + 0.015, y - 0.16, y - 0.13, -lm.out, -0.02, iron, {
        rank: 3,
        joined: true,
      });
      wallBox(
        c,
        plan,
        side,
        u - 0.06,
        u + 0.06,
        y - 0.13,
        y - 0.1,
        -lm.out - 0.06,
        -lm.out + 0.06,
        iron,
        { rank: 3, joined: true },
      );
      wallBox(
        c,
        plan,
        side,
        u - 0.045,
        u + 0.045,
        y - 0.1,
        y + 0.06,
        -lm.out - 0.045,
        -lm.out + 0.045,
        new Color(lm.globeColor),
        {
          kind: KIND.flame,
          rank: 3,
        },
      );
    }
  }
  return c.build();
}

/** Plancher, carrelage ou dallage posé pièce par pièce, cloisons coupées et tapis. */
function floorGeometry(plan: RoomPlan, settings: RoomSettings): BufferGeometry {
  const st = plan.style;
  const f = st.floor;
  const { x0, z0, x1, z1 } = plan;
  const c = new Carver(1);
  c.piece(Math.hypot(x1 - x0, z1 - z0));
  const joint = new Color(f.jointColor);
  // Le fond des joints: une dalle sombre sous tout le sol, jusque sous les murs.
  c.box(x0 - 0.05, -st.footing.drop, z0 - 0.05, x1 + 0.05, -0.022, z1 + 0.05, joint);
  const tones = f.colors.map((color) => new Color(color));
  const tone = (seed: number): Color => tones[Math.floor(rand(seed) * tones.length)] ?? joint;
  const g = f.joint / 2;
  if (f.kind === 'carreaux') {
    // Damier calé sur le milieu de la pièce: les coupes sont les mêmes des deux côtés.
    const nx = Math.ceil((x1 - x0) / f.size / 2) * 2;
    const nz = Math.ceil((z1 - z0) / f.size / 2) * 2;
    const ox = (x0 + x1) / 2 - (nx * f.size) / 2;
    const oz = (z0 + z1) / 2 - (nz * f.size) / 2;
    for (let i = 0; i < nx; i += 1)
      for (let k = 0; k < nz; k += 1) {
        const ax = Math.max(x0, ox + i * f.size + g);
        const bx = Math.min(x1, ox + (i + 1) * f.size - g);
        const az = Math.max(z0, oz + k * f.size + g);
        const bz = Math.min(z1, oz + (k + 1) * f.size - g);
        const color = tones[(i + k) % tones.length] ?? joint;
        const shade = 0.96 + rand(i * 17 + k * 53) * 0.08;
        c.box(
          ax,
          -0.03,
          az,
          bx,
          -rand(i * 7 + k * 13) * 0.003,
          bz,
          color.clone().multiplyScalar(shade),
          {
            layer: LAYER.tile,
            rank: 2,
          },
        );
      }
  } else if (f.kind === 'lames') {
    // Lames le long du grand côté, au pas de la couche de traits `wood` et calées sur elle: le
    // joint dessiné tombe dans le joint creusé, les abouts, le fil et les noeuds sont les siens.
    const alongX = x1 - x0 >= z1 - z0;
    const from = alongX ? z0 : x0;
    const to = alongX ? z1 : x1;
    const first = Math.floor(from / PLANK_PITCH);
    for (let row = first; row * PLANK_PITCH < to - 1e-6; row += 1) {
      const a = Math.max(from, row * PLANK_PITCH + g);
      const b = Math.min(to, (row + 1) * PLANK_PITCH - g);
      const color = tone(row * 7 + 3)
        .clone()
        .multiplyScalar(0.94 + rand(row * 11 + 2) * 0.12);
      const top = -rand(row * 5 + 1) * 0.004;
      const look: BoxLook = {
        layer: LAYER.wood,
        grain: alongX ? 'x' : 'z',
        joined: row > first,
        rank: 2,
      };
      if (alongX) c.box(x0, -0.03, a, x1, top, b, color, look);
      else c.box(a, -0.03, z0, b, top, z1, color, look);
    }
  } else {
    // Dalles en rangs le long du grand côté; chacune a sa longueur, sa teinte, un rien de désaffleur.
    const alongX = x1 - x0 >= z1 - z0;
    const span = alongX ? x1 - x0 : z1 - z0;
    const across = alongX ? z1 - z0 : x1 - x0;
    let v = 0;
    let row = 0;
    while (v < across - 0.02) {
      const rest = across - v;
      const wanted = f.size * (0.8 + rand(row * 3.3) * 0.4);
      const width = rest - wanted < f.size * 0.4 ? rest : wanted;
      let u = 0;
      let k = 0;
      while (u < span - 0.02) {
        const seed = row * 29 + k * 5 + 1;
        const want = f.size * (0.9 + rand(seed) * 0.9);
        const length = span - u - want < f.size * 0.5 ? span - u : want;
        const a = alongX ? x0 + u + g : x0 + v + g;
        const b = alongX ? x0 + u + length - g : x0 + v + width - g;
        const d = alongX ? z0 + v + g : z0 + u + g;
        const e = alongX ? z0 + v + width - g : z0 + u + length - g;
        const color = tone(seed + 3)
          .clone()
          .multiplyScalar(0.94 + rand(seed + 2) * 0.12);
        c.box(a, -0.03, d, b, -rand(seed + 1) * 0.006, e, color, { layer: LAYER.tile, rank: 2 });
        u += length;
        k += 1;
      }
      v += width;
      row += 1;
    }
  }
  // Cloisons: des murs de refend coupés à la même hauteur que les murs du devant.
  const plaster = new Color(st.wall.color);
  const cap = new Color(st.capColor);
  const plinth = new Color(st.plinth.color);
  plan.partitions.forEach((p) => {
    c.piece(Math.hypot(p.x1 - p.x0, p.z1 - p.z0, st.cut));
    // Un mur mince montre sa tranche à l'encre; un massif (estrade, pile, souche) son dessus.
    const thin = Math.min(p.x1 - p.x0, p.z1 - p.z0) <= settings.partitionThickness + 0.05;
    c.box(p.x0, 0, p.z0, p.x1, st.cut, p.z1, plaster, {
      layer: layerOf(st.wall.layer),
      top: thin ? cap : cap.clone().lerp(plaster, 0.3),
    });
    const o = st.plinth.out;
    c.box(p.x0 - o, 0, p.z0 - o, p.x1 + o, st.plinth.height, p.z1 + o, plinth, {
      layer: LAYER.grain,
      rank: 2,
    });
  });
  // Tapis: une laine épaisse, un liseré clair, des franges aux deux bouts.
  const rug = settings.rug;
  for (const r of plan.rugs) {
    c.piece(Math.hypot(r.x1 - r.x0, r.z1 - r.z0));
    const edge = new Color(rug.borderColor);
    c.box(r.x0, 0, r.z0, r.x1, rug.height * 0.7, r.z1, edge, { rank: 2 });
    c.box(
      r.x0 + rug.border,
      0,
      r.z0 + rug.border,
      r.x1 - rug.border,
      rug.height,
      r.z1 - rug.border,
      new Color(r.color),
      {
        rank: 2,
      },
    );
    const inset = rug.border * 2.2;
    c.box(
      r.x0 + inset,
      0,
      r.z0 + inset,
      r.x1 - inset,
      rug.height + 0.004,
      r.z1 - inset,
      new Color(r.color).multiplyScalar(0.82),
      {
        rank: 3,
      },
    );
  }
  return c.build();
}

/**
 * Coque d'ombre: le plafond et les quatre murs à leur nu extérieur, percés des seules fenêtres
 * (croisillon compris: il se dessine dans la nappe de lumière). Les portes y sont pleines: elles
 * sont fermées.
 */
function shellGeometry(plan: RoomPlan, settings: RoomSettings): BufferGeometry {
  const st = plan.style;
  const t = plan.thickness;
  const sh = settings.shell;
  const c = new Carver(60);
  const any = new Color('#000000');
  const top = st.height + sh.roof;
  c.box(
    plan.x0 - t - 0.2,
    st.height + 0.02,
    plan.z0 - t - 0.2,
    plan.x1 + t + 0.2,
    top,
    plan.z1 + t + 0.2,
    any,
  );
  for (const wall of plan.walls) {
    const [from, to] = wallReach(plan, wall);
    const windows = wall.openings.filter((o) => o.kind === 'window');
    for (const [u0, u1, y0, y1] of solids(from, to, top, windows))
      wallBox(
        c,
        plan,
        wall.side,
        u0,
        u1,
        y0 === 0 ? -st.footing.drop : y0,
        y1,
        t - sh.thickness,
        t,
        any,
        {
          joined: true,
        },
      );
    for (const o of windows) {
      const mid = (o.u0 + o.u1) / 2;
      const cross = o.y0 + (o.y1 - o.y0) * 0.55;
      const b = settings.window.bar * 0.8;
      wallBox(c, plan, wall.side, mid - b, mid + b, o.y0, o.y1, t - sh.thickness, t, any, {
        joined: true,
      });
      wallBox(c, plan, wall.side, o.u0, o.u1, cross - b, cross + b, t - sh.thickness, t, any, {
        joined: true,
      });
    }
  }
  return c.build();
}

/**
 * Nappe du fond: sombre et chaude partout, plus claire au pied des murs. Teintes d'écran (sRGB)
 * écrites telles quelles dans la couleur des sommets: son matériau ne les convertit pas.
 */
function backdropGeometry(plan: RoomPlan, settings: RoomSettings): BufferGeometry {
  const b = settings.backdrop;
  const c = new Carver(0);
  const screen = (hex: string): Color => {
    const value = Number.parseInt(hex.slice(1), 16);
    return new Color().setRGB(
      ((value >> 16) & 255) / 255,
      ((value >> 8) & 255) / 255,
      (value & 255) / 255,
    );
  };
  const far = screen(b.color);
  const near = screen(b.haloColor);
  const y = -plan.style.footing.drop;
  const t = plan.thickness;
  const ax = plan.x0 - t;
  const az = plan.z0 - t;
  const bx = plan.x1 + t;
  const bz = plan.z1 + t;
  // Trois anneaux: la pièce (clair), le halo (du clair au sombre), le lointain (sombre).
  const ring = (grow0: number, grow1: number, c0: Color, c1: Color): void => {
    const i = [ax - grow0, az - grow0, bx + grow0, bz + grow0] as const;
    const o = [ax - grow1, az - grow1, bx + grow1, bz + grow1] as const;
    c.flat(
      [
        [o[0], o[1]],
        [i[0], i[1]],
        [i[2], i[1]],
        [o[2], o[1]],
      ],
      y,
      [c1, c0, c0, c1],
    );
    c.flat(
      [
        [i[0], i[3]],
        [o[0], o[3]],
        [o[2], o[3]],
        [i[2], i[3]],
      ],
      y,
      [c0, c1, c1, c0],
    );
    c.flat(
      [
        [o[0], o[1]],
        [o[0], o[3]],
        [i[0], i[3]],
        [i[0], i[1]],
      ],
      y,
      [c1, c1, c0, c0],
    );
    c.flat(
      [
        [i[2], i[1]],
        [i[2], i[3]],
        [o[2], o[3]],
        [o[2], o[1]],
      ],
      y,
      [c0, c0, c1, c1],
    );
  };
  c.flat(
    [
      [ax, az],
      [ax, bz],
      [bx, bz],
      [bx, az],
    ],
    y,
    [near],
  );
  ring(0, b.halo, near, far);
  ring(b.halo, b.reach, far, far);
  return c.build();
}

export interface RoomWallGeometry {
  readonly side: RoomSide;
  readonly nx: number;
  readonly nz: number;
  readonly full: BufferGeometry;
  readonly stub: BufferGeometry;
}

export interface RoomGeometry {
  readonly floor: BufferGeometry;
  readonly walls: readonly RoomWallGeometry[];
  readonly shell: BufferGeometry;
  readonly backdrop: BufferGeometry;
}

/** Toutes les géométries d'une pièce; l'appelant les suit et les libère avec le lieu. */
export function buildRoom(plan: RoomPlan, settings: RoomSettings = ROOM_SETTINGS): RoomGeometry {
  return {
    floor: floorGeometry(plan, settings),
    walls: plan.walls.map((wall, index) => ({
      side: wall.side,
      nx: wall.nx,
      nz: wall.nz,
      full: fullWall(plan, wall, index, settings),
      stub: stubWall(plan, wall, index),
    })),
    shell: shellGeometry(plan, settings),
    backdrop: backdropGeometry(plan, settings),
  };
}
