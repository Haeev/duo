/**
 * Lits de voie des grands lieux (rendu encré): le ballast et ses fossés, en tranchée près d'un
 * tunnel, posés module par module le long du tracé réel des voies (`rails` de la carte), sous les
 * traverses et les rails que le décor dessine déjà. Chaque module d'un mètre est plié sur la voie
 * (courbes comprises) et posé sommet par sommet sur le relief: deux modules voisins partagent
 * leurs bords, d'une tuile à l'autre aussi. Les modules d'une tuile sont fusionnés en un maillage
 * posé à l'origine du lieu, chaque voie d'une seule pièce de contour: aucun trait aux raccords.
 *
 * Données: `TRACK_BED` de `reglages-files.ts` (sortes, natures, enfoncements). Aucune voie nommée.
 */
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MapDef } from '../../donnees/schemas/lieu';
import { DECOR_MANIFEST, type DecorManifest, variantOf } from './decors-manifeste';
import type { Footprint } from './emprises';
import { TRACK_BED } from './reglages-files';
import { type GroundField, hash01 } from './terrain-rendu';
import { tileOf } from '../../donnees/carte';

export type TrackBedSettings = typeof TRACK_BED;

/** Une voie à ciel ouvert prête à parcourir. */
interface BedTrack {
  readonly id: string;
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  /** Distance du premier point à chaque point. */
  readonly at: Float64Array;
  readonly length: number;
  /** Bouts qui entrent dans un tunnel (début, fin). */
  readonly mouths: readonly [boolean, boolean];
  /** Numéro de pièce de contour (1 à 62): le même pour toute la voie. */
  readonly piece: number;
}

/** Un module posé: sa voie, sa sorte, son modèle (variante comprise) et son tronçon (m). */
export interface BedModule {
  readonly track: number;
  readonly sort: number;
  readonly model: string;
  readonly s0: number;
  readonly s1: number;
  /** Tuile du lieu qui le dessine (celle de son milieu). */
  readonly tile: number;
}

const point = { x: 0, y: 0 };
const ahead = { x: 0, y: 0 };
const behind = { x: 0, y: 0 };

function pointOn(track: BedTrack, s: number, out: { x: number; y: number }): void {
  const last = track.at.length - 1;
  const d = Math.min(track.length, Math.max(0, s));
  let i = 0;
  while (i < last - 1 && (track.at[i + 1] ?? 0) < d) i++;
  const a = track.at[i] ?? 0;
  const span = (track.at[i + 1] ?? a + 1) - a;
  const t = span > 0 ? (d - a) / span : 0;
  const x0 = track.xs[i] ?? 0;
  const y0 = track.ys[i] ?? 0;
  out.x = x0 + ((track.xs[i + 1] ?? x0) - x0) * t;
  out.y = y0 + ((track.ys[i + 1] ?? y0) - y0) * t;
}

/** Distance de (x, y) à la voie. */
function distanceTo(track: BedTrack, x: number, y: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < track.xs.length; i++) {
    const ax = track.xs[i] ?? 0;
    const ay = track.ys[i] ?? 0;
    const dx = (track.xs[i + 1] ?? ax) - ax;
    const dy = (track.ys[i + 1] ?? ay) - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return best;
}

/** Les lits de voie d'un lieu: voies, modules, et ce qu'il faut pour les poser. */
export class TrackBedLayout {
  constructor(
    readonly tracks: readonly BedTrack[],
    readonly modules: readonly BedModule[],
    readonly settings: TrackBedSettings,
    /** Demi-largeur de chaque sorte (m), d'après le manifeste. */
    readonly halfWidths: readonly number[],
    /** Pieds des petits repères du bord de la voie: le fossé s'y arrête. */
    readonly clear: readonly Footprint[] = [],
  ) {}

  /** Modules d'une tuile. */
  inTile(tile: number): BedModule[] {
    return this.modules.filter((m) => m.tile === tile);
  }

  /** Distance (m, le long de la voie) à la bouche de tunnel la plus proche; l'infini sans tunnel. */
  toMouth(track: number, s: number): number {
    const t = this.tracks[track];
    if (t === undefined) return Number.POSITIVE_INFINITY;
    let d = Number.POSITIVE_INFINITY;
    if (t.mouths[0]) d = Math.min(d, s);
    if (t.mouths[1]) d = Math.min(d, t.length - s);
    return d;
  }

  /** Emprise de chaque module (boîte alignée): rien ne se sème sur le ballast ni dans les fossés. */
  footprints(): Footprint[] {
    const out: Footprint[] = [];
    for (const m of this.modules) {
      const track = this.tracks[m.track];
      const half = this.halfWidths[m.sort] ?? 0;
      if (track === undefined) continue;
      pointOn(track, m.s0, behind);
      pointOn(track, m.s1, ahead);
      out.push({
        x0: Math.min(behind.x, ahead.x) - half,
        z0: Math.min(behind.y, ahead.y) - half,
        x1: Math.max(behind.x, ahead.x) + half,
        z1: Math.max(behind.y, ahead.y) + half,
      });
    }
    return out;
  }
}

/**
 * Pose les lits de voie d'un lieu. `sorts` doivent avoir leurs modèles livrés (`has`); sans
 * sorte disponible, aucun module (la voie garde son sol et ses traverses).
 */
export function layTrackBeds(
  map: Pick<MapDef, 'rails' | 'width' | 'height'>,
  field: GroundField,
  has: (model: string) => boolean,
  settings: TrackBedSettings = TRACK_BED,
  manifest: DecorManifest = DECOR_MANIFEST,
  /** Emprises des repères posés au lieu (seuls les petits arrêtent le fossé). */
  landmarks: readonly Footprint[] = [],
): TrackBedLayout {
  const usable = settings.sorts.map((sort) =>
    [sort.model, ...(manifest.models[sort.model]?.variants ?? [])].every(
      (id) => manifest.models[id] !== undefined && has(id),
    ),
  );
  const halfWidths = settings.sorts.map((sort) => (manifest.models[sort.model]?.size.w ?? 0) / 2);
  const rails = map.rails ?? [];
  const tunnels = rails.filter((r) => r.tunnel === true);
  const isMouth = (x: number, y: number): boolean =>
    tunnels.some((t) =>
      [t.points[0], t.points[t.points.length - 1]].some(
        (p) => p !== undefined && Math.hypot(p[0] - x, p[1] - y) < 0.5,
      ),
    );
  const tracks: BedTrack[] = [];
  for (const rail of rails) {
    if (rail.tunnel === true) continue;
    const n = rail.points.length;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    const at = new Float64Array(n);
    rail.points.forEach(([x, y], i) => {
      xs[i] = x;
      ys[i] = y;
      if (i > 0) at[i] = (at[i - 1] ?? 0) + Math.hypot(x - (xs[i - 1] ?? 0), y - (ys[i - 1] ?? 0));
    });
    const first = rail.points[0];
    const last = rail.points[n - 1];
    tracks.push({
      id: rail.id,
      xs,
      ys,
      at,
      length: at[n - 1] ?? 0,
      mouths: [
        first !== undefined && isMouth(first[0], first[1]),
        last !== undefined && isMouth(last[0], last[1]),
      ],
      piece: 1 + Math.floor(hash01(tracks.length, 17, 61) * 62),
    });
  }
  const layout = new TrackBedLayout(tracks, [], settings, halfWidths);
  const modules: BedModule[] = [];
  const over = new Set(settings.over);
  const shows = (x: number, y: number): boolean => {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= field.width || cy >= field.height) return false;
    return over.has(field.names[field.cells[cy * field.width + cx] ?? 0] ?? '');
  };
  const sample = 0.25;
  tracks.forEach((track, index) => {
    // Tronçons où l'axe de la voie est sur une nature `over`: un passage à niveau les coupe.
    const spans: [number, number][] = [];
    let start = -1;
    for (let s = 0; s <= track.length + 1e-9; s += sample) {
      const d = Math.min(s, track.length);
      pointOn(track, d, point);
      const inside = shows(point.x, point.y);
      if (inside && start < 0) start = d;
      else if (!inside && start >= 0) {
        spans.push([start, d]);
        start = -1;
      }
    }
    if (start >= 0) spans.push([start, track.length]);
    for (const [a, b] of spans) {
      const count = Math.round((b - a) / settings.step);
      if (count < 1) continue;
      const length = (b - a) / count;
      for (let k = 0; k < count; k++) {
        const s0 = a + k * length;
        const s1 = s0 + length;
        const mid = (s0 + s1) / 2;
        const toMouth = layout.toMouth(index, mid);
        const sort = settings.sorts.findIndex(
          (candidate, i) =>
            usable[i] === true &&
            (candidate.nearTunnel === undefined || toMouth <= candidate.nearTunnel),
        );
        const chosen = settings.sorts[sort];
        if (chosen === undefined) continue;
        pointOn(track, mid, point);
        modules.push({
          track: index,
          sort,
          model: variantOf(chosen.model, `${track.id}:${String(k)}:${String(a)}`, manifest),
          s0,
          s1,
          tile: tileOf(map, point.x, point.y),
        });
      }
    }
  });
  const { small, margin } = settings.clear;
  const clear = landmarks
    .filter((f) => f.x1 - f.x0 <= small && f.z1 - f.z0 <= small)
    .map((f) => ({ x0: f.x0 - margin, z0: f.z0 - margin, x1: f.x1 + margin, z1: f.z1 + margin }));
  return new TrackBedLayout(tracks, modules, settings, halfWidths, clear);
}

/** Direction de la voie en `s`, lissée de part et d'autre (aucun pli aux angles du tracé). */
function tangentAt(
  track: BedTrack,
  s: number,
  smooth: number,
  out: { x: number; y: number },
): void {
  pointOn(track, s + smooth, ahead);
  pointOn(track, s - smooth, behind);
  const dx = ahead.x - behind.x;
  const dy = ahead.y - behind.y;
  const n = Math.hypot(dx, dy) || 1;
  out.x = dx / n;
  out.y = dy / n;
}

const tangent = { x: 0, y: 0 };

/**
 * Modules d'une tuile fusionnés en un maillage posé à l'origine du lieu. `geometryOf`: le modèle
 * livré (attributs du rendu encré compris); `heightAt`: le sol affiché; `field`: les natures.
 */
export function trackBedGeometry(
  layout: TrackBedLayout,
  modules: readonly BedModule[],
  geometryOf: (model: string) => BufferGeometry | null,
  heightAt: (x: number, y: number) => number,
  field: GroundField,
): BufferGeometry | null {
  const s = layout.settings;
  const over = new Set(s.over);
  const parts: BufferGeometry[] = [];
  const outerOf = new Map<string, number>();
  // Lit d'une voie qu'une autre rejoint: celui de la sorte courante (la dernière).
  const joinHalf = layout.halfWidths[s.sorts.length - 1] ?? 0;
  for (const module of modules) {
    const track = layout.tracks[module.track];
    const sort = s.sorts[module.sort];
    const source = geometryOf(module.model);
    if (track === undefined || sort === undefined || source === null) continue;
    let outer = outerOf.get(module.model);
    if (outer === undefined) {
      // Bord extérieur du profil: le sommet le plus loin de l'axe.
      const points = source.getAttribute('position');
      outer = 0;
      for (let i = 0; i < points.count; i++) outer = Math.max(outer, Math.abs(points.getX(i)));
      outerOf.set(module.model, outer);
    }
    const part = source.clone();
    const position = part.getAttribute('position');
    const normal = part.getAttribute('normal');
    const length = module.s1 - module.s0;
    // Voies plus haut dans l'ordre de la carte: celle-ci passe dans leur lit à l'aiguillage.
    const earlier = layout.tracks.slice(0, module.track);
    for (let i = 0; i < position.count; i++) {
      const lx = position.getX(i);
      const ly = position.getY(i);
      const lz = position.getZ(i);
      const along = module.s0 + (lz + 0.5) * length;
      pointOn(track, along, point);
      tangentAt(track, along, s.smooth, tangent);
      // Repère du module tourné sur la voie: z le long de la voie, x en travers (sans miroir).
      const x = point.x + tangent.y * lx;
      const z = point.y - tangent.x * lx;
      let y = ly;
      const talus = sort.talus;
      if (talus !== undefined && Math.abs(lx) > talus.from) {
        const reach = sort.nearTunnel ?? Number.POSITIVE_INFINITY;
        const grow = Math.min(
          1,
          Math.max(0, (reach - layout.toMouth(module.track, along)) / talus.ramp),
        );
        y = ly * grow - (1 - grow) * s.sink;
      }
      if (Math.abs(lx) >= outer - 0.01) y -= s.sink;
      const cx = Math.floor(x);
      const cz = Math.floor(z);
      const nature =
        cx < 0 || cz < 0 || cx >= field.width || cz >= field.height
          ? ''
          : (field.names[field.cells[cz * field.width + cx] ?? 0] ?? '');
      if (!over.has(nature)) y = Math.min(y, -s.sink);
      if (
        Math.abs(lx) > s.junction.crown &&
        layout.clear.some((f) => x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1)
      )
        y = Math.min(y, -s.sink);
      for (const other of earlier) {
        if (distanceTo(other, x, z) >= joinHalf) continue;
        y = Math.abs(lx) > s.junction.crown ? Math.min(y, -s.sink) : y + s.junction.above;
        break;
      }
      position.setXYZ(i, x, heightAt(x, z) + y + s.lift, z);
      const nx = normal.getX(i);
      const nz = normal.getZ(i);
      normal.setXYZ(
        i,
        tangent.y * nx + tangent.x * nz,
        normal.getY(i),
        -tangent.x * nx + tangent.y * nz,
      );
    }
    const ink = part.getAttribute('aInk');
    for (let i = 0; i < ink.count; i++) {
      // La classe de taille du module reste (hachures), le numéro devient celui de la voie.
      const size = Math.floor(ink.getY(i) / 64);
      ink.setY(i, size * 64 + track.piece);
    }
    parts.push(part);
  }
  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}
