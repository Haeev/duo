// Géométrie plane des collisions (technique 5.2: deux dimensions par niveau, pas de physique).

/** Obstacle au sol: rectangle orienté (centre, demi-côtés, angle) ou disque. */
export type Obstacle =
  | {
      readonly kind: 'box';
      readonly x: number;
      readonly z: number;
      readonly hx: number;
      readonly hz: number;
      readonly rotRad: number;
    }
  | { readonly kind: 'disc'; readonly x: number; readonly z: number; readonly r: number };

export interface Vec2 {
  x: number;
  z: number;
}

/**
 * Repousse un disque (centre `p`, rayon `r`) hors de l'obstacle. Modifie `p`.
 * Rend vrai s'il y a eu contact.
 */
export function pushOut(p: Vec2, r: number, o: Obstacle): boolean {
  if (o.kind === 'disc') {
    const dx = p.x - o.x;
    const dz = p.z - o.z;
    const min = r + o.r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min) return false;
    const d = Math.sqrt(d2);
    if (d < 1e-9) {
      p.x = o.x + min;
      return true;
    }
    p.x = o.x + (dx / d) * min;
    p.z = o.z + (dz / d) * min;
    return true;
  }
  // Repère du rectangle: rotation inverse de celle de Three.js autour de y.
  const cos = Math.cos(o.rotRad);
  const sin = Math.sin(o.rotRad);
  const wx = p.x - o.x;
  const wz = p.z - o.z;
  const lx = wx * cos - wz * sin;
  const lz = wx * sin + wz * cos;
  const cx = Math.max(-o.hx, Math.min(o.hx, lx));
  const cz = Math.max(-o.hz, Math.min(o.hz, lz));
  const dx = lx - cx;
  const dz = lz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  let nx: number;
  let nz: number;
  if (d2 > 1e-12) {
    // Centre hors du rectangle: on le pose à `r` du point le plus proche.
    const d = Math.sqrt(d2);
    nx = cx + (dx / d) * r;
    nz = cz + (dz / d) * r;
  } else {
    // Centre dans le rectangle: sortie par le côté le plus proche.
    const ex = o.hx - Math.abs(lx);
    const ez = o.hz - Math.abs(lz);
    if (ex < ez) {
      nx = Math.sign(lx || 1) * (o.hx + r);
      nz = lz;
    } else {
      nx = lx;
      nz = Math.sign(lz || 1) * (o.hz + r);
    }
  }
  // Retour au repère du monde.
  p.x = o.x + nx * cos + nz * sin;
  p.z = o.z - nx * sin + nz * cos;
  return true;
}

/** Rectangle orienté d'un meuble ou d'un élément de plan, à partir de son centre et de sa rotation. */
export function box(x: number, z: number, width: number, depth: number, rotDeg: number): Obstacle {
  return { kind: 'box', x, z, hx: width / 2, hz: depth / 2, rotRad: (rotDeg * Math.PI) / 180 };
}

/** Passe un point local (x, z) d'un meuble tourné de `rotDeg` dans le repère du monde. */
export function localToWorld(cx: number, cz: number, rotDeg: number, lx: number, lz: number): Vec2 {
  const a = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: cx + lx * cos + lz * sin, z: cz - lx * sin + lz * cos };
}
