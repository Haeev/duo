/**
 * Collisions maison sur la grille du lieu (cases de 1 m), reprises de l'ancien jeu en copie
 * relue. Déterministe: mêmes entrées, même résultat, dans Node comme dans Chromium. Le même code
 * sert à l'hôte et à la prédiction de l'invité; aucune allocation par pas.
 */
import { CORE_TUNING } from './reglages-noyau';

/** Ce qui bloque dans le lieu courant: la carte (murs, eau) et les meubles solides. */
export interface Blockers {
  readonly width: number;
  readonly height: number;
  /** 1: case bloquée par la carte. */
  readonly fixed: Uint8Array;
  /** 1: case bloquée par un meuble solide (refait quand un meuble change). */
  readonly props: Uint8Array;
  /**
   * Lisses baissées (barrières de passage à niveau): des traits qu'on ne franchit que dans un
   * sens, hors de la grille (`keepOffBars`). Absent: aucune.
   */
  readonly bars?: readonly Bar[];
}

/**
 * Une lisse sur la carte: centre (x, y), sens de sa longueur (ax, ay), demi-longueur, et la
 * normale (nx, ny) qui regarde la voie: venu de la route (l'autre côté) on s'y arrête, venu de
 * la voie on la passe.
 */
export interface Bar {
  readonly x: number;
  readonly y: number;
  readonly ax: number;
  readonly ay: number;
  readonly half: number;
  readonly nx: number;
  readonly ny: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export function isBlockedCell(b: Blockers, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= b.width || cy >= b.height) return true;
  const i = cy * b.width + cx;
  return b.fixed[i] === 1 || b.props[i] === 1;
}

/** Mur ou bord de carte (sans les meubles): ce qui arrête aussi la visée. */
export function isWallCell(b: Blockers, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= b.width || cy >= b.height) return true;
  return b.fixed[cy * b.width + cx] === 1;
}

/** Le disque du corps en (x, y) touche-t-il une case bloquée ? */
export function bodyCollides(b: Blockers, x: number, y: number, radius: number): boolean {
  const maxX = Math.floor(x + radius);
  const maxY = Math.floor(y + radius);
  for (let cy = Math.floor(y - radius); cy <= maxY; cy++) {
    for (let cx = Math.floor(x - radius); cx <= maxX; cx++) {
      if (!isBlockedCell(b, cx, cy)) continue;
      const nx = Math.max(cx, Math.min(x, cx + 1));
      const ny = Math.max(cy, Math.min(y, cy + 1));
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

/**
 * Enfoncement du disque dans les cases bloquées: somme des carrés de ce qui dépasse dans chacune.
 * Glisser à l'intérieur d'une seule case ne le change pas; toucher une seconde case l'augmente.
 */
function overlap(b: Blockers, x: number, y: number, radius: number): number {
  let total = 0;
  const maxX = Math.floor(x + radius);
  const maxY = Math.floor(y + radius);
  for (let cy = Math.floor(y - radius); cy <= maxY; cy++) {
    for (let cx = Math.floor(x - radius); cx <= maxX; cx++) {
      if (!isBlockedCell(b, cx, cy)) continue;
      const nx = Math.max(cx, Math.min(x, cx + 1));
      const ny = Math.max(cy, Math.min(y, cy + 1));
      const d = Math.hypot(x - nx, y - ny);
      if (d < radius) total += (radius - d) ** 2;
    }
  }
  return total;
}

/**
 * Bloqué de face par un coin: le plus petit décalage de côté (axe `sx`, `sy`) qui libère le
 * passage en (`tx`, `ty`); on glisse de ce côté d'au plus `step`, d'abord dans le sens de `hint`.
 */
function nudge(
  b: Blockers,
  pos: Vec2,
  tx: number,
  ty: number,
  sx: number,
  sy: number,
  step: number,
  hint: number,
  radius: number,
): void {
  const first = hint < 0 ? -1 : 1;
  const { cornerNudgeStep, cornerNudgeMax } = CORE_TUNING;
  for (let o = cornerNudgeStep; o <= cornerNudgeMax + 1e-9; o += cornerNudgeStep) {
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? first : -first;
      if (bodyCollides(b, tx + sx * side * o, ty + sy * side * o, radius)) continue;
      const shift = side * Math.min(o, step);
      const nx = pos.x + sx * shift;
      const ny = pos.y + sy * shift;
      if (!bodyCollides(b, nx, ny, radius)) {
        pos.x = nx;
        pos.y = ny;
      }
      return;
    }
  }
}

/**
 * Déplace `pos` de (dx, dy) en glissant le long des obstacles (axe par axe). Modifie `pos` en
 * place.
 */
export function moveBody(b: Blockers, pos: Vec2, dx: number, dy: number, radius: number): void {
  // Déjà pris dans un obstacle (assis sur un banc, meuble posé sur soi, vieille sauvegarde): tout
  // pas qui ne s'enfonce pas est permis, sinon le personnage resterait figé.
  if (bodyCollides(b, pos.x, pos.y, radius)) {
    const nx = pos.x + dx;
    const ny = pos.y + dy;
    if (overlap(b, nx, ny, radius) <= overlap(b, pos.x, pos.y, radius) + 1e-12) {
      pos.x = nx;
      pos.y = ny;
    }
    return;
  }
  if (dx !== 0) {
    const nx = pos.x + dx;
    if (!bodyCollides(b, nx, pos.y, radius)) pos.x = nx;
    else if (Math.abs(dx) >= Math.abs(dy)) nudge(b, pos, nx, pos.y, 0, 1, Math.abs(dx), dy, radius);
  }
  if (dy !== 0) {
    const ny = pos.y + dy;
    if (!bodyCollides(b, pos.x, ny, radius)) pos.y = ny;
    else if (Math.abs(dy) > Math.abs(dx)) nudge(b, pos, pos.x, ny, 1, 0, Math.abs(dy), dx, radius);
  }
}

/**
 * Centre de la case libre la plus proche d'un point, écrit dans `out`; faux s'il n'y en a pas à
 * portée. À distance égale, la première dans l'ordre des cases: le résultat est déterministe.
 */
export function nearestFreeCell(b: Blockers, x: number, y: number, out: Vec2): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  for (let r = 0; r <= CORE_TUNING.freeCellRadius; r++) {
    let found = false;
    let bestD = Number.POSITIVE_INFINITY;
    for (let cy = ty - r; cy <= ty + r; cy++) {
      for (let cx = tx - r; cx <= tx + r; cx++) {
        if (Math.max(Math.abs(cx - tx), Math.abs(cy - ty)) !== r) continue;
        if (isBlockedCell(b, cx, cy)) continue;
        const d = Math.hypot(cx + 0.5 - x, cy + 0.5 - y);
        if (d < bestD - 1e-9) {
          bestD = d;
          out.x = cx + 0.5;
          out.y = cy + 0.5;
          found = true;
        }
      }
    }
    if (found) return true;
  }
  return false;
}

/**
 * Cases que l'on rejoint à pied depuis une case (quatre voisins: le corps passe par toute case
 * libre). Sert au déblocage, jamais à chaque pas.
 */
export function reachableCells(b: Blockers, fromX: number, fromY: number): Set<number> {
  const seen = new Set<number>();
  const sx = Math.floor(fromX);
  const sy = Math.floor(fromY);
  if (isBlockedCell(b, sx, sy)) return seen;
  const queue: number[] = [sy * b.width + sx];
  seen.add(sy * b.width + sx);
  // La file grandit pendant le parcours: `for...of` lit aussi les cases ajoutées.
  for (const i of queue) {
    const cx = i % b.width;
    const cy = (i - cx) / b.width;
    for (let k = 0; k < 4; k++) {
      const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (isBlockedCell(b, nx, ny)) continue;
      const ni = ny * b.width + nx;
      if (seen.has(ni)) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return seen;
}

/**
 * Après un déplacement de (fromX, fromY) à `pos`: un corps venu de la route (côté opposé à la
 * normale d'une lisse) ne s'en approche pas à moins de son rayon, ni ne passe par ses bouts; il
 * glisse le long. Venu du côté de la voie, il passe: personne n'est enfermé. Si la retenue le
 * mettait dans un mur, il reste où il était. Sans allocation.
 */
export function keepOffBars(
  b: Blockers,
  fromX: number,
  fromY: number,
  pos: Vec2,
  radius: number,
): void {
  const bars = b.bars;
  if (bars === undefined || bars.length === 0) return;
  let moved = false;
  for (const bar of bars) {
    const from = (fromX - bar.x) * bar.nx + (fromY - bar.y) * bar.ny;
    if (from >= 0) continue;
    const dx = pos.x - bar.x;
    const dy = pos.y - bar.y;
    const along = dx * bar.ax + dy * bar.ay;
    const u = dx * bar.nx + dy * bar.ny;
    // Déjà plus près que son rayon (la lisse est tombée devant lui): il n'avance plus vers elle.
    const limit = Math.max(from, -radius);
    if (Math.abs(along) <= bar.half) {
      if (u > limit) {
        pos.x -= (u - limit) * bar.nx;
        pos.y -= (u - limit) * bar.ny;
        moved = true;
      }
      continue;
    }
    // Au bout de la lisse: le corps en contourne l'extrémité.
    const end = Math.sign(along) * bar.half;
    const ex = pos.x - (bar.x + end * bar.ax);
    const ey = pos.y - (bar.y + end * bar.ay);
    const d = Math.hypot(ex, ey);
    if (d < radius && u > limit && d > 1e-9) {
      pos.x += (ex / d) * (radius - d);
      pos.y += (ey / d) * (radius - d);
      moved = true;
    }
  }
  if (moved && bodyCollides(b, pos.x, pos.y, radius)) {
    pos.x = fromX;
    pos.y = fromY;
  }
}
