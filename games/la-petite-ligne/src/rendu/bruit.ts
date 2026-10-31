/**
 * Bruit déterministe pour le décor (taches d'herbe, touffes, arbres du
 * pourtour): mêmes valeurs sur les deux machines et à chaque chargement, sans
 * `Math.random`.
 */

const HASH_X = 127.1;
const HASH_Y = 311.7;
const HASH_SEED = 74.7;
const HASH_SCALE = 43758.5453;

/** Valeur pseudo-aléatoire dans [0, 1[ pour une case entière et une graine. */
export function hash2(x: number, y: number, seed = 0): number {
  const s = Math.sin(x * HASH_X + y * HASH_Y + seed * HASH_SEED) * HASH_SCALE;
  return s - Math.floor(s);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Bruit de valeur lissé, de 0 à 1, à l'échelle `scale` (taille d'une tache). */
export function valueNoise(x: number, y: number, scale: number, seed = 0): number {
  const fx = x / scale;
  const fy = y / scale;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = smooth(fx - ix);
  const ty = smooth(fy - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
