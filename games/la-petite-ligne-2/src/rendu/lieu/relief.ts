/**
 * Relief du sol d'un grand lieu: la hauteur affichée de chaque point, tirée des données du lieu
 * (nature de chaque case, emprises des bâtiments, portes, voies) et des profils de
 * `reglages-relief.ts`. Logique pure et déterministe, sans Three.js ni hasard: l'hôte et l'invité
 * voient le même sol. La simulation ne lit rien d'ici (elle reste en 2D): seuls le maillage du
 * sol et ce qui se pose dessus (pieds, objets, semis, ombres de contact) suivent cette hauteur.
 *
 * Principe. Un sol `rigide` est plan, à son niveau; son bord est une marche. Un sol `souple`
 * part de son niveau et de ses bosses, se raccorde en pente douce aux autres sols souples à
 * moins de `spread`, reçoit le bourrelet ou le fossé (`rim`) des natures voisines, remonte contre
 * les sols rigides qui le demandent (`apron`) et se met à niveau dans les emprises (`flats`).
 * Chaque terme est continu d'une case souple à l'autre: aucune fente dans le maillage.
 */
import type { MapDef } from '../../donnees/schemas/lieu';
import type { GroundLook } from './reglages-tuiles';
import {
  type KerbProfile,
  type PavingProfile,
  RELIEF_SETTINGS,
  type ReliefProfile,
  type ReliefSettings,
} from './reglages-relief';
import { type GroundField, hash01, railSegments } from './terrain-rendu';

export type ReliefMap = Pick<
  MapDef,
  'width' | 'height' | 'buildings' | 'doors' | 'rails' | 'graph'
>;

/** Côté d'une case: nord (y moins), sud, ouest (x moins), est. */
export const SIDES = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
] as const;
export type SideIndex = 0 | 1 | 2 | 3;
const OPPOSITE: readonly SideIndex[] = [1, 0, 3, 2];

const RIGID = 0;
const PLAIN = 1;
const SHAPED = 2;

/** Emprise tenue à niveau: un segment (ou un point), plat jusqu'à `radius`, raccordé sur `fade`. */
interface Flat {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly level: number;
  readonly radius: number;
  readonly fade: number;
}

/** Une dalle posée: son pied (rectangle), la hauteur de ses quatre coins, sa teinte (part). */
export interface Slab {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
  /** Coins dans l'ordre (x0, z0), (x0, z1), (x1, z1), (x1, z0). */
  readonly tops: readonly [number, number, number, number];
  readonly bottom: number;
  readonly tone: number;
}

function smooth01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** Bruit de valeurs lisse sur une grille de `span` m, de -1 à 1. */
function valueNoise(x: number, y: number, span: number, salt: number): number {
  const gx = x / span;
  const gy = y / span;
  const fx = Math.floor(gx);
  const fy = Math.floor(gy);
  const sx = smooth01(gx - fx);
  const sy = smooth01(gy - fy);
  const a = hash01(fx, fy, salt);
  const b = hash01(fx + 1, fy, salt);
  const c = hash01(fx, fy + 1, salt);
  const d = hash01(fx + 1, fy + 1, salt);
  return (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * 2 - 1;
}

function check(name: string, profile: ReliefProfile): void {
  const fail = (what: string): never => {
    throw new Error(`profil de relief « ${name} »: ${what}`);
  };
  if (!Number.isFinite(profile.level) || Math.abs(profile.level) > 2) fail('niveau hors bornes');
  const within = (value: number | undefined, label: string): void => {
    if (value !== undefined && !(value > 0 && value <= 1)) fail(`${label} hors de ]0, 1]`);
  };
  within(profile.spread, 'spread');
  within(profile.rim?.width, 'rim.width');
  within(profile.apron, 'apron');
  if (profile.edge === 'souple' && (profile.paving !== undefined || profile.kerb !== undefined))
    fail('dalles et bordures demandent un sol rigide');
  const paving = profile.paving;
  if (paving !== undefined) {
    if (!Number.isInteger(paving.rows) || paving.rows < 1 || paving.rows > 4) fail('rows de 1 à 4');
    if (!(paving.length >= 0.2) || paving.jitter < 0 || paving.jitter > 0.4)
      fail('dalle hors bornes');
    if (profile.kerb !== undefined && profile.kerb.width >= 1 / paving.rows - 0.05)
      fail('bordure plus large qu’un rang de dalles');
  }
  if (profile.kerb !== undefined && !(profile.kerb.width > 0 && profile.kerb.width < 0.5))
    fail('largeur de bordure hors bornes');
}

// Tampons du calcul d'un point (jusqu'à 8 natures voisines): aucune allocation par appel.
const nearId = new Int32Array(8);
const nearDist = new Float64Array(8);
const nearWeight = new Float64Array(8);

export class Relief {
  readonly width: number;
  readonly height: number;
  /** Profils distincts du lieu, et celui de chaque case. */
  readonly profiles: readonly ReliefProfile[];
  private readonly kinds: Uint8Array;
  /** Rendu de la nature de chaque profil nommé (teinte des dalles), par case. */
  private readonly looks: readonly GroundLook[];
  private readonly lookOf: Uint8Array;
  private readonly modes: Uint8Array;
  private readonly flats: Flat[] = [];
  private readonly flatCells = new Map<number, number[]>();
  private readonly spans: readonly { span: number; weight: number }[];
  /** `joins[a * n + b]`: le sol souple de profil a rejoint de plain-pied le sol rigide de profil b. */
  private joins = new Uint8Array(0);

  constructor(
    field: GroundField,
    map: ReliefMap,
    readonly settings: ReliefSettings = RELIEF_SETTINGS,
  ) {
    this.width = field.width;
    this.height = field.height;
    this.spans = settings.noise;
    const n = this.width * this.height;
    const names = [...field.names];
    const looks = [...field.looks];
    const lookOf = new Uint8Array(n);
    lookOf.set(field.cells.subarray(0, n));

    // Plateformes (bâtiments sans porte): leur emprise prend la nature du quai.
    const platforms = Object.values(map.buildings ?? {}).filter((b) => b.door === null);
    if (platforms.length > 0) {
      let code = names.indexOf(settings.platformNature);
      if (code < 0) {
        const like = looks[names.indexOf('rue')] ?? looks[0];
        if (like !== undefined) {
          code = names.length;
          names.push(settings.platformNature);
          looks.push(like);
        }
      }
      if (code >= 0)
        for (const { rect } of platforms)
          for (
            let y = Math.max(0, Math.floor(rect.y));
            y < Math.min(this.height, rect.y + rect.h);
            y++
          )
            for (
              let x = Math.max(0, Math.floor(rect.x));
              x < Math.min(this.width, rect.x + rect.w);
              x++
            )
              lookOf[y * this.width + x] = code;
    }

    // Un profil par nature (son nom, sinon sa surface); les profils identiques n'en font qu'un.
    const distinct: ReliefProfile[] = [];
    const profileOfName = names.map((name, i) => {
      const look = looks[i];
      const profile =
        look?.hidden === true
          ? settings.hidden
          : (settings.profiles[name] ?? settings.bySurface[look?.surface ?? 'herbe']);
      let at = distinct.indexOf(profile);
      if (at < 0) {
        check(name, profile);
        at = distinct.length;
        distinct.push(profile);
      }
      return at;
    });
    this.profiles = distinct;
    this.looks = looks;
    this.lookOf = lookOf;
    this.kinds = new Uint8Array(n);
    for (let i = 0; i < n; i++) this.kinds[i] = profileOfName[lookOf[i] ?? 0] ?? 0;

    // Un bâtiment garde son assise: toute son emprise prend le profil des bâtiments, quelle que
    // soit la nature que la carte a peinte dessous.
    const seat = settings.profiles[settings.buildingNature];
    if (seat !== undefined) {
      let at = distinct.indexOf(seat);
      if (at < 0) {
        check(settings.buildingNature, seat);
        at = distinct.length;
        distinct.push(seat);
      }
      for (const b of Object.values(map.buildings ?? {})) {
        if (b.door === null) continue;
        const { rect } = b;
        for (
          let y = Math.max(0, Math.floor(rect.y));
          y < Math.min(this.height, rect.y + rect.h);
          y++
        )
          for (
            let x = Math.max(0, Math.floor(rect.x));
            x < Math.min(this.width, rect.x + rect.w);
            x++
          )
            this.kinds[y * this.width + x] = at;
      }
    }

    // Raccords de plain-pied (`joins`): un chemin monte au niveau de la rue qu'il rejoint.
    const count = distinct.length;
    this.joins = new Uint8Array(count * count);
    for (const from of profileOfName)
      for (const target of distinct[from]?.joins ?? []) {
        const to = profileOfName[names.indexOf(target)];
        if (to !== undefined && distinct[to]?.edge === 'rigide') this.joins[from * count + to] = 1;
      }

    // Emprises à niveau: devant les portes, sous les voies.
    const { door, rail } = settings.flats;
    for (const d of Object.values(map.doors ?? {}))
      this.addFlat({ ax: d.x, ay: d.y, bx: d.x, by: d.y, ...door });
    for (const b of Object.values(map.buildings ?? {}))
      if (b.door !== null)
        this.addFlat({ ax: b.door.x, ay: b.door.y, bx: b.door.x, by: b.door.y, ...door });
    for (const [ax, ay, bx, by] of railSegments(map)) this.addFlat({ ax, ay, bx, by, ...rail });

    // Mode de chaque case: rigide, souple sans voisin qui la déforme, ou souple à modeler.
    this.modes = new Uint8Array(n);
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const i = y * this.width + x;
        const own = this.kinds[i] ?? 0;
        if (distinct[own]?.edge !== 'souple') {
          this.modes[i] = RIGID;
          continue;
        }
        let shaped = this.flatCells.has(i);
        for (let dy = -1; dy <= 1 && !shaped; dy++)
          for (let dx = -1; dx <= 1 && !shaped; dx++) {
            const other = this.kindAt(x + dx, y + dy);
            if (other < 0 || other === own) continue;
            const q = distinct[other];
            shaped =
              q !== undefined &&
              (q.edge === 'souple' ||
                q.rim !== undefined ||
                q.apron !== undefined ||
                this.joins[own * count + other] === 1);
          }
        this.modes[i] = shaped ? SHAPED : PLAIN;
      }
  }

  private addFlat(flat: Flat): void {
    const at = this.flats.length;
    this.flats.push(flat);
    const reach = flat.radius + flat.fade;
    const x0 = Math.max(0, Math.floor(Math.min(flat.ax, flat.bx) - reach));
    const x1 = Math.min(this.width - 1, Math.floor(Math.max(flat.ax, flat.bx) + reach));
    const y0 = Math.max(0, Math.floor(Math.min(flat.ay, flat.by) - reach));
    const y1 = Math.min(this.height - 1, Math.floor(Math.max(flat.ay, flat.by) + reach));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        // Seules les cases que l'emprise peut atteindre (une voie en biais ne les prend pas toutes).
        if (flatDistance(flat, x + 0.5, y + 0.5) > reach + 0.71) continue;
        const i = y * this.width + x;
        const list = this.flatCells.get(i);
        if (list === undefined) this.flatCells.set(i, [at]);
        else list.push(at);
      }
  }

  /** Numéro du profil de la case, -1 hors de la carte. */
  kindAt(cx: number, cy: number): number {
    return cx < 0 || cy < 0 || cx >= this.width || cy >= this.height
      ? -1
      : (this.kinds[cy * this.width + cx] ?? 0);
  }

  profileAt(cx: number, cy: number): ReliefProfile | null {
    return this.profiles[this.kindAt(cx, cy)] ?? null;
  }

  /** Rendu (teinte, surface) de la nature de la case, plateformes comprises. */
  lookAt(cx: number, cy: number): GroundLook | null {
    if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return null;
    return this.looks[this.lookOf[cy * this.width + cx] ?? 0] ?? null;
  }

  isSoft(cx: number, cy: number): boolean {
    return this.profileAt(cx, cy)?.edge === 'souple';
  }

  /** Subdivision du maillage de la case: 1 (plane ou à bosses lentes) ou `mesh.fine`. */
  resolution(cx: number, cy: number): number {
    if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return 1;
    return this.modes[cy * this.width + cx] === SHAPED ? this.settings.mesh.fine : 1;
  }

  /** Subdivision du côté d'une case souple: la plus fine des deux cases qu'il sépare. */
  edgeResolution(cx: number, cy: number, side: SideIndex): number {
    const own = this.resolution(cx, cy);
    const s = SIDES[side];
    return this.isSoft(cx + s.dx, cy + s.dy)
      ? Math.max(own, this.resolution(cx + s.dx, cy + s.dy))
      : own;
  }

  /** Bosses communes à tout le sol souple, de -1 à 1 (chaque profil y met son amplitude). */
  private noise(x: number, y: number): number {
    let value = 0;
    for (let k = 0; k < this.spans.length; k++) {
      const octave = this.spans[k];
      if (octave !== undefined) value += valueNoise(x, y, octave.span, 91 + k) * octave.weight;
    }
    return value;
  }

  /**
   * Hauteur du sol souple de la case (cx, cy) au point (x, y). Le point peut déborder un peu de
   * la case: la formule de la case s'y prolonge (normales au bord d'un sol rigide).
   */
  private softAt(cx: number, cy: number, x: number, y: number): number {
    const i = cy * this.width + cx;
    const ownId = this.kinds[i] ?? 0;
    const own = this.profiles[ownId];
    if (own === undefined) return 0;
    const n = this.noise(x, y);
    if (this.modes[i] === PLAIN) return own.level + (own.bumps ?? 0) * n;

    // Distance du point à chaque nature voisine (la plus proche de ses cases).
    let count = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const id = this.kindAt(cx + dx, cy + dy);
        if (id < 0 || id === ownId) continue;
        const px = Math.max(cx + dx - x, 0, x - (cx + dx + 1));
        const py = Math.max(cy + dy - y, 0, y - (cy + dy + 1));
        const d = Math.hypot(px, py);
        let slot = 0;
        while (slot < count && nearId[slot] !== id) slot++;
        if (slot === count) {
          nearId[slot] = id;
          nearDist[slot] = d;
          count++;
        } else if (d < (nearDist[slot] ?? 0)) nearDist[slot] = d;
      }

    let weight = 1;
    let level = own.level;
    let bumps = own.bumps ?? 0;
    let lift = 0;
    for (let k = 0; k < count; k++) {
      const q = this.profiles[nearId[k] ?? 0];
      const d = nearDist[k] ?? 0;
      if (q === undefined) continue;
      if (q.edge === 'souple') {
        // Au bord, moitié de chaque niveau; la pente y est la plus forte et s'éteint à `spread`.
        const u = Math.min(1, d / (q.spread ?? 0.45));
        const v = (1 - u) * (1 - u);
        const w = v / (2 - v);
        nearWeight[k] = w;
        weight += w;
        level += w * q.level;
        bumps += w * (q.bumps ?? 0);
      } else nearWeight[k] = 0;
      if (q.rim !== undefined && d < q.rim.width) {
        const s = Math.sin((Math.PI * d) / q.rim.width);
        lift += q.rim.height * s * s;
      }
    }
    let h = (level + bumps * n) / weight + lift;
    // Sols rigides voisins, dans l'ordre des profils (le même d'une case à l'autre: le résultat
    // ne dépend pas de la case d'où l'on calcule).
    const kinds = this.profiles.length;
    for (let id = 0; id < kinds; id++) {
      let k = 0;
      while (k < count && nearId[k] !== id) k++;
      const q = this.profiles[id];
      if (k === count || q === undefined || q.edge === 'souple') continue;
      const d = nearDist[k] ?? 0;
      if (q.apron !== undefined) {
        h = q.level + (h - q.level) * smooth01(d / q.apron);
        continue;
      }
      // Part du sol qui rejoint ce voisin de plain-pied (un chemin et la rue): 1 au milieu du
      // chemin, elle s'éteint avec lui dans l'herbe d'à côté.
      let joining = this.joins[ownId * kinds + id] ?? 0;
      for (let j = 0; j < count; j++)
        if (this.joins[(nearId[j] ?? 0) * kinds + id] === 1) joining += nearWeight[j] ?? 0;
      if (joining > 0 && d < this.settings.joinReach)
        h += (q.level - h) * (1 - smooth01(d / this.settings.joinReach)) * (joining / weight);
    }
    const flats = this.flatCells.get(i);
    if (flats !== undefined)
      for (const at of flats) {
        const flat = this.flats[at];
        if (flat === undefined) continue;
        const t = (flatDistance(flat, x, y) - flat.radius) / flat.fade;
        if (t < 1) h = flat.level + (h - flat.level) * smooth01(t);
      }
    return h;
  }

  /**
   * Hauteur du sol souple au point (x, y) vue depuis la case souple (cx, cy): la vraie hauteur si
   * le point est sur un sol souple, sinon le prolongement de la case (le sol souple ne saute pas
   * sur la marche d'un voisin rigide).
   */
  softSample(cx: number, cy: number, x: number, y: number): number {
    const px = Math.floor(x);
    const py = Math.floor(y);
    return this.isSoft(px, py) ? this.softAt(px, py, x, y) : this.softAt(cx, cy, x, y);
  }

  /** Ce côté de la case porte-t-il une bordure de pierre ? */
  kerbOn(cx: number, cy: number, side: SideIndex): KerbProfile | null {
    const own = this.profileAt(cx, cy);
    if (own?.kerb === undefined) return null;
    const s = SIDES[side];
    const other = this.profileAt(cx + s.dx, cy + s.dy);
    if (other === null || other === own) return null;
    // Pas de bordure en travers d'un chemin qui rejoint ce sol de plain-pied.
    const s2 = this.profiles.length;
    if (this.joins[this.kindAt(cx + s.dx, cy + s.dy) * s2 + this.kindAt(cx, cy)] === 1) return null;
    const lower = other.edge === 'souple' || other.level < own.level - this.settings.mesh.flush;
    return lower ? own.kerb : null;
  }

  /**
   * Hauteur du sol affiché au point (x, y) de la carte (x est, y sud), en mètres au-dessus du plan
   * de la simulation; 0 hors de la carte.
   */
  heightAt(x: number, y: number): number {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return 0;
    const i = cy * this.width + cx;
    if (this.modes[i] !== RIGID) return this.softAt(cx, cy, x, y);
    const own = this.profiles[this.kinds[i] ?? 0];
    if (own === undefined) return 0;
    const kerb = own.kerb;
    if (kerb === undefined || kerb.height === 0) return own.level;
    const fx = x - cx;
    const fy = y - cy;
    const on =
      (fy < kerb.width && this.kerbOn(cx, cy, 0) !== null) ||
      (fy > 1 - kerb.width && this.kerbOn(cx, cy, 1) !== null) ||
      (fx < kerb.width && this.kerbOn(cx, cy, 2) !== null) ||
      (fx > 1 - kerb.width && this.kerbOn(cx, cy, 3) !== null);
    return own.level + (on ? kerb.height : 0);
  }

  /** Le plus haut du sol autour d'un point (une ombre de contact posée là ne s'enfonce nulle part). */
  highestAround(x: number, y: number, radius: number): number {
    return Math.max(
      this.heightAt(x, y),
      this.heightAt(x - radius, y),
      this.heightAt(x + radius, y),
      this.heightAt(x, y - radius),
      this.heightAt(x, y + radius),
    );
  }

  /**
   * Marche entre une case rigide et sa voisine, côté par côté: hauteurs de part et d'autre en
   * `count + 1` points le long du côté (`near` du côté de la case, `far` de l'autre), ou `null`
   * si rien n'est à dessiner (même niveau, bordure qui couvre la marche, voisine plus haute qui
   * la dessinera, bord de la carte).
   */
  riser(
    cx: number,
    cy: number,
    side: SideIndex,
  ): { near: number; far: number[]; count: number } | null {
    const own = this.profileAt(cx, cy);
    const s = SIDES[side];
    const nx = cx + s.dx;
    const ny = cy + s.dy;
    const other = this.profileAt(nx, ny);
    if (own === null || own.edge === 'souple' || other === null) return null;
    if (this.lookAt(nx, ny)?.hidden === true || this.kerbOn(cx, cy, side) !== null) return null;
    const flush = this.settings.mesh.flush;
    if (other.edge !== 'souple') {
      // Entre deux sols rigides: la plus haute dessine la marche (sauf sous la bordure de l'autre).
      if (other.level >= own.level - flush) return null;
      return { near: own.level, far: [other.level, other.level], count: 1 };
    }
    const count = this.edgeResolution(nx, ny, OPPOSITE[side] ?? 0);
    const far: number[] = [];
    let differs = false;
    for (let k = 0; k <= count; k++) {
      const [x, y] = sidePoint(cx, cy, side, k / count);
      const h = this.softAt(nx, ny, x, y);
      far.push(h);
      if (Math.abs(h - own.level) > flush) differs = true;
    }
    return differs ? { near: own.level, far, count } : null;
  }

  /** Fin (exclue) du rang de cases de même profil et de mêmes bordures nord et sud, vers l'est ou l'ouest. */
  private runLimit(cx: number, cy: number, step: 1 | -1): number {
    const id = this.kindAt(cx, cy);
    const north = this.kerbOn(cx, cy, 0) !== null;
    const south = this.kerbOn(cx, cy, 1) !== null;
    let at = cx;
    while (
      this.kindAt(at + step, cy) === id &&
      (this.kerbOn(at + step, cy, 0) !== null) === north &&
      (this.kerbOn(at + step, cy, 1) !== null) === south
    )
      at += step;
    return step === 1 ? at + 1 : at;
  }

  /**
   * Dalles posées sur les cases rigides de `rect` (une tuile), rang par rang, entre les bordures.
   * Les joints ne dépendent que de la position: une dalle à cheval sur deux tuiles appartient à
   * celle où elle commence, et aucun joint ne suit le bord des tuiles.
   */
  slabs(rect: { x0: number; y0: number; x1: number; y1: number }): Slab[] {
    const out: Slab[] = [];
    for (let cy = rect.y0; cy < rect.y1; cy++) {
      let cx = rect.x0;
      while (cx < rect.x1) {
        const profile = this.profileAt(cx, cy);
        const paving = profile?.paving;
        if (profile === null || paving === undefined) {
          cx++;
          continue;
        }
        const start = this.runLimit(cx, cy, -1);
        const end = this.runLimit(cx, cy, 1);
        const kerb = profile.kerb?.width ?? 0;
        const north = this.kerbOn(cx, cy, 0) !== null;
        const south = this.kerbOn(cx, cy, 1) !== null;
        const xa = start + (this.kerbOn(start, cy, 2) !== null ? kerb : 0);
        const xb = end - (this.kerbOn(end - 1, cy, 3) !== null ? kerb : 0);
        for (let r = 0; r < paving.rows; r++) {
          const za = cy + r / paving.rows + (r === 0 && north ? kerb : 0);
          const zb = cy + (r + 1) / paving.rows - (r === paving.rows - 1 && south ? kerb : 0);
          const span = { xa, xb, za, zb, from: rect.x0, to: rect.x1 };
          this.rowSlabs(profile.level, paving, cy * paving.rows + r, span, out);
        }
        cx = end;
      }
    }
    return out;
  }

  private rowSlabs(
    level: number,
    paving: PavingProfile,
    row: number,
    span: { xa: number; xb: number; za: number; zb: number; from: number; to: number },
    out: Slab[],
  ): void {
    const { xa, xb, za, zb, from, to } = span;
    const L = paving.length;
    // Joint numéro m du rang: décalé d'une demi-dalle un rang sur deux, puis d'un tirage.
    const joint = (m: number): number =>
      (m + (row % 2 === 0 ? 0 : 0.5) + (hash01(m, row, 101) - 0.5) * 2 * paving.jitter) * L;
    const least = L * 0.3;
    // Coupes utiles à cette tuile: du début du rang (ou de deux dalles avant la tuile) à la
    // première coupe au-delà de la tuile.
    const first = Math.max(xa, from - 2 * L);
    const cuts: number[] = first === xa ? [xa] : [];
    for (let m = Math.floor(first / L) - 1; ; m++) {
      const at = joint(m);
      if (at >= xb - least) {
        cuts.push(xb);
        break;
      }
      if (at <= first + least) continue;
      cuts.push(at);
      if (at >= to) break;
    }
    const g = paving.joint / 2;
    for (let k = 0; k + 1 < cuts.length; k++) {
      const a = cuts[k] ?? xa;
      const b = cuts[k + 1] ?? xb;
      if (a < from || a >= to) continue;
      // Une dalle se reconnaît à son joint de gauche.
      const key = Math.round(a * 16);
      const lift = (hash01(key, row, 102) - 0.5) * 2 * paving.uneven;
      const corner = (c: number): number =>
        level + lift + (hash01(key + c, row, 103) - 0.5) * paving.uneven;
      out.push({
        x0: a + g,
        z0: za + g,
        x1: b - g,
        z1: zb - g,
        tops: [corner(1), corner(2), corner(3), corner(4)],
        bottom: level - paving.depth,
        tone: 1 + (hash01(key, row, 104) - 0.5) * 2 * paving.tone,
      });
    }
  }

  /**
   * Pierres de bordure des cases rigides de `rect`: posées dans leur case, le long de chaque côté
   * qui touche un sol plus bas ou souple, et enfoncées jusque sous ce sol (rien ne flotte).
   */
  kerbStones(rect: { x0: number; y0: number; x1: number; y1: number }): Slab[] {
    const out: Slab[] = [];
    const bury = this.settings.mesh.bury;
    for (let cy = rect.y0; cy < rect.y1; cy++)
      for (let cx = rect.x0; cx < rect.x1; cx++) {
        const own = this.profileAt(cx, cy);
        const kerb = own?.kerb;
        if (own === null || kerb === undefined) continue;
        const w = kerb.width;
        const on = ([0, 1, 2, 3] as const).map((side) => this.kerbOn(cx, cy, side) !== null);
        for (const side of [0, 1, 2, 3] as const) {
          if (on[side] !== true) continue;
          const s = SIDES[side];
          const other = this.profileAt(cx + s.dx, cy + s.dy);
          const alongX = side < 2;
          // Les pierres nord et sud tiennent les coins; celles de l'est et de l'ouest s'arrêtent à elles.
          const a0 = alongX ? cx : cy + (on[0] === true ? w : 0);
          const a1 = alongX ? cx + 1 : cy + 1 - (on[1] === true ? w : 0);
          const count = Math.max(1, Math.round((a1 - a0) / kerb.length));
          for (let k = 0; k < count; k++) {
            const from = a0 + ((a1 - a0) * k) / count + 0.006;
            const to = a0 + ((a1 - a0) * (k + 1)) / count - 0.006;
            const mid = (from + to) / 2;
            const ex = alongX ? mid : cx + (side === 3 ? 1 : 0);
            const ey = alongX ? cy + (side === 1 ? 1 : 0) : mid;
            const beside =
              other === null
                ? own.level
                : other.edge === 'souple'
                  ? this.softAt(cx + s.dx, cy + s.dy, ex, ey)
                  : other.level;
            const key = cx * 4 + side + k * 16;
            const top = own.level + kerb.height + (hash01(key, cy, 111) - 0.5) * 0.008;
            const c0 = side === 0 ? cy : side === 1 ? cy + 1 - w : side === 2 ? cx : cx + 1 - w;
            out.push({
              x0: alongX ? from : c0,
              z0: alongX ? c0 : from,
              x1: alongX ? to : c0 + w,
              z1: alongX ? c0 + w : to,
              tops: [top, top, top, top],
              bottom: Math.min(own.level, beside) - bury,
              tone: 1 + (hash01(key, cy, 112) - 0.5) * 0.08,
            });
          }
        }
      }
    return out;
  }
}

/** Point du côté d'une case, à la part `t` de sa longueur (d'ouest en est, ou du nord au sud). */
export function sidePoint(cx: number, cy: number, side: SideIndex, t: number): [number, number] {
  if (side === 0) return [cx + t, cy];
  if (side === 1) return [cx + t, cy + 1];
  if (side === 2) return [cx, cy + t];
  return [cx + 1, cy + t];
}

function flatDistance(flat: Flat, x: number, y: number): number {
  const dx = flat.bx - flat.ax;
  const dy = flat.by - flat.ay;
  const length2 = dx * dx + dy * dy;
  const t =
    length2 === 0
      ? 0
      : Math.min(1, Math.max(0, ((x - flat.ax) * dx + (y - flat.ay) * dy) / length2));
  return Math.hypot(x - flat.ax - dx * t, y - flat.ay - dy * t);
}

/** Le relief d'un lieu; l'appelant le garde le temps du lieu (aucune ressource vidéo). */
export function createRelief(
  field: GroundField,
  map: ReliefMap,
  settings: ReliefSettings = RELIEF_SETTINGS,
): Relief {
  return new Relief(field, map, settings);
}
