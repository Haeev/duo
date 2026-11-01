/**
 * Tirages par empreinte, sans le générateur de la partie: le moment du matin (simulation) et la
 * rumeur du bourg (interface) en dépendent. Même formule que le script `moments_rares.py`.
 */

/** FNV-1a 32 bits (comme `variantOf`). */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Mélange final de MurmurHash3. */
export function fmix32(value: number): number {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Nombre de [0, 1[ tiré de « graine:clé:jour ». */
export function unitDraw(seed: number, key: string, day: number): number {
  return fmix32(fnv1a(`${String(seed)}:${key}:${String(day)}`)) / 2 ** 32;
}
