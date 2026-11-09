/**
 * Visée du mode aménagement (pure, sans Three.js): le meuble visé, et la pose proposée pour la
 * pièce tenue d'après le rayon des yeux (sol, mur, plafond, dessus d'un meuble, appui de vitrine,
 * store), aimantée à la grille de 25 cm et, au sol, collée doucement au mur le plus proche.
 */
import type { Content } from '../donnees/charger';
import type { FurnitureType } from '../donnees/schemas';
import type { PlacedFurniture, World } from '../etat/monde';
import type { Eye } from '../simulation/visee';
import type { PlacementRequest } from './intentions';
import { arrangementHooks } from './crochets';
import {
  mountOf,
  norm,
  onFace,
  placementOf,
  surfacesOf,
  wallFaces,
  windowsOf,
  distanceTo,
  type WallFace,
} from './regles';

interface Ray {
  readonly ox: number;
  readonly oy: number;
  readonly oz: number;
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
}

export function rayOf(eye: Eye): Ray {
  const yaw = (eye.yawDeg * Math.PI) / 180;
  const pitch = (eye.pitchDeg * Math.PI) / 180;
  return {
    ox: eye.x,
    oy: eye.y,
    oz: eye.z,
    dx: -Math.sin(yaw) * Math.cos(pitch),
    dy: Math.sin(pitch),
    dz: -Math.cos(yaw) * Math.cos(pitch),
  };
}

/** Distance le long du rayon jusqu'à la boîte orientée d'un meuble posé, ou `null`. */
function hitFurniture(ray: Ray, f: PlacedFurniture, type: FurnitureType): number | null {
  const a = (-f.rotDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  // Repère du meuble: rotation inverse de `localToWorld`.
  const wx = ray.ox - f.x;
  const wz = ray.oz - f.z;
  const lx = wx * cos + wz * sin;
  const lz = -wx * sin + wz * cos;
  const ldx = ray.dx * cos + ray.dz * sin;
  const ldz = -ray.dx * sin + ray.dz * cos;
  const [w, d] = type.footprint;
  const min = [-w / 2, f.y, -d / 2];
  const max = [w / 2, f.y + Math.max(0.05, type.height), d / 2];
  const o = [lx, ray.oy, lz];
  const dir = [ldx, ray.dy, ldz];
  let t0 = 0;
  let t1 = Infinity;
  for (let k = 0; k < 3; k++) {
    const ok = o[k] ?? 0;
    const dk = dir[k] ?? 0;
    const lo = min[k] ?? 0;
    const hi = max[k] ?? 0;
    if (Math.abs(dk) < 1e-9) {
      if (ok < lo || ok > hi) return null;
      continue;
    }
    let ta = (lo - ok) / dk;
    let tb = (hi - ok) / dk;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}

/** Meuble visé (le plus proche sur le rayon, à portée), parmi ceux que `accept` retient. */
export function aimedFurniture(
  content: Content,
  world: World,
  eye: Eye,
  accept: (f: PlacedFurniture) => boolean,
): PlacedFurniture | null {
  const ray = rayOf(eye);
  const reach = content.arrangement.rules.reach;
  let best: PlacedFurniture | null = null;
  let bestT = reach;
  for (const f of world.furniture) {
    const type = content.furniture.get(f.type);
    if (type === undefined || !accept(f)) continue;
    const t = hitFurniture(ray, f, type);
    if (t !== null && t < bestT) {
      bestT = t;
      best = f;
    }
  }
  return best;
}

const snap = (v: number, g: number): number => Math.round(v / g) * g;

/** Demi-largeurs selon x et z d'une empreinte tournée. */
function extents(type: FurnitureType, rotDeg: number): [number, number] {
  const a = (rotDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const [w, d] = type.footprint;
  return [(w * c + d * s) / 2, (w * s + d * c) / 2];
}

function planeY(ray: Ray, y: number, reach: number): { x: number; z: number } | null {
  if (Math.abs(ray.dy) < 1e-6) return null;
  const t = (y - ray.oy) / ray.dy;
  if (t <= 0 || t > reach + 1.5) return null;
  const x = ray.ox + ray.dx * t;
  const z = ray.oz + ray.dz * t;
  return Math.hypot(x - ray.ox, z - ray.oz) <= reach ? { x, z } : null;
}

function faceHit(
  ray: Ray,
  face: WallFace,
  reach: number,
): { along: number; y: number; t: number } | null {
  const o = face.axis === 'z' ? ray.oz : ray.ox;
  const d = face.axis === 'z' ? ray.dz : ray.dx;
  if (Math.abs(d) < 1e-6) return null;
  // On regarde le mur depuis la pièce: la normale fait face au regard.
  if (d * face.normal > 0) return null;
  const t = (face.line - o) / d;
  if (t <= 0 || t > reach) return null;
  const along = face.axis === 'z' ? ray.ox + ray.dx * t : ray.oz + ray.dz * t;
  if (along < face.from || along > face.to) return null;
  return { along, y: ray.oy + ray.dy * t, t };
}

/** Pose proposée pour le type `type` tenu, au cap `rotDeg` choisi par le joueur. */
export function proposePlacement(
  content: Content,
  world: World,
  type: string,
  eye: Eye,
  rotDeg: number,
): PlacementRequest | null {
  const ft = content.furniture.get(type);
  if (ft === undefined) return null;
  const rules = content.arrangement.rules;
  const ray = rayOf(eye);
  // Appareil à place unique (installation): l'aperçu s'aimante à sa place quand on la vise.
  const spot = arrangementHooks().spot?.(content, world, type) ?? null;
  if (spot !== null) {
    const hit = planeY(ray, spot.y, rules.reach + 1) ?? planeY(ray, 0, rules.reach);
    if (hit === null) return null;
    if (Math.hypot(hit.x - spot.x, hit.z - spot.z) <= spot.snap)
      return { x: spot.x, z: spot.z, y: spot.y, rotDeg: spot.rotDeg, support: null };
    return { x: round(hit.x), z: round(hit.z), y: 0, rotDeg: norm(rotDeg), support: null };
  }
  const reach = rules.reach;
  const placement = placementOf(content, type);
  const mount = mountOf(placement);
  const g = rules.grid;
  switch (mount) {
    case 'floor': {
      const p = planeY(ray, 0, reach);
      if (p === null) return null;
      let rot = norm(rotDeg);
      const [ex, ez] = extents(ft, rot);
      let x = snap(p.x - ex, g) + ex;
      let z = snap(p.z - ez, g) + ez;
      // Aimant doux: un bord près d'un mur s'y colle; « dos au mur » s'y tourne aussi.
      for (const face of wallFaces(content, world)) {
        if (face.outside) continue;
        const along = face.axis === 'z' ? x : z;
        if (along < face.from - 0.2 || along > face.to + 0.2) continue;
        if (placement === 'floor_wall') {
          const near = face.axis === 'z' ? Math.abs(z - face.line) : Math.abs(x - face.line);
          if (near > rules.wallSnap + Math.max(ex, ez)) continue;
          rot = norm(face.rotDeg);
          const c = onFace(face, along, ft.footprint[1]);
          x = face.axis === 'z' ? x : c.x;
          z = face.axis === 'z' ? c.z : z;
          break;
        }
        const edge = face.axis === 'z' ? z - face.normal * ez : x - face.normal * ex;
        if (Math.abs(edge - face.line) <= rules.wallSnap) {
          if (face.axis === 'z') z = face.line + face.normal * ez;
          else x = face.line + face.normal * ex;
        }
      }
      return { x: round(x), z: round(z), y: 0, rotDeg: rot, support: null };
    }
    case 'wall':
    case 'facade': {
      let best: { face: WallFace; along: number; y: number; t: number } | null = null;
      for (const face of wallFaces(content, world)) {
        if (face.outside !== (mount === 'facade')) continue;
        const h = faceHit(ray, face, reach + (mount === 'facade' ? 2 : 0));
        if (h !== null && (best === null || h.t < best.t)) best = { face, ...h };
      }
      if (best === null) return null;
      const half = ft.footprint[0] / 2;
      const along = Math.max(
        best.face.from + half,
        Math.min(best.face.to - half, snap(best.along, 0.05)),
      );
      const y =
        mount === 'facade'
          ? rules.facadeY
          : Math.max(
              rules.wallItemMinY,
              Math.min(rules.wallItemMaxY - ft.height, snap(best.y - ft.height / 2, 0.05)),
            );
      const c = onFace(best.face, along, ft.footprint[1]);
      return { x: round(c.x), z: round(c.z), y: round(y), rotDeg: best.face.rotDeg, support: null };
    }
    case 'ceiling':
    case 'store': {
      const top = mount === 'ceiling' ? rules.ceiling : rules.storeHeight;
      const p = planeY(ray, top, reach + 1);
      if (p === null) return null;
      return {
        x: round(snap(p.x, g)),
        z: round(snap(p.z, g)),
        y: round(top - ft.height),
        rotDeg: norm(rotDeg),
        support: null,
      };
    }
    case 'surface': {
      let best: { f: PlacedFurniture; x: number; z: number; y: number; t: number } | null = null;
      const wantCounter = placement === 'counter' || placement === 'counter_tip';
      for (const f of world.furniture) {
        for (const s of surfacesOf(content, f)) {
          if (wantCounter && s.placement !== 'counter') continue;
          const p = planeY(ray, s.y, reach);
          if (p === null || distanceTo(p.x, p.z, s.rect) > 0) continue;
          const t = Math.hypot(p.x - ray.ox, s.y - ray.oy, p.z - ray.oz);
          if (best === null || t < best.t) best = { f, x: p.x, z: p.z, y: s.y, t };
        }
      }
      if (best === null) return null;
      return {
        x: round(snap(best.x, 0.05)),
        z: round(snap(best.z, 0.05)),
        y: round(best.y),
        rotDeg: norm(rotDeg),
        support: best.f.id,
      };
    }
    case 'sill':
    case 'vitrine': {
      for (const w of windowsOf(content, world)) {
        const [wx, wz, ww, wd] = w.rect;
        const y = mount === 'sill' ? w.sill : rules.vitrineY;
        const p = mount === 'sill' ? planeY(ray, y, reach) : null;
        const zc = wz + wd / 2;
        const hit =
          p ??
          (Math.abs(ray.dz) > 1e-6
            ? { x: ray.ox + ray.dx * ((zc - ray.oz) / ray.dz), z: zc }
            : null);
        if (
          hit === null ||
          hit.x < wx ||
          hit.x > wx + ww ||
          hit.z < wz - 0.3 ||
          hit.z > wz + wd + 0.3
        )
          continue;
        const half = ft.footprint[0] / 2;
        const x = Math.max(wx + half, Math.min(wx + ww - half, snap(hit.x, 0.05)));
        return { x: round(x), z: round(zc), y: round(y), rotDeg: 0, support: null };
      }
      return null;
    }
  }
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
