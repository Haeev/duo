// Générateur pseudo-aléatoire à graine (sfc32, amorcé par splitmix32). Opérations entières
// sur 32 bits et une division exacte: même suite sur toutes les machines, dans Node comme
// dans Chromium (exigé par le lockstep et par les tests de simulation).

/** État complet du générateur: quatre entiers non signés sur 32 bits, à mettre dans une sauvegarde. */
export type RandomState = readonly [number, number, number, number];

export interface RandomSource {
  /** Nombre dans [0, 1). */
  next(): number;
  /** Entier dans [min, max). */
  int(min: number, max: number): number;
  /** Réel dans [min, max). */
  float(min: number, max: number): number;
  /** `true` avec la probabilité `p`. */
  chance(p: number): boolean;
  /** Un élément au hasard; lève une erreur sur un tableau vide. */
  pick<T>(items: readonly T[]): T;
  /** Mélange en place (Fisher-Yates) et renvoie le même tableau. */
  shuffle<T>(items: T[]): T[];
  /** Copie de l'état, pour sauvegarder ou rejouer. */
  getState(): RandomState;
  setState(state: RandomState): void;
}

const UINT32 = 4_294_967_296;

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

/** Empreinte FNV-1a sur 32 bits d'un texte (pour dériver des graines par libellé). */
export function fnv1a32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Graine d'un flux indépendant, reproductible: même graine et même libellé donnent la même suite. */
export function deriveSeed(seed: number, label: string): number {
  return (fnv1a32(label) ^ Math.imul(seed >>> 0, 0x9e3779b1)) >>> 0;
}

/** Crée un générateur depuis une graine (entier sur 32 bits) ou un état sauvegardé. */
export function createRandom(seedOrState: number | RandomState): RandomSource {
  let a: number;
  let b: number;
  let c: number;
  let d: number;
  if (typeof seedOrState === 'number') {
    const mix = splitmix32(seedOrState);
    a = mix();
    b = mix();
    c = mix();
    d = mix();
  } else {
    [a, b, c, d] = seedOrState;
  }

  const nextUint32 = (): number => {
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return t;
  };

  const next = (): number => nextUint32() / UINT32;

  return {
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max <= min) {
        throw new RangeError(`random.int: intervalle invalide [${min}, ${max})`);
      }
      return min + Math.floor(next() * (max - min));
    },
    float(min, max) {
      return min + next() * (max - min);
    },
    chance(p) {
      return next() < p;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new RangeError('random.pick: tableau vide');
      }
      return items[Math.floor(next() * items.length)] as T;
    },
    shuffle<T>(items: T[]): T[] {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = items[i] as T;
        items[i] = items[j] as T;
        items[j] = tmp;
      }
      return items;
    },
    getState() {
      return [a, b, c, d];
    },
    setState(state) {
      [a, b, c, d] = state;
    },
  };
}
