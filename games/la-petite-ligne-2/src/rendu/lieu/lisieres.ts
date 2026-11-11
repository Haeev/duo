/**
 * Limites de sol adoucies d'un grand lieu: un champ de décalage, un vecteur par noeud d'un
 * treillis posé sur la grille des cases (`steps` noeuds par mètre), borné à `reach`. Le sol
 * affiché au point p est le sol de la grille au point p + décalage(p): teinte (le nuanceur lit ce
 * champ dans une texture), hauteur du relief, ligne d'eau. La frontière entre deux natures ne
 * suit donc plus les arêtes des cases, mais elle ne s'en écarte jamais de plus de `reach`:
 * collisions et cases franchissables, restées sur la grille, s'y accordent à une trentaine de
 * centimètres près.
 *
 * Calcul: chaque noeud posé sur une frontière lissable va, passe après passe, vers le milieu de
 * ses deux voisins le long de cette frontière (un fil tendu dans des disques de rayon `reach`:
 * les coins s'arrondissent, les paliers d'un escalier s'inclinent), puis reçoit une ondulation
 * lente tirée de sa place. Un noeud qui touche un sol au bord droit (dallage, bâtiment, voie) ne
 * bouge pas, ni un noeud où trois natures se rejoignent.
 *
 * Logique pure et déterministe (hachage des coordonnées, aucun hasard): l'hôte et l'invité
 * voient la même ligne, continue d'une tuile à l'autre puisque le champ est celui du lieu.
 * Données: `reglages-lisieres.ts`.
 */
import { EDGE_SETTINGS, type EdgeSelector, type EdgeSettings } from './reglages-lisieres';
import type { GroundLook } from './reglages-tuiles';
import { hash01 } from './terrain-rendu';

/** Ce que le champ lit du lieu: la nature de chaque case, et les cases au bord droit. */
export interface EdgeSource {
  readonly width: number;
  readonly height: number;
  readonly names: readonly string[];
  readonly looks: readonly GroundLook[];
  /** Nature de chaque case (`y * width + x`), index dans `names`. */
  readonly cells: Uint8Array;
  /** La case garde ses bords droits (sol rigide, emprise de bâtiment, nature cachée). */
  straight(index: number): boolean;
}

const INSIDE = 0;
const FREE = 1;
const FIXED = 2;

function matches(selector: EdgeSelector, name: string, look: GroundLook | undefined): boolean {
  return selector === '*' || selector === name || selector === `surface:${look?.surface ?? ''}`;
}

function smooth01(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Bruit de valeurs lisse sur une grille de `span` m, de -1 à 1. */
function slowNoise(x: number, y: number, span: number, salt: number): number {
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

export class EdgeField {
  readonly width: number;
  readonly height: number;
  /** Noeuds du treillis par mètre, et ses dimensions en noeuds. */
  readonly steps: number;
  readonly columns: number;
  readonly rows: number;
  /** Pleine échelle d'un octet (m): décalage = (octet - 128) / 127 x `span`. */
  readonly span: number;
  /**
   * Décalage de chaque noeud du treillis (`columns` par `rows`), deux octets (x, y) par noeud:
   * ce que le nuanceur lit en filtrage linéaire, et ce que `sample` lit ici.
   */
  readonly bytes: Uint8Array;
  /** Cases dont un noeud au moins est décalé (les autres se lisent sans calcul). */
  private readonly active: Uint8Array;
  /** Résultat du dernier `sample` (aucune allocation par appel). */
  sx = 0;
  sy = 0;

  constructor(
    source: EdgeSource,
    readonly settings: EdgeSettings = EDGE_SETTINGS,
  ) {
    const { width, height, names, looks, cells } = source;
    this.width = width;
    this.height = height;
    this.span = settings.span;
    const steps = settings.steps;
    if (!Number.isInteger(steps) || steps < 1 || steps > 4)
      throw new Error('limites de sol: `steps` de 1 à 4');
    if (!(settings.reach > 0 && settings.reach <= settings.span && settings.reach < 0.5))
      throw new Error('limites de sol: `reach` hors de ]0, min(span, 0,5)[');
    this.steps = steps;
    const vw = width * steps + 1;
    const vh = height * steps + 1;
    this.columns = vw;
    this.rows = vh;
    this.bytes = new Uint8Array(vw * vh * 2).fill(128);
    this.active = new Uint8Array(width * height);

    // Couples lissés, par numéros de nature.
    const n = names.length;
    const smooth = new Uint8Array(n * n);
    const kept = names.map((name) => settings.straight.includes(name));
    for (const pair of settings.pairs)
      for (let a = 0; a < n; a++)
        for (let b = 0; b < n; b++) {
          if (a === b || kept[a] === true || kept[b] === true) continue;
          const an = names[a] ?? '';
          const bn = names[b] ?? '';
          const forward =
            pair.a.some((s) => matches(s, an, looks[a])) &&
            pair.b.some((s) => matches(s, bn, looks[b]));
          const backward =
            pair.a.some((s) => matches(s, bn, looks[b])) &&
            pair.b.some((s) => matches(s, an, looks[a]));
          if (forward || backward) smooth[a * n + b] = 1;
        }

    // État de chaque noeud, et ses deux voisins le long de la frontière s'il est libre.
    const state = new Uint8Array(vw * vh);
    const first = new Int32Array(vw * vh).fill(-1);
    const second = new Int32Array(vw * vh).fill(-1);
    const free: number[] = [];
    for (let vy = 0; vy < vh; vy++)
      for (let vx = 0; vx < vw; vx++) {
        const vi = vy * vw + vx;
        if (vx === 0 || vy === 0 || vx === vw - 1 || vy === vh - 1) {
          state[vi] = FIXED;
          continue;
        }
        // Les quatre cases autour du noeud (la même plusieurs fois s'il est dans une case).
        const west = Math.floor((vx - 1) / steps);
        const east = Math.floor(vx / steps);
        const north = Math.floor((vy - 1) / steps) * width;
        const south = Math.floor(vy / steps) * width;
        if (
          source.straight(north + west) ||
          source.straight(north + east) ||
          source.straight(south + west) ||
          source.straight(south + east)
        ) {
          state[vi] = FIXED;
          continue;
        }
        const nw = cells[north + west] ?? 0;
        const ne = cells[north + east] ?? 0;
        const sw = cells[south + west] ?? 0;
        const se = cells[south + east] ?? 0;
        if (nw === ne && nw === sw && nw === se) continue;
        // Arêtes qui partent du noeud: est, ouest, sud, nord, avec les deux cases qu'elles séparent.
        const tally = { degree: 0, blocked: false };
        const edge = (a: number, b: number, to: number): void => {
          if (a === b) return;
          if (smooth[a * n + b] !== 1) tally.blocked = true;
          if (tally.degree === 0) first[vi] = to;
          else if (tally.degree === 1) second[vi] = to;
          tally.degree++;
        };
        edge(ne, se, vi + 1);
        edge(nw, sw, vi - 1);
        edge(sw, se, vi + vw);
        edge(nw, ne, vi - vw);
        if (tally.blocked || tally.degree !== 2) state[vi] = FIXED;
        else {
          state[vi] = FREE;
          free.push(vi);
        }
      }

    // Lissage: filtre (1, 2, 1) / 4 le long de la frontière, borné à `reach` autour du noeud.
    const dx = new Float32Array(vw * vh);
    const dy = new Float32Array(vw * vh);
    const nx = new Float32Array(free.length);
    const ny = new Float32Array(free.length);
    const reach = settings.reach;
    const unit = 1 / steps;
    const relax = (passes: number): void => {
      for (let pass = 0; pass < passes; pass++) {
        for (let k = 0; k < free.length; k++) {
          const vi = free[k] ?? 0;
          const a = first[vi] ?? vi;
          const b = second[vi] ?? vi;
          const vx = vi % vw;
          const vy = Math.floor(vi / vw);
          // Places des deux voisins (noeud plus décalage), relatives au noeud, en mètres.
          const ax = ((a % vw) - vx) * unit + (dx[a] ?? 0);
          const ay = (Math.floor(a / vw) - vy) * unit + (dy[a] ?? 0);
          const bx = ((b % vw) - vx) * unit + (dx[b] ?? 0);
          const by = (Math.floor(b / vw) - vy) * unit + (dy[b] ?? 0);
          let x = (dx[vi] ?? 0) * 0.5 + (ax + bx) * 0.25;
          let y = (dy[vi] ?? 0) * 0.5 + (ay + by) * 0.25;
          const length = Math.hypot(x, y);
          if (length > reach) {
            x *= reach / length;
            y *= reach / length;
          }
          nx[k] = x;
          ny[k] = y;
        }
        for (let k = 0; k < free.length; k++) {
          const vi = free[k] ?? 0;
          dx[vi] = nx[k] ?? 0;
          dy[vi] = ny[k] ?? 0;
        }
      }
    };
    relax(settings.passes);

    // Ondulation lente, en travers d'une frontière droite (dans les deux sens à un coin), puis
    // quelques passes qui lui rendent sa rondeur.
    for (const vi of free) {
      const a = first[vi] ?? vi;
      const b = second[vi] ?? vi;
      const vx = vi % vw;
      const vy = Math.floor(vi / vw);
      const alongX = Math.floor(a / vw) === vy && Math.floor(b / vw) === vy;
      const alongY = a % vw === vx && b % vw === vx;
      const px = vx * unit;
      const py = vy * unit;
      let jx = 0;
      let jy = 0;
      settings.waves.forEach((wave, k) => {
        jx += slowNoise(px, py, wave.span, 131 + k * 2) * wave.height;
        jy += slowNoise(px, py, wave.span, 132 + k * 2) * wave.height;
      });
      let x = (dx[vi] ?? 0) + (alongX ? 0 : jx * (alongY ? 1 : 0.7));
      let y = (dy[vi] ?? 0) + (alongY ? 0 : jy * (alongX ? 1 : 0.7));
      const length = Math.hypot(x, y);
      if (length > reach) {
        x *= reach / length;
        y *= reach / length;
      }
      dx[vi] = x;
      dy[vi] = y;
    }
    relax(settings.finish);

    // Les noeuds voisins reprennent une part du décalage: la frontière se déplace d'un bloc au
    // lieu de s'écraser contre une rangée restée en place.
    let ring: readonly number[] = free;
    const reached = new Uint8Array(vw * vh);
    for (const vi of free) reached[vi] = 1;
    let previous = 1;
    for (const share of settings.carry) {
      const next: number[] = [];
      const values: number[] = [];
      const seen = new Set<number>();
      for (const from of ring)
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) {
            const vi = from + oy * vw + ox;
            if (state[vi] !== INSIDE || reached[vi] === 1 || seen.has(vi)) continue;
            seen.add(vi);
            let sumX = 0;
            let sumY = 0;
            let count = 0;
            for (let qy = -1; qy <= 1; qy++)
              for (let qx = -1; qx <= 1; qx++) {
                const q = vi + qy * vw + qx;
                if (reached[q] !== 1) continue;
                sumX += dx[q] ?? 0;
                sumY += dy[q] ?? 0;
                count++;
              }
            if (count === 0) continue;
            next.push(vi);
            values.push((sumX / count) * (share / previous), (sumY / count) * (share / previous));
          }
      next.forEach((vi, k) => {
        dx[vi] = values[k * 2] ?? 0;
        dy[vi] = values[k * 2 + 1] ?? 0;
      });
      for (const vi of next) reached[vi] = 1;
      ring = next;
      previous = share;
    }

    // Un noeud de frontière paraît en v + d si le point affiché en v + d lit la grille en v: le
    // décalage du point lu est donc l'opposé du déplacement du noeud.
    for (let vi = 0; vi < vw * vh; vi++) {
      const bx = Math.round((-(dx[vi] ?? 0) / this.span) * 127) + 128;
      const by = Math.round((-(dy[vi] ?? 0) / this.span) * 127) + 128;
      this.bytes[vi * 2] = bx;
      this.bytes[vi * 2 + 1] = by;
      if (bx === 128 && by === 128) continue;
      // Toute case qui touche ce noeud le lit.
      const vx = vi % vw;
      const vy = Math.floor(vi / vw);
      for (let cy = Math.floor((vy - 1) / steps); cy <= Math.floor(vy / steps); cy++)
        for (let cx = Math.floor((vx - 1) / steps); cx <= Math.floor(vx / steps); cx++)
          if (cx >= 0 && cy >= 0 && cx < width && cy < height) this.active[cy * width + cx] = 1;
    }
  }

  /**
   * Décalage au point (x, y), rangé dans `sx` et `sy` (m): interpolation des quatre noeuds
   * autour du point, comme le filtrage linéaire de la texture. Rend faux (et 0, 0) là où rien ne
   * bouge.
   */
  sample(x: number, y: number): boolean {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (
      cx < 0 ||
      cy < 0 ||
      cx >= this.width ||
      cy >= this.height ||
      this.active[cy * this.width + cx] !== 1
    ) {
      this.sx = 0;
      this.sy = 0;
      return false;
    }
    const gx = x * this.steps;
    const gy = y * this.steps;
    const ix = Math.min(this.columns - 2, Math.floor(gx));
    const iy = Math.min(this.rows - 2, Math.floor(gy));
    const fx = gx - ix;
    const fy = gy - iy;
    const i = (iy * this.columns + ix) * 2;
    const j = i + this.columns * 2;
    const b = this.bytes;
    const w00 = (1 - fx) * (1 - fy);
    const w10 = fx * (1 - fy);
    const w01 = (1 - fx) * fy;
    const w11 = fx * fy;
    const k = this.span / 127;
    this.sx =
      ((b[i] ?? 128) * w00 +
        (b[i + 2] ?? 128) * w10 +
        (b[j] ?? 128) * w01 +
        (b[j + 2] ?? 128) * w11 -
        128) *
      k;
    this.sy =
      ((b[i + 1] ?? 128) * w00 +
        (b[i + 3] ?? 128) * w10 +
        (b[j + 1] ?? 128) * w01 +
        (b[j + 3] ?? 128) * w11 -
        128) *
      k;
    return true;
  }
}
