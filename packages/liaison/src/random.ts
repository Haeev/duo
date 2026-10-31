import { randomBytes } from 'node:crypto';

/** Source d'aléa injectée: système en production, à graine dans les tests. */
export interface RandomSource {
  /** Nombre dans [0, 1). */
  next(): number;
  bytes(length: number): Uint8Array;
}

export function createCryptoRandom(): RandomSource {
  return {
    next: () => {
      const buffer = randomBytes(4);
      return buffer.readUInt32BE(0) / 0x1_0000_0000;
    },
    bytes: (length) => new Uint8Array(randomBytes(length)),
  };
}

/** Générateur à graine (mulberry32): mêmes tirages à chaque exécution d'un test. */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return {
    next: () => nextUint32() / 0x1_0000_0000,
    bytes: (length) => {
      const out = new Uint8Array(length);
      for (let index = 0; index < length; index += 1) {
        out[index] = nextUint32() & 0xff;
      }
      return out;
    },
  };
}

export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

export function fromBase64Url(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, 'base64url'));
}

/** Identifiant aléatoire de 128 bits en hexadécimal (liaison, salon, partie). */
export function randomId(random: RandomSource): string {
  return toHex(random.bytes(16));
}

/** Entier dans [min, max]. */
export function randomInt(random: RandomSource, min: number, max: number): number {
  return min + Math.floor(random.next() * (max - min + 1));
}
